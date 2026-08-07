#!/usr/bin/env node
/**
 * Download Abuela's stills and convert them to JPEG.
 *
 *     node scripts/fetch-abuela.mjs
 *
 * Run this ON londi-pc. The cloud session is firewalled from the generation
 * CDNs — same reason scripts/fetch-audio.mjs and fetch-scenes.mjs exist.
 *
 * WRITES .jpg BY SNIFFING, NOT BY ASSUMING. The sources are PNG; the deck is
 * JPEG. Build 6 shipped 995 files whose extension disagreed with their bytes,
 * because bundle-cards.mjs took the extension from the URL rather than from
 * what came back — on iOS that rendered as a full board of blank gold tiles,
 * and Android would have hidden it because Fresco sniffs content and ignores
 * the extension. So this converts explicitly with ffmpeg and then verifies the
 * magic bytes of what it wrote.
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'assets', 'abuela');

const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_395qbESmCeG8JPbpOIha0lzedrS';
const FILES = [
  ['pose-greeting',    'hf_20260807_163225_c0e3b04a-938e-4cf7-9b0d-9c0119868fb9.png'],
  ['pose-proud',       'hf_20260807_163225_46266b29-f6ec-42bf-b4f6-c4e92f4ea839.png'],
  ['pose-delighted',   'hf_20260807_163225_41d6c217-4697-46ab-b2e0-92883047877f.png'],
  ['pose-sympathetic', 'hf_20260807_163225_216738cb-da64-4489-956a-d1df47b8bc2e.png'],
  ['still-home',       'hf_20260807_163225_901ca226-fdec-4ef6-9dd6-009c57c4996a.png'],
  // The approved reference. Kept because every derived asset inherits this
  // face, and the video beats in Task 2 are generated from it — losing it
  // means the character can never be reproduced.
  ['reference',        'hf_20260807_162821_909e7a67-b59d-49c3-991e-c819470a1b94.png'],
];

/** JPEG starts FF D8 FF. Verified, not assumed. */
function isJpeg(p) {
  const b = readFileSync(p).subarray(0, 3);
  return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
}

mkdirSync(OUT, { recursive: true });
console.log(`downloading ${FILES.length} images → assets/abuela/\n`);

let failed = 0;
for (const [name, remote] of FILES) {
  const tmp = join(OUT, `${name}.download.png`);
  const dst = join(OUT, `${name}.jpg`);
  try {
    const res = await fetch(`${CDN}/${remote}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-q:v', '3', dst]);
    unlinkSync(tmp);
    if (!isJpeg(dst)) throw new Error('wrote a file that is not JPEG');
    const kb = Math.round(readFileSync(dst).length / 1024);
    console.log(`  ok    ${name}.jpg   ${kb} KB`);
  } catch (e) {
    failed += 1;
    console.error(`  FAIL  ${name}: ${e.message}`);
    if (existsSync(tmp)) unlinkSync(tmp);
  }
}

if (failed) {
  console.error(`\n✗ ${failed} of ${FILES.length} failed. These URLs expire — if they 403,
  the images must be regenerated rather than retried.`);
  process.exit(1);
}
console.log(`\n✅ all ${FILES.length} in assets/abuela/, verified as real JPEG`);
