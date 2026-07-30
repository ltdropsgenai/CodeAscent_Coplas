import RAW from './groupText.en.json';
import type { Lang } from '../i18n';

/**
 * English overlay for puzzle *content* — the group themes and explanations.
 *
 * The group libraries (`groups.json`, `expansion.groups.json`) are generated
 * artifacts and are regenerated wholesale by `scripts/gen-more-puzzles.mjs`, so
 * translations cannot live inside them: a regeneration would wipe them. This is
 * a side-car dictionary keyed by the Spanish string instead, which also
 * de-duplicates — 432 groups use only 232 distinct themes and 236 distinct
 * explanations, so there are 468 strings to maintain rather than 864.
 *
 * Three rules shaped the translations, and they matter if you ever add more:
 *
 *  1. **Card names stay in Spanish.** The name is printed into the card art the
 *     player is looking at, so "Naranja, limón, lima and toronja: all citrus."
 *     is correct and "Orange, lemon…" would contradict the screen.
 *  2. **Rhyme and letter explanations are copied verbatim.** "Bande-ra,
 *     escale-ra, pe-ra, calave-ra." is Spanish wordplay; translating it would
 *     destroy the very thing the group is about.
 *  3. **Hidden-word explanations carry an English gloss**, so the joke still
 *     lands: «Soldado hides «sol» (sun), Sandía «día» (day)…».
 *
 * Lookups fall back to the Spanish, so a newly generated group that isn't in
 * the dictionary yet degrades to untranslated text rather than blank or broken.
 *
 * NOTE: never localize a theme before using it as an identity key. `engine.ts`
 * matches solved groups by `theme`, and `play.tsx` uses it as a React key —
 * both must keep seeing the stable Spanish string. Localize at render only.
 */
const DICT = RAW as { themes: Record<string, string>; whys: Record<string, string> };

/** The group's theme heading in the player's language. */
export function groupTheme(theme: string, lang: Lang): string {
  return lang === 'en' ? (DICT.themes[theme] ?? theme) : theme;
}

/** The one-line reveal explaining why those four cards belong together. */
export function groupWhy(why: string, lang: Lang): string {
  return lang === 'en' ? (DICT.whys[why] ?? why) : why;
}

/** Coverage, for the localization check in scripts/check-i18n.mjs. */
export const GROUP_TEXT_COUNTS = {
  themes: Object.keys(DICT.themes).length,
  whys: Object.keys(DICT.whys).length,
};
