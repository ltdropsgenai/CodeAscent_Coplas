import { tierEmoji } from '../theme';
import type { Lang } from '../i18n';
import type { Tier } from '../types';
import { SHARE_URL } from '../links';

/**
 * Builds the spoiler-free share text, e.g.:
 *
 *   Coplas #2 — ¡sin errores! ✨
 *   🟩🟩🟩🟩
 *   🟪🟨🟪🟪
 *   🔥 3 · 📅 12
 *   https://coplas-web.vercel.app
 *
 * `grid` rows are tier numbers per guess (from gridFromGuesses).
 *
 * Three things this used to get wrong. It was hardcoded Spanish, so an English
 * player shared Spanish text they couldn't read. It pointed at "coplas.app",
 * which isn't a site we own, so every share sent people nowhere. And the loss
 * header said only "casi" with no grid context — the losing share is the one
 * most likely to be posted (people share near-misses), so it should still look
 * like something worth clicking.
 */
export function buildShareText(opts: {
  number: number;
  grid: number[][];
  status: 'won' | 'lost';
  mistakes: number;
  /** Consecutive wins. Shown from 2 up; "streak: 1" is not a brag. */
  winStreak?: number;
  /** Consecutive days played. Only shown when genuinely live. */
  dayStreak?: number;
  /** Round was failed then finished on the retry. */
  retried?: boolean;
  lang?: Lang;
  url?: string;
}): string {
  const {
    number,
    grid,
    status,
    mistakes,
    winStreak,
    dayStreak,
    retried,
    lang = 'es',
    url = SHARE_URL,
  } = opts;

  const rows = grid.map((row) => row.map((t) => tierEmoji[t as Tier]).join('')).join('\n');
  const es = lang === 'es';

  let header: string;
  if (status === 'won' && retried) {
    header = es
      ? `Coplas #${number} — al segundo intento 🔁`
      : `Coplas #${number} — got it on the retry 🔁`;
  } else if (status === 'won') {
    header =
      mistakes === 0
        ? es
          ? `Coplas #${number} — ¡sin errores! ✨`
          : `Coplas #${number} — flawless! ✨`
        : es
          ? `Coplas #${number} — resuelto con ${plural(mistakes, 'error', 'errores')}`
          : `Coplas #${number} — solved with ${plural(mistakes, 'mistake', 'mistakes')}`;
  } else {
    header = es ? `Coplas #${number} — casi 😅` : `Coplas #${number} — so close 😅`;
  }

  const bits: string[] = [];
  if (winStreak && winStreak > 1) bits.push(`🔥 ${winStreak}`);
  if (dayStreak && dayStreak > 1) bits.push(`📅 ${dayStreak}`);
  const streakLine = bits.length ? `\n${bits.join('  ·  ')}` : '';

  return `${header}\n${rows}${streakLine}\n${url}`;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
