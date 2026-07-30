#!/usr/bin/env node
/**
 * Coplas — rehost generated card art from Higgsfield's CDN onto our own
 * Supabase Storage, so the app references URLs WE control.
 *
 * Runs on londi-pc (needs network access to BOTH Higgsfield's CloudFront CDN
 * and Supabase — the cloud sandbox is firewalled from Higgsfield, so this step
 * happens here). Node 18+ (global fetch).
 *
 * Input map (from the generation workflow), JSON:
 *   { "<cardId>": { "raw": "<higgsfield .png url>", "min": "<higgsfield _min.webp url>" }, ... }
 *
 * For each card it downloads the streaming-optimized `min` webp and uploads it
 * to Supabase Storage at  <BUCKET>/<cardId>.webp , then writes an output map:
 *   { "<cardId>": "<public Supabase URL>", ... }   → src/data/expansion.cardImages.json
 *
 * Env:
 *   SUPABASE_URL          e.g. https://<ref>.supabase.co
 *   SUPABASE_SERVICE_KEY  service_role key (server-side only; never ship in app)
 *   BUCKET                default "cards"
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/rehost-to-supabase.mjs \
 *     src/data/_higgsfield_urls.json  src/data/expansion.cardImages.json
 */
import fs from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = process.env.BUCKET || 'cards';
const CONCURRENCY = Number(process.env.CONCURRENCY || 8);
const [inPath, outPath] = process.argv.slice(2);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars.');
  process.exit(1);
}
if (!inPath || !outPath) {
  console.error('Usage: node rehost-to-supabase.mjs <input-map.json> <output-map.json>');
  process.exit(1);
}

const input = JSON.parse(fs.readFileSync(inPath, 'utf8'));
const entries = Object.entries(input.cards ?? input); // accept {cards:{...}} or a flat map
const out = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};

function publicUrl(path) {
  return `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function withRetry(fn, tries = 3) {
  let err;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { err = e; await new Promise((r) => setTimeout(r, 800 * (i + 1))); }
  }
  throw err;
}

async function rehostOne(id, urls) {
  const src = urls.min || urls.raw;
  if (!src) throw new Error('no source url');
  const path = `${id}.webp`;
  // download bytes from Higgsfield CDN
  const bytes = await withRetry(async () => {
    const r = await fetch(src);
    if (!r.ok) throw new Error(`download ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  });
  // upload to Supabase Storage (upsert)
  await withRetry(async () => {
    const r = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        'Content-Type': 'image/webp',
        'x-upsert': 'true',
        'cache-control': '31536000',
      },
      body: bytes,
    });
    if (!r.ok) throw new Error(`upload ${r.status}: ${(await r.text()).slice(0, 160)}`);
  });
  return publicUrl(path);
}

let done = 0, failed = 0;
const todo = entries.filter(([id]) => !out[id]); // resume-friendly: skip already rehosted
console.log(`Rehosting ${todo.length} cards (of ${entries.length}) → bucket "${BUCKET}"  [${done} already done]`);

async function worker(queue) {
  while (queue.length) {
    const [id, urls] = queue.shift();
    try {
      out[id] = await rehostOne(id, urls);
      done++;
      if (done % 25 === 0) { fs.writeFileSync(outPath, JSON.stringify(out, null, 2)); console.log(`  ${done}/${todo.length} …`); }
    } catch (e) {
      failed++;
      console.error(`  FAIL ${id}: ${e.message}`);
    }
  }
}

const queue = [...todo];
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`Done. rehosted=${done} failed=${failed} total_in_map=${Object.keys(out).length}. Wrote ${outPath}`);
if (failed) console.log('Re-run to retry failures (already-done cards are skipped).');
