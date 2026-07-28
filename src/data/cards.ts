import type { Card } from '../types';

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
export const CARDS: Card[] = [
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
  { id: 'el_pajaro', name: 'El Pájaro', number: 20, emoji: '🐦' },
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
