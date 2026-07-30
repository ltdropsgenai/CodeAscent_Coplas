import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Group } from '../types';
import { colors, gradients, radius, tierColors } from '../theme';
import { getCard } from '../data/cards';
import { cardImage } from '../data/cardImages';
import { hasCardVideo } from '../data/cardVideos';
import { CardVideo } from './CardVideo';

interface Props {
  /** The four solved groups (16 cards) to celebrate. */
  groups: Group[];
  /** Called when the sequence finishes (or the player taps to skip). */
  onDone: () => void;
}

// Warm, ember-biased palette — real fireworks are mostly golds/whites with a
// few colour pops, which reads far less "cartoon" than flat rainbow dots.
const FW_COLORS = ['#FFE7A6', '#FFC24D', '#FF9A3D', '#FF6B3D', '#FFD46B', '#FFF3D0', '#8FE3FF', '#B6FFC0'];
const CONFETTI_COLORS = [colors.accent, colors.magenta, colors.teal, colors.violet, '#FCE38A'];
const SPARKS = 20;
const AUTO_MS = 3600; // sequence length before it settles on its own
/**
 * Cap on how many tiles play their animated clip at once. Each clip is ~1.4 MB
 * and spins up its own player, so this bounds both mobile data and decode load;
 * the remaining tiles show their still art, which is identical until motion.
 */
const MAX_ANIMATED_TILES = 8;

/**
 * Round-clear celebration. The 16 solved cards cascade back onto a darkened
 * stage while realistic fireworks burst overhead — each a bright core flash +
 * shockwave ring throwing a spray of glowing ember streaks that arc under
 * gravity and twinkle out — with confetti and the mariachi fanfare. It then
 * settles (fades) and calls `onDone`, revealing the "¡Resuelto!" panel below.
 * Tap to skip. Purely presentational; a card with no art shows its glyph.
 */
export function WinCelebration({ groups, onDone }: Props) {
  const { width, height } = useWindowDimensions();
  const W = Math.min(width, 480);

  const cards = useMemo(
    () => groups.flatMap((g) => g.cardIds.map((id) => ({ id, tier: g.tier }))),
    [groups]
  );

  // Which of these cards animate: the first few that actually have a clip.
  // Everything else falls back to its still image.
  const animated = useMemo(() => {
    const pick = new Set<string>();
    for (const c of cards) {
      if (pick.size >= MAX_ANIMATED_TILES) break;
      if (hasCardVideo(c.id)) pick.add(c.id);
    }
    return pick;
  }, [cards]);

  const overlay = useRef(new Animated.Value(1)).current;
  const enters = useMemo(() => cards.map(() => new Animated.Value(0)), [cards]);

  // Firework bursts — staggered in time and position across the upper stage.
  const bursts = useMemo(() => {
    const layout = [
      { cx: 0.5, cy: 0.26, delay: 120 },
      { cx: 0.24, cy: 0.19, delay: 470 },
      { cx: 0.76, cy: 0.21, delay: 820 },
      { cx: 0.5, cy: 0.13, delay: 1180 },
      { cx: 0.33, cy: 0.31, delay: 1620 },
      { cx: 0.67, cy: 0.29, delay: 2040 },
    ];
    return layout.map((b, bi) => {
      const g = 64 + Math.random() * 26; // gravity pull for this burst
      return {
        ...b,
        v: new Animated.Value(0),
        parts: Array.from({ length: SPARKS }, (_, i) => {
          const ang = (i / SPARKS) * Math.PI * 2 + bi * 0.35 + Math.random() * 0.12;
          const speed = 52 + Math.random() * 58;
          const len = 9 + Math.random() * 9;
          const w = 2 + Math.random() * 1.3;
          return {
            dx: Math.cos(ang) * speed,
            dy: Math.sin(ang) * speed,
            g,
            len,
            w,
            deg: (ang * 180) / Math.PI - 90, // align the streak along its flight
            color: FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)],
          };
        }),
      };
    });
  }, []);

  const confetti = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        x: Math.random(),
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: Math.random() * 700,
        drift: (Math.random() * 2 - 1) * 70,
        spins: Math.random() * 2 - 1,
        size: 6 + Math.random() * 8,
        v: new Animated.Value(0),
      })),
    []
  );

  const doneRef = useRef(false);
  function finish(fast = false) {
    if (doneRef.current) return;
    doneRef.current = true;
    Animated.timing(overlay, {
      toValue: 0,
      duration: fast ? 220 : 520,
      useNativeDriver: true,
    }).start(() => onDone());
  }

  useEffect(() => {
    Animated.stagger(
      66,
      enters.map((v) =>
        Animated.spring(v, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true })
      )
    ).start();
    bursts.forEach((b) => {
      Animated.sequence([
        Animated.delay(b.delay),
        Animated.timing(b.v, {
          toValue: 1,
          duration: 1150,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    });
    confetti.forEach((c) => {
      Animated.sequence([
        Animated.delay(c.delay),
        Animated.timing(c.v, {
          toValue: 1,
          duration: 2500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]).start();
    });
    const timer = setTimeout(() => finish(false), AUTO_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cols = 4;
  const gap = 8;
  const cardW = (W - 48 - gap * (cols - 1)) / cols;
  const cardH = cardW / 0.7467; // the art's own ratio, so nothing is cropped

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: overlay }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => finish(true)}>
        {/* Fireworks */}
        {bursts.map((b, bi) => (
          <View
            key={`fw-${bi}`}
            pointerEvents="none"
            style={[styles.burst, { left: b.cx * W, top: b.cy * height }]}
          >
            {/* expanding shockwave ring */}
            <Animated.View
              style={[
                styles.ring,
                {
                  opacity: b.v.interpolate({ inputRange: [0, 0.05, 0.32], outputRange: [0, 0.55, 0] }),
                  transform: [
                    { scale: b.v.interpolate({ inputRange: [0, 0.36], outputRange: [0.1, 3.2] }) },
                  ],
                },
              ]}
            />
            {/* bright core flash */}
            <Animated.View
              style={[
                styles.flash,
                {
                  opacity: b.v.interpolate({ inputRange: [0, 0.09, 0.34], outputRange: [0, 1, 0] }),
                  transform: [
                    { scale: b.v.interpolate({ inputRange: [0, 0.34], outputRange: [0.2, 2.1] }) },
                  ],
                },
              ]}
            />
            {/* ember streaks */}
            {b.parts.map((p, pi) => (
              <Animated.View
                key={pi}
                style={{
                  position: 'absolute',
                  width: p.w,
                  height: p.len,
                  marginLeft: -p.w / 2,
                  marginTop: -p.len / 2,
                  borderRadius: p.w,
                  backgroundColor: p.color,
                  shadowColor: p.color,
                  shadowOpacity: 0.95,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 0 },
                  opacity: b.v.interpolate({
                    inputRange: [0, 0.08, 0.55, 0.66, 0.74, 0.82, 0.9, 1],
                    outputRange: [0, 1, 1, 0.5, 1, 0.4, 0.85, 0],
                  }),
                  transform: [
                    { translateX: b.v.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
                    {
                      translateY: b.v.interpolate({
                        inputRange: [0, 0.6, 1],
                        outputRange: [0, p.dy + p.g * 0.36, p.dy + p.g],
                      }),
                    },
                    { rotate: `${p.deg}deg` },
                    { scaleY: b.v.interpolate({ inputRange: [0, 0.14, 1], outputRange: [0.35, 1, 0.4] }) },
                  ],
                }}
              />
            ))}
          </View>
        ))}

        {/* Confetti */}
        {confetti.map((c, i) => {
          const translateY = c.v.interpolate({ inputRange: [0, 1], outputRange: [-30, height + 40] });
          const translateX = c.v.interpolate({ inputRange: [0, 1], outputRange: [0, c.drift] });
          const rotate = c.v.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', `${Math.round(c.spins * 720)}deg`],
          });
          const opacity = c.v.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] });
          return (
            <Animated.View
              key={`cf-${i}`}
              pointerEvents="none"
              style={[
                styles.confetti,
                {
                  left: c.x * W,
                  width: c.size,
                  height: c.size * 0.6,
                  backgroundColor: c.color,
                  opacity,
                  transform: [{ translateY }, { translateX }, { rotate }],
                },
              ]}
            />
          );
        })}

        {/* The cards, cascading back in */}
        <View style={styles.center} pointerEvents="none">
          <View style={[styles.grid, { width: cardW * cols + gap * (cols - 1) }]}>
            {cards.map((c, i) => {
              const img = cardImage(c.id);
              const v = enters[i];
              return (
                <Animated.View
                  key={`${c.id}-${i}`}
                  style={{
                    width: cardW,
                    height: cardH,
                    opacity: v,
                    transform: [
                      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) },
                      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
                    ],
                  }}
                >
                  {animated.has(c.id) ? (
                    <CardVideo
                      cardId={c.id}
                      borderColor={tierColors[c.tier]}
                      cornerRadius={radius.tile}
                    />
                  ) : (
                    <View style={[styles.cardFrame, { borderColor: tierColors[c.tier] }]}>
                      {img != null ? (
                        <Image
                          source={typeof img === 'string' ? { uri: img } : (img as number)}
                          style={styles.cardImg}
                          resizeMode="cover"
                        />
                      ) : (
                        <LinearGradient colors={gradients.cardFace} style={styles.cardImg}>
                          <Text style={styles.cardGlyph} allowFontScaling={false}>
                            {getCard(c.id).emoji ?? '🂠'}
                          </Text>
                        </LinearGradient>
                      )}
                    </View>
                  )}
                </Animated.View>
              );
            })}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: 'rgba(6,4,14,0.94)', alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  burst: { position: 'absolute', width: 0, height: 0 },
  ring: {
    position: 'absolute',
    width: 40,
    height: 40,
    marginLeft: -20,
    marginTop: -20,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,240,200,0.9)',
  },
  flash: {
    position: 'absolute',
    width: 22,
    height: 22,
    marginLeft: -11,
    marginTop: -11,
    borderRadius: 11,
    backgroundColor: '#FFF7E0',
    shadowColor: '#FFE7A6',
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  confetti: { position: 'absolute', top: 0, borderRadius: 2 },
  center: { alignItems: 'center', paddingHorizontal: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  cardFrame: {
    flex: 1,
    borderRadius: radius.tile,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSolid,
  },
  cardImg: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardGlyph: { fontSize: 26 },
});
