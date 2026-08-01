#!/usr/bin/env node
/**
 * Reads the name printed INTO each card's artwork and compares it against the
 * card's actual name.
 *
 *     npm run banners            # every card
 *     npm run banners -- el_arco la_mora   # just these
 *
 * WHY THIS IS NOT COSMETIC. The name is baked into the picture. `CardTile`
 * covers it with a vector plate, so on the board you never see it — but
 * `CardVideo` does not, so the baked text is what a player reads on the Home
 * hero and throughout the win celebration. A misspelling there is visible in
 * the two most prominent places in the app and invisible everywhere a
 * developer would look.
 *
 * Comparing twenty-one cards by eye turned up four defects: a stray leading
 * apostrophe on El Arco, "Lá Zarzamora" with the accent on the wrong word, and
 * stray numbers baked into La Matraca and La Mora. Four in twenty-one is not a
 * rate you can extrapolate from, and there are 995 — so this reads all of them.
 *
 * HOW IT DECIDES. It crops the banner, upscales it, and runs Tesseract with
 * the SPANISH model, which lives in scripts/_tessdata/ rather than the system
 * tessdata directory — that path is not writable from here, and `--tessdata-dir`
 * makes the pack part of the repo instead of part of the machine, so this works
 * on a fresh checkout without an install step.
 *
 * The read is still imperfect over ornate serif on aged paper, so the test is
 * edit distance rather than an exact match: case, accents and punctuation are
 * folded away, the name is looked for anywhere in the crop, and only a
 * difference larger than a quarter of the name's length is reported.
 *
 * BE CLEAR ABOUT WHAT THIS CANNOT DO. Folding accents means it cannot see "Lá"
 * for "La", and installing the Spanish pack would not fix that either, since
 * the fold happens after OCR. Wrong words, missing words and stray characters
 * it does catch. Accent errors need eyes on the crops in scripts/_ocr/.
 *
 * REQUIRES ffmpeg and tesseract on PATH.
 */
import { execFileSync, execSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CARDS = join(root, 'assets', 'cards');
const TMP = join(root, 'scripts', '_ocr');
const TESSDATA = join(root, 'scripts', '_tessdata');
mkdirSync(TMP, { recursive: true });

if (!existsSync(join(TESSDATA, 'spa.traineddata'))) {
  console.error('Missing scripts/_tessdata/spa.traineddata (the Spanish OCR model).');
  console.error('Download it from:');
  console.error('  https://raw.githubusercontent.com/tesseract-ocr/tessdata/main/spa.traineddata');
  process.exit(1);
}

// ffmpeg answers to -version and tesseract to --version; asking either the
// wrong way exits non-zero and reports the tool as missing when it is present.
for (const [bin, flag] of [['ffmpeg', '-version'], ['tesseract', '--version']]) {
  try {
    execSync(`${bin} ${flag}`, { stdio: 'ignore' });
  } catch {
    console.error(`${bin} not found on PATH.`);
    if (bin === 'tesseract') console.error('  Windows: winget install UB-Mannheim.TesseractOCR');
    process.exit(1);
  }
}

const raw = JSON.parse(readFileSync(join(root, 'src/data/expansion.cards.json'), 'utf8'));
const list = Array.isArray(raw) ? raw : raw.cards ?? Object.values(raw);
const names = Object.fromEntries(list.filter((c) => c && c.id).map((c) => [c.id, c.name]));

/** Fold everything OCR gets unreliably wrong, so only real differences remain. */
const fold = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

function distance(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return m[a.length][b.length];
}

function readBanner(id) {
  const src = join(CARDS, `${id}.jpg`);
  const crop = join(TMP, `${id}.png`);
  // Lower third only, upscaled 3x and pushed to high contrast — Tesseract is
  // far more accurate on big clean glyphs than on the original 480px card.
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', src,
    '-vf', "crop=iw:ih/3:0:ih*2/3,scale=iw*4:-1,format=gray,eq=contrast=2.1", crop],
    { stdio: 'inherit' });
  try {
    // --dpi silences a resolution warning that otherwise fills the log; --psm 6
    // treats the crop as one block of text, which suits a single banner line.
    return execFileSync(
      'tesseract',
      [crop, 'stdout', '--tessdata-dir', TESSDATA, '-l', 'spa', '--dpi', '300', '--psm', '6'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
  } catch {
    return '';
  }
}

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
// Only cards whose NAME we know. The base-54 live in cards.ts rather than
// expansion.cards.json, so asking for one by hand used to compare its banner
// against the string "undefined" and report every one of them as wrong.
const ids = (only.length ? only : Object.keys(names)).filter(
  (id) => names[id] && existsSync(join(CARDS, `${id}.jpg`))
);
if (only.length && only.some((id) => !names[id])) {
  console.log(`skipped (name not in expansion.cards.json): ${only.filter((i) => !names[i]).join(', ')}\n`);
}

const bad = [];
const unread = [];
let n = 0;
for (const id of ids) {
  const want = fold(names[id] ?? id);
  const got = fold(readBanner(id));
  n += 1;
  if (n % 100 === 0) process.stdout.write(`  ${n}/${ids.length}\n`);
  if (!got) { unread.push(id); continue; }
  // The banner sits among frame ornament and card numbers, so look for the name
  // ANYWHERE in what was read rather than demanding the whole crop match.
  if (got.includes(want)) continue;
  const words = got.split(' ');
  const win = want.split(' ').length;
  // Slide a window the length of the name across what was read. The first
  // version left `best` at Infinity when the read was SHORTER than the name,
  // which reported a card as badly wrong precisely when nothing had been read —
  // the one case where the tool knows least. Fall back to comparing the whole
  // string so a short read is scored, not condemned.
  let best = distance(got, want);
  for (let i = 0; i + win <= words.length; i++)
    best = Math.min(best, distance(words.slice(i, i + win).join(' '), want));

  // Tesseract has no Spanish pack here, so a garbled read is common and is NOT
  // evidence the banner is wrong. Only report when enough letters came through
  // to trust the comparison: a read with almost no overlap is illegible, not
  // incorrect, and calling it incorrect is how a checker teaches people to
  // ignore it.
  const shared = new Set([...want.replace(/ /g, '')].filter((c) => got.includes(c))).size;
  const legible = shared >= Math.ceil(new Set(want.replace(/ /g, '')).size * 0.6);
  if (!legible) { unread.push(id); continue; }

  if (best > Math.max(2, Math.ceil(want.length / 4))) {
    bad.push({ id, want: names[id], got: got.slice(0, 60), d: best });
  }
}

console.log(
  `\n${n} banners · ${n - unread.length - bad.length} read and matching · ` +
    `${unread.length} too garbled to judge · ${bad.length} worth looking at`
);
for (const b of bad) console.log(`  ✗ ${b.id.padEnd(24)} expected "${b.want}"  read "${b.got}"  (distance ${b.d})`);
if (unread.length) console.log(`\n  illegible (look at these by hand): ${unread.slice(0, 20).join(', ')}${unread.length > 20 ? ' …' : ''}`);
console.log('\nThis is a TRIAGE TOOL, not a gate, and it is deliberately not in `npm run');
console.log('check`. With only English Tesseract against ornate serif on aged paper, the');
console.log('read is too rough to fail a build on — it narrows 995 cards down to a set');
console.log('small enough to look at, and looking is still what decides. Accent errors');
console.log('like "Lá" for "La" it cannot see at all. Crops are in scripts/_ocr/.');
