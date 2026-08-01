#!/usr/bin/env node
/**
 * Verifies the claim scripts/encode-music.mjs makes: that every bed in
 * assets/music/ is its own seamless loop.
 *
 *     node scripts/check-loops.mjs
 *
 * The other gates in this repo check that data is well-formed. This one checks
 * a claim about bytes we generated, in the same spirit as check-assets (a
 * filename describes its contents) and check-image-styles (an image is sized by
 * its layout). "I ran ffmpeg and it exited 0" is not evidence that a file loops.
 *
 * WHAT IT MEASURES. A baked loop has two observable properties:
 *
 *   1. Neither end is silent. If the tail decayed to nothing, or the head fades
 *      in from nothing, the join is a hole in the music — the exact artefact the
 *      silence trim exists to prevent, and the one most likely to survive it
 *      because a generator's fade-out is not digital silence.
 *   2. The two ends are at the same level. By construction output(0) and
 *      output(L) are the same instant of source audio, so their loudness should
 *      agree closely. A gap between them means the crossfade landed somewhere
 *      it shouldn't have.
 *
 * WHAT IT DOES NOT MEASURE. Whether the join is *musical* — whether the key,
 * the beat and the phrase line up. No cheap measurement catches that; only
 * listening does. This gate rules out the mechanical failures so that what is
 * left to judge by ear is genuinely a matter of taste.
 *
 * It also does not measure the decoder. A file can loop perfectly and still
 * tick on a device if the AAC decoder inserts its priming silence on every
 * repeat. That is a playback question, answered in src/audio.tsx and on real
 * hardware — not here.
 */
import { execFileSync, execSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(root, 'assets', 'music');

/** Fanfares are one-shots. They are supposed to end, so they are not loops. */
const ONE_SHOT = /^win\d*$/;

/** Window measured at each end. Long enough to average out a transient, short
 *  enough to still be "the edge" of the file. */
const WIN = 0.3;

/** Below this the edge is effectively silent and the loop has a hole in it. */
const SILENT_DB = -45;

/** Loudness the two ends may differ by before the join is audible as a step. */
const MAX_STEP_DB = 4;

for (const bin of ['ffmpeg', 'ffprobe']) {
  try {
    execSync(`${bin} -version`, { stdio: 'ignore' });
  } catch {
    console.error(`${bin} not found on PATH — install ffmpeg and re-run.`);
    process.exit(1);
  }
}

if (!existsSync(DIR)) {
  console.error(`no ${DIR} — run scripts/encode-music.mjs first.`);
  process.exit(1);
}

function duration(file) {
  const out = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file],
    { encoding: 'utf8' }
  );
  return parseFloat(out.trim());
}

/**
 * RMS level in dBFS over [from, from+len) seconds. -Infinity for silence.
 *
 * This decodes the window to raw PCM and does the arithmetic here rather than
 * asking ffmpeg's `astats` filter and parsing its log. Parsing was the first
 * version and it was wrong twice over: astats writes to stderr at INFO level,
 * which `-v error` suppresses outright, and execFileSync returns stdout, so
 * there was nothing to match against either way. Reading samples has no such
 * failure mode — the numbers come from the audio, not from a log line whose
 * format and verbosity are someone else's to change.
 */
function rms(file, from, len) {
  const pcm = execFileSync(
    'ffmpeg',
    [
      '-v', 'error',
      '-i', file,
      '-ss', from.toFixed(3),
      '-t', len.toFixed(3),
      '-f', 's16le', '-acodec', 'pcm_s16le', '-ac', '1', '-ar', '44100',
      '-',
    ],
    { maxBuffer: 1 << 26 }
  );
  const n = pcm.length >> 1;
  if (n === 0) return -Infinity;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const s = pcm.readInt16LE(i * 2) / 32768;
    sum += s * s;
  }
  const r = Math.sqrt(sum / n);
  return r > 0 ? 20 * Math.log10(r) : -Infinity;
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.m4a')).sort();
if (!files.length) {
  console.error(`no .m4a in ${DIR} — run scripts/encode-music.mjs first.`);
  process.exit(1);
}

let beds = 0;
let shots = 0;
const problems = [];

for (const f of files) {
  const name = f.replace(/\.m4a$/, '');
  const path = join(DIR, f);
  if (ONE_SHOT.test(name)) {
    shots++;
    continue;
  }
  beds++;
  const d = duration(path);
  const head = rms(path, 0, WIN);
  const tail = rms(path, Math.max(0, d - WIN), WIN);
  const step = Math.abs(head - tail);

  const notes = [];
  if (head <= SILENT_DB) notes.push(`head silent (${head.toFixed(1)} dB)`);
  if (tail <= SILENT_DB) notes.push(`tail silent (${tail.toFixed(1)} dB)`);
  if (Number.isFinite(step) && step > MAX_STEP_DB) notes.push(`${step.toFixed(1)} dB step at the join`);

  if (notes.length) {
    // A failure prints MORE than a pass, not less. The first version printed
    // only the note, which meant the one line you actually needed to diagnose
    // the problem — what the two ends measured — was the line it withheld.
    const detail =
      `${d.toFixed(1)}s  head ${head.toFixed(1)} dB  tail ${tail.toFixed(1)} dB  Δ${step.toFixed(1)}`;
    problems.push(`${name}: ${notes.join(', ')} — ${detail}`);
    console.log(`  ✗ ${name.padEnd(14)} ${detail}   ${notes.join(' · ')}`);
  } else {
    console.log(
      `  · ${name.padEnd(14)} ${d.toFixed(1)}s  head ${head.toFixed(1)} dB  tail ${tail.toFixed(1)} dB  Δ${step.toFixed(1)}`
    );
  }
}

console.log(`\n${beds} beds measured · ${shots} one-shots skipped · ${problems.length} with an audible join`);
if (problems.length) {
  console.log('\nRe-generate these, or widen LOOP_FADE in scripts/encode-music.mjs:');
  for (const p of problems) console.log(`  ! ${p}`);
  process.exit(1);
}
