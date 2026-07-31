import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, displayFont, monoFont } from '../src/theme';
import { useI18n, type Strings } from '../src/i18n';
import { useAudio } from '../src/audio';
import { getCard } from '../src/data/cards';
import { getPuzzleByNumber, getTodaysPuzzle } from '../src/data/puzzles';
import { useGame } from '../src/game/useGame';
import { MAX_MISTAKES } from '../src/game/engine';
import { composeRound } from '../src/game/composer';
import { probeDeckOnline, subscribeDeckOnline } from '../src/net/deckOnline';
import { CardTile } from '../src/components/CardTile';
import { SolvedGroup } from '../src/components/SolvedGroup';
import { WinCelebration } from '../src/components/WinCelebration';
import { GradientButton } from '../src/components/GradientButton';
import { buildShareText } from '../src/share/shareGrid';
import { maybePromptForReview } from '../src/rate';
import { getSettings, getStats, type Stats } from '../src/storage/store';
import type { Difficulty, Puzzle } from '../src/types';

type FeedbackKind = 'correct' | 'wrong' | null;

// ── Freshness model for continuous play ────────────────────────────────────
// Rather than merely dodging the last two rounds, we track every card's usage
// across the whole session and hand the composer a per-card *penalty* so it
// prefers the least-recently and least-often seen cards. This spreads play over
// the ENTIRE deck — cycling all cards before any repeats — which is what keeps
// rounds from feeling stale. Weights are recency-dominant (a card in the very
// last round is nearly forbidden) with a light frequency tiebreaker.
type CardUse = { count: number; last: number };
function penaltyOf(u: CardUse, now: number): number {
  const gap = now - u.last; // rounds since last appearance (0 = the last round)
  const recency = gap <= 0 ? 1000 : gap === 1 ? 250 : gap === 2 ? 60 : gap === 3 ? 12 : 0;
  return recency + u.count * 8;
}

export default function Play() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { t, lang } = useI18n();
  const { playSfx, playRoundMusic, playWinFanfare, stopMusic, soundEnabled, toggleSound } = useAudio();
  const { n } = useLocalSearchParams<{ n?: string }>();
  const isArchive = !!n;

  // Continuous play: every round is composed fresh from the group library
  // (see src/game/composer.ts). `usage` records how recently/often each card
  // has appeared this session; `roundNo` counts completed rounds folded into
  // that history. `cardPenalties()` turns it into the composer's score so the
  // same cards don't keep resurfacing. `playCount` is the display counter;
  // `liveSeq` gives each composed round a unique id.
  const [difficulty, setDifficulty] = useState<Difficulty>('media');
  const diffRef = useRef<Difficulty>('media');
  const liveSeq = useRef(0);
  const usage = useRef<Record<string, CardUse>>({});
  const roundNo = useRef(0);
  // Whether the current round is still untouched — lets the connectivity probe
  // safely swap round 1 for the expanded deck the moment we confirm we're online.
  const pristineRef = useRef(true);

  const cardPenalties = useCallback((): Map<string, number> => {
    const now = roundNo.current;
    const m = new Map<string, number>();
    for (const id in usage.current) m.set(id, penaltyOf(usage.current[id], now));
    return m;
  }, []);

  // Fold a finished round's cards into the session usage history.
  const recordRound = useCallback((cardIds: string[]) => {
    roundNo.current += 1;
    const now = roundNo.current;
    for (const id of cardIds) {
      const u = usage.current[id] ?? { count: 0, last: -99 };
      usage.current[id] = { count: u.count + 1, last: now };
    }
  }, []);

  const [livePuzzle, setLivePuzzle] = useState<Puzzle>(() => {
    liveSeq.current += 1;
    return composeRound('media', new Map(), liveSeq.current);
  });
  const [playCount, setPlayCount] = useState(0);

  // Pick up the player's difficulty choice (and restart the stream if it
  // changed) whenever this screen regains focus.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getSettings().then((s) => {
        if (!active || isArchive || s.difficulty === diffRef.current) return;
        diffRef.current = s.difficulty;
        setDifficulty(s.difficulty);
        usage.current = {};
        roundNo.current = 0;
        liveSeq.current += 1;
        setLivePuzzle(composeRound(s.difficulty, new Map(), liveSeq.current));
      });
      return () => {
        active = false;
      };
    }, [isArchive])
  );

  // Session tallies (this play session only).
  const [sessionWon, setSessionWon] = useState(0);
  const [sessionStreak, setSessionStreak] = useState(0);

  const puzzle = useMemo(() => {
    if (n) return getPuzzleByNumber(Number(n)) ?? getTodaysPuzzle();
    return livePuzzle;
  }, [n, livePuzzle]);

  const game = useGame(puzzle);
  const { state } = game;
  const finished = state.status !== 'playing';

  /**
   * The board stays on screen through a loss, so the retry has something to
   * act on. It only comes down when the round is genuinely over: solved, or
   * the player asked to see the answer.
   */
  const boardVisible = state.status === 'playing' || (state.status === 'lost' && !state.revealed);

  // Correct / wrong feedback burst.
  const feedback = useRef(new Animated.Value(0)).current;
  const [feedbackKind, setFeedbackKind] = useState<FeedbackKind>(null);
  // Round-clear celebration overlay — shown once per win after a short beat,
  // cleared on the next round (and when it finishes animating). `resultReady`
  // holds the result panel back until the celebration has settled, so on a win
  // the flow is: last group snaps in → beat → fireworks → ¡Resuelto!.
  const [showCelebration, setShowCelebration] = useState(false);
  const [resultReady, setResultReady] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isArchive ? `Coplas #${puzzle.number}` : `${t.play.round} ${playCount + 1}`,
      headerRight: () => (
        <Pressable onPress={toggleSound} hitSlop={12} style={{ paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 18 }}>{soundEnabled ? '🔊' : '🔇'}</Text>
        </Pressable>
      ),
    });
    // headerLeft (‹ Inicio) is supplied once for every screen by the Stack
    // options in app/_layout.tsx — don't re-declare it here or it drifts.
  }, [navigation, puzzle.number, playCount, isArchive, t.play.round, soundEnabled, toggleSound]);

  // Each round gets a fresh background genre (rotates, never repeats the last).
  // Keyed on the round id so every new round — including the online-flip
  // recompose — swaps the track; leaving the screen stops it.
  useEffect(() => {
    playRoundMusic();
    return () => stopMusic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle.id]);

  // Live snapshot of whether the current round has been touched yet.
  useEffect(() => {
    pristineRef.current =
      state.guesses.length === 0 && state.solved.length === 0 && state.status === 'playing';
  });

  // Probe deck connectivity once on mount; when it flips online, recompose a
  // still-pristine round in place so the expanded deck (which streams its art
  // from Supabase) appears immediately instead of only from the next round.
  // Archive replays are fixed puzzles and are never recomposed.
  useEffect(() => {
    if (isArchive) return;
    probeDeckOnline();
    return subscribeDeckOnline((online) => {
      if (!online || !pristineRef.current) return;
      liveSeq.current += 1;
      setLivePuzzle(composeRound(diffRef.current, cardPenalties(), liveSeq.current));
    });
  }, [isArchive, cardPenalties]);

  // SFX + feedback burst on every guess; jingle on a win.
  const prevGuesses = useRef(0);
  useEffect(() => {
    if (state.guesses.length > prevGuesses.current) {
      const last = state.guesses[state.guesses.length - 1];
      playSfx(last.correct ? 'correct' : 'wrong');
      setFeedbackKind(last.correct ? 'correct' : 'wrong');
      feedback.setValue(0);
      Animated.sequence([
        Animated.spring(feedback, { toValue: 1, useNativeDriver: true, friction: 5, tension: 140 }),
        Animated.timing(feedback, { toValue: 0, duration: 450, delay: 300, useNativeDriver: true }),
      ]).start(() => setFeedbackKind(null));
    }
    prevGuesses.current = state.guesses.length;
  }, [state.guesses, playSfx, feedback]);

  // On a win: a quick sting immediately, then a short beat so the last group
  // visibly settles before the fanfare + fireworks fire. The result panel is
  // held back (resultReady) until the celebration finishes. A loss shows its
  // result straight away (no celebration).
  useEffect(() => {
    if (state.status === 'won') {
      playSfx('jingle');
      setResultReady(false);
      const beat = setTimeout(() => {
        playWinFanfare();
        setShowCelebration(true);
      }, 550);
      return () => clearTimeout(beat);
    }
    if (state.status === 'lost') {
      setResultReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  // A new round clears any lingering celebration / result-gate state.
  useEffect(() => {
    setShowCelebration(false);
    setResultReady(false);
  }, [puzzle.id]);

  // Tally each round's result once (skip archive replays).
  const countedRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (isArchive || !finished || countedRef.current === puzzle.id) return;
    countedRef.current = puzzle.id;
    if (state.status === 'won') {
      setSessionWon((x) => x + 1);
      setSessionStreak((x) => x + 1);
    } else {
      setSessionStreak(0);
    }
  }, [finished, state.status, puzzle.id, isArchive]);

  function nextRound() {
    // Fold the round just played into the session usage history, then compose a
    // fresh round that prefers the least-recently/least-often seen cards.
    const justPlayed = puzzle.groups.flatMap((g) => g.cardIds);
    recordRound(justPlayed);
    liveSeq.current += 1;
    setLivePuzzle(composeRound(difficulty, cardPenalties(), liveSeq.current));
    setPlayCount((c) => c + 1);
  }

  // --- Board animations ---
  const shake = useRef(new Animated.Value(0)).current;
  const resultAnim = useRef(new Animated.Value(0)).current;
  const prevMistakes = useRef(0);

  useEffect(() => {
    if (state.mistakes > prevMistakes.current) {
      shake.setValue(0);
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0.6, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -0.6, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
    prevMistakes.current = state.mistakes;
  }, [state.mistakes, shake]);

  useEffect(() => {
    resultAnim.setValue(0);
    if (resultReady) {
      Animated.timing(resultAnim, { toValue: 1, duration: 420, useNativeDriver: true }).start();
    }
  }, [resultReady, resultAnim, puzzle.id]);

  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-12, 12] });

  // Lifetime numbers, read once the round ends — used by the share text and by
  // the review-prompt decision.
  const [finalStats, setFinalStats] = useState<Stats | null>(null);
  useEffect(() => {
    if (finished) getStats().then(setFinalStats);
  }, [finished, puzzle.id]);

  // Ask for a rating only at a peak, and only once the celebration is over — an
  // OS dialog on top of the fireworks is how you get a reflexive dismissal.
  // `maybePromptForReview` enforces the rest of the policy (flawless win, streak
  // milestone, enough rounds played, once per version) and never throws.
  const promptedRef = useRef(false);
  useEffect(() => {
    if (!finalStats || promptedRef.current) return;
    if (state.status !== 'won' || !resultReady) return;
    promptedRef.current = true;
    const flawless = state.mistakes === 0 && !state.hintUsed && !state.retried;
    const id = setTimeout(() => maybePromptForReview(finalStats, flawless), 900);
    return () => clearTimeout(id);
  }, [finalStats, resultReady, state.status, state.mistakes, state.hintUsed, state.retried]);

  function onSelect(id: string) {
    playSfx('select');
    game.select(id);
  }

  function onHint() {
    if (!game.canHint) return;
    playSfx('select');
    game.hint();
  }

  async function onShare() {
    const text = buildShareText({
      number: puzzle.number,
      grid: state.guesses.map((g) => g.tierOf),
      status: state.status === 'won' ? 'won' : 'lost',
      mistakes: state.mistakes,
      retried: state.retried,
      // Lifetime streaks, not the session counter: the session number resets
      // whenever the player leaves the screen, so it undersold anyone who came
      // back the next day.
      winStreak: finalStats?.winStreak,
      dayStreak: finalStats?.dayStreakLive ? finalStats.dayStreak : undefined,
      lang,
    });
    try {
      await Share.share({ message: text });
    } catch {
      /* dismissed */
    }
  }

  if (game.loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.dim}>{t.play.loading}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
        <Text style={styles.sub}>
          {t.play.subtitle}
          {game.relaxed ? `  ·  ${t.play.relaxed}` : ''}
        </Text>
        {!isArchive && (
          <Text style={styles.session}>
            {t.play.round} {playCount + 1}   ·   {t.diff[difficulty]}   ·   🔥 {sessionStreak}   ·   🏆 {sessionWon} {t.play.sessionWon}
          </Text>
        )}

        {state.solved.map((g, i) => (
          // Only the most recently solved group plays its animated clips.
          <SolvedGroup key={g.theme} group={g} animate={i === state.solved.length - 1} />
        ))}

        {/* The answer. Only ever drawn once the player has asked for it —
            revealing automatically on the loss is what made the retry
            impossible, because a "retry" with the groups on screen is just
            copying. */}
        {state.revealed &&
          game.unsolved.map((g) => <SolvedGroup key={g.theme} group={g} animate={false} />)}

        {boardVisible && (
          <Animated.View style={[styles.grid, { transform: [{ translateX: shakeX }] }]}>
            {chunk(state.remaining, 4).map((row, ri) => (
              <View key={ri} style={styles.row}>
                {row.map((id) => (
                  <CardTile
                    key={id}
                    card={getCard(id)}
                    selected={state.selected.includes(id)}
                    hinted={state.hintPair.includes(id)}
                    onPress={onSelect}
                  />
                ))}
              </View>
            ))}
          </Animated.View>
        )}

        {!game.relaxed && boardVisible && (
          <View style={styles.mistakes}>
            <Text style={styles.dim}>{t.play.errors}</Text>
            {Array.from({ length: MAX_MISTAKES }).map((_, i) => (
              <View key={i} style={[styles.dot, i < state.mistakes && styles.dotUsed]} />
            ))}
          </View>
        )}

        {game.lastWasOneAway && !finished && <Text style={styles.oneAway}>{t.play.oneAway}</Text>}

        {!finished && (
          <View style={styles.actions}>
            <GradientButton label={t.play.hint} variant="ghost" onPress={onHint} disabled={!game.canHint} />
            <GradientButton label={t.play.shuffle} variant="ghost" onPress={game.shuffle} />
            <GradientButton
              label={t.play.remove}
              variant="ghost"
              onPress={game.deselect}
              disabled={state.selected.length === 0}
            />
            <GradientButton label={t.play.submit} onPress={game.submit} disabled={!game.canSubmit} />
          </View>
        )}

        {finished && resultReady && (
          <Animated.View
            style={[
              styles.result,
              {
                opacity: resultAnim,
                transform: [
                  { translateY: resultAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
                ],
              },
            ]}
          >
            <Text style={styles.resultTitle}>
              {state.status === 'won'
                ? state.retried
                  ? t.play.retriedWon
                  : state.mistakes === 0 && !state.hintUsed
                    ? t.play.perfect
                    : t.play.solved
                : t.play.lost}
            </Text>
            <View style={styles.resultDivider} />
            {state.status === 'lost' && (
              <Text style={styles.dim}>
                {state.revealed
                  ? t.play.revealedNote
                  : game.canRetry
                    ? t.play.retryNote
                    : t.play.retryAgainNote}
              </Text>
            )}
            {state.status === 'won' && state.retried && (
              <Text style={styles.dim}>{t.play.retriedWonNote}</Text>
            )}
            {state.status === 'won' && !state.retried && state.hintUsed && (
              <Text style={styles.hintNote}>💡 {t.play.hintNote}</Text>
            )}
            <View style={styles.resultActions}>
              {/* A failed round offers the second crack FIRST and the answer
                  second. Once the answer is out you can't un-see it, so the
                  order is the whole design. */}
              {state.status === 'lost' && !state.revealed ? (
                <>
                  {game.canRetry && (
                    <GradientButton label={t.play.retry} variant="gold" onPress={game.retry} />
                  )}
                  <GradientButton label={t.play.reveal} variant="ghost" onPress={game.reveal} />
                </>
              ) : (
                <>
                  <GradientButton label={t.play.share} variant="ghost" onPress={onShare} />
                  {!isArchive && (
                    <GradientButton label={t.play.nextRound} variant="gold" onPress={nextRound} />
                  )}
                </>
              )}
            </View>
          </Animated.View>
        )}
      </ScrollView>

      <FeedbackBurst kind={feedbackKind} anim={feedback} t={t} />

      {showCelebration && state.status === 'won' && (
        <WinCelebration
          groups={state.solved}
          onDone={() => {
            setShowCelebration(false);
            setResultReady(true);
          }}
        />
      )}
    </View>
  );
}

/** A big pop of emoji + tint over the board on a correct or wrong guess. */
function FeedbackBurst({
  kind,
  anim,
  t,
}: {
  kind: FeedbackKind;
  anim: Animated.Value;
  t: Strings;
}) {
  if (!kind) return null;
  const correct = kind === 'correct';
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.25] });
  const rise = anim.interpolate({ inputRange: [0, 1], outputRange: [10, -6] });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.burst,
        { opacity: anim, backgroundColor: correct ? 'rgba(61,220,151,0.12)' : 'rgba(255,90,110,0.14)' },
      ]}
    >
      <Animated.Text style={[styles.burstEmoji, { transform: [{ scale }, { translateY: rise }] }]}>
        {correct ? '🎉' : '🚫'}
      </Animated.Text>
      <Animated.Text style={[styles.burstLabel, { transform: [{ translateY: rise }] }]}>
        {correct ? t.play.correctCheer : t.play.wrongCheer}
      </Animated.Text>
    </Animated.View>
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { paddingHorizontal: 12, paddingTop: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // ── Legibility floor ─────────────────────────────────────────────────────
  // These three lines were 15 / 12 / 13 pt in a dim colour, which reads badly
  // for anyone whose eyes aren't perfect. iOS treats 17 pt as body and 11 pt as
  // the absolute floor, so the instruction is now body size, the session strip
  // is a proper caption, and both sit at higher contrast than before.
  sub: { color: colors.text, fontSize: 17, textAlign: 'center', opacity: 0.92 },
  session: { color: colors.accent, fontFamily: monoFont, fontSize: 14, letterSpacing: 0.2, textAlign: 'center', marginTop: 6, marginBottom: 12, fontWeight: '700' },
  grid: { marginTop: 2 },
  row: { flexDirection: 'row' },
  mistakes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  dot: { width: 14, height: 14, borderRadius: 7, marginHorizontal: 4.5, backgroundColor: colors.border },
  dotUsed: { backgroundColor: colors.danger },
  oneAway: { color: colors.accent, fontSize: 16, textAlign: 'center', marginTop: 10, fontWeight: '800' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18, justifyContent: 'center', alignItems: 'center' },
  result: {
    marginTop: 22,
    alignItems: 'center',
    backgroundColor: 'rgba(11,10,31,0.72)',
    borderRadius: 14,
    paddingVertical: 26,
    paddingHorizontal: 22,
    borderWidth: 1.5,
    borderColor: colors.borderGold,
    shadowColor: colors.accent,
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  resultTitle: {
    color: colors.text,
    fontFamily: displayFont,
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(244,185,66,0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  resultDivider: {
    width: 54,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.accent,
    opacity: 0.85,
    marginTop: 12,
    marginBottom: 16,
  },
  resultActions: { flexDirection: 'row', gap: 10, marginTop: 8, alignItems: 'center' },
  // Also the "Mistakes:" label next to the dots — was 13 pt dim.
  dim: { color: colors.text, fontSize: 15, textAlign: 'center', marginBottom: 4, opacity: 0.9 },
  hintNote: { color: colors.teal, fontSize: 13, fontFamily: monoFont, textAlign: 'center', marginBottom: 4 },
  burst: { alignItems: 'center', justifyContent: 'center' },
  burstEmoji: { fontSize: 96 },
  burstLabel: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 6,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
});
