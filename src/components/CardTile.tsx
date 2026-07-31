import { memo, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Card } from '../types';
import { CARD_ASPECT, CARD_NAME_BAND, colors, displayFont, gradients, radius } from '../theme';
import { cardImage } from '../data/cardImages';

interface Props {
  card: Card;
  selected: boolean;
  /** Highlighted by a hint (pulsing teal ring). */
  hinted?: boolean;
  disabled?: boolean;
  onPress: (id: string) => void;
}

/**
 * A Lotería card: gold double-frame, a photo area (bundled image or remote
 * URL when registered in cardImages, else the emoji glyph), and a numbered
 * medallion. Selecting it lifts and lights the frame gold; a hint wraps it in
 * a pulsing teal ring.
 *
 * THE NAME. Every card has its Spanish name printed into the art on a torn-paper
 * label. That reads beautifully at full size and is unreadable on the board: a
 * tile here is ~94 pt wide, which renders the printed lettering at roughly
 * 4.7 pt. So we draw our own parchment plate over that exact band
 * (`CARD_NAME_BAND`) and set the name in the display face at 11 pt — about
 * 2.3× larger. It is positioned to cover the printed label completely rather
 * than sit beside it, so the name never appears twice, and it grows upward to a
 * second line for the ~15% of names too long for one (only 8 names in the whole
 * deck still need `adjustsFontSizeToFit` to shrink).
 *
 * Remote (streamed) art fades in over a branded loading placeholder, and if a
 * URL fails to load we fall back to the emoji glyph rather than a broken image.
 *
 * IMPORTANT — why the shadow and the lift live on two separate Animated.Views:
 * React Native forbids driving one props node with both a native-driver and a
 * JS-driver animation. Starting a `useNativeDriver: true` animation on `scale`
 * flips the whole enclosing AnimatedProps node (and therefore every other
 * animated value referenced in the same style) to native; a subsequent
 * `useNativeDriver: false` animation on any of them then THROWS
 * ("Attempting to run JS driven animation on animated node that has been moved
 * to native") — a hard crash in a release build. `shadowOpacity`/`shadowRadius`
 * are not native-driver-supported props, so `glow` must stay JS-driven, which
 * means it needs its own node, outside the one carrying the transform.
 * react-native-web ignores useNativeDriver entirely, which is why this never
 * reproduced in the browser.
 */
/**
 * Type size for the name plate, decided from the name itself.
 *
 * The plate used to be a fixed 11pt with `adjustsFontSizeToFit`,
 * `numberOfLines={2}` and `minimumFontScale={0.8}`. On iOS that combination
 * shrinks unpredictably and does NOT honour the floor: "El Nopal" — the
 * SHORTEST name on its board — rendered at roughly half the size of "El
 * Alacrán" next to it. Auto-shrink cannot be trusted here.
 *
 * Choosing the size ourselves is predictable, and it lets the short names that
 * make up most of the deck sit LARGER than the old fixed 11pt rather than
 * smaller. Only the rare long ones step down.
 *
 * Budget: roughly 72pt of text width across at most two lines on a 4-up board.
 * The long tail is real — "El Balón de Fútbol Americano" is 28 characters, and
 * "Portarretratos" is 14 characters that cannot wrap — so an unbreakable word
 * sets the ceiling, not the total length.
 */
function plateFontSize(name: string): number {
  const longestWord = name.split(' ').reduce((m, w) => Math.max(m, w.length), 0);
  if (longestWord > 12) return 9;
  if (name.length <= 10) return 12.5;
  if (name.length <= 16) return 11.5;
  if (name.length <= 22) return 10;
  return 9;
}

function CardTileBase({ card, selected, hinted, disabled, onPress }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  const img = cardImage(card.id);
  const isRemote = typeof img === 'string';
  // Remote images start "unloaded" so we can show the placeholder; bundled
  // images (require → number) are ready immediately.
  const [imgLoaded, setImgLoaded] = useState(!isRemote);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    // Started independently, never inside one Animated.parallel: parallel
    // starts its children in order, so the native spring would flip `glow`
    // native before the JS timing ran and the timing would throw. They target
    // different nodes here, so two plain .start() calls stay in sync visually
    // without ever sharing a props node.
    Animated.spring(scale, {
      toValue: selected ? 1.06 : 1,
      friction: 6,
      tension: 120,
      useNativeDriver: true,
    }).start();
    Animated.timing(glow, {
      toValue: selected ? 1 : 0,
      duration: 160,
      useNativeDriver: false,
    }).start();
  }, [selected, scale, glow]);

  // Loop a gentle pulse while the card is hinted (and not actively selected).
  const showHint = !!hinted && !selected;
  useEffect(() => {
    if (!showHint) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 620, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 620, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [showHint, pulse]);

  const frame = selected ? gradients.gold : (['#8A6A28', '#5A461C'] as const);
  const showImage = img != null && !imgError;
  const nameSize = plateFontSize(card.name);

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          shadowOpacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.7] }),
          shadowRadius: glow.interpolate({ inputRange: [0, 1], outputRange: [5, 14] }),
        },
      ]}
    >
      <Animated.View style={[styles.lift, { transform: [{ scale }] }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={card.name}
          accessibilityState={{ selected }}
          disabled={disabled}
          onPress={() => onPress(card.id)}
          style={({ pressed }) => [styles.press, pressed && !disabled && styles.pressed]}
        >
          <LinearGradient colors={frame} style={styles.frame} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={styles.face}>
              {showImage ? (
                <>
                  <Image
                    source={typeof img === 'string' ? { uri: img } : (img as number)}
                    style={styles.photo}
                    resizeMode="cover"
                    onLoad={() => setImgLoaded(true)}
                    onError={() => setImgError(true)}
                  />
                  {isRemote && !imgLoaded && (
                    <LinearGradient colors={gradients.cardFace} style={styles.loading}>
                      <ActivityIndicator size="small" color={colors.accent} />
                    </LinearGradient>
                  )}
                </>
              ) : (
                <LinearGradient colors={gradients.cardFace} style={styles.photo}>
                  <Text style={styles.glyph} allowFontScaling={false}>
                    {card.emoji ?? '🂠'}
                  </Text>
                </LinearGradient>
              )}

              <View style={styles.medallion}>
                <Text style={styles.medallionText}>{card.number}</Text>
              </View>

              {/* ALWAYS drawn, and deliberately ON TOP of the art.

                  Every card has its name painted into the illustration, but
                  that banner is bitmap text sized for a 480px card and the tile
                  renders about 101pt wide — a 4.7x reduction that leaves it
                  unreadable. This opaque plate lands exactly on the printed
                  label and replaces it with vector text that stays crisp at any
                  size. It is not a duplicate; it is the legible version.

                  (An isBakedCard() helper used to sit in cardImages.ts,
                  unused, reading like an instruction to suppress this plate.
                  Acting on it is what made every label unreadable in build 8.
                  It has been deleted.)

                  Anchored from the BOTTOM so a two-line name grows up into the
                  art rather than drifting off the card. */}
              <View style={styles.nameParchment}>
                <Text
                  style={[styles.name, { fontSize: nameSize, lineHeight: nameSize + 2 }]}
                  numberOfLines={2}
                  allowFontScaling={false}
                >
                  {card.name}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Pressable>

        {showHint && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.hintRing,
              {
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] }) }],
              },
            ]}
          />
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    margin: 4,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 3 },
  },
  // Carries the native-driven lift. Separate node from `wrap` so the JS-driven
  // shadow above it is never dragged onto the native driver.
  lift: { flex: 1 },
  press: { flex: 1 },
  pressed: { opacity: 0.85 },
  hintRing: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: radius.tile + 3,
    borderWidth: 2.5,
    borderColor: colors.teal,
  },
  frame: {
    width: '100%',
    aspectRatio: CARD_ASPECT,
    borderRadius: radius.tile,
    padding: 2.5,
  },
  face: {
    flex: 1,
    borderRadius: radius.tile - 2,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSolid,
  },
  // width/height 100%, NOT flex: 1.
  //
  // React Native stamps a static asset's intrinsic dimensions onto <Image> as
  // an explicit width and height. `flex: 1` only overrides the MAIN axis; the
  // cross axis keeps that explicit width, which beats align-items: stretch. So
  // with the deck bundled, every tile rendered its art 480px wide inside a
  // ~101px face with overflow: hidden — the leftmost 21% of the card, which
  // reads as a blank cream-and-gold rectangle rather than as a cropped image.
  //
  // A remote { uri } source has no intrinsic size, so no explicit width was
  // ever emitted and stretch worked. This could not have shown up before the
  // deck was bundled, and it is invisible to every check we have.
  photo: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 34 },
  medallion: {
    position: 'absolute',
    top: 4,
    left: 4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(11,10,31,0.7)',
    borderWidth: 1,
    borderColor: colors.borderGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medallionText: { color: colors.accent, fontSize: 9, fontWeight: '800' },
  // Parchment + sepia ink, matched to the printed label it replaces, so the card
  // still reads as one object rather than a photo with a UI chip stuck on it.
  nameParchment: {
    position: 'absolute',
    left: '4%',
    right: '4%',
    // Just below the printed label's lower edge, so the plate covers it fully.
    bottom: `${(1 - CARD_NAME_BAND.bottom) * 100 - 1.9}%`,
    backgroundColor: '#F3E9D0',
    borderWidth: 1,
    borderColor: '#96763C',
    borderRadius: 2,
    paddingVertical: 2,
    paddingHorizontal: 3,
  },
  // fontSize and lineHeight are set at the call site from plateFontSize().
  name: {
    color: '#3E2A0C',
    fontFamily: displayFont,
    textAlign: 'center',
  },
});

export const CardTile = memo(CardTileBase);
