#!/usr/bin/env node
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
 * Where she stops talking. The measurement itself lives in ./lib/speech-end.mjs
 * and is shared with every other script that trims a clip.
 *
 * THIS FUNCTION USED TO OWN A COPY, AND THE COPY WAS WRONG. It decided a
 * silence window was the trailing one when it ended within 350 ms of the file
 * ending. Spanish beat 3 was truncated mid-sentence by the generator, so the
 * last window it could see was a MID-SENTENCE PAUSE that closed 65 ms before
 * the file did — inside the guard band, read as the tail, and everything after
 * it was trimmed away. The last thing she says in that beat has never shipped.
 *
 * The shared version reverses the audio and looks for silence at the start, so
 * there is no "is this really the end" judgement left to get wrong, and a clip
 * that runs out mid-word reports itself as truncated instead of being trimmed
 * shorter still.
 */
function speechEnd(file) {
  const r = measure(file);
  return {
    end: r.end,
    dur: r.dur,
    detected: !r.truncated,
    trailing: r.trailing,
    truncated: r.truncated,
  };
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
  const { end, dur, detected, trailing, truncated } = speechEnd(src);
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
  const w = truncated ? 'CUT OFF MID-SPEECH' : `${trailing.toFixed(1)}s at the end`;
  console.log(
    f.replace('.mp4', '').padEnd(8) +
      `${dur.toFixed(1)}s`.padStart(8) + `${end.toFixed(1)}s`.padStart(8) +
      wasMB.toFixed(2).padStart(9) + nowMB.toFixed(2).padStart(9) +
      '   ' + w
  );
}

console.log(`\ntotal      ${before.toFixed(1)} MB → ${after.toFixed(1)} MB`);
if (undetected) {
  console.error(`\n✗ ${undetected} clip(s) are still above the silence threshold at their last sample.` +
    `\n  They were cut off by the generator. Trimming cannot fix that — regenerate them longer.`);
  process.exit(1);
}
console.log(`\noriginals in scripts/_abuela_orig/ — re-running always works from those.`);
