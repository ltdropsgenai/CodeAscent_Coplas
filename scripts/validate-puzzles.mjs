#!/usr/bin/env node
/**
 * Validates src/data/puzzles.json without external deps.
 *
 * Rules enforced:
 *  - id matches coplas-####, unique
 *  - number unique, date matches YYYY-MM-DD, dates unique
 *  - exactly 4 groups; each group has exactly 4 cardIds
 *  - every cardId exists in the 54-card deck
 *  - no card appears in more than one group within a puzzle (= 16 unique)
 *  - the four tiers are exactly {1,2,3,4}
 *
 * Exits non-zero on any error. Run: npm run validate
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Parse the card ids straight out of the TS source (avoids a build step).
const cardsSrc = readFileSync(join(root, 'src/data/cards.ts'), 'utf8');
const cardIds = new Set(
  [...cardsSrc.matchAll(/id:\s*'([a-z0-9_]+)'/g)].map((m) => m[1])
);

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
}

if (errors.length) {
  console.error(`\n❌ ${errors.length} problem(s) found:\n`);
  for (const e of errors) console.error('  • ' + e);
  console.error('');
  process.exit(1);
}

console.log(`✅ ${puzzles.length} puzzles valid (${cardIds.size} cards in deck).`);
