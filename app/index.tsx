import { useCallback, useLayoutEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CARD_ASPECT, colors, displayFont, floatShadow, monoFont, tierColors } from '../src/theme';
import { useI18n } from '../src/i18n';
import { useAudio } from '../src/audio';
import { GradientButton } from '../src/components/GradientButton';
import { NavRow } from '../src/components/NavRow';
import { CardVideo } from '../src/components/CardVideo';
import { ANIMATED_CARD_IDS } from '../src/data/cardVideos';
import { cardThumb } from '../src/data/cardImages';
import { getTodaysPuzzle } from '../src/data/puzzles';
import { getResult, getStats, type Stats } from '../src/storage/store';

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const { t } = useI18n();
  const { soundEnabled, toggleSound, playHomeMusic } = useAudio();
  const puzzle = getTodaysPuzzle();
  const [stats, setStats] = useState<Stats | null>(null);
  const [playedToday, setPlayedToday] = useState(false);
  // A different animated card greets you each time the app is opened.
  const [heroId] = useState(
    () => ANIMATED_CARD_IDS[Math.floor(Math.random() * ANIMATED_CARD_IDS.length)]
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={toggleSound} hitSlop={12} style={{ paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 18 }}>{soundEnabled ? '🔊' : '🔇'}</Text>
        </Pressable>
      ),
    });
  }, [navigation, soundEnabled, toggleSound]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      // Return to the calm home bed whenever the menu is in focus (e.g. coming
      // back from a round, which was playing a different genre).
      playHomeMusic();
      (async () => {
        const [s, r] = await Promise.all([getStats(), getResult(puzzle.id)]);
        if (!active) return;
        setStats(s);
        setPlayedToday(!!r);
      })();
      return () => {
        active = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [puzzle.id])
  );

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.hero}>
        <Image
          source={require('../assets/icon.png')}
          style={styles.heroLogo}
          resizeMode="contain"
        />
        <Text style={styles.logo}>Coplas</Text>
        <View style={styles.rule} />
        <Text style={styles.tagline}>{t.home.tagline}</Text>
      </View>

      {/* No panel, no border — the copla floats directly on the scene, the way
          the rest of the CodeAscent apps present content. */}
      <View style={styles.today}>
        {!!heroId && (
          <View style={styles.heroCard}>
            <CardVideo cardId={heroId} cornerRadius={8} />
          </View>
        )}
        <Text style={styles.cardKicker}>{t.home.todaysCopla}</Text>
        <Text style={styles.cardNumber}>#{puzzle.number}</Text>
        <Text style={styles.cardDate}>{formatDate(puzzle.date)}</Text>

        <GradientButton
          label={t.home.play}
          onPress={() => router.push('/play')}
          size="lg"
          style={{ marginTop: 4 }}
        />
      </View>

      {/* Stats float, separated by hairlines — no boxes. Each gets its own card
          from the deck: El Fuego for the streak, La Corona for your best, La
          Medalla for wins. */}
      <View style={styles.scoreboard}>
        <Stat label={t.home.streak} value={stats ? String(stats.currentStreak) : '–'} icon="el_fuego" />
        <View style={styles.scoreRule} />
        <Stat label={t.home.best} value={stats ? String(stats.bestStreak) : '–'} icon="la_corona" />
        <View style={styles.scoreRule} />
        <Stat label={t.home.wins} value={stats ? `${stats.winRate}%` : '–'} icon="la_medalla" />
      </View>

      {/* Home stays about ONE thing: play today's copla. Everything else — the
          rules, the archive, stats, preferences and the legal pages — lives
          behind this single door (app/settings.tsx). La Llave Inglesa from our
          own deck is the icon; no icon-font dependency. */}
      <View style={styles.links}>
        <NavRow href="/settings" label={t.nav.more} hint={t.home.moreHint} icon="la_llave_inglesa" first />
      </View>
    </ScrollView>
  );
}

const STAT_ICON_W = 26;
const STAT_ICON_H = 35;

/** One scoreboard cell: its card, a big serif numeral, then a mono kicker. */
function Stat({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.statCell}>
      <Image
        source={{ uri: cardThumb(icon, STAT_ICON_W, STAT_ICON_H) }}
        style={styles.statIcon}
      />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
    </View>
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
  hero: { alignItems: 'center', marginVertical: 20 },
  heroLogo: {
    width: 132,
    height: 132,
    borderRadius: 30,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: colors.borderGold,
  },
  logo: {
    color: colors.accent,
    fontFamily: displayFont,
    fontSize: 52,
    fontWeight: '700',
    letterSpacing: 1,
    textShadowColor: 'rgba(244,185,66,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  rule: { width: 60, height: 3, borderRadius: 2, backgroundColor: colors.accent, marginTop: 8, opacity: 0.8 },
  tagline: { color: colors.text, fontSize: 15, marginTop: 10, ...floatShadow },
  today: { alignItems: 'center', paddingTop: 4 },
  heroCard: {
    width: 128,
    // Match the generated art's own ratio (1792x2400) so 'cover' crops nothing
    // and the printed name banner at the bottom stays fully visible.
    aspectRatio: CARD_ASPECT,
    marginBottom: 16,
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  cardKicker: {
    color: colors.accent,
    fontFamily: monoFont,
    textTransform: 'uppercase',
    letterSpacing: 3,
    fontSize: 11,
    ...floatShadow,
  },
  cardNumber: {
    color: colors.text,
    fontFamily: displayFont,
    fontSize: 48,
    fontWeight: '700',
    marginTop: 2,
    ...floatShadow,
  },
  cardDate: { color: colors.textDim, fontSize: 13, marginBottom: 18, ...floatShadow },
  playedNote: { color: colors.textDim, fontSize: 12, marginTop: 12 },
  scoreboard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 26,
  },
  scoreRule: { width: 1, height: 54, backgroundColor: 'rgba(244,185,66,0.28)' },
  statCell: { flex: 1, alignItems: 'center' },
  statIcon: {
    width: STAT_ICON_W,
    height: STAT_ICON_H,
    borderRadius: 3,
    marginBottom: 7,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  statValue: {
    color: colors.accent,
    fontFamily: displayFont,
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 34,
    ...floatShadow,
  },
  statLabel: {
    color: colors.textDim,
    fontFamily: monoFont,
    fontSize: 9,
    letterSpacing: 1.7,
    marginTop: 2,
    ...floatShadow,
  },

  // The row itself is NavRow's business; home only sets the group's offset.
  links: { marginTop: 26 },
  pressed: { opacity: 0.6 },
});
