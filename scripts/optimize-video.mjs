#!/usr/bin/env node
/**
 * Re-encodes every card's "living portrait" clip smaller and puts it back.
 *
 *     node scripts/optimize-video.mjs          # download + encode + compare  (NO uploads)
 *     $env:SUPABASE_SERVICE_KEY="..."         # then, once you like what you see
 *     node scripts/optimize-video.mjs          # ... same command, now uploads
 *
 * WHY. Video is the only thing Coplas still fetches at runtime. Each clip is
 * ~1.3 MB for three seconds at 720x960 — about 3.5 Mbps, which is roughly what
 * a full-motion 720p stream costs. These are deliberately near-static: locked
 * camera, a slow blink, a flicker. Low motion is the cheapest thing there is to
 * compress, so most of those bits describe a picture that is not changing.
 *
 * The win celebration plays up to eight at once (~10 MB per win) and Home plays
 * one per app open. Worse, the round composer prefers cards you have seen least
 * recently, which is exactly the access pattern that defeats expo-video's
 * on-device cache — a new player's clips are nearly all cache misses.
 *
 * WHAT IT DOES NOT DO. No regeneration, no prompts, no credits. The motion,
 * framing and duration are untouched. Files go back to the SAME paths, so
 * nothing in the app changes and builds already on testers' phones get cheaper
 * without a new release.
 *
 * THE RISK, NAMED. src/components/CardVideo.tsx does NOT draw a vector name
 * plate the way CardTile does — each card's printed name is baked into the
 * video frames. So the first thing a too-aggressive encode destroys is the
 * lettering on the banner, and vintage paper grain makes it worse, because
 * film-like noise is expensive to encode and gets smeared into mush. That is
 * why this script writes a before/after contact sheet at true display size and
 * why phase one uploads nothing. Judge the banners with your eyes; the file
 * sizes below cannot tell you about them.
 *
 * REVERSIBLE. Originals are kept in scripts/_video_orig/ (~1.26 GB). If the
 * comparison looks bad, raise QUALITY, delete scripts/_video_small/, and run
 * again. If an upload has already happened, re-upload from _video_orig/ by
 * setting RESTORE = true below.
 *
 * REQUIRES ffmpeg and ffprobe on PATH.
 */
import { execFileSync, execSync } from 'node:child_process';
import {
  writeFileSync, appendFileSync, readFileSync, mkdirSync,
  existsSync, statSync, readdirSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIG = join(root, 'scripts', '_video_orig');
const SMALL = join(root, 'scripts', '_video_small');
const LEDGER = join(root, 'scripts', '_video_uploaded.txt');
for (const d of [ORIG, SMALL]) mkdirSync(d, { recursive: true });

const PROJECT = 'bmybvrqbpachjxrejxdj';
const PUBLIC = `https://${PROJECT}.supabase.co/storage/v1/object/public/video`;
const UPLOAD = `https://${PROJECT}.supabase.co/storage/v1/object/video`;

// ── encode settings ──────────────────────────────────────────────────────────
// Deliberately conservative. The Home hero is 128 pt, which is 384 px on a 3x
// screen, and celebration tiles are smaller again — so 540 wide is already more
// resolution than anything on screen needs, and the headroom is there to keep
// the name banner crisp rather than to look good on a spec sheet.
//
// No -tune. `stillimage` sounds right for near-static footage and is a trap
// here: it raises deblocking, which is precisely what eats paper grain and
// softens small lettering. If the contact sheet shows mush, lower QUALITY (CRF
// is inverted — smaller number, better picture) before touching anything else.
const WIDTH = 540;
const QUALITY = 26; // CRF
const PRESET = 'slow'; // one-time cost, so buy the compression
const MAXRATE = '900k';

/** Cards to put in the before/after contact sheet. Spread across subjects so
 *  the sample covers busy art, plain art, faces and text-heavy banners. */
const SAMPLE = ['el_sol', 'la_dama', 'el_borracho', 'la_sirena', 'el_musico', 'la_luna'];

/** Set true to push the ORIGINALS back up, undoing an upload. */
const RESTORE = false;

// ── toolchain ────────────────────────────────────────────────────────────────
for (const bin of ['ffmpeg', 'ffprobe']) {
  try {
    execSync(`${bin} -version`, { stdio: 'ignore' });
  } catch {
    console.error(`${bin} not found on PATH.\n`);
    console.error('  Windows :  winget install Gyan.FFmpeg');
    console.error('  macOS   :  brew install ffmpeg');
    process.exit(1);
  }
}

const KEY = process.env.SUPABASE_SERVICE_KEY || '';
const willUpload = KEY.length > 0;

// ── the deck ─────────────────────────────────────────────────────────────────
// Ids come from the generated card-art registry rather than from cards.ts,
// because that registry is exactly what the app can reference: one require()
// per card, named for its id. Anything in the bucket that is not in here is an
// orphan we have no reason to touch.
const IDS = [
  ...readFileSync(join(root, 'src', 'data', 'cardImages.ts'), 'utf8')
    .matchAll(/assets\/cards\/([a-z0-9_]+)\.jpg/g),
].map((m) => m[1]);
if (IDS.length < 900) {
  console.error(`only found ${IDS.length} card ids — refusing to run on a partial deck.`);
  process.exit(1);
}

const uploaded = new Set(
  existsSync(LEDGER) ? readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean) : []
);

function ff(args) {
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...args], { stdio: 'inherit' });
}

function probe(file, entries) {
  return execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', entries, '-of', 'default=nw=1:nk=1', file],
    { encoding: 'utf8' }
  ).trim();
}

async function fetchRetry(url, opts = {}, tries = 4) {
  let last;
  for (let a = 1; a <= tries; a++) {
    try {
      const res = await fetch(url, opts);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
      return res;
    } catch (e) {
      last = e;
      if (a < tries) await new Promise((r) => setTimeout(r, 400 * 2 ** a));
    }
  }
  const why = last?.cause?.message || last?.cause?.code;
  throw new Error(`${last?.message ?? last}${why ? ` (${why})` : ''} after ${tries} tries`);
}

// ── one card, end to end ─────────────────────────────────────────────────────
async function handle(id) {
  const orig = join(ORIG, `${id}.mp4`);
  const small = join(SMALL, `${id}.mp4`);

  if (!existsSync(orig) || statSync(orig).size < 20000) {
    const res = await fetchRetry(`${PUBLIC}/${id}.mp4`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 20000) throw new Error(`suspiciously small (${buf.length}B)`);
    writeFileSync(orig, buf);
  }

  if (!existsSync(small) || statSync(small).size < 5000) {
    ff([
      '-i', orig,
      '-an', // clips are muted; an audio track is pure waste
      '-vf', `scale=${WIDTH}:-2`,
      '-c:v', 'libx264',
      '-profile:v', 'high',
      '-pix_fmt', 'yuv420p',
      '-preset', PRESET,
      '-crf', String(QUALITY),
      '-maxrate', MAXRATE,
      '-bufsize', '1800k',
      '-movflags', '+faststart',
      small,
    ]);
  }

  if (willUpload && !uploaded.has(id)) {
    const body = readFileSync(RESTORE ? orig : small);
    await fetchRetry(`${UPLOAD}/${id}.mp4`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${KEY}`,
        'content-type': 'video/mp4',
        // Overwrite in place. Same path means no app change and no chance of
        // the manifest drifting from the bucket.
        'x-upsert': 'true',
        // A day, not a year. These objects are being mutated right now, so a
        // long immutable cache would strand the old bytes at the edge.
        'cache-control': 'max-age=86400',
      },
      body,
    });
    // Written the instant it succeeds, before the next card starts. An upload
    // that happened but was not recorded turns a resumable run into a redo.
    appendFileSync(LEDGER, `${id}\n`);
    uploaded.add(id);
  }

  return { before: statSync(orig).size, after: statSync(small).size };
}

// ── run, with a small pool ───────────────────────────────────────────────────
const POOL = 3;
let before = 0;
let after = 0;
let done = 0;
const failed = [];

async function worker(queue) {
  for (;;) {
    const id = queue.pop();
    if (!id) return;
    try {
      const r = await handle(id);
      before += r.before;
      after += r.after;
      done += 1;
      if (done % 25 === 0 || done === IDS.length) {
        const pct = ((1 - after / Math.max(1, before)) * 100).toFixed(0);
        process.stdout.write(
          `  ${String(done).padStart(4)}/${IDS.length}  ` +
            `${(before / 1e6).toFixed(0)} MB → ${(after / 1e6).toFixed(0)} MB  (-${pct}%)\n`
        );
      }
    } catch (e) {
      failed.push(`${id}: ${e.message}`);
      console.error(`  ✗ ${id} — ${e.message}`);
    }
  }
}

const queue = [...IDS].reverse();
console.log(
  `${IDS.length} clips · ${willUpload ? (RESTORE ? 'RESTORING ORIGINALS' : 'will upload') : 'local only, no uploads'}\n`
);
await Promise.all(Array.from({ length: POOL }, () => worker(queue)));

// ── before/after contact sheet ───────────────────────────────────────────────
// One frame from 1.5 s in, original beside re-encode, both at 384 px — the
// exact pixel width the Home hero occupies on a 3x screen. This is the part
// that answers the only question the file sizes cannot.
const sheet = join(root, 'scripts', 'video-compare.png');
const pairs = [];
for (const id of SAMPLE) {
  const o = join(ORIG, `${id}.mp4`);
  const s = join(SMALL, `${id}.mp4`);
  if (!existsSync(o) || !existsSync(s)) continue;
  const out = join(SMALL, `_cmp_${id}.png`);
  ff([
    '-ss', '1.5', '-i', o,
    '-ss', '1.5', '-i', s,
    '-filter_complex',
    '[0:v]scale=384:-2,pad=iw+8:ih:0:0:black[a];[1:v]scale=384:-2[b];[a][b]hstack',
    '-frames:v', '1', out,
  ]);
  pairs.push(out);
}
if (pairs.length) {
  ff([
    ...pairs.flatMap((p) => ['-i', p]),
    '-filter_complex', `${pairs.map((_, i) => `[${i}:v]`).join('')}vstack=inputs=${pairs.length}`,
    '-frames:v', '1', sheet,
  ]);
  console.log(`\ncontact sheet: scripts/video-compare.png  (original LEFT, re-encoded RIGHT)`);
  console.log(`rows, top to bottom: ${SAMPLE.filter((id) => existsSync(join(SMALL, `_cmp_${id}.png`))).join(', ')}`);
}

// ── report ───────────────────────────────────────────────────────────────────
const pct = ((1 - after / Math.max(1, before)) * 100).toFixed(1);
console.log(
  `\n${done}/${IDS.length} processed · ${(before / 1e6).toFixed(0)} MB → ${(after / 1e6).toFixed(0)} MB  (-${pct}%)`
);
console.log(`per win celebration (8 clips): ~${((after / Math.max(1, done)) * 8 / 1e6).toFixed(1)} MB`);
for (const f of failed) console.log(`  ! ${f}`);

if (!willUpload) {
  console.log('\nNOTHING WAS UPLOADED. Open scripts/video-compare.png and look at the');
  console.log('name banners on the right-hand side of each row. If they are as legible');
  console.log('as the left, set SUPABASE_SERVICE_KEY and run this again to push.');
  console.log('If they are soft, lower QUALITY in this file, delete scripts/_video_small/,');
  console.log('and re-run — the originals are cached so nothing downloads twice.');
} else {
  console.log(`\nuploaded ${uploaded.size}/${IDS.length}. Verify with: node scripts/check-video.mjs`);
}
console.log('\nOriginals kept in scripts/_video_orig/ — delete by hand once you are happy.');
