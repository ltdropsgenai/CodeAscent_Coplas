/**
 * Abuela, framed.
 *
 * ONE component for both uses — a still pose, or a lip-synced beat — so the
 * frame, the palette and the fallback behaviour cannot drift between the
 * tutorial and everywhere else she appears.
 *
 * Three fallbacks, each matching a pattern this app already uses:
 *   reduce-motion  → the still, never the video (AppBackground, DealOverlay)
 *   sound off      → plays silent; the caption carries the meaning, which is
 *                    why captions are never optional
 *   clip missing   → the still, matching the audio system's rule that sources
 *                    missing from the registry simply do not play
 *
 * The frame is SQUARED with a gold hairline. Not rounded. See theme.ts.
 */
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { colors, radius } from '../theme';
import { ABUELA_POSES, abuelaClip, type AbuelaLang } from '../data/abuelaAssets';

export type AbuelaPose = 'greeting' | 'proud' | 'delighted' | 'sympathetic' | 'home';

interface Props {
  /** Play this beat as video. Omit for a still. */
  beat?: number;
  lang?: AbuelaLang;
  /** Shown as a still, and as the fallback for a beat that cannot play. */
  pose: AbuelaPose;
  /** Muted playback — the caller decides, because the app has a sound toggle. */
  muted?: boolean;
  /**
   * Opacity of the picture INSIDE the frame, so a caller can dip between beats.
   * The frame itself does not fade: the gold hairline and the dark panel stay
   * put, and the picture changes inside them. Fading the whole frame instead
   * reads as the panel flickering.
   *
   * Owned by the caller because the caption has to change in the same dark
   * moment as the clip, and only the caller knows about the caption.
   */
  contentOpacity?: Animated.AnimatedInterpolation<number> | Animated.Value;
  onEnd?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function Abuela({ beat, lang = 'es', pose, muted, contentOpacity, onEnd, style }: Props) {
  const [reduced, setReduced] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let on = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => on && setReduced(!!v))
      .catch(() => {});
    return () => {
      on = false;
    };
  }, []);

  const src = beat != null ? abuelaClip(lang, beat) : undefined;
  const useVideo = src != null && !reduced && !failed;

  const player = useVideoPlayer(useVideo ? src : null, (p) => {
    p.loop = false;
    p.muted = !!muted;
  });

  useEffect(() => {
    if (!useVideo || !player) return;
    try {
      player.play();
    } catch {
      setFailed(true);
      return;
    }
    const sub = player.addListener('playToEnd', () => onEnd?.());
    return () => {
      try {
        sub.remove();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useVideo, player]);

  // A still has no end event, so anything waiting on one must not wait for ever.
  useEffect(() => {
    if (useVideo || beat == null) return;
    const id = setTimeout(() => onEnd?.(), 4000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useVideo, beat]);

  return (
    <View style={[styles.frame, style]}>
      <Animated.View style={[styles.fill, contentOpacity != null && { opacity: contentOpacity }]}>
        {useVideo ? (
          <VideoView
            style={styles.fill}
            player={player}
            nativeControls={false}
            contentFit="cover"
          />
        ) : (
          <Image source={ABUELA_POSES[pose]} style={styles.fill} resizeMode="cover" />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    aspectRatio: 4 / 5,
    width: '100%',
    borderRadius: radius.tile,
    borderWidth: 1,
    borderColor: 'rgba(255,240,200,0.5)',
    backgroundColor: colors.bgDeep,
    overflow: 'hidden',
  },
  fill: { width: '100%', height: '100%' },
});
