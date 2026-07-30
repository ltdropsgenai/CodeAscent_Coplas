import { useCallback, useLayoutEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { colors, displayFont, floatShadow } from '../src/theme';
import { useI18n } from '../src/i18n';
import { getArchivePuzzles } from '../src/data/puzzles';
import { getResult, type PuzzleResult } from '../src/storage/store';
import { usePurchases } from '../src/purchases';
import type { Puzzle } from '../src/types';


/**
 * Gating lives entirely in `usePurchases().isLocked(index)`. There is no
 * free-window constant here on purpose: a bare index cap (this used to be
 * `index >= 7`) locked older coplas with no way to unlock them — a dead end for
 * the player and the kind of non-functional gate App Review rejects.
 *
 * `isLocked` returns false for every index while IAP_ENABLED is false, so
 * nothing is capped on any test track. When the unlock ships, a locked row
 * stays *tappable* and routes to the paywall rather than going inert.
 */
export default function Archive() {
  const router = useRouter();
  const navigation = useNavigation();
  const { t } = useI18n();
  const { isLocked, gateActive, unlocked } = usePurchases();
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
    const locked = isLocked(index);
    const result = results[item.id];
    return (
      <Pressable
        onPress={() => router.push(locked ? '/unlock' : `/play?n=${item.number}`)}
        style={({ pressed }) => [styles.item, locked && styles.locked, pressed && styles.pressed]}
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
      ListHeaderComponent={
        <View>
          <Text style={styles.note}>{t.archive.note}</Text>
          {gateActive && !unlocked && (
            <Pressable
              onPress={() => router.push('/unlock')}
              style={({ pressed }) => [styles.unlockCta, pressed && styles.pressed]}
            >
              <Text style={styles.unlockCtaText}>{t.iap.lockedCta} ›</Text>
            </Pressable>
          )}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 34 },
  note: { color: colors.textDim, fontSize: 13, marginBottom: 14, lineHeight: 19, ...floatShadow },
  // Hairline-separated rows floating on the scene — no panels (see home).
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(244,185,66,0.15)',
  },
  locked: { opacity: 0.55 },
  pressed: { opacity: 0.75 },
  unlockCta: {
    marginBottom: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.borderGold,
    alignSelf: 'flex-start',
  },
  unlockCtaText: { color: colors.accent, fontWeight: '800', fontSize: 14 },
  number: { color: colors.text, fontFamily: displayFont, fontSize: 19, fontWeight: '700', ...floatShadow },
  date: { color: colors.textDim, fontSize: 12, marginTop: 2, ...floatShadow },
  badge: { fontWeight: '800', fontSize: 14 },
  lockText: { color: colors.textDim, fontWeight: '700' },
  play: { color: colors.accent, fontWeight: '800', fontSize: 15 },
});
