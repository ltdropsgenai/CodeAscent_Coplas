/**
 * Core domain types for Coplas — a card-grouping word game.
 */

/** Difficulty tier of a connection group. 1 = easiest (green) ... 4 = trickiest (purple). */
export type Tier = 1 | 2 | 3 | 4;

/**
 * Overall puzzle difficulty — how sneaky the groupings are.
 *   facil   — four clearly distinct categories, few decoys.
 *   media   — one or two "trap" groups (rhyme/letter/colour) among categories.
 *   dificil — several traps + deliberate decoy cards that plausibly fit two
 *             groups, so the obvious grouping misleads.
 */
export type Difficulty = 'facil' | 'media' | 'dificil';

/** A single card / archetype in the deck. */
export interface Card {
  /** Stable slug used to reference the card in puzzles, e.g. "el_gallo". */
  id: string;
  /** Display name, e.g. "El Gallo". */
  name: string;
  /**
   * Position in *our* deck, 1..N. Assigned by `renumber()` in data/cards.ts
   * from a Spanish alphabetical sort — deliberately NOT the traditional
   * 1-54 sequence. Display only; nothing is persisted against it.
   */
  number: number;
  /** Placeholder glyph shown until commissioned art exists. */
  emoji?: string;
}

/** One of the four hidden groups in a puzzle. */
export interface Group {
  /** The revealed theme, e.g. "Instrumentos musicales". */
  theme: string;
  /** Difficulty tier (drives the color). */
  tier: Tier;
  /** Exactly four card ids that belong to this group. */
  cardIds: string[];
  /** One-line reveal shown after the group is solved. */
  explanation: string;
}

/** A full daily puzzle: 16 cards = the union of four groups of four. */
export interface Puzzle {
  /** Unique id, e.g. "coplas-0001". */
  id: string;
  /** Sequential puzzle number shown to players (Coplas #1). */
  number: number;
  /** ISO date (YYYY-MM-DD) this puzzle is the daily for, America/Mexico_City. */
  date: string;
  /** How sneaky this puzzle is. Absent = treat as 'media'. */
  difficulty?: Difficulty;
  /** The four groups. */
  groups: Group[];
}
