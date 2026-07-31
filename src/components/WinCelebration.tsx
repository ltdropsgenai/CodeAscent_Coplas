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
import { CARD_ASPECT, colors, gradients, radius, tierColors } from '../theme';
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

/**
 * A shell burns ONE metal salt, so a real burst is a single colour with a
 * white-hot core that cools to an ember as it falls. Letting every spark pick
 * its own colour from a rainbow — which is what this did — is the single
 * biggest reason a particle firework reads as cartoon. Gold and white shells
 * dominate a real display; the colour pops are occasional, so they sit at the
 * end of the list and are weighted out.
 */
const SHELLS = [
  { core: '#FFF8E2', ember: '#FFC24D' }, // gold
  { core: '#FFFFFF', ember: '#FFD46B' }, // silver-gold
  { core: '#FFF1DE', ember: '#FF8A3D' }, // amber
  { core: '#FFF8E2', ember: '#FFB03A' }, // deep gold
  { core: '#FFE9F0', ember: '#FF5E86' }, // rose
  { core: '#EAF6FF', ember: '#6FC4FF' }, // blue
];
/** Weighted so warm shells are the norm and colour is the exception. */
const SHELL_PICK = [0, 1, 2, 0, 3, 1, 0, 4, 2, 1, 5, 0];

// Confetti tuned down to warm foil only. Magenta/teal/violet rectangles were
// doing more "party popper" than "fireworks".
const CONFETTI_COLORS = ['#FFD46B', '#FFC24D', '#FFE7A6', '#E8B54A'];
/** Sparks per shell, split across two concentric layers. */
const SPARKS = 40;
const AUTO_MS = 3900; // sequence length before it settles on its own
/** How long the shell takes to climb to its burst point. */
const LAUNCH_MS = 420;
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
      const shell = SHELLS[SHELL_PICK[(bi * 5 + Math.floor(Math.random() * 3)) % SHELL_PICK.length]];
      const size = 0.82 + Math.random() * 0.45; // shells are not all the same calibre
      return {
        ...b,
        shell,
        v: new Animated.Value(0),
        launch: new Animated.Value(0),
        parts: Array.from({ length: SPARKS }, (_, i) => {
          // Two concentric layers: a fast outer ring and a slower inner one.
          // A single ring of evenly spaced dots looks like a clock face.
          const outer = i % 2 === 0;
          const n = SPARKS / 2;
          const ang =
            ((i >> 1) / n) * Math.PI * 2 + (outer ? 0 : Math.PI / n) + bi * 0.35 + Math.random() * 0.3;
          const speed = (outer ? 74 : 44) * size * (0.8 + Math.random() * 0.45);
          // A few sparks per shell burn long and heavy — the "willow" tails
          // that keep falling after the rest have gone out.
          const willow = Math.random() < 0.18;
          return {
            dx: Math.cos(ang) * speed,
            dy: Math.sin(ang) * speed,
            g: willow ? g * 1.9 : g,
            len: (willow ? 16 : 9) + Math.random() * 9,
            w: 1.6 + Math.random() * 1.4,
            deg: (ang * 180) / Math.PI - 90, // align the streak along its flight
            // Core-hot on the inside of the burst, ember on the outside, so a
            // shell cools outward the way a real one does.
            color: Math.random() < (outer ? 0.25 : 0.6) ? shell.core : shell.ember,
            // Per-spark twinkle phase. Sharing one curve made all 20 sparks
            // blink in unison, which is the other big cartoon tell.
            phase: Math.random(),
            life: willow ? 1 : 0.72 + Math.random() * 0.28,
            // Only some sparks carry a shadow glow. On iOS every shadowed view
            // is an offscreen render pass, and 240 of them will drop frames on
            // anything but the newest phone; on Android shadowRadius does
            // nothing at all. The long willow tails and a scattering of others
            // get the glow, the rest rely on the core flash lighting the sky.
            glow: willow || Math.random() < 0.2,
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
      // The shell has to arrive before it can explode. Without the rising
      // trail a burst just materialises out of nothing, which no real firework
      // does and the eye notices immediately.
      Animated.sequence([
        Animated.delay(Math.max(0, b.delay - LAUNCH_MS)),
        Animated.timing(b.launch, {
          toValue: 1,
          duration: LAUNCH_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
      Animated.sequence([
        Animated.delay(b.delay),
        Animated.timing(b.v, {
          toValue: 1,
          duration: 1450,
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
  const cardH = cardW / CARD_ASPECT; // the art's own ratio, so nothing is cropped

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
            {/* the shell climbing to its burst point */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.launch,
                {
                  backgroundColor: b.shell.ember,
                  shadowColor: b.shell.ember,
                  opacity: b.launch.interpolate({
                    inputRange: [0, 0.12, 0.86, 1],
                    outputRange: [0, 0.85, 0.6, 0],
                  }),
                  transform: [
                    {
                      translateY: b.launch.interpolate({
                        inputRange: [0, 1],
                        outputRange: [height * 0.4, 0],
                      }),
                    },
                    {
                      scaleY: b.launch.interpolate({
                        inputRange: [0, 0.55, 1],
                        outputRange: [0.45, 1, 0.3],
                      }),
                    },
                  ],
                },
              ]}
            />
            {/* expanding shockwave ring */}
            <Animated.View
              style={[
                styles.ring,
                {
                  borderColor: b.shell.core,
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
                  backgroundColor: b.shell.core,
                  shadowColor: b.shell.core,
                  opacity: b.v.interpolate({ inputRange: [0, 0.09, 0.34], outputRange: [0, 1, 0] }),
                  transform: [
                    { scale: b.v.interpolate({ inputRange: [0, 0.34], outputRange: [0.2, 2.1] }) },
                  ],
                },
              ]}
            />
            {/* ember streaks */}
            {b.parts.map((p, pi) => {
              // Twinkle breakpoints are scaled by this spark's own lifetime and
              // nudged by its phase, so the shell dies out raggedly instead of
              // every ember blinking on the same frame.
              const L = p.life;
              const f = p.phase * 0.05;
              return (
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
                    ...(p.glow
                      ? {
                          shadowColor: p.color,
                          shadowOpacity: 0.95,
                          shadowRadius: 5,
                          shadowOffset: { width: 0, height: 0 },
                        }
                      : null),
                    opacity: b.v.interpolate({
                      inputRange: [
                        0,
                        0.05 * L,
                        (0.45 + f) * L,
                        (0.55 + f) * L,
                        (0.65 + f) * L,
                        (0.78 + f) * L,
                        0.92 * L,
                        L,
                      ],
                      outputRange: [0, 1, 1, 0.4, 1, 0.45, 0.8, 0],
                      extrapolate: 'clamp',
                    }),
                    transform: [
                      {
                        // Air drag: sparks fly out fast and coast to a stop.
                        // A linear 0→dx made them look like they were on rails.
                        translateX: b.v.interpolate({
                          inputRange: [0, 0.3, 1],
                          outputRange: [0, p.dx * 0.68, p.dx],
                        }),
                      },
                      {
                        translateY: b.v.interpolate({
                          inputRange: [0, 0.3, 0.6, 1],
                          outputRange: [0, p.dy * 0.68, p.dy + p.g * 0.36, p.dy + p.g],
                        }),
                      },
                      { rotate: `${p.deg}deg` },
                      {
                        // Stretched into a comet at the moment of the burst,
                        // shortening to a point as it burns down.
                        scaleY: b.v.interpolate({
                          inputRange: [0, 0.1, 0.4, 1],
                          outputRange: [0.3, 1.35, 1, 0.45],
                        }),
                      },
                    ],
                  }}
                />
              );
            })}
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
  // The rising shell: a short bright streak that climbs to the burst point.
  launch: {
    position: 'absolute',
    width: 2.5,
    height: 56,
    marginLeft: -1.25,
    marginTop: -28,
    borderRadius: 2,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
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
