#!/usr/bin/env node
/**
 * Content generator — constraint solver.
 *
 * Auto-composes many puzzles from a large tagged library of hand-verified
 * connection groups. It GUARANTEES, for every generated puzzle:
 *   • 16 unique cards (the 4 chosen groups are card-disjoint),
 *   • no letter/rhyme trap is ambiguous (no stray card in the puzzle also
 *     satisfies the rule),
 *   • no colour/shape/hidden trap is ambiguous (uses per-group `exclude` sets),
 *   • balanced group usage (usage-capped picking) so no group dominates a
 *     difficulty pool — which keeps the runtime no-repeat sequencer feasible,
 *   • deterministic output (seeded PRNG) so re-running doesn't churn content.
 *
 * Idempotent: keeps hand-authored puzzles #1–#6 and regenerates the rest.
 * Run: node scripts/gen-more-puzzles.mjs && npm run validate
 *
 * DIFFICULTY = how many "trap" groups (rhyme/letter/colour/shape/hidden):
 *   facil = 0 traps (four plain categories)
 *   media = 1 trap
 *   dificil = 2 traps (+ the disjoint/decoy pressure that creates)
 *
 * To grow the game: add groups to LIB (and their `exclude` if colour/shape/
 * hidden), bump the TARGETS, regenerate, validate. That's it.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUZZLES_PATH = join(root, 'src/data/puzzles.json');

// ── Card names (for letter/rhyme ambiguity checks) ─────────────────────────
const cardsSrc = readFileSync(join(root, 'src/data/cards.ts'), 'utf8');
const cardName = Object.fromEntries(
  [...cardsSrc.matchAll(/id:\s*'([a-z0-9_]+)',\s*name:\s*'([^']+)'/g)].map((m) => [m[1], m[2]])
);
const stripDiacritics = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
function noun(id) {
  const parts = (cardName[id] ?? '').split(' ');
  return /^(El|La|Las|Los)$/.test(parts[0]) ? parts.slice(1).join(' ') : cardName[id] ?? '';
}
const nounInitial = (id) => stripDiacritics(noun(id)).charAt(0).toUpperCase();
const nounLower = (id) => noun(id).toLowerCase();

// ── The library ────────────────────────────────────────────────────────────
// kind: 'cat' (plain category) or a trap kind. `exclude` (colour/shape/hidden):
// cards that, if present elsewhere in the puzzle, would make the group ambiguous.
const LIB = {
  // Categories ---------------------------------------------------------------
  astros: { kind: 'cat', cards: ['el_sol', 'la_luna', 'la_estrella', 'el_mundo'], theme: 'Astros del cielo', why: 'Sol, Luna, Estrella y Mundo: cosas de allá arriba.' },
  // NOTE: id 'el_pajaro' is the deck's card #20, renamed to "El Águila" (a
  // specific bird) in cards.ts. The slug stays el_pajaro; only the display name
  // + art changed. Since its name now starts with «A», it is NOT a «P» card.
  aves: { kind: 'cat', cards: ['el_gallo', 'la_garza', 'el_pajaro', 'el_cotorro'], theme: 'Aves', why: 'Gallo, garza, águila y cotorro: aves de la baraja.' },
  instrum: { kind: 'cat', cards: ['el_bandolon', 'el_violoncello', 'el_tambor', 'el_arpa'], theme: 'Instrumentos musicales', why: 'Bandolón, violoncello, tambor y arpa: puro sonido.' },
  contenedores: { kind: 'cat', cards: ['la_botella', 'el_barril', 'el_cantarito', 'el_cazo'], theme: 'Guardan líquido', why: 'Botella, barril, cantarito y cazo cargan algo líquido.' },
  macabro: { kind: 'cat', cards: ['la_muerte', 'la_calavera', 'el_diablito', 'el_alacran'], theme: 'Lo macabro', why: 'Muerte, calavera, diablito y alacrán dan escalofríos.' },
  personas1: { kind: 'cat', cards: ['la_dama', 'el_catrin', 'el_valiente', 'el_soldado'], theme: 'Personajes', why: 'Dama, Catrín, Valiente y Soldado: gente de la baraja.' },
  personas2: { kind: 'cat', cards: ['el_borracho', 'el_charro', 'el_musico', 'el_apache'], theme: 'Más personajes', why: 'Borracho, Charro, Músico y Apache: también son gente.' },
  personas3: { kind: 'cat', cards: ['la_dama', 'el_catrin', 'el_borracho', 'el_musico'], theme: 'Pura gente', why: 'Dama, Catrín, Borracho y Músico: personajes de la baraja.' },
  arboles: { kind: 'cat', cards: ['el_arbol', 'el_pino', 'la_palma', 'el_nopal'], theme: 'Árboles y plantas', why: 'Árbol, pino, palma y nopal salen de la tierra.' },
  agua: { kind: 'cat', cards: ['la_sirena', 'el_pescado', 'la_chalupa', 'la_rana'], theme: 'Del agua', why: 'Sirena, pescado, chalupa y rana viven o flotan en el agua.' },
  objetos: { kind: 'cat', cards: ['el_gorrito', 'la_bota', 'la_corona', 'el_paraguas'], theme: 'Cosas que se llevan', why: 'Gorrito, bota, corona y paraguas: se cargan o se ponen.' },
  fauna: { kind: 'cat', cards: ['el_venado', 'la_rana', 'el_gallo', 'la_garza'], theme: 'Animales', why: 'Venado, rana, gallo y garza.' },
  delmar: { kind: 'cat', cards: ['la_sirena', 'el_pescado', 'el_camaron', 'la_chalupa'], theme: 'Del mar', why: 'Sirena, pescado, camarón y chalupa: cosas del mar.' },
  combate: { kind: 'cat', cards: ['las_jaras', 'el_soldado', 'el_apache', 'el_valiente'], theme: 'Del combate', why: 'Jaras, Soldado, Apache y Valiente: cosas de pelea.' },
  armados: { kind: 'cat', cards: ['el_valiente', 'el_soldado', 'el_apache', 'el_charro'], theme: 'Andan armados', why: 'Valiente, Soldado, Apache y Charro: gente de armas.' },
  frutas: { kind: 'cat', cards: ['el_melon', 'la_pera', 'la_sandia', 'el_nopal'], theme: 'Se comen', why: 'Melón, pera, sandía y nopal: al plato.' },
  bichos: { kind: 'cat', cards: ['la_arana', 'el_alacran', 'el_camaron', 'la_rana'], theme: 'Bichos', why: 'Araña, alacrán, camarón y rana: criaturas pequeñas.' },
  sonido: { kind: 'cat', cards: ['la_campana', 'el_tambor', 'el_arpa', 'el_bandolon'], theme: 'Hacen sonido', why: 'Campana, tambor, arpa y bandolón suenan.' },
  casa: { kind: 'cat', cards: ['la_maceta', 'el_cazo', 'el_cantarito', 'la_campana'], theme: 'En el patio', why: 'Maceta, cazo, cantarito y campana: cosas de la casa.' },
  jardin: { kind: 'cat', cards: ['la_rosa', 'la_maceta', 'el_nopal', 'el_arbol'], theme: 'Del jardín', why: 'Rosa, maceta, nopal y árbol: puro verdor.' },
  rancho: { kind: 'cat', cards: ['el_charro', 'el_gallo', 'el_nopal', 'el_venado'], theme: 'Del rancho', why: 'Charro, gallo, nopal y venado: cosas del campo.' },

  // Shape / physical (trap) --------------------------------------------------
  redondos: { kind: 'shape', cards: ['el_sol', 'la_luna', 'el_mundo', 'la_corona'], theme: 'Cosas redondas', why: 'Sol, Luna, Mundo y Corona: forma redonda.', exclude: ['la_sandia', 'el_melon'] },
  altas: { kind: 'shape', cards: ['la_escalera', 'la_palma', 'el_pino', 'el_arbol'], theme: 'Altas y largas', why: 'Escalera, palma, pino y árbol se estiran hacia arriba.', exclude: ['la_bandera'] },
  puntiagudos: { kind: 'shape', cards: ['el_nopal', 'el_alacran', 'las_jaras', 'la_estrella'], theme: 'Con picos y puntas', why: 'Nopal, alacrán, jaras y estrella: puro pico y punta.', exclude: ['la_corona', 'el_pino'] },

  // Colour (trap) ------------------------------------------------------------
  rojo: { kind: 'color', cards: ['el_corazon', 'la_rosa', 'la_sandia', 'el_diablito'], theme: 'Cosas rojas', why: 'Corazón, rosa, sandía y diablito: puro rojo.', exclude: ['el_camaron'] },
  rojo2: { kind: 'color', cards: ['el_corazon', 'la_rosa', 'la_sandia', 'el_camaron'], theme: 'Rojos y rosas', why: 'Corazón, rosa, sandía y camarón: tonos rojizos.', exclude: ['el_diablito'] },
  verde: { kind: 'color', cards: ['el_nopal', 'el_pino', 'la_palma', 'la_rana'], theme: 'Cosas verdes', why: 'Nopal, pino, palma y rana: verdes todas.', exclude: ['el_arbol'] },
  dorado: { kind: 'color', cards: ['el_sol', 'la_corona', 'la_estrella', 'la_campana'], theme: 'Cosas doradas', why: 'Sol, corona, estrella y campana: brillan en dorado.', exclude: [] },
  blanco: { kind: 'color', cards: ['la_calavera', 'la_garza', 'la_luna', 'la_muerte'], theme: 'Cosas blancas', why: 'Calavera, garza, luna y muerte: pálidas, casi blancas.', exclude: ['el_gorrito'] },

  // Rhyme (trap; unambiguous by construction) --------------------------------
  rima_era: { kind: 'rhyme', cards: ['la_bandera', 'la_escalera', 'la_pera', 'la_calavera'], theme: 'Riman en «-era»', why: 'Bande-ra, escale-ra, pe-ra, calave-ra.' },
  rima_on: { kind: 'rhyme', cards: ['el_camaron', 'el_melon', 'el_bandolon', 'el_corazon'], theme: 'Riman en «-ón»', why: 'Camar-ón, mel-ón, bandol-ón, coraz-ón.' },

  // Letter-start (trap; validator + solver enforce no stray same-letter card) -
  letraA: { kind: 'letter', cards: ['el_arbol', 'la_arana', 'el_alacran', 'el_apache'], theme: 'Empiezan con «A»', why: 'Árbol, Araña, Alacrán y Apache.' },
  letraB: { kind: 'letter', cards: ['la_botella', 'el_barril', 'la_bota', 'el_borracho'], theme: 'Empiezan con «B»', why: 'Botella, Barril, Bota y Borracho.' },
  letraB2: { kind: 'letter', cards: ['la_bandera', 'el_bandolon', 'el_barril', 'la_bota'], theme: 'Empiezan con «B»', why: 'Bandera, Bandolón, Barril y Bota.' },
  letraM: { kind: 'letter', cards: ['la_mano', 'la_muerte', 'el_mundo', 'el_musico'], theme: 'Empiezan con «M»', why: 'Mano, Muerte, Mundo y Músico.' },
  letraM2: { kind: 'letter', cards: ['el_melon', 'la_maceta', 'la_muerte', 'la_mano'], theme: 'Empiezan con «M»', why: 'Melón, Maceta, Muerte y Mano.' },
  letraP: { kind: 'letter', cards: ['el_paraguas', 'la_pera', 'el_pino', 'el_pescado'], theme: 'Empiezan con «P»', why: 'Paraguas, Pera, Pino y Pescado.' },
  letraS: { kind: 'letter', cards: ['la_sirena', 'el_sol', 'la_sandia', 'el_soldado'], theme: 'Empiezan con «S»', why: 'Sirena, Sol, Sandía y Soldado.' },

  // Hidden word (trap) -------------------------------------------------------
  esconden: { kind: 'hidden', cards: ['el_soldado', 'la_sandia', 'el_camaron', 'la_corona'], theme: 'Esconden otra palabra', why: 'Soldado esconde «sol», Sandía «día», Camarón «mar», Corona «ron».', exclude: ['la_campana', 'la_rosa', 'la_calavera', 'el_corazon', 'el_cantarito'] },
  esconden2: { kind: 'hidden', cards: ['la_calavera', 'la_rosa', 'la_corona', 'la_campana'], theme: 'Esconden otra palabra', why: 'Calavera esconde «ave», Rosa «osa», Corona «oro», Campana «pan».', exclude: ['el_soldado', 'la_sandia', 'el_camaron', 'el_corazon', 'el_cantarito', 'la_mano'] },
};

const ALL = Object.keys(LIB);
const CATS = ALL.filter((r) => LIB[r].kind === 'cat');
const TRAPS = ALL.filter((r) => LIB[r].kind !== 'cat');

// ── Deterministic PRNG (mulberry32) ────────────────────────────────────────
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260728);
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Constraint helpers ─────────────────────────────────────────────────────
// Pure random order, but never exceed the usage `cap` for any group — this
// explores the large valid space while keeping group usage balanced.
function pickDisjoint(pool, k, usedCards, usage, cap) {
  const order = shuffle(pool);
  const chosen = [];
  const cards = new Set(usedCards);
  for (const r of order) {
    if (chosen.length === k) break;
    if ((usage[r] || 0) >= cap) continue;
    if (LIB[r].cards.some((c) => cards.has(c))) continue;
    chosen.push(r);
    for (const c of LIB[r].cards) cards.add(c);
  }
  return chosen.length === k ? chosen : null;
}

function ambiguous(refs) {
  const cards = refs.flatMap((r) => LIB[r].cards);
  for (const r of refs) {
    const g = LIB[r];
    if (g.kind === 'letter') {
      const L = g.theme.match(/«(.)»/u)[1].toUpperCase();
      if (cards.filter((c) => nounInitial(c) === L).length !== 4) return true;
    } else if (g.kind === 'rhyme') {
      const suf = g.theme.match(/«-(.+?)»/u)[1].toLowerCase();
      if (cards.filter((c) => nounLower(c).endsWith(suf)).length !== 4) return true;
    } else if (g.exclude && g.exclude.length) {
      const others = cards.filter((c) => !g.cards.includes(c));
      if (others.some((c) => g.exclude.includes(c))) return true;
    }
  }
  return false;
}

function buildPool(nTraps, target, usage, seenGlobal) {
  const nCats = 4 - nTraps;
  const out = [];
  const seen = new Set();
  // Start with a tight usage cap for even distribution; loosen only if stuck.
  let cap = 2;
  let sinceAccept = 0;
  let attempts = 0;
  const MAX = target * 20000;
  while (out.length < target && attempts < MAX) {
    attempts++;
    sinceAccept++;
    if (sinceAccept > 1500) {
      cap++;
      sinceAccept = 0;
    }
    const traps = nTraps ? pickDisjoint(TRAPS, nTraps, [], usage, cap) : [];
    if (nTraps && !traps) continue;
    const cats = pickDisjoint(CATS, nCats, traps.flatMap((r) => LIB[r].cards), usage, cap);
    if (!cats) continue;
    const refs = [...cats, ...traps]; // cats first → low tiers; traps last → high tiers
    if (ambiguous(refs)) continue;
    const key = [...refs].sort().join('+');
    if (seen.has(key) || seenGlobal.has(key)) continue;
    seen.add(key);
    seenGlobal.add(key);
    out.push(refs);
    sinceAccept = 0;
    for (const r of refs) usage[r] = (usage[r] || 0) + 1;
  }
  const freq = {};
  for (const refs of out) for (const r of refs) freq[r] = (freq[r] || 0) + 1;
  const maxFreq = Math.max(0, ...Object.values(freq));
  if (out.length < target) console.warn(`  ⚠ only reached ${out.length}/${target} (traps=${nTraps}).`);
  console.log(`  traps=${nTraps}: ${out.length} puzzles, final cap ${cap}, max group use ${maxFreq}`);
  return out;
}

// ── Assemble puzzles ───────────────────────────────────────────────────────
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const all = JSON.parse(readFileSync(PUZZLES_PATH, 'utf8'));
const base = all
  .filter((p) => p.number <= 6)
  .sort((a, b) => a.number - b.number)
  .map((p) => ({ ...p, difficulty: p.difficulty ?? 'media' }));
const lastDate = base[base.length - 1].date;

// Pre-seed MEDIA usage with base puzzles so the solver doesn't pile more onto
// groups the hand-authored intro puzzles already lean on.
const keyToRef = {};
for (const r of ALL) keyToRef[[...LIB[r].cards].sort().join('|')] = r;
const mediaUsage = {};
for (const p of base) {
  for (const g of p.groups) {
    const ref = keyToRef[[...g.cardIds].sort().join('|')];
    if (ref) mediaUsage[ref] = (mediaUsage[ref] || 0) + 1;
  }
}

const TARGETS = { facil: 30, media: 40, dificil: 34 };
const seenGlobal = new Set();

console.log('Generating…');
const facil = buildPool(0, TARGETS.facil, {}, seenGlobal);
const media = buildPool(1, TARGETS.media, mediaUsage, seenGlobal);
const dificil = buildPool(2, TARGETS.dificil, {}, seenGlobal);

const plan = [
  ...facil.map((refs) => ({ d: 'facil', refs })),
  ...media.map((refs) => ({ d: 'media', refs })),
  ...dificil.map((refs) => ({ d: 'dificil', refs })),
];

const generated = plan.map(({ d, refs }, i) => {
  const number = 7 + i;
  const groups = refs.map((ref, idx) => ({
    theme: LIB[ref].theme,
    tier: idx + 1, // cats first (1..), traps last (…4)
    cardIds: LIB[ref].cards,
    explanation: LIB[ref].why,
  }));
  return {
    id: `coplas-${String(number).padStart(4, '0')}`,
    number,
    date: addDays(lastDate, i + 1),
    difficulty: d,
    groups,
  };
});

const out = [...base, ...generated];
writeFileSync(PUZZLES_PATH, JSON.stringify(out, null, 2) + '\n');

// Publish the group library so the app can compose fresh continuous-play rounds
// at runtime (src/game/composer.ts) — single source of truth with this file.
writeFileSync(join(root, 'src/data/groups.json'), JSON.stringify(LIB, null, 2) + '\n');

const counts = out.reduce((a, p) => ((a[p.difficulty] = (a[p.difficulty] || 0) + 1), a), {});
console.log(`Wrote ${out.length} puzzles (${base.length} base + ${generated.length} generated).`);
console.log('By difficulty:', counts);
console.log('Distinct groups in library:', ALL.length, `(cats ${CATS.length}, traps ${TRAPS.length})`);
