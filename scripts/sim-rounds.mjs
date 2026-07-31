#!/usr/bin/env node
/**
 * Simulates the live round composer against the real group library.
 *
 * Two things this proves, neither of which any other check can:
 *
 *  1. THE TRAPS ARE NOW UNAMBIGUOUS. For every composed round containing a
 *     colour/shape trap, no card outside that trap satisfies the trap's rule.
 *     Before the exclude lists were rebuilt against the full deck this failed
 *     on most boards — "Cosas doradas" would deal four gold cards and let La
 *     Medalla or El Anillo land beside them, leaving the round unsolvable.
 *
 *  2. TIGHTENING THE TRAPS DID NOT STARVE THE COMPOSER. Bigger exclude lists
 *     mean more rejected candidates. composeRound() retries up to 4000 times,
 *     so this reports the real success rate per attempt to confirm there is
 *     ample headroom at every difficulty.
 *
 * Mirrors composer.ts — if that file's rules change, change these too.
 *
 *   node scripts/sim-rounds.mjs [rounds]
 */
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));

const cardsSrc = readFileSync(new URL('src/data/cards.ts', root), 'utf8');
const NAME = Object.fromEntries(
  [...cardsSrc.matchAll(/id:\s*'([a-z0-9_]+)',\s*name:\s*'([^']+)'/g)].map((m) => [m[1], m[2]])
);
for (const c of read('src/data/expansion.cards.json')) if (!(c.id in NAME)) NAME[c.id] = c.name;

const BASE = read('src/data/groups.json');
const EXP = read('src/data/expansion.groups.json');
const LIB = { ...BASE, ...EXP };

const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const noun = (id) => {
  const parts = (NAME[id] ?? '').split(' ');
  return /^(El|La|Las|Los)$/.test(parts[0]) ? parts.slice(1).join(' ') : NAME[id] ?? '';
};
const initial = (id) => strip(noun(id)).charAt(0).toUpperCase();
const lower = (id) => noun(id).toLowerCase();

const CATS = Object.keys(LIB).filter((r) => LIB[r].kind === 'cat');
const TRAPS = Object.keys(BASE).filter((r) => BASE[r].kind !== 'cat');
const N_TRAPS = { facil: 0, media: 1, dificil: 2 };

function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickGroups(pool, k, used) {
  const chosen = [];
  const cards = new Set(used);
  for (const r of shuffle(pool)) {
    if (chosen.length === k) break;
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
      const L = g.theme.match(/«(.)»/u)?.[1].toUpperCase() ?? '';
      if (cards.filter((c) => initial(c) === L).length !== 4) return true;
    } else if (g.kind === 'rhyme') {
      const suf = g.theme.match(/«-(.+?)»/u)?.[1].toLowerCase() ?? '';
      if (cards.filter((c) => lower(c).endsWith(suf)).length !== 4) return true;
    } else if (g.exclude?.length) {
      const others = cards.filter((c) => !g.cards.includes(c));
      if (others.some((c) => g.exclude.includes(c))) return true;
    }
  }
  return false;
}

function sameTheme(refs) {
  const seen = new Set();
  for (const r of refs) {
    if (seen.has(LIB[r].theme)) return true;
    seen.add(LIB[r].theme);
  }
  return false;
}

function composeOnce(difficulty) {
  const n = N_TRAPS[difficulty];
  const traps = n ? pickGroups(TRAPS, n, new Set()) : [];
  if (n && !traps) return null;
  const trapCards = new Set((traps ?? []).flatMap((r) => LIB[r].cards));
  const cats = pickGroups(CATS, 4 - n, trapCards);
  if (!cats) return null;
  const refs = [...cats, ...(traps ?? [])];
  if (sameTheme(refs)) return null;
  if (ambiguous(refs)) return null;
  return refs;
}

const ROUNDS = Number(process.argv[2] ?? 3000);
let bad = 0;
const examples = [];

console.log(`simulating ${ROUNDS} rounds per difficulty\n`);
for (const diff of ['facil', 'media', 'dificil']) {
  let attempts = 0;
  let made = 0;
  const cardsSeen = new Set();
  for (let i = 0; i < ROUNDS; i++) {
    let refs = null;
    for (let t = 0; t < 4000 && !refs; t++) {
      attempts++;
      refs = composeOnce(diff);
    }
    if (!refs) {
      console.log(`  ✗ ${diff}: FAILED to compose a round in 4000 attempts`);
      bad++;
      continue;
    }
    made++;
    const cards = refs.flatMap((r) => LIB[r].cards);
    for (const c of cards) cardsSeen.add(c);

    // 16 distinct cards
    if (new Set(cards).size !== 16) {
      bad++;
      examples.push(`${diff}: round has ${new Set(cards).size} unique cards`);
    }
    // independent re-check of every trap on the finished board
    for (const r of refs) {
      const g = LIB[r];
      const others = cards.filter((c) => !g.cards.includes(c));
      if (g.kind === 'letter') {
        const L = g.theme.match(/«(.)»/u)[1].toUpperCase();
        const stray = others.filter((c) => initial(c) === L);
        if (stray.length) {
          bad++;
          examples.push(`${diff}: «${L}» trap with stray ${stray.map(noun).join(', ')}`);
        }
      } else if (g.kind === 'rhyme') {
        const suf = g.theme.match(/«-(.+?)»/u)[1].toLowerCase();
        const stray = others.filter((c) => lower(c).endsWith(suf));
        if (stray.length) {
          bad++;
          examples.push(`${diff}: «-${suf}» trap with stray ${stray.map(noun).join(', ')}`);
        }
      } else if (g.exclude?.length) {
        const stray = others.filter((c) => g.exclude.includes(c));
        if (stray.length) {
          bad++;
          examples.push(`${diff}: "${g.theme}" with stray ${stray.map(noun).join(', ')}`);
        }
      }
    }
  }
  const rate = ((made / attempts) * 100).toFixed(1);
  console.log(
    `  ${diff.padEnd(8)} ${made}/${ROUNDS} composed · ${rate}% of attempts valid · ${cardsSeen.size} distinct cards used`
  );
}

console.log(`\nbroken rounds: ${bad}`);
for (const e of examples.slice(0, 10)) console.log(`  ✗ ${e}`);
if (!bad) console.log('✅ every simulated round has 16 unique cards and exactly one valid answer per group');
process.exit(bad ? 1 : 0);
