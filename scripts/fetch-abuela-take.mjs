#!/usr/bin/env node
/**
 * Fetch the SINGLE-TAKE Abuela narration — one continuous clip per language.
 *
 *     node scripts/fetch-abuela-take.mjs
 *
 * Run this ON londi-pc; the cloud session is firewalled from the generation CDN.
 *
 * WHAT THESE FILES ARE, AND WHY THEY EXIST.
 *
 * The narration was three separately generated clips per language, played back
 * to back. Every attempt to hide the joins failed on its own terms: a hard cut
 * showed a black frame on Android and a pose that snapped back to the opening
 * portrait; a dip produced a fade AND a cut; a cross-dissolve was still a
 * dissolve, twice per language. Three takes do not become one take.
 *
 * These are one take. A single 30-second continuous shot was generated with no
 * cut in it, then lip-synced to the full narration in one pass. There is no
 * second clip to join, in either language, so there is nothing that can show a
 * seam.
 *
 * WHAT IT COST. No lip-sync model here accepts an audio track longer than 15
 * seconds, and the one model that generates 30 seconds refuses reference
 * images — its IP check on the reference never completes. So the 30-second
 * plate was generated from the character DESCRIPTION rather than from the
 * approved portrait. If she has drifted from the Home still and the achievement
 * poses, the fix is to re-derive those four stills from a frame of this take,
 * not to go back to three clips.
 *
 * CAPTION MARKS ARE MEASURED, NOT GUESSED — but they are measured by a rule
 * that can pick wrong, so every candidate is printed. The narration is three
 * beats of near-equal length, so the boundaries are the internal silences
 * closest to one third and two thirds of the way through the speech. Read the
 * printed table. If a mark is on the wrong pause you will see it there rather
 * than discovering it on a device.
 *
 * No shell anywhere — there is no /bin/sh on Windows.
 */
import { writeFileSync, mkdirSync, existsSync, statSync, copyFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { speechEnd, duration } from './lib/speech-end.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHIP = join(root, 'assets', 'abuela');
const RAW = join(root, 'scripts', '_abuela_new', 'take');
const PREV = join(root, 'scripts', '_abuela_prev');

const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_395qbESmCeG8JPbpOIha0lzedrS';

const WIDTH = 640;
const CRF = 26;
/**
 * Pause detection for the beat boundaries.
 *
 * NOT the same thresholds as the speech-end trim, and deliberately looser. At
 * −40 dB / 0.30 s the real English boundary — the breath after "everybody
 * shouting" at 7.72–8.04 s — was invisible: its floor sits between −40 and
 * −38 dB. With it missing, the nearest-to-one-third rule picked the pause at
 * 4.34 s instead and the second caption would have changed in the middle of a
 * sentence. Spanish was unaffected, which is exactly how a defect like this
 * ships: correct in the language you happen to check.
 */
const GAP_DB = -38;
const MIN_GAP = 0.15;

const TAKES = [
  ['es', 'hf_20260807_223404_b444ff17-d933-4763-afb3-c4d8904257fa.mp4'],
  ['en', 'hf_20260807_223404_0d7193cd-e174-4958-870b-22578172dc24.mp4'],
];

function ffErr(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', ...args],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw r.error;
  return String(r.stderr ?? '');
}

/** Every silence window inside the clip, as [start, end] pairs. */
function gaps(file) {
  const out = ffErr(['-v', 'info', '-i', file,
    '-af', `silencedetect=noise=${GAP_DB}dB:d=${MIN_GAP}`, '-f', 'null', '-']);
  if (!/silencedetect/.test(out)) {
    throw new Error(`silencedetect produced no output for ${file} — the measurement is broken, not the clip`);
  }
  const starts = [...out.matchAll(/silence_start:\s*(-?[\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...out.matchAll(/silence_end:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  return starts.map((s, i) => [s, ends[i]]).filter(([, e]) => Number.isFinite(e));
}

mkdirSync(RAW, { recursive: true });
mkdirSync(PREV, { recursive: true });

const marks = {};
for (const [lang, remote] of TAKES) {
  const raw = join(RAW, `${lang}.mp4`);
  const res = await fetch(`${CDN}/${remote}`);
  if (!res.ok) {
    console.error(`✗ ${lang}: HTTP ${res.status}. These URLs expire — a 403 means regenerate, not retry.`);
    process.exit(1);
  }
  writeFileSync(raw, Buffer.from(await res.arrayBuffer()));

  const r = speechEnd(raw);
  if (r.truncated) {
    console.error(`✗ ${lang}: still talking at the last sample — the take is cut off. Do not ship it.`);
    process.exit(1);
  }

  const dst = join(SHIP, `${lang}.mp4`);
  if (existsSync(dst)) copyFileSync(dst, join(PREV, `reel-${lang}.mp4`));
  execFileSync('ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', '-y', '-i', raw,
    '-t', r.end.toFixed(2),
    '-vf', `scale=${WIDTH}:-2:flags=lanczos`,
    '-c:v', 'libx264', '-crf', String(CRF), '-preset', 'slow', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '96k',
    '-movflags', '+faststart', dst]);

  // Beat boundaries: the internal pauses nearest one third and two thirds of
  // the way through the speech. Every candidate is printed below.
  const speech = duration(dst);
  const cands = gaps(dst).filter(([s, e]) => s > 1 && e < speech - 1);
  const pick = (frac) => {
    const target = speech * frac;
    let best = null;
    for (const [s, e] of cands) {
      const mid = (s + e) / 2;
      if (best == null || Math.abs(mid - target) < Math.abs(best - target)) best = mid;
    }
    return best;
  };
  const m2 = pick(1 / 3);
  const m3 = pick(2 / 3);

  console.log(`\n${lang}: ${r.dur.toFixed(2)}s → ${speech.toFixed(2)}s, ` +
    `${(statSync(dst).size / 1048576).toFixed(2)} MB`);
  console.log(`  candidate pauses (start–end, midpoint):`);
  for (const [s, e] of cands) {
    const mid = (s + e) / 2;
    const tag = mid === m2 ? '  ← caption 2' : mid === m3 ? '  ← caption 3' : '';
    console.log(`    ${s.toFixed(2)}–${e.toFixed(2)}   mid ${mid.toFixed(2)}${tag}`);
  }
  if (m2 == null || m3 == null || !(m3 > m2)) {
    console.error(`✗ ${lang}: could not find two beat boundaries in order. Marks not written.`);
    process.exit(1);
  }
  marks[lang] = [0, Number(m2.toFixed(2)), Number(m3.toFixed(2))];
}

writeFileSync(join(root, 'src', 'data', 'abuelaMarks.json'), JSON.stringify(marks, null, 2) + '\n');
console.log(`\n✅ one continuous take per language in assets/abuela/`);
console.log(`   captions  es ${marks.es.join(' / ')}s   en ${marks.en.join(' / ')}s`);
console.log(`   the cross-dissolved reels they replace are in scripts/_abuela_prev/reel-*.mp4`);
console.log(`   Now run: npm run check`);
