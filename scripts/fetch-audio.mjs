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
  // Added 2026-07-31. Not yet wired to game events — bundling them first means
  // the assets exist whenever the wiring lands, instead of a second scramble
  // against another 24-hour link expiry.
  barajar: `${CDN}/b0e0f549-3b0b-411c-bd46-bb4b5966bb6a.mp3`,
  pista: `${CDN}/a1c60cf2-8cc2-4d16-9d12-b095e85de638.mp3`,
  grupo: `${CDN}/594f118c-14d2-4dd6-bc3f-3e718630ccb2.mp3`,
  reparto: `${CDN}/7eb10d8f-796b-4959-aac2-2be9a9114e14.mp3`,
  quitar: `${CDN}/342456c7-b080-4cb9-96eb-ece0fa8675a4.mp3`,
  reintentar: `${CDN}/72624be4-847b-465d-8517-8d2c021623f0.mp3`,
  racha: `${CDN}/dab108f2-d84e-49f0-b236-4fdcae16e941.mp3`,
  perdida: `${CDN}/e59d58c8-9460-4605-98d1-ac0baaa88d80.mp3`,
  /**
   * The tic-tac bed, added 2026-08-01. Eight seconds of soft wooden clock,
   * looped, for players who want to feel time passing without music.
   *
   * It is NOT a timer and must never become one — nothing is counted and
   * nothing runs out. It exists because silence under a round makes the SFX
   * and the voice lines feel exposed, not because the game should feel timed.
   */
  tictac: `${CDN}/8ff77207-8b68-47a4-a78a-8db3ec4e074d.mp3`,
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

  // ── Added 2026-07-31 ────────────────────────────────────────────────────
  // Dominican (es-DO). Nine voices, cast so no line repeats a speaker.
  // Written with the elisions intact — ta' to', eso e' así — because that is
  // how the phrase is said; a voice that "corrects" them back to full
  // Castilian is the wrong voice for the line.
  ta_to: `${CDN}/f570f3e2-1c3f-4252-b56d-a9a147044304.mp3`,
  eso_e_asi: `${CDN}/c2515bed-8550-4feb-83aa-f4aad86fd951.mp3`,
  que_vaina_buena: `${CDN}/8df223f8-8773-4138-8e70-6dda7302a7e5.mp3`,
  ta_duro: `${CDN}/92539843-afe9-4b85-b8df-853c3e72e83b.mp3`,
  se_formo: `${CDN}/35bfa0a2-4259-408a-a519-01ab5d68300a.mp3`,
  ta_pila: `${CDN}/387e5e4b-517d-489b-9439-e33b078c8817.mp3`,
  que_chuleria: `${CDN}/f5004673-705e-4aca-8bb9-bb606089efee.mp3`,
  ta_brutal: `${CDN}/12493e3a-d9d6-4fb5-9fed-68b10476f945.mp3`,
  dimelo_campeon: `${CDN}/bbf273ac-180c-4721-a662-812e976008b2.mp3`,

  // Mexican (es-MX). Only the six voices ElevenLabs labels es-MX carry these.
  que_chido: `${CDN}/1b569a05-274d-4a03-89c6-14ec3d992f8f.mp3`,
  padrisimo: `${CDN}/49f05b99-4261-4e3d-8451-2d6d8abc102e.mp3`,
  ya_la_hiciste: `${CDN}/ebe0c9d1-ae78-4696-b462-908b86710d2f.mp3`,
  te_la_rifaste: `${CDN}/ae4a4bd4-dec6-47c1-8f6a-525c33196e8c.mp3`,
  eso_mero: `${CDN}/25171397-9edc-4b3f-88a1-e3179a575898.mp3`,
  andale_pues: `${CDN}/9a36f87e-101e-4be0-9f5c-9c8fe43d97b9.mp3`,
  que_maquina: `${CDN}/f11f8fba-6740-47c0-9ce9-59b8bef5fb88.mp3`,
  va_que_va: `${CDN}/c2a3d2d5-6d6d-4a0a-b034-01714b65d457.mp3`,
  no_inventes: `${CDN}/cfac00b9-82b9-4f8e-af41-3d89ae9abfff.mp3`,
  que_barbaro: `${CDN}/6f57d2e4-adec-4fda-abf3-515a9bb36d9a.mp3`,
  sale: `${CDN}/29d25244-0c71-4dab-af35-d4fed9872f99.mp3`,

  // Pan-regional. Safe in any accent, so these spread across the neutral
  // voices — including Daniela and Miguel Zermeno, whose accent labels are
  // ambiguous and who therefore never carry regionally marked slang.
  increible: `${CDN}/4f1a4642-ecf6-47e7-8264-dd671435cf67.mp3`,
  fantastico: `${CDN}/7830cb8c-a27a-4cd6-8673-46bdef9ffaca.mp3`,
  buenisimo: `${CDN}/6ad2cbc3-0ba2-4346-ad09-7cb970a269fe.mp3`,
  magnifico: `${CDN}/c5109e9b-83bc-4c9f-8545-28cdd5eb6dd4.mp3`,
  impecable: `${CDN}/4d612a65-f949-4839-87de-45c74d54e3a1.mp3`,
  que_racha: `${CDN}/05f51ae2-efde-413e-8baa-a8e915e97dc7.mp3`,
  campeon: `${CDN}/12be02f9-4198-4e08-9588-4828e1b1f8a9.mp3`,
  lo_hiciste: `${CDN}/14143096-8344-4a49-8944-8f9942ee7269.mp3`,
  muy_bien_hecho: `${CDN}/1ca2a1e5-e801-4f20-8d94-c4ef26c02f53.mp3`,
  tremendo: `${CDN}/74cee656-aae4-4289-b893-c13625483e99.mp3`,
  genial: `${CDN}/331fc62e-19df-4f23-a063-3b2f59d1a552.mp3`,
  sin_un_error: `${CDN}/f32ffcf9-2979-4f23-8261-934892e5585a.mp3`,
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
// Must match scripts/encode-music.mjs exactly. If a name here has no .m4a in
// assets/music/, `musicBundled` goes false and the generated MUSIC falls back
// to streaming EVERY track from Supabase — where the expansion tracks do not
// exist. So a typo here is not a missing song, it is silent music everywhere.
const MUSIC_TRACKS = {
  home: ['home', 'home2', 'home3'],
  wins: ['win', 'win2', 'win3', 'win4', 'win5', 'win6', 'win7', 'win8', 'win9', 'win10'],
  rounds: [
    'bachata', 'bachata2', 'bachata3', 'bachata4',
    'reggaeton', 'reggaeton2', 'reggaeton3', 'reggaeton4',
    'cumbia', 'cumbia2', 'cumbia3', 'cumbia4',
    'bolero', 'bolero2', 'bolero3', 'bolero4',
    'son_jarocho', 'son_jarocho2', 'son_jarocho3', 'son_jarocho4',
    'marimba', 'marimba2', 'marimba3', 'marimba4',
    'mariachi', 'mariachi2', 'mariachi3', 'mariachi4',
    'nortena', 'nortena2', 'nortena3', 'nortena4',
    'banda', 'banda2', 'banda3', 'banda4',
    'merengue', 'merengue2', 'merengue3', 'merengue4',
    'huapango', 'huapango2', 'huapango3', 'huapango4',
    'danzon', 'danzon2', 'danzon3', 'danzon4',
    'ranchera', 'ranchera2', 'ranchera3', 'ranchera4',
    'salsa', 'salsa2', 'salsa3', 'salsa4',
    'trova', 'trova2', 'trova3', 'trova4',
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
 * Sixty round beds across fifteen Latin genres, three home beds and ten win
 * fanfares. Every bed is baked into a seamless loop by that script, so it can
 * be played with loop = true and never expose a join.
 *
 * These were streamed as uncompressed WAV, one track per round. At 96 kbps AAC
 * the whole set fits in the bundle, which removes the last per-round audio
 * fetch. With the card deck also bundled, only video still touches the network.
 */
export const MUSIC = {
  home: [
${musicList(MUSIC_TRACKS.home)}
  ],
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
  home: [
${musicList(MUSIC_TRACKS.home)}
  ],
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
 * Everything is BUNDLED (require()). SFX and voice lines are small and are
 * needed the instant something happens, so a network fetch would arrive after
 * the moment had passed; music is AAC now rather than WAV, which made bundling
 * it affordable too. Nothing in this file touches the network at runtime.
 */
export type AudioKey = 'music' | ${Object.keys(SFX).map((k) => `'${k}'`).join(' | ')};

type AudioSrc = number | string | { uri: string };

export const AUDIO: Partial<Record<AudioKey, AudioSrc>> = {
${sfxLines}
};

/**
 * Celebration voice lines — clips across Mexican, Dominican, Argentine and
 * accent-neutral Spanish voices, so that with a line on every win neither the
 * phrase nor the speaker repeats often. Regionally marked slang is cast only
 * to voices from that region; see scripts/fetch-audio.mjs for the casting.
 * Played at random with no immediate repeat; see src/audio.tsx.
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
