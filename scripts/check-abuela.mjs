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

// 1. Every beat has a clip in every language, and the file exists.
for (const lang of LANGS) {
  for (let b = 1; b <= BEATS; b += 1) {
    const key = `${lang}-${b}`;
    const m = reg.match(new RegExp(`'${key}':\\s*require\\('([^']+)'\\)`));
    if (!m) {
      errs.push(`registry has no clip for ${key}`);
      continue;
    }
    const p = join(root, 'src/data', m[1]);
    if (!existsSync(p)) errs.push(`${key} points at a file that does not exist: ${m[1]}`);
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

console.log(`beats           ${BEATS} × ${LANGS.join('/')}`);
console.log(`poses           ${poses.join(', ')}`);

if (errs.length) {
  console.error(`\n✗ Abuela is incomplete:`);
  for (const e of errs) console.error(`  ${e}`);
  process.exit(1);
}
console.log(`\n✅ every beat, caption and pose is present in both languages`);
