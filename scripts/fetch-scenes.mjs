#!/usr/bin/env node
/**
 * Downloads the animated-background scenes into assets/scenes/ and rewrites
 * src/data/sceneImages.ts to require() the local files (bundled, offline,
 * permanent). Run once, on your own machine, within ~24h of the scenes being
 * generated (the CDN preview links expire):
 *
 *     node scripts/fetch-scenes.mjs
 *
 * It swaps each `${CDN}/<file>` URL for require('../../assets/scenes/<file>')
 * in place, so all the country grouping comments are preserved. Safe to re-run:
 * if the file is already bundled (no remote URLs left) it just reports that.
 * AppBackground already accepts both a URL string and a bundled require() id,
 * so nothing else needs to change.
 *
 * If a download fails (links lapsed), regenerate the scenes and update the URLs,
 * or ask Claude to regenerate the set — this script leaves sceneImages.ts on the
 * remote URLs when any download fails.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCENES_TS = join(root, 'src', 'data', 'sceneImages.ts');
const OUT = join(root, 'assets', 'scenes');

const src = readFileSync(SCENES_TS, 'utf8');

const cdnMatch = src.match(/const CDN = '([^']+)'/);
const files = [...src.matchAll(/`\$\{CDN\}\/([^`]+)`/g)].map((m) => m[1]);

if (!files.length || !cdnMatch) {
  console.log('Nothing to do — sceneImages.ts has no remote ${CDN} URLs (already bundled?).');
  process.exit(0);
}
const CDN = cdnMatch[1];
mkdirSync(OUT, { recursive: true });

console.log(`Downloading ${files.length} scenes…`);
let ok = 0;
for (const file of files) {
  const url = `${CDN}/${file}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1024) throw new Error(`suspiciously small (${buf.length} bytes)`);
    writeFileSync(join(OUT, file), buf);
    console.log(`  ✓ ${file} (${(buf.length / 1024).toFixed(0)} KB)`);
    ok++;
  } catch (e) {
    console.error(`  ✗ ${file} — ${e.message}`);
  }
}

if (ok !== files.length) {
  console.error(`\nOnly ${ok}/${files.length} downloaded. The preview links may have expired — regenerate the scenes, then re-run. Leaving sceneImages.ts on the remote URLs.`);
  process.exit(1);
}

// Rewrite in place: swap each `${CDN}/<file>` for a bundled require(), drop the
// now-unused CDN const, and refresh the header note. Comments are preserved.
let out = src;
for (const file of files) {
  out = out.split('`${CDN}/' + file + '`').join(`require('../../assets/scenes/${file}')`);
}
out = out.replace(/const CDN = '[^']+';\n/, '');
out = out.replace(
  /\* Live PREVIEW URLs[\s\S]*?ship offline\./,
  '* BUNDLED offline: local PNGs under assets/scenes/, loaded via require().\n * (Rebuilt by scripts/fetch-scenes.mjs from the generated CDN previews.)'
);
out = out.replace(
  /\/\/ Values are remote URLs \(string\) now;[\s\S]*?AppBackground handles both\.\n/,
  ''
);
writeFileSync(SCENES_TS, out);

console.log(`\n✓ Bundled all ${ok} scenes and rewired src/data/sceneImages.ts to require() them.`);
console.log('  Restart Expo (npx expo start -c) to pick up the local files.');
