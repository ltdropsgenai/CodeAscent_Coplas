#!/usr/bin/env node
/**
 * Downloads the pristine card clips into scripts/_video_orig/ and writes a
 * before/after contact sheet.
 *
 *     node scripts/optimize-video.mjs
 *
 * THE NAME IS HISTORICAL. This script used to re-encode the clips in the
 * Supabase `video` bucket and upload them back — that is where the 1,316 MB to
 * 149 MB reduction came from. The clips are BUNDLED now
 * (scripts/bundle-video.mjs, assets/video/, 29.5 MB), nothing reads that bucket
 * any more, and the upload path has been removed: it wrote to storage no code
 * consumes, and it was the last thing in this repo that wanted a Supabase
 * service role key. Removing it means there is no write path to Supabase left
 * at all.
 *
 * WHAT IT IS STILL FOR, and why it is not deleted:
 *
 *   1. It is the only way to re-fetch `_video_orig/`, which bundle-video.mjs
 *      encodes from. If that cache is ever lost, this rebuilds it.
 *   2. The contact sheet. `npm run video` proves each clip decodes at the right
 *      size with no audio; no measurement can tell you whether the printed name
 *      banner survived the encode. The banner is baked into the video frames —
 *      CardVideo does not draw a vector plate the way CardTile does — so it is
 *      the first thing a hard quantiser destroys and the one part a player has
 *      to read. Look at it with your eyes; that is the whole point.
 *
 * REQUIRES ffmpeg and ffprobe on PATH.
 */
import { execFileSync, execSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIG = join(root, 'scripts', '_video_orig');
const BUNDLED = join(root, 'assets', 'video');
mkdirSync(ORIG, { recursive: true });

const PUBLIC =
  'https://bmybvrqbpachjxrejxdj.supabase.co/storage/v1/object/public/video';

/** Cards in the contact sheet. Spread across subjects so the sample covers busy
 *  art, plain art, faces, and banners with different lettering. */
const SAMPLE = ['el_sol', 'la_dama', 'el_borracho', 'la_sirena', 'el_musico', 'la_luna'];

/** Width the sheet renders at: the exact pixels the Home hero occupies on a 3x
 *  screen (128 pt). Comparing at any other size answers a question nobody has. */
const VIEW = 384;

for (const bin of ['ffmpeg', 'ffprobe']) {
  try {
    execSync(`${bin} -version`, { stdio: 'ignore' });
  } catch {
    console.error(`${bin} not found on PATH.\n  Windows: winget install Gyan.FFmpeg`);
    process.exit(1);
  }
}

const IDS = [
  ...readFileSync(join(root, 'src', 'data', 'cardImages.ts'), 'utf8')
    .matchAll(/assets\/cards\/([a-z0-9_]+)\.jpg/g),
].map((m) => m[1]);
if (IDS.length < 900) {
  console.error(`only ${IDS.length} card ids found — refusing to run on a partial deck.`);
  process.exit(1);
}

function ff(args) {
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...args], { stdio: 'inherit' });
}

/**
 * Fetch with retries. Twenty of seventy downloads failed on one run with no
 * HTTP status attached — the signature of transient connection resets, not bad
 * URLs. `e.message` on a failed undici fetch is the useless string "fetch
 * failed"; the actual reason lives on `e.cause`.
 */
async function download(url, dest, tries = 4) {
  let last;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 20000) throw new Error(`suspiciously small (${buf.length}B)`);
      writeFileSync(dest, buf);
      return;
    } catch (e) {
      last = e;
      if (attempt < tries) await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
    }
  }
  const why = last?.cause?.message || last?.cause?.code;
  throw new Error(`${last?.message ?? last}${why ? ` (${why})` : ''} after ${tries} tries`);
}

const POOL = 4;
let have = 0;
let bytes = 0;
const failed = [];

async function worker(queue) {
  for (;;) {
    const id = queue.pop();
    if (!id) return;
    const dest = join(ORIG, `${id}.mp4`);
    try {
      if (!existsSync(dest) || statSync(dest).size < 20000) {
        await download(`${PUBLIC}/${id}.mp4`, dest);
      }
      bytes += statSync(dest).size;
      have += 1;
      if (have % 100 === 0) {
        console.log(`  ${String(have).padStart(4)}/${IDS.length}  ${(bytes / 1048576).toFixed(0)} MB`);
      }
    } catch (e) {
      failed.push(`${id}: ${e.message}`);
      console.error(`  ✗ ${id} — ${e.message}`);
    }
  }
}

console.log(`fetching ${IDS.length} originals into scripts/_video_orig/ (cached; only misses download)\n`);
await Promise.all(Array.from({ length: POOL }, () => worker([...IDS].reverse())));

console.log(`\n${have}/${IDS.length} present · ${(bytes / 1048576).toFixed(0)} MB`);
for (const f of failed) console.log(`  ! ${f}`);

// ── contact sheet ────────────────────────────────────────────────────────────
// Original on the LEFT, the bundled clip on the RIGHT, both at true display
// width, one frame from 1.5 s in. Frame timing will not match exactly — the two
// encodes place keyframes differently and the glow in these clips drifts — so
// small differences in brightness between columns are the seek, not the codec.
const pairs = [];
for (const id of SAMPLE) {
  const o = join(ORIG, `${id}.mp4`);
  const s = join(BUNDLED, `${id}.mp4`);
  if (!existsSync(o) || !existsSync(s)) continue;
  const out = join(ORIG, `_cmp_${id}.png`);
  ff([
    '-ss', '1.5', '-i', o,
    '-ss', '1.5', '-i', s,
    '-filter_complex',
    `[0:v]scale=${VIEW}:-2,pad=iw+8:ih:0:0:black[a];[1:v]scale=${VIEW}:-2[b];[a][b]hstack`,
    '-frames:v', '1', out,
  ]);
  pairs.push(out);
}

if (!pairs.length) {
  console.log('\nNo bundled clips to compare against — run scripts/bundle-video.mjs first.');
} else {
  const sheet = join(root, 'scripts', 'video-compare.png');
  ff([
    ...pairs.flatMap((p) => ['-i', p]),
    '-filter_complex', `${pairs.map((_, i) => `[${i}:v]`).join('')}vstack=inputs=${pairs.length}`,
    '-frames:v', '1', sheet,
  ]);
  console.log(`\ncontact sheet: scripts/video-compare.png  (original LEFT, bundled RIGHT)`);
  console.log(`rows top to bottom: ${SAMPLE.join(', ')}`);
  console.log('\nLook at the name banners. If the right column is as legible as the left,');
  console.log('the encode held. If not, lower QUALITY in scripts/bundle-video.mjs — it');
  console.log('stamps its settings and will re-encode everything when they change.');
}
