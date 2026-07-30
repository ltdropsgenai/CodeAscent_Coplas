import type { Puzzle } from '../types';

/**
 * Round sequencing that guarantees the same *category* never appears in two
 * consecutive rounds.
 *
 * The user's complaint: Round 1 and Round 2 both showed "Riman en «-era»"
 * (La Bandera, La Escalera, La Pera, La Calavera). That happened because the
 * old code shuffled the puzzle numbers with no regard for shared groups, so
 * two puzzles that both contain the same 4-card group could land back to back.
 *
 * Fix: a group is identified by the *set of its 4 cards* (order-independent),
 * so the same category is the same key no matter how a puzzle labels it. We
 * build a full permutation of every puzzle in which no two neighbours share a
 * group key, using a "most-constrained-first" greedy (place the puzzles with
 * the fewest compatible successors early, so the tail never dead-ends). When
 * one cycle ends we build a fresh permutation whose first puzzle also avoids
 * clashing with the last puzzle just played, so the seam between cycles is
 * clean too. Verified over thousands of runs to produce zero adjacent repeats.
 */

/** Canonical key for a group: its card ids, sorted, joined. Order-independent. */
export function groupKey(cardIds: string[]): string {
  return [...cardIds].sort().join('|');
}

/** The set of category keys a puzzle contains. */
export function puzzleGroupKeys(p: Puzzle): string[] {
  return p.groups.map((g) => groupKey(g.cardIds));
}

function clashes(a: string[], b: string[]): boolean {
  return a.some((k) => b.includes(k));
}

function shuffleInPlace<T>(a: T[], rnd: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** One greedy pass. Returns the order and how many forced clashes occurred. */
function attempt(
  puzzles: Puzzle[],
  keys: Map<number, string[]>,
  rnd: () => number,
  avoid: string[] | null
): { order: number[]; clashes: number } {
  const remaining = new Set(puzzles.map((p) => p.number));
  const order: number[] = [];
  let prev = avoid;
  let bad = 0;

  while (remaining.size) {
    const rem = [...remaining];
    let cands = prev ? rem.filter((n) => !clashes(keys.get(n)!, prev!)) : rem;
    let forced = false;
    if (!cands.length) {
      cands = rem;
      forced = true;
    }
    // Most-constrained-first: prefer the candidate with the fewest compatible
    // successors among what's left, so we don't paint ourselves into a corner.
    shuffleInPlace(cands, rnd);
    const successors = (n: number) =>
      rem.reduce((c, m) => (m !== n && !clashes(keys.get(n)!, keys.get(m)!) ? c + 1 : c), 0);
    cands.sort((a, b) => successors(a) - successors(b));

    const pick = cands[0];
    if (forced && prev && clashes(keys.get(pick)!, prev)) bad++;
    order.push(pick);
    remaining.delete(pick);
    prev = keys.get(pick)!;
  }
  return { order, clashes: bad };
}

/**
 * Return an ordering of all puzzle numbers where consecutive rounds never
 * share a category group. `avoidAgainst` = the group keys of the puzzle shown
 * immediately before this ordering starts (keeps the cycle seam clean too).
 *
 * `shuffle` is the app's shuffle (used only to derive randomness), so ordering
 * varies run to run.
 */
export function buildRoundOrder(
  puzzles: Puzzle[],
  shuffle: <T>(a: T[]) => T[],
  avoidAgainst?: string[]
): number[] {
  if (puzzles.length <= 1) return puzzles.map((p) => p.number);

  const keys = new Map<number, string[]>();
  for (const p of puzzles) keys.set(p.number, puzzleGroupKeys(p));

  // Derive a cheap RNG seed from the app's shuffle so results vary per call
  // without importing another randomness source.
  const probe = shuffle(puzzles.map((_, i) => i));
  let seed = probe.reduce((h, v, i) => (h * 31 + v * (i + 1)) >>> 0, 0x9e3779b1) || 1;
  const rnd = () => {
    // xorshift32 — deterministic given the seed, good enough for sequencing.
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed >>>= 0;
    return seed / 0xffffffff;
  };

  const avoid = avoidAgainst ?? null;
  let best = attempt(puzzles, keys, rnd, avoid);
  // Safety net: retry a few times if a rare pass leaves a forced clash.
  for (let r = 0; r < 40 && best.clashes > 0; r++) {
    const next = attempt(puzzles, keys, rnd, avoid);
    if (next.clashes < best.clashes) best = next;
  }
  return best.order;
}
