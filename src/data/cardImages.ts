/**
 * Card art registry.
 *
 * Every card — the 54 Lotería classics AND the expansion — now has photoreal
 * "baked" art: the subject on a warm golden-amber backdrop with the Spanish
 * name painted into a vintage Lotería banner. All of it is self-hosted on
 * Supabase (public `cards` bucket) at the deterministic path
 * `cards/<id>.webp`, so the app just streams one consistent image per card.
 *
 * Because the name is IN the image, CardTile does not draw its own name plate
 * over these (see `isBakedCard`) — except as an offline fallback, when the
 * image can't load and CardTile shows the emoji glyph + plate instead.
 *
 * OFFLINE: the streamed art needs a connection. For a future true-offline
 * build, download the base 54 into `assets/cards/<id>.webp` and special-case
 * them to `require()` here; the rest stay streamed.
 */
const CARDS_CDN = 'https://bmybvrqbpachjxrejxdj.supabase.co/storage/v1/object/public/cards';

/** Deterministic baked-art URL for a card. Every card id has one. */
export function cardImage(id: string): number | string | undefined {
  return `${CARDS_CDN}/${id}.webp`;
}

/**
 * True when the card's art has the Spanish name baked into it — which is now
 * every card. CardTile uses this to suppress its overlaid name plate so the
 * label isn't shown twice.
 */
export function isBakedCard(_id: string): boolean {
  return true;
}

/**
 * A server-resized thumbnail of a card, for the small places (menu icons,
 * solved-group strips) where pulling the full 1792x2400 art would waste a lot
 * of cellular data. Supabase's image transform endpoint needs BOTH dimensions
 * — width alone leaves the height untouched and distorts the image.
 *
 * Pass the rendered size in points; we request 2x for crisp retina output.
 */
export function cardThumb(id: string, width: number, height: number): string {
  const w = Math.round(width * 2);
  const h = Math.round(height * 2);
  return `${CARDS_CDN.replace('/object/public/cards', '/render/image/public/cards')}/${id}.webp?width=${w}&height=${h}&resize=cover&quality=72`;
}
