#!/usr/bin/env node
/**
 * Fetch the REGENERATED Abuela clips for review, measure them, and only then
 * let you put them in the app.
 *
 *     node scripts/fetch-abuela-review.mjs            # download + measure
 *     node scripts/fetch-abuela-review.mjs --promote es
 *     node scripts/fetch-abuela-review.mjs --promote en
 *     node scripts/fetch-abuela-review.mjs --promote all
 *
 * Run this ON londi-pc. The cloud session is firewalled from the generation
 * CDN, same as fetch-abuela-video.mjs and fetch-audio.mjs.
 *
 * WHY A SEPARATE SCRIPT. fetch-abuela-video.mjs writes straight into
 * assets/abuela/. The English set in there was reviewed and approved, and a
 * regenerated clip is a fresh roll of a sampling model that may be worse.
 * Nothing here touches assets/abuela until --promote says so, and --promote
 * keeps the copy it replaces in scripts/_abuela_prev/.
 *
 * THE MEASUREMENTS, and what each one is for:
 *
 *   truncation  Is she still talking at the last sample? Spanish beat 3 has
 *               been shipping cut off mid-sentence, and no gate saw it. Any
 *               truncated clip stops this script dead.
 *   joins       PSNR between one clip's last frame and the next clip's first.
 *               All six clips are generated from the SAME start image, so each
 *               one opens on the identical portrait and closes wherever her
 *               motion left her — cut them together and she teleports back at
 *               every join.
 *
 *               READ THIS AS A COMPARISON, NOT A SCORE. PSNR depends on the
 *               resolution it is measured at: the same four joins read 27-29 dB
 *               downscaled to 200 px and 17-25 dB at the 640 px that ships, and
 *               a threshold quoted from one and applied to the other is
 *               meaningless. I quoted one at the other. What these numbers are
 *               good for is was-versus-now at the same size, which is what the
 *               table below prints and all it prints.
 *
 *               The joins may also matter less than they look. English measured
 *               22.6 and 19.8 dB — WORSE than the Spanish that was reported as
 *               broken — and English was reported as landing fine. The
 *               regeneration asked her to settle back into the opening pose as
 *               the last words land; measured against the clips it replaces,
 *               that did not work. The 200 ms dip in app/tutorial.tsx is what
 *               actually covers this.
 *
 * There is no /bin/sh on Windows. Every child process is spawnSync/execFileSync
 * with an argv array and no shell.
 */
import { writeFileSync, mkdirSync, existsSync, unlinkSync, statSync, copyFileSync, readdirSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { speechEnd, duration } from './lib/speech-end.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const NEW = join(root, 'scripts', '_abuela_new');
const RAW = join(NEW, 'raw');
const PREV = join(root, 'scripts', '_abuela_prev');
const SHIP = join(root, 'assets', 'abuela');

const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_395qbESmCeG8JPbpOIha0lzedrS';

/** Ship settings, applied here so what you watch is what ships. */
const WIDTH = 640;
const CRF = 26;

const CLIPS = [
  ['es-1', 'hf_20260807_190740_816cc967-5d34-42fd-a1be-27c7369c546b.mp4'],
  ['es-2', 'hf_20260807_190740_4503055c-f9b7-4e01-96f6-3e35be1a38ec.mp4'],
  ['es-3', 'hf_20260807_190740_043e137e-d440-4380-941d-3aa0f0bf48a0.mp4'],
  ['en-1', 'hf_20260807_190740_2a32e0e6-1aa4-43cc-916f-9b7a7f848e98.mp4'],
  ['en-2', 'hf_20260807_190740_fc215637-fac7-4d6a-85d8-382b0c14a53c.mp4'],
  ['en-3', 'hf_20260807_190740_7f04c252-d4f8-448e-9cad-05b777337c84.mp4'],
];

/** ffmpeg reports psnr on stderr and exits 0 — spawnSync, not execFileSync. */
function ffErr(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', ...args],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw r.error;
  return String(r.stderr ?? '');
}

function frame(file, where, dst) {
  const seek = where === 'first' ? ['-i', file] : ['-sseof', '-0.1', '-i', file];
  execFileSync('ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', '-y', ...seek,
    '-frames:v', '1', '-vf', `scale=${WIDTH}:-2`, '-update', '1', dst], { stdio: 'ignore' });
}

/** Higher = the two frames are closer. ~36 dB means "the same image". */
function psnr(a, b) {
  const out = ffErr(['-v', 'info', '-i', a, '-i', b, '-lavfi', 'psnr', '-f', 'null', '-']);
  const m = out.match(/average:([\d.]+)/);
  if (!m) {
    throw new Error('psnr reported no average. ffmpeg said:\n' +
      out.split('\n').filter(Boolean).slice(-6).join('\n'));
  }
  return Number(m[1]);
}

function joins(dir, lang) {
  const tmp = join(NEW, '.frames');
  mkdirSync(tmp, { recursive: true });
  const out = [];
  for (const n of [1, 2]) {
    const a = join(dir, `${lang}-${n}.mp4`);
    const b = join(dir, `${lang}-${n + 1}.mp4`);
    if (!existsSync(a) || !existsSync(b)) continue;
    const fa = join(tmp, `${lang}${n}-last.png`);
    const fb = join(tmp, `${lang}${n + 1}-first.png`);
    frame(a, 'last', fa);
    frame(b, 'first', fb);
    out.push([`${lang} ${n}→${n + 1}`, psnr(fa, fb)]);
  }
  return out;
}

function promote(which) {
  const langs = which === 'all' ? ['es', 'en'] : [which];
  if (!langs.every((l) => l === 'es' || l === 'en')) {
    console.error('✗ --promote takes es, en or all');
    process.exit(1);
  }
  // Never promote a clip that runs out mid-word. This is the check that was
  // missing when Spanish beat 3 shipped cut off.
  for (const lang of langs) {
    for (const n of [1, 2, 3]) {
      const f = join(NEW, `${lang}-${n}.mp4`);
      if (!existsSync(f)) {
        console.error(`✗ ${lang}-${n}.mp4 is not in scripts/_abuela_new/ — run without --promote first`);
        process.exit(1);
      }
      const r = speechEnd(f);
      if (r.truncated) {
        console.error(`✗ ${lang}-${n}.mp4 is still talking at its last sample — it is cut off. Not promoting.`);
        process.exit(1);
      }
    }
  }
  mkdirSync(PREV, { recursive: true });
  let moved = 0;
  for (const lang of langs) {
    for (const n of [1, 2, 3]) {
      const name = `${lang}-${n}.mp4`;
      const dst = join(SHIP, name);
      if (existsSync(dst)) copyFileSync(dst, join(PREV, name));
      copyFileSync(join(NEW, name), dst);
      moved += 1;
      console.log(`  promoted  ${name}   (previous copy kept in scripts/_abuela_prev/)`);
    }
  }
  console.log(`\n✅ ${moved} clips promoted into assets/abuela/`);
  console.log('   Now run: npm run check');
  console.log('   To undo: copy scripts/_abuela_prev/*.mp4 back over assets/abuela/');
}

const promoteArg = process.argv.indexOf('--promote');
if (promoteArg !== -1) {
  promote(process.argv[promoteArg + 1] ?? 'all');
  process.exit(0);
}

mkdirSync(RAW, { recursive: true });
console.log(`downloading ${CLIPS.length} regenerated clips → scripts/_abuela_new/\n`);
let failed = 0;
let truncated = 0;
for (const [name, remote] of CLIPS) {
  const raw = join(RAW, `${name}.mp4`);
  const dst = join(NEW, `${name}.mp4`);
  try {
    const res = await fetch(`${CDN}/${remote}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
    const r = speechEnd(raw);
    if (r.truncated) truncated += 1;
    // One pass: trim to the measured end of speech AND encode at ship settings,
    // so nothing is transcoded twice and what you watch is what ships.
    execFileSync('ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', '-y', '-i', raw,
      '-t', r.end.toFixed(2),
      '-vf', `scale=${WIDTH}:-2:flags=lanczos`,
      '-c:v', 'libx264', '-crf', String(CRF), '-preset', 'slow', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '96k',
      '-movflags', '+faststart', dst]);
    const mb = (statSync(dst).size / 1048576).toFixed(2);
    const flag = r.truncated ? '   ⚠ CUT OFF MID-SPEECH' : `   silence at end ${r.trailing.toFixed(1)}s`;
    console.log(`  ok    ${name}.mp4   ${r.dur.toFixed(1)}s → ${r.end.toFixed(1)}s   ${mb} MB${flag}`);
  } catch (e) {
    failed += 1;
    console.error(`  FAIL  ${name}: ${e.message}`);
    if (existsSync(raw)) unlinkSync(raw);
  }
}

if (failed) {
  console.error(`\n✗ ${failed} of ${CLIPS.length} failed. These URLs expire — a 403 means regenerate, not retry.`);
  process.exit(1);
}
if (truncated) {
  console.error(`\n✗ ${truncated} clip(s) run out mid-word. Regenerate those with more duration.`);
  console.error('  Do not promote them: this is exactly how Spanish beat 3 shipped cut off.');
  process.exit(1);
}

console.log('\njoin continuity — PSNR of one clip’s last frame against the next clip’s first');
console.log('measured at the resolution that ships, against the clips being replaced\n');
const rows = [];
for (const lang of ['es', 'en']) {
  const nw = joins(NEW, lang);
  const old = existsSync(join(PREV, `${lang}-1.mp4`)) ? joins(PREV, lang) : [];
  nw.forEach(([label, v], i) => rows.push([label, v, old[i]?.[1]]));
}
console.log('  join        was      now     change');
for (const [label, now, before] of rows) {
  const b = before == null ? '  —  ' : before.toFixed(1);
  const d = before == null ? '' : `${now > before ? '+' : ''}${(now - before).toFixed(1)} dB`;
  console.log(`  ${label.padEnd(10)} ${String(b).padStart(5)}    ${now.toFixed(1).padStart(5)}   ${d.padStart(8)}`);
}
console.log('\n  Higher is closer. Compare the columns; do not read either as a score.');

const total = readdirSync(NEW).filter((f) => f.endsWith('.mp4'))
  .reduce((n, f) => n + statSync(join(NEW, f)).size, 0);
console.log(`\n✅ six clips in scripts/_abuela_new/, ${(total / 1048576).toFixed(1)} MB total`);
console.log('   Watch them. Nothing in assets/abuela/ has been touched.');
console.log('   Then: node scripts/fetch-abuela-review.mjs --promote es|en|all');
