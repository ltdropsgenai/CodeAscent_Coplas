/**
 * One-shot fix: `el_pajaro` is displayed as "El Águila".
 *
 * The id says pajaro, the name says Águila, and the letter-trap puzzles were
 * authored off the id. So four boards put it in an «P» group where the player
 * reads "Águila" and it plainly does not start with P, and coplas-0076 leaves
 * it loose in Aves where it becomes a fifth A-card against a four-card «A»
 * group — an unsolvable round either way.
 *
 * We fix the puzzles, not the name: the card art has "El Águila" painted into
 * the banner, so renaming the card would desync every rendered tile.
 *
 *   «P» groups   el_pajaro → la_pera        (genuinely P, on no affected board)
 *   0076 Aves    el_pajaro → el_petirrojo   (still a bird, and not an A)
 *
 * These were pre-existing; they only became visible once validate-puzzles.mjs
 * learned about the expansion deck.
 *
 * Run once:  node scripts/fix-pajaro.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../src/data/puzzles.json', import.meta.url);
const puzzles = JSON.parse(readFileSync(FILE, 'utf8'));

const changed = [];
const whys = new Map();

function swap(group, from, to, fromName, toName, where) {
  const i = group.cardIds.indexOf(from);
  if (i === -1) return;
  if (group.cardIds.includes(to)) {
    changed.push(`SKIP ${where}: ${to} already on board`);
    return;
  }
  group.cardIds[i] = to;
  const before = group.explanation;
  const after = before.replace(
    new RegExp(
      `(^|[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ])${fromName}([^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]|$)`,
      'g'
    ),
    `$1${toName}$2`
  );
  if (after !== before) whys.set(before, after);
  group.explanation = after;
  changed.push(`${where}: ${from} → ${to}`);
}

for (const p of puzzles) {
  for (const g of p.groups) {
    if (!g.cardIds.includes('el_pajaro')) continue;
    if (g.theme.includes('«P»')) {
      swap(g, 'el_pajaro', 'la_pera', 'Águila', 'Pera', `${p.id} / ${g.theme}`);
    } else if (p.id === 'coplas-0076') {
      swap(g, 'el_pajaro', 'el_petirrojo', 'Águila', 'Petirrojo', `${p.id} / ${g.theme}`);
    }
  }
}

writeFileSync(FILE, JSON.stringify(puzzles, null, 2) + '\n', 'utf8');

console.log(changed.join('\n') || 'nothing to change');
console.log('\n--- explanation strings that changed (need en translations) ---');
for (const [, after] of whys) console.log(JSON.stringify(after));
