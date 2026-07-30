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
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, displayFont, monoFont, gradients } from '../theme';
import { useI18n } from '../i18n';

const { width: W, height: H } = Dimensions.get('window');
const DURATION = 2600;
const EMBLEM = Math.min(216, W * 0.56);

type Piece = {
  kind: 'card' | 'ring' | 'spark';
  fromX: number;
  fromY: number;
  rot: number; // final rotation (deg)
  win: [number, number]; // enter window within [0,1]
  dx?: number; // final offset from centre
};

// Four cards fan slightly around centre; a ring settles concentric; sparks streak.
const PIECES: Piece[] = [
  { kind: 'card', fromX: -W * 0.5, fromY: -H * 0.32, rot: -20, dx: -46, win: [0.02, 0.42] },
  { kind: 'card', fromX: W * 0.5, fromY: -H * 0.3, rot: 20, dx: 46, win: [0.06, 0.46] },
  { kind: 'card', fromX: -W * 0.46, fromY: H * 0.34, rot: -8, dx: -16, win: [0.1, 0.5] },
  { kind: 'card', fromX: W * 0.46, fromY: H * 0.34, rot: 8, dx: 16, win: [0.14, 0.52] },
  { kind: 'ring', fromX: 0, fromY: 0, rot: 0, win: [0.0, 0.46] },
  { kind: 'spark', fromX: -W * 0.4, fromY: H * 0.12, rot: 0, dx: -70, win: [0.16, 0.44] },
  { kind: 'spark', fromX: W * 0.42, fromY: -H * 0.14, rot: 0, dx: 74, win: [0.2, 0.48] },
  { kind: 'spark', fromX: W * 0.1, fromY: H * 0.4, rot: 0, dx: 8, win: [0.24, 0.5] },
];

export function SplashSequence({ onDone }: { onDone: () => void }) {
  const { lang } = useI18n();
  const p = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };

  useEffect(() => {
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
    return () => anim.stop();
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
  const ruleW = range(0.72, 0.9, 0, 118);
  const tagOpacity = range(0.8, 0.96, 0, 1);

  return (
    <View style={styles.root} pointerEvents="box-none">
      <LinearGradient colors={gradients.night} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        {/* stage centred on the emblem */}
        <View style={{ width: EMBLEM, height: EMBLEM + 130, alignItems: 'center', justifyContent: 'flex-start' }}>
          <View style={{ width: EMBLEM, height: EMBLEM, alignItems: 'center', justifyContent: 'center' }}>
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
          <Animated.View style={[styles.rule, { width: ruleW }]} />
          <Animated.Text style={[styles.tag, { opacity: tagOpacity }]}>LOTERÍA · CONEXIONES</Animated.Text>
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
  rule: { height: 3, borderRadius: 2, backgroundColor: colors.accent, marginTop: 10, opacity: 0.85 },
  tag: { color: colors.text, fontFamily: monoFont, fontSize: 12, letterSpacing: 4, marginTop: 12 },
  skip: { position: 'absolute', top: 46, right: 22, paddingHorizontal: 8, paddingVertical: 4 },
  skipText: { color: colors.textDim, fontSize: 15, fontWeight: '700' },
});
