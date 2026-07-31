#!/usr/bin/env node
/**
 * Downloads the whole deck at display resolution into assets/cards/ and
 * rewrites src/data/cardImages.ts to require() them.
 *
 *     node scripts/bundle-cards.mjs [width]
 *
 * WHY. The board streamed the full 1792x2400 original — 185 kB a card — to
 * draw a tile about 240 physical px wide. Measured at 480 px the whole 995-card
 * deck is ~38 MB, which puts the app around 83 MB: far under the 200 MB
 * threshold where iOS warns on cellular and Play shows a mobile-data dialog.
 *
 * What this buys, beyond ~3 MB per fresh round:
 *   • the full deck works OFFLINE. `isDeckOnline()` restricts play to the base
 *     54 precisely because expansion art streams; once it is local that gate
 *     can come off for cards.
 *   • the "card renders as an emoji glyph because the image did not load"
 *     failure disappears.
 *   • ~180 MB of card art leaves Supabase egress permanently — it ships once in
 *     the binary instead of once per player.
 *
 * Video is NOT affected and stays streamed: 1,258 MB fits under no limit.
 *
 * Safe to re-run — already-downloaded files are skipped, so an interrupted run
 * resumes. Anything that fails to download keeps its remote URL as a fallback,
 * so a partial bundle still works.
 */
import { writeFileSync, mkdirSync, existsSync, statSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'assets', 'cards');
mkdirSync(OUT, { recursive: true });

const WIDTH = Number(process.argv[2] ?? 480);
const QUALITY = 78;
const ASPECT = 2400 / 1792;
const HEIGHT = Math.round(WIDTH * ASPECT);
const CONCURRENCY = 8;
const MIN_BYTES = 2000; // anything smaller is an error page, not a card

const CDN = 'https://bmybvrqbpachjxrejxdj.supabase.co/storage/v1';
const url = (id) =>
  `${CDN}/render/image/public/cards/${id}.webp?width=${WIDTH}&height=${HEIGHT}&resize=cover&quality=${QUALITY}`;

// ── deck ─────────────────────────────────────────────────────────────────────
const cardsSrc = readFileSync(join(root, 'src', 'data', 'cards.ts'), 'utf8');
const ids = [...cardsSrc.matchAll(/id:\s*'([a-z0-9_]+)'/g)].map((m) => m[1]);
const baseIds = new Set(ids);
for (const c of JSON.parse(readFileSync(join(root, 'src', 'data', 'expansion.cards.json'), 'utf8'))) {
  if (!baseIds.has(c.id)) ids.push(c.id);
}

console.log(`bundling ${ids.length} cards at ${WIDTH}x${HEIGHT} (quality ${QUALITY})\n`);

// ── download ─────────────────────────────────────────────────────────────────

/**
 * The extension has to describe the BYTES, not the source key.
 *
 * Supabase's object keys are named `.webp`, but its image-transform endpoint
 * returns JPEG. The first version of this script wrote every response to
 * `${id}.webp` on the strength of the key alone. Android rendered them anyway
 * (Fresco sniffs content), so nothing caught it — but iOS resolves a bundled
 * resource by its declared type, failed to decode all 995, and every card on
 * the board fell back to CardTile's glyph placeholder. Shipped that way in
 * build 6. Never trust the URL; read the magic bytes.
 */
function sniff(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') return 'webp';
  if (buf.slice(0, 8).toString('latin1') === '\x89PNG\r\n\x1a\n') return 'png';
  throw new Error(`unrecognised image format (starts ${buf.slice(0, 4).toString('hex')})`);
}

const EXTS = ['jpg', 'webp', 'png'];

/** id → the extension actually on disk. */
const ok = new Map();
const failed = [];
let done = 0;
let skipped = 0;
let bytes = 0;

async function one(id) {
  // Reuse whatever is already on disk, under whichever extension it landed as.
  for (const ext of EXTS) {
    const existing = join(OUT, `${id}.${ext}`);
    if (existsSync(existing) && statSync(existing).size >= MIN_BYTES) {
      ok.set(id, ext);
      bytes += statSync(existing).size;
      skipped++;
      return;
    }
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url(id));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < MIN_BYTES) throw new Error(`too small (${buf.length}B)`);
      const ext = sniff(buf);
      writeFileSync(join(OUT, `${id}.${ext}`), buf);
      ok.set(id, ext);
      bytes += buf.length;
      return;
    } catch (e) {
      if (attempt === 2) failed.push(`${id}: ${e.message}`);
      else await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
}

for (let i = 0; i < ids.length; i += CONCURRENCY) {
  await Promise.all(ids.slice(i, i + CONCURRENCY).map(one));
  done = Math.min(i + CONCURRENCY, ids.length);
  if (done % 80 === 0 || done === ids.length) {
    process.stdout.write(`  ${done}/${ids.length}  (${(bytes / 1024 / 1024).toFixed(1)} MB)\r`);
  }
}
console.log(`\n\ndownloaded ${ok.size - skipped}, reused ${skipped}, failed ${failed.length}`);
console.log(`assets/cards/ is ${(bytes / 1024 / 1024).toFixed(1)} MB`);
for (const f of failed.slice(0, 10)) console.log(`  ✗ ${f}`);
if (failed.length > 10) console.log(`  … and ${failed.length - 10} more`);

if (!ok.size) {
  console.error('\nNothing downloaded — leaving cardImages.ts alone.');
  process.exit(1);
}

// ── regenerate cardImages.ts ─────────────────────────────────────────────────
const entries = [...ok.keys()]
  .sort()
  .map((id) => `  ${id}: require('../../assets/cards/${id}.${ok.get(id)}'),`);

const formats = [...new Set(ok.values())].sort().join(', ');
console.log(`bundled formats on disk: ${formats}`);

const ts = `import type { ImageSourcePropType } from 'react-native';

/**
 * Card art registry. GENERATED by scripts/bundle-cards.mjs — edit that, not this.
 *
 * Every card is BUNDLED at ${WIDTH}x${HEIGHT}. A board tile draws about 240
 * physical px on a 3x phone (the board is capped to a 480pt column in
 * app/_layout.tsx), so ${WIDTH}px is roughly 2x oversampled and stays crisp on
 * iPad without shipping pixels nothing ever renders.
 *
 * The full-resolution 1792x2400 originals remain on Supabase and are used as a
 * fallback for any id missing from the bundle, so a partial bundle degrades to
 * streaming rather than to a blank card.
 *
 * The Spanish name is painted INTO the art, but that banner is bitmap text
 * drawn for a 480px card and a tile renders about 101pt wide. At that
 * reduction it is unreadable, so CardTile draws an opaque vector name plate
 * directly over it. That is intentional and is not a duplicate label — do not
 * "fix" it by hiding the plate. The bundled width is chosen for the ART.
 *
 * NOTE: video is deliberately NOT bundled. The clip set is 1,258 MB and fits
 * under no store limit; it stays streamed and capped per round.
 */

const CARDS_CDN = 'https://bmybvrqbpachjxrejxdj.supabase.co/storage/v1/object/public/cards';

/** Bundled art, id → Metro asset handle. */
const BUNDLED: Record<string, number> = {
${entries.join('\n')}
};

/** True when this card's art ships in the binary. */
export function isBundled(id: string): boolean {
  return id in BUNDLED;
}

/**
 * Art for a card: the bundled asset handle when we have it, otherwise the
 * remote original. Callers that hand this straight to <Image> should prefer
 * \`imageSource()\`, which builds the right shape for both cases.
 */
export function cardImage(id: string): number | string {
  return BUNDLED[id] ?? \`\${CARDS_CDN}/\${id}.webp\`;
}

/**
 * <Image source> for a card, correct whether the art is bundled or remote.
 *
 * This exists because a bundled asset is a NUMBER and a remote one needs
 * \`{ uri }\`. Wrapping a number as \`{ uri: n }\` renders nothing and throws no
 * error — silent blank cards — which is exactly what SolvedGroup's
 * \`cardImage(id) as string\` cast used to do the moment art was bundled.
 */
export function imageSource(id: string): ImageSourcePropType {
  const v = cardImage(id);
  return typeof v === 'number' ? v : { uri: v };
}

/**
 * Small-format art, for menu icons and solved-group strips.
 *
 * With the deck bundled this is just the bundled asset — <Image> scales it down
 * and no network is touched. Only an unbundled id falls back to Supabase's
 * transform endpoint, which needs BOTH dimensions (width alone leaves the
 * height untouched and distorts the image).
 */
export function cardThumb(id: string, width: number, height: number): number | string {
  if (id in BUNDLED) return BUNDLED[id];
  const w = Math.round(width * 2);
  const h = Math.round(height * 2);
  return \`\${CARDS_CDN.replace('/object/public/cards', '/render/image/public/cards')}/\${id}.webp?width=\${w}&height=\${h}&resize=cover&quality=72\`;
}

/** <Image source> for a thumbnail, correct whether bundled or remote. */
export function thumbSource(id: string, width: number, height: number): ImageSourcePropType {
  const v = cardThumb(id, width, height);
  return typeof v === 'number' ? v : { uri: v };
}

`;

writeFileSync(join(root, 'src', 'data', 'cardImages.ts'), ts);
console.log(`\n✓ ${ok.size} cards bundled; src/data/cardImages.ts regenerated.`);
if (failed.length) console.log(`  ${failed.length} kept their remote URL as fallback.`);
console.log('  Restart Expo with: npx expo start -c');
