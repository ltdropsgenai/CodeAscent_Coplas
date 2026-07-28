import type { Tier } from './types';

/**
 * Visual theme. Palette leans on a deep "papel picado at night" feel:
 * dark indigo base with warm Lotería accents. Swap freely.
 */
export const colors = {
  bg: '#0B1026',
  surface: '#161B33',
  surfaceAlt: '#1F2547',
  border: '#2C3360',
  text: '#F5F3FF',
  textDim: '#A9AED1',
  accent: '#F4B942', // marigold
  accentAlt: '#E4572E', // papel-picado red
  success: '#3DDC97',
  danger: '#E4572E',
  selected: '#3A4180',
};

/** Tier colors mirror the four-color Connections ladder, re-skinned. */
export const tierColors: Record<Tier, string> = {
  1: '#3DDC97', // Verde  — fácil
  2: '#F4B942', // Amarillo — media
  3: '#F58A07', // Naranja — difícil
  4: '#9B5DE5', // Morado — trampa
};

export const tierEmoji: Record<Tier, string> = {
  1: '🟩',
  2: '🟨',
  3: '🟧',
  4: '🟪',
};

export const tierLabel: Record<Tier, string> = {
  1: 'Fácil',
  2: 'Media',
  3: 'Difícil',
  4: 'Trampa',
};
