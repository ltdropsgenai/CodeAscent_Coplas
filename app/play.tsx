import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, tierEmoji } from '../src/theme';
import { useI18n } from '../src/i18n';
import { getCard } from '../src/data/cards';
import { getPuzzleByNumber, getTodaysPuzzle } from '../src/data/puzzles';
import { useGame } from '../src/game/useGame';
import { MAX_MISTAKES } from '../src/game/engine';
import { CardTile } from '../src/components/CardTile';
import { SolvedGroup } from '../src/components/SolvedGroup';
import { buildShareText } from '../src/share/shareGrid';
import { getStats } from '../src/storage/store';

export default function Play() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { t } = useI18n();
  const { n } = useLocalSearchParams<{ n?: string }>();

  const puzzle = useMemo(() => {
    const byNumber = n ? getPuzzleByNumber(Number(n)) : undefined;
    return byNumber ?? getTodaysPuzzle();
  }, [n]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: `Coplas #${puzzle.number}` });
  }, [navigation, puzzle.number]);

  const game = useGame(puzzle);
  const { state } = game;
  const finished = state.status !== 'playing';

  // --- Animations ---
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
    if (finished) {
      Animated.timing(resultAnim, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }).start();
    }
  }, [finished, resultAnim]);

  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-12, 12] });

  const [streak, setStreak] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (finished) getStats().then((s) => setStreak(s.currentStreak));
  }, [finished]);

  async function onShare() {
    const text = buildShareText({
      number: puzzle.number,
      grid: state.guesses.map((g) => g.tierOf),
      status: state.status === 'won' ? 'won' : 'lost',
      mistakes: state.mistakes,
      currentStreak: streak,
    });
    try {
      await Share.share({ message: text });
    } catch {
      /* user dismissed */
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
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 20 }]}
    >
      <Text style={styles.sub}>
        {t.play.subtitle}
        {game.relaxed ? `  ·  ${t.play.relaxed}` : ''}
      </Text>

      {state.solved.map((g) => (
        <SolvedGroup key={g.theme} group={g} />
      ))}

      {!finished && (
        <Animated.View style={[styles.grid, { transform: [{ translateX: shakeX }] }]}>
          {chunk(state.remaining, 4).map((row, ri) => (
            <View key={ri} style={styles.row}>
              {row.map((id) => (
                <CardTile
                  key={id}
                  card={getCard(id)}
                  selected={state.selected.includes(id)}
                  onPress={game.select}
                />
              ))}
            </View>
          ))}
        </Animated.View>
      )}

      {!game.relaxed && !finished && (
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
          <SecondaryBtn label={t.play.shuffle} onPress={game.shuffle} />
          <SecondaryBtn
            label={t.play.remove}
            onPress={game.deselect}
            disabled={state.selected.length === 0}
          />
          <PrimaryBtn label={t.play.submit} onPress={game.submit} disabled={!game.canSubmit} />
        </View>
      )}

      {finished && (
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
              ? state.mistakes === 0
                ? t.play.perfect
                : t.play.solved
              : t.play.lost}
          </Text>
          <View style={styles.gridPreview}>
            {state.guesses.map((g, i) => (
              <Text key={i} style={styles.gridRow}>
                {g.tierOf.map((tt) => tierEmoji[tt]).join('')}
              </Text>
            ))}
          </View>
          {state.status === 'lost' && <Text style={styles.dim}>{t.play.lostNote}</Text>}
          <Pressable
            style={({ pressed }) => [styles.shareBtn, pressed && styles.pressed]}
            onPress={onShare}
          >
            <Text style={styles.shareText}>{t.play.share}</Text>
          </Pressable>
        </Animated.View>
      )}
    </ScrollView>
  );
}

function PrimaryBtn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryBtn,
        disabled && styles.btnDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryBtn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryBtn,
        disabled && styles.btnDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 12, paddingTop: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  sub: { color: colors.textDim, fontSize: 15, textAlign: 'center', marginBottom: 14 },
  grid: { marginTop: 2 },
  row: { flexDirection: 'row' },
  mistakes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  dot: { width: 12, height: 12, borderRadius: 6, marginHorizontal: 4, backgroundColor: colors.border },
  dotUsed: { backgroundColor: colors.danger },
  oneAway: { color: colors.accent, textAlign: 'center', marginTop: 10, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18, justifyContent: 'center' },
  primaryBtn: { backgroundColor: colors.accent, paddingHorizontal: 30, paddingVertical: 13, borderRadius: 26 },
  primaryText: { color: '#0B1026', fontWeight: '800', fontSize: 16 },
  secondaryBtn: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
  result: {
    marginTop: 22,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultTitle: { color: colors.text, fontSize: 24, fontWeight: '900', marginBottom: 12 },
  gridPreview: { alignItems: 'center', marginBottom: 12 },
  gridRow: { fontSize: 22, letterSpacing: 2, lineHeight: 30 },
  shareBtn: { backgroundColor: colors.success, paddingHorizontal: 36, paddingVertical: 13, borderRadius: 26, marginTop: 8 },
  shareText: { color: '#0B1026', fontWeight: '800', fontSize: 16 },
  dim: { color: colors.textDim, fontSize: 13, textAlign: 'center' },
});
