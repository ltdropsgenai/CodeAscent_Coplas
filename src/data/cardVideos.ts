import { CARDS, CARD_BY_ID } from './cards';

/**
 * Animated card clips.
 *
 * **The entire deck is animated.** All 997 cards have a 3-second "living
 * portrait" clip in the Supabase `video` bucket, verified by comparing a hash
 * of the bucket's object names against a hash of the deck's card ids — they
 * match exactly, with no extras and nothing missing. So this module no longer
 * carries a hand-maintained allow-list; it derives everything from the deck,
 * which means adding a card and its clip can never leave the two out of sync in
 * one direction only.
 *
 * Clips are ~1.3 MB each (1.26 GB total). That is the number to watch: egress,
 * not storage. Anything that plays many at once should cap how many — see
 * `MAX_ANIMATED_TILES` in WinCelebration.
 *
 * Every consumer must degrade to the still image when a clip won't load
 * (CardVideo already renders the still underneath as a poster), so a bad
 * network or a future card without a clip is a non-event.
 */
const VIDEO_CDN =
  'https://bmybvrqbpachjxrejxdj.supabase.co/storage/v1/object/public/video';

/** Every card id, in deck order. Used where we want to pick an animated card. */
export const ANIMATED_CARD_IDS: string[] = CARDS.map((c) => c.id);

export const ANIMATED_COUNT = ANIMATED_CARD_IDS.length;

/**
 * Does this card have a clip? True for any id in the deck — the check is on
 * deck membership rather than a separate list precisely so the two can't drift.
 */
export function hasCardVideo(id: string): boolean {
  return CARD_BY_ID[id] !== undefined;
}

/** Public URL of a card's clip, or undefined if the id isn't in the deck. */
export function cardVideo(id: string): string | undefined {
  return hasCardVideo(id) ? `${VIDEO_CDN}/${id}.mp4` : undefined;
}
