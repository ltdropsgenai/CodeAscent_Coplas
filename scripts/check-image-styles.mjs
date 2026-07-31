/**
 * Every <Image> must pin BOTH of its dimensions.
 *
 * WHY THIS EXISTS. React Native stamps a static asset's intrinsic dimensions
 * onto <Image> as an explicit width and height. `flex: 1` overrides only the
 * MAIN axis. On the cross axis the intrinsic width survives, and it beats
 * `align-items: stretch` — so an <Image> styled `{ flex: 1 }` inside a column
 * renders at the asset's own width, no matter how narrow its container is.
 *
 * With `overflow: hidden` on the parent, the result is not a stretched image
 * and not a missing one: it is a sliver. Build 6 and build 7 both shipped every
 * card drawn 480px wide inside a 101px tile — the leftmost 21%, which for these
 * cards is border and background, so it read as "the art didn't load". Two
 * store builds were spent on wrong theories before the browser showed the
 * image wrapper measuring 480x137 inside a 101x137 parent.
 *
 * A remote { uri } source has no intrinsic size, so nothing is stamped on and
 * flex works. That is the trap: this defect cannot appear until the day you
 * bundle the asset, and it appears everywhere at once.
 *
 * An <Image> is accepted when its style pins width AND height, or fills its
 * parent absolutely. `flex` alone is never enough.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['app', 'src'];

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/** Text of the balanced {...} starting at `open`. */
function block(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  return '';
}

/** name → style body, for every StyleSheet.create in the file. */
function styleTable(src) {
  const table = new Map();
  for (const m of src.matchAll(/StyleSheet\.create\(/g)) {
    const body = block(src, src.indexOf('{', m.index));
    // Top-level `name: { ... }` entries only.
    for (const e of body.matchAll(/^\s{2}(\w+)\s*:\s*\{/gm)) {
      table.set(e[1], block(body, body.indexOf('{', e.index + e[0].length - 1)));
    }
    // Single-line `name: { ... },` entries are caught by the same pattern.
  }
  return table;
}

const pins = (text) =>
  (/\bwidth\s*:/.test(text) && /\bheight\s*:/.test(text)) ||
  /absoluteFill/.test(text) ||
  (/position\s*:\s*'absolute'/.test(text) && /\btop\s*:/.test(text) && /\bbottom\s*:/.test(text));

const problems = [];
let checked = 0;

for (const dir of DIRS) {
  for (const file of walk(join(root, dir))) {
    const src = readFileSync(file, 'utf8');
    if (!/<(Animated\.)?Image[\s/>]/.test(src)) continue;
    const styles = styleTable(src);

    for (const m of src.matchAll(/<(?:Animated\.)?Image\b/g)) {
      // The element runs to its self-closing '/>' — Image never has children.
      const end = src.indexOf('/>', m.index);
      if (end === -1) continue;
      const tag = src.slice(m.index, end);
      checked++;
      const line = src.slice(0, m.index).split('\n').length;

      const sm = tag.match(/style=\{/);
      if (!sm) {
        problems.push(`${relative(root, file)}:${line} — <Image> has no style at all`);
        continue;
      }
      const expr = block(tag, tag.indexOf('{', sm.index));
      // Inline dimensions anywhere in the expression satisfy it outright.
      let ok = pins(expr.replace(/styles\.\w+/g, ''));
      if (!ok) {
        for (const ref of expr.matchAll(/styles\.(\w+)/g)) {
          const body = styles.get(ref[1]);
          if (body && pins(body)) { ok = true; break; }
        }
      }
      if (!ok) {
        const named = [...expr.matchAll(/styles\.(\w+)/g)].map((r) => r[1]).join(', ') || 'inline';
        problems.push(
          `${relative(root, file)}:${line} — style (${named}) pins no width/height; ` +
            `flex alone leaves the cross axis at the asset's intrinsic size`
        );
      }
    }
  }
}

console.log(`<Image> elements checked  ${checked}`);
console.log(`UNPINNED — width/height not set: ${problems.length}`);
if (problems.length) {
  console.error('');
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error('\nFix: width/height 100%, explicit dimensions, or an absolute fill.');
  process.exit(1);
}
console.log('\n✅ every <Image> pins both dimensions');
