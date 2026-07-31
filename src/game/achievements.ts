import { CARDS } from '../data/cards';
import type { Stats } from '../storage/store';

/**
 * Achievements, derived rather than stored.
 *
 * Nothing here is persisted separately: every badge is a pure function of the
 * running `Totals` plus the seen-card count. That means they can be added,
 * retuned or reordered in a JS-only update without a migration, and they can
 * never drift out of sync with the numbers on the stats screen — which is the
 * usual way achievement systems end up lying to people.
 *
 * Tiers are deliberately front-loaded: the first badge lands on round one, and
 * several more inside the first session. A ladder whose bottom rung is at
 * "50 wins" reads as empty to everyone who hasn't got there, which is almost
 * everyone.
 */

export type AchievementId =
  | 'first_round'
  | 'first_win'
  | 'flawless'
  | 'win_streak_3'
  | 'win_streak_10'
  | 'win_streak_25'
  | 'day_streak_3'
  | 'day_streak_7'
  | 'day_streak_30'
  | 'perfect_10'
  | 'hard_win'
  | 'comeback'
  | 'deck_quarter'
  | 'deck_half'
  | 'deck_all';

export interface Achievement {
  id: AchievementId;
  /** Card id from our own deck, used as the badge face. */
  icon: string;
  /** How far along, 0..1. */
  progress: number;
  /** Current value and the value that unlocks it, for "7 / 30" style labels. */
  have: number;
  need: number;
  unlocked: boolean;
}

interface Input {
  stats: Stats;
  seenCount: number;
}

/**
 * Every achievement, unlocked ones first, then by how close they are — so the
 * screen always opens on something the player just earned or nearly has.
 */
export function computeAchievements({ stats, seenCount }: Input): Achievement[] {
  const deck = Math.max(1, CARDS.length);
  const hardWins = stats.byDifficulty.dificil.won;

  const defs: Array<[AchievementId, string, number, number]> = [
    // id, icon card, have, need
    ['first_round', 'el_naipe', stats.played, 1],
    ['first_win', 'la_medalla', stats.won, 1],
    ['flawless', 'la_estrella', stats.perfect, 1],
    ['win_streak_3', 'el_fuego', stats.bestWinStreak, 3],
    ['win_streak_10', 'el_fuego', stats.bestWinStreak, 10],
    ['win_streak_25', 'la_corona', stats.bestWinStreak, 25],
    ['day_streak_3', 'el_calendario', stats.bestDayStreak, 3],
    ['day_streak_7', 'el_calendario', stats.bestDayStreak, 7],
    ['day_streak_30', 'el_trofeo', stats.bestDayStreak, 30],
    ['perfect_10', 'la_estrella', stats.perfect, 10],
    ['hard_win', 'el_diablito', hardWins, 1],
    // Failing, taking the retry and finishing is worth marking: it is the
    // behaviour the retry was added to encourage.
    ['comeback', 'la_llave', stats.retried, 1],
    ['deck_quarter', 'el_archivero', seenCount, Math.round(deck * 0.25)],
    ['deck_half', 'el_archivero', seenCount, Math.round(deck * 0.5)],
    ['deck_all', 'el_mundo', seenCount, deck],
  ];

  return defs
    .map(([id, icon, have, need]) => ({
      id,
      icon,
      have: Math.min(have, need),
      need,
      progress: Math.max(0, Math.min(1, have / need)),
      unlocked: have >= need,
    }))
    .sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      return b.progress - a.progress;
    });
}

/** How many are unlocked, for the settings row subtitle. */
export function unlockedCount(list: Achievement[]): number {
  return list.filter((a) => a.unlocked).length;
}
