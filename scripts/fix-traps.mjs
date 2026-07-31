#!/usr/bin/env node
/**
 * Two gameplay bugs, both invisible to every check that existed.
 *
 * ── 1. COLOUR AND SHAPE TRAPS WERE AMBIGUOUS ON MOST BOARDS ─────────────────
 *
 * A colour/shape trap ("Cosas doradas", "Cosas redondas") has no structural
 * rule the composer can verify, so its `exclude` list is the ONLY thing
 * stopping a second matching card landing on the same 16-card board. Those
 * lists were authored when the deck was 54 cards, and every entry in them is
 * a base-54 card.
 *
 * The deck is now ~996. Traps still come only from the base library, but the
 * other three groups are drawn from 400+ expansion categories. So "Cosas
 * doradas" would deal Sol / Corona / Estrella / Campana and then happily let
 * La Medalla, El Anillo, La Moneda or El Trofeo land beside them — and
 * `ambiguous()` waved it through, because those cards did not exist when the
 * list was written.
 *
 * An audit of all 996 cards against each trap found 30-100 unlisted matches
 * per trap, i.e. a majority of dealt boards had no unique answer. The player
 * sees six golden things and is told to find four. That is the single worst
 * class of bug this game can have, because it is unwinnable rather than merely
 * wrong, and the player blames themselves.
 *
 * Fix: exclude lists extended to the whole deck. The composer already retries
 * up to 4000 times, so the extra rejections cost nothing.
 *
 * ── 2. TWO CARDS SHARED ONE NAME ────────────────────────────────────────────
 *
 * `el_pajaro` (base card, traditional #20) and `el_aguila` (expansion) BOTH
 * display "El Águila". Dealt to the same board they read as a duplicate card,
 * and any name-based logic — the letter traps, the copy checker — cannot tell
 * them apart.
 *
 * Fix: drop the expansion duplicate and remap its one group reference to the
 * base card, which is the canonical traditional card and carries its own art.
 *
 * Run once:  node scripts/fix-traps.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const write = (p, v) => writeFileSync(new URL(p, root), JSON.stringify(v, null, 2) + '\n', 'utf8');

// ── deck ─────────────────────────────────────────────────────────────────────
const cardsSrc = readFileSync(new URL('src/data/cards.ts', root), 'utf8');
const baseIds = new Set([...cardsSrc.matchAll(/id:\s*'([a-z0-9_]+)'/g)].map((m) => m[1]));
let expansion = read('src/data/expansion.cards.json');
const deckIds = new Set([...baseIds, ...expansion.map((c) => c.id)]);

// ── 2. de-duplicate El Águila ────────────────────────────────────────────────
const DROP = 'el_aguila';
const KEEP = 'el_pajaro';

expansion = expansion.filter((c) => c.id !== DROP);
write('src/data/expansion.cards.json', expansion);
deckIds.delete(DROP);

let images = read('src/data/expansion.cardImages.json');
if (DROP in images) {
  delete images[DROP];
  write('src/data/expansion.cardImages.json', images);
}

let remapped = 0;
for (const file of ['src/data/groups.json', 'src/data/expansion.groups.json']) {
  const lib = read(file);
  for (const g of Object.values(lib)) {
    const i = g.cards.indexOf(DROP);
    if (i === -1) continue;
    // If the group already contains the survivor, this group was a duplicate
    // in disguise; drop the dead id and leave it short so check-groups flags it
    // loudly rather than silently shipping a three-card group.
    g.cards[i] = KEEP;
    remapped += 1;
  }
  write(file, lib);
}
const puzzles = read('src/data/puzzles.json');
let puzzleRemapped = 0;
for (const p of puzzles) {
  for (const g of p.groups) {
    const i = g.cardIds.indexOf(DROP);
    if (i !== -1) {
      g.cardIds[i] = KEEP;
      puzzleRemapped += 1;
    }
  }
}
write('src/data/puzzles.json', puzzles);

// ── 1. rebuild the trap exclude lists ────────────────────────────────────────
/**
 * Every card in the deck that also satisfies each trap. Produced by auditing
 * all 996 card names against each theme. Deliberately inclusive: a false
 * positive costs one rejected candidate round out of 4000 attempts; a false
 * negative ships an unsolvable board.
 */
const EXCLUDES = {
  dorado: `el_anillo el_arete el_collar la_pulsera el_broche la_medalla la_moneda el_trofeo
    el_lingote el_cofre la_copa la_campana_escolar el_candelabro la_trompeta el_trombon
    el_saxofon los_platillos el_arpa el_trigo la_cebada el_maiz el_elote el_girasol
    el_cempasuchil el_reloj_de_bolsillo el_reloj_de_sol el_reloj_de_arena el_catalejo
    la_brujula la_llave la_balanza la_cerveza saturno la_luna`,

  rojo: `el_camaron la_fresa la_cereza el_cerezo la_frambuesa la_grosella el_capulin el_lichi
    la_ciruela la_manzana el_manzano la_manzana_acaramelada la_granada la_pitaya la_tuna
    el_jitomate el_chile el_chipotle el_habanero el_pimiento el_rabano el_betabel el_rubi
    el_coral la_anemona la_estrella_de_mar el_cangrejo la_langosta el_pez_payaso la_mariquita
    el_petirrojo la_guacamaya el_flamenco el_cerdo el_cochinito el_pulpo la_lengua el_labio
    la_boca el_cerebro el_musculo el_higado el_pulmon el_rinon el_estomago el_intestino
    el_fuego la_fogata la_antorcha el_volcan el_camion_de_bomberos el_bombero el_hidrante
    el_ladrillo el_granero el_guante_de_box la_amapola la_nochebuena el_clavel la_dalia
    el_tulipan el_loto el_jamon el_tocino la_salchicha el_filete la_costilla_bbq la_enchilada
    el_vino el_algodon_de_azucar el_chicle el_hongo el_fenix el_dragon`,

  verde: `el_arbol el_abeto el_arce el_bambu el_baobab el_bonsai el_bosque el_cactus el_cipres
    el_helecho el_manzano el_naranjo el_olivo el_roble el_sauce la_palmera la_secuoya la_selva
    la_suculenta la_pradera la_hoja la_cana la_maceta el_oasis el_pantano el_apio el_brocoli
    el_chicharo el_ejote el_esparrago el_haba el_pepino el_poro el_quelite la_alcachofa
    la_calabacita la_col la_espinaca la_lechuga el_jalapeno el_poblano el_serrano el_aguacate
    el_kiwi el_limon la_lima la_guanabana la_guayaba la_pera el_pistache el_alga la_esmeralda
    el_camaleon el_cocodrilo el_cotorro el_colibri el_grillo el_lagarto el_pulgon
    el_saltamontes el_sapo la_iguana la_mantis la_oruga la_serpiente la_tortuga`,

  blanco: `el_gorrito el_hueso el_craneo el_esqueleto el_esqueleto_de_fiesta la_costilla el_diente
    el_fosil la_catrina la_momia el_fantasma el_angel el_unicornio la_leche la_crema el_yogur
    el_queso el_huevo el_arroz el_arroz_cocido el_malvavisco el_bombon el_algodon_de_azucar
    el_ajo la_cebolla la_coliflor el_champinon la_nieve la_ventisca el_granizo el_hielo
    la_escarcha el_iceberg el_glaciar la_nube la_neblina el_humo la_paloma el_cisne el_ganso
    la_gaviota la_grulla la_ciguena el_pelicano la_oveja el_cordero el_conejo la_azucena
    el_lirio el_jazmin la_margarita la_perla el_diamante el_jabon la_pasta_de_dientes el_yeso
    la_venda la_pastilla el_inodoro el_lavabo la_tina la_almohada el_colchon la_servilleta
    el_gis la_vela la_velita el_sobre el_dado el_bolo la_pelota_de_beisbol el_balon_de_futbol`,

  redondos: `la_sandia el_melon el_circulo el_balon_de_basquetbol el_balon_de_futbol
    la_pelota_de_beisbol la_pelota_de_playa la_pelota_de_tenis la_canica el_globo
    el_globo_terraqueo el_globo_aerostatico el_yoyo el_balero el_trompo los_dardos la_moneda
    la_medalla el_anillo la_pulsera el_collar la_perla el_reloj el_reloj_de_pared
    el_reloj_de_bolsillo el_reloj_de_sol el_despertador el_cronometro la_rueda_de_la_fortuna
    el_carrusel el_timon el_salvavidas el_plato el_comal los_platillos el_tambor la_pandereta
    la_lupa el_espejo_de_mano el_pisapapeles la_tortilla la_pizza la_galleta la_dona el_pastel
    el_hotcake la_hamburguesa el_caramelo la_paleta la_naranja la_manzana la_toronja la_uva
    la_cereza el_arandano el_limon la_lima la_mandarina el_durazno el_chabacano la_ciruela
    la_granada el_coco el_membrillo la_guayaba el_nanche el_capulin la_mora la_frambuesa
    la_grosella la_zarzamora el_lichi el_jitomate la_cebolla el_rabano el_betabel la_calabaza
    la_col la_nuez la_avellana el_garbanzo el_chicharo la_lenteja el_planeta saturno
    el_meteorito la_galaxia el_ovni la_pastilla el_foco el_erizo_de_mar el_caracol el_girasol`,

  // `el_alto` is a wordplay landmine: the name literally means "tall", but the
  // card depicts a stop sign. Excluded so it can never sit next to this trap.
  altas: `la_bandera el_alto la_torre el_rascacielos el_faro la_columna el_poste el_castillo
    la_piramide la_iglesia el_puente el_molino la_grua el_teleferico la_montana_rusa
    la_rueda_de_la_fortuna el_ropero el_archivero la_litera el_semaforo la_jirafa el_avestruz
    el_flamenco la_garza la_ciguena la_grulla el_camello el_braquiosaurio la_ballena
    la_serpiente la_anguila el_ciempies el_bambu la_cana la_secuoya la_palmera el_abeto
    el_cipres el_baobab el_roble el_sauce el_arce el_cactus el_girasol la_lanza la_flecha
    las_jaras la_espada el_alambre el_cable la_cadena la_cuerda_para_saltar el_liston
    la_serpentina el_tubo la_viga el_metro la_regla el_nivel el_lapiz el_crayon el_marcador
    la_pluma el_pincel la_brocha la_escoba el_trapeador el_rastrillo la_pala el_azadon
    la_muleta el_bate el_palo_de_golf el_esqui la_tabla_de_surf el_telescopio el_catalejo
    el_termometro la_jeringa el_desarmador la_vela la_flauta el_clarinete el_trombon
    el_contrabajo el_violoncello el_arpa el_organo el_tren el_autobus el_cohete el_submarino
    la_montana el_volcan la_cascada la_catarata el_geiser el_rio la_pierna el_paraguas`,

  puntiagudos: `la_corona el_pino la_espada la_lanza la_flecha el_cuchillo el_tenedor la_aguja
    la_jeringa el_lapiz el_clavo el_tornillo el_ancla el_arpon el_tridente el_rastrillo
    el_cactus el_abeto el_cipres la_piramide el_cono el_triangulo el_diamante el_colmillo
    el_unicornio el_puercoespin el_erizo el_erizo_de_mar el_tiburon el_pez_espada
    el_estegosaurio el_triceratops el_dragon la_sierra el_serrucho el_hacha el_pico`,
};

const libs = {
  'src/data/groups.json': read('src/data/groups.json'),
};
const baseLib = libs['src/data/groups.json'];

const report = [];
for (const [key, blob] of Object.entries(EXCLUDES)) {
  const g = baseLib[key];
  if (!g) {
    report.push(`  ! no such group "${key}" — skipped`);
    continue;
  }
  const wanted = blob.split(/\s+/).map((s) => s.trim()).filter(Boolean);
  const unknown = wanted.filter((id) => !deckIds.has(id));
  const inGroup = wanted.filter((id) => g.cards.includes(id));
  const final = [...new Set(wanted.filter((id) => deckIds.has(id) && !g.cards.includes(id)))].sort();
  const before = (g.exclude ?? []).length;
  g.exclude = final;
  report.push(
    `  ${key.padEnd(12)} exclude ${String(before).padStart(3)} → ${String(final.length).padStart(3)}` +
      (unknown.length ? `   (dropped ${unknown.length} unknown: ${unknown.slice(0, 5).join(', ')}${unknown.length > 5 ? '…' : ''})` : '') +
      (inGroup.length ? `   (dropped ${inGroup.length} already in group)` : '')
  );
}
write('src/data/groups.json', baseLib);

console.log(`El Águila de-duplicated: dropped "${DROP}", remapped ${remapped} library group(s) and ${puzzleRemapped} puzzle group(s) to "${KEEP}"`);
console.log(`deck is now ${deckIds.size} cards\n`);
console.log('trap exclude lists rebuilt against the whole deck:');
console.log(report.join('\n'));
