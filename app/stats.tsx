import { useCallback, useLayoutEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from 'expo-router';
import { colors, displayFont, floatShadow, monoFont } from '../src/theme';
import { useI18n } from '../src/i18n';
import { daysBetween, getSeenCards, getStats, playDay, type Stats } from '../src/storage/store';
import { CARDS } from '../src/data/cards';

/** How many days the calendar strip draws. */
const CAL_DAYS = 30;

export default function StatsScreen() {
  const { t } = useI18n();
  const navigation = useNavigation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [seenCount, setSeenCount] = useState(0);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t.nav.stats });
  }, [navigation, t]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getStats().then((s) => active && setStats(s));
      getSeenCards().then((m) => active && setSeenCount(Object.keys(m).length));
      return () => {
        active = false;
      };
    }, [])
  );

  if (!stats) {
    return (
      <View style={styles.center}>
        <Text style={styles.dim}>{t.stats.loading}</Text>
      </View>
    );
  }

  const maxHist = Math.max(1, ...stats.mistakeHistogram);

  // A day streak that has already lapsed shows as 0 rather than as the stale
  // number it was — claiming a streak the next round would silently reset is
  // the kind of small dishonesty that makes the whole screen untrustworthy.
  const liveDayStreak = stats.dayStreakLive ? stats.dayStreak : 0;

  // Calendar strip: the last CAL_DAYS days, newest on the right, filled where
  // the player actually played.
  const today = playDay();
  const played = new Set(stats.recentDays);
  const calendar = Array.from({ length: CAL_DAYS }, (_, i) => {
    const offset = CAL_DAYS - 1 - i;
    const day = stats.recentDays.find((d) => daysBetween(d, today) === offset);
    return { key: `d${offset}`, on: !!day && played.has(day) };
  });

  const DIFFS: Array<keyof typeof stats.byDifficulty> = ['facil', 'media', 'dificil'];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.grid}>
        <Big label={t.stats.played} value={stats.played} />
        <Big label={t.stats.wins} value={`${stats.winRate}%`} />
        <Big label={t.stats.winStreak} value={stats.winStreak} emoji="🔥" />
        <Big label={t.stats.best} value={stats.bestWinStreak} emoji="🏆" />
        <Big label={t.stats.dayStreak} value={liveDayStreak} emoji="📅" />
        <Big label={t.stats.bestDayStreak} value={stats.bestDayStreak} />
        <Big label={t.stats.perfect} value={stats.perfect} emoji="✨" />
        <Big label={t.stats.noError} value={`${stats.perfectRate}%`} />
        <Big label={t.stats.retried} value={stats.retried} emoji="🔁" />
      </View>

      {stats.played > 0 && !stats.dayStreakLive && (
        <Text style={styles.lapsed}>{t.stats.dayStreakLapsed}</Text>
      )}

      {stats.played > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t.stats.calendar}</Text>
          <View style={styles.calRow}>
            {calendar.map((c) => (
              <View key={c.key} style={[styles.calDot, c.on && styles.calDotOn]} />
            ))}
          </View>
          <Text style={styles.note}>
            {t.stats.daysPlayed}: {stats.daysPlayed}
          </Text>

          <Text style={styles.sectionTitle}>{t.stats.byDifficulty}</Text>
          <View style={styles.hist}>
            {DIFFS.map((d) => {
              const row = stats.byDifficulty[d];
              const rate = row.played ? Math.round((row.won / row.played) * 100) : 0;
              return (
                <View key={d} style={styles.histRow}>
                  <Text style={styles.diffLabel}>{t.diff[d]}</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[styles.barFill, { width: `${rate}%`, backgroundColor: colors.accent }]}
                    />
                  </View>
                  <Text style={styles.histCount}>
                    {row.played ? `${rate}%` : t.stats.noRounds}
                  </Text>
                </View>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>{t.stats.deckSeen}</Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${Math.min(100, (seenCount / Math.max(1, CARDS.length)) * 100)}%`,
                  backgroundColor: colors.accent,
                },
              ]}
            />
          </View>
          <Text style={styles.note}>{t.stats.deckSeenNote(seenCount, CARDS.length)}</Text>
        </>
      )}

      <Text style={styles.sectionTitle}>{t.stats.errorsPerWin}</Text>
      <View style={styles.hist}>
        {stats.mistakeHistogram.map((count, mistakes) => (
          <View key={mistakes} style={styles.histRow}>
            <Text style={styles.histLabel}>{mistakes}</Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${(count / maxHist) * 100}%`, backgroundColor: colors.accent },
                ]}
              />
            </View>
            <Text style={styles.histCount}>{count}</Text>
          </View>
        ))}
      </View>

      {stats.played === 0 && <Text style={styles.empty}>{t.stats.empty}</Text>}
    </ScrollView>
  );
}

function Big({ label, value, emoji }: { label: string; value: number | string; emoji?: string }) {
  return (
    <View style={styles.bigBox}>
      <Text style={styles.bigValue}>
        {emoji ? emoji + ' ' : ''}
        {value}
      </Text>
      <Text style={styles.bigLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 34 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(244,185,66,0.15)',
    paddingBottom: 8,
  },
  // No panels: each figure floats, separated from its neighbours by nothing but
  // space and a gold hairline under the row. Matches home's scoreboard.
  bigBox: {
    width: '31%',
    flexGrow: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  bigValue: {
    color: colors.accent,
    fontFamily: displayFont,
    fontSize: 28,
    fontWeight: '700',
    ...floatShadow,
  },
  bigLabel: {
    color: colors.textDim,
    fontFamily: monoFont,
    fontSize: 9,
    letterSpacing: 1.5,
    marginTop: 5,
    textAlign: 'center',
    ...floatShadow,
  },
  sectionTitle: {
    color: colors.accent,
    fontSize: 10,
    letterSpacing: 2.4,
    fontWeight: '800',
    marginTop: 30,
    marginBottom: 12,
    ...floatShadow,
  },
  hist: { gap: 8 },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  diffLabel: {
    color: colors.textDim,
    width: 60,
    fontFamily: monoFont,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  lapsed: { color: colors.textDim, fontSize: 13, lineHeight: 19, marginTop: 14, ...floatShadow },
  note: { color: colors.textDim, fontSize: 12, lineHeight: 18, marginTop: 8, ...floatShadow },
  calRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  calDot: {
    width: 14,
    height: 14,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  calDotOn: { backgroundColor: colors.accent },
  histLabel: { color: colors.textDim, width: 16, textAlign: 'center', fontFamily: monoFont, fontSize: 12 },
  barTrack: { flex: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2 },
  histCount: { color: colors.text, width: 24, textAlign: 'right', fontWeight: '700' },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 30 },
  dim: { color: colors.textDim },
});
