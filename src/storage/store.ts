import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GuessRecord } from '../game/engine';

/**
 * Local persistence: per-puzzle results, aggregate stats, and settings.
 * MVP is local-only (AsyncStorage). Cloud sync (Supabase) comes later so a
 * reinstall doesn't wipe a long streak — see design doc §6 / §12.
 */

const K_RESULTS = 'coplas.results.v1'; // Record<puzzleId, PuzzleResult>
const K_SETTINGS = 'coplas.settings.v1';

export interface PuzzleResult {
  puzzleId: string;
  number: number;
  date: string;
  status: 'won' | 'lost';
  mistakes: number;
  /** Tier grid rows, in guess order — the share grid. */
  grid: number[][];
  /** ISO timestamp completed. */
  completedAt: string;
}

export interface Settings {
  relaxed: boolean;
  lang: 'es' | 'en';
  notifications: boolean;
  /** True once the player has seen (or skipped) the first-launch tutorial. */
  tutorialDone: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  relaxed: false,
  lang: 'es',
  notifications: true,
  tutorialDone: false,
};

export interface Stats {
  played: number;
  won: number;
  winRate: number; // 0..100
  perfect: number; // 0-mistake wins
  perfectRate: number; // 0..100
  currentStreak: number;
  bestStreak: number;
  /** Count of wins by mistake count 0..3. */
  mistakeHistogram: [number, number, number, number];
}

async function readResults(): Promise<Record<string, PuzzleResult>> {
  const raw = await AsyncStorage.getItem(K_RESULTS);
  return raw ? (JSON.parse(raw) as Record<string, PuzzleResult>) : {};
}

export async function getResult(puzzleId: string): Promise<PuzzleResult | undefined> {
  return (await readResults())[puzzleId];
}

export function gridFromGuesses(guesses: GuessRecord[]): number[][] {
  return guesses.map((g) => g.tierOf);
}

export async function saveResult(result: PuzzleResult): Promise<void> {
  const all = await readResults();
  // Don't overwrite a real completion if one already exists (first result wins).
  if (all[result.puzzleId]) return;
  all[result.puzzleId] = result;
  await AsyncStorage.setItem(K_RESULTS, JSON.stringify(all));
}

/** Compute aggregate stats + streaks from stored results. */
export async function getStats(): Promise<Stats> {
  const all = Object.values(await readResults());
  const played = all.length;
  const wins = all.filter((r) => r.status === 'won');
  const won = wins.length;
  const perfect = wins.filter((r) => r.mistakes === 0).length;

  const hist: [number, number, number, number] = [0, 0, 0, 0];
  for (const r of wins) {
    if (r.mistakes >= 0 && r.mistakes <= 3) hist[r.mistakes] += 1;
  }

  // Streaks: walk results ordered by puzzle number; a streak is consecutive
  // puzzle numbers that were WON.
  const byNumber = [...all].sort((a, b) => a.number - b.number);
  let best = 0;
  let run = 0;
  let prevNumber: number | null = null;
  let current = 0;
  for (const r of byNumber) {
    const consecutive = prevNumber === null || r.number === prevNumber + 1;
    if (r.status === 'won' && consecutive) {
      run += 1;
    } else if (r.status === 'won') {
      run = 1;
    } else {
      run = 0;
    }
    best = Math.max(best, run);
    prevNumber = r.number;
  }
  // Current streak = trailing run of wins on consecutive numbers.
  current = 0;
  prevNumber = null;
  for (let i = byNumber.length - 1; i >= 0; i--) {
    const r = byNumber[i];
    if (r.status !== 'won') break;
    if (prevNumber !== null && r.number !== prevNumber - 1) break;
    current += 1;
    prevNumber = r.number;
  }

  return {
    played,
    won,
    winRate: played ? Math.round((won / played) * 100) : 0,
    perfect,
    perfectRate: won ? Math.round((perfect / won) * 100) : 0,
    currentStreak: current,
    bestStreak: best,
    mistakeHistogram: hist,
  };
}

export async function getSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(K_SETTINGS);
  return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await AsyncStorage.setItem(K_SETTINGS, JSON.stringify(next));
  return next;
}
