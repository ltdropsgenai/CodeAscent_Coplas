#!/usr/bin/env node
/**
 * Abuela's Home presence: her idle loop, and the lines she says when tapped.
 *
 *     node scripts/fetch-abuela-idle.mjs
 *
 * Run this ON londi-pc. Run it SOON — the voice URLs are short-lived, and one
 * set in this project expired inside the hour.
 *
 * THE LOOP IS PING-PONGED, and that is the whole point. A generated clip ends
 * wherever its motion left her, so looping it plays a cut every few seconds —
 * the same defect that made the tutorial read as three clips joined. Playing it
 * forward and then backward makes the last frame the neighbour of the first, so
 * the loop point is seamless BY CONSTRUCTION rather than by hoping the
 * generator returns to its opening pose. It was asked to do that on the
 * tutorial beats and it did not.
 *
 * Reversal is safe here because the motion has no direction: breathing in
 * reverse is breathing, a blink in reverse is a blink. It would NOT be safe for
 * a gesture that goes somewhere.
 *
 * The junction frames are dropped so neither the turn nor the wrap shows a
 * frozen duplicate, and the seam is then MEASURED — against the clip itself.
 *
 * NOT AGAINST A NUMBER I PICKED. The first version of this check demanded 32 dB
 * and failed a loop that was fine, because PSNR between two consecutive frames
 * depends on how much the picture moves and how hard it was compressed, and 32
 * was neither. The question worth asking is comparative: is the step at the loop
 * point bigger than the steps this clip already contains? Her blink is a 31 dB
 * step. If a blink does not read as a cut, a smaller step cannot.
 *
 * No shell anywhere — there is no /bin/sh on Windows.
 */
import { writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'assets', 'abuela');
const VOICE = join(root, 'assets', 'audio', 'voice');
const RAW = join(root, 'scripts', '_abuela_new', 'idle');

const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_395qbESmCeG8JPbpOIha0lzedrS';
const IDLE = 'hf_20260807_232357_0d83856a-958c-4e58-919a-5f4f77f00d4c.mp4';

/** She is 96 pt wide on Home. 320 px covers a 3x screen with room to spare. */
const WIDTH = 320;
/**
 * CRF 20, not 28. At 28 the loop seam measured 30.8 dB against a median frame
 * step of 40.3 — most of that gap was quantisation error at the tail of a GOP,
 * not motion. At 20 the file is 0.33 MB instead of 0.10 and the seam is 35.0.
 * A third of a megabyte is a cheap way to stop the encoder from inventing a cut.
 */
const CRF = 20;

const LINES = [
  ['abuela_es_1', 'https://elevenlabs-mcp-server.ltdrops.workers.dev/audio/e62e3e7e-c5d6-46a5-95cd-cb68309cfa17.mp3', "Ven, te cuento."],
  ['abuela_es_2', 'https://elevenlabs-mcp-server.ltdrops.workers.dev/audio/72178988-dea5-4b4d-a6ee-d93d4b47cae2.mp3', "Otra vez, con gusto."],
  ['abuela_es_3', 'https://elevenlabs-mcp-server.ltdrops.workers.dev/audio/1f523d25-609e-43a4-8e88-9fe2d85f076e.mp3', "Escucha bien."],
  ['abuela_es_4', 'https://elevenlabs-mcp-server.ltdrops.workers.dev/audio/284943da-902c-414d-859b-5c62552a3be3.mp3', "Ven, siéntate."],
  ['abuela_es_5', 'https://elevenlabs-mcp-server.ltdrops.workers.dev/audio/d221b3da-cec4-4c61-90a7-09edd89db23e.mp3', "¿Te cuento otra vez?"],
  ['abuela_es_6', 'https://elevenlabs-mcp-server.ltdrops.workers.dev/audio/be82f785-5d1f-4395-8e65-a2a4d710c40d.mp3', "Con calma, yo te explico."],
  ['abuela_es_7', 'https://elevenlabs-mcp-server.ltdrops.workers.dev/audio/2e85558b-911b-484a-8c93-2b690680297f.mp3', "Déjame enseñarte."],
  ['abuela_es_8', 'https://elevenlabs-mcp-server.ltdrops.workers.dev/audio/bd484408-84dd-4efe-ab14-737205f37888.mp3', "Ay, mi vida, ven acá."],
  ['abuela_en_1', 'https://elevenlabs-mcp-server.ltdrops.workers.dev/audio/e835705f-96f4-4466-b452-1c5e1a5f43a1.mp3', "Come, let me tell you."],
  ['abuela_en_2', 'https://elevenlabs-mcp-server.ltdrops.workers.dev/audio/654a6c9a-d066-41b7-b0eb-c690b4705511.mp3', "Again? With pleasure."],
  ['abuela_en_3', 'https://elevenlabs-mcp-server.ltdrops.workers.dev/audio/0d3828e7-fcae-4dc7-9bc7-4693981210c7.mp3', "Listen close now."],
  ['abuela_en_4', 'https://elevenlabs-mcp-server.ltdrops.workers.dev/audio/8d99933f-f4ef-44bc-b526-f3213a5ec858.mp3', "Come, sit with me."],
  ['abuela_en_5', 'https://elevenlabs-mcp-server.ltdrops.workers.dev/audio/1e89fbb7-acc0-444a-af28-1c05b185d2d0.mp3', "Shall I tell you again?"],
  ['abuela_en_6', 'https://elevenlabs-mcp-server.ltdrops.workers.dev/audio/12c813bb-8b29-4851-bbbe-6e6088605234.mp3', "Slowly now. I'll explain."],
  ['abuela_en_7', 'https://elevenlabs-mcp-server.ltdrops.workers.dev/audio/eea3b21b-f951-4615-af60-83c362a71f02.mp3', "Let me show you."],
  ['abuela_en_8', 'https://elevenlabs-mcp-server.ltdrops.workers.dev/audio/26d0f081-ea3c-4a64-8c15-c46f5c2a6b10.mp3', "Come here, corazón."],
];

function ffErr(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', ...args],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw r.error;
  return String(r.stderr ?? '');
}

function probe(file, entries) {
  const r = spawnSync('ffprobe',
    ['-v', 'error', '-select_streams', 'v:0', '-count_frames',
      '-show_entries', entries, '-of', 'csv=p=0', file], { encoding: 'utf8' });
  if (r.error) throw r.error;
  return String(r.stdout ?? '').trim();
}

function frame(file, where, dst) {
  const seek = where === 'first' ? ['-i', file] : ['-sseof', '-0.08', '-i', file];
  execFileSync('ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', '-y', ...seek,
    '-frames:v', '1', '-update', '1', dst], { stdio: 'ignore' });
}

/** Exact frame by index — `-sseof` is approximate and the seam is not. */
function frame2(file, index, dst) {
  execFileSync('ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', '-y', '-i', file,
    '-vf', `select=eq(n\\,${index})`, '-vsync', '0', '-frames:v', '1', '-update', '1', dst],
    { stdio: 'ignore' });
}

function psnr(a, b) {
  const out = ffErr(['-v', 'info', '-i', a, '-i', b, '-lavfi', 'psnr', '-f', 'null', '-']);
  const m = out.match(/average:([\d.]+)/);
  if (!m) {
    throw new Error('psnr reported no average. ffmpeg said:\n' +
      out.split('\n').filter(Boolean).slice(-6).join('\n'));
  }
  return Number(m[1]);
}

mkdirSync(RAW, { recursive: true });
mkdirSync(OUT, { recursive: true });
mkdirSync(VOICE, { recursive: true });

// Her lines come FIRST: they are the perishable input. A seam failure on the
// loop must not cost a set of voice URLs that expire.
// --------------------------------------------------------------- her lines
console.log('');
let failed = 0;
/**
 * Two lines that are the same recording would be invisible: the pool would just
 * feel smaller than it looks. Worth checking, because it nearly fooled me —
 * abuela_es_3 and abuela_en_3 came back the same SIZE to the byte, which turned
 * out to be two different recordings of the same duration at a constant
 * bitrate. Sizes collide; content should not.
 */
const seen = new Map();
for (const [name, url, text] of LINES) {
  const out = join(VOICE, `${name}.mp3`);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 2000) throw new Error(`only ${buf.length} bytes — that is not an mp3`);
    const sum = createHash('md5').update(buf).digest('hex');
    const twin = seen.get(sum);
    if (twin) throw new Error(`byte-identical to ${twin} — the same recording twice`);
    seen.set(sum, name);
    writeFileSync(out, buf);
    console.log(`  ok    ${name}.mp3   ${(buf.length / 1024).toFixed(0)} KB   "${text}"`);
  } catch (e) {
    failed += 1;
    console.error(`  FAIL  ${name}: ${e.message}`);
  }
}
if (failed) {
  console.error(`\n✗ ${failed} of ${LINES.length} lines failed. These URLs are short-lived — a 404 means regenerate, not retry.`);
  process.exit(1);
}

// ---------------------------------------------------------------- the loop
const raw = join(RAW, 'idle-raw.mp4');
if (!existsSync(raw)) {
  const res = await fetch(`${CDN}/${IDLE}`);
  if (!res.ok) {
    console.error(`✗ idle clip: HTTP ${res.status}. A 403 means regenerate, not retry.`);
    process.exit(1);
  }
  writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
}

const frames = Number(probe(raw, 'stream=nb_read_frames'));
if (!Number.isFinite(frames) || frames < 10) {
  console.error(`✗ ffprobe counted ${frames} frames in the idle clip — the measurement is broken, not the clip`);
  process.exit(1);
}

const dst = join(OUT, 'idle.mp4');
// Forward, then reversed with BOTH junction frames dropped: the first frame of
// the reverse duplicates the last frame of the forward, and its last frame
// duplicates the frame the loop is about to show again.
execFileSync('ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', '-y', '-i', raw,
  '-filter_complex',
  `[0:v]scale=${WIDTH}:-2:flags=lanczos,split[a][b];` +
  `[b]reverse,select='between(n\\,1\\,${frames - 2})',setpts=N/FRAME_RATE/TB[r];` +
  `[a][r]concat=n=2:v=1:a=0[v]`,
  '-map', '[v]', '-an',
  '-c:v', 'libx264', '-crf', String(CRF), '-preset', 'slow', '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart', dst]);

const a = join(RAW, 'seam-last.png');
const b = join(RAW, 'seam-first.png');
frame2(dst, Number(probe(dst, 'stream=nb_read_frames')) - 1, a);
frame2(dst, 0, b);
const seam = psnr(a, b);
const loopFrames = Number(probe(dst, 'stream=nb_read_frames'));

// The baseline: how big are the steps this clip already takes? Sampled across
// the whole loop, so a blink is in there.
const steps = [];
for (let k = 1; k < loopFrames - 2; k += 8) {
  frame2(dst, k, join(RAW, 'step-a.png'));
  frame2(dst, k + 1, join(RAW, 'step-b.png'));
  steps.push(psnr(join(RAW, 'step-a.png'), join(RAW, 'step-b.png')));
}
if (steps.length < 5) {
  console.error('✗ could not sample enough frame pairs to calibrate — this check is measuring nothing');
  process.exit(1);
}
steps.sort((x, y) => x - y);
const worst = steps[0];
const median = steps[Math.floor(steps.length / 2)];

console.log(`idle loop   ${frames} frames in → ${loopFrames} out, ` +
  `${(statSync(dst).size / 1048576).toFixed(2)} MB, silent`);
console.log(`frame steps within the clip:  worst ${worst.toFixed(1)} dB · median ${median.toFixed(1)} dB`);
console.log(`loop seam:                    ${seam.toFixed(1)} dB`);
if (seam < worst) {
  console.error(`\n✗ the loop point is the biggest jump in the clip. That is a cut, and it would show.`);
  process.exit(1);
}
console.log(`→ the loop step is no larger than one the clip already contains`);

console.log(`\n✅ idle loop and six lines in place`);
console.log(`   Next, in this order:`);
console.log(`     node scripts/master-voice.mjs     (levels the new lines with the rest)`);
console.log(`     npm run check`);
