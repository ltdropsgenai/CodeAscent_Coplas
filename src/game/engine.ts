import type { Group, Puzzle, Tier } from '../types';

export const MAX_MISTAKES = 4;
export const GROUP_SIZE = 4;

/** A guess the player has committed, kept for the share grid + history. */
export interface GuessRecord {
  /** Card ids the player submitted, in tap order. */
  cardIds: string[];
  /** True if all four belonged to the same group. */
  correct: boolean;
  /** Tier of each card's true group, aligned to cardIds order (for the grid). */
  tierOf: Tier[];
}

export interface GameState {
  puzzle: Puzzle;
  /** Card ids not yet solved, in current (shuffled) display order. */
  remaining: string[];
  /** Currently selected card ids (max 4). */
  selected: string[];
  /** Groups solved so far, in solve order. */
  solved: Group[];
  /** Every committed guess, for the share grid. */
  guesses: GuessRecord[];
  mistakes: number;
  status: 'playing' | 'won' | 'lost';
  /**
   * Two card ids currently highlighted by a hint (both belong to the same
   * still-unsolved group). Empty when no hint is active.
   */
  hintPair: string[];
  /** True once the player has spent their one hint this round (drops "perfect"). */
  hintUsed: boolean;
}

/** Which tier a given card belongs to in this puzzle. */
export function tierOfCard(puzzle: Puzzle, cardId: string): Tier {
  for (const g of puzzle.groups) {
    if (g.cardIds.includes(cardId)) return g.tier;
  }
  throw new Error(`Card ${cardId} not in puzzle ${puzzle.id}`);
}

/** Deterministic-ish shuffle seeded by a number so a given puzzle lays out stably per attempt. */
export function shuffle<T>(arr: T[], seed = Math.floor(Math.random() * 1e9)): T[] {
  const a = [...arr];
  let s = seed >>> 0;
  const rand = () => {
    // xorshift32
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function initGame(puzzle: Puzzle, seed?: number): GameState {
  const allCards = puzzle.groups.flatMap((g) => g.cardIds);
  return {
    puzzle,
    remaining: shuffle(allCards, seed),
    selected: [],
    solved: [],
    guesses: [],
    mistakes: 0,
    status: 'playing',
    hintPair: [],
    hintUsed: false,
  };
}

export function toggleSelect(state: GameState, cardId: string): GameState {
  if (state.status !== 'playing') return state;
  const isSelected = state.selected.includes(cardId);
  if (isSelected) {
    return { ...state, selected: state.selected.filter((id) => id !== cardId) };
  }
  if (state.selected.length >= GROUP_SIZE) return state; // already 4
  return { ...state, selected: [...state.selected, cardId] };
}

export function clearSelection(state: GameState): GameState {
  return { ...state, selected: [] };
}

export function shuffleRemaining(state: GameState, seed?: number): GameState {
  return { ...state, remaining: shuffle(state.remaining, seed) };
}

/** Find the group all four cards share, or null if they don't form one. */
function matchingGroup(puzzle: Puzzle, cardIds: string[]): Group | null {
  for (const g of puzzle.groups) {
    if (cardIds.every((id) => g.cardIds.includes(id))) return g;
  }
  return null;
}

/**
 * Submit the current 4-card selection.
 * `relaxed` disables the mistake limit (never reaches 'lost').
 */
export function submitGuess(state: GameState, relaxed = false): GameState {
  if (state.status !== 'playing' || state.selected.length !== GROUP_SIZE) {
    return state;
  }

  const cardIds = state.selected;
  const group = matchingGroup(state.puzzle, cardIds);
  const tierOf = cardIds.map((id) => tierOfCard(state.puzzle, id));
  const record: GuessRecord = { cardIds, correct: !!group, tierOf };
  const guesses = [...state.guesses, record];

  if (group) {
    const remaining = state.remaining.filter((id) => !cardIds.includes(id));
    const solved = [...state.solved, group];
    const won = solved.length === state.puzzle.groups.length;
    return {
      ...state,
      remaining,
      selected: [],
      solved,
      guesses,
      // Drop any hinted card that just got solved so the glow disappears with it.
      hintPair: state.hintPair.filter((id) => remaining.includes(id)),
      status: won ? 'won' : 'playing',
    };
  }

  const mistakes = state.mistakes + 1;
  const lost = !relaxed && mistakes >= MAX_MISTAKES;
  return {
    ...state,
    selected: [],
    guesses,
    mistakes,
    status: lost ? 'lost' : 'playing',
  };
}

/**
 * Spend the round's single hint: highlight two cards that belong to the same
 * still-unsolved group. Picks a random unsolved group so the nudge varies, and
 * two random cards from it. No-op if the round is over or a hint was already
 * used. Using a hint sets `hintUsed`, which the UI treats as forfeiting the
 * "perfect" (zero-mistake) badge.
 */
export function useHint(state: GameState): GameState {
  if (state.status !== 'playing' || state.hintUsed) return state;

  // Unsolved groups are exactly those whose cards are still on the board.
  const solvedThemes = new Set(state.solved.map((g) => g.theme));
  const unsolved = state.puzzle.groups.filter((g) => !solvedThemes.has(g.theme));
  if (!unsolved.length) return state;

  const group = unsolved[Math.floor(Math.random() * unsolved.length)];
  const onBoard = group.cardIds.filter((id) => state.remaining.includes(id));
  const pool = onBoard.length >= 2 ? onBoard : group.cardIds;
  const pair = shuffle(pool).slice(0, 2);

  return { ...state, hintPair: pair, hintUsed: true };
}

/** How many cards of the guess were in the eventual majority group — for "one away" hints. */
export function oneAway(state: GameState): boolean {
  const last = state.guesses[state.guesses.length - 1];
  if (!last || last.correct) return false;
  // 3 of 4 share a tier AND a real group.
  for (const g of state.puzzle.groups) {
    const inGroup = last.cardIds.filter((id) => g.cardIds.includes(id)).length;
    if (inGroup === GROUP_SIZE - 1) return true;
  }
  return false;
}
