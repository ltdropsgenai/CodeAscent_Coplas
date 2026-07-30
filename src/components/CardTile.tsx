import { memo, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Card } from '../types';
import { CARD_ASPECT, colors, gradients, radius } from '../theme';
import { cardImage, isBakedCard } from '../data/cardImages';

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
 * The name label: the expanded deck's art has the Spanish name BAKED into the
 * image (Lotería banner), so those cards draw no name plate — showing it would
 * double the label. The 54 classics keep their overlaid plate (their preview
 * art has no baked name). See `isBakedCard`.
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
function CardTileBase({ card, selected, hinted, disabled, onPress }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  const img = cardImage(card.id);
  const baked = isBakedCard(card.id);
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

              {(!baked || imgError) && (
                <View style={styles.plate}>
                  <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit>
                    {card.name}
                  </Text>
                </View>
              )}
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
  photo: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  plate: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(9,8,20,0.82)',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(244,185,66,0.35)',
  },
  name: { color: colors.text, fontSize: 12, fontWeight: '800', textAlign: 'center', letterSpacing: 0.2 },
});

export const CardTile = memo(CardTileBase);
