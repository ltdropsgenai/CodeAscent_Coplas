#!/usr/bin/env node
/**
 * Converts the bundled background scenes from PNG to JPEG and rewrites the
 * require() paths that point at them.
 *
 *     node scripts/optimize-scenes.mjs
 *
 * WHY. PNG is lossless and made for graphics with flat colour and hard edges.
 * These are photographic renders — a plaza at night, marigold arches, a
 * volcano at dusk — and they are drawn heavily blurred and darkened behind the
 * UI, so lossless fidelity buys nothing anyone can see and costs about 11 MB
 * of install. There is also no alpha channel to preserve.
 *
 * USES FFMPEG, NOT SHARP. The previous version needed `npm i -D sharp`, a
 * native module that has to compile. ffmpeg is already a hard requirement for
 * scripts/encode-music.mjs and scripts/bundle-video.mjs, so this adds no new
 * dependency at all — and unlike sharp it is already on your PATH.
 *
 * Safe to re-run: with no .png left it says so and stops. Originals are moved
 * to scripts/_scene_orig/ rather than deleted, so a bad quality setting is one
 * command away from being undone.
 */
import { execFileSync, execSync } from 'node:child_process';
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(root, 'assets', 'scenes');
const KEEP = join(root, 'scripts', '_scene_orig');
const SCENES_TS = join(root, 'src', 'data', 'sceneImages.ts');

/**
 * The renders are already 768 px wide, which is phone width, so nothing is
 * scaled — the saving is entirely format.
 *
 * `-q:v` is inverted (2 is best, 31 worst) and is NOT the same scale as the
 * 0-100 "quality" most tools use. Measured on three of these scenes: q4 gives
 * 233 kB, q5 gives 199 kB, q7 gives 155 kB, against 553 kB for the PNG. q5
 * sits where the curve flattens, and these are blurred behind the UI anyway.
 */
const QUALITY = 5;
const MAX_WIDTH = 768;

try {
  execSync('ffmpeg -version', { stdio: 'ignore' });
} catch {
  console.error('ffmpeg not found on PATH.\n');
  console.error('  Windows :  winget install Gyan.FFmpeg');
  console.error('  macOS   :  brew install ffmpeg');
  process.exit(1);
}

let pngs;
try {
  pngs = readdirSync(DIR).filter((f) => f.toLowerCase().endsWith('.png'));
} catch {
  console.error('No assets/scenes folder. Run scripts/fetch-scenes.mjs first.');
  process.exit(1);
}
if (!pngs.length) {
  console.log('No .png left in assets/scenes — already optimized. Nothing to do.');
  process.exit(0);
}

mkdirSync(KEEP, { recursive: true });

let before = 0;
let after = 0;
const converted = [];
const failed = [];

for (const png of pngs) {
  const src = join(DIR, png);
  const base = png.replace(/\.png$/i, '');
  const jpg = join(DIR, `${base}.jpg`);
  try {
    execFileSync(
      'ffmpeg',
      ['-y', '-v', 'error', '-i', src,
       '-vf', `scale='min(${MAX_WIDTH},iw)':-2`,
       '-q:v', String(QUALITY), jpg],
      { stdio: 'inherit' }
    );
    const b = statSync(src).size;
    const a = statSync(jpg).size;
    if (a < 5000) throw new Error(`output suspiciously small (${a}B)`);
    before += b;
    after += a;
    converted.push(base);
    // Moved, not deleted. A quality setting you regret should cost one `mv`,
    // not a re-render of every background.
    renameSync(src, join(KEEP, png));
    console.log(`  ✓ ${base.slice(0, 40).padEnd(40)} ${(b / 1024).toFixed(0).padStart(4)} kB → ${(a / 1024).toFixed(0).padStart(4)} kB`);
  } catch (e) {
    failed.push(`${base}: ${e.message}`);
    console.error(`  ✗ ${base} — ${e.message}`);
  }
}

// ── rewrite the registry ─────────────────────────────────────────────────────
// Only the extension changes, and only for files that actually converted. A
// blanket .png → .jpg replace would break any scene that failed above and
// leave a require() pointing at a file that is not there — which Metro reports
// as a build failure, not a missing background, so it would take the whole app
// down rather than one screen.
if (converted.length && existsSync(SCENES_TS)) {
  let ts = readFileSync(SCENES_TS, 'utf8');
  let n = 0;
  for (const base of converted) {
    const from = `${base}.png`;
    if (ts.includes(from)) {
      ts = ts.split(from).join(`${base}.jpg`);
      n += 1;
    }
  }
  ts = ts.replace(
    'BUNDLED offline: local PNGs under assets/scenes/, loaded via require().',
    'BUNDLED offline: local JPEGs under assets/scenes/, loaded via require().\n * (Converted from PNG by scripts/optimize-scenes.mjs — these are photographic\n * renders drawn blurred behind the UI, so lossless was ~11 MB of nothing.)'
  );
  writeFileSync(SCENES_TS, ts);
  console.log(`\nrewrote ${n} require() paths in src/data/sceneImages.ts`);
}

console.log(
  `\n${converted.length}/${pngs.length} converted · ${(before / 1048576).toFixed(1)} MB → ${(after / 1048576).toFixed(1)} MB` +
    (after ? ` (${(before / after).toFixed(1)}x smaller, ${((before - after) / 1048576).toFixed(0)} MB saved)` : '')
);
for (const f of failed) console.log(`  ! ${f}`);
console.log(`\nOriginals moved to scripts/_scene_orig/ — delete by hand once you are happy.`);
console.log('Then run:  npm run assets');
