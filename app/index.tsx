import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../src/theme';
import { useI18n } from '../src/i18n';
import { getTodaysPuzzle } from '../src/data/puzzles';
import { getResult, getSettings, getStats, type Stats } from '../src/storage/store';

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const puzzle = getTodaysPuzzle();
  const [stats, setStats] = useState<Stats | null>(null);
  const [playedToday, setPlayedToday] = useState(false);
  const promptedTutorial = useRef(false);

  // First launch: open the tutorial once.
  useEffect(() => {
    let active = true;
    (async () => {
      const s = await getSettings();
      if (active && !s.tutorialDone && !promptedTutorial.current) {
        promptedTutorial.current = true;
        router.push('/tutorial');
      }
    })();
    return () => {
      active = false;
    };
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [s, r] = await Promise.all([getStats(), getResult(puzzle.id)]);
        if (!active) return;
        setStats(s);
        setPlayedToday(!!r);
      })();
      return () => {
        active = false;
      };
    }, [puzzle.id])
  );

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.hero}>
        <Text style={styles.logo}>Coplas</Text>
        <Text style={styles.tagline}>{t.home.tagline}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardKicker}>{t.home.todaysCopla}</Text>
        <Text style={styles.cardNumber}>#{puzzle.number}</Text>
        <Text style={styles.cardDate}>{formatDate(puzzle.date)}</Text>

        <Pressable
          style={({ pressed }) => [styles.playBtn, pressed && styles.pressed]}
          onPress={() => router.push('/play')}
        >
          <Text style={styles.playBtnText}>
            {playedToday ? t.home.viewResult : t.home.play}
          </Text>
        </Pressable>
        {playedToday && <Text style={styles.playedNote}>{t.home.playedNote}</Text>}
      </View>

      <View style={styles.streakRow}>
        <Stat label={t.home.streak} value={stats ? String(stats.currentStreak) : '–'} emoji="🔥" />
        <Stat label={t.home.best} value={stats ? String(stats.bestStreak) : '–'} emoji="🏆" />
        <Stat label={t.home.wins} value={stats ? `${stats.winRate}%` : '–'} emoji="✅" />
      </View>

      <View style={styles.links}>
        <NavLink href="/tutorial" label={t.home.howToPlay} hint={t.home.howToPlayHint} />
        <NavLink href="/archive" label={t.nav.archive} hint={t.home.archiveHint} />
        <NavLink href="/stats" label={t.nav.stats} hint={t.home.statsHint} />
        <NavLink href="/settings" label={t.nav.settings} hint={t.home.settingsHint} />
      </View>
    </ScrollView>
  );
}

function Stat({ label, value, emoji }: { label: string; value: string; emoji: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function NavLink({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <Link href={href as never} asChild>
      <Pressable style={({ pressed }) => [styles.navLink, pressed && styles.pressed]}>
        <View>
          <Text style={styles.navLabel}>{label}</Text>
          <Text style={styles.navHint}>{hint}</Text>
        </View>
        <Text style={styles.navChevron}>›</Text>
      </Pressable>
    </Link>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  return `${d} de ${months[m - 1]} de ${y}`;
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 8 },
  hero: { alignItems: 'center', marginVertical: 18 },
  logo: { color: colors.accent, fontSize: 44, fontWeight: '900', letterSpacing: 1 },
  tagline: { color: colors.textDim, fontSize: 15, marginTop: 4 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardKicker: { color: colors.textDim, textTransform: 'uppercase', letterSpacing: 2, fontSize: 12, fontWeight: '700' },
  cardNumber: { color: colors.text, fontSize: 40, fontWeight: '900', marginTop: 4 },
  cardDate: { color: colors.textDim, fontSize: 14, marginBottom: 16 },
  playBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 30,
  },
  playBtnText: { color: '#0B1026', fontSize: 18, fontWeight: '800' },
  playedNote: { color: colors.textDim, fontSize: 12, marginTop: 10 },
  streakRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statEmoji: { fontSize: 18 },
  statValue: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 2 },
  statLabel: { color: colors.textDim, fontSize: 12 },
  links: { marginTop: 20, gap: 10 },
  navLink: {
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
  navLabel: { color: colors.text, fontSize: 16, fontWeight: '700' },
  navHint: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  navChevron: { color: colors.textDim, fontSize: 26, fontWeight: '400' },
  pressed: { opacity: 0.75 },
});
