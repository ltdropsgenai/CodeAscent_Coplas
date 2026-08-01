#!/usr/bin/env node
/**
 * Proposes new TRAP groups by mining the deck for wordplay.
 *
 *     node scripts/gen-traps.mjs            # print candidates
 *     node scripts/gen-traps.mjs --write    # write them into the deck + EN overlay
 *
 * WHY. The trap tier ran on nineteen groups, every one written for the original
 * 54-card deck; the 385-group expansion added none, and `trapsPool()` in
 * composer.ts was hard-coded to the base library so it could not have used them
 * if they had. With one trap per round at media and two at difícil, a player met
 * «Empiezan con B» five times in seventeen rounds. Nineteen was never a design
 * decision — it was what got built and then never revisited when the deck grew
 * twentyfold.
 *
 * The three mechanics the existing traps use are all DERIVABLE from the card
 * names, which is the point: with 995 names there is far more of each than
 * anyone would write by hand.
 *
 *   rhyme         names ending in the same sound   (Riman en «-era»)
 *   letter        names starting with the same one  (Empiezan con «B»)
 *   hidden        a name containing another card    (Esconden otra palabra)
 *
 * WHAT MAKES A TRAP A TRAP, and the constraints that encode it. A trap works
 * because the four cards look like they belong to unrelated categories until
 * you notice the wordplay. Everything below exists because the first run
 * produced a board that failed one of them:
 *
 *   fourFamilies    four different families. Three let «Brócoli · Berenjena»
 *                   share `verduras` — a real pair the player can see, which
 *                   turns a trap into a half-solved category.
 *   noContainment   no name inside another. Alphabetically adjacent picks gave
 *                   «El Hacha · El Hacha de Campo», «La Uva · La Uva Pasa».
 *   notNearIdentical  no two final words within two edits. «El Naranjo · La
 *                   Naranja» and «El Bolillo · El Reloj de Bolsillo» both read
 *                   as a typo rather than as wordplay.
 *   interiorHidden  the hidden word may not be a whole word of the name.
 *                   «El Espejo de Mano» does not *hide* «mano», it says it.
 *
 * AND THE ONE THAT IS NOT ABOUT TASTE. The composer rejects a round where a
 * trap is ambiguous, using its own predicate over the RAW accented noun:
 * `noun.toLowerCase().endsWith(suffix)`. This generator works on
 * diacritic-stripped text, so a key mined as «-aron» would never match
 * «Camarón» — the group would be rejected in every single draw and ship as
 * content no player ever sees. `agreesWithComposer()` re-tests every proposal
 * with the composer's own rule before it is allowed out.
 *
 * Output is a PROPOSAL. Read it before writing: the generator can tell that
 * four names rhyme, not whether the rhyme is satisfying.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const GROUPS_P = join(root, 'src/data/expansion.groups.json');
const EN_P = join(root, 'src/data/groupText.en.json');

const raw = JSON.parse(readFileSync(join(root, 'src/data/expansion.cards.json'), 'utf8'));
const list = Array.isArray(raw) ? raw : (raw.cards ?? Object.values(raw));
const cards = list.filter((c) => c && c.id && c.name);

const expGroups = JSON.parse(readFileSync(GROUPS_P, 'utf8'));
const baseGroups = JSON.parse(readFileSync(join(root, 'src/data/groups.json'), 'utf8'));
const LIB = { ...baseGroups, ...expGroups };

/** Card sets already in the library — check-groups warns on a duplicate. */
const TAKEN = new Set(Object.values(LIB).map((g) => [...(g.cards ?? [])].sort().join('|')));

const deaccent = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Name minus its leading article, RAW — accents intact. Mirrors composer `noun()`. */
const noun = (name) => name.replace(/^(El|La|Los|Las)\s+/u, '');
/** …and the flattened form used for mining. */
const strip = (s) => deaccent(noun(s)).toLowerCase().replace(/[^a-z ]/g, '');
const fam = (c) => c.family ?? '?';

// ── constraints ──────────────────────────────────────────────────────────────

/** A trap needs cards that look unrelated. Four families, one each. */
const fourFamilies = (four) => new Set(four.map(fam)).size === 4;

function noContainment(four) {
  const n = four.map((c) => strip(c.name).replace(/ /g, ''));
  for (let i = 0; i < n.length; i += 1)
    for (let j = 0; j < n.length; j += 1) if (i !== j && n[i].includes(n[j])) return false;
  return true;
}

function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j += 1) d[0][j] = j;
  for (let i = 1; i <= a.length; i += 1)
    for (let j = 1; j <= b.length; j += 1)
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
  return d[a.length][b.length];
}

function notNearIdentical(four) {
  const last = four.map((c) => strip(c.name).split(' ').pop());
  for (let i = 0; i < 4; i += 1)
    for (let j = i + 1; j < 4; j += 1) if (editDistance(last[i], last[j]) <= 2) return false;
  return true;
}

/**
 * Re-test a proposal with the composer's OWN predicate, on the raw accented
 * noun. See the header: a key mined from stripped text can be unmatchable on
 * the real string, and the failure mode is silent dead content.
 */
/**
 * Reject a rhyme key that cuts a Spanish digraph in half.
 *
 * The key is mined as the last four letters, which is a rule about spelling,
 * and Spanish rhyme is about sound. «-leta» matched galleta, servilleta,
 * muleta and violeta — but the first two are ga-LLE-ta and servi-LLE-ta with
 * /ʎ/, the last two mu-LE-ta and vio-LE-ta with /l/. Those do not rhyme; the
 * key only found them by slicing «ll» down the middle, and the reveal line
 * printed the evidence as «servil-leta», which reads as a typo.
 *
 * Same trap for «rr» (pe-rro / pe-ro) and «ch». Not «qu»: «etiq-ueta» splits a
 * digraph too, but /k/ is /k/ either side and all four members split it the
 * same way, so the rhyme is real and only the hyphen looks odd.
 */
function splitsDigraph(word, key) {
  const before = word[word.length - key.length - 1];
  if (!before) return false;
  if ((key[0] === 'l' || key[0] === 'r') && before === key[0]) return true;
  return key[0] === 'h' && before === 'c';
}

function agreesWithComposer(kind, key, four) {
  if (kind === 'rhyme')
    return four.every((c) => {
      const n = noun(c.name).toLowerCase();
      return n.endsWith(key) && !splitsDigraph(n, key);
    });
  if (kind === 'letter')
    return four.every((c) => deaccent(noun(c.name)).charAt(0).toUpperCase() === key.toUpperCase());
  return true;
}

/**
 * Deterministic pick, SPREAD across the pool rather than taken as a run.
 * Consecutive slices of a sorted pool cluster names sharing a prefix —
 * Caballete, Caballito, Caballo, Cabello — which is where the containment
 * problem came from. Striding produces four cards that share only the property
 * being tested, which is the whole point of a trap.
 */
function combos(pool, want, kind, key) {
  const out = [];
  const sorted = [...pool].sort((a, b) => a.id.localeCompare(b.id));
  const stride = Math.max(1, Math.floor(sorted.length / 4));
  for (let off = 0; off < sorted.length && out.length < want; off += 1) {
    const four = [0, 1, 2, 3].map((k) => sorted[(off + k * stride) % sorted.length]);
    if (new Set(four.map((c) => c?.id)).size !== 4) continue;
    if (TAKEN.has(four.map((c) => c.id).sort().join('|'))) continue;
    if (!fourFamilies(four) || !noContainment(four) || !notNearIdentical(four)) continue;
    if (!agreesWithComposer(kind, key, four)) continue;
    if (out.some((prev) => prev.some((c) => four.includes(c)))) continue; // spread the deck
    out.push(four);
  }
  return out;
}

const WANT_PER_KEY = 3;
const proposals = [];

// ── 1. rhyme ─────────────────────────────────────────────────────────────────
// Last four letters of the final word. Crude, but Spanish rhyme is largely
// suffix-driven, and agreesWithComposer() plus the human review step catch the
// near-misses.
const byRhyme = new Map();
for (const c of cards) {
  const w = strip(c.name).split(' ').pop() ?? '';
  if (w.length < 5) continue;
  const key = w.slice(-4);
  // Filter at the POOL, not just at the group: dropping galleta from «-leta»
  // still leaves muleta and violeta available to pair with something that
  // genuinely rhymes, whereas rejecting the whole foursome would have thrown
  // the good members away with the bad one.
  if (splitsDigraph(w, key)) continue;
  if (!byRhyme.has(key)) byRhyme.set(key, []);
  byRhyme.get(key).push(c);
}
for (const [key, pool] of [...byRhyme].sort()) {
  if (pool.length < 4) continue;
  for (const four of combos(pool, WANT_PER_KEY, 'rhyme', key))
    proposals.push({ kind: 'rhyme', key, theme: `Riman en «-${key}»`, four });
}

// ── 2. initial letter ────────────────────────────────────────────────────────
const byLetter = new Map();
for (const c of cards) {
  const l = strip(c.name)[0];
  if (!l) continue;
  if (!byLetter.has(l)) byLetter.set(l, []);
  byLetter.get(l).push(c);
}
for (const [l, pool] of [...byLetter].sort()) {
  if (pool.length < 4) continue;
  for (const four of combos(pool, WANT_PER_KEY, 'letter', l))
    proposals.push({
      kind: 'letter',
      key: l,
      theme: `Empiezan con «${l.toUpperCase()}»`,
      four,
    });
}

// ── 3. hidden word ───────────────────────────────────────────────────────────
// A card whose name CONTAINS another card's name — el soldado hides el dado,
// la campana hides el pan.
//
// THREE rules, each of which the first run needed:
//
//  a) RAW TEXT, no diacritic stripping. Everywhere else in this file the deck
//     is flattened, because that is what the composer does for letters and
//     rhymes. Here it is wrong: flattening folds ñ onto n and every accent onto
//     its bare vowel, so «El Champiñón» came out hiding «El Pino» and «La
//     Araña» hiding «La Rana». Neither is true — a player reading the card sees
//     champi-ÑÓN, and there is no pine in it. Hidden words are a claim about
//     the letters actually printed on the card, so they are matched on the
//     letters actually printed on the card.
//
//  b) SINGLE WORDS ONLY, on both sides. «El Espejo de Mano» does not hide
//     «mano»; it says it. So does «El Arroz Cocido» with «arroz». Those are
//     compound names, and a player who "spots" one has spotted nothing.
//
//  c) NOT AT INDEX 0. A word at the front of a name is not hidden, it is where
//     you started reading — and this is also where every same-root pair lives:
//     Farol→Faro, Frijoles→Frijol, Limonada→Limón, Camioneta→Camión,
//     Colchoneta→Colchón, Veladora→Vela. What is left is the real article:
//     estó-MAGO, g-RANA-da, alm-OHADA, cama-LEÓN, perez-OSO, za-PATO.
//
// Plus a short hand-kept reject list, because two survivors are mechanically
// perfect and still bad. Taste does not compress into a predicate; what it can
// do is be written down with its reason.
const HIDDEN_REJECT = {
  la_zarzamora: 'zarza+mora is one fruit named twice, not a word hidden in another',
  la_serpiente: 'ser-PIEN-te does not break on «pie»; the match is spelling, not sound',
};

const rawWord = (s) => noun(s).toLowerCase().replace(/[^a-záéíóúüñ ]/gu, '');
const flat = cards.map((c) => ({ c, words: rawWord(c.name).split(' ') }));
const hiders = new Map();
for (const { c, words } of flat) {
  if (words.length !== 1) continue; // (b)
  if (HIDDEN_REJECT[c.id]) continue;
  const host = words[0];
  const inside = [];
  for (const o of flat) {
    if (o.c.id === c.id || o.words.length !== 1) continue;
    const w = o.words[0];
    if (w.length < 3 || w.length >= host.length) continue;
    if (host.indexOf(w) <= 0) continue; // (c)
    inside.push({ card: o.c, word: w });
  }
  if (inside.length)
    hiders.set(c.id, { c, hides: inside.sort((a, b) => b.word.length - a.word.length) });
}
const hiderCards = [...hiders.values()].map((h) => h.c);
for (const four of combos(hiderCards, 10, 'hidden', 'x')) {
  const picks = four.map((c) => ({ card: c, word: hiders.get(c.id).hides[0].word }));
  if (new Set(picks.map((p) => p.word)).size !== 4) continue; // one «col» per board
  proposals.push({ kind: 'hidden', key: 'x', theme: 'Esconden otra palabra', four, picks });
}

// ── copy ─────────────────────────────────────────────────────────────────────
// House style, taken from the base deck: rhyme groups hyphenate the shared
// ending, letter groups list the names, hidden groups quote the hidden word.
// All three then state the binding idea after a colon — the deck audit found
// 400 whys that were card-name restatements and therefore said nothing, and
// these are generated, so the fix has to live in the generator.

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const listEs = (a) => `${a.slice(0, -1).join(', ')} y ${a[a.length - 1]}`;
const listEn = (a) => `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;

function hyphenate(name, key) {
  const n = noun(name);
  const parts = n.split(' ');
  const last = parts.pop();
  const cut = last.length - key.length;
  return [...parts, `${last.slice(0, cut)}-${last.slice(cut)}`].join(' ').toLowerCase();
}

/**
 * English gloss for every hidden word. Deliberately a hard requirement rather
 * than a fallback: an untranslated hidden word reaches an English player as a
 * reveal line that explains the joke in a language they are not reading, which
 * is worse than no reveal at all. Missing gloss = the generator refuses to run.
 */
const GLOSS = {
  agua: 'water', ajo: 'garlic', arco: 'bow', arpa: 'harp', buro: 'nightstand',
  cama: 'bed', col: 'cabbage', dado: 'die', dalia: 'dahlia', haba: 'broad bean',
  hada: 'fairy', lanza: 'spear', leon: 'lion', lobo: 'wolf', loto: 'lotus',
  mago: 'magician', metro: 'subway', molino: 'windmill', ojo: 'eye', olla: 'pot',
  oso: 'bear', pan: 'bread', pato: 'duck', pino: 'pine', rana: 'frog',
  sol: 'sun', talon: 'heel', tina: 'tub', vena: 'vein',
};

function copyFor(p) {
  const nouns = p.four.map((c) => noun(c.name));
  if (p.kind === 'rhyme') {
    const cut = p.four.map((c) => hyphenate(c.name, p.key));
    const why = `${cap(cut[0])}, ${cut.slice(1).join(', ')}: la misma terminación.`;
    return { why, whyEn: `${cap(cut[0])}, ${cut.slice(1).join(', ')}: the same ending.` };
  }
  if (p.kind === 'letter') {
    const low = nouns.map((n) => n.toLowerCase());
    return {
      why: `${cap(listEs(low))}: sólo comparten la primera letra.`,
      whyEn: `${cap(listEn(low))}: the first letter is all they share.`,
    };
  }
  const es = p.picks.map((x, i) =>
    i === 0 ? `${noun(x.card.name)} esconde «${x.word}»` : `${noun(x.card.name)} «${x.word}»`
  );
  const en = p.picks.map((x, i) => {
    const g = GLOSS[deaccent(x.word)];
    if (!g) throw new Error(`no English gloss for hidden word «${x.word}» — add it to GLOSS`);
    return i === 0
      ? `${noun(x.card.name)} hides «${x.word}» (${g})`
      : `${noun(x.card.name)} «${x.word}» (${g})`;
  });
  return { why: `${es.join(', ')}.`, whyEn: `${en.join(', ')}.` };
}

const THEME_EN = (p) =>
  p.kind === 'rhyme'
    ? `They rhyme in «-${p.key}»`
    : p.kind === 'letter'
      ? `They start with «${p.key.toUpperCase()}»`
      : 'They hide another word';

// ── report ───────────────────────────────────────────────────────────────────
const seen = new Set();
const final = [];
for (const p of proposals) {
  const sig = p.four.map((c) => c.id).sort().join('|');
  if (seen.has(sig)) continue;
  seen.add(sig);
  final.push({ ...p, ...copyFor(p) });
}

const byKind = (k) => final.filter((p) => p.kind === k).length;
console.log(
  `${final.length} candidate trap groups  ` +
    `(${byKind('rhyme')} rhyme, ${byKind('letter')} letter, ${byKind('hidden')} hidden)\n`
);
for (const p of final) {
  console.log(`  [${p.kind}] ${p.theme}`);
  console.log(`      ${p.four.map((c) => c.name).join(' · ')}`);
  console.log(`      (${p.four.map(fam).join('/')})`);
  console.log(`      ${p.why}`);
}

const newThemes = new Set(final.map((p) => p.theme));
console.log(`\n${newThemes.size} distinct new trap themes.`);
console.log(`trap themes already in the deck: ${
  [...new Set(Object.values(LIB).filter((g) => g.kind !== 'cat').map((g) => g.theme))].length
}`);
console.log(`hidden-word cards in the deck (the \`exclude\` list): ${hiderCards.length}`);

// ── write ────────────────────────────────────────────────────────────────────
if (process.argv.includes('--write')) {
  const en = JSON.parse(readFileSync(EN_P, 'utf8'));

  // `exclude` is a hidden trap's ONLY ambiguity guard, and it is deliberately
  // computed on the LOOSE (diacritic-folded, prefix-allowed) reading rather
  // than the strict one used to build the groups. Membership should be strict —
  // only genuinely hidden words become answers. Exclusion should be generous —
  // a player who reads «Camarón» as hiding «mar» is not wrong to try it, and
  // the board should not have put the temptation there. Strict in what we
  // assert, loose in what we keep off the same board.
  const loose = new Set();
  for (const { c } of flat) {
    const host = strip(c.name).replace(/ /g, '');
    for (const o of flat) {
      if (o.c.id === c.id) continue;
      const w = strip(o.c.name).replace(/ /g, '');
      if (w.length >= 3 && w.length < host.length && host.includes(w)) loose.add(c.id);
    }
  }
  const excludeAll = [...loose];
  let n = 0;
  for (const p of final) {
    const key = `trampa_${p.kind}_${p.key}_${++n}`;
    const g = {
      kind: p.kind,
      cards: p.four.map((c) => c.id),
      theme: p.theme,
      why: p.why,
    };
    if (p.kind === 'hidden') g.exclude = excludeAll.filter((id) => !g.cards.includes(id));
    expGroups[key] = g;
    en.themes[p.theme] ??= THEME_EN(p);
    en.whys[p.why] ??= p.whyEn;
  }
  writeFileSync(GROUPS_P, `${JSON.stringify(expGroups, null, 2)}\n`, 'utf8');
  writeFileSync(EN_P, `${JSON.stringify(en, null, 2)}\n`, 'utf8');
  console.log(`\nwrote ${n} trap groups into expansion.groups.json and their English into groupText.en.json`);
  console.log('Now run: npm run groups && npm run copy && npm run i18n && npm run sim');
}
