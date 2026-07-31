/**
 * One card name must mean exactly one thing.
 *
 * WHY THIS EXISTS. gen-expansion.mjs declares cards as 'Nombre|english gloss'
 * and keys them by the Spanish name. When two categories reach for the same
 * word in different senses, they collapse into ONE card — and that card gets
 * ONE picture, generated from whichever gloss the generator happened to keep.
 * The other category is then dealt a card whose art contradicts it.
 *
 * It happened five times and shipped twice:
 *
 *   La Carpa   'a tent'  vs 'a carp'        → art is a tent, dealt in «Peces de río»
 *   El Kiwi    'a kiwi fruit' vs 'a kiwi bird' → art is a fruit, dealt in «De caza y monte»
 *
 * Nothing could catch this. The group is well formed, the card exists, the
 * explanation names it correctly, the art is real and beautiful and 480x643.
 * Only a human looking at a tent in a list of river fish would ever notice.
 *
 * The rule: if a name needs two meanings, it needs two cards with two names.
 *
 *   node scripts/check-card-senses.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'scripts', 'gen-expansion.mjs'), 'utf8');

/** Every 'Nombre|gloss' literal the generator declares. */
const byName = new Map();
for (const [, name, gloss] of src.matchAll(/'([^'|]+)\|([^']+)'/g)) {
  const k = name.trim();
  if (!byName.has(k)) byName.set(k, new Set());
  byName.get(k).add(gloss.trim());
}

/**
 * Pairs already reviewed and accepted: both glosses describe the same picture,
 * so one card serves both categories honestly. Add to this list only after
 * looking at the art and confirming it reads correctly in EVERY group that
 * deals the card — not merely because the words seem close.
 */
const ACCEPTED = new Set([
  'El Corazón',   // symbol vs anatomical — art is anatomical; see «Signos»
  'La Estrella',  // 'a star' vs 'a star shape' — one picture serves both
  'La Tortuga',   // sea turtle vs tortoise — art is a sea turtle, fine in both
]);

const clashes = [...byName.entries()]
  .filter(([, g]) => g.size > 1)
  .map(([name, g]) => ({ name, glosses: [...g].sort() }));

const unreviewed = clashes.filter((c) => !ACCEPTED.has(c.name));

console.log(`card names declared     ${byName.size}`);
console.log(`names with two meanings ${clashes.length}  (${ACCEPTED.size} reviewed and accepted)`);
console.log(`UNREVIEWED COLLISIONS:  ${unreviewed.length}`);

if (unreviewed.length) {
  console.error('');
  for (const c of unreviewed) {
    console.error(`  ✗ ${c.name}`);
    for (const g of c.glosses) console.error(`        · ${g}`);
  }
  console.error(
    '\nOne name, one picture. Either give the second sense its own card with its\n' +
      'own name, or drop that sense from the generator. If both glosses genuinely\n' +
      'describe the SAME picture, add the name to ACCEPTED in this file — after\n' +
      'looking at the art in every group that deals it.'
  );
  process.exit(1);
}
console.log('\n✅ every card name means exactly one thing');
