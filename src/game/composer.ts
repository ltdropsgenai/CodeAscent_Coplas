import type { Difficulty, Puzzle, Tier } from '../types';
import { CARDS } from '../data/cards';
import LIB_RAW from '../data/groups.json';
import EXP_LIB_RAW from '../data/expansion.groups.json';
import { isDeckOnline } from '../net/deckOnline';

/**
 * Live round composer for continuous play.
 *
 * THE PROBLEM this solves: the old flow drew rounds from a fixed pool of
 * pre-baked puzzles and only guaranteed that the same *category* never repeated
 * in two consecutive rounds. But different categories share cards (La Rana is in
 * "Del agua", "Bichos" and "Animales"), so the same *cards* kept resurfacing
 * round after round — exactly what the player complained about.
 *
 * THE FIX: compose each continuous-play round fresh from the hand-verified group
 * library (src/data/groups.json — single source of truth), and score every
 * candidate round by a per-card *penalty* the caller supplies. The penalty
 * encodes both how recently and how often each card has already been seen this
 * session, so the composer keeps the lowest-penalty round and thereby spreads
 * play across the WHOLE deck — cycling every card evenly before any repeats —
 * instead of merely dodging the last two rounds. (Earlier versions passed a
 * binary "avoid the last two rounds" set; that killed adjacent repeats but let
 * popular cards resurface every ~3 rounds. The graded penalty flattens that.)
 *
 * Simulated over the published groups.json (20 rounds, media): adjacent-round
 * card overlap drops from ~1.2/16 to ~0.18/16 — you essentially never see a
 * card two rounds running. The remaining recurrence of a few high-membership
 * cards is a property of the small library and shrinks as the deck grows.
 *
 * Guarantees per composed round (inherited from the generator's constraints):
 *   • 16 unique cards (the 4 groups are card-disjoint),
 *   • letter/rhyme traps are never ambiguous (no stray card also fits the rule),
 *   • colour/shape/hidden traps respect their per-group `exclude` sets,
 *   • difficulty = number of trap groups (facil 0, media 1, dificil 2).
 */

interface LibGroup {
  kind: 'cat' | 'shape' | 'color' | 'rhyme' | 'letter' | 'hidden';
  cards: string[];
  theme: string;
  why: string;
  exclude?: string[];
}

const BASE_LIB = LIB_RAW as Record<string, LibGroup>;
const EXP_LIB = EXP_LIB_RAW as Record<string, LibGroup>;

/**
 * One merged reference table so `LIB[ref]` resolves whichever group the
 * composer picked, base or expansion. Keys are disjoint by construction (base
 * groups are short slugs like `astros`; expansion keys are `family_theme_n`).
 */
const LIB: Record<string, LibGroup> = { ...BASE_LIB, ...EXP_LIB };

// ── Connectivity-gated pools ───────────────────────────────────────────────
// Offline we may only use the bundled 54 and their hand-authored groups; online
// we add the ~390 expansion categories (the expansion contributes no traps, so
// the trap pool is the same either way).
const BASE_REFS = Object.keys(BASE_LIB);
const CATS_BASE = BASE_REFS.filter((r) => BASE_LIB[r].kind === 'cat');
const TRAPS_BASE = BASE_REFS.filter((r) => BASE_LIB[r].kind !== 'cat');
const EXP_CAT_REFS = Object.keys(EXP_LIB).filter((r) => EXP_LIB[r].kind === 'cat');
const CATS_FULL = [...CATS_BASE, ...EXP_CAT_REFS];
const TRAPS_FULL = TRAPS_BASE;

/** Category refs available for the current connectivity state. */
function catsPool(): string[] {
  return isDeckOnline() ? CATS_FULL : CATS_BASE;
}
/** Trap refs available for the current connectivity state. */
function trapsPool(): string[] {
  return isDeckOnline() ? TRAPS_FULL : TRAPS_BASE;
}

// ── Card-name helpers (for letter/rhyme ambiguity checks) ──────────────────
const NAME: Record<string, string> = {};
for (const c of CARDS) NAME[c.id] = c.name;

const stripDiacritics = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** The card's noun, i.e. its name minus a leading article (El/La/Las/Los). */
function noun(id: string): string {
  const name = NAME[id] ?? '';
  const parts = name.split(' ');
  return /^(El|La|Las|Los)$/.test(parts[0]) ? parts.slice(1).join(' ') : name;
}
const nounInitial = (id: string) => stripDiacritics(noun(id)).charAt(0).toUpperCase();
const nounLower = (id: string) => noun(id).toLowerCase();

/**
 * Is any trap group in this set of refs ambiguous within the 16-card puzzle?
 * A letter/rhyme trap is ambiguous if some *other* card in the puzzle also
 * satisfies the rule; a colour/shape/hidden trap is ambiguous if any of its
 * `exclude` cards is present elsewhere. Mirrors the generator exactly.
 */
function ambiguous(refs: string[]): boolean {
  const cards = refs.flatMap((r) => LIB[r].cards);
  for (const r of refs) {
    const g = LIB[r];
    if (g.kind === 'letter') {
      const L = g.theme.match(/«(.)»/u)?.[1].toUpperCase() ?? '';
      if (cards.filter((c) => nounInitial(c) === L).length !== 4) return true;
    } else if (g.kind === 'rhyme') {
      const suf = g.theme.match(/«-(.+?)»/u)?.[1].toLowerCase() ?? '';
      if (cards.filter((c) => nounLower(c).endsWith(suf)).length !== 4) return true;
    } else if (g.exclude && g.exclude.length) {
      const others = cards.filter((c) => !g.cards.includes(c));
      if (others.some((c) => g.exclude!.includes(c))) return true;
    }
  }
  return false;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick k card-disjoint groups from `pool`, avoiding any card in `usedCards`. */
function pickGroups(pool: string[], k: number, usedCards: Set<string>): string[] | null {
  const chosen: string[] = [];
  const cards = new Set(usedCards);
  for (const r of shuffle(pool)) {
    if (chosen.length === k) break;
    if (LIB[r].cards.some((c) => cards.has(c))) continue;
    chosen.push(r);
    for (const c of LIB[r].cards) cards.add(c);
  }
  return chosen.length === k ? chosen : null;
}

const N_TRAPS: Record<Difficulty, number> = { facil: 0, media: 1, dificil: 2 };

/** One random, valid (non-ambiguous, card-disjoint) set of 4 group refs. */
function composeOnce(difficulty: Difficulty): string[] | null {
  const nTraps = N_TRAPS[difficulty];
  const traps = nTraps ? pickGroups(trapsPool(), nTraps, new Set()) : [];
  if (nTraps && !traps) return null;
  const trapCards = new Set((traps ?? []).flatMap((r) => LIB[r].cards));
  const cats = pickGroups(catsPool(), 4 - nTraps, trapCards);
  if (!cats) return null;
  const refs = [...cats, ...(traps ?? [])]; // cats first → low tiers; traps last → high tiers
  if (sameTheme(refs)) return null;
  if (ambiguous(refs)) return null;
  return refs;
}

/**
 * Reject a round that would reveal two groups with the SAME theme string. The
 * expansion library intentionally holds several variants per theme (two valid
 * «Cítricos» foursomes, etc.), and a base + expansion group can also collide on
 * a theme — either would look like a duplicate answer to the player. Card-
 * disjointness alone doesn't prevent it, so we guard the theme explicitly.
 */
function sameTheme(refs: string[]): boolean {
  const seen = new Set<string>();
  for (const r of refs) {
    const th = LIB[r].theme;
    if (seen.has(th)) return true;
    seen.add(th);
  }
  return false;
}

/**
 * Compose a fresh continuous-play round at the given difficulty, minimizing the
 * total `penalty` of its 16 cards. `penalty` maps a card id to a cost that
 * reflects how recently and how often it has appeared this session (see
 * play.tsx `cardPenalties`); cards absent from the map cost 0. Returns a
 * synthetic Puzzle with a `live-<seq>` id — never persisted.
 */
export function composeRound(
  difficulty: Difficulty,
  penalty: Map<string, number>,
  seq: number
): Puzzle {
  let best: string[] | null = null;
  let bestCost = Infinity;
  let valid = 0;

  for (let i = 0; i < 4000 && valid < 500; i++) {
    const refs = composeOnce(difficulty);
    if (!refs) continue;
    valid++;
    const cost = refs
      .flatMap((r) => LIB[r].cards)
      .reduce((n, c) => n + (penalty.get(c) ?? 0), 0);
    if (cost < bestCost) {
      best = refs;
      bestCost = cost;
      if (cost === 0) break;
    }
  }

  // Extremely defensive: if the scoring search somehow found nothing valid,
  // fall back to any valid round (ignoring penalty). composeOnce succeeds with
  // high probability, so this loop effectively always resolves immediately.
  if (!best) {
    for (let i = 0; i < 4000 && !best; i++) best = composeOnce(difficulty);
  }
  const refs = best!;

  const groups = refs.map((ref, idx) => ({
    theme: LIB[ref].theme,
    tier: (idx + 1) as Tier, // cats first (1..) → traps last (…4)
    cardIds: [...LIB[ref].cards],
    explanation: LIB[ref].why,
  }));

  return {
    id: `live-${seq}`,
    number: seq,
    date: '',
    difficulty,
    groups,
  };
}
