#!/usr/bin/env node
/**
 * Verifies a claim about the DECK ART that nothing else checks: that every card
 * depicts a different thing, and that no card was drawn from a description
 * ambiguous enough to have produced the wrong thing.
 *
 *     npm run art
 *
 * WHY THIS EXISTS. `check-card-senses` proves each card NAME means one thing.
 * `check-assets` proves each file is really the format it claims. Neither looks
 * at what was actually asked for, and two cards can pass both while being
 * pictures of the same object.
 *
 * That is not hypothetical. `la_mora` and `la_zarzamora` were both generated
 * from "a blackberry" and are both a blackberry; `el_mosquito` and `el_zancudo`
 * were both "a mosquito". Their groups live in different families, but a round
 * draws four groups from anywhere, so both can land on the same board — and
 * `sim-rounds` calls that valid because it checks ids are unique, not that the
 * PICTURES are.
 *
 * The second check is the El Talón class. That card was generated from the
 * prompt `a heel` and came back a high-heeled shoe, because "heel" in English
 * is a body part and a part of a shoe. Every other body part in the deck says
 * "a human eye", "a human foot"; `el_corazon` even says "an anatomical heart".
 * The guard existed in the author's head and slipped on one word. AMBIGUOUS
 * below is the list of English nouns that carry that risk — it is a
 * denylist, so it can only ever catch what someone has thought of, and adding
 * to it when a card comes back wrong is the maintenance this file expects.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const prompts = JSON.parse(readFileSync(join(root, 'src/data/expansion.prompts.json'), 'utf8'));
const cardsRaw = JSON.parse(readFileSync(join(root, 'src/data/expansion.cards.json'), 'utf8'));
const list = Array.isArray(cardsRaw) ? cardsRaw : cardsRaw.cards ?? Object.values(cardsRaw);
const cards = Object.fromEntries(list.filter((c) => c && c.id).map((c) => [c.id, c]));

/**
 * English words whose two senses are different PICTURES. A prompt whose subject
 * is one of these bare, with nothing to pin the sense down, is how El Talón
 * became a shoe.
 */
const AMBIGUOUS = [
  'heel', 'bow', 'seal', 'crane', 'bat', 'nail', 'trunk', 'ring', 'pitcher',
  'club', 'spring', 'palm', 'pen', 'mole', 'racket', 'match', 'organ', 'plant',
  'bank', 'letter', 'stamp', 'file', 'jack', 'pipe', 'nut', 'tank', 'chest',
  'cabinet', 'die', 'iron', 'mint', 'scale', 'top', 'mask',
];

/**
 * Cards whose subject is a bare ambiguous word but whose ART has been LOOKED
 * AT and is right. Each entry is a claim someone verified with their eyes, so
 * each carries the finding rather than just the id.
 */
const ACCEPTED = new Map([
  ['el_arco', 'checked: an archery bow, not a ribbon bow and not an architectural arch'],
  ['el_antifaz', 'checked: a face mask, and visually nothing like la_mascara\'s jaguar headdress'],
  ['la_pluma', 'checked: a writing pen, not a feather and not an enclosure'],
  ['el_tubo', 'checked: a length of plumbing pipe, not a smoking pipe'],
  ['el_anillo', 'checked: a finger ring, not a boxing ring'],
  ['la_foca', 'checked: the animal, not a wax seal or a rubber stamp'],
  ['el_clavo', 'checked: a metal nail, not a fingernail'],
  ['la_jarra', 'checked: a clay jug, not a baseball pitcher'],
]);

/**
 * Subjects two cards share where the PICTURES were compared and are genuinely
 * different things. A shared description is a warning, not a verdict — but the
 * only way to clear it is to look, so each entry records what was seen.
 */
const ACCEPTED_PAIRS = new Map([
  ['scissors', 'las_tijeras is vintage steel, las_tijeras_escolares blue-handled school scissors'],
  ['thermos', 'el_termo is a battered metal flask, el_termo_escolar a modern vacuum bottle'],
  ['skeleton', 'el_esqueleto is anatomical, el_esqueleto_de_fiesta a catrín in a sombrero'],
  ['mushroom', 'el_champinon is a button mushroom, el_hongo a wild bolete'],
]);

const subjectOf = (id) =>
  String(prompts[id] ?? '').split(',')[0].trim().replace(/\s+/g, ' ');
const bare = (s) => s.toLowerCase().replace(/^(a|an|the)\s+/, '');

// ── 1. two cards, one picture ────────────────────────────────────────────────
const bySubject = new Map();
for (const id of Object.keys(cards)) {
  const s = bare(subjectOf(id));
  if (!s) continue;
  if (!bySubject.has(s)) bySubject.set(s, []);
  bySubject.get(s).push(id);
}
const collisions = [...bySubject.entries()]
  .filter(([s, ids]) => ids.length > 1 && !ACCEPTED_PAIRS.has(s));

// ── 2. a subject that could have been drawn two ways ─────────────────────────
const risky = [];
for (const id of Object.keys(cards)) {
  const subj = subjectOf(id);
  if (!subj) continue;
  const words = bare(subj).split(/[^a-z]+/).filter(Boolean);
  // ONLY a bare single word is at risk, and the first version of this check got
  // that wrong — it allowed two words and so flagged "a rubber stamp", "a
  // treasure chest", "a golf club", every one of which pins its own sense down.
  // Thirteen false positives and one real defect is not a gate, it is noise
  // someone will learn to skip past.
  if (words.length !== 1) continue;
  const hit = AMBIGUOUS.includes(words[0]) ? words[0] : null;
  if (hit && !ACCEPTED.has(id)) {
    risky.push({ id, name: cards[id].name, subj, hit });
  }
}

console.log(`cards with a prompt   ${Object.keys(cards).filter((i) => prompts[i]).length}`);
console.log(`SAME PICTURE — two cards drawn from one description:  ${collisions.length}`);
console.log(`AMBIGUOUS — a subject that could be drawn two ways:   ${risky.length}`);

for (const [s, ids] of collisions) {
  console.log(`\n  ✗ "${s}"`);
  for (const id of ids) console.log(`      ${cards[id].name}  [${cards[id].family}]  (${id})`);
}
for (const r of risky) {
  console.log(`\n  ✗ ${r.name} (${r.id}) — "${r.subj}": "${r.hit}" has two pictures`);
}

if (collisions.length || risky.length) {
  console.log(
    '\nRe-generate the card with a subject that pins the sense down ("a human heel,\n' +
      'the back of a foot"), or add it to ACCEPTED here with the reason it is fine.\n' +
      'Do not widen AMBIGUOUS to make this pass.'
  );
  process.exit(1);
}
console.log('\n✅ every card depicts something distinct, from an unambiguous description');
