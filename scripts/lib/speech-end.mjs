/**
 * Where the speech actually stops, measured from the audio itself.
 *
 * ONE copy, imported by every script that trims a clip. The three previous
 * copies of this logic were pasted from each other, and so was the bug in it:
 * this project has already been bitten by a checker inheriting a defect by
 * copy-paste (sim-rounds.mjs from trapsPool), and this is the same shape.
 *
 * HOW IT WORKS, AND WHY NOT THE OBVIOUS WAY.
 *
 * The obvious way is to run silencedetect forward, take the last window, and
 * call it the tail if it reaches the end of the file. That is what the earlier
 * versions did, with a 150 ms guard band on "reaches the end". It cost the
 * final phrase of Spanish beat 3: that clip was truncated mid-sentence by the
 * generator, so the last window silencedetect could see was a MID-SENTENCE
 * PAUSE that happened to close 65 ms before the file ended. Inside the guard
 * band, so it was read as the tail, so everything after it — the last thing she
 * says — was trimmed away. It shipped. Nothing failed; the trim just approved.
 *
 * This version reverses the audio and looks for silence at the START. Leading
 * silence in the reversed signal IS trailing silence in the original, and there
 * is no "is this really the end" judgement left to get wrong. A clip that runs
 * out mid-word has no leading silence when reversed, so it reports its own full
 * duration and the caller trims nothing — which is the correct answer for a
 * clip that was cut off, and the answer the old code could not give.
 *
 * ffmpeg writes silencedetect to stderr and exits 0. spawnSync is used because
 * execFileSync only surfaces stderr when the process FAILS — reading it from
 * the exception meant reading nothing, every time, on a process that succeeds.
 * No shell anywhere: there is no /bin/sh on Windows.
 */
import { spawnSync } from 'node:child_process';

/** Silence below this counts as "she has stopped". */
export const SILENCE_DB = -40;
/** Kept after the last speech so the cut does not clip her final consonant. */
export const TAIL = 0.35;

function ff(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', ...args],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw r.error;
  return String(r.stderr ?? '');
}

export function duration(file) {
  const r = spawnSync('ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
    { encoding: 'utf8' });
  if (r.error) throw r.error;
  const d = Number(String(r.stdout ?? '').trim());
  if (!Number.isFinite(d) || d <= 0) throw new Error(`ffprobe gave no duration for ${file}`);
  return d;
}

/**
 * @returns {{ end: number, trailing: number, truncated: boolean, dur: number }}
 *   end        where to cut, including TAIL
 *   trailing   seconds of silence at the end of the file
 *   truncated  true when the audio is still above the threshold at the last
 *              sample — the clip ran out before she finished
 */
/** Mean level over the final 150 ms. Below −45 dBFS is a decay, not a cut. */
function quietAtEnd(file) {
  const out = ff(['-v', 'info', '-sseof', '-0.15', '-i', file, '-af', 'volumedetect', '-f', 'null', '-']);
  const m = out.match(/mean_volume:\s*(-?[\d.]+) dB/);
  if (!m) throw new Error(`volumedetect produced no reading for ${file} — the measurement is broken, not the clip`);
  return Number(m[1]) < -45;
}

export function speechEnd(file) {
  const dur = duration(file);
  const out = ff(['-v', 'info', '-i', file,
    '-af', `areverse,silencedetect=noise=${SILENCE_DB}dB:d=0.20`, '-f', 'null', '-']);

  // A filter that did not run is not a file without silence. Say so loudly.
  if (!/silencedetect/.test(out)) {
    throw new Error(`silencedetect produced no output for ${file} — the measurement is broken, not the clip`);
  }

  const starts = [...out.matchAll(/silence_start:\s*(-?[\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...out.matchAll(/silence_end:\s*([\d.]+)/g)].map((m) => Number(m[1]));

  // In the reversed signal, a window starting at (or just after) zero is the
  // original's trailing silence. Anything later is a pause in the middle.
  const leads = starts.map((s, i) => [s, ends[i]]).filter(([s]) => s <= 0.05);
  if (!leads.length) {
    // silencedetect needs a window at least `d` long below the threshold. A
    // clip that ends the instant the last word decays has a real tail, just a
    // shorter one than the detector can see, and calling that "cut off mid-word"
    // is a false alarm — it blocked a take whose final syllable was complete.
    //
    // So ask the amplitude directly. Speech that was severed is LOUD at the last
    // sample: the Spanish beat 3 that actually shipped truncated measured
    // −27 dBFS across its final 0.4 s. A decayed ending measures below −45.
    return quietAtEnd(file)
      ? { end: dur, trailing: 0.15, truncated: false, dur }
      : { end: dur, trailing: 0, truncated: true, dur };
  }

  const trailing = leads[0][1];
  if (!Number.isFinite(trailing)) return { end: dur, trailing: 0, truncated: true, dur };
  return { end: Math.min(dur, dur - trailing + TAIL), trailing, truncated: false, dur };
}
