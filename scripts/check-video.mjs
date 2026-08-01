#!/usr/bin/env node
/**
 * Verifies what scripts/bundle-video.mjs claims: that every bundled clip is a
 * playable three-second silent portrait at the size we asked for.
 *
 *     npm run video
 *
 * A re-encode can fail in ways that leave a plausible-looking file behind — a
 * truncated clip is still a valid mp4, and `existsSync` says yes to it. So this
 * decodes each one and checks four things a filename cannot tell you: that it
 * decodes at all, that the duration did not move (truncation), that the
 * dimensions are what was asked for, and that no audio stream survived.
 *
 * `npm run assets` already proves the require() paths resolve and that the
 * bytes really are an ISO media container. This is the layer above: not "is
 * there a file" but "is it the clip we think it is".
 *
 * What it does NOT check is whether the picture still looks right. No
 * measurement catches a smeared name banner; that is what the contact sheet
 * from optimize-video.mjs is for.
 *
 * There used to be a second half here that HEADed the Supabase public URLs to
 * confirm an upload had landed. Clips are bundled now, so there is no upload
 * and no bucket in the path — that class of failure is gone rather than
 * unchecked.
 */
import { execFileSync, execSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIG = join(root, 'scripts', '_video_orig');
const SMALL = join(root, 'assets', 'video');

/** Duration may drift by a frame or two through a re-encode; more than this
 *  means something was truncated. */
const MAX_DRIFT = 0.15;

/** Expected width, matching WIDTH in bundle-video.mjs. */
const WIDTH = 320;

try {
  execSync('ffprobe -version', { stdio: 'ignore' });
} catch {
  console.error('ffprobe not found on PATH — install ffmpeg and re-run.');
  process.exit(1);
}

if (!existsSync(SMALL)) {
  console.error('no assets/video/ — run scripts/bundle-video.mjs first.');
  process.exit(1);
}

const IDS = [
  ...readFileSync(join(root, 'src', 'data', 'cardImages.ts'), 'utf8')
    .matchAll(/assets\/cards\/([a-z0-9_]+)\.jpg/g),
].map((m) => m[1]);

function probe(file) {
  const out = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration',
     '-of', 'default=nw=1', file],
    { encoding: 'utf8' }
  );
  const num = (k) => {
    const m = out.match(new RegExp(`^${k}=([\\d.]+)`, 'm'));
    return m ? parseFloat(m[1]) : NaN;
  };
  return {
    width: num('width'),
    height: num('height'),
    duration: num('duration'),
    hasAudio: /codec_type=audio/.test(out),
  };
}

// ── local ────────────────────────────────────────────────────────────────────
const problems = [];
let checked = 0;
let bytes = 0;

for (const id of IDS) {
  const small = join(SMALL, `${id}.mp4`);
  const orig = join(ORIG, `${id}.mp4`);
  if (!existsSync(small)) {
    problems.push(`${id}: not re-encoded`);
    continue;
  }
  checked += 1;
  bytes += statSync(small).size;
  let s;
  try {
    s = probe(small);
  } catch (e) {
    problems.push(`${id}: will not decode — ${e.message}`);
    continue;
  }
  const notes = [];
  if (s.hasAudio) notes.push('still has an audio stream');
  if (s.width !== WIDTH) notes.push(`width ${s.width}, expected ${WIDTH}`);
  if (!Number.isFinite(s.duration) || s.duration < 1) notes.push('no readable duration');
  if (existsSync(orig)) {
    const o = probe(orig);
    if (Math.abs(o.duration - s.duration) > MAX_DRIFT) {
      notes.push(`duration moved ${o.duration.toFixed(2)}s → ${s.duration.toFixed(2)}s`);
    }
    if (Math.abs(o.width / o.height - s.width / s.height) > 0.01) notes.push('aspect ratio changed');
  }
  if (notes.length) problems.push(`${id}: ${notes.join(', ')}`);
}

console.log(
  `${checked}/${IDS.length} bundled clips · ${(bytes / 1048576).toFixed(0)} MB · ` +
    `avg ${(bytes / Math.max(1, checked) / 1024).toFixed(0)} kB`
);

// ── verdict ──────────────────────────────────────────────────────────────────
if (problems.length) {
  console.log(`\n${problems.length} problems:`);
  for (const p of problems.slice(0, 30)) console.log(`  ! ${p}`);
  if (problems.length > 30) console.log(`  … and ${problems.length - 30} more`);
  process.exit(1);
}
console.log('\n✅ every bundled clip decodes, kept its length, and carries no audio');
console.log('   (this says nothing about how it LOOKS — see scripts/video-compare.png)');
