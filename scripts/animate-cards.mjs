#!/usr/bin/env node
/**
 * Fetches the newly generated clips for the three replaced cards and
 * normalises them into scripts/_video_orig/ so bundle-video.mjs can pick
 * them up like every other clip.
 *
 *     node scripts/animate-cards.mjs
 *     node scripts/bundle-video.mjs      # then re-bundle
 *
 * WHY THIS EXISTS SEPARATELY from replace-cards.mjs: that script replaces a
 * card's ART and deletes the clip that animated the old picture. This one adds
 * the clip back once the new picture has been animated. Two steps because
 * generating the animation is not instant, and a deck that is briefly missing
 * three animations is fine — a deck whose `cardVideos.ts` require()s a file
 * that is not there is a Metro build failure.
 *
 * TWO NORMALISATIONS, both of which the raw output needs:
 *
 * 1. GEOMETRY. The generator only offers 9:16 and the deck is 3:4, so it
 *    letterboxes the card into a taller frame. Dropped in as-is, those three
 *    cards would render with black bars while all 992 others fill the tile.
 *    `cropdetect` finds the real content box rather than assuming where the
 *    bars are — an assumption that would silently shave the name banner off
 *    the bottom if the model centred the image differently.
 *
 * 2. DURATION. The shortest clip the generator makes is 5 s; the deck runs at
 *    ~3.1 s. This matters beyond tidiness: the win celebration plays clips
 *    against a fixed beat, so one card running two seconds long is visible.
 */
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIG = join(root, 'scripts', '_video_orig');
const TMP = join(root, 'scripts', '_animate_tmp');
mkdirSync(ORIG, { recursive: true });
mkdirSync(TMP, { recursive: true });

const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_395qbESmCeG8JPbpOIha0lzedrS';

/** Generated 2026-08-01 from the regenerated stills. */
const CLIPS = {
  el_talon: `${CDN}/hf_20260801_072932_bd302506-2fbf-4173-aa5b-d4615909e93d.mp4`,
  el_zancudo: `${CDN}/hf_20260801_072950_98fc2029-f605-4294-be81-9fa8073f317d.mp4`,
  la_mora: `${CDN}/hf_20260801_073007_7b283c41-3043-41fb-8c98-c6f255dc2dc2.mp4`,
};

/** Match the rest of the deck. Measured off scripts/_video_orig/el_mosquito.mp4. */
const W = 830;
const H = 1112;
const SECONDS = 3.1;

try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
} catch {
  console.error('ffmpeg/ffprobe not found on PATH.\n  Windows: winget install Gyan.FFmpeg');
  process.exit(1);
}

async function download(url, dest, tries = 4) {
  for (let i = 1; i <= tries; i += 1) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await writeFile(dest, Buffer.from(await res.arrayBuffer()));
      return;
    } catch (e) {
      // undici's bare "fetch failed" hides the real cause; e.cause has it.
      const why = e.cause ? `${e.message} (${e.cause.message ?? e.cause})` : e.message;
      if (i === tries) throw new Error(why);
      console.log(`    retry ${i}/${tries - 1} — ${why}`);
      await new Promise((r) => setTimeout(r, 800 * i));
    }
  }
}

/**
 * Find the letterboxed card inside the frame.
 *
 * cropdetect is sampled over several seconds and reports the most common box.
 * `round=2` keeps the result even-dimensioned, which libx264 requires. A very
 * low threshold (limit=8) is deliberate: the card's own backdrop is a dark
 * warm amber, and a normal threshold happily crops INTO the artwork.
 */
function detectCrop(file) {
  // spawnSync, NOT execFileSync. cropdetect reports on STDERR at INFO level,
  // and execFileSync returns stdout — so the obvious version of this function
  // reads an empty string, finds no match, and silently falls back to the
  // geometric default forever. That exact bug (a log-scraper reading the wrong
  // stream, and a fallback quiet enough to hide it) already cost this repo two
  // rewrites of check-loops.mjs. Read stderr on purpose, and shout if empty.
  const r = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-i', file, '-vf', 'cropdetect=limit=8:round=2:reset=0',
     '-frames:v', '120', '-f', 'null', '-'],
    { encoding: 'utf8' }
  );
  const log = `${r.stderr ?? ''}${r.stdout ?? ''}`;
  if (!log.includes('cropdetect')) {
    console.log('    (cropdetect produced no output — check the ffmpeg build)');
    return null;
  }
  const hits = [...log.matchAll(/crop=\d+:\d+:\d+:\d+/g)];
  return hits.length ? hits[hits.length - 1][0] : null;
}

let ok = 0;
for (const [id, url] of Object.entries(CLIPS)) {
  const raw = join(TMP, `${id}.raw.mp4`);
  const dst = join(ORIG, `${id}.mp4`);
  console.log(`\n${id}`);
  try {
    console.log('  downloading…');
    await download(url, raw);
    console.log(`    ${(statSync(raw).size / 1048576).toFixed(1)} MB`);

    let crop = null;
    try {
      crop = detectCrop(raw);
    } catch {
      /* fall through to the geometric default below */
    }
    // Fallback: a 3:4 image fitted to a 720-wide 9:16 frame is 720x960 with
    // 160 px bars. Used only when cropdetect finds nothing at all.
    const vf = crop
      ? `${crop},scale=${W}:${H}:flags=lanczos`
      : `crop=iw:iw*4/3:0:(ih-iw*4/3)/2,scale=${W}:${H}:flags=lanczos`;
    console.log(`  crop: ${crop ?? 'cropdetect found nothing — using the 3:4 centre'}`);

    execFileSync(
      'ffmpeg',
      ['-y', '-v', 'error', '-i', raw, '-t', String(SECONDS),
       '-an', '-vf', vf, '-r', '24',
       '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
       '-preset', 'slow', '-crf', '18', '-movflags', '+faststart', dst],
      { stdio: 'inherit' }
    );

    const probe = execFileSync(
      'ffprobe',
      ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height',
       '-show_entries', 'format=duration', '-of', 'csv=p=0', dst],
      { encoding: 'utf8' }
    ).trim().split(/\s+/).join(' ');
    console.log(`  ✓ ${dst.replace(root, '.')}  ${probe}  ${(statSync(dst).size / 1024).toFixed(0)} kB`);
    ok += 1;
  } catch (e) {
    console.error(`  ✗ ${id} — ${e.message}`);
  }
}

rmSync(TMP, { recursive: true, force: true });

console.log(`\n${ok}/${Object.keys(CLIPS).length} clips normalised into scripts/_video_orig/`);
if (ok === Object.keys(CLIPS).length) {
  console.log('\nNext:');
  console.log('  1. Remove all three entries from STILL_ONLY in scripts/bundle-video.mjs');
  console.log('  2. node scripts/bundle-video.mjs');
  console.log('  3. npm run check');
} else {
  console.error('\nSome clips failed. bundle-video.mjs will keep them in STILL_ONLY, which is safe.');
  process.exit(1);
}
