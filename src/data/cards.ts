import type { Card } from '../types';
import EXPANSION_RAW from './expansion.cards.json';

/**
 * The 54 archetypes of the classic Mexican Lotería deck.
 *
 * NOTE ON CARD 26: the traditional deck's card #26 has a name that is
 * offensive by modern standards. It is replaced here with "El Charro"
 * (a culturally fitting Mexican horseman). Finalize all card naming with
 * a cultural review before launch.
 *
 * `emoji` is a placeholder glyph so the board is legible before the
 * commissioned artwork exists. Real art will replace these via an
 * `image` field on the Card + <CardTile>.
 */
export const BASE_CARDS: Card[] = [
  { id: 'el_gallo', name: 'El Gallo', number: 1, emoji: '🐓' },
  { id: 'el_diablito', name: 'El Diablito', number: 2, emoji: '😈' },
  { id: 'la_dama', name: 'La Dama', number: 3, emoji: '👩' },
  { id: 'el_catrin', name: 'El Catrín', number: 4, emoji: '🎩' },
  { id: 'el_paraguas', name: 'El Paraguas', number: 5, emoji: '☂️' },
  { id: 'la_sirena', name: 'La Sirena', number: 6, emoji: '🧜‍♀️' },
  { id: 'la_escalera', name: 'La Escalera', number: 7, emoji: '🪜' },
  { id: 'la_botella', name: 'La Botella', number: 8, emoji: '🍾' },
  { id: 'el_barril', name: 'El Barril', number: 9, emoji: '🛢️' },
  { id: 'el_arbol', name: 'El Árbol', number: 10, emoji: '🌳' },
  { id: 'el_melon', name: 'El Melón', number: 11, emoji: '🍈' },
  { id: 'el_valiente', name: 'El Valiente', number: 12, emoji: '🗡️' },
  { id: 'el_gorrito', name: 'El Gorrito', number: 13, emoji: '🧢' },
  { id: 'la_muerte', name: 'La Muerte', number: 14, emoji: '💀' },
  { id: 'la_pera', name: 'La Pera', number: 15, emoji: '🍐' },
  { id: 'la_bandera', name: 'La Bandera', number: 16, emoji: '🇲🇽' },
  { id: 'el_bandolon', name: 'El Bandolón', number: 17, emoji: '🪕' },
  { id: 'el_violoncello', name: 'El Violoncello', number: 18, emoji: '🎻' },
  { id: 'la_garza', name: 'La Garza', number: 19, emoji: '🦩' },
  { id: 'el_pajaro', name: 'El Águila', number: 20, emoji: '🦅' },
  { id: 'la_mano', name: 'La Mano', number: 21, emoji: '✋' },
  { id: 'la_bota', name: 'La Bota', number: 22, emoji: '👢' },
  { id: 'la_luna', name: 'La Luna', number: 23, emoji: '🌙' },
  { id: 'el_cotorro', name: 'El Cotorro', number: 24, emoji: '🦜' },
  { id: 'el_borracho', name: 'El Borracho', number: 25, emoji: '🍺' },
  { id: 'el_charro', name: 'El Charro', number: 26, emoji: '🤠' },
  { id: 'el_corazon', name: 'El Corazón', number: 27, emoji: '❤️' },
  { id: 'la_sandia', name: 'La Sandía', number: 28, emoji: '🍉' },
  { id: 'el_tambor', name: 'El Tambor', number: 29, emoji: '🥁' },
  { id: 'el_camaron', name: 'El Camarón', number: 30, emoji: '🦐' },
  { id: 'las_jaras', name: 'Las Jaras', number: 31, emoji: '🏹' },
  { id: 'el_musico', name: 'El Músico', number: 32, emoji: '🎼' },
  { id: 'la_arana', name: 'La Araña', number: 33, emoji: '🕷️' },
  { id: 'el_soldado', name: 'El Soldado', number: 34, emoji: '💂' },
  { id: 'la_estrella', name: 'La Estrella', number: 35, emoji: '⭐' },
  { id: 'el_cazo', name: 'El Cazo', number: 36, emoji: '🍲' },
  { id: 'el_mundo', name: 'El Mundo', number: 37, emoji: '🌎' },
  { id: 'el_apache', name: 'El Apache', number: 38, emoji: '🪶' },
  { id: 'el_nopal', name: 'El Nopal', number: 39, emoji: '🌵' },
  { id: 'el_alacran', name: 'El Alacrán', number: 40, emoji: '🦂' },
  { id: 'la_rosa', name: 'La Rosa', number: 41, emoji: '🌹' },
  { id: 'la_calavera', name: 'La Calavera', number: 42, emoji: '☠️' },
  { id: 'la_campana', name: 'La Campana', number: 43, emoji: '🔔' },
  { id: 'el_cantarito', name: 'El Cantarito', number: 44, emoji: '🏺' },
  { id: 'el_venado', name: 'El Venado', number: 45, emoji: '🦌' },
  { id: 'el_sol', name: 'El Sol', number: 46, emoji: '☀️' },
  { id: 'la_corona', name: 'La Corona', number: 47, emoji: '👑' },
  { id: 'la_chalupa', name: 'La Chalupa', number: 48, emoji: '🛶' },
  { id: 'el_pino', name: 'El Pino', number: 49, emoji: '🌲' },
  { id: 'el_pescado', name: 'El Pescado', number: 50, emoji: '🐟' },
  { id: 'la_palma', name: 'La Palma', number: 51, emoji: '🌴' },
  { id: 'la_maceta', name: 'La Maceta', number: 52, emoji: '🪴' },
  { id: 'el_arpa', name: 'El Arpa', number: 53, emoji: '🎵' },
  { id: 'la_rana', name: 'La Rana', number: 54, emoji: '🐸' },
];

/**
 * The expanded deck (ids 55+), generated in the "Coplas" family taxonomy and
 * self-hosted on Supabase with the Spanish name baked into each card's art.
 * ~30 slugs coincide with a base archetype (el_corazon, la_luna, …); for those
 * the BASE card stays canonical (keeps its traditional 1-54 number, its
 * preview image and its on-card name plate), and the duplicate expansion entry
 * is dropped here — so every id is unique. The remaining ~943 are brand-new
 * cards that stream their baked art online (see data/cardImages + net/deckOnline).
 */
const BASE_IDS = new Set(BASE_CARDS.map((c) => c.id));
export const EXPANSION_CARDS: Card[] = (EXPANSION_RAW as Card[]).filter(
  (c) => !BASE_IDS.has(c.id)
);

/**
 * The full in-memory deck: the 54 classics plus every new expansion card.
 * Card *metadata* is always present (it is tiny, bundled JSON); whether a given
 * expansion card can actually appear in a round is gated on connectivity by the
 * composer (offline → base 54 only, online → full deck).
 */
export const CARDS: Card[] = [...BASE_CARDS, ...EXPANSION_CARDS];

/** Fast lookup by id. */
export const CARD_BY_ID: Record<string, Card> = CARDS.reduce(
  (acc, c) => {
    acc[c.id] = c;
    return acc;
  },
  {} as Record<string, Card>
);

export function getCard(id: string): Card {
  const c = CARD_BY_ID[id];
  if (!c) throw new Error(`Unknown card id: ${id}`);
  return c;
}
