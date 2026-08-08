/**
 * Abuela's assets — the only place her files are named.
 *
 * Mirrors cardVideos.ts: one require() per asset so Metro bundles them and
 * scripts/check-assets.mjs can verify each path resolves and each extension
 * matches its bytes. Build 6 shipped 995 JPEGs named .webp because nothing
 * checked that; this registry is included in that check for the same reason.
 */
export type AbuelaLang = 'es' | 'en';

import MARKS from './abuelaMarks.json';

/**
 * ONE continuous clip per language — all three beats welded together by
 * scripts/build-abuela-reel.mjs.
 *
 * They used to be six separate files, one per beat, swapped in the player as
 * the narration advanced. Every swap was a visible cut: expo-video holds the
 * previous frame until the new source has one, Android flashes black, and each
 * clip opens on the identical start portrait so she snapped back to it at every
 * join. Dipping between them made it a fade AND a cut. There is no player-side
 * fix for a cut between two files; there is only not having two files.
 *
 * The per-beat clips stay in assets/abuela/ as the source the reel is built
 * from. They are deliberately NOT required here, so Metro does not bundle them.
 */
export const ABUELA_REELS: Record<AbuelaLang, number> = {
  es: require('../../assets/abuela/es.mp4'),
  en: require('../../assets/abuela/en.mp4'),
};

/**
 * When each caption takes over, in seconds into the reel. Measured from the
 * built file by the build script, never estimated — the marks are the middle of
 * each dissolve, which is the moment a viewer reads as the change.
 */
export const ABUELA_MARKS: Record<AbuelaLang, number[]> = MARKS;

/**
 * Her idle loop on Home — breathing, blinking, sitting with you.
 *
 * Built by scripts/fetch-abuela-idle.mjs, which plays a generated clip forward
 * and then backward so the last frame IS the first frame. The loop point is
 * seamless by construction rather than by hoping a generator lands the same
 * pose it started on; asking it to do that was tried on the tutorial beats and
 * did not work.
 */
export const ABUELA_IDLE = require('../../assets/abuela/idle.mp4');

/**
 * What she says when you tap her on Home, before the tutorial opens.
 *
 * Her own voice, not the celebration pool — those are a different speaker and
 * would break the illusion the moment anyone noticed. Kept short on purpose:
 * the tutorial waits for the line to finish before it opens, so a long line is
 * a long delay before the screen changes.
 */
export const ABUELA_LINES: Record<AbuelaLang, number[]> = {
  es: [
    require('../../assets/audio/voice/abuela_es_1.mp3'),
    require('../../assets/audio/voice/abuela_es_2.mp3'),
    require('../../assets/audio/voice/abuela_es_3.mp3'),
    require('../../assets/audio/voice/abuela_es_4.mp3'),
    require('../../assets/audio/voice/abuela_es_5.mp3'),
    require('../../assets/audio/voice/abuela_es_6.mp3'),
    require('../../assets/audio/voice/abuela_es_7.mp3'),
    require('../../assets/audio/voice/abuela_es_8.mp3'),
  ],
  en: [
    require('../../assets/audio/voice/abuela_en_1.mp3'),
    require('../../assets/audio/voice/abuela_en_2.mp3'),
    require('../../assets/audio/voice/abuela_en_3.mp3'),
    require('../../assets/audio/voice/abuela_en_4.mp3'),
    require('../../assets/audio/voice/abuela_en_5.mp3'),
    require('../../assets/audio/voice/abuela_en_6.mp3'),
    require('../../assets/audio/voice/abuela_en_7.mp3'),
    require('../../assets/audio/voice/abuela_en_8.mp3'),
  ],
};

/** Stills. Also the fallback whenever a clip cannot or should not play. */
export const ABUELA_POSES: Record<string, number> = {
  'greeting': require('../../assets/abuela/pose-greeting.jpg'),
  'proud': require('../../assets/abuela/pose-proud.jpg'),
  'delighted': require('../../assets/abuela/pose-delighted.jpg'),
  'sympathetic': require('../../assets/abuela/pose-sympathetic.jpg'),
  'home': require('../../assets/abuela/still-home.jpg'),
};

export function abuelaReel(lang: AbuelaLang): number | undefined {
  return ABUELA_REELS[lang];
}

/** Which beat is on screen at this point in the reel. 1-based. */
export function beatAt(lang: AbuelaLang, seconds: number): 1 | 2 | 3 {
  const marks = ABUELA_MARKS[lang] ?? [0];
  let beat = 1;
  for (let i = 1; i < marks.length; i += 1) if (seconds >= marks[i]) beat = i + 1;
  return beat as 1 | 2 | 3;
}
