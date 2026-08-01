/**
 * Every require() in cardImages.ts points at a file that exists, and every
 * file's extension describes its actual bytes.
 *
 * WHY THIS EXISTS. Build 6 shipped 995 card images that were JPEG saved as
 * `.webp`, because bundle-cards.mjs took the extension from the Supabase
 * object key instead of from the response. Nothing caught it: tsc sees a
 * `require()` of a string literal and is satisfied, the files existed and were
 * the right size and the right dimensions, `bundle-budget` measured them
 * happily, and Android rendered them because Fresco sniffs content. iOS
 * resolves a bundled resource by its declared type, failed to decode all 995,
 * and CardTile fell back to its glyph placeholder — a board of blank gold
 * cards with correct numbers and correct names. It looked like a layout bug.
 *
 * The lesson generalises past images: a filename is a claim, and no other gate
 * in this repo verifies a claim about bytes. This one does.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
/**
 * Every generated registry that require()s a file. Card art was the first, but
 * the class is not about images: the music beds arrived from storage named
 * `.wav` while actually being ~187 kbps compressed audio, exactly as the cards
 * arrived named `.webp` while actually being JPEG. A filename is a claim.
 */
// All four generated registries. cardVideos.ts and sceneImages.ts were added
// once their assets became bundled: a require() pointing at a file that is not
// there is a Metro BUILD failure, not a missing picture, so it takes the whole
// app down rather than one card or one background. scripts/optimize-scenes.mjs
// rewrites those scene paths by hand, which is exactly the kind of edit that
// deserves a gate behind it.
const SOURCES = ['cardImages.ts', 'audioAssets.ts', 'cardVideos.ts', 'sceneImages.ts'].map((f) =>
  join(root, 'src', 'data', f)
);

/** Magic-byte sniffers, in the order it is cheapest to test them. */
const SNIFFERS = [
  ['jpg', (b) => b[0] === 0xff && b[1] === 0xd8],
  ['webp', (b) => b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP'],
  ['png', (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))],
  ['gif', (b) => b.slice(0, 3).toString('latin1') === 'GIF'],
  ['m4a', (b) => b.slice(4, 8).toString('latin1') === 'ftyp'],
  ['mp3', (b) => b.slice(0, 3).toString('latin1') === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)],
  ['wav', (b) => b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WAVE'],
];

/** Extensions that are just spellings of the same format.
 *  mp4 and m4a share the ISO base-media container and the same `ftyp` header,
 *  so the sniffer genuinely cannot tell them apart from the first 16 bytes —
 *  distinguishing them would mean reading the brand and the track types. The
 *  claim this gate exists to check is "the bytes are what the extension says",
 *  and for these two that is answered by the container. */
const ALIASES = { jpeg: 'jpg', aac: 'm4a', mp4: 'm4a' };
const norm = (e) => ALIASES[e] ?? e;

function sniff(buf) {
  for (const [name, test] of SNIFFERS) if (test(buf)) return name;
  return null;
}

const paths = SOURCES.flatMap((f) =>
  [...readFileSync(f, 'utf8').matchAll(/require\('([^']+)'\)/g)].map((m) => m[1])
);

if (!paths.length) {
  console.error('✗ no require() paths found — have the generators changed shape?');
  process.exit(1);
}

const missing = [];
const mismatched = [];
const unreadable = [];
const formats = new Map();
let bytes = 0;

for (const rel of paths) {
  // Paths in cardImages.ts are relative to src/data/.
  const abs = join(root, 'src', 'data', rel);
  if (!existsSync(abs)) {
    missing.push(rel);
    continue;
  }
  bytes += statSync(abs).size;
  const declared = norm(extname(abs).slice(1).toLowerCase());
  let head;
  try {
    const fd = readFileSync(abs);
    head = fd.subarray(0, 16);
  } catch (e) {
    unreadable.push(`${rel}: ${e.message}`);
    continue;
  }
  const actual = sniff(head);
  if (actual === null) {
    mismatched.push(`${rel}: declared ${declared}, bytes unrecognised (${head.subarray(0, 4).toString('hex')})`);
  } else if (actual !== declared) {
    mismatched.push(`${rel}: declared ${declared}, actually ${actual}`);
  }
  formats.set(actual ?? '?', (formats.get(actual ?? '?') ?? 0) + 1);
}

console.log(`required assets  ${paths.length}  (art + audio + video + scenes)`);
console.log(`on disk          ${paths.length - missing.length}  (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
console.log(`formats          ${[...formats].map(([k, v]) => `${k}×${v}`).join(', ') || '—'}`);
console.log(`MISSING — required but not on disk:              ${missing.length}`);
console.log(`MISMATCHED — extension does not match the bytes:  ${mismatched.length}`);

const show = (label, list) => {
  if (!list.length) return;
  console.error(`\n${label}`);
  for (const x of list.slice(0, 10)) console.error(`  ✗ ${x}`);
  if (list.length > 10) console.error(`  … and ${list.length - 10} more`);
};

show('MISSING', missing);
show('MISMATCHED', mismatched);
show('UNREADABLE', unreadable);

if (missing.length || mismatched.length || unreadable.length) process.exit(1);
console.log('\n✅ every bundled asset exists and its extension matches its bytes');
