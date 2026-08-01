#!/usr/bin/env node
/**
 * Content generator — constraint solver.
 *
 * Auto-composes many puzzles from a large tagged library of hand-verified
 * connection groups. It GUARANTEES, for every generated puzzle:
 *   • 16 unique cards (the 4 chosen groups are card-disjoint),
 *   • no letter/rhyme trap is ambiguous (no stray card in the puzzle also
 *     satisfies the rule),
 *   • no colour/shape/hidden trap is ambiguous (uses per-group `exclude` sets),
 *   • balanced group usage (usage-capped picking) so no group dominates a
 *     difficulty pool — which keeps the runtime no-repeat sequencer feasible,
 *   • deterministic output (seeded PRNG) so re-running doesn't churn content.
 *
 * Idempotent: keeps hand-authored puzzles #1–#6 and regenerates the rest.
 * Run: node scripts/gen-more-puzzles.mjs && npm run validate
 *
 * DIFFICULTY = how many "trap" groups (rhyme/letter/colour/shape/hidden):
 *   facil = 0 traps (four plain categories)
 *   media = 1 trap
 *   dificil = 2 traps (+ the disjoint/decoy pressure that creates)
 *
 * To grow the game: add groups to LIB (and their `exclude` if colour/shape/
 * hidden), bump the TARGETS, regenerate, validate. That's it.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUZZLES_PATH = join(root, 'src/data/puzzles.json');

// ── Card names (for letter/rhyme ambiguity checks) ─────────────────────────
//
// BOTH decks. This read cards.ts alone, which is the original 54 — so the
// ambiguity checks below were blind to the 941 expansion cards, and a letter
// trap looked clean to the generator while the finished board carried eight
// cards starting with the same letter. It shipped 159 unsolvable puzzles out of
// 746 the first time the runway was extended, every one of them passing this
// script and failing validate-puzzles.mjs immediately afterwards.
//
// The lesson is narrower than "load both files": a checker that reads a subset
// of the data it is checking against does not fail, it approves.
const cardsSrc = readFileSync(join(root, 'src/data/cards.ts'), 'utf8');
const cardName = Object.fromEntries(
  [...cardsSrc.matchAll(/id:\s*'([a-z0-9_]+)',\s*name:\s*'([^']+)'/g)].map((m) => [m[1], m[2]])
);
for (const c of JSON.parse(readFileSync(join(root, 'src/data/expansion.cards.json'), 'utf8'))) {
  if (!(c.id in cardName)) cardName[c.id] = c.name;
}
const stripDiacritics = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
function noun(id) {
  const parts = (cardName[id] ?? '').split(' ');
  return /^(El|La|Las|Los)$/.test(parts[0]) ? parts.slice(1).join(' ') : cardName[id] ?? '';
}
const nounInitial = (id) => stripDiacritics(noun(id)).charAt(0).toUpperCase();
const nounLower = (id) => noun(id).toLowerCase();

// ── The library ────────────────────────────────────────────────────────────
//
// READ FROM DISK, not held inline. This was a 40-group literal that the script
// also WROTE BACK over src/data/groups.json at the end — so running it silently
// reverted the live library to whatever this file happened to say. Measured
// before it was changed: a run today would have discarded «Hombres del pueblo»
// and «Crecen parados», two theme fixes made hours earlier, and their whys with
// them. A generator that quietly rewrites its own inputs is not a generator.
//
// It was also long out of date. The deck grew from 40 groups to 506, and a
// solver drawing on 40 of them cannot build a long runway of puzzles however
// high the targets are set.
const LIB = {
  ...JSON.parse(readFileSync(join(root, 'src/data/groups.json'), 'utf8')),
  ...JSON.parse(readFileSync(join(root, 'src/data/expansion.groups.json'), 'utf8')),
};

const ALL = Object.keys(LIB);
const CATS = ALL.filter((r) => LIB[r].kind === 'cat');
const TRAPS = ALL.filter((r) => LIB[r].kind !== 'cat');

// ── Deterministic PRNG (mulberry32) ────────────────────────────────────────
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260728);
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Constraint helpers ─────────────────────────────────────────────────────
// Pure random order, but never exceed the usage `cap` for any group — this
// explores the large valid space while keeping group usage balanced.
function pickDisjoint(pool, k, usedCards, usage, cap) {
  const order = shuffle(pool);
  const chosen = [];
  const cards = new Set(usedCards);
  for (const r of order) {
    if (chosen.length === k) break;
    if ((usage[r] || 0) >= cap) continue;
    if (LIB[r].cards.some((c) => cards.has(c))) continue;
    chosen.push(r);
    for (const c of LIB[r].cards) cards.add(c);
  }
  return chosen.length === k ? chosen : null;
}

function ambiguous(refs) {
  const cards = refs.flatMap((r) => LIB[r].cards);
  for (const r of refs) {
    const g = LIB[r];
    if (g.kind === 'letter') {
      const L = g.theme.match(/«(.)»/u)[1].toUpperCase();
      if (cards.filter((c) => nounInitial(c) === L).length !== 4) return true;
    } else if (g.kind === 'rhyme') {
      const suf = g.theme.match(/«-(.+?)»/u)[1].toLowerCase();
      if (cards.filter((c) => nounLower(c).endsWith(suf)).length !== 4) return true;
    } else if (g.exclude && g.exclude.length) {
      const others = cards.filter((c) => !g.cards.includes(c));
      if (others.some((c) => g.exclude.includes(c))) return true;
    }
  }
  return false;
}

function buildPool(nTraps, target, usage, seenGlobal) {
  const nCats = 4 - nTraps;
  const out = [];
  const seen = new Set();
  // Start with a tight usage cap for even distribution; loosen only if stuck.
  let cap = 2;
  let sinceAccept = 0;
  let attempts = 0;
  const MAX = target * 20000;
  while (out.length < target && attempts < MAX) {
    attempts++;
    sinceAccept++;
    if (sinceAccept > 1500) {
      cap++;
      sinceAccept = 0;
    }
    const traps = nTraps ? pickDisjoint(TRAPS, nTraps, [], usage, cap) : [];
    if (nTraps && !traps) continue;
    const cats = pickDisjoint(CATS, nCats, traps.flatMap((r) => LIB[r].cards), usage, cap);
    if (!cats) continue;
    const refs = [...cats, ...traps]; // cats first → low tiers; traps last → high tiers
    if (ambiguous(refs)) continue;
    const key = [...refs].sort().join('+');
    if (seen.has(key) || seenGlobal.has(key)) continue;
    seen.add(key);
    seenGlobal.add(key);
    out.push(refs);
    sinceAccept = 0;
    for (const r of refs) usage[r] = (usage[r] || 0) + 1;
  }
  const freq = {};
  for (const refs of out) for (const r of refs) freq[r] = (freq[r] || 0) + 1;
  const maxFreq = Math.max(0, ...Object.values(freq));
  if (out.length < target) console.warn(`  ⚠ only reached ${out.length}/${target} (traps=${nTraps}).`);
  console.log(`  traps=${nTraps}: ${out.length} puzzles, final cap ${cap}, max group use ${maxFreq}`);
  return out;
}

// ── Assemble puzzles ───────────────────────────────────────────────────────
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const all = JSON.parse(readFileSync(PUZZLES_PATH, 'utf8'));
const base = all
  .filter((p) => p.number <= 6)
  .sort((a, b) => a.number - b.number)
  .map((p) => ({ ...p, difficulty: p.difficulty ?? 'media' }));
const lastDate = base[base.length - 1].date;

// Pre-seed MEDIA usage with base puzzles so the solver doesn't pile more onto
// groups the hand-authored intro puzzles already lean on.
const keyToRef = {};
for (const r of ALL) keyToRef[[...LIB[r].cards].sort().join('|')] = r;
const mediaUsage = {};
for (const p of base) {
  for (const g of p.groups) {
    const ref = keyToRef[[...g.cardIds].sort().join('|')];
    if (ref) mediaUsage[ref] = (mediaUsage[ref] || 0) + 1;
  }
}

/**
 * How many puzzles to author, by difficulty.
 *
 * Sized as a RUNWAY, not a number. `getTodaysPuzzle()` falls back to the most
 * recent past puzzle when it runs off the end of the list — silently — so an
 * exhausted run does not error, it hands every player in the world the same
 * frozen board every day. The old targets totalled 104 and covered to
 * 2026-10-19, seventy-nine days out, with nothing watching the horizon.
 *
 * ~2 years, keeping roughly the original difficulty mix. scripts/check-runway.mjs
 * fails the build once the remaining run drops below its threshold, so this
 * number is a decision that gets revisited on a schedule rather than forgotten.
 */
const TARGETS = { facil: 210, media: 290, dificil: 240 };
const seenGlobal = new Set();

console.log('Generating…');
const facil = buildPool(0, TARGETS.facil, {}, seenGlobal);
const media = buildPool(1, TARGETS.media, mediaUsage, seenGlobal);
const dificil = buildPool(2, TARGETS.dificil, {}, seenGlobal);

const plan = [
  ...facil.map((refs) => ({ d: 'facil', refs })),
  ...media.map((refs) => ({ d: 'media', refs })),
  ...dificil.map((refs) => ({ d: 'dificil', refs })),
];

const generated = plan.map(({ d, refs }, i) => {
  const number = 7 + i;
  const groups = refs.map((ref, idx) => ({
    theme: LIB[ref].theme,
    tier: idx + 1, // cats first (1..), traps last (…4)
    cardIds: LIB[ref].cards,
    explanation: LIB[ref].why,
  }));
  return {
    id: `coplas-${String(number).padStart(4, '0')}`,
    number,
    date: addDays(lastDate, i + 1),
    difficulty: d,
    groups,
  };
});

const out = [...base, ...generated];
writeFileSync(PUZZLES_PATH, JSON.stringify(out, null, 2) + '\n');

// NOTE: this script no longer writes src/data/groups.json. It used to, from an
// inline literal — which meant the library was whatever this file said, and any
// edit made elsewhere was reverted the next time puzzles were generated. The
// library is now an INPUT here, read from disk above, and this script only ever
// writes puzzles.json.

const counts = out.reduce((a, p) => ((a[p.difficulty] = (a[p.difficulty] || 0) + 1), a), {});
console.log(`Wrote ${out.length} puzzles (${base.length} base + ${generated.length} generated).`);
console.log('By difficulty:', counts);
console.log('Distinct groups in library:', ALL.length, `(cats ${CATS.length}, traps ${TRAPS.length})`);
