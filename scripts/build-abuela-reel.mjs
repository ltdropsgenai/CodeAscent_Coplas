#!/usr/bin/env node
/**
 * Weld the three beats of each language into ONE continuous clip.
 *
 *     node scripts/build-abuela-reel.mjs
 *
 * WHY. The three beats were separate files played back to back, and every
 * change of file was a change of player source: a black frame on Android, a
 * pose that snaps back to the opening portrait, and — once a dip was added to
 * cover it — a fade AND a cut, which is worse than the cut alone. None of that
 * is fixable in the player. It is fixable by not changing files.
 *
 * The three clips are cross-dissolved into one, so there is no source swap, no
 * reload, no black frame and no cut. The dissolve lands entirely inside the
 * silence each clip already carries after its last word (fetch-abuela-review
 * trims to the end of speech plus 0.35 s), so no syllable is lost to it.
 *
 * The captions then have to change on TIME rather than on a file boundary, so
 * this script prints the marks and writes them into src/data/abuelaMarks.json.
 * Measured from the built file, never estimated: a duration you guessed is a
 * duration that is wrong on some inputs.
 *
 * No shell anywhere — there is no /bin/sh on Windows.
 */
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { duration } from './lib/speech-end.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(root, 'assets', 'abuela');

/**
 * Length of each dissolve. It has to fit inside the trailing silence of the
 * outgoing clip (0.35 s by construction) or it eats her last word.
 */
const XFADE = 0.3;

function ff(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error(String(r.stderr ?? '').split('\n').filter(Boolean).slice(-8).join('\n'));
  }
}

const marks = {};
for (const lang of ['es', 'en']) {
  const parts = [1, 2, 3].map((n) => join(DIR, `${lang}-${n}.mp4`));
  const d = parts.map(duration);

  // Where each dissolve begins on the OUTPUT timeline.
  const cut1 = d[0] - XFADE;
  const cut2 = cut1 + d[1] - XFADE;
  const total = cut2 + d[2];

  const filter = [
    `[0:v][1:v]xfade=transition=fade:duration=${XFADE}:offset=${cut1.toFixed(3)}[v01]`,
    `[v01][2:v]xfade=transition=fade:duration=${XFADE}:offset=${cut2.toFixed(3)}[v]`,
    `[0:a][1:a]acrossfade=d=${XFADE}:c1=tri:c2=tri[a01]`,
    `[a01][2:a]acrossfade=d=${XFADE}:c1=tri:c2=tri[a]`,
  ].join(';');

  const dst = join(DIR, `${lang}.mp4`);
  ff(['-v', 'error', '-y', '-i', parts[0], '-i', parts[1], '-i', parts[2],
    '-filter_complex', filter, '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-crf', '26', '-preset', 'slow', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', dst]);

  const built = duration(dst);
  // The caption changes at the MIDDLE of the dissolve, where the outgoing shot
  // has faded half out — the moment a viewer reads as the change.
  marks[lang] = [
    0,
    Number((cut1 + XFADE / 2).toFixed(2)),
    Number((cut2 + XFADE / 2).toFixed(2)),
  ];

  console.log(`${lang}: ${d.map((x) => x.toFixed(2)).join(' + ')} → ${built.toFixed(2)}s ` +
    `(predicted ${total.toFixed(2)}s)  captions at ${marks[lang].join(' / ')}s`);
  if (Math.abs(built - total) > 0.2) {
    console.error(`✗ ${lang}: built length differs from the prediction by more than 0.2 s — the marks cannot be trusted`);
    process.exit(1);
  }
}

writeFileSync(join(root, 'src', 'data', 'abuelaMarks.json'), JSON.stringify(marks, null, 2) + '\n');
console.log('\n✅ wrote assets/abuela/es.mp4, assets/abuela/en.mp4 and src/data/abuelaMarks.json');
