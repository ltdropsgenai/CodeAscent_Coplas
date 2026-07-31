import { useCallback, useLayoutEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, displayFont, floatShadow, monoFont } from '../src/theme';
import { useI18n } from '../src/i18n';
import { cardThumb } from '../src/data/cardImages';
import { computeAchievements, unlockedCount, type Achievement } from '../src/game/achievements';
import { getSeenCards, getStats, type Stats } from '../src/storage/store';

const ICON_W = 34;
const ICON_H = 45;

/**
 * Every badge, unlocked first, then whatever is closest.
 *
 * Locked rows still show their progress bar and their "7 / 30" count rather
 * than hiding behind a question mark: a goal you can see yourself approaching
 * is the thing that pulls you back, and a wall of mystery boxes is just noise.
 * Nothing here is stored — it is all derived from stats, so the numbers can
 * never disagree with the stats screen.
 */
export default function Achievements() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [list, setList] = useState<Achievement[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t.achievements.title });
  }, [navigation, t]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [s, seen] = await Promise.all([getStats(), getSeenCards()]);
        if (!active) return;
        setStats(s);
        setList(computeAchievements({ stats: s, seenCount: Object.keys(seen).length }));
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  if (!list) {
    return (
      <View style={styles.center}>
        <Text style={styles.dim}>{t.stats.loading}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 30 }]}>
      <Text style={styles.count}>{t.achievements.count(unlockedCount(list), list.length)}</Text>
      {stats?.played === 0 && <Text style={styles.empty}>{t.achievements.empty}</Text>}

      {list.map((a, i) => (
        <View key={a.id} style={[styles.row, i > 0 && styles.divider]}>
          <Image
            source={{ uri: cardThumb(a.icon, ICON_W, ICON_H) }}
            style={[styles.icon, !a.unlocked && styles.iconLocked]}
          />
          <View style={styles.body}>
            <Text style={[styles.name, !a.unlocked && styles.nameLocked]}>
              {t.achievements.names[a.id] ?? a.id}
            </Text>
            <Text style={styles.desc}>{t.achievements.descs[a.id] ?? ''}</Text>
            {!a.unlocked && (
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${a.progress * 100}%` }]} />
              </View>
            )}
          </View>
          <Text style={[styles.tally, a.unlocked && styles.tallyDone]}>
            {a.unlocked ? '✓' : `${a.have}/${a.need}`}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const HAIRLINE = 'rgba(244,185,66,0.15)';

const styles = StyleSheet.create({
  container: { paddingHorizontal: 18, paddingTop: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dim: { color: colors.textDim },
  count: {
    color: colors.accent,
    fontFamily: monoFont,
    fontSize: 10,
    letterSpacing: 2.2,
    marginBottom: 6,
    ...floatShadow,
  },
  empty: { color: colors.textDim, fontSize: 13, lineHeight: 19, marginBottom: 6, ...floatShadow },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  divider: { borderTopWidth: 1, borderTopColor: HAIRLINE },
  icon: {
    width: ICON_W,
    height: ICON_H,
    borderRadius: 4,
    marginRight: 14,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  // Locked badges are dimmed rather than hidden, so the goal is legible.
  iconLocked: { opacity: 0.35 },
  body: { flex: 1 },
  name: {
    color: colors.text,
    fontFamily: displayFont,
    fontSize: 17,
    fontWeight: '700',
    ...floatShadow,
  },
  nameLocked: { color: colors.textDim },
  desc: { color: colors.textDim, fontSize: 12, marginTop: 2, lineHeight: 17, ...floatShadow },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 7,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 2, backgroundColor: colors.accent },
  tally: {
    color: colors.textDim,
    fontFamily: monoFont,
    fontSize: 11,
    marginLeft: 10,
    minWidth: 40,
    textAlign: 'right',
  },
  tallyDone: { color: colors.success, fontSize: 16 },
});
