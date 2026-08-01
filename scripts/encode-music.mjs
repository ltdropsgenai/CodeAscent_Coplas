#!/usr/bin/env node
/**
 * Downloads every music track, makes the beds loop seamlessly, and encodes
 * them to AAC.
 *
 *     node scripts/encode-music.mjs        # then: node scripts/fetch-audio.mjs
 *
 * WHY THE BEDS ARE NOT LOOPED, AND WERE.
 *
 * This file used to bake a seamless loop into every bed: the last three seconds
 * laid over the first three, so the file ended on exactly the audio it began
 * with and could repeat forever with nothing to hear at the join. That was the
 * right answer to the design at the time, where ONE track looped under a round.
 *
 * The design changed. src/audio.tsx now plays a bed with `loop: false` and an
 * `onEnd` that advances to a DIFFERENT track, precisely so a player does not
 * hear the same fifty-five seconds come round again. The assets never caught
 * up, and that mismatch was the whole defect — reported from a real session as
 * "the looping tracks did not land".
 *
 * It is worth being exact about why, because the playback code looked correct
 * and was correct. A seamlessly-looped track has, BY CONSTRUCTION, no ending:
 * the bake removes it. So each bed circled back to its own opening and then the
 * texture abruptly changed as the next track began. Nothing ever resolved. The
 * player was not hearing a loop bug; they were hearing sixty tracks each
 * engineered never to finish.
 *
 * So beds now get a plain BED_FADE_OUT fade at the end. The track resolves,
 * there is a breath, and the next one starts — which is what a playlist is.
 *
 * Silence still has to come off both ends BEFORE that fade, or the generator's
 * own fade-out stacks with ours and the track dies away twice. The trim is not
 * optional.
 *
 * Loudness is normalised to -18 LUFS. With sixty-odd beds in rotation, tracks
 * that differ by a few dB mean the music changes volume every round, which
 * reads as a bug. One number, applied to all of them, is the whole fix.
 *
 * Fanfares are NOT loop-baked. They are one-shots — they are supposed to end.
 *
 * REQUIRES ffmpeg and ffprobe on PATH. On Windows:  winget install Gyan.FFmpeg
 * (or `choco install ffmpeg`, or scoop). Checked up front so this does not
 * download tens of megabytes and then fail.
 *
 * Run this BEFORE scripts/fetch-audio.mjs — that script regenerates
 * audioAssets.ts and will wire music to the local files if it finds them here.
 * Then run scripts/check-loops.mjs, which measures what this script claims.
 */
import { execFileSync, execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, statSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'assets', 'music');
const TMP = join(root, 'scripts', '_wav');
const CUT = join(root, 'scripts', '_trim');
for (const d of [OUT, TMP, CUT]) mkdirSync(d, { recursive: true });

// ── toolchain check ──────────────────────────────────────────────────────────
for (const bin of ['ffmpeg', 'ffprobe']) {
  try {
    execSync(`${bin} -version`, { stdio: 'ignore' });
  } catch {
    console.error(`${bin} not found on PATH.\n`);
    console.error('  Windows :  winget install Gyan.FFmpeg');
    console.error('  macOS   :  brew install ffmpeg');
    console.error('\nInstall it, reopen the terminal, and re-run.');
    process.exit(1);
  }
}

// ── sources ──────────────────────────────────────────────────────────────────
// The original eighteen still live in the Supabase `audio` bucket. Everything
// generated since comes straight from vidIQ, whose URLs are permanent — no
// round-trip through Supabase, per "as little dependency on online assets as
// possible". Either way this script is the only thing that ever fetches them;
// the app ships the encoded .m4a.
const SUPA = 'https://bmybvrqbpachjxrejxdj.supabase.co/storage/v1/object/public/audio';
const VQ = 'https://ai-music-tracks.s3.us-east-1.amazonaws.com/07e5635c-2b66-4fe2-96b1-0269404c5939';

/**
 * Looping background beds — these get the seamless-loop treatment.
 *
 * Fifteen genres, four tracks each, so a round draws from 60 beds. The
 * anti-repeat in src/audio.tsx only blocks the immediately previous track, so
 * the depth here is what actually stops the music becoming wallpaper.
 *
 * Three of these took a second attempt: the provider's safety filter rejected
 * the first norteño, danzón and trova prompts. Naming the genre plainly and
 * dropping the word "climax" got all three through unchanged in substance —
 * worth knowing before rewriting a blocked prompt into something else.
 */
const BEDS = {
  bachata: `${SUPA}/bachata.wav`,
  reggaeton: `${SUPA}/reggaeton.wav`,
  cumbia: `${SUPA}/cumbia.wav`,
  bolero: `${SUPA}/bolero.wav`,
  son_jarocho: `${SUPA}/son_jarocho.wav`,
  marimba: `${SUPA}/marimba.wav`,
  bachata2: `${SUPA}/bachata2.wav`,
  reggaeton2: `${SUPA}/reggaeton2.wav`,
  cumbia2: `${SUPA}/cumbia2.wav`,
  bolero2: `${SUPA}/bolero2.wav`,
  son_jarocho2: `${SUPA}/son_jarocho2.wav`,
  marimba2: `${SUPA}/marimba2.wav`,

  // Pilot batch, July 2026.
  mariachi: `${VQ}/04519f35-1f19-4400-aae0-326d5dfbd4c3.wav`,
  nortena: `${VQ}/5fba927a-ba27-4640-83f2-56535eef4a18.wav`,
  banda: `${VQ}/8fe25c90-13bb-4bdf-9e1e-d7bea93f2440.wav`,
  merengue: `${VQ}/48ee0633-c926-466f-aa07-bac3be18e446.wav`,

  // ── Expansion, July 2026 ────────────────────────────────────────────────
  // Deepening the six original genres from two tracks to four.
  bachata3: `${VQ}/ea051eba-da5b-4f02-ad59-1790d8d2b24a.wav`,
  bachata4: `${VQ}/9113c3e8-b9d8-496b-8656-f6cd5d36e89d.wav`,
  reggaeton3: `${VQ}/07c36977-07f9-477c-bf8a-706facda8ae9.wav`,
  reggaeton4: `${VQ}/01f43c8e-c1ff-4728-ba2b-93a8afd552a6.wav`,
  cumbia3: `${VQ}/220646da-3c41-4f08-a392-050125556873.wav`,
  cumbia4: `${VQ}/6873930e-fde8-4e30-8312-e8abe4fffa8f.wav`,
  bolero3: `${VQ}/069a82d6-6ae6-4f4c-9896-791ef8342be1.wav`,
  bolero4: `${VQ}/35cce9af-c5ec-4340-a5f9-047d1ad9717f.wav`,
  son_jarocho3: `${VQ}/e9cacb7c-c0e4-49d9-8054-5ec9c32d965f.wav`,
  son_jarocho4: `${VQ}/7148d719-bec1-4483-a947-397cb9c330e6.wav`,
  marimba3: `${VQ}/b4269c51-eadc-4983-9aa7-4c6d5adf26d5.wav`,
  marimba4: `${VQ}/ceadbbd5-f2f1-403f-9b80-5649e724563f.wav`,

  // Deepening the four pilot genres from one track to four.
  mariachi2: `${VQ}/1b36f73f-6b9e-42f9-93ee-3b5030e9cbf6.wav`,
  mariachi3: `${VQ}/48589de5-5c2d-4d1b-b02b-8dce2c78e888.wav`,
  mariachi4: `${VQ}/27534d88-72fc-42b5-bc79-da15f44a3f92.wav`,
  nortena2: `${VQ}/680ea122-3ae0-49c1-ab3b-8fdbb927549d.wav`,
  nortena3: `${VQ}/f2a0bf25-4717-4c70-ad65-7a859d662a9e.wav`,
  banda2: `${VQ}/de50c8fb-19a3-4446-af61-ae98d4ce0dd3.wav`,
  banda3: `${VQ}/92efa9e3-5877-4d61-b9a1-9d6dbdeb3139.wav`,
  banda4: `${VQ}/5ec56781-3963-4e0e-9881-9226db5fe142.wav`,
  merengue2: `${VQ}/6e648168-8fc5-4080-87b3-2d2c27a9088a.wav`,
  merengue3: `${VQ}/7f7a7c6f-0344-4476-a70c-12b97c70ff46.wav`,
  merengue4: `${VQ}/7acbac79-a4da-4f38-b923-33ce701a95ac.wav`,

  // Five genres the deck had nothing in.
  huapango: `${VQ}/9b4bc3e7-66c1-4a15-89f2-e4aff68c9b56.wav`,
  huapango2: `${VQ}/759f1ecd-70b7-4652-8df2-5c1e22a122b7.wav`,
  huapango3: `${VQ}/f0a43762-0e7c-4b95-805c-3f436a968426.wav`,
  huapango4: `${VQ}/bf706142-ac71-4062-820e-668932e18326.wav`,
  danzon: `${VQ}/7f450875-eacb-4480-9f87-7907e24588a6.wav`,
  danzon2: `${VQ}/67dfafd9-c2de-49d5-b391-af5c87640be8.wav`,
  danzon3: `${VQ}/ef32f103-a347-4539-a867-89e452e9c446.wav`,
  ranchera: `${VQ}/f9d27f92-a3c9-4be8-91a1-accb2c7fac60.wav`,
  ranchera2: `${VQ}/e1de3da3-4d32-404e-8d2f-74c6ac4b358b.wav`,
  ranchera3: `${VQ}/2392b35c-cb6a-4846-b2ff-79a7a5f36d47.wav`,
  ranchera4: `${VQ}/79f2afb4-2639-4dd9-98e4-08dfaaa87716.wav`,
  salsa: `${VQ}/7a3312e1-007a-4d2f-adc9-ed1ff65dd379.wav`,
  salsa2: `${VQ}/b2aa5af0-8fec-4d0c-831c-8eb04017367a.wav`,
  salsa3: `${VQ}/2c032d05-86d8-4353-af6b-16968a15c3dc.wav`,
  salsa4: `${VQ}/1c6aed8d-fd1e-4cca-8b0c-6e4bb6686d44.wav`,
  trova: `${VQ}/610f294c-1e44-402e-8142-fe0b95b114da.wav`,
  trova2: `${VQ}/7f25e967-41fc-4a02-a046-afc49f605ca0.wav`,
  trova3: `${VQ}/af5c7c18-0b09-4309-80d6-f39d1d436c83.wav`,

  // The three that needed a rephrased prompt.
  nortena4: `${VQ}/2c845fe7-8a11-411c-b78f-521af3e143dd.wav`,
  danzon4: `${VQ}/9aadb48c-df52-4e25-b713-49f411f1093d.wav`,
  trova4: `${VQ}/64b3e9d2-cbc4-4d86-bfde-7955c039b65f.wav`,
};

/** Home screen beds. Loop like the rest; one is drawn per visit. */
const HOME = {
  home: `${SUPA}/home.wav`,
  home2: `${VQ}/09930bfb-b6e5-4877-aaf3-28f21a8b21d4.wav`,
  home3: `${VQ}/888fa81e-e1ae-4bdb-b835-285c266e8240.wav`,
};

/**
 * Win fanfares. One-shots: trimmed, levelled and capped, never loop-baked.
 *
 * Asking for a 13-second track is a hint, not an instruction — these came back
 * between 50 and 138 seconds. FANFARE_MAX is what actually makes them stings.
 */
const WINS = {
  win: `${SUPA}/win.wav`,
  win2: `${SUPA}/win2.wav`,
  win3: `${SUPA}/win3.wav`,
  win4: `${SUPA}/win4.wav`,
  win5: `${SUPA}/win5.wav`,
  win6: `${VQ}/d2a05796-aaa8-409e-8ff0-56d52309582a.wav`,
  win7: `${VQ}/60e1c7de-8203-45f5-99f1-9afacfd631fd.wav`,
  win8: `${VQ}/2b2c8386-a5be-4655-b776-d48eb89627d6.wav`,
  win9: `${VQ}/f24f29f2-fcba-4c7e-ae43-ac8aa0ba3c82.wav`,
  win10: `${VQ}/f2dc8453-c028-4a42-82e0-e366ae273612.wav`,
};

const TRACKS = [
  ...Object.entries({ ...HOME, ...BEDS }).map(([name, url]) => ({ name, url, bed: true })),
  ...Object.entries(WINS).map(([name, url]) => ({ name, url, bed: false })),
];

// 96k stereo AAC. At 128k the set was ~3 MB for eighteen; at sixty-odd tracks
// the difference between 128 and 96 is roughly 15 MB of install size, and on a
// bed mixed to 40% volume under gameplay it is not a difference anyone hears.
const BITRATE = '96k';

/**
 * Seconds of fade at the end of a bed.
 *
 * These tracks no longer loop. src/audio.tsx plays one, and when it ends picks
 * a different one, so each file needs an ENDING — the thing the old seamless
 * bake specifically removed. 2.5s resolves cleanly without reading as a long
 * cross-dissolve; shorter starts to sound like a cut. Shrinks for short tracks
 * so it can never swallow more than a quarter of one.
 */
const BED_FADE_OUT = 2.5;

/**
 * Hard ceiling on a win fanfare, and the fade that lands it.
 *
 * The generated fanfares came back anywhere from 23 to 93 seconds, which meant
 * the celebration was a different length depending on which one you drew: one
 * win carried you until you tapped on, the next stopped dead and left you in
 * silence on the results screen. With ten of them in rotation that reads as a
 * bug rather than as variety, so they are all cut to the same length.
 *
 * The fade matters as much as the cap. Truncating a brass ensemble at exactly
 * fifteen seconds is a worse artefact than the inconsistency it fixes.
 */
const FANFARE_MAX = 15;
const FANFARE_FADE = 1.2;

const LOUDNORM = 'loudnorm=I=-18:TP=-2:LRA=11';

/**
 * How far below a track's own MEDIAN frame a moment has to sit before we call
 * it the fade rather than the music.
 *
 * Two earlier versions of this were wrong, and the second failure is the one
 * that explains the number.
 *
 * v1 used ffmpeg's `silenceremove` at an absolute -40 dBFS. Wrong tool: a
 * generated fade-out only decays to about -38 before the file ends, so the
 * trim sailed under it entirely.
 *
 * v2 measured relative to the track's own loudness, which was the right idea
 * with two wrong details. It compared against the MEAN, which a long fade-out
 * drags down — the fade lowers the very threshold meant to detect it — and it
 * cut at -10 dB, which is past the point where a fade is already audible. It
 * removed the dead end of the decay and left the live part of it in.
 *
 * The evidence for v3 is that in all nine remaining failures the head measured
 * QUIETER than the tail, never once the other way round. The output's head is
 * the source just after the splice point and its tail is the source just
 * before it, so a one-directional gap means the source is still descending
 * through that region: the splice was landing inside a fade that started
 * earlier than the trim reached.
 *
 * So: median rather than mean, because a fade is a minority of frames and the
 * median ignores them; and 6 dB rather than 10, because that is nearer where a
 * decline stops being dynamics and starts being an ending.
 */
const QUIET_DB = 6;

/** Extra backoff past the last loud frame, so the splice never lands on a
 *  frame that is already half-way into the decay. */
const TAIL_GUARD = 0.5;

/** If the thresholds leave less than this, they were too aggressive for this
 *  track and we fall back to a looser cut rather than mangling it. */
const MIN_KEEP = 15;

/** Sample rate for measurement only. 8 kHz is ample for an energy envelope
 *  and keeps a 60-second track under a megabyte in memory. */
const PROBE_SR = 8000;

/** Decode a whole file to mono samples at PROBE_SR. */
function samples(file) {
  const buf = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', file, '-f', 's16le', '-acodec', 'pcm_s16le',
     '-ac', '1', '-ar', String(PROBE_SR), '-'],
    { maxBuffer: 1 << 28 }
  );
  const n = buf.length >> 1;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = buf.readInt16LE(i * 2) / 32768;
  return out;
}

function frameRms(x, i0, i1) {
  let s = 0;
  for (let i = i0; i < i1; i++) s += x[i] * x[i];
  return Math.sqrt(s / Math.max(1, i1 - i0));
}

/**
 * Where the sustained music starts and ends, in seconds.
 *
 * Builds a 50 ms energy envelope, takes its median as "what this track sounds
 * like when it is playing", and walks in from both ends past everything that
 * sits QUIET_DB below that. Falls back to a looser threshold rather than
 * over-trimming a track with unusually wide dynamics.
 */
function musicBounds(file) {
  const x = samples(file);
  if (!x.length) throw new Error('decoded to nothing');
  const F = Math.round(PROBE_SR * 0.05);
  const e = [];
  for (let i = 0; i + F <= x.length; i += F) e.push(frameRms(x, i, i + F));
  if (e.length < 40) throw new Error('too short to measure');

  const median = [...e].sort((p, q) => p - q)[e.length >> 1];
  const total = (e.length * F) / PROBE_SR;

  const cut = (dropDb) => {
    const floor = median * 10 ** (-dropDb / 20);
    let a = 0;
    let b = e.length - 1;
    while (a < e.length && e[a] < floor) a += 1;
    while (b >= 0 && e[b] < floor) b -= 1;
    if (b <= a) return null;
    const start = (a * F) / PROBE_SR;
    const end = ((b + 1) * F) / PROBE_SR - TAIL_GUARD;
    return end - start >= MIN_KEEP ? { start, end } : null;
  };

  const r = cut(QUIET_DB) ?? cut(QUIET_DB * 2) ?? { start: 0, end: total };
  if (r.end - r.start < 10) throw new Error('no sustained music found');
  return r;
}

/** Combine a run of frame RMS values into one RMS. */
function combine(e, i0, i1) {
  let s = 0;
  for (let i = i0; i < i1; i++) s += e[i] * e[i];
  return Math.sqrt(s / Math.max(1, i1 - i0));
}

const dB = (v) => 20 * Math.log10(Math.max(v, 1e-9));


function ff(args) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
}

/**
 * Fetch with retries.
 *
 * Twenty of seventy downloads failed on the first full run — not the same
 * twenty on a re-run, and no HTTP status attached, which is the signature of
 * transient connection resets rather than a bad URL. Seventy sequential
 * requests to one host is enough to hit that.
 *
 * `e.message` on a failed undici fetch is the useless string "fetch failed";
 * the actual reason lives on `e.cause`. Reporting both is the difference
 * between "run it again" and knowing whether running it again would help.
 */
async function download(url, dest, tries = 4) {
  let last;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 5000) throw new Error(`too small (${buf.length}B)`);
      writeFileSync(dest, buf);
      return;
    } catch (e) {
      last = e;
      if (attempt < tries) {
        await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
      }
    }
  }
  const why = last?.cause?.message || last?.cause?.code;
  throw new Error(`${last?.message ?? last}${why ? ` (${why})` : ''} after ${tries} tries`);
}

function duration(file) {
  const out = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file],
    { encoding: 'utf8' }
  );
  const d = parseFloat(out.trim());
  if (!Number.isFinite(d) || d <= 0) throw new Error(`unreadable duration`);
  return d;
}

let wavBytes = 0;
let aacBytes = 0;
const done = [];
const failed = [];

for (const { name, url, bed } of TRACKS) {
  const wav = join(TMP, `${name}.wav`);
  const trimmed = join(CUT, `${name}.wav`);
  const m4a = join(OUT, `${name}.m4a`);
  try {
    // 1. fetch (cached in scripts/_wav so re-runs only retry what failed)
    if (!existsSync(wav)) await download(url, wav);
    wavBytes += statSync(wav).size;

    // 2. cut the fades off both ends and level what is left
    const { start, end } = musicBounds(wav);
    ff([
      '-i', wav,
      '-af', `atrim=start=${start.toFixed(3)}:end=${end.toFixed(3)},asetpts=N/SR/TB,${LOUDNORM}`,
      trimmed,
    ]);
    const d = duration(trimmed);

    // 3. beds: end the track properly, so the next one can begin
    //
    // These used to be baked into seamless loops — the last three seconds laid
    // over the first three, so the file ended on exactly the audio it began
    // with. That was right for the original design, where ONE track looped
    // under a round.
    //
    // The design changed: src/audio.tsx now plays a bed with `loop: false` and
    // an `onEnd` that advances to a different track. The assets never caught
    // up, and that mismatch is the whole defect. A track engineered to be
    // seamless has, by construction, no ending — so every bed circled back to
    // its own opening and then the texture abruptly changed. A player reported
    // it as "the looping tracks did not land", which is exactly right: they
    // were hearing sixty tracks each built never to finish.
    //
    // A plain fade-out is the correct shape now. The track resolves, there is a
    // breath, and the next one starts.
    if (bed) {
      const fade = Math.min(BED_FADE_OUT, d / 4);
      ff([
        '-i', trimmed,
        '-af', `afade=t=out:st=${(d - fade).toFixed(3)}:d=${fade.toFixed(3)}`,
        '-c:a', 'aac',
        '-b:a', BITRATE,
        '-movflags', '+faststart',
        m4a,
      ]);
    } else {
      const cap = Math.min(d, FANFARE_MAX);
      const fade = Math.min(FANFARE_FADE, cap / 3);
      ff([
        '-i', trimmed,
        '-t', cap.toFixed(3),
        '-af', `afade=t=out:st=${(cap - fade).toFixed(3)}:d=${fade.toFixed(3)}`,
        '-c:a', 'aac',
        '-b:a', BITRATE,
        '-movflags', '+faststart',
        m4a,
      ]);
    }

    const out = statSync(m4a).size;
    aacBytes += out;
    done.push(name);
    console.log(
      `  ✓ ${name.padEnd(14)} ${(statSync(wav).size / 1024).toFixed(0).padStart(6)} kB → ` +
        `${(out / 1024).toFixed(0).padStart(4)} kB  ${duration(m4a).toFixed(1)}s${bed ? ' bed' : ' sting'}`
    );
  } catch (e) {
    failed.push(`${name}: ${e.message}`);
    console.error(`  ✗ ${name} — ${e.message}`);
  }
}

console.log(
  `\n${done.length}/${TRACKS.length} encoded · ${(wavBytes / 1024 / 1024).toFixed(1)} MB WAV → ` +
    `${(aacBytes / 1024 / 1024).toFixed(1)} MB AAC` +
    (aacBytes ? ` (${(wavBytes / Math.max(1, aacBytes)).toFixed(1)}x smaller)` : '')
);
for (const f of failed) console.log(`  ! ${f}`);

// scripts/_trim/ is a scratch intermediate and goes. scripts/_wav/ STAYS: it
// is ~95 MB of downloads that never change, and deleting it meant every tweak
// to the trim or the crossfade cost a full re-download of all seventy tracks
// before you could see whether the tweak worked. Delete it by hand when the
// music is settled.
try {
  rmSync(CUT, { recursive: true, force: true });
} catch {
  /* ignore */
}
console.log(`\nWAV cache kept in scripts/_wav/ (${TRACKS.length} files) — delete it when done tuning.`);

console.log('\nNow run:  node scripts/check-loops.mjs');
console.log('Then:     node scripts/fetch-audio.mjs');
