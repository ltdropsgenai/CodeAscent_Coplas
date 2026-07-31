# coplas-web

The public pages for Coplas: landing, privacy policy, terms, support.
Deployed at https://coplas-web.vercel.app — the same host `SHARE_URL` in
`src/links.ts` points at, so a shared result links somewhere real.

## Why this exists

App Store Connect and Google Play both require a privacy policy at a public
HTTPS URL, and ASC additionally requires a support URL that resolves. An in-app
route (`/legal?doc=privacy`) satisfies neither.

## The one rule

`build.mjs` holds the prose. `app/legal.tsx` holds the same prose for the
in-app pages. **They must stay in step.** If you edit a paragraph in one, edit
it in the other. A privacy page that describes the app inaccurately reads to
App Review as a misrepresentation, not a typo.

## Running it

    node build.mjs      # writes public/
    npx http-server public

Vercel runs `node build.mjs` and serves `public/` (see `vercel.json`).
No dependencies, no framework, no build toolchain.
