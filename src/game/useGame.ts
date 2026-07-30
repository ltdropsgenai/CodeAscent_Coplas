import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import type { Puzzle } from '../types';
import {
  GameState,
  initGame,
  submitGuess,
  toggleSelect,
  shuffleRemaining,
  clearSelection,
  oneAway,
  useHint,
  GROUP_SIZE,
  MAX_MISTAKES,
} from './engine';
import {
  gridFromGuesses,
  saveResult,
  getResult,
  getSettings,
} from '../storage/store';

function haptic(type: 'ok' | 'err') {
  if (Platform.OS === 'web') return;
  if (type === 'ok') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

export interface UseGame {
  state: GameState;
  relaxed: boolean;
  alreadyPlayed: boolean;
  loading: boolean;
  lastWasOneAway: boolean;
  select: (cardId: string) => void;
  submit: () => void;
  shuffle: () => void;
  deselect: () => void;
  hint: () => void;
  mistakesLeft: number;
  canSubmit: boolean;
  canHint: boolean;
}

/**
 * Drives a single puzzle: selection, submit, persistence of the final result,
 * and honoring the "relaxed" setting.
 */
export function useGame(puzzle: Puzzle): UseGame {
  const [state, setState] = useState<GameState>(() => initGame(puzzle));
  const [relaxed, setRelaxed] = useState(false);
  const [alreadyPlayed, setAlreadyPlayed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastWasOneAway, setLastWasOneAway] = useState(false);
  const savedRef = useRef(false);

  // Live continuous-play rounds are composed on the fly (see game/composer.ts)
  // and must NOT be persisted — they'd bloat AsyncStorage and pollute the
  // archive/daily result history.
  const isLive = puzzle.id.startsWith('live-');

  // Load settings + prior result on mount / puzzle change.
  useEffect(() => {
    let active = true;
    savedRef.current = false;
    setLoading(true);
    (async () => {
      const [settings, prior] = await Promise.all([
        getSettings(),
        isLive ? Promise.resolve(undefined) : getResult(puzzle.id),
      ]);
      if (!active) return;
      setRelaxed(settings.relaxed);
      setAlreadyPlayed(!!prior);
      setState(initGame(puzzle));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [puzzle, isLive]);

  // Persist the result exactly once when the game ends (never for live rounds).
  useEffect(() => {
    if (isLive || state.status === 'playing' || savedRef.current) return;
    savedRef.current = true;
    saveResult({
      puzzleId: puzzle.id,
      number: puzzle.number,
      date: puzzle.date,
      status: state.status,
      mistakes: state.mistakes,
      hinted: state.hintUsed,
      grid: gridFromGuesses(state.guesses),
      completedAt: new Date().toISOString(),
    });
  }, [state.status, state.guesses, state.mistakes, puzzle, isLive]);

  const select = useCallback((cardId: string) => {
    setState((s) => toggleSelect(s, cardId));
  }, []);

  const submit = useCallback(() => {
    setState((s) => {
      const next = submitGuess(s, relaxed);
      if (next.guesses.length > s.guesses.length) {
        const last = next.guesses[next.guesses.length - 1];
        haptic(last.correct ? 'ok' : 'err');
        setLastWasOneAway(!last.correct && oneAway(next));
      }
      return next;
    });
  }, [relaxed]);

  const shuffle = useCallback(() => setState((s) => shuffleRemaining(s)), []);
  const deselect = useCallback(() => setState((s) => clearSelection(s)), []);
  const hint = useCallback(() => setState((s) => useHint(s)), []);

  const mistakesLeft = useMemo(
    () => Math.max(0, MAX_MISTAKES - state.mistakes),
    [state.mistakes]
  );
  const canSubmit = state.selected.length === GROUP_SIZE && state.status === 'playing';
  const canHint = state.status === 'playing' && !state.hintUsed;

  return {
    state,
    relaxed,
    alreadyPlayed,
    loading,
    lastWasOneAway,
    select,
    submit,
    shuffle,
    deselect,
    hint,
    mistakesLeft,
    canSubmit,
    canHint,
  };
}
