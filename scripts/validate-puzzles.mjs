#!/usr/bin/env node
/**
 * Validates src/data/puzzles.json without external deps.
 *
 * Rules enforced:
 *  - id matches coplas-####, unique
 *  - number unique, date matches YYYY-MM-DD, dates unique
 *  - exactly 4 groups; each group has exactly 4 cardIds
 *  - every cardId exists in the full deck (base + expansion)
 *  - no card appears in more than one group within a puzzle (= 16 unique)
 *  - the four tiers are exactly {1,2,3,4}
 *  - difficulty (if present) is facil|media|dificil
 *  - letter/rhyme trap groups are unambiguous (no stray matching card)
 *
 * Exits non-zero on any error. Run: npm run validate
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Parse the base card ids + display names straight out of the TS source...
const cardsSrc = readFileSync(join(root, 'src/data/cards.ts'), 'utf8');
/** id -> display name, e.g. el_gallo -> "El Gallo". */
const cardName = Object.fromEntries(
  [...cardsSrc.matchAll(/id:\s*'([a-z0-9_]+)',\s*name:\s*'([^']+)'/g)].map((m) => [m[1], m[2]])
);

// ...then merge the expansion, which is where 943 of the ~997 cards live.
//
// This script used to read cards.ts alone, so every puzzle that referenced an
// expansion card reported a phantom "unknown card" and — worse, because it
// failed quietly — the letter and rhyme trap checks below silently skipped
// those cards, which is exactly the check you want working. Base wins on an
// id collision, matching the dedupe in data/cards.ts.
const expansion = JSON.parse(
  readFileSync(join(root, 'src/data/expansion.cards.json'), 'utf8')
);
for (const c of expansion) {
  if (!(c.id in cardName)) cardName[c.id] = c.name;
}

const cardIds = new Set(Object.keys(cardName));
const stripDiacritics = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
/** The noun (name minus its El/La/Las/Los article). */
function noun(id) {
  const n = cardName[id] ?? '';
  const parts = n.split(' ');
  const body = /^(El|La|Las|Los)$/.test(parts[0]) ? parts.slice(1).join(' ') : n;
  return body;
}
const nounInitial = (id) => stripDiacritics(noun(id)).charAt(0).toUpperCase();
const nounLower = (id) => noun(id).toLowerCase();

const puzzles = JSON.parse(
  readFileSync(join(root, 'src/data/puzzles.json'), 'utf8')
);

const errors = [];
const seenIds = new Set();
const seenNumbers = new Set();
const seenDates = new Set();

if (!Array.isArray(puzzles)) {
  errors.push('puzzles.json must be an array');
}

for (const [i, p] of (puzzles ?? []).entries()) {
  const at = `puzzle[${i}] (${p?.id ?? '??'})`;

  if (!/^coplas-\d{4}$/.test(p.id ?? '')) errors.push(`${at}: bad id`);
  if (seenIds.has(p.id)) errors.push(`${at}: duplicate id`);
  seenIds.add(p.id);

  if (!Number.isInteger(p.number)) errors.push(`${at}: number must be int`);
  if (seenNumbers.has(p.number)) errors.push(`${at}: duplicate number`);
  seenNumbers.add(p.number);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date ?? '')) errors.push(`${at}: bad date`);
  if (seenDates.has(p.date)) errors.push(`${at}: duplicate date ${p.date}`);
  seenDates.add(p.date);

  if (!Array.isArray(p.groups) || p.groups.length !== 4) {
    errors.push(`${at}: must have exactly 4 groups`);
    continue;
  }

  const tiers = [];
  const cardsInPuzzle = new Set();

  for (const [g, group] of p.groups.entries()) {
    const gat = `${at} group[${g}] "${group.theme ?? ''}"`;
    tiers.push(group.tier);

    if (!Array.isArray(group.cardIds) || group.cardIds.length !== 4) {
      errors.push(`${gat}: must have exactly 4 cardIds`);
      continue;
    }
    for (const id of group.cardIds) {
      if (!cardIds.has(id)) errors.push(`${gat}: unknown card "${id}"`);
      if (cardsInPuzzle.has(id))
        errors.push(`${gat}: card "${id}" used twice in this puzzle`);
      cardsInPuzzle.add(id);
    }
    if (!group.theme) errors.push(`${gat}: missing theme`);
    if (!group.explanation) errors.push(`${gat}: missing explanation`);
  }

  const tierSet = [...tiers].sort().join(',');
  if (tierSet !== '1,2,3,4') errors.push(`${at}: tiers must be exactly 1,2,3,4 (got ${tierSet})`);
  if (cardsInPuzzle.size !== 16) errors.push(`${at}: must contain 16 unique cards (got ${cardsInPuzzle.size})`);

  // Difficulty must be a known value if present.
  if (p.difficulty && !['facil', 'media', 'dificil'].includes(p.difficulty)) {
    errors.push(`${at}: bad difficulty "${p.difficulty}"`);
  }

  // Anti-ambiguity: a letter/rhyme trap group must be the ONLY set of cards in
  // the whole puzzle that satisfies its rule (otherwise there are two valid
  // answers). Colours / shapes / hidden-words are curated by hand.
  const allCards = [...cardsInPuzzle];
  for (const group of p.groups) {
    const letter = group.theme?.match(/Empiezan con «(.)»/u)?.[1];
    if (letter) {
      const matches = allCards.filter((id) => nounInitial(id) === letter.toUpperCase());
      if (matches.length !== 4 || !group.cardIds.every((id) => nounInitial(id) === letter.toUpperCase())) {
        errors.push(`${at} "${group.theme}": ${matches.length} cards start with «${letter}» (need exactly the 4 in the group): ${matches.join(', ')}`);
      }
    }
    const suffix = group.theme?.match(/Riman en «-(.+?)»/u)?.[1];
    if (suffix) {
      const matches = allCards.filter((id) => nounLower(id).endsWith(suffix.toLowerCase()));
      if (matches.length !== 4 || !group.cardIds.every((id) => nounLower(id).endsWith(suffix.toLowerCase()))) {
        errors.push(`${at} "${group.theme}": ${matches.length} cards end in «-${suffix}» (need exactly the 4 in the group): ${matches.join(', ')}`);
      }
    }
  }
}

if (errors.length) {
  console.error(`\n❌ ${errors.length} problem(s) found:\n`);
  for (const e of errors) console.error('  • ' + e);
  console.error('');
  process.exit(1);
}

console.log(`✅ ${puzzles.length} puzzles valid (${cardIds.size} cards in deck).`);
