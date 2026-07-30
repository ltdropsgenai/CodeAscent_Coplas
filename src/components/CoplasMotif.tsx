/**
 * CoplasMotif — the subtle, on-brand decorative layer, in the spirit of the
 * other CodeAscent apps' motifs (Lexicon's drifting gears, Lexishuffle's
 * letter tiles, the Python app's CRT grid).
 *
 * For a Lotería game the natural motif is the *frijol* — the dried beans
 * players drop on their cards to mark them. A handful of beans (plus a couple
 * of gold sparkles) drift slowly upward in staggered depth layers, kept to the
 * edges so they never crowd the board. Reduce-motion → faint & static. Pure RN
 * views, offline, pointer-transparent.
 */
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// NOTE: window size is read per-component via `useWindowDimensions`, never once
// at module load. `Dimensions.get('window')` at module scope freezes the value
// captured when the bundle first evaluates, so on an iPad in Split View or
// Stage Manager every bean would drift and sit relative to a window that no
// longer exists. Each bean's x position and travel distance are derived from
// the live size below; the Animated.Value driving it stays in a ref, so a
// resize repositions without restarting the loop.

type Bean = { xF: number; size: number; rot: number; op: number; dur: number; delay: number; drift: number };

// Edge-weighted so the centre board stays clear.
const BEANS: Bean[] = [
  { xF: 0.04, size: 26, rot: -18, op: 0.14, dur: 26000, delay: 0, drift: 22 },
  { xF: 0.9, size: 30, rot: 22, op: 0.12, dur: 30000, delay: 4000, drift: -20 },
  { xF: 0.12, size: 20, rot: 40, op: 0.1, dur: 24000, delay: 8000, drift: 16 },
  { xF: 0.84, size: 22, rot: -30, op: 0.11, dur: 28000, delay: 2000, drift: -18 },
  { xF: 0.5, size: 18, rot: 10, op: 0.08, dur: 32000, delay: 11000, drift: 12 },
  { xF: 0.72, size: 16, rot: -12, op: 0.09, dur: 27000, delay: 6000, drift: -14 },
  { xF: 0.22, size: 15, rot: 26, op: 0.08, dur: 31000, delay: 14000, drift: 14 },
];

// Gold four-point sparkles (a couple only).
const SPARKS = [
  { xF: 0.16, size: 10, op: 0.16, dur: 34000, delay: 3000 },
  { xF: 0.8, size: 8, op: 0.14, dur: 38000, delay: 9000 },
];

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let on = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => on && setReduce(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => on && setReduce(!!v));
    return () => {
      on = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}

function Bean({ b, reduce }: { b: Bean; reduce: boolean }) {
  const { width: W, height: H } = useWindowDimensions();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.timing(t, { toValue: 1, duration: b.dur, delay: b.delay, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [t, b, reduce]);

  const translateY = reduce ? 0 : t.interpolate({ inputRange: [0, 1], outputRange: [H + b.size, -b.size * 2] });
  const translateX = reduce ? 0 : t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, b.drift, 0] });
  const left = Math.round(b.xF * W);
  const top = reduce ? Math.round((1 - b.xF) * H * 0.7) + 60 : 0;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left,
        top,
        opacity: reduce ? b.op * 0.6 : b.op,
        transform: reduce ? [{ rotate: `${b.rot}deg` }] : [{ translateY }, { translateX }, { rotate: `${b.rot}deg` }],
      }}
    >
      {/* Frijol: an oval with a warm gradient + a faint seam highlight. */}
      <LinearGradient
        colors={['#8a5a34', '#4a2c17']}
        start={{ x: 0.2, y: 0.1 }}
        end={{ x: 0.9, y: 1 }}
        style={{ width: b.size, height: Math.round(b.size * 0.62), borderRadius: b.size }}
      >
        <View
          style={{
            position: 'absolute',
            left: '22%',
            top: '30%',
            width: '56%',
            height: 1.5,
            borderRadius: 1,
            backgroundColor: 'rgba(255,225,180,0.5)',
            transform: [{ rotate: '8deg' }],
          }}
        />
      </LinearGradient>
    </Animated.View>
  );
}

function Spark({ s, reduce }: { s: (typeof SPARKS)[number]; reduce: boolean }) {
  const { width: W, height: H } = useWindowDimensions();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.timing(t, { toValue: 1, duration: s.dur, delay: s.delay, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [t, s, reduce]);

  const translateY = reduce ? 0 : t.interpolate({ inputRange: [0, 1], outputRange: [H, -s.size * 2] });
  const twinkle = reduce ? s.op * 0.6 : t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [s.op * 0.3, s.op, s.op * 0.3] });
  const left = Math.round(s.xF * W);

  // A 4-point star = two crossed thin gold bars.
  const bar = (rot: string) => (
    <View style={{ position: 'absolute', left: s.size * 0.4, top: 0, width: s.size * 0.2, height: s.size * 2, borderRadius: s.size, backgroundColor: '#F4B942', transform: [{ rotate: rot }] }} />
  );

  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', left, top: reduce ? Math.round((1 - s.xF) * H * 0.6) + 40 : 0, width: s.size, height: s.size * 2, opacity: twinkle, transform: reduce ? [] : [{ translateY }] }}
    >
      {bar('0deg')}
      {bar('90deg')}
    </Animated.View>
  );
}

export function CoplasMotif() {
  const reduce = useReduceMotion();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {BEANS.map((b, i) => (
        <Bean key={`b${i}`} b={b} reduce={reduce} />
      ))}
      {SPARKS.map((s, i) => (
        <Spark key={`s${i}`} s={s} reduce={reduce} />
      ))}
    </View>
  );
}
