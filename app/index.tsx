import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Image,
  PixelRatio,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CARD_ASPECT, colors, displayFont, floatShadow, monoFont, tierColors } from '../src/theme';
import { useI18n } from '../src/i18n';
import { useAudio } from '../src/audio';
import { GradientButton } from '../src/components/GradientButton';
import { NavRow } from '../src/components/NavRow';
import { CardVideo } from '../src/components/CardVideo';
import { ANIMATED_CARD_IDS } from '../src/data/cardVideos';
import { thumbSource } from '../src/data/cardImages';
import { getTodaysPuzzle } from '../src/data/puzzles';
import { computeAchievements, unlockedCount } from '../src/game/achievements';
import { getResult, getSeenCards, getStats, type Stats } from '../src/storage/store';

// ── Fitting home onto one screen ───────────────────────────────────────────
// Home must never need scrolling to reach the menu. Hard-coding smaller sizes
// would fix one handset and break others: at full size the block wants ~889 pt,
// and an iPhone 17 gives its content 819 pt while an iPhone SE gives 603 pt.
// So we measure the room we actually have and derive one scale factor.
//
// It works in two stages, because arithmetic alone is not trustworthy here.
//
// STAGE 1 — ESTIMATE. Only part of the layout can shrink. The PLAY button (50),
// the menu row (74), the scoreboard cell (93) and every piece of body text stay
// put: that is FIXED_PT. The emblem, hero card, display numerals and vertical
// gaps scale: SCALABLE_PT. Both were derived by summing the real component
// sizes, giving 293 + 596 = 889 pt at full size, which matches what the screen
// actually rendered. Solving FIXED + SCALABLE·s ≤ available gives a scale that
// is right on the first frame, so nothing visibly jumps.
//
// STAGE 2 — MEASURE AND CORRECT. The estimate is blind to everything it wasn't
// told about: the OS text-size setting, the real font metrics, a translation
// that wraps to two lines, a non-iOS header, a future edit to any of these
// styles. So we also measure the viewport and the rendered content and, if the
// content still overflows, solve again using the MEASURED height. That closes
// the loop — the constants above only have to be close, not correct.
const FIXED_PT = 293;
const SCALABLE_PT = 596;
const CUSHION_PT = 8; // absorbs per-element rounding so we never land 1 pt over
const MIN_SCALE = 0.5; // an SE needs ~0.51; below this it stops looking like the design
const MAX_FIT_PASSES = 4; // hard stop; correction must never loop

export default function Home() {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const router = useRouter();
  const navigation = useNavigation();
  const { t, lang } = useI18n();

  // The viewport is MEASURED, not derived: the ScrollView is laid out by the
  // navigator below the header and inside the safe area, so its own height is
  // the real room we have on any platform, header style or device. That removes
  // the need to hardcode a header height (iOS 44 / Android 56) entirely.
  const [viewportH, setViewportH] = useState(0);
  // null = "no correction yet, use the estimate". Starting at 1 instead would
  // flash a full-size layout for one frame after the viewport is measured.
  const [scale, setScale] = useState<number | null>(null);
  const passes = useRef(0);

  // Before the first measurement lands, fall back to window arithmetic so frame
  // one is already the right size.
  const estAvail = viewportH || winH - insets.top - insets.bottom - 44;
  const estimate = Math.max(
    MIN_SCALE,
    Math.min(1, (estAvail - CUSHION_PT - FIXED_PT) / SCALABLE_PT)
  );
  const s = scale ?? estimate;

  // Re-seed whenever the room or the OS text size changes (rotation, iPad split
  // view, the player turning up Dynamic Type). Without this the screen would
  // stay stuck at a scale computed for conditions that no longer hold.
  const fontScale = PixelRatio.getFontScale();
  useEffect(() => {
    passes.current = 0;
    setScale(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportH, fontScale]);

  const onContentLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const contentH = e.nativeEvent.layout.height;
      if (!viewportH || contentH <= viewportH) return; // already fits
      if (passes.current >= MAX_FIT_PASSES) return; // give up rather than loop
      passes.current += 1;
      // Solve again from what we just measured. If H = FIXED + SCALABLE·s then
      // the scalable part currently on screen is (contentH - FIXED), so the
      // scale that would fit is s·(room - FIXED) / (contentH - FIXED). Deriving
      // it from the measurement means an inaccurate FIXED_PT only slows
      // convergence instead of breaking the result.
      const shown = contentH - FIXED_PT;
      if (shown <= 0) return;
      const next = (s * (viewportH - CUSHION_PT - FIXED_PT)) / shown;
      const clamped = Math.max(MIN_SCALE, Math.min(1, next));
      if (clamped < s - 0.005) setScale(clamped);
    },
    [viewportH, s]
  );

  // Boxes and gaps scale freely; TEXT never goes below 11 pt, which is the
  // smallest size iOS considers legible — shrinking type to win layout is
  // exactly the trade we're refusing to make.
  const px = (base: number) => Math.round(base * s);
  const tx = (base: number) => Math.max(11, Math.round(base * s));
  const { soundEnabled, toggleSound, playHomeMusic, stopHomeMusic } = useAudio();
  const puzzle = getTodaysPuzzle();
  const [stats, setStats] = useState<Stats | null>(null);
  const [badges, setBadges] = useState<{ got: number; total: number } | null>(null);
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
        const [s, r, seenCards] = await Promise.all([
          getStats(),
          getResult(puzzle.id),
          getSeenCards(),
        ]);
        if (!active) return;
        setStats(s);
        setPlayedToday(!!r);
        const all = computeAchievements({ stats: s, seenCount: Object.keys(seenCards).length });
        setBadges({ got: unlockedCount(all), total: all.length });
      })();
      return () => {
        active = false;
        // Stop the menu bed the moment Home loses focus, so it cannot carry on
        // underneath a round. stopHomeMusic no-ops if the play screen has
        // already claimed the bed, which it sometimes does before this cleanup
        // runs — without that guard this line would kill the round music a
        // moment after it started.
        stopHomeMusic();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [puzzle.id])
  );

  return (
    // flexGrow makes the content fill exactly one screen. The ScrollView stays
    // as a safety net: at very large Dynamic Type sizes the block can still
    // exceed the screen, and the menu must never become unreachable.
    <ScrollView
      onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
      contentContainerStyle={[
        styles.container,
        { flexGrow: 1, paddingBottom: insets.bottom + px(24) },
      ]}
    >
      {/* One wrapper so a single onLayout reports the true rendered height. */}
      <View onLayout={onContentLayout} style={styles.fitProbe}>
        <View style={[styles.hero, { marginVertical: px(20) }]}>
          <Image
            source={require('../assets/icon.png')}
            style={[styles.heroLogo, { width: px(132), height: px(132), marginBottom: px(8) }]}
            resizeMode="contain"
          />
          <Text style={[styles.logo, { fontSize: tx(52), lineHeight: tx(52) * 1.18 }]}>Coplas</Text>
          <View style={[styles.rule, { marginTop: px(8) }]} />
          <Text style={[styles.tagline, { marginTop: px(10) }]}>{t.home.tagline}</Text>
        </View>

        {/* No panel, no border - the copla floats directly on the scene, the
            way the rest of the CodeAscent apps present content. */}
        <View style={styles.today}>
          {!!heroId && (
            <View style={[styles.heroCard, { width: px(128), marginBottom: px(16) }]}>
              <CardVideo cardId={heroId} cornerRadius={8} />
            </View>
          )}
          <Text style={styles.cardKicker}>{t.home.todaysCopla}</Text>
          <Text style={[styles.cardNumber, { fontSize: tx(48), lineHeight: tx(48) * 1.15 }]}>
            #{puzzle.number}
          </Text>
          <Text style={[styles.cardDate, { marginBottom: px(18) }]}>
            {formatDate(puzzle.date, lang)}
          </Text>

          <GradientButton
            label={t.home.play}
            onPress={() => router.push('/play')}
            size="lg"
            style={{ marginTop: 4 }}
          />
        </View>

        {/* Stats float, separated by hairlines - no boxes. Each gets its own
            card from the deck: El Fuego for the win streak, El Calendario for
            the day streak, La Medalla for wins.

            Two streaks, deliberately. The win streak is the strict one and
            resets the moment you lose — it makes a round matter. The day
            streak is the forgiving one and only asks that you show up — it is
            what brings people back. `dayStreakLive` guards against showing a
            lapsed streak as if it were current. */}
        <View style={[styles.scoreboard, { marginTop: px(26) }]}>
          <Stat label={t.home.streak} value={stats ? String(stats.winStreak) : '-'} icon="el_fuego" />
          <View style={styles.scoreRule} />
          <Stat
            label={t.home.days}
            value={stats ? String(stats.dayStreakLive ? stats.dayStreak : 0) : '-'}
            icon="el_calendario"
          />
          <View style={styles.scoreRule} />
          <Stat label={t.home.wins} value={stats ? `${stats.winRate}%` : '-'} icon="la_medalla" />
        </View>

        {/* Badge progress. This is the whole of a player's long-run progress on
            a screen that must never scroll, so it is one line and one hairline:
            a count, and how far along the bar sits. The round-complete screen
            used to list every badge as it landed, which interrupted the game to
            report on the game. It belongs here, where someone is deciding
            whether to play rather than in the middle of playing. */}
        {!!badges && (
          <View style={[styles.badges, { marginTop: px(16) }]}>
            <View style={styles.badgeRow}>
              <Text style={styles.badgeLabel}>{t.achievements.title.toUpperCase()}</Text>
              <Text style={styles.badgeCount}>
                {badges.got} / {badges.total}
              </Text>
            </View>
            <View style={styles.badgeTrack}>
              <View
                style={[
                  styles.badgeFill,
                  { width: `${badges.total ? (badges.got / badges.total) * 100 : 0}%` },
                ]}
              />
            </View>
          </View>
        )}

        {/* Home stays about ONE thing: play today's copla. Everything else -
            the rules, the archive, stats, preferences and the legal pages -
            lives behind this single door (app/settings.tsx). La Llave Inglesa
            from our own deck is the icon; no icon-font dependency. */}
        <View style={[styles.links, { marginTop: px(26) }]}>
          <NavRow href="/settings" label={t.nav.more} hint={t.home.moreHint} icon="la_llave_inglesa" first />
        </View>
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
        source={thumbSource(icon, STAT_ICON_W, STAT_ICON_H)}
        style={styles.statIcon}
        resizeMode="cover"
      />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

const MONTHS: Record<'es' | 'en', string[]> = {
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
       'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June',
       'July', 'August', 'September', 'October', 'November', 'December'],
};

/**
 * The puzzle date, written the way each language writes dates.
 *
 * Deliberately NOT `Intl.DateTimeFormat`: the string is a plain `YYYY-MM-DD`
 * with no timezone, and handing that to a Date would shift it a day either side
 * of UTC depending on where the player is. Splitting the string keeps the date
 * we published the one the player sees.
 *
 * Card names stay Spanish by design — this is a Spanish word game — but the
 * surrounding chrome follows the language setting, and the date is chrome.
 */
function formatDate(iso: string, lang: 'es' | 'en'): string {
  const [y, m, d] = iso.split('-').map(Number);
  const month = MONTHS[lang][m - 1];
  return lang === 'es' ? `${d} de ${month} de ${y}` : `${month} ${d}, ${y}`;
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 8 },
  // Wraps everything so one onLayout reports the true rendered height.
  fitProbe: { flexGrow: 1 },
  // Sizes and gaps marked "scaled" below are overridden inline from the fit
  // calculation at the top of this file; the values here are the full-size
  // design and what you get on a tall screen.
  hero: { alignItems: 'center' }, // marginVertical scaled
  heroLogo: {
    borderRadius: 30, // width/height/marginBottom scaled
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
  rule: { width: 60, height: 3, borderRadius: 2, backgroundColor: colors.accent, opacity: 0.8 },
  tagline: { color: colors.text, fontSize: 16, ...floatShadow },
  today: { alignItems: 'center', paddingTop: 4 },
  heroCard: {
    // width + marginBottom scaled. Match the generated art's own ratio
    // (1792x2400) so 'cover' crops nothing and the printed name banner at the
    // bottom stays fully visible.
    aspectRatio: CARD_ASPECT,
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
    letterSpacing: 2.4,
    fontSize: 12,
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
  cardDate: { color: colors.textDim, fontSize: 14, ...floatShadow },
  playedNote: { color: colors.textDim, fontSize: 12, marginTop: 12 },
  scoreboard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreRule: { width: 1, height: 54, backgroundColor: 'rgba(244,185,66,0.28)' },
  badges: { alignSelf: 'stretch' },
  badgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  badgeLabel: {
    color: colors.textDim,
    fontFamily: monoFont,
    fontSize: 11,
    letterSpacing: 1.4,
    ...floatShadow,
  },
  badgeCount: { color: colors.accent, fontFamily: monoFont, fontSize: 12, ...floatShadow },
  badgeTrack: {
    height: 2,
    marginTop: 7,
    borderRadius: 1,
    backgroundColor: 'rgba(244,185,66,0.22)',
    overflow: 'hidden',
  },
  badgeFill: { height: 2, borderRadius: 1, backgroundColor: colors.accent },
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
    // 11 pt is the floor; 9 pt with wide tracking was below what iOS considers
    // legible and was the smallest type on the screen.
    fontFamily: monoFont,
    fontSize: 11,
    letterSpacing: 1.4,
    marginTop: 3,
    ...floatShadow,
  },

  // The row itself is NavRow's business; home only sets the group's offset.
  links: {},
  pressed: { opacity: 0.6 },
});
