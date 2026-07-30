import type { Difficulty, Puzzle } from '../types';
import raw from './puzzles.json';

/**
 * All bundled puzzles, sorted by number.
 *
 * In production this local list is the offline fallback; new puzzles are
 * fetched from a CDN / Supabase table and merged in (see design doc §11).
 */
export const PUZZLES: Puzzle[] = ([...(raw as Puzzle[])]).sort(
  (a, b) => a.number - b.number
);

/** IANA zone that decides when "today's" puzzle flips over. */
export const PUZZLE_TZ = 'America/Mexico_City';

/** Today's date as YYYY-MM-DD in the puzzle timezone. */
export function todayInPuzzleTz(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PUZZLE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function getPuzzleByDate(date: string): Puzzle | undefined {
  return PUZZLES.find((p) => p.date === date);
}

export function getPuzzleByNumber(n: number): Puzzle | undefined {
  return PUZZLES.find((p) => p.number === n);
}

/** A puzzle's difficulty, defaulting to 'media' when the field is absent. */
export function puzzleDifficulty(p: Puzzle): Difficulty {
  return p.difficulty ?? 'media';
}

/**
 * Puzzles at a given difficulty. Falls back to the full set if a pool is too
 * small to build a varied round order (shouldn't happen with the bundled set).
 */
export function getPuzzlesByDifficulty(d: Difficulty): Puzzle[] {
  const pool = PUZZLES.filter((p) => puzzleDifficulty(p) === d);
  return pool.length >= 4 ? pool : PUZZLES;
}

/**
 * The puzzle to show as "today". Exact date match if available; otherwise
 * the most recent puzzle on or before today; otherwise the very first one
 * (useful when the sample dates are all in the past/future).
 */
export function getTodaysPuzzle(now: Date = new Date()): Puzzle {
  const today = todayInPuzzleTz(now);
  const exact = getPuzzleByDate(today);
  if (exact) return exact;

  const past = PUZZLES.filter((p) => p.date <= today);
  if (past.length) return past[past.length - 1];

  return PUZZLES[0];
}

/** Past puzzles available for the Archive (everything up to & including today). */
export function getArchivePuzzles(now: Date = new Date()): Puzzle[] {
  const today = todayInPuzzleTz(now);
  return PUZZLES.filter((p) => p.date <= today).sort((a, b) => b.number - a.number);
}
