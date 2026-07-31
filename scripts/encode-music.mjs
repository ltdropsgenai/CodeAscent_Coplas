#!/usr/bin/env node
/**
 * Re-encodes the music beds from WAV to AAC and bundles them.
 *
 *     node scripts/encode-music.mjs        # then: node scripts/fetch-audio.mjs
 *
 * WHY. The 18 tracks are stored as uncompressed WAV — 21 MB total, averaging
 * 1.2 MB each — and one is streamed per round. That is the last obviously
 * wasteful thing in the data path: WAV in a mobile game buys nothing an
 * listener can hear and costs roughly 8x the bytes.
 *
 * At 128 kbps AAC these become ~150 KB each, ~3 MB for the set. At that size
 * there is no reason to stream them at all, so they get bundled and the music
 * stops touching the network entirely. Combined with the bundled deck, the only
 * thing left streaming is video.
 *
 * REQUIRES ffmpeg on PATH. On Windows:  winget install Gyan.FFmpeg
 * (or `choco install ffmpeg`, or scoop). Checked up front so this does not
 * download 21 MB and then fail.
 *
 * Run this BEFORE scripts/fetch-audio.mjs — that script regenerates
 * audioAssets.ts and will wire music to the local files if it finds them here,
 * or leave it streaming from Supabase if it does not.
 */
import { execFileSync, execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, statSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'assets', 'music');
const TMP = join(root, 'scripts', '_wav');
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

// ── ffmpeg check ─────────────────────────────────────────────────────────────
try {
  execSync('ffmpeg -version', { stdio: 'ignore' });
} catch {
  console.error('ffmpeg not found on PATH.\n');
  console.error('  Windows :  winget install Gyan.FFmpeg');
  console.error('  macOS   :  brew install ffmpeg');
  console.error('\nInstall it, reopen the terminal, and re-run.');
  process.exit(1);
}

const CDN = 'https://bmybvrqbpachjxrejxdj.supabase.co/storage/v1/object/public/audio';

const TRACKS = [
  'home',
  'win', 'win2', 'win3', 'win4', 'win5',
  'bachata', 'reggaeton', 'cumbia', 'bolero', 'son_jarocho', 'marimba',
  'bachata2', 'reggaeton2', 'cumbia2', 'bolero2', 'son_jarocho2', 'marimba2',
];

const BITRATE = '128k';

let wavBytes = 0;
let aacBytes = 0;
const done = [];
const failed = [];

for (const name of TRACKS) {
  const wav = join(TMP, `${name}.wav`);
  const m4a = join(OUT, `${name}.m4a`);
  try {
    if (!existsSync(wav)) {
      const res = await fetch(`${CDN}/${name}.wav`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 5000) throw new Error(`too small (${buf.length}B)`);
      writeFileSync(wav, buf);
    }
    wavBytes += statSync(wav).size;

    // -b:a 128k stereo AAC. `-movflags +faststart` puts the moov atom first so
    // playback can begin without reading the whole file — irrelevant when
    // bundled, but harmless and correct if these are ever served again.
    execFileSync(
      'ffmpeg',
      ['-y', '-loglevel', 'error', '-i', wav, '-c:a', 'aac', '-b:a', BITRATE, '-movflags', '+faststart', m4a],
      { stdio: 'inherit' }
    );
    const out = statSync(m4a).size;
    aacBytes += out;
    done.push(name);
    console.log(
      `  ✓ ${name.padEnd(14)} ${(statSync(wav).size / 1024).toFixed(0).padStart(5)} kB → ${(out / 1024).toFixed(0).padStart(4)} kB`
    );
  } catch (e) {
    failed.push(`${name}: ${e.message}`);
    console.error(`  ✗ ${name} — ${e.message}`);
  }
}

console.log(
  `\n${done.length}/${TRACKS.length} encoded · ${(wavBytes / 1024 / 1024).toFixed(1)} MB WAV → ${(aacBytes / 1024 / 1024).toFixed(1)} MB AAC` +
    (wavBytes ? ` (${(wavBytes / Math.max(1, aacBytes)).toFixed(1)}x smaller)` : '')
);
for (const f of failed) console.log(`  ! ${f}`);

if (done.length === TRACKS.length) {
  try {
    rmSync(TMP, { recursive: true, force: true });
    console.log('cleaned up scripts/_wav/');
  } catch {
    console.log('(leaving scripts/_wav/ — delete it yourself)');
  }
}

console.log('\nNow run:  node scripts/fetch-audio.mjs');
console.log('It will detect assets/music/ and bundle these instead of streaming them.');
