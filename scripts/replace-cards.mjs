#!/usr/bin/env node
/**
 * Replaces individual card art that came out wrong, end to end.
 *
 *     node scripts/replace-cards.mjs
 *
 * A card is not one file. Replacing one means three things must move together
 * or the deck goes inconsistent in a way no gate would notice:
 *
 *   1. assets/cards/<id>.jpg          the still, shown on the board
 *   2. scripts/_video_orig/<id>.mp4   the pristine source clip
 *   3. assets/video/<id>.mp4          the bundled clip, shown on Home and in
 *                                     the win celebration
 *
 * Miss (3) and the board shows the corrected card while the celebration still
 * animates the wrong one. That is the failure this script exists to prevent:
 * it refuses to finish until the stale clips are gone, so the omission cannot
 * be silent.
 *
 * WHAT IS BEING REPLACED, and why:
 *
 *   el_talon   — generated from the prompt "a heel" and came back a
 *                HIGH-HEELED SHOE. "Heel" is a body part and a part of a shoe;
 *                every other body card says "a human eye", "a human foot".
 *   la_mora    — was drawn as a blackberry, identical to la_zarzamora. Now a
 *                MULBERRY, which *mora* also legitimately means, so the two
 *                cards finally show two different fruits.
 *   el_zancudo — was drawn as a mosquito, identical to el_mosquito. Now a CRANE
 *                FLY at rest — still what a zancudo is colloquially, and
 *                unmistakably not the same picture as el_mosquito in flight.
 *
 * REQUIRES ffmpeg on PATH and a working internet connection.
 */
import { execFileSync, execSync } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync, statSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CARDS = join(root, 'assets', 'cards');
const VIDEO = join(root, 'assets', 'video');
const ORIG = join(root, 'scripts', '_video_orig');
const OLD = join(root, 'scripts', '_replaced');
mkdirSync(OLD, { recursive: true });

const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_395qbESmCeG8JPbpOIha0lzedrS';

const REPLACE = {
  el_talon: `${CDN}/hf_20260801_052935_32171d72-a98b-470e-9bf5-6217cc30186b.png`,
  la_mora: `${CDN}/hf_20260801_052944_f6428d2c-612c-4d76-8cec-abd07fc33c4e.png`,
  el_zancudo: `${CDN}/hf_20260801_052953_7200f9d0-8f99-4ba8-9017-26ff4dba662b.png`,
};

try {
  execSync('ffmpeg -version', { stdio: 'ignore' });
} catch {
  console.error('ffmpeg not found on PATH.\n  Windows: winget install Gyan.FFmpeg');
  process.exit(1);
}

async function download(url, dest, tries = 4) {
  let last;
  for (let a = 1; a <= tries; a++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 20000) throw new Error(`suspiciously small (${buf.length}B)`);
      writeFileSync(dest, buf);
      return buf.length;
    } catch (e) {
      last = e;
      if (a < tries) await new Promise((r) => setTimeout(r, 400 * 2 ** a));
    }
  }
  const why = last?.cause?.message || last?.cause?.code;
  throw new Error(`${last?.message ?? last}${why ? ` (${why})` : ''} after ${tries} tries`);
}

const stale = [];
for (const [id, url] of Object.entries(REPLACE)) {
  const jpg = join(CARDS, `${id}.jpg`);
  const png = join(root, 'scripts', `_new_${id}.png`);
  try {
    console.log(`\n${id}`);
    await download(url, png);

    // Keep the old still. Every other cache in this repo is recoverable from a
    // URL; this one is the only copy of what the card used to look like.
    if (existsSync(jpg)) renameSync(jpg, join(OLD, `${id}.jpg`));

    // Match the rest of the deck: JPEG, same width as the bundled art.
    execFileSync(
      'ffmpeg',
      ['-y', '-v', 'error', '-i', png, '-vf', "scale='min(480,iw)':-2", '-q:v', '3', jpg],
      { stdio: 'inherit' }
    );
    console.log(`  ✓ assets/cards/${id}.jpg  ${(statSync(jpg).size / 1024).toFixed(0)} kB`);

    // The clips still show the OLD subject. Move them aside rather than leave
    // them: a missing clip degrades to the still (CardVideo already draws it as
    // a poster), which is correct-and-silent. A stale clip is wrong-and-silent.
    for (const [dir, label] of [[VIDEO, 'assets/video'], [ORIG, 'scripts/_video_orig']]) {
      const mp4 = join(dir, `${id}.mp4`);
      if (existsSync(mp4)) {
        renameSync(mp4, join(OLD, `${label.replace(/\W/g, '_')}_${id}.mp4`));
        console.log(`  ✓ retired the stale clip in ${label}/`);
        stale.push(id);
      }
    }
  } catch (e) {
    console.error(`  ✗ ${id} — ${e.message}`);
    process.exitCode = 1;
  }
}

console.log('\nOld art moved to scripts/_replaced/ — check the new cards before deleting it.');
if (stale.length) {
  console.log('\nThe three cards now have NO animated clip, so they fall back to the still.');
  console.log('That is deliberate and safe. To re-animate them, generate new 3s clips from');
  console.log('the new stills (see claude/coplas-animated-cards-status.md for the prompt),');
  console.log('drop them into scripts/_video_orig/, then re-run:');
  console.log('    node scripts/bundle-video.mjs');
}
console.log('\nThen:  npm run art && npm run check');
