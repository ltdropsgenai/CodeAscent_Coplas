#!/usr/bin/env node
/**
 * Content generator for the puzzle buffer.
 *
 * Composes new puzzles from a library of hand-verified "groups" (each 4 cards
 * that genuinely share a rule). Each puzzle picks 4 groups whose 16 cards are
 * disjoint. Idempotent: keeps puzzles #1–#6 (hand-authored) and regenerates
 * everything after. Run: node scripts/gen-more-puzzles.mjs && npm run validate
 *
 * This is the "AI-drafts / human-curates" pipeline from design doc §13 — edit
 * the LIB and COMPOSITIONS below, regenerate, validate.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUZZLES_PATH = join(root, 'src/data/puzzles.json');

/** Verified groups: cards + default theme + explanation. */
const LIB = {
  astros: { cards: ['el_sol', 'la_luna', 'la_estrella', 'el_mundo'], theme: 'Astros del cielo', why: 'Sol, Luna, Estrella y Mundo: cosas de allá arriba.' },
  aves: { cards: ['el_gallo', 'la_garza', 'el_pajaro', 'el_cotorro'], theme: 'Aves', why: 'Gallo, garza, pájaro y cotorro: todos tienen alas.' },
  contenedores: { cards: ['la_botella', 'el_barril', 'el_cantarito', 'el_cazo'], theme: 'Guardan líquido', why: 'Botella, barril, cantarito y cazo cargan algo líquido.' },
  macabro: { cards: ['la_muerte', 'la_calavera', 'el_diablito', 'el_alacran'], theme: 'Lo macabro', why: 'Muerte, calavera, diablito y alacrán dan escalofríos.' },
  instrum: { cards: ['el_bandolon', 'el_violoncello', 'el_tambor', 'el_arpa'], theme: 'Instrumentos musicales', why: 'Bandolón, violoncello, tambor y arpa: puro sonido.' },
  personas1: { cards: ['la_dama', 'el_catrin', 'el_valiente', 'el_soldado'], theme: 'Personajes', why: 'Dama, Catrín, Valiente y Soldado: gente de la baraja.' },
  personas2: { cards: ['el_borracho', 'el_charro', 'el_musico', 'el_apache'], theme: 'Más personajes', why: 'Borracho, Charro, Músico y Apache: también son gente.' },
  plantas: { cards: ['el_arbol', 'el_nopal', 'el_pino', 'la_palma'], theme: 'Plantas', why: 'Árbol, nopal, pino y palma salen de la tierra.' },
  flores: { cards: ['la_rosa', 'el_nopal', 'el_pino', 'la_palma'], theme: 'Cosas verdes (y una flor)', why: 'Rosa, nopal, pino y palma: del reino vegetal.' },
  mar: { cards: ['la_sirena', 'el_pescado', 'la_chalupa', 'la_rana'], theme: 'Del agua', why: 'Sirena, pescado, chalupa y rana viven o flotan en el agua.' },
  rima_era: { cards: ['la_bandera', 'la_escalera', 'la_pera', 'la_calavera'], theme: 'Riman en «-era»', why: 'Bande-ra, escale-ra, pe-ra, calave-ra.' },
  rima_on: { cards: ['el_camaron', 'el_melon', 'el_bandolon', 'el_corazon'], theme: 'Riman en «-ón»', why: 'Camar-ón, mel-ón, bandol-ón, coraz-ón.' },
  rojo: { cards: ['el_corazon', 'la_rosa', 'la_sandia', 'el_diablito'], theme: 'Cosas rojas', why: 'Corazón, rosa, sandía y diablito: puro rojo.' },
  letraM: { cards: ['la_mano', 'la_muerte', 'el_mundo', 'el_musico'], theme: 'Empiezan con «M»', why: 'Mano, Muerte, Mundo y Músico.' },
  objetos: { cards: ['el_gorrito', 'la_bota', 'la_corona', 'el_paraguas'], theme: 'Cosas que se llevan', why: 'Gorrito, bota, corona y paraguas: se cargan o se ponen.' },
  bichos: { cards: ['la_arana', 'el_alacran', 'el_camaron', 'la_rana'], theme: 'Bichos', why: 'Araña, alacrán, camarón y rana: criaturas pequeñas.' },
  fauna: { cards: ['el_venado', 'la_rana', 'el_gallo', 'la_garza'], theme: 'Animales', why: 'Venado, rana, gallo y garza.' },
};

/**
 * Each composition = 4 [groupRef, tier] pairs. Groups must be card-disjoint.
 * Trap hints appended in `note` get merged into that group's explanation.
 */
const COMPOSITIONS = [
  [['astros', 1], ['aves', 2], ['contenedores', 3], ['macabro', 4]],
  [['plantas', 1], ['personas1', 2], ['instrum', 3], ['rima_era', 4, 'La Calavera cabía en «lo macabro»… pero hoy rima.']],
  [['astros', 1], ['mar', 2], ['objetos', 3], ['personas2', 4]],
  [['aves', 1], ['plantas', 2], ['contenedores', 3], ['letraM', 4]],
  [['plantas', 1], ['mar', 2], ['rima_era', 3], ['rima_on', 4, 'El Camarón parecía del agua: la trampa.']],
  [['astros', 1], ['aves', 2], ['instrum', 3], ['rojo', 4]],
  [['contenedores', 1], ['fauna', 2], ['flores', 3], ['macabro', 4]],
  [['astros', 1], ['instrum', 2], ['mar', 3], ['objetos', 4]],
  [['aves', 1], ['plantas', 2], ['letraM', 3], ['rima_on', 4, 'El Melón parecía fruta: la trampa.']],
  [['personas1', 1], ['mar', 2], ['rima_era', 3], ['rojo', 4]],
  [['astros', 1], ['personas2', 2], ['contenedores', 3], ['bichos', 4]],
  [['aves', 1], ['plantas', 2], ['rima_era', 3], ['rima_on', 4, 'Camarón y Melón se escapan a las rimas.']],
  [['astros', 1], ['instrum', 2], ['personas1', 3], ['objetos', 4]],
  [['contenedores', 1], ['flores', 2], ['mar', 3], ['macabro', 4]],
];

function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

const all = JSON.parse(readFileSync(PUZZLES_PATH, 'utf8'));
const base = all.filter((p) => p.number <= 6).sort((a, b) => a.number - b.number);
const lastDate = base[base.length - 1].date;

const generated = COMPOSITIONS.map((comp, i) => {
  const number = 7 + i;
  const groups = comp.map(([ref, tier, note]) => {
    const g = LIB[ref];
    if (!g) throw new Error(`Unknown group ref: ${ref}`);
    return {
      theme: g.theme,
      tier,
      cardIds: g.cards,
      explanation: note ? `${g.why} ${note}` : g.why,
    };
  });
  return {
    id: `coplas-${String(number).padStart(4, '0')}`,
    number,
    date: addDays(lastDate, i + 1),
    groups,
  };
});

const out = [...base, ...generated];
writeFileSync(PUZZLES_PATH, JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote ${out.length} puzzles (${base.length} base + ${generated.length} generated).`);
