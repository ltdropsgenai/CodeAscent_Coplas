#!/usr/bin/env node
/**
 * Coplas brand-kit generator.
 *
 * Emits self-contained SVGs (Fraunces embedded as base64 so text renders
 * anywhere) for an ornate golden Lotería emblem — a fan of three mini cards
 * (moon / sun / marigold) inside a beaded gold medallion with a papel-picado
 * band and a COPLAS banner. Produces: badge (hero), app icon (mark), wordmark,
 * monochrome mark, favicon.
 *
 * Run: node brand/build.mjs   → writes brand/*.svg
 * PNGs are rasterized separately (brand/raster.mjs, headless Chromium).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'brand');
const b64 = (p) => readFileSync(p).toString('base64');
const fraunces = b64(join(root, 'node_modules/@expo-google-fonts/fraunces/900Black/Fraunces_900Black.ttf'));
const mono = b64(join(root, 'node_modules/@expo-google-fonts/space-mono/400Regular/SpaceMono_400Regular.ttf'));

const FONTCSS = `
@font-face{font-family:'Fraunces';src:url(data:font/ttf;base64,${fraunces}) format('truetype');font-weight:900;font-style:normal;}
@font-face{font-family:'SpaceMono';src:url(data:font/ttf;base64,${mono}) format('truetype');font-weight:400;font-style:normal;}
`;

// ── palette (from src/theme.ts) ────────────────────────────────────────────
const C = {
  indigo0: '#0A0820', indigo1: '#161138', indigo2: '#241A4A',
  disc0: '#33174A', disc1: '#150B28',
  gold0: '#FCE9A8', gold1: '#F4B942', gold2: '#D9901F', gold3: '#8A6A28', gold4: '#5A461C',
  ink: '#241304', cream: '#F5EFE0',
  magenta: '#E4479B', violet: '#8B5CF6', teal: '#33E0C6',
};

const round = (n) => Math.round(n * 100) / 100;
const pol = (cx, cy, r, deg) => [round(cx + r * Math.cos((deg - 90) * Math.PI / 180)), round(cy + r * Math.sin((deg - 90) * Math.PI / 180))];

// ── shared defs (gradients) ─────────────────────────────────────────────────
function defs(withFont) {
  return `<defs>
    ${withFont ? `<style>${FONTCSS}</style>` : ''}
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.gold0}"/><stop offset="0.42" stop-color="${C.gold1}"/>
      <stop offset="0.78" stop-color="${C.gold2}"/><stop offset="1" stop-color="${C.gold4}"/>
    </linearGradient>
    <linearGradient id="goldFrame" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${C.gold0}"/><stop offset="0.5" stop-color="${C.gold1}"/>
      <stop offset="1" stop-color="${C.gold3}"/>
    </linearGradient>
    <radialGradient id="goldRad" cx="0.4" cy="0.35" r="0.75">
      <stop offset="0" stop-color="${C.gold0}"/><stop offset="0.6" stop-color="${C.gold1}"/>
      <stop offset="1" stop-color="${C.gold2}"/>
    </radialGradient>
    <radialGradient id="indigoBg" cx="0.5" cy="0.42" r="0.75">
      <stop offset="0" stop-color="${C.indigo2}"/><stop offset="0.6" stop-color="${C.indigo1}"/>
      <stop offset="1" stop-color="${C.indigo0}"/>
    </radialGradient>
    <radialGradient id="disc" cx="0.5" cy="0.44" r="0.62">
      <stop offset="0" stop-color="${C.disc0}"/><stop offset="1" stop-color="${C.disc1}"/>
    </radialGradient>
    <radialGradient id="auroraM" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${C.magenta}" stop-opacity="0.55"/><stop offset="1" stop-color="${C.magenta}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="auroraV" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${C.violet}" stop-opacity="0.5"/><stop offset="1" stop-color="${C.violet}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="auroraT" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${C.teal}" stop-opacity="0.45"/><stop offset="1" stop-color="${C.teal}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${C.gold1}" stop-opacity="0.5"/><stop offset="1" stop-color="${C.gold1}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ribbon" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.gold0}"/><stop offset="0.5" stop-color="${C.gold1}"/><stop offset="1" stop-color="${C.gold2}"/>
    </linearGradient>
  </defs>`;
}

// ── glyphs (centered at 0,0, ~44px) ─────────────────────────────────────────
function sun(m) {
  const fill = m ? 'currentColor' : 'url(#goldRad)';
  let rays = '';
  for (let i = 0; i < 12; i++) {
    rays += `<path d="M0,-30 L4.4,-19 L-4.4,-19 Z" fill="${m ? 'currentColor' : 'url(#gold)'}" transform="rotate(${i * 30})"/>`;
  }
  return `${rays}<circle r="15" fill="${fill}"/><circle r="15" fill="none" stroke="${C.gold3}" stroke-width="1.2" opacity="${m ? 0 : 1}"/>`;
}
function moon(m) {
  if (m) return `<path d="M 7,-20 A 20,20 0 1 0 7,20 A 15,15 0 1 1 7,-20 Z" fill="none" stroke="currentColor" stroke-width="3"/>`;
  // gold disc carved by a card-face-coloured disc → clean crescent
  return `<circle r="20" fill="url(#goldRad)"/><circle cx="9" cy="-4" r="16.5" fill="#0E0922"/>`;
}
function marigold(m) {
  const outer = m ? 'currentColor' : 'url(#gold)';
  const inner = m ? 'currentColor' : C.gold1;
  let p = '';
  for (let i = 0; i < 12; i++) p += `<ellipse cx="0" cy="-15" rx="6" ry="11.5" fill="${outer}" transform="rotate(${i * 30})"/>`;
  for (let i = 0; i < 8; i++) p += `<ellipse cx="0" cy="-9" rx="5" ry="8.5" fill="${inner}" transform="rotate(${i * 45 + 22})"/>`;
  p += `<circle r="6" fill="${m ? 'currentColor' : C.gold2}"/>`;
  return p;
}

// ── one mini card in the fan ────────────────────────────────────────────────
function card(rot, glyph, m) {
  const face = m ? 'none' : '#0E0922';
  const frame = m ? 'currentColor' : 'url(#goldFrame)';
  return `<g transform="rotate(${rot} 256 384)">
    <rect x="209" y="182" width="94" height="150" rx="13" fill="${m ? 'none' : '#160F32'}" stroke="${frame}" stroke-width="5"/>
    <rect x="216" y="189.5" width="80" height="135" rx="8" fill="${face}" stroke="${C.gold3}" stroke-width="1.4" ${m ? 'stroke="currentColor"' : ''}/>
    <g transform="translate(256,224)">${glyph}</g>
  </g>`;
}

// ── the emblem (mark). opts: {mono, banner} ─────────────────────────────────
function emblem({ m = false, banner = true } = {}) {
  const g = (x) => (m ? 'currentColor' : x);
  let s = '';

  // halo behind
  if (!m) s += `<circle cx="256" cy="252" r="220" fill="url(#halo)"/>`;

  // outer rings + beads
  s += `<circle cx="256" cy="252" r="228" fill="none" stroke="${g('url(#gold)')}" stroke-width="3"/>`;
  // beaded ring
  let beads = '';
  const NB = 60;
  for (let i = 0; i < NB; i++) { const [x, y] = pol(256, 252, 216, (360 / NB) * i); beads += `<circle cx="${x}" cy="${y}" r="3.4" fill="${g('url(#gold)')}"/>`; }
  s += beads;
  // main bevel frame
  s += `<circle cx="256" cy="252" r="204" fill="none" stroke="${g('url(#goldFrame)')}" stroke-width="10"/>`;
  s += `<circle cx="256" cy="252" r="197.5" fill="none" stroke="${m ? 'currentColor' : C.gold3}" stroke-width="1.5" opacity="${m ? 0.6 : 1}"/>`;

  // papel-picado band: diamonds + hanging dots
  const ND = 28;
  let pic = '';
  for (let i = 0; i < ND; i++) {
    const a = (360 / ND) * i;
    const [x, y] = pol(256, 252, 186, a);
    pic += `<g transform="translate(${x},${y}) rotate(${a})"><rect x="-5" y="-5" width="10" height="10" transform="rotate(45)" fill="${g('url(#gold)')}"/><circle cx="0" cy="9" r="2" fill="${g('url(#gold)')}"/></g>`;
  }
  s += pic;

  // inner ring + disc
  s += `<circle cx="256" cy="252" r="172" fill="${m ? 'none' : 'url(#disc)'}" stroke="${g('url(#gold)')}" stroke-width="2.5"/>`;
  if (!m) {
    s += `<circle cx="256" cy="212" r="120" fill="url(#auroraV)"/>`;
    s += `<circle cx="256" cy="300" r="120" fill="url(#auroraM)"/>`;
  }

  // fanned cards (back to front): left, right, center.
  // Mono is one flat colour with see-through faces, so overlapping cards would
  // cross messily — use a single centred card there instead.
  if (m) {
    s += card(0, sun(m), m);
  } else {
    s += card(-28, moon(m), m);
    s += card(28, marigold(m), m);
    s += card(0, sun(m), m);
  }

  // sparkles inside disc
  if (!m) {
    const spk = [[180, 175, 3], [332, 190, 2.4], [196, 300, 2.2], [320, 305, 3], [256, 150, 2.4]];
    for (const [x, y, r] of spk) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.gold0}" opacity="0.85"/>`;
  }

  // marigold crest topper at 12 o'clock
  s += `<g transform="translate(256,52) scale(1.15)">${marigold(m)}</g>`;

  // banner
  if (banner) {
    s += `<g>
      <path d="M120,372 L96,360 L96,404 L120,416 Z" fill="${m ? 'none' : '#B5822A'}" stroke="${m ? 'currentColor' : C.gold4}" stroke-width="1.5"/>
      <path d="M392,372 L416,360 L416,404 L392,416 Z" fill="${m ? 'none' : '#B5822A'}" stroke="${m ? 'currentColor' : C.gold4}" stroke-width="1.5"/>
      <path d="M120,366 L392,366 L392,414 L120,414 Z" fill="${m ? 'none' : 'url(#ribbon)'}" stroke="${g('url(#gold)')}" stroke-width="2"/>
      <text x="256" y="399" text-anchor="middle" font-family="Fraunces" font-weight="900" font-size="40" letter-spacing="5" fill="${m ? 'currentColor' : C.ink}">COPLAS</text>
    </g>`;
  }
  return s;
}

// ── page assembly ───────────────────────────────────────────────────────────
function bg() {
  return `<rect x="0" y="0" width="512" height="512" rx="0" fill="url(#indigoBg)"/>
    <circle cx="120" cy="90" r="180" fill="url(#auroraV)"/>
    <circle cx="410" cy="120" r="170" fill="url(#auroraM)"/>
    <circle cx="256" cy="470" r="200" fill="url(#auroraT)"/>
    ${bokeh()}`;
}
function bokeh() {
  const pts = [[60, 200, 3], [90, 380, 2], [440, 300, 3], [470, 210, 2], [200, 60, 2.5], [330, 70, 2], [60, 470, 2.5], [452, 452, 3], [40, 300, 2], [256, 40, 2]];
  return pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.gold1}" opacity="0.7"/>`).join('');
}

function svg(w, h, inner, withFont) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs(withFont)}${inner}</svg>`;
}

// BADGE (hero: bg + emblem + banner)
writeFileSync(join(OUT, 'coplas-badge.svg'), svg(512, 512, bg() + emblem({ banner: true }), true));

// APP ICON (bg + emblem, no banner; mark centered with safe margin)
writeFileSync(join(OUT, 'coplas-icon.svg'),
  svg(512, 512, bg() + `<g transform="translate(256,268) scale(0.96) translate(-256,-252)">${emblem({ banner: false })}</g>`, false));

// FAVICON (reduced: ring + beads + big sun)
{
  let f = `<circle cx="256" cy="256" r="150" fill="url(#indigoBg)"/>`;
  f += `<circle cx="256" cy="256" r="200" fill="url(#disc)" stroke="url(#goldFrame)" stroke-width="14"/>`;
  const NB = 40; let bd = '';
  for (let i = 0; i < NB; i++) { const [x, y] = pol(256, 256, 176, (360 / NB) * i); bd += `<circle cx="${x}" cy="${y}" r="6" fill="url(#gold)"/>`; }
  f += bd;
  f += `<g transform="translate(256,256) scale(3.4)">${sun(false)}</g>`;
  writeFileSync(join(OUT, 'coplas-favicon.svg'), svg(512, 512, f, false));
}

// MONO (single-color line mark on transparent; recolor via color attr)
writeFileSync(join(OUT, 'coplas-mono.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" style="color:${C.gold1}">${defs(true)}<g transform="translate(256,258) scale(0.98) translate(-256,-252)">${emblem({ m: true, banner: true })}</g></svg>`);

// WORDMARK (emblem mark left + Coplas + tagline)
{
  const W = 1500, H = 460;
  const mark = `<g transform="translate(230,232) scale(0.8) translate(-256,-252)">${emblem({ banner: false })}</g>`;
  const word = `<text x="470" y="250" font-family="Fraunces" font-weight="900" font-size="200" fill="url(#gold)">Coplas</text>`;
  const rule = `<rect x="474" y="300" width="470" height="3" fill="${C.gold2}"/>`;
  const tag = `<text x="478" y="352" font-family="SpaceMono" font-size="34" letter-spacing="7" fill="${C.cream}">LOTERÍA · CONEXIONES</text>`;
  writeFileSync(join(OUT, 'coplas-wordmark.svg'), svg(W, H, defsBg(W, H) + mark + word + rule + tag, true));
  writeFileSync(join(OUT, 'coplas-wordmark-transparent.svg'), svg(W, H, mark + word + rule + tag, true));
}
function defsBg(w, h) {
  return `<rect x="0" y="0" width="${w}" height="${h}" rx="40" fill="url(#indigoBg)"/>
    <circle cx="120" cy="60" r="200" fill="url(#auroraV)"/><circle cx="${w - 120}" cy="${h}" r="220" fill="url(#auroraM)"/>`;
}

console.log('Wrote brand SVGs:', ['coplas-badge', 'coplas-icon', 'coplas-favicon', 'coplas-mono', 'coplas-wordmark', 'coplas-wordmark-transparent'].join(', '));
