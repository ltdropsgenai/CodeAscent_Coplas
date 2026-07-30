/**
 * Localization coverage check for puzzle content.
 *
 * `groups.json` and `expansion.groups.json` are GENERATED — re-running
 * `scripts/gen-more-puzzles.mjs` can introduce new themes and explanations at
 * any time. The English overlay in `src/data/groupText.en.json` is keyed by the
 * Spanish string, so a new group doesn't crash anything: it just silently shows
 * Spanish to an English player. Silent is the problem. This script makes it loud.
 *
 *   node scripts/check-i18n.mjs
 *
 * Exits non-zero when anything is untranslated, so it can gate a release.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

const groups = { ...read('src/data/groups.json'), ...read('src/data/expansion.groups.json') };
const dict = read('src/data/groupText.en.json');

const themes = new Set();
const whys = new Set();
for (const g of Object.values(groups)) {
  themes.add(g.theme);
  whys.add(g.why);
}

// puzzles.json is NOT merely a projection of the group libraries. The earliest
// boards were authored by hand and their themes/explanations exist nowhere
// else, so scanning only the generated libraries reported 100% coverage while
// English players got Spanish reveals on coplas-0001 onward — the very first
// puzzles anyone plays. What ships is what must be checked.
for (const p of read('src/data/puzzles.json')) {
  for (const g of p.groups) {
    themes.add(g.theme);
    whys.add(g.explanation);
  }
}

const missingThemes = [...themes].filter((t) => !(t in dict.themes)).sort();
const missingWhys = [...whys].filter((w) => !(w in dict.whys)).sort();

// The reverse direction is only informational: stale keys cost nothing but
// suggest a group was renamed or dropped, which is worth knowing about.
const staleThemes = Object.keys(dict.themes).filter((t) => !themes.has(t));
const staleWhys = Object.keys(dict.whys).filter((w) => !whys.has(w));

const pct = (have, total) => (total === 0 ? 100 : ((have / total) * 100).toFixed(1));

console.log(`groups            ${Object.keys(groups).length}`);
console.log(
  `themes translated ${themes.size - missingThemes.length}/${themes.size}  (${pct(themes.size - missingThemes.length, themes.size)}%)`
);
console.log(
  `whys   translated ${whys.size - missingWhys.length}/${whys.size}  (${pct(whys.size - missingWhys.length, whys.size)}%)`
);

if (staleThemes.length || staleWhys.length) {
  console.log(`\nstale keys (in the dictionary, no longer in the deck): ${staleThemes.length + staleWhys.length}`);
  for (const t of staleThemes.slice(0, 10)) console.log(`  theme  ${t}`);
  for (const w of staleWhys.slice(0, 10)) console.log(`  why    ${w}`);
}

if (missingThemes.length || missingWhys.length) {
  console.error(`\nUNTRANSLATED — English players will see Spanish for these:`);
  for (const t of missingThemes) console.error(`  theme  ${t}`);
  for (const w of missingWhys) console.error(`  why    ${w}`);
  console.error(
    `\nAdd them to src/data/groupText.en.json. Card names stay Spanish; rhyme and\n` +
      `letter explanations are copied verbatim; hidden-word ones get an English gloss.`
  );
  process.exit(1);
}

console.log('\nAll puzzle content is translated.');
