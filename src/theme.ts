import type { Tier } from './types';

/**
 * CodeAscent visual identity for Coplas.
 *
 * A "vintage Lotería board at night" — deep indigo lit by marigold gold,
 * framed panels (squared with gold hairlines, NOT rounded pills), a serif
 * display face, over a living backdrop of Latin American scenes.
 */
export const colors = {
  bg: '#0B0A1F',
  bgDeep: '#070510',

  // Translucent glass panels — content floats on the living scene behind it.
  surface: 'rgba(12, 10, 26, 0.40)',
  surfaceAlt: 'rgba(30, 26, 60, 0.36)',
  surfaceSolid: '#171433',

  border: 'rgba(220, 212, 255, 0.16)',
  borderGold: 'rgba(244, 185, 66, 0.6)',

  text: '#F7F4FF',
  textDim: '#B7B0DA',

  accent: '#F4B942',
  accentAlt: '#E4479B',
  accentDeep: '#D9901F',
  magenta: '#E4479B',
  violet: '#8B5CF6',
  teal: '#33E0C6',

  success: '#3DDC97',
  danger: '#FF5A6E',

  selected: 'rgba(244, 185, 66, 0.16)',
  ink: '#0B0A1F',

  // Scrim over the scene background for legibility.
  scrimTop: 'rgba(8, 6, 16, 0.62)',
  scrimBottom: 'rgba(8, 6, 16, 0.86)',
};

/** Soft shadow that lets text/marks float legibly directly over the scene. */
export const floatShadow = {
  textShadowColor: 'rgba(0, 0, 0, 0.75)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 10,
} as const;

/**
 * CodeAscent house type — the same faces the other apps use (loaded in
 * app/_layout.tsx via @expo-google-fonts):
 *   • Fraunces  — a "fancy" serif for the logo / headings / big titles.
 *   • Space Mono — mono chrome for uppercase, letter-spaced labels & kickers.
 * If the fonts ever fail to load, RN falls back to the platform default.
 */
export const displayFont = 'Fraunces_700Bold';
export const displayFontRegular = 'Fraunces_400Regular';
export const monoFont = 'SpaceMono_400Regular';
export const monoFontBold = 'SpaceMono_700Bold';

export const gradients = {
  night: ['#0C0A22', '#150C2E', '#0A0818'] as const,
  gold: ['#FCE38A', '#F4B942', '#C9821F'] as const,
  goldButton: ['#F9CE5A', '#EFA111'] as const,
  magenta: ['#F06AB0', '#B5267E'] as const,
  teal: ['#4BE9D0', '#1FA894'] as const,
  violet: ['#A78BFA', '#6D28D9'] as const,
  success: ['#5CE8AB', '#25B37B'] as const,
  cardFace: ['#211C44', '#161231'] as const,
};

/** Kept for the (now unused) orb background; harmless. */
export const auroraOrbs = [
  ['rgba(228, 71, 155, 0.5)', 'rgba(228, 71, 155, 0)'] as const,
  ['rgba(139, 92, 246, 0.45)', 'rgba(139, 92, 246, 0)'] as const,
  ['rgba(51, 224, 198, 0.4)', 'rgba(51, 224, 198, 0)'] as const,
  ['rgba(244, 185, 66, 0.38)', 'rgba(244, 185, 66, 0)'] as const,
];

/** Squared, framed — not pills. */
export const radius = { card: 6, tile: 10, button: 5, chip: 4 };

export const tierColors: Record<Tier, string> = {
  1: '#37D9A0',
  2: '#F4B942',
  3: '#F5730A',
  4: '#9B5DE5',
};

export const tierGradients: Record<Tier, readonly [string, string]> = {
  1: ['#4BE9B4', '#22B07E'],
  2: ['#FBD36B', '#E09A1E'],
  3: ['#FB9038', '#E0640A'],
  4: ['#B98CF0', '#7C3AED'],
};

export const tierEmoji: Record<Tier, string> = {
  1: '🟩',
  2: '🟨',
  3: '🟧',
  4: '🟪',
};
