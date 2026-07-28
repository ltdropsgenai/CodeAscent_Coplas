import { useCallback, useLayoutEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from 'expo-router';
import { colors } from '../src/theme';
import { useI18n } from '../src/i18n';
import { getStats, type Stats } from '../src/storage/store';

export default function StatsScreen() {
  const { t } = useI18n();
  const navigation = useNavigation();
  const [stats, setStats] = useState<Stats | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t.nav.stats });
  }, [navigation, t]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getStats().then((s) => active && setStats(s));
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.grid}>
        <Big label={t.stats.played} value={stats.played} />
        <Big label={t.stats.wins} value={`${stats.winRate}%`} />
        <Big label={t.stats.streak} value={stats.currentStreak} emoji="🔥" />
        <Big label={t.stats.best} value={stats.bestStreak} emoji="🏆" />
        <Big label={t.stats.perfect} value={stats.perfect} emoji="✨" />
        <Big label={t.stats.noError} value={`${stats.perfectRate}%`} />
      </View>

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
  container: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  bigBox: {
    width: '31%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  bigValue: { color: colors.text, fontSize: 22, fontWeight: '900' },
  bigLabel: { color: colors.textDim, fontSize: 12, marginTop: 4, textAlign: 'center' },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 24, marginBottom: 10 },
  hist: { gap: 8 },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  histLabel: { color: colors.textDim, width: 16, textAlign: 'center', fontWeight: '700' },
  barTrack: { flex: 1, height: 18, backgroundColor: colors.surfaceAlt, borderRadius: 9, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 9 },
  histCount: { color: colors.text, width: 24, textAlign: 'right', fontWeight: '700' },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 30 },
  dim: { color: colors.textDim },
});
