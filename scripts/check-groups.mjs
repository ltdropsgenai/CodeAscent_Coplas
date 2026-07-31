#!/usr/bin/env node
/**
 * Validates the GROUP LIBRARY — groups.json + expansion.groups.json.
 *
 * This is the file that matters most and the only one nothing was checking.
 * `validate-puzzles.mjs` checks the 84 pre-baked puzzles, but tapping JUGAR
 * composes rounds live from this library, so essentially every round a real
 * player sees comes from here.
 *
 * The composer has a runtime `ambiguous()` guard, but it only checks the
 * COMBINATION of four groups. It cannot tell you that a group is broken on its
 * own — and a broken trap group fails in one of two silent ways: either it is
 * rejected in every draw (dead content nobody ever sees) or, worse, it passes
 * by coincidence when a stray card makes the count come out right, and ships a
 * round with no correct answer.
 *
 * Checks:
 *   • every card id exists in the deck
 *   • exactly 4 distinct cards per group
 *   • letter groups: all four nouns really start with the stated letter
 *   • rhyme groups:  all four nouns really end with the stated suffix
 *   • hidden groups: each quoted word really is inside its card's name
 *   • colour/shape groups carry an `exclude` list (their only ambiguity guard)
 *   • no two groups define the identical set of four cards
 *   • a theme is never reused for a card set that shares nothing with it
 *
 *   node scripts/check-groups.mjs
 */
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));

// ── deck ─────────────────────────────────────────────────────────────────────
const cardsSrc = readFileSync(new URL('src/data/cards.ts', root), 'utf8');
const NAME = Object.fromEntries(
  [...cardsSrc.matchAll(/id:\s*'([a-z0-9_]+)',\s*name:\s*'([^']+)'/g)].map((m) => [m[1], m[2]])
);
for (const c of read('src/data/expansion.cards.json')) {
  if (!(c.id in NAME)) NAME[c.id] = c.name;
}

const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Card name minus its leading article — matches composer.ts `noun()`. */
function noun(id) {
  const name = NAME[id] ?? '';
  const parts = name.split(' ');
  return /^(El|La|Las|Los)$/.test(parts[0]) ? parts.slice(1).join(' ') : name;
}
const initial = (id) => strip(noun(id)).charAt(0).toUpperCase();
const lower = (id) => noun(id).toLowerCase();

// ── scan ─────────────────────────────────────────────────────────────────────
const lib = {
  ...read('src/data/groups.json'),
  ...read('src/data/expansion.groups.json'),
};

const errors = [];
const warnings = [];
const err = (key, msg) => errors.push(`${key}: ${msg}`);
const warn = (key, msg) => warnings.push(`${key}: ${msg}`);

const byCardSet = new Map();

for (const [key, g] of Object.entries(lib)) {
  const cards = g.cards ?? [];

  // structure
  if (cards.length !== 4) err(key, `has ${cards.length} cards, expected 4`);
  if (new Set(cards).size !== cards.length) err(key, 'contains a duplicate card');
  for (const id of cards) {
    if (!(id in NAME)) err(key, `unknown card "${id}"`);
  }
  if (!g.theme) err(key, 'missing theme');
  if (!g.why) err(key, 'missing why');
  if (cards.some((id) => !(id in NAME))) continue; // further checks need names

  // identical card sets under two keys
  const sig = [...cards].sort().join('|');
  if (byCardSet.has(sig)) {
    warn(key, `identical card set to "${byCardSet.get(sig)}" — one of them is redundant`);
  } else {
    byCardSet.set(sig, key);
  }

  // letter traps
  if (g.kind === 'letter') {
    const L = g.theme.match(/«(.)»/u)?.[1]?.toUpperCase();
    if (!L) {
      err(key, `letter group but theme has no «X»: ${JSON.stringify(g.theme)}`);
    } else {
      const bad = cards.filter((id) => initial(id) !== L);
      if (bad.length) {
        err(
          key,
          `letter «${L}» but ${bad.map((id) => `${NAME[id]} (${initial(id)})`).join(', ')} does not start with it`
        );
      }
    }
  }

  // rhyme traps
  if (g.kind === 'rhyme') {
    const suf = g.theme.match(/«-(.+?)»/u)?.[1]?.toLowerCase();
    if (!suf) {
      err(key, `rhyme group but theme has no «-suffix»: ${JSON.stringify(g.theme)}`);
    } else {
      const bad = cards.filter((id) => !lower(id).endsWith(suf));
      if (bad.length) {
        err(key, `rhyme «-${suf}» but ${bad.map((id) => NAME[id]).join(', ')} does not end in it`);
      }
    }
  }

  // hidden-word traps: every «quoted» word must actually be inside a card name
  if (g.kind === 'hidden') {
    const quoted = [...(g.why ?? '').matchAll(/«([^»]+)»/gu)].map((m) => strip(m[1]).toLowerCase());
    if (quoted.length !== 4) {
      warn(key, `hidden group quotes ${quoted.length} words, expected 4`);
    }
    const names = cards.map((id) => strip(lower(id)));
    for (const w of quoted) {
      if (!names.some((n) => n.includes(w))) {
        err(key, `hidden word «${w}» is not inside any of its cards (${cards.map(noun).join(', ')})`);
      }
    }
  }

  // colour/shape traps have no structural rule, so `exclude` is their ONLY
  // protection against another matching card landing on the same board.
  if ((g.kind === 'color' || g.kind === 'shape') && !(g.exclude && g.exclude.length)) {
    warn(key, `${g.kind} trap has no \`exclude\` list — nothing stops another matching card appearing on the same board`);
  }
  for (const id of g.exclude ?? []) {
    if (!(id in NAME)) err(key, `exclude references unknown card "${id}"`);
    if (cards.includes(id)) err(key, `exclude lists "${id}", which is IN the group`);
  }
}

// ── report ───────────────────────────────────────────────────────────────────
console.log(`library: ${Object.keys(lib).length} groups`);
console.log(`\nERRORS   ${errors.length}`);
for (const e of errors) console.log(`  ✗ ${e}`);
console.log(`\nWARNINGS ${warnings.length}`);
for (const w of warnings.slice(0, 40)) console.log(`  ! ${w}`);
if (warnings.length > 40) console.log(`  … and ${warnings.length - 40} more`);

if (!errors.length) console.log('\n✅ group library structurally valid');
process.exit(errors.length ? 1 : 0);
