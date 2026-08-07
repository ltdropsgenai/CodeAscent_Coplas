/**
 * SplashSequence — the launch intro.
 *
 * Choreography (single master timeline `p`, 0→1 over ~2.6s):
 *   1. Gold "pieces" — four card silhouettes, a medallion ring, and a few
 *      sparks — fly in from the edges and converge on the centre.
 *   2. As they lock together the real emblem (assets/icon.png) blooms in with a
 *      diagonal shimmer sweep; the pieces fade under it.
 *   3. "Coplas" + the tagline write in below, a gold rule draws.
 * Auto-finishes on completion; a "Saltar ›" button skips straight to the end.
 *
 * Rendered as a full-screen overlay from app/_layout.tsx on every cold start.
 * Pure RN Animated (native driver) — no video, no extra deps.
 */
import { useEffect, useMemo, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, displayFont, monoFont, gradients } from '../theme';
import { useI18n } from '../i18n';
import { useAudio } from '../audio';

const DURATION = 2600;
/** How far the wordmark block extends below the emblem, inside the stage box. */
const STAGE_DROP = 130;

type Piece = {
  kind: 'card' | 'ring' | 'spark';
  fromX: number;
  fromY: number;
  rot: number; // final rotation (deg)
  win: [number, number]; // enter window within [0,1]
  dx?: number; // final offset from centre
};

/**
 * Where each piece flies in from, as a FRACTION of the window — resolved to
 * points inside the component against the live size.
 *
 * These were previously absolute pixels computed from a module-scope
 * `Dimensions.get('window')`, i.e. whatever the window happened to be when the
 * bundle first evaluated. On an iPad in Split View or Stage Manager the pieces
 * would fly in from the edges of a window that no longer exists — either
 * visibly inside the frame or far outside it.
 */
const PIECE_SPEC: (Omit<Piece, 'fromX' | 'fromY'> & { fx: number; fy: number })[] = [
  { kind: 'card', fx: -0.5, fy: -0.32, rot: -20, dx: -46, win: [0.02, 0.42] },
  { kind: 'card', fx: 0.5, fy: -0.3, rot: 20, dx: 46, win: [0.06, 0.46] },
  { kind: 'card', fx: -0.46, fy: 0.34, rot: -8, dx: -16, win: [0.1, 0.5] },
  { kind: 'card', fx: 0.46, fy: 0.34, rot: 8, dx: 16, win: [0.14, 0.52] },
  { kind: 'ring', fx: 0, fy: 0, rot: 0, win: [0.0, 0.46] },
  { kind: 'spark', fx: -0.4, fy: 0.12, rot: 0, dx: -70, win: [0.16, 0.44] },
  { kind: 'spark', fx: 0.42, fy: -0.14, rot: 0, dx: 74, win: [0.2, 0.48] },
  { kind: 'spark', fx: 0.1, fy: 0.4, rot: 0, dx: 8, win: [0.24, 0.5] },
];

export function SplashSequence({ onDone }: { onDone: () => void }) {
  const { width: W, height: H } = useWindowDimensions();
  const { lang } = useI18n();
  const { setIntroActive } = useAudio();
  const p = useRef(new Animated.Value(0)).current;

  /**
   * Hold the music back for as long as this overlay is up.
   *
   * This sequence has no audio of its own, and it is a SIBLING of <Stack> in
   * app/_layout.tsx rather than a screen inside it — so app/index.tsx is
   * mounted and focused underneath, its focus effect fires straight away, and
   * the menu bed used to start playing over an intro it was never scored for.
   *
   * Declared by the overlay itself rather than by the layout, because the
   * layout renders <AudioProvider> and so cannot consume it. Cleanup releases
   * the hold on unmount, which is the same moment `showIntro` flips false — so
   * the music starts exactly when the intro clears, however it ended.
   */
  useEffect(() => {
    setIntroActive(true);
    return () => setIntroActive(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const EMBLEM = useMemo(() => Math.min(216, W * 0.56), [W]);
  const PIECES: Piece[] = useMemo(
    () => PIECE_SPEC.map(({ fx, fy, ...rest }) => ({ ...rest, fromX: fx * W, fromY: fy * H })),
    [W, H]
  );
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };

  /**
   * Ask whether this device wants motion BEFORE starting, not after.
   *
   * AppBackground has always honoured reduce-motion; this screen never did, and
   * an intro is the single worst place to ignore it. It also matters for
   * diagnosis: Android's "animator duration scale" and battery saver both make
   * `Animated.timing` complete in zero time, which looks identical to a broken
   * animation — the whole thing snaps to its final frame. If the device has
   * asked for less motion, hold the finished frame for a beat and move on,
   * deliberately, instead of flashing it.
   *
   * The 250 ms fallback matters: if the accessibility query never settles, the
   * intro must still play rather than wait for ever on a promise.
   */
  useEffect(() => {
    let cancelled = false;
    let started = false;

    const begin = (reduced: boolean) => {
      if (cancelled || started) return;
      started = true;
      if (reduced) {
        p.setValue(1);
        setTimeout(finish, 700);
        return;
      }
      const anim = Animated.timing(p, {
        toValue: 1,
        duration: DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      animRef.current = anim;
      anim.start(({ finished }) => {
        if (finished) setTimeout(finish, 360);
      });
    };

    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => begin(!!v))
      .catch(() => begin(false));
    const fallback = setTimeout(() => begin(false), 250);

    return () => {
      cancelled = true;
      clearTimeout(fallback);
      animRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = () => {
    animRef.current?.stop();
    p.setValue(1);
    finish();
  };

  // helpers
  const range = (a: number, b: number, from: number, to: number) =>
    p.interpolate({ inputRange: [a, b], outputRange: [from, to], extrapolate: 'clamp' });

  // Emblem: blooms in as the pieces converge.
  const emblemOpacity = range(0.42, 0.6, 0, 1);
  const emblemScale = p.interpolate({
    inputRange: [0.42, 0.62, 1],
    outputRange: [0.72, 1.02, 1],
    extrapolate: 'clamp',
  });
  const haloScale = range(0.3, 0.7, 0.4, 1.15);
  const haloOpacity = p.interpolate({ inputRange: [0.3, 0.55, 1], outputRange: [0, 0.7, 0.5], extrapolate: 'clamp' });

  // Shimmer sweep across the emblem.
  const shimmerX = range(0.56, 0.82, -EMBLEM, EMBLEM);
  const shimmerOpacity = p.interpolate({ inputRange: [0.56, 0.6, 0.8, 0.84], outputRange: [0, 0.8, 0.8, 0], extrapolate: 'clamp' });

  // Title.
  const titleOpacity = range(0.66, 0.86, 0, 1);
  const titleY = range(0.66, 0.86, 16, 0);
  /**
   * The rule draws by SCALE, not by width.
   *
   * It used to be `width: ruleW`, animated off the same `p` that is started
   * with `useNativeDriver: true` — and the native driver can only animate
   * `transform` and `opacity`. Feeding a natively-driven value into a layout
   * property is the classic source of "Attempting to run JS driven animation on
   * an animated node that has been moved to native", which Android raises far
   * more readily than iOS. One rejected node takes the whole timeline with it,
   * and every other interpolation here hangs off `p` — so a three-pixel gold
   * line was enough to freeze the entire intro on one platform.
   */
  const ruleScale = range(0.72, 0.9, 0, 1);
  const tagOpacity = range(0.8, 0.96, 0, 1);

  return (
    <View style={styles.root} pointerEvents="box-none">
      <LinearGradient colors={gradients.night} style={StyleSheet.absoluteFill} />
      {/*
        Halo and converging pieces live in their OWN full-screen layer.

        They used to be children of the EMBLEM-sized stage box below — 216pt at
        most — while the pieces start at `fx * W` and `fy * H`, which is about
        ±196pt across and -273pt up on an ordinary phone. Every piece therefore
        spent almost its entire flight outside its parent's bounds. iOS draws
        children that overflow their parent; ANDROID CLIPS THEM. So on Android
        the assembly was invisible and the emblem simply appeared already built,
        which is exactly how it was reported. The halo, at EMBLEM * 1.3 inside an
        EMBLEM box, was being clipped on Android too — the gold glow was missing
        with it.

        This layer is the whole window, so nothing has to draw outside itself. It
        is nudged up by half of STAGE_DROP to sit on the EMBLEM's centre rather
        than the screen's, because the stage box below is EMBLEM + STAGE_DROP
        tall with the emblem at its top.
      */}
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.center,
          { transform: [{ translateY: -STAGE_DROP / 2 }] },
        ]}
        pointerEvents="none"
      >
        {/* gold halo */}
        <Animated.View
          style={[
            styles.halo,
            { width: EMBLEM * 1.3, height: EMBLEM * 1.3, borderRadius: EMBLEM, opacity: haloOpacity, transform: [{ scale: haloScale }] },
          ]}
        />

        {/* converging pieces */}
        {PIECES.map((pc, i) => {
          const [a, b] = pc.win;
          const tx = range(a, b, pc.fromX, pc.dx ?? 0);
          const ty = range(a, b, pc.fromY, 0);
          const rot = range(a, b, pc.rot * 2.2, pc.rot);
          const op =
            pc.kind === 'card'
              ? p.interpolate({ inputRange: [a, (a + b) / 2, 0.5, 0.62], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' })
              : p.interpolate({ inputRange: [a, (a + b) / 2, 0.48, 0.58], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' });
          const rotStr = rot.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] });
          const common = { opacity: op, transform: [{ translateX: tx }, { translateY: ty }, { rotate: rotStr }] } as any;
          if (pc.kind === 'card') {
            return (
              <Animated.View key={i} style={[styles.piece, common]}>
                <LinearGradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card} />
              </Animated.View>
            );
          }
          if (pc.kind === 'ring') {
            const rs = range(a, b, 1.7, 1);
            return (
              <Animated.View
                key={i}
                style={[styles.piece, { opacity: op, transform: [{ scale: rs }] }]}
              >
                <View style={[styles.ring, { width: EMBLEM * 0.94, height: EMBLEM * 0.94, borderRadius: EMBLEM }]} />
              </Animated.View>
            );
          }
          return (
            <Animated.View key={i} style={[styles.piece, styles.spark, common]} />
          );
        })}
      </View>

      <View style={[StyleSheet.absoluteFill, styles.center]}>
        {/* stage centred on the emblem */}
        <View style={{ width: EMBLEM, height: EMBLEM + STAGE_DROP, alignItems: 'center', justifyContent: 'flex-start' }}>
          <View style={{ width: EMBLEM, height: EMBLEM, alignItems: 'center', justifyContent: 'center' }}>
            {/* the real emblem + shimmer */}
            <Animated.View style={{ position: 'absolute', opacity: emblemOpacity, transform: [{ scale: emblemScale }] }}>
              <View style={{ width: EMBLEM, height: EMBLEM, borderRadius: EMBLEM * 0.22, overflow: 'hidden' }}>
                <Image source={require('../../assets/icon.png')} style={{ width: EMBLEM, height: EMBLEM }} resizeMode="cover" />
                <Animated.View style={[styles.shimmer, { height: EMBLEM * 1.6, opacity: shimmerOpacity, transform: [{ translateX: shimmerX }, { rotate: '20deg' }] }]}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0)', 'rgba(255,246,214,0.85)', 'rgba(255,255,255,0)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ flex: 1 }}
                  />
                </Animated.View>
              </View>
            </Animated.View>
          </View>

          {/* wordmark */}
          <Animated.Text style={[styles.title, { opacity: titleOpacity, transform: [{ translateY: titleY }] }]}>
            Coplas
          </Animated.Text>
          <Animated.View style={[styles.rule, { transform: [{ scaleX: ruleScale }] }]} />
          <Animated.Text style={[styles.tag, { opacity: tagOpacity }]}>CARTAS · CONEXIONES</Animated.Text>
        </View>
      </View>

      {/* skip */}
      <Pressable onPress={skip} hitSlop={14} style={styles.skip}>
        <Text style={styles.skipText}>{lang === 'es' ? 'Saltar ›' : 'Skip ›'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, elevation: 100, backgroundColor: colors.bgDeep },
  center: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', backgroundColor: 'rgba(244,185,66,0.18)' },
  piece: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  card: { width: 62, height: 88, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,240,200,0.5)' },
  ring: { borderWidth: 6, borderColor: colors.accent, backgroundColor: 'transparent' },
  spark: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FCE9A8' },
  shimmer: { position: 'absolute', top: '-30%', width: 46 },
  title: {
    color: colors.accent,
    fontFamily: displayFont,
    fontSize: 54,
    fontWeight: '700',
    marginTop: 18,
    textShadowColor: 'rgba(244,185,66,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 22,
  },
  rule: { width: 118, height: 3, borderRadius: 2, backgroundColor: colors.accent, marginTop: 10, opacity: 0.85 },
  tag: { color: colors.text, fontFamily: monoFont, fontSize: 12, letterSpacing: 4, marginTop: 12 },
  skip: { position: 'absolute', top: 46, right: 22, paddingHorizontal: 8, paddingVertical: 4 },
  skipText: { color: colors.textDim, fontSize: 15, fontWeight: '700' },
});
