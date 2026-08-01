#!/usr/bin/env node
/**
 * How many days of daily coplas are left.
 *
 *   node scripts/check-runway.mjs
 *
 * WHY THIS IS A GATE AND NOT A NOTE. `getTodaysPuzzle()` does not fail when it
 * runs off the end of the authored list. It falls back to the most recent past
 * puzzle:
 *
 *     const past = PUZZLES.filter((p) => p.date <= today);
 *     if (past.length) return past[past.length - 1];
 *
 * That is the right behaviour for a device whose clock is ahead, and it is a
 * catastrophe as an expiry mode: on the day after the run ends, every player in
 * the world starts getting the SAME board, every day, for ever. Nothing throws,
 * nothing logs, the app looks healthy, and `validate-puzzles.mjs` stays green
 * because the puzzles it checks are all still well-formed. The only signal is a
 * player noticing the daily has stopped changing.
 *
 * The run was 79 days from expiry when this was written, with nothing watching.
 *
 * WHAT IT MEASURES. The last authored date, against today in PUZZLE_TZ — the
 * same zone the app uses to decide which copla is today's, so this cannot
 * disagree with the app about where the edge is.
 *
 * FAIL_BELOW is deliberately large. This should become a build failure while
 * fixing it is still a one-command regeneration, not an emergency: the fix
 * requires a store build, and a store build requires review.
 */
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));

/** Below this many days of runway, fail. */
const FAIL_BELOW = 120;
/** Below this, pass but say so loudly. */
const WARN_BELOW = 240;

// Read the zone out of the app rather than repeating it: if PUZZLE_TZ ever
// moves, this check has to move with it or it measures a different "today".
const puzzlesSrc = readFileSync(new URL('src/data/puzzles.ts', root), 'utf8');
const TZ = puzzlesSrc.match(/PUZZLE_TZ\s*=\s*'([^']+)'/)?.[1];
if (!TZ) {
  console.error('could not read PUZZLE_TZ from src/data/puzzles.ts');
  process.exit(1);
}

const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const dates = read('src/data/puzzles.json')
  .map((p) => p.date)
  .filter(Boolean)
  .sort();

if (!dates.length) {
  console.error('no dated puzzles at all — the daily copla has nothing to serve');
  process.exit(1);
}

const last = dates[dates.length - 1];
const day = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d, 12); // midday, so DST can never shift the count
};
const left = Math.round((day(last) - day(today)) / 86_400_000);

// Gaps matter as much as the end date: a missing day inside the run is a day
// the fallback silently replays yesterday's board.
const gaps = [];
for (let i = 1; i < dates.length; i += 1) {
  const step = Math.round((day(dates[i]) - day(dates[i - 1])) / 86_400_000);
  if (step > 1) gaps.push(`${dates[i - 1]} → ${dates[i]} (${step - 1} missing)`);
}

console.log(`daily coplas   ${dates.length}`);
console.log(`today (${TZ})   ${today}`);
console.log(`runs out       ${last}`);
console.log(`days left      ${left}`);

if (gaps.length) {
  console.log(`\nGAPS IN THE RUN — each is a day that silently replays the one before:`);
  for (const g of gaps.slice(0, 10)) console.log(`  ! ${g}`);
  if (gaps.length > 10) console.log(`  … and ${gaps.length - 10} more`);
}

if (left < FAIL_BELOW || gaps.length) {
  console.error(
    `\n✗ ${gaps.length ? 'the run has holes in it' : `only ${left} days of daily coplas left`}.` +
      `\n  Raise TARGETS in scripts/gen-more-puzzles.mjs, re-run it, then npm run validate.`
  );
  process.exit(1);
}
if (left < WARN_BELOW) {
  console.log(`\n! ${left} days left — regenerate before it gets close to ${FAIL_BELOW}.`);
}
console.log(`\n✅ ${left} days of daily coplas ahead, no gaps`);
