#!/usr/bin/env node
/**
 * Master the celebration voice lines so the app's assumptions about them hold.
 *
 *     node scripts/master-voice.mjs
 *
 * WHY. The 46 clips came straight off the TTS renders via fetch-audio.mjs and
 * were bundled as-is. Nothing measured them, and app/play.tsx + src/audio.tsx
 * make four specific claims about them that were all false:
 *
 *   "the exclamation lands a beat INTO the fanfare"  — lead silence ran from
 *      1 ms to 221 ms, so the carefully chosen 420 ms offset actually landed
 *      anywhere between 421 and 641 ms depending on which clip was drawn.
 *   "the music comes back the moment the voice stops" — the un-duck fires on
 *      didJustFinish, the end of the FILE, and tails ran to 449 ms of silence.
 *   VOICE_VOLUME = 1 applied to every clip — integrated loudness ranged from
 *      -11.6 LUFS (campeon) to -36.3 (que_vaina_buena). A 24.7 LU spread, so
 *      which line you drew decided whether you heard it at all. Reported as
 *      "not all of the voices are audible, the volume is very low on some".
 *   No subsonic content — about ten clips carried 20-60 Hz energy 40-53 dB
 *      above their own speech band.
 *
 * WHAT IT DOES. Trim to the actual speech, high-pass away the rumble, then
 * apply a FLAT GAIN computed from the RMS of the speech itself, with a true-peak
 * limiter to catch the transients.
 *
 * NOT loudnorm. The obvious tool is two-pass EBU R128 loudnorm, and it was tried
 * first and made things measurably worse: every clip came out quieter, by up to
 * 33 dB, and the loudness spread widened from 26.0 to 36.5 LU. R128 integrates
 * over gated 400 ms blocks and ffmpeg's own docs warn it is unreliable under
 * about three seconds. These clips are 0.5-1.4 s, so the gate was discarding
 * most of each one and the "correction" was computed from what was left. A
 * one-second exclamation is not a programme; it does not have an integrated
 * loudness worth measuring. Plain RMS over the speech region does, and it is
 * exact rather than estimated.
 *
 * NORMALISING QUIETLY RAISES NOISE — worth checking, and it checks out here:
 * the quiet clips are the clean ones (que_vaina_buena needs the most gain and
 * has a -87 dBFS floor) while the noisy-floored ones are the loud ones and get
 * cut. The 80 Hz high-pass runs before the gain, so the rumble is not amplified
 * either.
 *
 * Originals are kept in scripts/_voice_orig/, not deleted. Safe to re-run: it
 * always masters FROM the originals, never from its own output, so running it
 * twice cannot stack two rounds of gain — which is also what made recovering
 * from the loudnorm attempt a single command.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(root, 'assets', 'audio', 'voice');
const ORIG = join(root, 'scripts', '_voice_orig');

/** RMS of the speech, in dBFS. Celebratory, and it must cut through a ducked bed. */
const TARGET_RMS = -16;
/** Ceiling after gain. The limiter catches plosives without flattening the read. */
const CEILING_DB = -1.0;
/** Fixed silence either side, so the offsets in app/play.tsx mean what they say. */
const LEAD_MS = 20;
const TAIL_MS = 80;
const HP_HZ = 85;
/** Two poles is -12 dB/oct, which leaves 50 Hz barely touched. Cascade for -24. */
const HP = `highpass=f=${HP_HZ},highpass=f=${HP_HZ}`;
const SR = 44100;
/** Speech onset, as a fraction of the clip's own peak. */
const ONSET = 0.02;
/** Never trust a computed gain beyond this; something is wrong with the clip. */
const MAX_GAIN = 30;
const MIN_GAIN = -20;

const ff = (args) =>
  execFileSync('ffmpeg', ['-v', 'error', '-nostdin', ...args], { maxBuffer: 1 << 28 });

const db = (x) => 20 * Math.log10(x + 1e-12);

/** Decode to mono float and report speech bounds, RMS over the speech, and peak. */
function analyse(file, filtered = false) {
  const args = ['-i', file];
  if (filtered) args.push('-af', HP);
  args.push('-ac', '1', '-ar', String(SR), '-f', 'f32le', '-');
  const raw = ff(args);
  const x = new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 4));
  let peak = 0;
  for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > peak) peak = a; }
  const th = peak * ONSET;
  let on = 0; while (on < x.length && Math.abs(x[on]) <= th) on++;
  let off = x.length - 1; while (off > on && Math.abs(x[off]) <= th) off--;
  let sum = 0; for (let i = on; i <= off; i++) sum += x[i] * x[i];
  const rms = Math.sqrt(sum / Math.max(1, off - on + 1));
  return {
    peakDb: db(peak),
    rmsDb: db(rms),
    start: Math.max(0, on / SR - LEAD_MS / 1000),
    end: Math.min(x.length / SR, off / SR + TAIL_MS / 1000),
  };
}

mkdirSync(ORIG, { recursive: true });
const files = readdirSync(DIR).filter((f) => f.endsWith('.mp3')).sort();
if (!files.length) { console.error('no voice clips found'); process.exit(1); }
for (const f of files) {
  const kept = join(ORIG, f);
  if (!existsSync(kept)) copyFileSync(join(DIR, f), kept);
}

console.log(
  `mastering ${files.length} clips → RMS ${TARGET_RMS} dBFS, ceiling ${CEILING_DB} dB, ` +
  `HP ${HP_HZ} Hz x2, lead ${LEAD_MS} ms, tail ${TAIL_MS} ms\n`
);

const rows = [];
for (const f of files) {
  const src = join(ORIG, f);
  const dst = join(DIR, f);
  // Measure through the high-pass: the rumble must not count toward the RMS
  // the gain is derived from, or the noisiest clips come out the quietest.
  const a = analyse(src, true);
  let gain = TARGET_RMS - a.rmsDb;
  const clamped = Math.min(MAX_GAIN, Math.max(MIN_GAIN, gain));
  const dur = a.end - a.start;
  const fadeOut = Math.max(0, dur - 0.04);

  ff(['-y', '-i', src, '-af',
    `atrim=start=${a.start.toFixed(4)}:end=${a.end.toFixed(4)},asetpts=PTS-STARTPTS,` +
    `${HP},volume=${clamped.toFixed(2)}dB,` +
    `alimiter=level_in=1:level_out=1:limit=${Math.pow(10, CEILING_DB / 20).toFixed(4)}:attack=1:release=40,` +
    `afade=t=in:st=0:d=0.010,afade=t=out:st=${fadeOut.toFixed(3)}:d=0.040`,
    '-ar', String(SR), '-ac', '1', '-b:a', '128k', dst]);

  const b = analyse(dst);
  rows.push({ f: f.replace(/\.mp3$/, ''), beforeRms: a.rmsDb, afterRms: b.rmsDb, afterPeak: b.peakDb, gain: clamped, dur, clip: clamped !== gain });
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('clip', 22)}${'RMS in'.padStart(9)}${'gain'.padStart(8)}${'RMS out'.padStart(9)}${'peak'.padStart(8)}${'dur'.padStart(7)}`);
for (const r of rows) {
  console.log(
    pad(r.f, 22) + r.beforeRms.toFixed(1).padStart(9) + r.gain.toFixed(1).padStart(8) +
    r.afterRms.toFixed(1).padStart(9) + r.afterPeak.toFixed(1).padStart(8) + r.dur.toFixed(2).padStart(7) +
    (r.clip ? '  ← gain clamped' : '')
  );
}
const outs = rows.map((r) => r.afterRms);
const ins = rows.map((r) => r.beforeRms);
console.log(`\nRMS spread before  ${(Math.max(...ins) - Math.min(...ins)).toFixed(1)} dB`);
console.log(`RMS spread after   ${(Math.max(...outs) - Math.min(...outs)).toFixed(1)} dB`);
console.log(`worst peak after   ${Math.max(...rows.map((r) => r.afterPeak)).toFixed(1)} dBFS`);
console.log(`\noriginals in scripts/_voice_orig/ — re-running always masters from those.`);
