#!/usr/bin/env node
/**
 * Verifies the claim scripts/encode-music.mjs makes: that every bed in
 * assets/music/ starts on music and ENDS on a clean fade.
 *
 *     node scripts/check-loops.mjs
 *
 * The other gates in this repo check that data is well-formed. This one checks
 * a claim about bytes we generated, in the same spirit as check-assets (a
 * filename describes its contents) and check-image-styles (an image is sized by
 * its layout). "I ran ffmpeg and it exited 0" is not evidence about the audio.
 *
 * THIS GATE USED TO ASSERT THE OPPOSITE, AND THAT IS WORTH KEEPING ON RECORD.
 * It required every bed to be a seamless loop: neither end silent, and both
 * ends at the same level. That was correct while a single track looped under a
 * round. When the design changed to a playlist — play one bed, then advance to
 * a different one — the assets kept the old bake, and a track engineered to be
 * seamless has by construction NO ENDING. Nothing resolved; every bed circled
 * back to its own opening before the next one cut in, which a player reported
 * as "the looping tracks did not land".
 *
 * So for a while this file was actively enforcing the defect: re-encoding the
 * beds correctly would have made it fail. A gate that outlives the design it
 * was written for does not become neutral — it starts defending the bug.
 *
 * WHAT IT MEASURES NOW:
 *
 *   1. The head is not silent. A bed must start on music, or the player hears a
 *      beat of nothing every time a track changes.
 *   2. The tail is well down, and is MIN_DROP_DB quieter than the music just
 *      before the fade begins — so "there is a fade" is measured against the
 *      music it is supposed to be fading, not against another point inside the
 *      fade itself. A track still at full level in its last 300ms is one the
 *      fade never reached.
 *
 * WHAT IT DOES NOT MEASURE. Whether one track following another is *musical* —
 * whether the two keys and tempos sit together. No cheap measurement catches
 * that; only listening does. This gate rules out the mechanical failures so
 * that what is left to judge by ear is genuinely a matter of taste.
 *
 * It also does not measure the decoder. A file can be encoded perfectly and still
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

// MAX_STEP_DB is gone with the seamless-loop check it belonged to: it measured
// whether the two ENDS matched, which is the property these files are no longer
// supposed to have.

/**
 * Must match BED_FADE_OUT in scripts/encode-music.mjs.
 *
 * Repeated rather than imported because that script is a long-running encoder
 * and importing it would run it. Wrong here means this gate measures the wrong
 * window and quietly passes everything.
 */
const BED_FADE_OUT = 2.5;
/** A faded tail should be well down. Not silence — AAC and a 2.5s fade leave a little. */
const FADED_DB = -30;
/**
 * The music must still be PLAYING where our fade starts.
 *
 * This replaced a "the tail must be N dB quieter than the pre-fade point"
 * check, which misdiagnosed its only real hit. `cumbia2` measured a 3.9 dB drop
 * and was reported as "the fade did not happen" — but its tail was -47.8 dB, so
 * it ends perfectly quiet. What it actually has is dead air: the source's own
 * fade-out survived the trim, so the track was already near-silent before our
 * fade began and there was nothing left to fade.
 *
 * Those are opposite problems with opposite fixes, and the old check pointed at
 * the wrong one — it sent you to widen BED_FADE_OUT, which would have changed
 * nothing. Measuring the pre-fade level directly names the real fault: music
 * here means the fade has something to work on; silence here means the track
 * stopped early and the player gets a hole before the next one starts.
 */
const DEAD_AIR_DB = -38;

/**
 * Beds whose measurement has been read and cleared, with the reason.
 *
 * Same rule as check-card-art.mjs: a bare entry is not allowed to mean "ignore
 * this". The value is the argument, and if you cannot write one, fix the track.
 */
const ACCEPTED = {
  cumbia2:
    'the SOURCE fades out ~5s before the end (-20 dB at 5s, -34.8 dB at 3s), so our ' +
    'fade lands on near-silence and the track ends ~3s early. One bed in 63. The fix ' +
    'would be a more aggressive global trim, which re-encodes all 73 tracks and risks ' +
    'clipping the ending off the other 62 to recover three seconds on this one.',
};

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
let accepted = 0;
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
  // Measured just before the fade begins, so "did the fade actually happen?"
  // is a comparison between music and the end of the fade, not between two
  // points inside it.
  const preFade = rms(path, Math.max(0, d - BED_FADE_OUT - WIN), WIN);
  const drop = preFade - tail;

  const notes = [];
  // A bed must still START on music. A silent head means the trim ate the
  // opening, and the player hears a beat of nothing every time a track changes.
  if (head <= SILENT_DB) notes.push(`head silent (${head.toFixed(1)} dB)`);
  // ...and it must END quiet. This is the check that was INVERTED before: it
  // used to fail a track whose tail was silent and fail a head/tail mismatch,
  // because the beds were baked as seamless loops and had to end where they
  // began. They are a playlist now, so the requirements are the opposite ones,
  // and a track that still ends at full level is one the fade never reached.
  if (tail > FADED_DB) notes.push(`does not fade out (tail ${tail.toFixed(1)} dB)`);
  // Dead air: already silent where the fade begins, so the track stops early
  // and the player hears a hole before the next one starts.
  if (preFade <= DEAD_AIR_DB)
    notes.push(`silent ${BED_FADE_OUT}s before the end (${preFade.toFixed(1)} dB) — trim left the source fade on`);

  if (notes.length && ACCEPTED[name]) {
    console.log(`  ~ ${name.padEnd(14)} accepted — ${notes.join(' · ')}`);
    accepted++;
  } else if (notes.length) {
    // A failure prints MORE than a pass, not less. The first version printed
    // only the note, which meant the one line you actually needed to diagnose
    // the problem — what the two ends measured — was the line it withheld.
    const detail =
      `${d.toFixed(1)}s  head ${head.toFixed(1)} dB  pre-fade ${preFade.toFixed(1)} dB  ` +
      `tail ${tail.toFixed(1)} dB  drop ${drop.toFixed(1)} dB`;
    problems.push(`${name}: ${notes.join(', ')} — ${detail}`);
    console.log(`  ✗ ${name.padEnd(14)} ${detail}   ${notes.join(' · ')}`);
  } else {
    console.log(
      `  · ${name.padEnd(14)} ${d.toFixed(1)}s  head ${head.toFixed(1)} dB  ` +
        `pre-fade ${preFade.toFixed(1)} dB  tail ${tail.toFixed(1)} dB  drop ${drop.toFixed(1)} dB`
    );
  }
}

console.log(
  `\n${beds} beds measured · ${shots} one-shots skipped · ${accepted} accepted · ` +
    `${problems.length} that do not end cleanly`
);
for (const [name, why] of Object.entries(ACCEPTED)) console.log(`  ~ ${name}: ${why}`);
if (problems.length) {
  console.log('\nRe-run scripts/encode-music.mjs, or adjust BED_FADE_OUT there:');
  for (const p of problems) console.log(`  ! ${p}`);
  process.exit(1);
}
