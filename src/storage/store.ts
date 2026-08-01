import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameState, GuessRecord } from '../game/engine';
import type { Difficulty, Puzzle } from '../types';
import { todayInPuzzleTz } from '../data/puzzles';

/**
 * Local persistence: round results, running totals, seen cards, and settings.
 *
 * MVP is local-only (AsyncStorage). Cloud sync (Supabase) comes later so a
 * reinstall doesn't wipe a long streak — see design doc §6 / §12.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE WAS REWRITTEN
 *
 * Two things were broken, and they compounded.
 *
 * 1. Live (composed) rounds were never persisted at all — `useGame` bailed out
 *    with `if (isLive) return`. Since tapping JUGAR plays live rounds forever,
 *    the normal player recorded nothing: the stats screen showed zeros no
 *    matter how much they played, and the lifetime streak could never move.
 *
 * 2. The streak walked results looking for *consecutive puzzle numbers*. That
 *    is a daily-puzzle model. Live rounds are composed on demand, so it could
 *    not have worked for them even once they were saved.
 *
 * So streaks are now computed incrementally into a `Totals` record as each
 * round lands, in O(1), rather than by rescanning a list that grows without
 * bound. Two streaks, because they do different jobs: `winStreak` is
 * consecutive rounds WON and resets the moment you lose — that is the number
 * that makes a round matter. `dayStreak` is consecutive calendar days you
 * played at all — that is the number that brings you back tomorrow. Conflating
 * them gives you one number that does neither job well.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const K_RESULTS = 'coplas.results.v1'; // Record<puzzleId, PuzzleResult>
const K_SETTINGS = 'coplas.settings.v1';
const K_TOTALS = 'coplas.totals.v1';
const K_SEEN = 'coplas.seen.v1'; // Record<cardId, timesSeen>
const K_ACHIEVEMENTS = 'coplas.achievements.v1'; // string[] of celebrated ids
const K_SESSION = 'coplas.session.v1'; // the round in progress, if any

/**
 * Live rounds are unbounded, so the detailed list is capped. Bundled/archive
 * results are NEVER pruned — they are few (one per authored puzzle) and the
 * archive screen reads them back to draw each row's badge. Only live rounds
 * age out, oldest first. Lifetime numbers live in `Totals` and survive
 * pruning, so nothing a player earned is lost.
 */
const MAX_LIVE_RESULTS = 400;

/** How many recent play-days the stats calendar can draw. */
const CALENDAR_DAYS = 90;

export interface PuzzleResult {
  puzzleId: string;
  number: number;
  date: string;
  status: 'won' | 'lost';
  mistakes: number;
  /** True if the player spent a hint this round (excludes it from "perfect"). */
  hinted?: boolean;
  /** Tier grid rows, in guess order — the share grid. */
  grid: number[][];
  /** ISO timestamp completed. */
  completedAt: string;
  /** True for a composed (endless) round, false/absent for an authored puzzle. */
  live?: boolean;
  /** Difficulty the round was played at, for win-rate-by-difficulty. */
  difficulty?: Difficulty;
  /**
   * The player failed, took the retry, and finished the board. Still stored
   * with `status: 'lost'` — the retry buys closure, not credit — but flagged
   * so the stats screen can tell "gave up" from "came back and got it".
   */
  retried?: boolean;
  /** YYYY-MM-DD in PUZZLE_TZ. Drives the day streak and the calendar. */
  playedOn?: string;
}

export interface Settings {
  relaxed: boolean;
  lang: 'es' | 'en';
  notifications: boolean;
  /** Background music + sound effects on/off. The master switch. */
  soundEnabled: boolean;
  /**
   * What plays under a round, when sound is on at all.
   *
   * 'musica'  — a bed plays through, then a DIFFERENT one starts. Never loops
   *              on itself and never repeats a track until the pool is spent.
   * 'tictac'  — no bed; a soft tick marks time passing. Deliberately NOT a
   *              timer: nothing is counted and nothing runs out.
   * 'silencio'— nothing under the round. SFX and the win still play.
   *
   * Home and the win celebration are unaffected by this — it governs the round
   * only, which is where a bed either helps concentration or ruins it.
   */
  playAudio: 'musica' | 'tictac' | 'silencio';
  /** True once the player has seen (or skipped) the first-launch tutorial. */
  tutorialDone: boolean;
  /** Which difficulty pool continuous play draws from. */
  difficulty: Difficulty;
  /** Local time of day for the daily reminder, "HH:MM" 24h. */
  reminderTime: string;
  /** App version that last showed the store-review prompt. '' = never. */
  ratedVersion: string;
}

export const DEFAULT_SETTINGS: Settings = {
  relaxed: false,
  lang: 'es',
  notifications: true,
  soundEnabled: true,
  playAudio: 'musica',
  tutorialDone: false,
  difficulty: 'media',
  reminderTime: '19:00',
  ratedVersion: '',
};

/** The running aggregate. Updated once per finished round, never rescanned. */
export interface Totals {
  played: number;
  won: number;
  perfect: number;
  /** Wins by mistake count 0..3. */
  mistakeHistogram: [number, number, number, number];
  byDifficulty: Record<Difficulty, { played: number; won: number }>;
  winStreak: number;
  bestWinStreak: number;
  /** Consecutive FLAWLESS wins — no mistakes, no hint. Any other result resets. */
  perfectStreak: number;
  bestPerfectStreak: number;
  dayStreak: number;
  bestDayStreak: number;
  /** YYYY-MM-DD in PUZZLE_TZ of the most recent finished round. */
  lastPlayedOn: string;
  /** Distinct days with at least one finished round. */
  daysPlayed: number;
  /** Rounds failed then finished on the retry. */
  retried: number;
  /** ISO timestamp of the very first finished round. */
  firstPlayedAt: string;
  /** Most recent play-days, newest last, capped at CALENDAR_DAYS. */
  recentDays: string[];
}

export const EMPTY_TOTALS: Totals = {
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

export interface Stats extends Totals {
  winRate: number; // 0..100
  perfectRate: number; // 0..100 of wins
  /** True when the day streak is still alive as of today. */
  dayStreakLive: boolean;
}

// ── date helpers (all in PUZZLE_TZ, never the device zone) ────────────────────

/** YYYY-MM-DD for an instant, in the puzzle timezone. */
export function playDay(at: Date = new Date()): string {
  return todayInPuzzleTz(at);
}

/**
 * The calendar day after `day`. Anchored at midday UTC so adding 24h can never
 * land back on the same date across a DST boundary.
 */
function nextDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d, 12) + 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Whole days between two YYYY-MM-DD dates (b - a). */
export function daysBetween(a: string, b: string): number {
  const p = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d, 12);
  };
  return Math.round((p(b) - p(a)) / 86_400_000);
}

// ── raw reads ────────────────────────────────────────────────────────────────

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // A corrupt blob must not brick the app; losing history is bad, a crash
    // loop on launch is worse.
    return fallback;
  }
}

async function readResults(): Promise<Record<string, PuzzleResult>> {
  return readJson<Record<string, PuzzleResult>>(K_RESULTS, {});
}

export async function getResult(puzzleId: string): Promise<PuzzleResult | undefined> {
  return (await readResults())[puzzleId];
}

export function gridFromGuesses(guesses: GuessRecord[]): number[][] {
  return guesses.map((g) => g.tierOf);
}

// ── seen cards (for the deck-completion achievement) ──────────────────────────

/**
 * Which achievements the player has already been congratulated for.
 *
 * Achievements themselves are derived from stats and never stored — but
 * "have I already celebrated this one?" is genuinely new information that
 * cannot be recomputed, so only that gets persisted.
 */
export async function getSeenAchievements(): Promise<string[]> {
  return readJson<string[]>(K_ACHIEVEMENTS, []);
}

export async function markAchievementsSeen(ids: string[]): Promise<void> {
  const seen = new Set(await getSeenAchievements());
  for (const id of ids) seen.add(id);
  await AsyncStorage.setItem(K_ACHIEVEMENTS, JSON.stringify([...seen]));
}

export async function getSeenCards(): Promise<Record<string, number>> {
  return readJson<Record<string, number>>(K_SEEN, {});
}

export async function recordCardsSeen(cardIds: string[]): Promise<void> {
  const seen = await getSeenCards();
  for (const id of cardIds) seen[id] = (seen[id] ?? 0) + 1;
  await AsyncStorage.setItem(K_SEEN, JSON.stringify(seen));
}

// ── totals ───────────────────────────────────────────────────────────────────

export async function getTotals(): Promise<Totals> {
  const t = await readJson<Partial<Totals> | null>(K_TOTALS, null);
  if (t) return { ...EMPTY_TOTALS, ...t };
  // First run since the rewrite: rebuild from whatever detailed results exist
  // so an existing player's archive history isn't silently zeroed.
  const rebuilt = rebuildTotals(Object.values(await readResults()));
  await AsyncStorage.setItem(K_TOTALS, JSON.stringify(rebuilt));
  return rebuilt;
}

/** Replay a result list into a Totals. Only used for the one-time migration. */
function rebuildTotals(results: PuzzleResult[]): Totals {
  const ordered = [...results].sort((a, b) =>
    (a.completedAt ?? '').localeCompare(b.completedAt ?? '')
  );
  let t: Totals = { ...EMPTY_TOTALS, mistakeHistogram: [0, 0, 0, 0], byDifficulty: {
    facil: { played: 0, won: 0 },
    media: { played: 0, won: 0 },
    dificil: { played: 0, won: 0 },
  }, recentDays: [] };
  for (const r of ordered) t = applyToTotals(t, r);
  return t;
}

/** Fold one finished round into the running totals. Pure. */
export function applyToTotals(prev: Totals, r: PuzzleResult): Totals {
  const t: Totals = {
    ...prev,
    mistakeHistogram: [...prev.mistakeHistogram] as Totals['mistakeHistogram'],
    byDifficulty: {
      facil: { ...prev.byDifficulty.facil },
      media: { ...prev.byDifficulty.media },
      dificil: { ...prev.byDifficulty.dificil },
    },
    recentDays: [...prev.recentDays],
  };

  const day = r.playedOn || playDay(new Date(r.completedAt || Date.now()));
  const won = r.status === 'won';

  t.played += 1;
  if (won) {
    t.won += 1;
    if (r.mistakes === 0 && !r.hinted) t.perfect += 1;
    if (r.mistakes >= 0 && r.mistakes <= 3) t.mistakeHistogram[r.mistakes] += 1;
  }
  if (r.retried) t.retried += 1;

  const d = r.difficulty;
  if (d && t.byDifficulty[d]) {
    t.byDifficulty[d].played += 1;
    if (won) t.byDifficulty[d].won += 1;
  }

  // Win streak: consecutive wins, in the order rounds were finished. A loss —
  // including a round rescued on the retry — resets it to zero.
  t.winStreak = won ? t.winStreak + 1 : 0;
  t.bestWinStreak = Math.max(t.bestWinStreak, t.winStreak);

  // Flawless streak is stricter than the win streak: a win with even one
  // mistake, or with a hint spent, ends it.
  const flawless = won && r.mistakes === 0 && !r.hinted;
  t.perfectStreak = flawless ? t.perfectStreak + 1 : 0;
  t.bestPerfectStreak = Math.max(t.bestPerfectStreak, t.perfectStreak);

  // Day streak: same day is a no-op, the next day extends, any gap restarts.
  if (!t.lastPlayedOn) {
    t.dayStreak = 1;
    t.daysPlayed = 1;
  } else if (day !== t.lastPlayedOn) {
    t.dayStreak = day === nextDay(t.lastPlayedOn) ? t.dayStreak + 1 : 1;
    t.daysPlayed += 1;
  }
  if (day > t.lastPlayedOn) t.lastPlayedOn = day;
  t.bestDayStreak = Math.max(t.bestDayStreak, t.dayStreak);

  if (t.recentDays[t.recentDays.length - 1] !== day && !t.recentDays.includes(day)) {
    t.recentDays.push(day);
    if (t.recentDays.length > CALENDAR_DAYS) t.recentDays.shift();
  }

  if (!t.firstPlayedAt) t.firstPlayedAt = r.completedAt;
  return t;
}

// ── writes ───────────────────────────────────────────────────────────────────

export async function saveResult(result: PuzzleResult): Promise<void> {
  const all = await readResults();
  // Don't overwrite a real completion if one already exists (first result wins).
  if (all[result.puzzleId]) return;

  const stamped: PuzzleResult = {
    ...result,
    playedOn: result.playedOn ?? playDay(new Date(result.completedAt || Date.now())),
  };
  all[stamped.puzzleId] = stamped;

  // Age out old LIVE rounds only. Authored puzzles stay so the archive can
  // keep showing their badges.
  const live = Object.values(all).filter((r) => r.live);
  if (live.length > MAX_LIVE_RESULTS) {
    live
      .sort((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? ''))
      .slice(0, live.length - MAX_LIVE_RESULTS)
      .forEach((r) => delete all[r.puzzleId]);
  }

  const totals = applyToTotals(await getTotals(), stamped);

  await AsyncStorage.multiSet([
    [K_RESULTS, JSON.stringify(all)],
    [K_TOTALS, JSON.stringify(totals)],
  ]);
}

/**
 * Flag a already-recorded loss as "failed, then finished on the retry".
 *
 * The round was written the moment it was lost — that is what keeps the streak
 * honest and stops a player banking a win by quitting before the record lands.
 * Taking the retry never changes `status`; it only adds this flag, so stats can
 * distinguish giving up from coming back and getting it.
 */
export async function markRetried(puzzleId: string): Promise<void> {
  const all = await readResults();
  const r = all[puzzleId];
  if (!r || r.retried) return;
  all[puzzleId] = { ...r, retried: true };
  const totals = await getTotals();
  await AsyncStorage.multiSet([
    [K_RESULTS, JSON.stringify(all)],
    [K_TOTALS, JSON.stringify({ ...totals, retried: totals.retried + 1 })],
  ]);
}

/** Aggregate stats, read straight off the running totals. */
export async function getStats(): Promise<Stats> {
  const t = await getTotals();
  const today = playDay();
  return {
    ...t,
    winRate: t.played ? Math.round((t.won / t.played) * 100) : 0,
    perfectRate: t.won ? Math.round((t.perfect / t.won) * 100) : 0,
    // The stored streak is historical. It is only *live* if the last play was
    // today or yesterday — otherwise it has already lapsed and showing it as
    // current would be a lie the next round would quietly correct.
    dayStreakLive: !!t.lastPlayedOn && daysBetween(t.lastPlayedOn, today) <= 1,
  };
}

// ── settings ─────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(K_SETTINGS);
  return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await AsyncStorage.setItem(K_SETTINGS, JSON.stringify(next));
  return next;
}

// ── the round in progress ───────────────────────────────────────────

/** How recently and how often one card (or theme) has appeared this session. */
export interface CardUse {
  count: number;
  last: number;
}

/**
 * A round the player walked away from, and the session history around it.
 *
 * WHY THIS EXISTS. Everything that made a play session a session lived in
 * memory: the composed puzzle and `GameState` in `useState`, and `liveSeq`,
 * `roundNo`, `usage` and `themeUsage` in `useRef`. Navigating Home unmounts
 * app/play.tsx, so all of it died — a player who stepped out mid-round came
 * back to a brand new round 1 with their board gone.
 *
 * The board is the visible half. The quieter half is `usage` and `themeUsage`:
 * those are the anti-repeat history the composer scores candidate rounds
 * against, so discarding them reset the whole card- and theme-spreading effort
 * every time somebody backed out. A player who dips in and out would meet
 * repeats constantly, and no gate would ever show it, because every simulation
 * in sim-rounds.mjs runs one uninterrupted session.
 *
 * THE PUZZLE IS STORED INLINE, not by reference. A live round is composed from
 * the group library, and that library changes between releases — it grew by 82
 * trap groups in one afternoon. Storing group ids would let a saved round
 * rehydrate into different cards, or none. Storing the board itself makes a
 * resumed round immune to anything we do to the library afterwards.
 */
export interface SavedSession {
  /** Schema tag. A bump discards old saves rather than misreading them. */
  v: 1;
  /**
   * The unfinished board, if there is one.
   *
   * NULL WHEN THE LAST ROUND WAS COMPLETED, and that split is the point. The
   * board and the session tallies below have different lifetimes: a finished
   * board must not come back (the player would land on a results screen they
   * already dismissed, or re-solve a group), but the tallies must survive it,
   * or finishing round 25 and closing the app would drop you back to round 1
   * with an empty anti-repeat history.
   *
   * An earlier version stored them together and saved only while the status was
   * 'playing'. That looked right and was wrong in both directions: win round 25
   * without tapping through, and the last write on disk was the board as it
   * stood BEFORE the winning guess — so the next launch handed you round 25
   * again with three groups solved.
   */
  puzzle: Puzzle | null;
  state: GameState | null;
  /** Continuous-play bookkeeping. Outlives any single board — see above. */
  seq: number;
  roundNo: number;
  /** Drives the "Ronda N" header, which is playCount + 1. */
  playCount: number;
  usage: Record<string, CardUse>;
  themeUsage: Record<string, CardUse>;
  difficulty: Difficulty;
  /** Only for diagnosing a stale save; nothing decides on it. */
  savedAt: string;
}

/**
 * Read the saved session.
 *
 * The board is stripped unless it is genuinely mid-round, while the tallies are
 * returned either way. A caller therefore always learns where the player was up
 * to, and only sometimes gets a board to put them back on.
 */
export async function getSession(): Promise<SavedSession | undefined> {
  const s = await readJson<SavedSession | null>(K_SESSION, null);
  if (!s || s.v !== 1) return undefined;
  const live = !!s.puzzle?.groups?.length && s.state?.status === 'playing';
  return live ? s : { ...s, puzzle: null, state: null };
}

export async function saveSession(s: SavedSession): Promise<void> {
  try {
    await AsyncStorage.setItem(K_SESSION, JSON.stringify(s));
  } catch {
    // Losing a resume point is a small harm; crashing mid-round is a large one.
  }
}

// There is deliberately no clearSession(). An earlier draft had one, called on
// advancing to the next round — which would have wiped the round counter and
// the anti-repeat history along with the finished board. Ending a round writes
// a board-less session instead, so there is never a moment where the record
// should be deleted outright, and a spare "delete everything" helper sitting
// here would only be an invitation to reintroduce that bug.
