/**
 * Finds groups whose explanation does not match the cards in the group.
 *
 * The reveal line ("why") is the payoff of a round — it is the moment the
 * player finds out what they missed. If it names a card that was never on the
 * board, or lists three of the four, the payoff is nonsense and the player is
 * left thinking they misread the puzzle.
 *
 * This is mechanically checkable and nothing was checking it. Found by a
 * player noticing that "Del frío y desierto" explained itself with a card
 * (Camello) that wasn't in the group.
 *
 * Method: build the set of card nouns in the deck. For each group, scan its
 * why for any deck noun. Flag two things —
 *
 *   GHOST   the why names a deck card that is NOT in this group
 *   MISSING the why fails to name a card that IS in the group
 *
 * GHOST is the serious one: it is always wrong. MISSING is a warning, since
 * plenty of good explanations describe a category rather than listing it
 * ("todo lo que brilla allá arriba"), so it only fires when the why looks like
 * a list — i.e. it already names at least two of the group's own cards.
 *
 *   node scripts/check-group-copy.mjs
 */
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));

// ── deck: id -> noun (name minus article), normalised ─────────────────────────
const cardsSrc = readFileSync(new URL('src/data/cards.ts', root), 'utf8');
const names = Object.fromEntries(
  [...cardsSrc.matchAll(/id:\s*'([a-z0-9_]+)',\s*name:\s*'([^']+)'/g)].map((m) => [m[1], m[2]])
);
for (const c of read('src/data/expansion.cards.json')) {
  if (!(c.id in names)) names[c.id] = c.name;
}

const norm = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** "La Foca" -> "foca"; multi-word names keep their spaces. */
function noun(id) {
  const n = names[id] ?? '';
  const parts = n.split(' ');
  return norm(/^(El|La|Las|Los)$/i.test(parts[0]) ? parts.slice(1).join(' ') : n);
}

/** noun -> [ids]. Several ids can share a noun; that's fine, we match on text. */
const byNoun = new Map();
for (const id of Object.keys(names)) {
  const n = noun(id);
  if (!n) continue;
  if (!byNoun.has(n)) byNoun.set(n, []);
  byNoun.get(n).push(id);
}
// Longest first so "pelota de beisbol" wins over "pelota".
const allNouns = [...byNoun.keys()].sort((a, b) => b.length - a.length);

/**
 * Which deck nouns does this why mention? Word-boundary matched on the
 * normalised text so "arana" matches "Araña" and "ron" does not match "Camarón".
 */
function nounsIn(text) {
  let hay = ` ${norm(text).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ')} `;
  const found = new Set();
  // Longest first, and each match is CONSUMED from the haystack. Without this,
  // "pez espada" also matches the separate card "espada", "estrella de mar"
  // also matches "estrella", and every multi-word card reports a phantom ghost.
  for (const n of allNouns) {
    const at = hay.indexOf(` ${n} `);
    if (at === -1) continue;
    found.add(n);
    hay = `${hay.slice(0, at)} ${hay.slice(at + n.length + 2)}`;
  }
  return found;
}

// ── scan ─────────────────────────────────────────────────────────────────────
const sources = [
  ['groups.json', read('src/data/groups.json')],
  ['expansion.groups.json', read('src/data/expansion.groups.json')],
];

const ghosts = [];
const missing = [];

for (const [file, lib] of sources) {
  for (const [key, g] of Object.entries(lib)) {
    // Letter and rhyme groups deliberately split words ("bande-ra"), so the
    // noun matcher can't read them and they're skipped. Hidden-word groups
    // quote the hidden word (Soldado esconde «sol») — "sol" is a card, but it
    // is not being named as a member of the group.
    if (g.kind === 'letter' || g.kind === 'rhyme') continue;
    if (/[«»"]/.test(g.why ?? '')) continue;

    const own = new Set(g.cards.map(noun));

    // Only the LIST half counts. Whys are formulaic: "A, B, C y D: gloss".
    // The gloss after the colon is prose about the category ("cosas de la
    // casa", "al plato", "viven en el agua") and routinely contains words that
    // happen to also be card names — those are not references to cards and
    // flagging them buries the real bug in noise.
    const list = (g.why ?? '').split(':')[0];
    const mentioned = nounsIn(list);
    const named = [...own].filter((n) => mentioned.has(n));

    // A why that names none or one of its own cards isn't a list, it's prose.
    // Only list-style whys make a claim about *which* cards these are.
    if (named.length < 2) continue;

    const ghost = [...mentioned].filter((n) => !own.has(n));
    if (ghost.length) {
      ghosts.push({ file, key, theme: g.theme, why: g.why, cards: g.cards, ghost });
    }

    if (named.length < own.size) {
      missing.push({
        file,
        key,
        theme: g.theme,
        why: g.why,
        absent: [...own].filter((n) => !mentioned.has(n)),
      });
    }
  }
}

console.log(`GHOST — why names a card that is not in the group: ${ghosts.length}`);
for (const g of ghosts) {
  console.log(`  ${g.file} / ${g.key}  «${g.theme}»`);
  console.log(`    cards: ${g.cards.join(', ')}`);
  console.log(`    why:   ${g.why}`);
  console.log(`    ghost: ${g.ghost.join(', ')}`);
}

console.log(`\nMISSING — list-style why that omits one of its own cards: ${missing.length}`);
for (const m of missing.slice(0, 25)) {
  console.log(`  ${m.file} / ${m.key}  «${m.theme}»`);
  console.log(`    why:    ${m.why}`);
  console.log(`    absent: ${m.absent.join(', ')}`);
}
if (missing.length > 25) console.log(`  … and ${missing.length - 25} more`);

process.exit(ghosts.length ? 1 : 0);
