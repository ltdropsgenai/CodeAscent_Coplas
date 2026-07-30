#!/usr/bin/env node
/**
 * Compresses the bundled background scenes: converts assets/scenes/*.png to
 * JPEG (photos, no alpha needed), which cuts each from ~2 MB to ~150-250 KB,
 * then rewrites the require() paths in src/data/sceneImages.ts from .png → .jpg
 * and deletes the originals.
 *
 * Prereq (one-time):  npm i -D sharp
 * Run (after fetch-scenes.mjs):  node scripts/optimize-scenes.mjs
 *
 * Knobs: lower MAX_WIDTH (e.g. 640) and/or QUALITY (e.g. 72) for smaller files —
 * these backgrounds are heavily blurred + darkened, so quality can go low. Safe
 * to re-run; if there are no .png files left it just reports that.
 */
import { readdirSync, statSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const MAX_WIDTH = 768; // phone-width; the source renders are 768px wide already
const QUALITY = 80;

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('Missing dependency. Install it first:\n\n    npm i -D sharp\n');
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(root, 'assets', 'scenes');
const SCENES_TS = join(root, 'src', 'data', 'sceneImages.ts');

let pngs;
try {
  pngs = readdirSync(DIR).filter((f) => f.toLowerCase().endsWith('.png'));
} catch {
  console.error(`No assets/scenes folder found. Run "node scripts/fetch-scenes.mjs" first.`);
  process.exit(1);
}
if (!pngs.length) {
  console.log('No .png files in assets/scenes — nothing to optimize (already done?).');
  process.exit(0);
}

console.log(`Optimizing ${pngs.length} scenes → JPEG (q${QUALITY}, max ${MAX_WIDTH}px wide)…`);
let before = 0;
let after = 0;
for (const f of pngs) {
  const inPath = join(DIR, f);
  const outName = f.replace(/\.png$/i, '.jpg');
  const outPath = join(DIR, outName);
  const inSize = statSync(inPath).size;
  await sharp(inPath)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: QUALITY, mozjpeg: true, progressive: true })
    .toFile(outPath);
  const outSize = statSync(outPath).size;
  unlinkSync(inPath);
  before += inSize;
  after += outSize;
  console.log(`  ${f}  ${(inSize / 1024).toFixed(0)} KB → ${outName}  ${(outSize / 1024).toFixed(0)} KB`);
}

// Repoint the require() paths in sceneImages.ts: .png → .jpg
const src = readFileSync(SCENES_TS, 'utf8');
const out = src.replace(/(assets\/scenes\/[^'"`]+?)\.png/g, '$1.jpg');
if (out !== src) writeFileSync(SCENES_TS, out);

console.log(
  `\n✓ ${(before / 1048576).toFixed(1)} MB → ${(after / 1048576).toFixed(1)} MB ` +
    `(${(100 * (1 - after / before)).toFixed(0)}% smaller).`
);
console.log(out !== src ? '  Updated sceneImages.ts require() paths to .jpg.' : '  (sceneImages.ts already pointed at .jpg.)');
console.log('  Restart Expo:  npx expo start -c');
