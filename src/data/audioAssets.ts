/**
 * Audio asset registry.
 *
 * Values are a bundled asset (require() → number) OR a remote URL (string) OR
 * an {uri} object — expo-audio accepts all three. The provider only creates a
 * player for keys present here, so the app is silent & safe while empty.
 *
 * CURRENT STATE: live PREVIEW URLs (AI-generated via ElevenLabs, served from
 * your own ltdrops worker). These expire ~24h after generation. To make sound
 * permanent + offline, run:  node scripts/fetch-audio.mjs
 * That downloads the clips into assets/audio/ and rewrites this file to use
 * require() (bundled). Do it within 24h of generating, before the links lapse.
 *
 * Keys: music = looping relaxing bed; jingle = win sting; select/correct/wrong
 * = short gameplay SFX.
 */
export type AudioKey = 'music' | 'select' | 'correct' | 'wrong' | 'jingle';

type AudioSrc = number | string | { uri: string };

const CDN = 'https://elevenlabs-mcp-server.ltdrops.workers.dev/audio';

export const AUDIO: Partial<Record<AudioKey, AudioSrc>> = {
  jingle: `${CDN}/21918505-470a-4448-9c87-4d4fb0291789.mp3`,
  select: `${CDN}/5ab1c5e2-3ecc-4991-9ab4-fa0d62f461aa.mp3`,
  correct: `${CDN}/1bf5f06d-6a98-4714-a6c1-e0e3bd791617.mp3`,
  wrong: `${CDN}/d0122826-51c8-4802-8b24-dd681eab901b.mp3`,
};

/**
 * Background music — self-hosted on Supabase (public `audio` bucket, rehosted
 * from the approved VidIQ set). `home` loops on the home screen; every round
 * pulls a fresh track from `rounds` (anti-repeat, like the card composer); the
 * `win` mariachi fanfare fires on a win over the round-clear celebration.
 * Streamed on demand — the 54-card offline base ships without music.
 */
const MUSIC_CDN = 'https://bmybvrqbpachjxrejxdj.supabase.co/storage/v1/object/public/audio';

export const MUSIC = {
  home: `${MUSIC_CDN}/home.wav`,
  // Win fanfares — one is picked at random per win (anti-repeat), so the
  // celebration doesn't sound identical every round. 5 triumphant variations.
  wins: [
    `${MUSIC_CDN}/win.wav`, // mariachi victory fanfare
    `${MUSIC_CDN}/win2.wav`, // festive mariachi
    `${MUSIC_CDN}/win3.wav`, // flamenco guitar flourish
    `${MUSIC_CDN}/win4.wav`, // marimba + brass sting
    `${MUSIC_CDN}/win5.wav`, // festive accordion fanfare
  ],
  // Round beds — two tracks per agreed genre (bachata, reggaeton, cumbia,
  // bolero, son jarocho, marimba). A fresh one is pulled each round
  // (anti-repeat), so rounds don't reuse the same loop back-to-back.
  rounds: [
    `${MUSIC_CDN}/bachata.wav`,
    `${MUSIC_CDN}/reggaeton.wav`,
    `${MUSIC_CDN}/cumbia.wav`,
    `${MUSIC_CDN}/bolero.wav`,
    `${MUSIC_CDN}/son_jarocho.wav`,
    `${MUSIC_CDN}/marimba.wav`,
    `${MUSIC_CDN}/bachata2.wav`,
    `${MUSIC_CDN}/reggaeton2.wav`,
    `${MUSIC_CDN}/cumbia2.wav`,
    `${MUSIC_CDN}/bolero2.wav`,
    `${MUSIC_CDN}/son_jarocho2.wav`,
    `${MUSIC_CDN}/marimba2.wav`,
  ],
} as const;
