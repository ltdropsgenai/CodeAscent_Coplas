#!/usr/bin/env node
/**
 * Can you actually read the words on top of the background?
 *
 *     node scripts/check-contrast.mjs
 *
 * WHY THIS EXISTS. The scene backdrops are mostly dark photographs with very
 * bright highlights — across the 32 bundled scenes the median luminance in the
 * content band runs 0.03-0.35 while the 90th percentile runs 0.18-0.94. The
 * three-band vignette in AppBackground was a single constant chosen once, and
 * it was clearly chosen against that dark median: wherever a bright sky landed
 * behind body copy it did almost nothing. Measured after the fact, `textDim`
 * came out at 1.06:1 against the brightest scene and 1.69:1 against the median
 * one, where AA body text wants 4.5:1. A player reported it as "a legibility
 * issue on some of the brighter backgrounds"; it was in fact most of them.
 *
 * Nothing in the build could have caught that, because the scrim was a number
 * in a stylesheet and the brightness was a property of thirty-two JPEGs, and
 * no one had ever put the two together. Adding one more scene, or nudging one
 * constant, silently re-creates it.
 *
 * WHAT IT MEASURES. For every scene actually `require`d by sceneImages.ts:
 * the 90th-percentile relative luminance in the band where content sits — the
 * 90th and not the mean, because a dark street under a blazing sky averages out
 * fine and is still unreadable exactly where the sky is. That is composited
 * through the real scrim stack, read out of the real source files, and turned
 * into a WCAG contrast ratio against the real text colours.
 *
 * EVERY INPUT IS READ, NOT REPEATED. The scene list, the scrim alphas, the
 * band geometry, the reading-route list and the text colours all come out of
 * the files that ship them. If a regex here stops matching, this fails loudly
 * rather than quietly measuring a stack that no longer exists — a checker that
 * reads less than the thing it checks doesn't fail, it approves.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

/** WCAG AA for body text. The secondary copy on these screens is 15-16pt regular. */
const AA_BODY = 4.5;

// ── inputs, all extracted from source ───────────────────────────────────────

function must(value, what) {
  if (value === undefined || value === null) {
    console.error(`✗ could not read ${what} — this check is now measuring nothing.`);
    process.exit(1);
  }
  return value;
}

const themeSrc = read('src/theme.ts');
const bgSrc = read('src/components/AppBackground.tsx');
const scenesSrc = read('src/data/sceneImages.ts');

/** '#B7B0DA' -> [183,176,218] */
function hex(name) {
  const m = themeSrc.match(new RegExp(`\\b${name}:\\s*'#([0-9a-fA-F]{6})'`));
  const h = must(m?.[1], `colors.${name} in src/theme.ts`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** "rgba(8, 6, 16, 0.66)" -> { rgb: [8,6,16], a: 0.66 } */
function rgba(literal, what) {
  const m = must(literal, what).match(
    /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/
  );
  must(m, `an rgba() value for ${what}`);
  return { rgb: [+m[1], +m[2], +m[3]], a: +m[4] };
}

const READING_SCRIM = rgba(
  themeSrc.match(/readingScrim:\s*'([^']+)'/)?.[1],
  'colors.readingScrim'
);
// The flat middle band — the one the body copy actually sits on.
const MID_SCRIM = rgba(
  bgSrc.match(/top:\s*'28%',\s*bottom:\s*'32%',\s*backgroundColor:\s*'([^']+)'/)?.[1],
  "AppBackground's middle vignette band"
);

const READING_ROUTES = (() => {
  const block = must(
    bgSrc.match(/const READING_ROUTES = new Set\(\[([\s\S]*?)\]\)/)?.[1],
    'READING_ROUTES in AppBackground.tsx'
  );
  return new Set([...block.matchAll(/'([^']+)'/g)].map((m) => m[1]));
})();

const SCENES = [...scenesSrc.matchAll(/require\('\.\.\/\.\.\/(assets\/scenes\/[^']+)'\)/g)].map(
  (m) => m[1]
);
if (!SCENES.length) {
  console.error('✗ no scenes are require()d by src/data/sceneImages.ts');
  process.exit(1);
}

// ── colour maths ────────────────────────────────────────────────────────────

const toLinear = (c) => {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const luminance = (r, g, b) => 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Source-over in 8-bit sRGB, which is what the compositor actually does. */
const over = (dst, { rgb, a }) => dst.map((c, i) => c * (1 - a) + rgb[i] * a);

/**
 * The 90th-percentile pixel of a scene, in the band where content sits.
 *
 * Decoded at 96px wide on purpose: each sample then covers roughly an 8x8 block
 * of the source, which low-passes the image to about the scale of a run of text.
 * A single blown-out highlight the width of a letter is not what makes copy
 * unreadable; a bright region the size of a sentence is.
 */
function scenePeak(file) {
  const raw = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', join(root, file),
     '-vf', 'crop=iw:ih*0.86:0:ih*0.09,scale=96:-1',
     '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'],
    { maxBuffer: 1 << 28 }
  );
  const px = [];
  for (let i = 0; i < raw.length; i += 3) px.push([raw[i], raw[i + 1], raw[i + 2]]);
  px.sort((p, q) => luminance(...p) - luminance(...q));
  return px[Math.min(px.length - 1, Math.floor(0.9 * px.length))];
}

try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
} catch {
  console.error('✗ ffmpeg is not on PATH. It is already required by optimize-scenes.mjs\n' +
    '  and encode-music.mjs; this check needs it to read the scenes.');
  process.exit(1);
}

// ── measure ─────────────────────────────────────────────────────────────────

const TEXT = hex('text');
const DIM = hex('textDim');
const Ltext = luminance(...TEXT);
const Ldim = luminance(...DIM);

const rows = SCENES.map((file) => {
  const peak = scenePeak(file);
  const vignetted = over(peak, MID_SCRIM);
  const dimmed = over(vignetted, READING_SCRIM);
  return {
    file: file.split('/').pop(),
    play: contrast(Ldim, luminance(...vignetted)),
    reading: contrast(Ldim, luminance(...dimmed)),
    readingBright: contrast(Ltext, luminance(...dimmed)),
  };
}).sort((a, b) => a.reading - b.reading);

console.log(`scenes measured   ${rows.length}`);
console.log(`middle vignette   ${MID_SCRIM.a}`);
console.log(`reading dim       ${READING_SCRIM.a}`);
console.log(`reading routes    ${[...READING_ROUTES].join(' ')}`);
console.log(`\nworst scenes, textDim contrast at the 90th-percentile pixel:\n`);
console.log(`  ${'scene'.padEnd(24)} reading   play`);
for (const r of rows.slice(0, 6)) {
  console.log(`  ${r.file.slice(0, 24).padEnd(24)} ${r.reading.toFixed(2).padStart(6)} ${r.play.toFixed(2).padStart(6)}`);
}

const failed = rows.filter((r) => r.reading < AA_BODY);
const worstHeading = Math.min(...rows.map((r) => r.readingBright));

// A screen that puts body copy on the scene but is not in READING_ROUTES gets
// the play-screen stack, which is exactly the state this check exists to end.
const unlisted = readdirSync(join(root, 'app'))
  .filter((f) => f.endsWith('.tsx') && !f.startsWith('_'))
  .filter((f) => /colors\.textDim/.test(read(`app/${f}`)))
  .map((f) => '/' + f.replace(/\.tsx$/, ''))
  .filter((route) => route !== '/index' && route !== '/play' && !READING_ROUTES.has(route));

if (unlisted.length) {
  console.log(`\n! these screens render textDim but are not in READING_ROUTES:`);
  for (const r of unlisted) console.log(`    ${r}`);
  console.log(`  Add them there, or confirm their copy sits on a card of its own.`);
}

if (failed.length) {
  console.error(
    `\n✗ ${failed.length} scene(s) leave secondary text below ${AA_BODY}:1 on reading screens.` +
      `\n  Worst: ${failed[0].file} at ${failed[0].reading.toFixed(2)}:1.` +
      `\n  Raise colors.readingScrim in src/theme.ts, or replace the scene.`
  );
  process.exit(1);
}

console.log(
  `\n✅ every scene clears ${AA_BODY}:1 for textDim on reading screens` +
    ` (worst ${rows[0].reading.toFixed(2)}:1, headings worst ${worstHeading.toFixed(2)}:1)`
);
