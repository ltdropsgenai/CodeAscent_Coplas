/**
 * Rebuild every list-style explanation so it names the cards actually in its
 * group.
 *
 * THE BUG. `gen-expansion.mjs` produced ~2 variants of each category by
 * swapping one card, but reused a single `why` string across every variant.
 * 392 of 432 groups are variants and 196 why-strings are shared, so most
 * reveals named a card the player never saw and omitted one they did:
 *
 *   frutas_tropicales_1  cards: coco, mango, maracuya, papaya
 *                        why:   "Mango, piña, papaya y coco: del trópico."
 *                                       ^^^^ not in the group   ^^^^ is
 *
 * The reveal is the payoff of the round. Getting it wrong doesn't just look
 * sloppy, it makes the player think they misread the board.
 *
 * THE FIX. The cards are the ground truth — they are what was dealt and what
 * the grouping logic used. So the *list* half of the why is regenerated from
 * the group's own cards and the *gloss* half (everything after the colon) is
 * kept verbatim, since it describes the category and is still true.
 *
 *   "Mango, piña, papaya y coco: del trópico."
 *   →  "Coco, mango, maracuyá y papaya: del trópico."
 *
 * English follows the same surgery on the existing translation, so the
 * already-reviewed gloss translations survive untouched.
 *
 * SKIPPED, deliberately:
 *   • letter and rhyme groups — their whys split words ("bande-ra") on purpose
 *   • hidden-word groups — the quoted «sol» is the hidden word, not a card
 *   • prose whys that never listed their cards ("todo lo que brilla allá
 *     arriba") — nothing to correct, and rewriting them would flatten the
 *     writing into a list
 *
 * Run once:  node scripts/fix-group-copy.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const readJson = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const writeJson = (p, v) =>
  writeFileSync(new URL(p, root), JSON.stringify(v, null, 2) + '\n', 'utf8');

// ── deck ─────────────────────────────────────────────────────────────────────
const cardsSrc = readFileSync(new URL('src/data/cards.ts', root), 'utf8');
const names = Object.fromEntries(
  [...cardsSrc.matchAll(/id:\s*'([a-z0-9_]+)',\s*name:\s*'([^']+)'/g)].map((m) => [m[1], m[2]])
);
for (const c of readJson('src/data/expansion.cards.json')) {
  if (!(c.id in names)) names[c.id] = c.name;
}

const norm = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** "La Foca" -> "Foca" (display form, accents intact). */
function nounOf(id) {
  const n = names[id] ?? id;
  const parts = n.split(' ');
  return /^(El|La|Las|Los)$/i.test(parts[0]) ? parts.slice(1).join(' ') : n;
}

const byNoun = new Set(Object.keys(names).map((id) => norm(nounOf(id))));
const allNouns = [...byNoun].sort((a, b) => b.length - a.length);

function nounsIn(text) {
  const hay = ` ${norm(text).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ')} `;
  return new Set(allNouns.filter((n) => hay.includes(` ${n} `)));
}

/**
 * Sentence case for a card noun.
 *
 * Card names are stored title-cased ("Pez Espada", "Caballito de Mar") because
 * that is how they are painted on the tile. Inside a sentence they need to be
 * ordinary Spanish: only the first word of the first item takes a capital.
 * Lowercasing just the leading character leaves "pez Espada", which is exactly
 * the kind of thing that reads as a typo.
 */
function sentenceCase(noun, first) {
  const lower = noun.toLocaleLowerCase('es');
  return first ? lower.charAt(0).toLocaleUpperCase('es') + lower.slice(1) : lower;
}

function joinList(ids, conjunction) {
  const words = ids.map((id, i) => sentenceCase(nounOf(id), i === 0));
  return `${words.slice(0, -1).join(', ')} ${conjunction} ${words[words.length - 1]}`;
}

/** "Coco, mango, maracuyá y papaya" */
const spanishList = (ids) => joinList(ids, 'y');
const englishList = (ids) => joinList(ids, 'and');

/** Split "A, B y C: gloss." -> { list, gloss } . gloss includes the colon. */
function split(why) {
  const i = why.indexOf(':');
  return i === -1
    ? { list: why.replace(/\.\s*$/, ''), gloss: why.match(/\.\s*$/) ? '.' : '' }
    : { list: why.slice(0, i), gloss: why.slice(i) };
}

/** Is this why a list of its own cards that we can safely rebuild? */
function isRebuildableList(g) {
  if (g.kind === 'letter' || g.kind === 'rhyme') return false;
  const why = g.why ?? '';
  if (/[«»"]/.test(why)) return false; // hidden-word groups quote the hidden word
  const { list } = split(why);
  const own = new Set(g.cards.map((id) => norm(nounOf(id))));
  const named = [...own].filter((n) => nounsIn(list).has(n));
  // Needs to already read as a list of at least two of its own cards, and the
  // list half must not be long prose.
  return named.length >= 2 && list.split(/\s+/).length <= own.size * 4;
}

// ── rewrite the two group libraries ──────────────────────────────────────────
const dict = readJson('src/data/groupText.en.json');
/** old Spanish why -> new Spanish why, per unique (oldWhy, cardset). */
const enPlan = new Map(); // newEs -> { oldEs, ids }

let rewritten = 0;
let skipped = 0;

for (const file of ['src/data/groups.json', 'src/data/expansion.groups.json']) {
  const lib = readJson(file);
  for (const g of Object.values(lib)) {
    if (!isRebuildableList(g)) {
      skipped += 1;
      continue;
    }
    const oldEs = g.why;
    const { gloss } = split(oldEs);
    const newEs = `${spanishList(g.cards)}${gloss || '.'}`;
    if (newEs !== oldEs) rewritten += 1;
    g.why = newEs;
    if (!enPlan.has(newEs)) enPlan.set(newEs, { oldEs, ids: g.cards });
  }
  writeJson(file, lib);
}

// ── rewrite the embedded explanations in puzzles.json ────────────────────────
const puzzles = readJson('src/data/puzzles.json');
let puzzleFixed = 0;
for (const p of puzzles) {
  for (const grp of p.groups) {
    const shim = { kind: 'cat', cards: grp.cardIds, why: grp.explanation };
    if (!isRebuildableList(shim)) continue;
    const oldEs = grp.explanation;
    const { gloss } = split(oldEs);
    const newEs = `${spanishList(grp.cardIds)}${gloss || '.'}`;
    if (newEs !== oldEs) puzzleFixed += 1;
    grp.explanation = newEs;
    if (!enPlan.has(newEs)) enPlan.set(newEs, { oldEs, ids: grp.cardIds });
  }
}
writeJson('src/data/puzzles.json', puzzles);

// ── carry the English across ─────────────────────────────────────────────────
// Same surgery: keep the existing translated gloss, rebuild the list half.
let enAdded = 0;
let enUntranslatable = 0;
for (const [newEs, { oldEs, ids }] of enPlan) {
  if (dict.whys[newEs]) continue;
  const oldEn = dict.whys[oldEs];
  if (!oldEn) {
    enUntranslatable += 1;
    continue;
  }
  const { gloss } = split(oldEn);
  dict.whys[newEs] = `${englishList(ids)}${gloss || '.'}`;
  enAdded += 1;
}
// Drop dictionary entries no longer referenced by anything that ships. Each
// rewrite orphans the string it replaced, and 400 dead keys in the file make
// the coverage report unreadable.
const live = new Set();
for (const file of ['src/data/groups.json', 'src/data/expansion.groups.json']) {
  for (const g of Object.values(readJson(file))) live.add(g.why);
}
for (const p of readJson('src/data/puzzles.json')) {
  for (const grp of p.groups) live.add(grp.explanation);
}
let pruned = 0;
for (const k of Object.keys(dict.whys)) {
  if (!live.has(k)) {
    delete dict.whys[k];
    pruned += 1;
  }
}

writeJson('src/data/groupText.en.json', dict);

console.log(`stale en entries pruned : ${pruned}`);
console.log(`group whys rebuilt      : ${rewritten}`);
console.log(`puzzle explanations     : ${puzzleFixed}`);
console.log(`skipped (prose / traps) : ${skipped}`);
console.log(`english entries added   : ${enAdded}`);
console.log(`english source missing  : ${enUntranslatable}`);
