/**
 * Streak logic check, run with plain node — no test runner, no network.
 *
 * `applyToTotals` is the one piece of this feature that is easy to get subtly
 * wrong and very hard to debug later: a day-streak bug shows up as a player
 * angrily reporting a lost streak weeks after the off-by-one shipped. So the
 * pure logic is exercised here directly.
 *
 * store.ts can't be imported straight into node (AsyncStorage, JSON imports),
 * so the pure functions are re-read out of the source and evaluated in
 * isolation. That means this tests the REAL code, not a copy of it — if
 * someone edits applyToTotals, this test sees the edit.
 *
 *   node scripts/streak.test.mjs
 */
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/storage/store.ts', import.meta.url), 'utf8');

/** Pull a top-level function out of the source by name, braces balanced. */
function extract(name) {
  const start = src.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`could not find function ${name}`);
  let i = src.indexOf('{', start);
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, j + 1);
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

// Strip TypeScript annotations well enough for these three functions.
// Deliberately crude — it only has to handle the syntax these three actually
// use, and if a future edit introduces syntax it can't strip, the import
// throws loudly rather than silently testing stale code.
const CONSTS = `const CALENDAR_DAYS = 90;
const playDay = () => { throw new Error('playDay should not be reached: every test round sets playedOn'); };
`;

const stripped =
  CONSTS +
  [extract('nextDay'), extract('daysBetween'), extract('applyToTotals')]
    .join('\n\n')
    .replace(/export\s+/g, '')
    // ` as Totals['mistakeHistogram']`, ` as Foo`, etc.
    .replace(/\s+as\s+[A-Za-z_$][\w$.]*(\[[^\]]*\])?/g, '')
    // `const t: Totals =`
    .replace(/const\s+(\w+)\s*:\s*[A-Za-z_$][\w$.<>,\s]*=/g, 'const $1 =')
    // parameter annotations
    .replace(/\(prev:\s*Totals,\s*r:\s*PuzzleResult\)/g, '(prev, r)')
    .replace(/\(day:\s*string\)/g, '(day)')
    .replace(/\(a:\s*string,\s*b:\s*string\)/g, '(a, b)')
    .replace(/\(s:\s*string\)/g, '(s)')
    // return-type annotations
    .replace(/\)\s*:\s*(string|number|Totals)\s*\{/g, ') {');

const { applyToTotals, daysBetween } = await import(
  `data:text/javascript,${encodeURIComponent(
    `${stripped}\nexport { applyToTotals, daysBetween, nextDay };`
  )}`
);

const EMPTY = {
  played: 0,
  won: 0,
  perfect: 0,
  mistakeHistogram: [0, 0, 0, 0],
  byDifficulty: {
    facil: { played: 0, won: 0 },
    media: { played: 0, won: 0 },
    dificil: { played: 0, won: 0 },
  },
  winStreak: 0,
  bestWinStreak: 0,
  perfectStreak: 0,
  bestPerfectStreak: 0,
  dayStreak: 0,
  bestDayStreak: 0,
  lastPlayedOn: '',
  daysPlayed: 0,
  retried: 0,
  firstPlayedAt: '',
  recentDays: [],
};

const round = (day, status, extra = {}) => ({
  puzzleId: `p-${day}-${Math.random()}`,
  number: 1,
  date: '',
  status,
  mistakes: status === 'won' ? 0 : 4,
  grid: [],
  completedAt: `${day}T12:00:00.000Z`,
  playedOn: day,
  difficulty: 'media',
  ...extra,
});

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures += 1;
    console.log(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`);
  } else {
    console.log(`ok    ${label}`);
  }
}

const fold = (rounds) => rounds.reduce((t, r) => applyToTotals(t, r), EMPTY);

// ── date maths ───────────────────────────────────────────────────────────────
check('daysBetween same day', daysBetween('2026-07-31', '2026-07-31'), 0);
check('daysBetween consecutive', daysBetween('2026-07-31', '2026-08-01'), 1);
check('daysBetween across month', daysBetween('2026-07-28', '2026-08-03'), 6);
check('daysBetween across year', daysBetween('2026-12-31', '2027-01-01'), 1);
// DST in America/Mexico_City historically shifted in early April.
check('daysBetween across a DST boundary', daysBetween('2026-04-04', '2026-04-06'), 2);

// ── win streak ───────────────────────────────────────────────────────────────
let t = fold([
  round('2026-07-01', 'won'),
  round('2026-07-01', 'won'),
  round('2026-07-01', 'won'),
]);
check('3 wins → winStreak 3', t.winStreak, 3);
check('3 wins → bestWinStreak 3', t.bestWinStreak, 3);

t = fold([
  round('2026-07-01', 'won'),
  round('2026-07-01', 'won'),
  round('2026-07-01', 'lost'),
  round('2026-07-01', 'won'),
]);
check('loss resets winStreak', t.winStreak, 1);
check('best survives the reset', t.bestWinStreak, 2);

// ── flawless streak ──────────────────────────────────────────────────────────
t = fold([
  round('2026-07-01', 'won'),
  round('2026-07-01', 'won'),
  round('2026-07-01', 'won'),
]);
check('3 flawless wins → perfectStreak 3', t.perfectStreak, 3);

t = fold([
  round('2026-07-01', 'won'),
  round('2026-07-01', 'won'),
  round('2026-07-01', 'won', { mistakes: 1 }),
  round('2026-07-01', 'won'),
]);
check('a win WITH a mistake breaks perfectStreak', t.perfectStreak, 1);
check('but not the win streak', t.winStreak, 4);
check('bestPerfectStreak keeps the peak of 2', t.bestPerfectStreak, 2);

t = fold([round('2026-07-01', 'won'), round('2026-07-01', 'won', { hinted: true })]);
check('a hinted win breaks perfectStreak', t.perfectStreak, 0);

t = fold([
  round('2026-07-01', 'won'),
  round('2026-07-01', 'won'),
  round('2026-07-01', 'won'),
  round('2026-07-01', 'won'),
  round('2026-07-01', 'won'),
]);
check('five flawless in a row (the badge)', t.bestPerfectStreak, 5);

t = fold([round('2026-07-01', 'lost', { retried: true })]);
check('retried round still books as a loss', t.winStreak, 0);
check('retried round counted', t.retried, 1);
check('retried loss is not a win', t.won, 0);

// ── day streak ───────────────────────────────────────────────────────────────
t = fold([round('2026-07-01', 'won'), round('2026-07-02', 'lost'), round('2026-07-03', 'won')]);
check('3 consecutive days → dayStreak 3', t.dayStreak, 3);
check('a loss does NOT break the day streak', t.dayStreak, 3);
check('daysPlayed counts distinct days', t.daysPlayed, 3);

t = fold([
  round('2026-07-01', 'won'),
  round('2026-07-01', 'won'),
  round('2026-07-01', 'won'),
]);
check('many rounds one day → dayStreak 1', t.dayStreak, 1);
check('many rounds one day → daysPlayed 1', t.daysPlayed, 1);

t = fold([round('2026-07-01', 'won'), round('2026-07-03', 'won')]);
check('a skipped day restarts dayStreak', t.dayStreak, 1);
check('best day streak remembers the peak', t.bestDayStreak, 1);

t = fold([
  round('2026-07-01', 'won'),
  round('2026-07-02', 'won'),
  round('2026-07-03', 'won'),
  round('2026-07-06', 'won'),
]);
check('gap after a run restarts at 1', t.dayStreak, 1);
check('bestDayStreak keeps the 3', t.bestDayStreak, 3);

t = fold([round('2026-07-31', 'won'), round('2026-08-01', 'won')]);
check('month boundary extends the streak', t.dayStreak, 2);

t = fold([round('2026-12-31', 'won'), round('2027-01-01', 'won')]);
check('year boundary extends the streak', t.dayStreak, 2);

// ── aggregates ───────────────────────────────────────────────────────────────
t = fold([
  round('2026-07-01', 'won', { difficulty: 'dificil' }),
  round('2026-07-01', 'lost', { difficulty: 'dificil' }),
  round('2026-07-01', 'won', { difficulty: 'facil', mistakes: 2 }),
]);
check('byDifficulty hard played', t.byDifficulty.dificil.played, 2);
check('byDifficulty hard won', t.byDifficulty.dificil.won, 1);
check('perfect counts only flawless wins', t.perfect, 1);
check('histogram bucket 2', t.mistakeHistogram[2], 1);

t = fold([round('2026-07-01', 'won', { hinted: true })]);
check('a hinted win is not perfect', t.perfect, 0);

t = fold([round('2026-07-01', 'won'), round('2026-07-02', 'won'), round('2026-07-02', 'won')]);
check('recentDays has no duplicates', t.recentDays, ['2026-07-01', '2026-07-02']);


// ── resuming an interrupted session ──────────────────────────────────────────
//
// The behaviour this pins down, asked as a question and found to be broken:
// "if I played up to round 25 and came back tomorrow, I should start at 26."
//
// Two things have to be true at once, and the first draft got both wrong by
// storing them together. A FINISHED board must not come back — restoring one
// drops the player onto a results screen they already dismissed, or makes them
// re-solve the last group. But the session TALLIES must survive it, or
// finishing round 25 and closing the app restarts at round 1 with an empty
// anti-repeat history.
//
// `getSession` is where that split is enforced, so it is tested here on the
// real source rather than a copy — `readJson` is the only thing stubbed.
// `extract` slices from the word `function`, so the `export async` in front of
// it is left behind — the `async` has to be put back or the `await` inside is
// a syntax error.
const getSessionSrc = extract('getSession')
  .replace(/^function getSession\(\)\s*:\s*Promise<[^>]*>\s*\{/, 'async function getSession() {')
  .replace(/readJson<[^>]*>\(/g, 'readJson(');

const board = { groups: [{ theme: 'x', tier: 1, cardIds: ['a', 'b', 'c', 'd'], explanation: 'y' }] };
const tallies = {
  v: 1,
  seq: 25,
  roundNo: 25,
  playCount: 25,
  usage: { el_sol: { count: 3, last: 24 } },
  themeUsage: { Astros: { count: 2, last: 23 } },
  difficulty: 'media',
  savedAt: '2026-08-01T00:00:00.000Z',
};

async function sessionFrom(saved) {
  const mod = await import(
    `data:text/javascript,${encodeURIComponent(
      `const K_SESSION='k';\nconst readJson = async () => (${JSON.stringify(saved)});\n` +
        `${getSessionSrc}\nexport { getSession };`
    )}`
  );
  return mod.getSession();
}

// Mid-round: the exact board comes back.
let s = await sessionFrom({ ...tallies, puzzle: board, state: { status: 'playing' } });
check('mid-round: board is restored', !!s.puzzle, true);
check('mid-round: round counter is restored', s.playCount, 25);

// Finished and never advanced: the board is dropped, the tallies are not.
// Without this, closing the app on a win handed round 25 back with three
// groups already solved.
s = await sessionFrom({ ...tallies, puzzle: board, state: { status: 'won' } });
check('finished: board is dropped', s.puzzle, null);
check('finished: state is dropped', s.state, null);
check('finished: round counter survives', s.playCount, 25);
check('finished: seq survives', s.seq, 25);
check('finished: card history survives', s.usage.el_sol.count, 3);
check('finished: theme history survives', s.themeUsage.Astros.count, 2);

// A lost round is just as finished as a won one.
s = await sessionFrom({ ...tallies, puzzle: board, state: { status: 'lost' } });
check('lost: board is dropped', s.puzzle, null);
check('lost: round counter survives', s.playCount, 25);

// Already board-less (the normal shape after finishing a round).
s = await sessionFrom({ ...tallies, puzzle: null, state: null });
check('board-less: still returns tallies', s.playCount, 25);

// A save written by an older build must be discarded, not misread.
check('unknown schema version is ignored', await sessionFrom({ ...tallies, v: 99 }), undefined);
check('absent save is ignored', await sessionFrom(null), undefined);

console.log(failures ? `\n${failures} FAILING` : '\nall streak checks passed');
process.exit(failures ? 1 : 0);
