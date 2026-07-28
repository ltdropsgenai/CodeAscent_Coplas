import { tierEmoji } from '../theme';
import type { Tier } from '../types';

/**
 * Builds the spoiler-free share text, e.g.:
 *
 *   Coplas #2  🟩 sin errores
 *   🟩🟩🟩🟩
 *   🟪🟨🟪🟪
 *   ...
 *   coplas.app
 *
 * `grid` rows are tier numbers per guess (from gridFromGuesses).
 */
export function buildShareText(opts: {
  number: number;
  grid: number[][];
  status: 'won' | 'lost';
  mistakes: number;
  currentStreak?: number;
  url?: string;
}): string {
  const { number, grid, status, mistakes, currentStreak, url = 'coplas.app' } = opts;

  const rows = grid.map((row) => row.map((t) => tierEmoji[t as Tier]).join('')).join('\n');

  const header =
    status === 'won'
      ? mistakes === 0
        ? `Coplas #${number} — ¡sin errores! ✨`
        : `Coplas #${number} — ${solvedWord(mistakes)}`
      : `Coplas #${number} — casi 😅`;

  const streakLine =
    currentStreak && currentStreak > 1 ? `\n🔥 Racha: ${currentStreak}` : '';

  return `${header}\n${rows}${streakLine}\n${url}`;
}

function solvedWord(mistakes: number): string {
  const errs = mistakes === 1 ? '1 error' : `${mistakes} errores`;
  return `resuelto con ${errs}`;
}
