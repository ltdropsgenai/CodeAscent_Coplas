#!/usr/bin/env node
/**
 * Downloads every generated clip into assets/audio/ and rewrites
 * src/data/audioAssets.ts to require() the local files — bundled, offline,
 * permanent.
 *
 *     node scripts/fetch-audio.mjs
 *
 * WHY THIS MATTERS. ElevenLabs preview links live ~24 hours. The SFX below
 * were generated on 2026-07-29/30 and `audioAssets.ts` still points at those
 * preview URLs, which means the shipped app is fetching sound effects from
 * links that have almost certainly lapsed. Bundling is not an optimisation
 * here, it is the fix.
 *
 * The previous version of this script also emitted an audioAssets.ts template
 * that omitted the MUSIC export entirely — running it would have silently
 * deleted every music track. It now regenerates the whole file, MUSIC included.
 *
 * Voice lines are bundled rather than streamed on purpose: they are a few KB
 * each, and a celebration sting that arrives after a network round-trip has
 * already missed the moment it was celebrating.
 *
 * Safe to re-run. Clips that fail to download leave the previous wiring alone.
 */
import { writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'assets', 'audio');
const VOICE_OUT = join(OUT, 'voice');
mkdirSync(VOICE_OUT, { recursive: true });

const CDN = 'https://elevenlabs-mcp-server.ltdrops.workers.dev/audio';

/**
 * Short gameplay SFX. REGENERATED 2026-07-31 — the previous set was authored on
 * 2026-07-29/30 and every one of those preview links had lapsed by the time we
 * tried to bundle them, which is why builds 1-5 shipped with no card tap and no
 * correct/wrong feedback at all. Nothing crashed; `AUDIO` simply came out empty
 * and the provider built no players, so the failure was completely silent.
 *
 * If these ever 404 again, regenerate rather than pointing the app at the URLs:
 * a preview link is not a CDN.
 */
const SFX = {
  select: `${CDN}/fba8226a-4c5d-46f0-b19e-a422924a304f.mp3`,
  correct: `${CDN}/0f4efc0b-f120-464b-97d3-ea576bf3e485.mp3`,
  wrong: `${CDN}/8d8b4f3b-5a0a-472d-b108-1a1094eb32a4.mp3`,
  jingle: `${CDN}/c51b7720-6596-4610-a155-be45e68ce8ae.mp3`,
};

/**
 * Celebration voice lines, generated 2026-07-31 across EIGHT Spanish
 * professional clones — four Mexican (es-MX) and four Argentine (es-AR) — so
 * that with a line on every win the same voice rarely lands twice running.
 *
 * The regionally-marked slang is deliberately cast to Mexican voices only:
 * ¡órale!, ¡ándale!, ¡qué padre! and ¡qué chulada! are Mexican expressions, and
 * an Argentine actor performing them is exactly the sort of thing the audience
 * for a lotería-derived game hears instantly. The Argentine voices carry only
 * pan-regional lines that sound native anywhere.
 *
 *   es-MX  Guillermo   (male, middle-aged) · órale, ándale
 *   es-MX  Alejandro   (male, young)       · qué padre, muy bien
 *   es-MX  Valentina   (female, young)     · eso es, qué chulada
 *   es-MX  Pamela      (female)            · perfecto, lo lograste
 *   es-AR  El Faraón 3 (male, young)       · vamos
 *   es-AR  El Faraón   (male, deep)        · qué excelente, así se hace
 *   es-AR  Emma        (female, young)     · eso, qué buena
 *   es-AR  Paola       (female, bright)    · bien hecho
 */
const VOICE = {
  // Mexican voices — including all the regionally-marked slang.
  orale: `${CDN}/6f13e789-4420-4cf1-b33b-a660f71720a7.mp3`,
  andale: `${CDN}/1fff901d-2590-4ba1-ba59-a63b307ae45f.mp3`,
  que_padre: `${CDN}/953a8c2a-eb51-43b2-89f3-b0c6f8f4242c.mp3`,
  muy_bien: `${CDN}/8cdd7c3b-852b-4810-ab53-37596ed6306b.mp3`,
  eso_es: `${CDN}/0f319a69-af15-415b-8199-3a7223048f87.mp3`,
  que_chulada: `${CDN}/2793e23a-ec2c-49ce-95a9-e65ae8accec7.mp3`,
  perfecto: `${CDN}/b5884ea1-99eb-49ec-9308-97c2390d5f33.mp3`,
  lo_lograste: `${CDN}/bd29d33f-c1b0-4185-9ad4-8a1a928457a0.mp3`,
  // Argentine voices — pan-regional phrases only.
  vamos: `${CDN}/009296ed-3489-4377-b579-0acea8f811ae.mp3`,
  excelente: `${CDN}/dbb51e10-7636-4692-a11e-a95ab4f3d0d6.mp3`,
  asi_se_hace: `${CDN}/60bb5247-661f-413e-b956-87982f4ae4bc.mp3`,
  eso: `${CDN}/5887c32a-708e-4a79-80c5-8ae83f7e6286.mp3`,
  que_buena: `${CDN}/a8c59464-3645-4670-b604-dc94327ab71c.mp3`,
  bien_hecho: `${CDN}/40f96c14-9cf4-4d05-9357-3d35ca70752c.mp3`,
};

async function grab(url, dest, label) {
  // Already have it? Keep it. ElevenLabs preview links live ~24 hours, so
  // without this the script becomes single-use: re-running it later (to pick
  // up bundled music, say) would fail on every lapsed link and refuse to
  // regenerate audioAssets.ts at all, even though the clips are sitting right
  // there on disk.
  if (existsSync(dest) && statSync(dest).size >= 500) {
    console.log(`  = ${label} (already bundled)`);
    return true;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 500) throw new Error(`suspiciously small (${buf.length} bytes)`);
    writeFileSync(dest, buf);
    console.log(`  ✓ ${label} (${(buf.length / 1024).toFixed(0)} KB)`);
    return true;
  } catch (e) {
    console.error(`  ✗ ${label} — ${e.message}`);
    return false;
  }
}

console.log('SFX');
const sfxOk = {};
for (const [key, url] of Object.entries(SFX)) {
  sfxOk[key] = await grab(url, join(OUT, `${key}.mp3`), `${key}.mp3`);
}

console.log('\nVoice');
const voiceOk = {};
for (const [key, url] of Object.entries(VOICE)) {
  voiceOk[key] = await grab(url, join(VOICE_OUT, `${key}.mp3`), `voice/${key}.mp3`);
}

const sfxGot = Object.entries(sfxOk).filter(([, v]) => v).map(([k]) => k);
const voiceGot = Object.entries(voiceOk).filter(([, v]) => v).map(([k]) => k);

if (!voiceGot.length) {
  console.error('\nNo voice lines downloaded — the links have lapsed. Ask Claude to regenerate them, then re-run. Leaving audioAssets.ts untouched.');
  process.exit(1);
}
if (sfxGot.length < Object.keys(SFX).length) {
  console.warn(
    `\n! Only ${sfxGot.length}/${Object.keys(SFX).length} SFX downloaded. Those preview links have expired — the app has been fetching dead URLs for them. Ask Claude to regenerate the SFX pack; the ones that DID download are now bundled.`
  );
}

const sfxLines = sfxGot.map((k) => `  ${k}: require('../../assets/audio/${k}.mp3'),`).join('\n');
const voiceLines = voiceGot.map((k) => `  require('../../assets/audio/voice/${k}.mp3'),`).join('\n');

// ── music: bundled if scripts/encode-music.mjs has run, else streamed ────────
const MUSIC_TRACKS = {
  home: ['home'],
  wins: ['win', 'win2', 'win3', 'win4', 'win5'],
  rounds: [
    'bachata', 'reggaeton', 'cumbia', 'bolero', 'son_jarocho', 'marimba',
    'bachata2', 'reggaeton2', 'cumbia2', 'bolero2', 'son_jarocho2', 'marimba2',
  ],
};
const MUSIC_DIR = join(root, 'assets', 'music');
const hasLocal = (n) => existsSync(join(MUSIC_DIR, `${n}.m4a`));
const allMusic = [...MUSIC_TRACKS.home, ...MUSIC_TRACKS.wins, ...MUSIC_TRACKS.rounds];
const musicBundled = allMusic.every(hasLocal);

const musicRef = (n) =>
  musicBundled ? `require('../../assets/music/${n}.m4a')` : `\`\${MUSIC_CDN}/${n}.wav\``;
const musicList = (names) => names.map((n) => `    ${musicRef(n)},`).join('\n');

const musicBlock = musicBundled
  ? `/**
 * Background music — BUNDLED as AAC by scripts/encode-music.mjs.
 *
 * These were 21 MB of uncompressed WAV streamed one track per round. At 128 kbps
 * AAC the whole set is a few MB, so there is no reason to stream them: bundling
 * removes the last per-round audio fetch. With the card deck also bundled, only
 * video still touches the network.
 */
export const MUSIC = {
  home: ${musicRef('home')},
  wins: [
${musicList(MUSIC_TRACKS.wins)}
  ],
  rounds: [
${musicList(MUSIC_TRACKS.rounds)}
  ],
} as const;`
  : `/**
 * Background music — STREAMED from our own Supabase bucket, as uncompressed
 * WAV averaging 1.2 MB a track.
 *
 * Run scripts/encode-music.mjs to re-encode these to AAC and bundle them; this
 * file is regenerated to require() them and music stops touching the network.
 */
const MUSIC_CDN = 'https://bmybvrqbpachjxrejxdj.supabase.co/storage/v1/object/public/audio';

export const MUSIC = {
  home: ${musicRef('home')},
  wins: [
${musicList(MUSIC_TRACKS.wins)}
  ],
  rounds: [
${musicList(MUSIC_TRACKS.rounds)}
  ],
} as const;`;

const ts = `/**
 * Audio asset registry. GENERATED by scripts/fetch-audio.mjs — edit that, not this.
 *
 * SFX and voice lines are BUNDLED (require()): they are small, and both are
 * needed the instant something happens, so a network fetch would arrive after
 * the moment had passed. Music is STREAMED from our own Supabase bucket —
 * those files are megabytes and would bloat the download.
 */
export type AudioKey = 'music' | 'select' | 'correct' | 'wrong' | 'jingle';

type AudioSrc = number | string | { uri: string };

export const AUDIO: Partial<Record<AudioKey, AudioSrc>> = {
${sfxLines}
};

/**
 * Celebration voice lines — fourteen clips across eight Spanish voices, so
 * that with a line on every win neither the phrase nor the speaker repeats
 * often. Played at random with no immediate repeat; see src/audio.tsx.
 */
export const VOICE: number[] = [
${voiceLines}
];

${musicBlock}
`;

writeFileSync(join(root, 'src', 'data', 'audioAssets.ts'), ts);
console.log(`\n✓ Bundled ${sfxGot.length} SFX + ${voiceGot.length} voice lines, and rewrote src/data/audioAssets.ts.`);
console.log(
  musicBundled
    ? '  MUSIC is BUNDLED from assets/music/ — nothing streams any more.'
    : '  MUSIC still streams from Supabase (run scripts/encode-music.mjs to bundle it).'
);
console.log('  Restart Expo with: npx expo start -c');
