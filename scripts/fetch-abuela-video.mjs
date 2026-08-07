#!/usr/bin/env node
/**
 * Download Abuela's six lip-synced clips and trim each to where she stops talking.
 *
 *     node scripts/fetch-abuela-video.mjs
 *
 * Run this ON londi-pc — the cloud session is firewalled from the generation
 * CDNs, same as fetch-abuela.mjs and fetch-audio.mjs.
 *
 * WHY THE TRIM. The first pass set each clip's duration by ESTIMATING how long
 * the speech would be, and several lines were longer than the clip asked for, so
 * she was cut off mid-sentence. The clips are now generated with deliberate
 * headroom and trimmed here to the measured end of speech instead — the same
 * correction master-voice.mjs makes for the voice lines, for the same reason:
 * a duration you guessed is a duration that is wrong on some inputs.
 *
 * The end of speech is found from the video's OWN audio track, so nothing has to
 * be kept in sync with a separate file. Trimming is a stream copy where possible
 * so the picture is never re-encoded.
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync, unlinkSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'assets', 'abuela');
const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_395qbESmCeG8JPbpOIha0lzedrS';

/** Silence below this counts as "she has stopped". */
const SILENCE_DB = -40;
/** Kept after the last speech, so the cut does not clip her final consonant. */
const TAIL = 0.35;

// Filled in by the session that generated them — see docs/superpowers/specs.
const CLIPS = [
  ['es-1', 'hf_20260807_170604_935e5a4c-2bf1-4c1e-a083-87c9610e7426.mp4'],
  ['es-2', 'hf_20260807_171150_3f4737fd-a2b2-483a-a9db-c948f0bc5e0d.mp4'],
  ['es-3', 'hf_20260807_170604_c8c99d0a-71c0-4718-a331-3162fc64cb16.mp4'],
  ['en-1', 'hf_20260807_171516_1ca60fd9-ddb5-483e-a970-bbe2ce0a8fe2.mp4'],
  ['en-2', 'hf_20260807_170604_4d86814a-05f2-48bf-be1c-cc2b721ad88c.mp4'],
  ['en-3', 'hf_20260807_171920_e24580d5-a8f9-42b3-9df3-cfed304ff2f9.mp4'],
];

/** Last moment the audio is above SILENCE_DB, measured not assumed. */
function speechEnd(file) {
  let out = '';
  try {
    execFileSync('ffmpeg', ['-v', 'info', '-nostdin', '-i', file,
      '-af', `silencedetect=noise=${SILENCE_DB}dB:d=0.25`, '-f', 'null', '-'],
      { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (e) {
    out = String(e.stderr ?? '');
  }
  if (!out) {
    try {
      out = execFileSync('/bin/sh', ['-c',
        `ffmpeg -v info -nostdin -i ${JSON.stringify(file)} -af silencedetect=noise=${SILENCE_DB}dB:d=0.25 -f null - 2>&1`],
        { encoding: 'utf8' });
    } catch { out = ''; }
  }
  const dur = Number(execFileSync('ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
    { encoding: 'utf8' }).trim());

  // The final silence_start with no silence_end after it is where she stopped.
  const starts = [...out.matchAll(/silence_start:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...out.matchAll(/silence_end:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  if (!starts.length) return dur;
  const last = starts[starts.length - 1];
  const trailing = ends.length < starts.length || ends[ends.length - 1] < last;
  return trailing ? Math.min(dur, last + TAIL) : dur;
}

mkdirSync(OUT, { recursive: true });
if (CLIPS.some(([, r]) => r.startsWith('REPLACE_'))) {
  console.error('✗ CLIPS still has placeholder filenames — this script was not finished.');
  process.exit(1);
}

console.log(`downloading ${CLIPS.length} clips → assets/abuela/\n`);
let failed = 0;
for (const [name, remote] of CLIPS) {
  const raw = join(OUT, `${name}.raw.mp4`);
  const dst = join(OUT, `${name}.mp4`);
  try {
    const res = await fetch(`${CDN}/${remote}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
    const full = Number(execFileSync('ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', raw],
      { encoding: 'utf8' }).trim());
    const end = speechEnd(raw);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-t', end.toFixed(2),
      '-c', 'copy', '-movflags', '+faststart', dst]);
    unlinkSync(raw);
    const mb = (statSync(dst).size / 1048576).toFixed(2);
    console.log(`  ok    ${name}.mp4   ${full.toFixed(1)}s → ${end.toFixed(1)}s   ${mb} MB`);
  } catch (e) {
    failed += 1;
    console.error(`  FAIL  ${name}: ${e.message}`);
    if (existsSync(raw)) unlinkSync(raw);
  }
}

if (failed) {
  console.error(`\n✗ ${failed} of ${CLIPS.length} failed. These URLs expire — a 403 means regenerate, not retry.`);
  process.exit(1);
}
const total = CLIPS.reduce((n, [name]) => n + statSync(join(OUT, `${name}.mp4`)).size, 0);
console.log(`\n✅ six clips in assets/abuela/, ${(total / 1048576).toFixed(1)} MB total`);
console.log(`   Compare against the bundle: node scripts/check-assets.mjs`);
