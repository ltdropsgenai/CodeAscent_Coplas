#!/usr/bin/env node
/**
 * Encodes every card's clip small enough to ship inside the app, and rewrites
 * src/data/cardVideos.ts to require() them instead of fetching URLs.
 *
 *     node scripts/bundle-video.mjs
 *
 * WHAT THIS ENDS. Video was the last thing Coplas fetched at runtime. After
 * this the app touches the network for nothing at all: the deck, the music, the
 * voice lines, the backgrounds and now the animations are all in the bundle.
 * The Supabase `video` bucket, the `video_rehost` queue and every slow-network
 * failure path in CardVideo stop being load-bearing.
 *
 * The reliability argument mattered more than the bytes. The win celebration
 * fetched eight clips at the instant of a win and had two or three seconds to
 * show them. On a poor connection `readyToPlay` never fired in time and the
 * celebration silently fell back to stills — so the effect was least likely to
 * appear exactly when it was supposed to land. Bundled, it is not a race.
 *
 * SIZE. 320 px wide at CRF 28 measures ~53 kB a clip, ~52 MB for the deck. The
 * two places clips are shown are the Home hero at 128 pt (384 px on a 3x
 * screen) and the celebration tiles at ~80 pt (240 px). 320 is native for the
 * tiles and a 1.2x stretch on the hero, which is the deliberate trade: one tier
 * instead of two, and no second manifest to keep in step with the first.
 *
 * SOURCE. Reads scripts/_video_orig/, the pristine 1.3 MB clips cached by
 * scripts/optimize-video.mjs. Re-encoding from the already-shrunk 540 px copies
 * would compound generation loss for no reason. If _video_orig/ is missing, run
 * optimize-video.mjs first — it downloads them.
 *
 * REQUIRES ffmpeg on PATH.
 */
import { execFileSync, execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIG = join(root, 'scripts', '_video_orig');
const OUT = join(root, 'assets', 'video');
mkdirSync(OUT, { recursive: true });

const WIDTH = 320;

/**
 * CRF — smaller number, better picture, bigger files.
 *
 * 28 measured 49 kB a clip (47 MB for the deck); 32 measures 32 kB (31 MB).
 * Compared side by side at 2x magnification the two are very hard to separate,
 * and nothing is ever shown at 2x: the celebration tiles are 240 px and the
 * Home hero 384 px, against a 320 px source. So 32 buys ~16 MB of install for
 * a difference I could not see. Put it back to 28 if a device disagrees.
 *
 * Resolution is NOT the knob to reach for. 320 px at CRF 32 and 240 px at
 * CRF 28 both land near 31 MB, but the first keeps the detail in the printed
 * name banner — which is baked into the frames, is the first thing to go, and
 * is the one part a player actually has to read.
 */
const QUALITY = 32;
const PRESET = 'slow';

try {
  execSync('ffmpeg -version', { stdio: 'ignore' });
} catch {
  console.error('ffmpeg not found on PATH.\n  Windows: winget install Gyan.FFmpeg');
  process.exit(1);
}

if (!existsSync(ORIG)) {
  console.error('No scripts/_video_orig/. Run scripts/optimize-video.mjs first —');
  console.error('it downloads the originals, which are the right input for this.');
  process.exit(1);
}

// Ids come from the generated card-art registry: one require() per card, named
// for its id. That is exactly the set the app can reference, so the video
// manifest cannot end up describing a card the deck does not have.
const IDS = [
  ...readFileSync(join(root, 'src', 'data', 'cardImages.ts'), 'utf8')
    .matchAll(/assets\/cards\/([a-z0-9_]+)\.jpg/g),
].map((m) => m[1]);
if (IDS.length < 900) {
  console.error(`only ${IDS.length} card ids found — refusing to run on a partial deck.`);
  process.exit(1);
}

/**
 * Resume, but only while the settings are the same.
 *
 * The first version skipped any clip that already had an output file, which
 * makes a re-run cheap and makes editing WIDTH or QUALITY do NOTHING AT ALL —
 * silently, with a success message at the end. That is the same shape of bug as
 * a gate keyed on an environment variable that is already set: the guard reads
 * as working precisely when it is not.
 *
 * So the settings are stamped next to the cache and compared. Change a knob and
 * every clip is re-encoded; change nothing and an interrupted run picks up
 * where it stopped.
 */
const STAMP = join(root, 'scripts', '_video_settings.json');
const settings = JSON.stringify({ WIDTH, QUALITY, PRESET, source: 'orig' });
const prior = existsSync(STAMP) ? readFileSync(STAMP, 'utf8') : '';
const reencodeAll = prior !== settings;
if (prior && reencodeAll) {
  console.log('encode settings changed since the last run:');
  console.log(`  was  ${prior}`);
  console.log(`  now  ${settings}`);
  console.log('re-encoding every clip.\n');
}

let bytes = 0;
let done = 0;
const missing = [];
const failed = [];

for (const id of IDS) {
  const src = join(ORIG, `${id}.mp4`);
  const dst = join(OUT, `${id}.mp4`);
  if (!existsSync(src)) {
    missing.push(id);
    continue;
  }
  try {
    if (reencodeAll || !existsSync(dst) || statSync(dst).size < 3000) {
      execFileSync(
        'ffmpeg',
        ['-y', '-v', 'error', '-i', src,
         '-an', // silent clips; an audio track is pure waste
         '-vf', `scale=${WIDTH}:-2`,
         '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
         '-preset', PRESET, '-crf', String(QUALITY),
         '-movflags', '+faststart', dst],
        { stdio: 'inherit' }
      );
    }
    bytes += statSync(dst).size;
    done += 1;
    if (done % 100 === 0) {
      console.log(`  ${String(done).padStart(4)}/${IDS.length}  ${(bytes / 1048576).toFixed(0)} MB`);
    }
  } catch (e) {
    failed.push(`${id}: ${e.message}`);
    console.error(`  ✗ ${id} — ${e.message}`);
  }
}

if (missing.length) {
  console.error(`\n${missing.length} clips are not in scripts/_video_orig/:`);
  console.error(`  ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ' …' : ''}`);
  console.error('Run scripts/optimize-video.mjs to fetch them, then re-run this.');
  console.error('REFUSING to write the registry from an incomplete set — a require()');
  console.error('pointing at a file that is not there is a Metro build failure, which');
  console.error('takes the whole app down rather than one card.');
  process.exit(1);
}
if (failed.length) {
  console.error(`\n${failed.length} failed to encode; registry not rewritten.`);
  for (const f of failed) console.error(`  ! ${f}`);
  process.exit(1);
}

// ── registry ─────────────────────────────────────────────────────────────────
const lines = IDS.map((id) => `  ${id}: require('../../assets/video/${id}.mp4'),`).join('\n');

const ts = `/**
 * Animated card clips. GENERATED by scripts/bundle-video.mjs — edit that, not this.
 *
 * **Every card is animated, and every clip is BUNDLED.** Nothing here touches
 * the network. That is not only about egress: the win celebration used to fetch
 * eight clips at the instant of a win and had two or three seconds to show
 * them, so on a poor connection it silently fell back to stills — the effect
 * was least likely to appear exactly when it mattered. A bundled clip is not a
 * race.
 *
 * ~${(bytes / done / 1024).toFixed(0)} kB each, ${(bytes / 1048576).toFixed(0)} MB for the deck, at ${WIDTH} px wide. The two places
 * clips appear are the Home hero at 128 pt (384 px on a 3x screen) and the
 * celebration tiles at ~80 pt (240 px), so this is native for the tiles and a
 * slight stretch on the hero — one tier, deliberately, rather than two
 * manifests to keep in step.
 *
 * Consumers must still degrade to the still image if a clip will not play;
 * CardVideo renders the still underneath as a poster, so a decode failure on
 * some device we have never seen is a non-event rather than a black hole.
 */
import { CARDS, CARD_BY_ID } from './cards';

const VIDEOS: Record<string, number> = {
${lines}
};

/** Every card id, in deck order. Used where we want to pick an animated card. */
export const ANIMATED_CARD_IDS: string[] = CARDS.map((c) => c.id);

export const ANIMATED_COUNT = ANIMATED_CARD_IDS.length;

/** Does this card have a clip? */
export function hasCardVideo(id: string): boolean {
  return VIDEOS[id] !== undefined && CARD_BY_ID[id] !== undefined;
}

/** The bundled clip for a card, or undefined if there isn't one. */
export function cardVideo(id: string): number | undefined {
  return hasCardVideo(id) ? VIDEOS[id] : undefined;
}
`;

writeFileSync(join(root, 'src', 'data', 'cardVideos.ts'), ts);
// Stamped only after a complete, failure-free pass, so an interrupted run does
// not record settings the files on disk do not all match.
writeFileSync(STAMP, settings);

console.log(
  `\n${done}/${IDS.length} encoded · ${(bytes / 1048576).toFixed(1)} MB · avg ${(bytes / done / 1024).toFixed(0)} kB`
);
console.log('✓ rewrote src/data/cardVideos.ts to require() the bundled clips');
console.log('\nNow run:  npm run assets && npm run typecheck');
console.log('The Supabase `video` bucket is no longer referenced by the app.');
console.log('Leave it in place until this build has shipped and been verified.');
