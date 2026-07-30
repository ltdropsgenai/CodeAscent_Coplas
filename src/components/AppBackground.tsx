/**
 * AppBackground — the CodeAscent house background, tuned for Coplas.
 *
 * Matches the design language of the other CodeAscent apps (e.g. Lexicon):
 *   1. A single full-bleed photoreal scene per screen — NOT a cross-fading
 *      slideshow. The scene is picked deterministically from the route, so it
 *      stays stable while you're on a screen and only changes when you
 *      navigate. (The old rotating "reel" cycled images on a timer — gone.)
 *   2. Gentle Ken Burns motion (slow zoom + drift), ping-pong looped.
 *   3. Soft marigold + white "bokeh" motes drifting slowly upward, so content
 *      feels like it floats on a living backdrop.
 *   4. A three-band vignette scrim for text legibility.
 *   5. A subtle Coplas motif (drifting frijol markers) over the top.
 *   6. A solid dark base always behind (never blank), reduce-motion honoured,
 *      and the whole thing wrapped in an error boundary that falls back to the
 *      safe base if anything throws.
 *
 * Rendered ONCE in app/_layout.tsx, behind everything.
 */
import React, { Component, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname } from 'expo-router';
import { colors, gradients } from '../theme';
import { SCENES } from '../data/sceneImages';
import { CoplasMotif } from './CoplasMotif';

const BASE_COLOR = colors.bgDeep;
const KB_DURATION = 14000; // one direction of the ping-pong

// Session seed so the scene-per-route mapping feels fresh each cold start.
const SESSION_SEED = Math.floor(Math.random() * 0x7fffffff);

/** Deterministic scene index for a given route path. Stable within a session. */
function sceneIndexFor(path: string): number {
  if (!SCENES.length) return 0;
  let h = SESSION_SEED;
  for (let i = 0; i < path.length; i++) h = (h * 31 + path.charCodeAt(i)) >>> 0;
  return h % SCENES.length;
}

const { height: SCREEN_H } = Dimensions.get('window');

// Soft floating motes — marigold + warm white, very low opacity, drift upward.
const BOKEH = [
  { size: 130, left: '8%', startY: SCREEN_H + 60, color: 'rgba(244,185,66,0.06)', dur: 39000 },
  { size: 78, left: '52%', startY: SCREEN_H + 40, color: 'rgba(255,255,255,0.05)', dur: 43000 },
  { size: 150, left: '74%', startY: SCREEN_H + 90, color: 'rgba(244,185,66,0.05)', dur: 36000 },
  { size: 58, left: '30%', startY: SCREEN_H + 30, color: 'rgba(255,240,214,0.06)', dur: 46000 },
  { size: 104, left: '86%', startY: SCREEN_H + 50, color: 'rgba(228,71,155,0.045)', dur: 41000 },
];

function AppBackgroundInner() {
  const pathname = usePathname();
  const targetIdx = useMemo(() => sceneIndexFor(pathname || '/'), [pathname]);

  const has = SCENES.length > 0;
  const [idx, setIdx] = useState(targetIdx);
  const [failed, setFailed] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const fade = useRef(new Animated.Value(1)).current; // scene opacity
  const kb = useRef(new Animated.Value(0)).current;
  const bokeh = useRef(BOKEH.map(() => new Animated.Value(0))).current;

  // Respect the OS "reduce motion" setting.
  useEffect(() => {
    let on = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => on && setReduceMotion(v))
      .catch(() => {});
    return () => {
      on = false;
    };
  }, []);

  // Cross-fade ONLY when the route (and thus the scene) actually changes.
  useEffect(() => {
    if (targetIdx === idx) return;
    Animated.timing(fade, { toValue: 0, duration: 320, useNativeDriver: true }).start(() => {
      setIdx(targetIdx);
      Animated.timing(fade, { toValue: 1, duration: 520, useNativeDriver: true }).start();
    });
  }, [targetIdx, idx, fade]);

  // Ken Burns ping-pong.
  useEffect(() => {
    if (reduceMotion || failed || !has) return;
    const ease = Easing.inOut(Easing.ease);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(kb, { toValue: 1, duration: KB_DURATION, easing: ease, useNativeDriver: true }),
        Animated.timing(kb, { toValue: 0, duration: KB_DURATION, easing: ease, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, failed, has, kb]);

  // Bokeh drift.
  useEffect(() => {
    if (reduceMotion || failed || !has) return;
    const loops = bokeh.map((a, i) =>
      Animated.loop(
        Animated.timing(a, { toValue: 1, duration: BOKEH[i].dur, easing: Easing.linear, useNativeDriver: true })
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [reduceMotion, failed, has, bokeh]);

  const scale = reduceMotion ? 1.04 : kb.interpolate({ inputRange: [0, 1], outputRange: [1.03, 1.22] });
  const tx = reduceMotion ? 0 : kb.interpolate({ inputRange: [0, 1], outputRange: [0, -40] });
  const ty = reduceMotion ? 0 : kb.interpolate({ inputRange: [0, 1], outputRange: [0, -26] });

  const scene = has ? SCENES[idx % SCENES.length] : undefined;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* 1. Solid base — never blank. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: BASE_COLOR }]} />
      <LinearGradient colors={gradients.night} style={StyleSheet.absoluteFill} />

      {/* 2. Single scene with Ken Burns. */}
      {scene && !failed && (
        <Animated.Image
          source={typeof scene === 'string' ? { uri: scene } : scene}
          resizeMode="cover"
          onError={() => setFailed(true)}
          style={[StyleSheet.absoluteFill, { opacity: fade, transform: [{ scale }, { translateX: tx }, { translateY: ty }] }]}
        />
      )}

      {/* 3. Bokeh motes drifting up. */}
      {!reduceMotion &&
        !failed &&
        has &&
        BOKEH.map((b, i) => {
          const translateY = bokeh[i].interpolate({ inputRange: [0, 1], outputRange: [b.startY, -b.size * 2] });
          return (
            <Animated.View
              key={i}
              style={{
                position: 'absolute',
                left: b.left as any,
                width: b.size,
                height: b.size,
                borderRadius: 999,
                backgroundColor: b.color,
                transform: [{ translateY }],
              }}
            />
          );
        })}

      {/* 4. Three-band vignette for legibility (darker top & bottom). */}
      <LinearGradient
        colors={[colors.scrimTop, 'rgba(8,6,16,0.30)']}
        locations={[0, 1]}
        style={[StyleSheet.absoluteFill, { bottom: '72%' }]}
      />
      <View style={[StyleSheet.absoluteFill, { top: '28%', bottom: '32%', backgroundColor: 'rgba(8,6,16,0.30)' }]} />
      <LinearGradient
        colors={['rgba(8,6,16,0.30)', colors.scrimBottom]}
        locations={[0, 1]}
        style={[StyleSheet.absoluteFill, { top: '68%' }]}
      />

      {/* 5. Subtle Coplas motif — drifting frijol markers + gold sparkles. */}
      <CoplasMotif />
    </View>
  );
}

// ── Error boundary: any failure → just the safe dark base ──────────
class BackgroundBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(e: Error) {
    console.warn('[AppBackground] boundary caught:', e.message);
  }
  render() {
    if (this.state.hasError) {
      return <View style={[StyleSheet.absoluteFill, { backgroundColor: BASE_COLOR }]} pointerEvents="none" />;
    }
    return this.props.children;
  }
}

export function AppBackground() {
  return (
    <BackgroundBoundary>
      <AppBackgroundInner />
    </BackgroundBoundary>
  );
}

/** Back-compat alias — the layout previously imported ScenicBackground. */
export const ScenicBackground = AppBackground;
