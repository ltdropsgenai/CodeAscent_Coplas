#!/usr/bin/env node
/**
 * Trim Abuela's clips to the end of her speech and re-encode them for the bundle.
 *
 *     node scripts/optimize-abuela-video.mjs
 *
 * TWO THINGS WENT WRONG WITH THE FIRST ATTEMPT, both worth recording.
 *
 * 1. The trim silently did nothing. It shelled out through `/bin/sh` to capture
 *    ffmpeg's stderr — and there is no /bin/sh on Windows, which is where this
 *    runs. The throw was swallowed by a catch, `speechEnd` returned the full
 *    duration for every clip, and the output looked like six successful trims of
 *    zero seconds each. spawnSync captures stderr directly on every platform and
 *    does not throw on a non-zero exit, so there is nothing left to swallow.
 *
 * 2. Six clips came to 20.6 MB against a stated budget of about 8. They were
 *    1024x768 at roughly 3 Mbps, for a frame that renders under 400pt wide on a
 *    phone. Downscaling to 640 wide and encoding by quality rather than bitrate
 *    gets the same picture at a fraction of the weight.
 *
 * Originals are moved to scripts/_abuela_orig/, not deleted, so a bad setting is
 * one command away from being undone. Safe to re-run: it always works FROM the
 * originals, so running twice cannot trim or re-compress twice.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, mkdirSync, existsSync, copyFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(root, 'assets', 'abuela');
const ORIG = join(root, 'scripts', '_abuela_orig');

/** Silence below this counts as "she has stopped talking". */
const SILENCE_DB = -40;
/** Kept after the last speech so the cut never clips a final consonant. */
const TAIL = 0.35;
/** Rendered under 400pt wide; 640 is already generous for that. */
const WIDTH = 640;
/** Constant-quality H.264. Lower is better quality and bigger. */
const CRF = 26;

const ff = (args) => spawnSync('ffmpeg', ['-hide_banner', '-nostdin', ...args], { encoding: 'utf8' });

function duration(file) {
  const r = spawnSync('ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
    { encoding: 'utf8' });
  return Number(String(r.stdout).trim());
}

/**
 * Where she stops talking, measured from the clip's own audio track.
 *
 * spawnSync, NOT execFileSync-in-a-shell: ffmpeg writes silencedetect to stderr
 * and exits 0, so there is no exception to catch and no shell needed to
 * redirect. The previous version needed /bin/sh and therefore worked on
 * precisely the platform this script is not run on.
 *
 * THE TRAILING SILENCE IS FOUND BY WHERE IT ENDS, NOT BY WHETHER IT ENDS. An
 * earlier version assumed the final silence would have no `silence_end`, since
 * it runs to the end of the file. This ffmpeg closes it at end-of-stream
 * instead, so that test never fired and every clip came back untrimmed while
 * reporting success. A silence is the trailing one when it reaches the end of
 * the clip — which is checkable — rather than when it fails to be closed, which
 * is a property of the encoder's logging.
 *
 * The windows are printed. Three attempts at this were spent guessing at
 * ffmpeg's output rather than reading it.
 */
function speechEnd(file) {
  const dur = duration(file);
  const r = ff(['-i', file, '-af', `silencedetect=noise=${SILENCE_DB}dB:d=0.25`, '-f', 'null', '-']);
  const out = String(r.stderr ?? '') + String(r.stdout ?? '');

  const starts = [...out.matchAll(/silence_start:\s*(-?[\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...out.matchAll(/silence_end:\s*(-?[\d.]+)/g)].map((m) => Number(m[1]));
  const windows = starts.map((st, i) => [st, ends[i] ?? dur]);

  if (!windows.length) return { end: dur, dur, detected: false, windows };

  const [lastStart, lastEnd] = windows[windows.length - 1];
  // Reaches the end of the clip (within a frame or two) => it is the tail.
  const reachesEnd = lastEnd >= dur - 0.35;
  const end = reachesEnd ? Math.min(dur, lastStart + TAIL) : dur;
  return { end, dur, detected: true, windows };
}

mkdirSync(ORIG, { recursive: true });
const files = readdirSync(DIR).filter((f) => /^(es|en)-\d\.mp4$/.test(f)).sort();
if (!files.length) {
  console.error('✗ no clips in assets/abuela — run scripts/fetch-abuela-video.mjs first');
  process.exit(1);
}
for (const f of files) {
  const kept = join(ORIG, f);
  if (!existsSync(kept)) copyFileSync(join(DIR, f), kept);
}

console.log(`optimising ${files.length} clips → ${WIDTH}px wide, CRF ${CRF}, trimmed at ${SILENCE_DB} dB\n`);
console.log(`${'clip'.padEnd(8)}${'was'.padStart(8)}${'now'.padStart(8)}${'MB was'.padStart(9)}${'MB now'.padStart(9)}`);

let undetected = 0;
let before = 0;
let after = 0;
for (const f of files) {
  const src = join(ORIG, f);
  const dst = join(DIR, f);
  const { end, dur, detected, windows } = speechEnd(src);
  if (!detected) undetected += 1;
  const wasMB = statSync(src).size / 1048576;

  const r = ff(['-y', '-i', src, '-t', end.toFixed(2),
    '-vf', `scale=${WIDTH}:-2:flags=lanczos`,
    '-c:v', 'libx264', '-crf', String(CRF), '-preset', 'slow', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '96k',
    '-movflags', '+faststart', dst]);
  if (r.status !== 0) {
    console.error(`\n✗ ffmpeg failed on ${f}:\n${String(r.stderr).split('\n').slice(-6).join('\n')}`);
    process.exit(1);
  }

  const nowMB = statSync(dst).size / 1048576;
  before += wasMB;
  after += nowMB;
  const w = windows.length
    ? windows.map(([a, b]) => `${a.toFixed(1)}-${b.toFixed(1)}`).join(' ')
    : '(none)';
  console.log(
    f.replace('.mp4', '').padEnd(8) +
      `${dur.toFixed(1)}s`.padStart(8) + `${end.toFixed(1)}s`.padStart(8) +
      wasMB.toFixed(2).padStart(9) + nowMB.toFixed(2).padStart(9) +
      '   silence: ' + w
  );
}

console.log(`\ntotal      ${before.toFixed(1)} MB → ${after.toFixed(1)} MB`);
if (undetected) {
  console.error(`\n✗ ${undetected} clip(s) produced no silencedetect output at all.` +
    `\n  That is the measurement failing, not a clip without silence — do not trust the trim.`);
  process.exit(1);
}
console.log(`\noriginals in scripts/_abuela_orig/ — re-running always works from those.`);
