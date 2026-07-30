import { useEffect, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { colors, gradients, radius as themeRadius } from '../theme';
import { cardImage } from '../data/cardImages';
import { cardVideo } from '../data/cardVideos';
import { getCard } from '../data/cards';

interface Props {
  cardId: string;
  /** Frame border color (usually the group's tier color). */
  borderColor?: string;
  /** Corner radius; defaults to the standard tile radius. */
  cornerRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A card rendered as its animated "living portrait" clip when one exists,
 * falling back to the still art otherwise.
 *
 * The still image ALWAYS renders underneath as a poster; the looping video
 * fades in over it only once the player reports it's ready. So a card with no
 * clip, a slow network, or a decode failure simply shows the static card
 * instead of a black hole. Clips are silent and loop seamlessly.
 */
export function CardVideo({ cardId, borderColor, cornerRadius, style }: Props) {
  const uri = cardVideo(cardId);
  const img = cardImage(cardId);
  const [ready, setReady] = useState(false);
  const fade = useState(() => new Animated.Value(0))[0];

  // useVideoPlayer must be called unconditionally (hook rules); a null source
  // simply yields an idle player for cards that aren't animated yet.
  const player = useVideoPlayer(uri ?? null, (p) => {
    if (!uri) return;
    try {
      p.loop = true;
      p.muted = true;
      p.play();
    } catch {
      /* ignore */
    }
  });

  // Fade the video in once it can actually show frames.
  useEffect(() => {
    if (!uri || !player) return;
    let sub: { remove: () => void } | undefined;
    try {
      sub = player.addListener('statusChange', (payload: { status?: string }) => {
        if (payload?.status === 'readyToPlay') setReady(true);
      });
    } catch {
      /* older/newer API shape — fall back to just showing it */
      setReady(true);
    }
    return () => {
      try {
        sub?.remove();
      } catch {
        /* ignore */
      }
    };
  }, [uri, player]);

  useEffect(() => {
    if (!ready) return;
    Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [ready, fade]);

  const br = cornerRadius ?? themeRadius.tile;

  return (
    <View
      style={[
        styles.frame,
        { borderRadius: br, borderColor: borderColor ?? colors.borderGold },
        style,
      ]}
    >
      {img != null ? (
        <Image
          source={typeof img === 'string' ? { uri: img } : (img as number)}
          style={styles.media}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient colors={gradients.cardFace} style={styles.centerFill}>
          <Text style={styles.glyph} allowFontScaling={false}>
            {getCard(cardId).emoji ?? '🂠'}
          </Text>
        </LinearGradient>
      )}

      {!!uri && (
        <Animated.View style={[styles.abs, { opacity: fade }]} pointerEvents="none">
          <VideoView
            player={player}
            style={styles.media}
            contentFit="cover"
            nativeControls={false}
            allowsPictureInPicture={false}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    height: '100%',
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSolid,
    position: 'relative',
  },
  /**
   * Media must be sized EXPLICITLY, not with flex. On react-native-web a
   * flex-sized <video>/<img> keeps its intrinsic 720x960 and simply gets
   * clipped by the frame's overflow, which reads as an extreme zoomed-in crop
   * of the card's middle. Absolute 100%/100% pins both to the frame so
   * contentFit/resizeMode 'cover' can do its job.
   */
  media: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  centerFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  abs: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  glyph: { fontSize: 26 },
});
