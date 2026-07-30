/**
 * One-shot migration: retire `el_apache` from the deck.
 *
 * The traditional lotería deck's card #26 (El Negrito) was already replaced
 * with El Charro in cards.ts. El Apache is the same class of problem — a
 * racial caricature — and it should go the same way. This script rewrites
 * every reference in groups.json and puzzles.json.
 *
 * Substitution is per *group theme*, because the replacement has to keep the
 * group's logic true:
 *
 *   Más personajes   → El Albañil   (still a person)
 *   Del combate      → El Arco      (a bow, next to Las Jaras — arrows)
 *   Andan armados    → El Policía   (still an armed person)
 *   Empiezan con «A» → El Arcoíris  (still starts with A)
 *
 * The explanation text is patched by replacing the bare word "Apache" with
 * the replacement's bare name, so word order inside each sentence survives
 * whatever phrasing that particular puzzle used.
 *
 * Run once:  node scripts/legal-pass.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const DATA = new URL('../src/data/', import.meta.url);
const read = (f) => JSON.parse(readFileSync(new URL(f, DATA), 'utf8'));
const write = (f, v) =>
  writeFileSync(new URL(f, DATA), JSON.stringify(v, null, 2) + '\n', 'utf8');

const OLD = 'el_apache';

/** theme → [replacement id, bare Spanish name]. Order matters for fallback. */
const BY_THEME = {
  'Más personajes': ['el_albanil', 'Albañil'],
  'Del combate': ['el_arco', 'Arco'],
  'Andan armados': ['el_policia', 'Policía'],
  'Empiezan con «A»': ['el_arcoiris', 'Arcoíris'],
};

/** Used when the first choice is already in the group (would duplicate). */
const FALLBACK = {
  'Más personajes': ['el_sastre', 'Sastre'],
  'Del combate': ['la_lanza', 'Lanza'],
  'Andan armados': ['el_vaquero', 'Vaquero'],
  'Empiezan con «A»': ['el_ancla', 'Ancla'],
};

const report = { groups: 0, puzzleGroups: 0, fallbacks: 0, unknownThemes: [] };
const changedWhys = new Map(); // old Spanish text → new Spanish text

function substitute(group, whyKey) {
  const idx = group.cardIds
    ? group.cardIds.indexOf(OLD)
    : group.cards.indexOf(OLD);
  if (idx === -1) return false;

  const list = group.cardIds ?? group.cards;
  let pick = BY_THEME[group.theme];
  if (!pick) {
    report.unknownThemes.push(group.theme);
    return false;
  }
  if (list.includes(pick[0])) {
    pick = FALLBACK[group.theme];
    report.fallbacks += 1;
  }

  list[idx] = pick[0];

  const before = group[whyKey];
  if (typeof before === 'string') {
    // \b doesn't play well with accented letters, so bound on non-letters.
    const after = before.replace(
      /(^|[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ])Apache([^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]|$)/g,
      `$1${pick[1]}$2`
    );
    if (after !== before) changedWhys.set(before, after);
    group[whyKey] = after;
  }
  return true;
}

// ── groups.json — the authored library, keyed by slug ─────────────────────
const groups = read('groups.json');
for (const g of Object.values(groups)) {
  if (substitute(g, 'why')) report.groups += 1;
}
write('groups.json', groups);

// ── puzzles.json — flat array, groups embedded per puzzle ─────────────────
const puzzles = read('puzzles.json');
for (const p of puzzles) {
  for (const g of p.groups) {
    if (substitute(g, 'explanation')) report.puzzleGroups += 1;
  }
}
write('puzzles.json', puzzles);

// ── Verify nothing is left, and no group broke its 4-unique invariant ─────
const leftover = [
  JSON.stringify(groups).includes(OLD),
  JSON.stringify(puzzles).includes(OLD),
];
const broken = [];
for (const p of puzzles) {
  for (const g of p.groups) {
    if (new Set(g.cardIds).size !== 4) broken.push(`${p.id} / ${g.theme}`);
  }
}
for (const [k, g] of Object.entries(groups)) {
  if (new Set(g.cards).size !== 4) broken.push(`groups.json / ${k}`);
}

console.log('groups.json entries rewritten :', report.groups);
console.log('puzzle groups rewritten       :', report.puzzleGroups);
console.log('fallback picks used           :', report.fallbacks);
console.log('unknown themes (skipped)      :', [...new Set(report.unknownThemes)]);
console.log('el_apache still present       :', leftover);
console.log('groups without 4 unique cards :', broken.length ? broken : 'none');
console.log('\n--- explanation strings that changed (need en translations) ---');
for (const [before, after] of changedWhys) console.log(JSON.stringify(after));
