#!/usr/bin/env node
/**
 * Abuela is complete in both languages.
 *
 * WHY. She is a bilingual character assembled from eleven separate files. A
 * missing English clip or an untranslated caption does not crash and does not
 * look wrong in development — it is invisible to whoever built it and total for
 * half the audience. That is the same shape as the voice clips nobody had
 * measured and the SFX pack nobody had measured.
 *
 * Every input is read from the file that ships it. If a regex here stops
 * matching, this exits non-zero rather than quietly measuring nothing.
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
/**
 * Read a file the check depends on, or say which one is missing and stop.
 *
 * readFileSync throws ENOENT before `must()` can run, so the first version of
 * this gate reported a missing registry as an uncaught stack trace rather than
 * the sentence it was written to print. Behaviourally the same — non-zero, and
 * it names the file — but a gate whose job is to explain what is wrong should
 * explain it.
 */
const read = (p) => {
  try {
    return readFileSync(join(root, p), 'utf8');
  } catch {
    console.error(`✗ could not read ${p} — this check is now measuring nothing.`);
    process.exit(1);
  }
};

const BEATS = 3;
/** Fewest lines she may have per language for the Home tap. */
const MIN_LINES = 6;
const LANGS = ['es', 'en'];

function must(v, what) {
  if (!v) {
    console.error(`✗ could not read ${what} — this check is now measuring nothing.`);
    process.exit(1);
  }
  return v;
}

const reg = read('src/data/abuelaAssets.ts');
const errs = [];
let idleSeam = null;
let idleWorst = null;
const lineCount = {};

// 1. Every language has a narration reel, the file exists, and the caption
//    marks land inside it in order.
//
//    The marks are what make one file behave like three beats. A mark past the
//    end of the reel, or out of order, does not crash and does not look wrong
//    to whoever built it — the caption simply never changes, which is the same
//    invisible-to-the-builder failure this whole gate exists for.
const marksRaw = read('src/data/abuelaMarks.json');
let marks = {};
try {
  marks = JSON.parse(marksRaw);
} catch {
  errs.push('src/data/abuelaMarks.json is not valid JSON');
}
const reelSeconds = {};
for (const lang of LANGS) {
  const m = reg.match(new RegExp(`\\b${lang}:\\s*require\\('([^']+)'\\)`));
  if (!m) {
    errs.push(`registry has no narration reel for ${lang}`);
    continue;
  }
  const file = join(root, 'src/data', m[1]);
  if (!existsSync(file)) {
    errs.push(`the ${lang} reel points at a file that does not exist: ${m[1]}`);
    continue;
  }
  const r = spawnSync('ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
    { encoding: 'utf8' });
  const dur = Number(String(r.stdout ?? '').trim());
  if (!Number.isFinite(dur) || dur <= 0) {
    errs.push(`ffprobe could not read a duration from the ${lang} reel — this check is measuring nothing`);
    continue;
  }
  reelSeconds[lang] = dur;

  const mk = marks[lang];
  if (!Array.isArray(mk) || mk.length !== BEATS) {
    errs.push(`${lang} needs ${BEATS} caption marks, has ${Array.isArray(mk) ? mk.length : 'none'}`);
    continue;
  }
  if (mk[0] !== 0) errs.push(`${lang} caption marks must start at 0, start at ${mk[0]}`);
  for (let i = 1; i < mk.length; i += 1) {
    if (!(mk[i] > mk[i - 1])) errs.push(`${lang} caption mark ${i + 1} (${mk[i]}s) does not come after mark ${i} (${mk[i - 1]}s)`);
  }
  // A last mark at the very end means the third caption is never read.
  if (mk[mk.length - 1] > dur - 1) {
    errs.push(`${lang} caption ${BEATS} starts at ${mk[mk.length - 1]}s in a ${dur.toFixed(1)}s reel — nobody would read it`);
  }
}

// 1b. Her Home presence: the idle loop, and a line in every language.
//
//     The idle loop is ping-ponged so its last frame neighbours its first. That
//     property is the whole reason it can loop without showing a cut, and it is
//     a property of the FILE, not of the code — so it is checked here, at the
//     resolution that ships, rather than trusted because a build script once
//     said so.
{
  const m = reg.match(/ABUELA_IDLE = require\('([^']+)'\)/);
  if (!m) {
    errs.push('registry has no ABUELA_IDLE');
  } else {
    const file = join(root, 'src/data', m[1]);
    if (!existsSync(file)) {
      errs.push(`the idle loop points at a file that does not exist: ${m[1]}`);
    } else {
      const png = (n) => join(root, 'scripts', `.seam-${n}.png`);
      const shot = (index, out) => spawnSync('ffmpeg',
        ['-hide_banner', '-nostdin', '-v', 'error', '-y', '-i', file,
          '-vf', `select=eq(n\\,${index})`, '-vsync', '0', '-frames:v', '1', '-update', '1', out]);
      const pair = (x, y) => {
        const r = spawnSync('ffmpeg',
          ['-hide_banner', '-nostdin', '-v', 'info', '-i', x, '-i', y,
            '-lavfi', 'psnr', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
        const mm = String(r.stderr ?? '').match(/average:([\d.]+)/);
        return mm ? Number(mm[1]) : null;
      };
      const nf = Number(String(spawnSync('ffprobe',
        ['-v', 'error', '-select_streams', 'v:0', '-count_frames',
          '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', file],
        { encoding: 'utf8' }).stdout ?? '').trim());

      if (!Number.isFinite(nf) || nf < 20) {
        errs.push(`ffprobe counted ${nf} frames in the idle loop — this check is measuring nothing`);
      } else {
        shot(nf - 1, png('a'));
        shot(0, png('b'));
        idleSeam = pair(png('a'), png('b'));

        // Calibrate against the clip, not against a number. PSNR between two
        // consecutive frames depends on how much moves and how hard it was
        // compressed; an absolute floor is meaningless across either. An
        // earlier version of this gate demanded 32 dB and failed a loop that
        // was fine. What matters is whether the loop step is bigger than the
        // steps the clip already takes — her blink is the biggest of those.
        const steps = [];
        for (let k = 1; k < nf - 2; k += 8) {
          shot(k, png('c'));
          shot(k + 1, png('d'));
          const v = pair(png('c'), png('d'));
          if (v != null) steps.push(v);
        }
        if (idleSeam == null || steps.length < 5) {
          errs.push('psnr reported nothing for the idle loop — this check is measuring nothing');
        } else {
          steps.sort((x, y) => x - y);
          idleWorst = steps[0];
          if (idleSeam < idleWorst) {
            errs.push(`the idle loop point is the biggest jump in the clip ` +
              `(${idleSeam.toFixed(1)} dB against a worst frame step of ${idleWorst.toFixed(1)}) — that is a cut`);
          }
        }
      }
    }
  }

  const lines = reg.match(/ABUELA_LINES[\s\S]*?\n\};/)?.[0];
  if (!lines) {
    errs.push('registry has no ABUELA_LINES');
  } else {
    for (const lang of LANGS) {
      const half = lines.match(new RegExp(`\\b${lang}: \\[([\\s\\S]*?)\\]`))?.[1];
      const files = half ? [...half.matchAll(/require\('([^']+)'\)/g)].map((x) => x[1]) : [];
      if (!files.length) {
        errs.push(`she has nothing to say in ${lang} — a tap would open the tutorial in silence`);
        continue;
      }
      // Home is tapped repeatedly, and three lines was reported as too few to
      // sit behind a button people press more than once. A floor, so a future
      // edit cannot quietly walk it back down.
      if (files.length < MIN_LINES) {
        errs.push(`only ${files.length} ${lang} lines — Home is tapped repeatedly, want at least ${MIN_LINES}`);
      }
      lineCount[lang] = files.length;
      for (const f of files) {
        if (!existsSync(join(root, 'src/data', f))) {
          errs.push(`a ${lang} line points at a file that does not exist: ${f}`);
        }
      }
    }
  }
}

// 2. Every pose the component can ask for is registered and on disk.
const comp = read('src/components/Abuela.tsx');
const poseUnion = must(
  comp.match(/export type AbuelaPose =([^;]+);/)?.[1],
  'AbuelaPose in src/components/Abuela.tsx'
);
const poses = [...poseUnion.matchAll(/'([^']+)'/g)].map((m) => m[1]);
must(poses.length, 'any pose names in AbuelaPose');
for (const pose of poses) {
  const m = reg.match(new RegExp(`'${pose}':\\s*require\\('([^']+)'\\)`));
  if (!m) {
    errs.push(`pose "${pose}" is not in the registry`);
    continue;
  }
  if (!existsSync(join(root, 'src/data', m[1]))) {
    errs.push(`pose "${pose}" points at a file that does not exist: ${m[1]}`);
  }
}

// 3. Every caption exists in BOTH halves of the tutorial dictionary.
const tut = read('app/tutorial.tsx');
const half = (lang) =>
  must(
    tut.match(new RegExp(`\\n  ${lang}: \\{([\\s\\S]*?)\\n  \\},`))?.[1],
    `the "${lang}" half of the T dictionary in app/tutorial.tsx`
  );
for (let b = 1; b <= BEATS; b += 1) {
  for (const lang of LANGS) {
    if (!new RegExp(`abuela${b}\\s*:`).test(half(lang))) {
      errs.push(`caption abuela${b} missing from the ${lang} dictionary`);
    }
  }
}

for (const lang of LANGS) {
  const mk = marks[lang];
  const dur = reelSeconds[lang];
  console.log(`reel ${lang}         ${dur ? dur.toFixed(1) + 's' : '—'}  captions at ${Array.isArray(mk) ? mk.join(' / ') : '—'}s`);
}
console.log(`idle loop       seam ${idleSeam == null ? '—' : idleSeam.toFixed(1) + ' dB'}` +
  `${idleWorst == null ? '' : `, worst step in the clip ${idleWorst.toFixed(1)} dB`}`);
console.log(`home lines      ${LANGS.map((l) => `${l} ${lineCount[l] ?? 0}`).join(' · ')}`);
console.log(`poses           ${poses.join(', ')}`);

if (errs.length) {
  console.error(`\n✗ Abuela is incomplete:`);
  for (const e of errs) console.error(`  ${e}`);
  process.exit(1);
}
console.log(`\n✅ one narration reel per language, marks in order, every caption and pose present`);
