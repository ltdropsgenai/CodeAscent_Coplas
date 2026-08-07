#!/usr/bin/env node
/**
 * The celebration voice lines must be interchangeable.
 *
 *     node scripts/check-voice.mjs
 *
 * WHY. app/play.tsx and src/audio.tsx draw a clip at random and then make four
 * claims about it. Every claim was false, and nothing noticed for four builds:
 *
 *   "lands a beat INTO the fanfare" — the 420 ms offset was exact, but lead
 *      silence ran 1-221 ms, so the real gap varied by a fifth of a second
 *      depending on the draw. That jitter is what read as stilted.
 *   "the music comes back the moment the voice stops" — the un-duck fires on
 *      end of FILE and tails ran to 449 ms.
 *   VOICE_VOLUME = 1 for all of them — speech RMS spanned 26.7 dB, so whether
 *      you heard the line at all was decided by which one came up.
 *   nothing subsonic — ten clips carried 20-60 Hz energy 40-53 dB above their
 *      own speech band.
 *
 * A random draw is only safe if the pool is uniform. This asserts that it is,
 * so one hot re-render or one untrimmed clip cannot quietly reintroduce any of
 * the above. Bounds are deliberately a little wider than what
 * scripts/master-voice.mjs produces, so ordinary encoder variation passes and
 * an unmastered file does not.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(root, 'assets', 'audio', 'voice');
const SR = 44100;

const RMS_TARGET = -16, RMS_TOL = 3;   // dB
const PEAK_CEIL = 0.0;                  // dBFS, must not reach full scale
const LEAD_MAX = 0.060, TAIL_MAX = 0.160; // s
/**
 * Sub-60 Hz RMS relative to the speech band. A COARSE BACKSTOP, not a precise
 * instrument, and worth saying so. Calibrated against the two populations that
 * actually exist: unmastered originals measure p50 -38.1 / max -5.2 dB, the
 * mastered pool p50 -50.2 / max -19.5. They overlap, so this catches a clip
 * dropped in raw and will not catch one that is merely a bit rumbly. The first
 * version of this measurement used -24 dB/oct filters whose skirts overlapped
 * so badly it was comparing speech against speech; the cascades below give a
 * clean gap between 60 and 400 Hz.
 */
const SUBSONIC_MAX = -15;
const ONSET = 0.02;

const db = (x) => 20 * Math.log10(x + 1e-12);

/**
 * Decode `file` (optionally through a filter) as mono float at SR.
 *
 * The band measurements go through ffmpeg's own filters rather than a DFT
 * written here. The first version of this check hand-rolled one and summed
 * every 8th sample while using full-rate phase — which decimates by 8 and
 * folds everything above 2.8 kHz back into the speech band it was supposed to
 * be comparing against. It reported a number for every clip and the number was
 * meaningless. Filtered RMS is exact, and it is three lines.
 */
function pcm(file, filter) {
  const args = ['-v', 'error', '-nostdin', '-i', file];
  if (filter) args.push('-af', filter);
  args.push('-ac', '1', '-ar', String(SR), '-f', 'f32le', '-');
  const raw = execFileSync('ffmpeg', args, { maxBuffer: 1 << 28 });
  return new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 4));
}
const rmsOf = (x, a = 0, b = x.length - 1) => {
  let s = 0;
  for (let i = a; i <= b; i++) s += x[i] * x[i];
  return Math.sqrt(s / Math.max(1, b - a + 1));
};

function analyse(file) {
  const x = pcm(file);
  let peak = 0;
  for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > peak) peak = a; }
  const th = peak * ONSET;
  let on = 0; while (on < x.length && Math.abs(x[on]) <= th) on++;
  let off = x.length - 1; while (off > on && Math.abs(x[off]) <= th) off--;

  // Subsonic energy relative to the speech band, measured over the speech
  // itself — after trimming there is almost no silence left to measure, which
  // is the point of the trimming.
  const lo = pcm(file, 'lowpass=f=60,lowpass=f=60,lowpass=f=60,lowpass=f=60');
  const hi = pcm(file, 'highpass=f=400,highpass=f=400,highpass=f=400,highpass=f=400,lowpass=f=6000');
  const subsonic = db(rmsOf(lo, on, Math.min(off, lo.length - 1))) -
                   db(rmsOf(hi, on, Math.min(off, hi.length - 1)));

  return {
    peakDb: db(peak),
    rmsDb: db(rmsOf(x, on, off)),
    lead: on / SR,
    tail: (x.length - off) / SR,
    subsonic,
    dur: x.length / SR,
  };
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.mp3')).sort();
if (!files.length) { console.error('✗ no voice clips in assets/audio/voice'); process.exit(1); }

const bad = [];
const rows = files.map((f) => ({ f, ...analyse(join(DIR, f)) }));
for (const r of rows) {
  const why = [];
  if (Math.abs(r.rmsDb - RMS_TARGET) > RMS_TOL) why.push(`RMS ${r.rmsDb.toFixed(1)} dBFS`);
  if (r.peakDb >= PEAK_CEIL) why.push(`peak ${r.peakDb.toFixed(1)} dBFS`);
  if (r.lead > LEAD_MAX) why.push(`lead ${(r.lead * 1000).toFixed(0)} ms`);
  if (r.tail > TAIL_MAX) why.push(`tail ${(r.tail * 1000).toFixed(0)} ms`);
  if (r.subsonic > SUBSONIC_MAX) why.push(`subsonic ${r.subsonic.toFixed(0)} dB rel. speech`);
  if (why.length) bad.push(`${r.f.replace(/\.mp3$/, '')}: ${why.join(', ')}`);
}

const rms = rows.map((r) => r.rmsDb);
console.log(`voice clips     ${rows.length}`);
console.log(`speech RMS      ${Math.min(...rms).toFixed(1)} … ${Math.max(...rms).toFixed(1)} dBFS  (spread ${(Math.max(...rms) - Math.min(...rms)).toFixed(1)} dB, target ${RMS_TARGET} ±${RMS_TOL})`);
console.log(`worst peak      ${Math.max(...rows.map((r) => r.peakDb)).toFixed(1)} dBFS`);
console.log(`lead silence    max ${(Math.max(...rows.map((r) => r.lead)) * 1000).toFixed(0)} ms  (limit ${LEAD_MAX * 1000})`);
console.log(`tail silence    max ${(Math.max(...rows.map((r) => r.tail)) * 1000).toFixed(0)} ms  (limit ${TAIL_MAX * 1000})`);

if (bad.length) {
  console.error(`\n✗ ${bad.length} clip(s) are not interchangeable with the rest:`);
  for (const b of bad) console.error(`  ${b}`);
  console.error(`\n  Run: node scripts/master-voice.mjs   (it masters from scripts/_voice_orig/)`);
  process.exit(1);
}
console.log(`\n✅ every voice line is level, trimmed and free of subsonic content`);
