#!/usr/bin/env node
/**
 * Asserts the few constants that MUST agree across files that cannot import
 * each other.
 *
 * app/legal.tsx carries a standing instruction — "the same copy is published
 * at coplas-web; THE TWO MUST STAY IN STEP" — and until now that instruction
 * was enforced by whoever remembered it. The support address is the case where
 * forgetting has a real cost: App Review reads the privacy policy and the
 * listing's support contact together, and an app whose policy names one
 * address while its support button opens another reads as carelessness at
 * best and as a misrepresentation at worst.
 *
 * coplas-web/build.mjs is plain Node and cannot import a .ts module, so the
 * value is necessarily duplicated there. Duplication is fine; UNCHECKED
 * duplication is not.
 *
 * Deliberately narrow. It checks values that are mechanically comparable, not
 * whether the prose matches — that needs a human, and a check that pretends
 * otherwise would give false comfort.
 *
 *   node scripts/check-legal-parity.mjs
 */
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

const errors = [];

// ── support address ─────────────────────────────────────────────────────────
const support = read('src/support.ts').match(/SUPPORT_EMAIL\s*=\s*'([^']+)'/)?.[1];
const web = read('coplas-web/build.mjs').match(/const CONTACT\s*=\s*'([^']+)'/)?.[1];
const legalSrc = read('app/legal.tsx');

if (!support) errors.push('src/support.ts: could not find SUPPORT_EMAIL');
if (!web) errors.push('coplas-web/build.mjs: could not find CONTACT');
if (support && web && support !== web) {
  errors.push(
    `support address differs:\n    src/support.ts        ${support}\n    coplas-web/build.mjs  ${web}`
  );
}

// legal.tsx must DERIVE the address rather than hold its own copy. A literal
// here is the bug this file exists to prevent, so it fails even if the literal
// currently happens to be correct — the next edit is what breaks it.
if (!/const CONTACT = SUPPORT_EMAIL/.test(legalSrc)) {
  errors.push(
    'app/legal.tsx: CONTACT must be `SUPPORT_EMAIL` imported from src/support.ts, not its own literal'
  );
}

// ── last-updated stamp ──────────────────────────────────────────────────────
// Both documents print a date to the reader. Two different dates on the same
// policy is the kind of detail a reviewer notices and a user cannot explain.
const dLegal = legalSrc.match(/const UPDATED = '([\d-]+)'/)?.[1];
const dWeb = read('coplas-web/build.mjs').match(/const UPDATED = '([\d-]+)'/)?.[1];
if (dLegal && dWeb && dLegal !== dWeb) {
  errors.push(`"last updated" differs: app/legal.tsx ${dLegal} vs coplas-web ${dWeb}`);
}

// ── store identifiers ───────────────────────────────────────────────────────
const links = read('src/links.ts');
const iosId = links.match(/IOS_APP_ID = '(\d+)'/)?.[1];
const pkg = links.match(/ANDROID_PACKAGE = '([\w.]+)'/)?.[1];
const webBuild = read('coplas-web/build.mjs');
if (iosId && !webBuild.includes(iosId)) {
  errors.push(`coplas-web does not link the iOS app id ${iosId} from src/links.ts`);
}
if (pkg && !webBuild.includes(pkg)) {
  errors.push(`coplas-web does not link the Android package ${pkg} from src/links.ts`);
}

console.log(`support address   ${support ?? '?'}`);
console.log(`last updated      ${dLegal ?? '?'}`);
console.log(`store ids         ios ${iosId ?? '?'} · ${pkg ?? '?'}`);
console.log(`\nERRORS   ${errors.length}`);
for (const e of errors) console.log(`  ✗ ${e}`);
if (!errors.length) console.log('\n✅ in-app and published legal copy agree on every checkable constant');
process.exit(errors.length ? 1 : 0);
