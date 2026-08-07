/**
 * Abuela's assets — the only place her files are named.
 *
 * Mirrors cardVideos.ts: one require() per asset so Metro bundles them and
 * scripts/check-assets.mjs can verify each path resolves and each extension
 * matches its bytes. Build 6 shipped 995 JPEGs named .webp because nothing
 * checked that; this registry is included in that check for the same reason.
 */
export type AbuelaLang = 'es' | 'en';

/** One video per beat per language. She is lip-synced, so these are not interchangeable. */
export const ABUELA_CLIPS: Record<string, number> = {
  'es-1': require('../../assets/abuela/es-1.mp4'),
  'es-2': require('../../assets/abuela/es-2.mp4'),
  'es-3': require('../../assets/abuela/es-3.mp4'),
  'en-1': require('../../assets/abuela/en-1.mp4'),
  'en-2': require('../../assets/abuela/en-2.mp4'),
  'en-3': require('../../assets/abuela/en-3.mp4'),
};

/** Stills. Also the fallback whenever a clip cannot or should not play. */
export const ABUELA_POSES: Record<string, number> = {
  'greeting': require('../../assets/abuela/pose-greeting.jpg'),
  'proud': require('../../assets/abuela/pose-proud.jpg'),
  'delighted': require('../../assets/abuela/pose-delighted.jpg'),
  'sympathetic': require('../../assets/abuela/pose-sympathetic.jpg'),
  'home': require('../../assets/abuela/still-home.jpg'),
};

export function abuelaClip(lang: AbuelaLang, beat: number): number | undefined {
  return ABUELA_CLIPS[`${lang}-${beat}`];
}
