#!/usr/bin/env node
/**
 * Measures how much of the 995-card deck can be bundled into the app binary
 * while staying inside both stores' size limits.
 *
 *     node scripts/bundle-budget.mjs [sampleSize]
 *
 * WHY MEASURE RATHER THAN ESTIMATE. The card art is a photoreal subject on an
 * amber backdrop with the Spanish name painted into a banner. How that
 * compresses at small sizes is not something you can extrapolate from the
 * 1792x2400 original — webp's bytes-per-pixel rises sharply as images shrink,
 * so a linear estimate is wrong by several times in either direction. This
 * fetches real transformed bytes from the same Supabase endpoint the app uses.
 *
 * THE LIMITS (verified 2026-07-31):
 *   iOS   — 200 MB is the cellular-download threshold; over it the user gets a
 *           warning they can override. That is a UX cliff, not a rejection.
 *   Play  — base module hard cap 500 MB; over 200 MB shows a mobile-data
 *           warning dialog.
 * So 200 MB is the real ceiling on both, and we target well under it.
 *
 * THE CONSTRAINT THAT PROBABLY BINDS FIRST IS NOT SIZE. The card's name is
 * baked into the artwork. Shrink far enough and the name stops being legible
 * long before the bundle stops fitting. This script writes one sample card at
 * every width to scripts/_bundle-samples/ so you can LOOK at them and decide
 * how small is actually acceptable. Do that before trusting the byte counts.
 */
import { writeFileSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'scripts', '_bundle-samples');
mkdirSync(OUT, { recursive: true });

const CDN = 'https://bmybvrqbpachjxrejxdj.supabase.co/storage/v1';
const ASPECT = 2400 / 1792;

/** Candidate bundle widths, in physical pixels. */
const WIDTHS = [240, 320, 400, 480, 640];
const QUALITY = 78;

const SAMPLE = Number(process.argv[2] ?? 24);

// A spread across families so we measure busy art as well as simple art.
const IDS = [
  'el_gallo', 'la_sirena', 'el_musico', 'la_calavera', 'el_nopal', 'la_luna',
  'el_catrin', 'la_rosa', 'el_venado', 'el_arpa', 'la_bandera', 'el_sol',
  'el_tiranosaurio', 'la_ambulancia', 'el_aguacate', 'la_trompeta',
  'el_astronauta', 'la_medalla', 'el_cocodrilo', 'la_pizza',
  'el_telescopio', 'la_catrina', 'el_bombero', 'la_guacamaya',
].slice(0, SAMPLE);

function url(id, w) {
  const h = Math.round(w * ASPECT);
  return `${CDN}/render/image/public/cards/${id}.webp?width=${w}&height=${h}&resize=cover&quality=${QUALITY}`;
}

async function bytes(u) {
  const res = await fetch(u);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ── current bundled footprint ────────────────────────────────────────────────
function dirSize(p) {
  let total = 0;
  for (const e of readdirSync(p, { withFileTypes: true })) {
    const full = join(p, e.name);
    total += e.isDirectory() ? dirSize(full) : statSync(full).size;
  }
  return total;
}
let bundledNow = 0;
try {
  bundledNow = dirSize(join(root, 'assets'));
} catch {
  /* no assets dir */
}

const MB = (b) => (b / 1024 / 1024).toFixed(1);

console.log(`assets/ currently bundled: ${MB(bundledNow)} MB`);
console.log(`sampling ${IDS.length} cards at ${WIDTHS.length} widths (quality ${QUALITY})\n`);

const DECK = 995;
const rows = [];

for (const w of WIDTHS) {
  const sizes = [];
  let failed = 0;
  for (const id of IDS) {
    try {
      const buf = await bytes(url(id, w));
      sizes.push(buf.length);
      if (id === IDS[0]) writeFileSync(join(OUT, `sample-${w}px.webp`), buf);
    } catch {
      failed++;
    }
  }
  if (!sizes.length) {
    console.log(`  w=${w}: all fetches failed — check connectivity`);
    continue;
  }
  sizes.sort((a, b) => a - b);
  const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  const p90 = sizes[Math.floor(sizes.length * 0.9)];
  const deckTotal = avg * DECK;
  rows.push({ w, avg, p90, deckTotal, failed });
}

console.log('width   avg/card   p90/card   all 995 cards');
console.log('-----   --------   --------   -------------');
for (const r of rows) {
  console.log(
    `${String(r.w).padStart(5)}   ${(r.avg / 1024).toFixed(1).padStart(6)} kB   ${(r.p90 / 1024).toFixed(1).padStart(6)} kB   ${MB(r.deckTotal).padStart(6)} MB` +
      (r.failed ? `   (${r.failed} fetch failures)` : '')
  );
}

// ── budget ───────────────────────────────────────────────────────────────────
console.log('\n--- budget ---');
console.log('Set BINARY_MB to your real current download size, from either:');
console.log('  Play Console → Test and release → App bundle explorer → Downloads');
console.log('  App Store Connect → your build → App Store File Sizes');
const BINARY_MB = Number(process.env.BINARY_MB ?? 45);
console.log(`using BINARY_MB=${BINARY_MB} (override with: BINARY_MB=xx node scripts/bundle-budget.mjs)\n`);

const CEILING = 200; // hard UX cliff on both stores
const TARGET = 150; // where we actually want to land, for margin

for (const r of rows) {
  const totalAt = BINARY_MB + r.deckTotal / 1024 / 1024;
  const fitsTarget = totalAt <= TARGET;
  const fitsCeiling = totalAt <= CEILING;
  const affordable = Math.floor(((TARGET - BINARY_MB) * 1024 * 1024) / r.avg);
  console.log(
    `w=${String(r.w).padStart(3)}  full deck → ${MB(r.deckTotal).padStart(6)} MB, app ≈ ${totalAt.toFixed(0).padStart(3)} MB  ` +
      `${fitsTarget ? '✅ under 150' : fitsCeiling ? '⚠️  over 150, under 200' : '❌ over 200'}` +
      `   · cards affordable at 150 MB: ${affordable >= DECK ? 'all ' + DECK : affordable}`
  );
}

console.log(`\nSample images written to scripts/_bundle-samples/ — OPEN THEM.`);
console.log('The card name is painted into the art. Judge legibility before size:');
console.log('the smallest width whose banner text you can still read is the real answer.');
