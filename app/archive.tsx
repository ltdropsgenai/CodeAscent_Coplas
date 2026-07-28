import { useCallback, useLayoutEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { colors } from '../src/theme';
import { useI18n } from '../src/i18n';
import { getArchivePuzzles } from '../src/data/puzzles';
import { getResult, type PuzzleResult } from '../src/storage/store';
import type { Puzzle } from '../src/types';

/** How many of the most recent puzzles are free to replay. */
const FREE_WINDOW = 7;

export default function Archive() {
  const router = useRouter();
  const navigation = useNavigation();
  const { t } = useI18n();
  const puzzles = getArchivePuzzles();
  const [results, setResults] = useState<Record<string, PuzzleResult | undefined>>({});

  useLayoutEffect(() => {
    navigation.setOptions({ title: t.nav.archive });
  }, [navigation, t]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const entries = await Promise.all(
          puzzles.map(async (p) => [p.id, await getResult(p.id)] as const)
        );
        if (active) setResults(Object.fromEntries(entries));
      })();
      return () => {
        active = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [puzzles.length])
  );

  const renderItem = ({ item, index }: { item: Puzzle; index: number }) => {
    const locked = index >= FREE_WINDOW;
    const result = results[item.id];
    return (
      <Pressable
        disabled={locked}
        onPress={() => router.push(`/play?n=${item.number}`)}
        style={({ pressed }) => [
          styles.item,
          locked && styles.locked,
          pressed && !locked && styles.pressed,
        ]}
      >
        <View>
          <Text style={styles.number}>#{item.number}</Text>
          <Text style={styles.date}>{item.date}</Text>
        </View>
        <View>
          {locked ? (
            <Text style={styles.lockText}>{t.archive.lock}</Text>
          ) : result ? (
            <Text
              style={[
                styles.badge,
                { color: result.status === 'won' ? colors.success : colors.danger },
              ]}
            >
              {result.status === 'won'
                ? result.mistakes === 0
                  ? t.archive.perfect
                  : t.archive.err(result.mistakes)
                : t.archive.failed}
            </Text>
          ) : (
            <Text style={styles.play}>{t.archive.play}</Text>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <FlatList
      data={puzzles}
      keyExtractor={(p) => p.id}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      ListHeaderComponent={<Text style={styles.note}>{t.archive.note(FREE_WINDOW)}</Text>}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 14, gap: 10 },
  note: { color: colors.textDim, fontSize: 13, marginBottom: 8, lineHeight: 18 },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  locked: { opacity: 0.55 },
  pressed: { opacity: 0.75 },
  number: { color: colors.text, fontSize: 18, fontWeight: '800' },
  date: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  badge: { fontWeight: '800', fontSize: 14 },
  lockText: { color: colors.textDim, fontWeight: '700' },
  play: { color: colors.accent, fontWeight: '800', fontSize: 15 },
});
