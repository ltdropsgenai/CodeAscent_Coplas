/**
 * Rasterize the brand SVGs to PNG with headless Chromium (Playwright).
 *
 * Prereq (one-time):  npm i -D playwright && npx playwright install chromium
 * Run:  node brand/build.mjs && node brand/raster.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = dirname(fileURLToPath(import.meta.url));
const load = (f) => readFileSync(join(OUT, f), 'utf8');

// [svgFile, outPng, width, height, transparent]
const JOBS = [
  ['coplas-badge.svg', 'coplas-badge.png', 1024, 1024, false],
  ['coplas-icon.svg', 'coplas-icon.png', 1024, 1024, false],
  ['coplas-icon.svg', 'coplas-icon-512.png', 512, 512, false],
  ['coplas-mono.svg', 'coplas-mono.png', 1024, 1024, true],
  ['coplas-favicon.svg', 'coplas-favicon-256.png', 256, 256, true],
  ['coplas-favicon.svg', 'coplas-favicon-64.png', 64, 64, true],
  ['coplas-favicon.svg', 'coplas-favicon-32.png', 32, 32, true],
  ['coplas-wordmark.svg', 'coplas-wordmark.png', 3000, 920, false],
  ['coplas-wordmark-transparent.svg', 'coplas-wordmark-transparent.png', 3000, 920, true],
];

const browser = await chromium.launch();
for (const [file, out, w, h, transparent] of JOBS) {
  const svg = load(file);
  const sized = svg.replace(/<svg xmlns="[^"]*"/, (mm) => `${mm} width="${w}" height="${h}"`);
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><body style="margin:0;padding:0;">${sized}</body></html>`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const el = await page.$('svg');
  await el.screenshot({ path: join(OUT, out), omitBackground: transparent });
  await page.close();
  console.log('  ✓', out, `${w}x${h}`);
}
await browser.close();
console.log('Rasterized all PNGs.');
