#!/usr/bin/env node
/**
 * Validates the THEME — the one string a player reads before guessing.
 *
 * `check-group-copy.mjs` verifies the *why* against the group's cards. Nothing
 * verified the theme against anything at all, and the theme is what the player
 * actually plays against: the why is the reveal, shown after the guess is over.
 *
 * FOUND BY a player asking why «De hueso» — aguacate, chabacano, dátil, ciruela
 * — was labelled "made of bone". It is not a mistranslation. *Hueso* is the pit
 * of a fruit as well as a bone, and *frutas de hueso* is the standard term. But
 * the theme dropped the noun that disambiguates it, and "de + material" is the
 * dominant Spanish reading — de madera, de oro, de hueso. On the board where it
 * was reported, the group directly above it was «Estructura», with a skull in
 * it. The deck contains a card called El Hueso.
 *
 * That last sentence is the checkable part, and it generalises:
 *
 *   MATERIAL  a theme of the form "De <substance>". In Spanish that construction
 *          means *made of* — de madera, de oro, de hueso — so it will be read as
 *          composition no matter what the group contains.
 *
 *          The first version of this file checked something broader and wrong:
 *          "the theme names a deck card that is not in the group". It fired 38
 *          times, and «Del bosque», «Del doctor», «De viento» and «En la arena»
 *          were among them — all perfectly good themes whose place or context
 *          happens to also be a card. That is not the discriminator. What broke
 *          «De hueso» was not that El Hueso exists; it was the grammar. A gate
 *          with 34 false positives out of 38 does not get kept green, it gets
 *          switched off, so it is narrowed here to the pattern that actually
 *          fails. The list of substances is short and closed on purpose.
 *
 *   ECHO   the theme names a card that IS in the group. «Batería» over a group
 *          containing La Batería; «De sopa y guiso» over La Sopa and El
 *          Guisado. The label hands the player one of its own answers.
 *
 *   DRAFT  «Más cuerdas», «Más del baño» — authoring shorthand for "the second
 *          batch" that shipped. The player has no first batch on screen and
 *          reads it as a mistake. (Both real cases turned out to be covering
 *          for a distinction worth stating: «Más cuerdas» became «De cuerda
 *          pulsada», which is what actually separates it from «De cuerda».)
 *
 *   TWIN   two themes a player cannot tell apart once articles and plurals are
 *          removed: «De combate» vs «Del combate», «Estructura» vs
 *          «Estructuras». Card-disjointness does not prevent them, and
 *          composer.ts's `sameTheme()` only catches EXACT collisions.
 *
 * What this cannot check is whether a theme is *true* of its members — that is
 * the category audit, and it needs a human. This checks that the theme does not
 * lie about which cards it is talking about.
 *
 *   node scripts/check-group-themes.mjs
 */
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));

const cardsSrc = readFileSync(new URL('src/data/cards.ts', root), 'utf8');
const NAME = Object.fromEntries(
  [...cardsSrc.matchAll(/id:\s*'([a-z0-9_]+)',\s*name:\s*'([^']+)'/g)].map((m) => [m[1], m[2]])
);
for (const c of read('src/data/expansion.cards.json')) if (!(c.id in NAME)) NAME[c.id] = c.name;

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function noun(id) {
  const parts = (NAME[id] ?? '').split(' ');
  return norm(/^(El|La|Las|Los)$/i.test(parts[0]) ? parts.slice(1).join(' ') : (NAME[id] ?? ''));
}

const byNoun = new Map();
for (const id of Object.keys(NAME)) {
  const n = noun(id);
  if (n) byNoun.set(n, [...(byNoun.get(n) ?? []), id]);
}
// Longest first so "pelota de beisbol" wins over "pelota". Two letters or fewer
// would match inside anything; three is the shortest real card noun (Sol, Pan).
const allNouns = [...byNoun.keys()].filter((n) => n.length >= 3).sort((a, b) => b.length - a.length);

/**
 * Which deck nouns does this theme mention? Word-boundary matched on normalised
 * text, longest first, each match consumed — so «Estrella de mar» does not also
 * report the separate card «Estrella», and «Camarón» does not report «ron».
 * Singular and plural both count: «Nueces» names La Nuez, «Piedras» La Piedra.
 */
function nounsIn(text) {
  let hay = ` ${norm(text).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ')} `;
  const found = new Set();
  for (const n of allNouns) {
    for (const form of [n, `${n}s`, `${n}es`]) {
      const at = hay.indexOf(` ${form} `);
      if (at === -1) continue;
      found.add(n);
      hay = `${hay.slice(0, at)} ${hay.slice(at + form.length + 2)}`;
      break;
    }
  }
  return found;
}

/**
 * Substances. "De <one of these>" is read as *made of*, whatever the cards say.
 *
 * Closed list, and it should stay short: the point is not to guess at every
 * ambiguous noun in Spanish, it is to catch the one construction that reliably
 * misfires. A theme naming a material is not automatically wrong — «Frutas con
 * hueso» and «Cosas de madera» both read correctly — so the rule is about the
 * bare "De X" form, not about the word appearing at all.
 */
const MATERIALS = [
  'hueso', 'madera', 'oro', 'plata', 'piedra', 'vidrio', 'barro', 'hierro',
  'lana', 'cuero', 'papel', 'plastico', 'metal', 'tela', 'cera', 'seda', 'hilo',
];

const lib = { ...read('src/data/groups.json'), ...read('src/data/expansion.groups.json') };

const errors = [];

for (const [key, g] of Object.entries(lib)) {
  // Trap themes are rules about spelling, not claims about categories: «Riman
  // en «-illa»» and «Empiezan con «B»» name no cards and are exempt by design.
  if (g.kind !== 'cat') continue;

  const own = new Set((g.cards ?? []).map(noun));
  for (const n of nounsIn(g.theme)) {
    if (own.has(n)) {
      errors.push(
        `ECHO     ${key}: theme «${g.theme}» names its own card "${n}" — the label gives an answer away`
      );
    }
  }

  const material = norm(g.theme).match(/^de(?:l)? ([a-z]+)$/)?.[1];
  if (material && MATERIALS.includes(material)) {
    errors.push(
      `MATERIAL ${key}: theme «${g.theme}» reads as "made of ${material}".` +
        `\n         Name the noun it belongs to — «Frutas con hueso», not «De hueso».`
    );
  }

  if (/^(m[áa]s|otros?|otras?|nuevos?|nuevas?)\b/i.test(g.theme)) {
    errors.push(
      `DRAFT    ${key}: theme «${g.theme}» is authoring shorthand — the player has no earlier batch on screen`
    );
  }
}

// TWIN — themes indistinguishable once articles, plurals and accents are gone.
const themes = [...new Set(Object.values(lib).filter((g) => g.kind === 'cat').map((g) => g.theme))];
const flatten = (t) =>
  norm(t).replace(/\b(de|del|la|el|los|las|en|y|con|para)\b/g, '').replace(/e?s\b/g, '').replace(/[^a-z]/g, '');
const byFlat = new Map();
for (const t of themes) byFlat.set(flatten(t), [...(byFlat.get(flatten(t)) ?? []), t]);
for (const [, group] of byFlat) {
  if (group.length > 1) {
    errors.push(`TWIN     ${group.map((t) => `«${t}»`).join(' vs ')} — a player cannot tell these apart`);
  }
}

console.log(`themes checked: ${themes.length} distinct across ${Object.keys(lib).length} groups`);
console.log(`\nERRORS   ${errors.length}`);
for (const e of errors) console.log(`  ✗ ${e}`);

if (!errors.length)
  console.log('\n✅ no theme gives away its own card, reads as a material, or twins another');
process.exit(errors.length ? 1 : 0);
