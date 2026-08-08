/**
 * Abuela, framed.
 *
 * ONE component for both uses — a still pose, or the narration reel — so the
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
 * THE NARRATION IS ONE FILE PER LANGUAGE, NOT ONE PER BEAT. It used to be three
 * files swapped in the player as the narration advanced, and every swap was a
 * visible cut — expo-video holds the previous frame until the new source has
 * one, Android flashes black, and all three clips opened on the same portrait
 * so she snapped back to it at each join. Covering that with a dip produced a
 * fade AND a cut. The beats are now cross-dissolved into a single file by
 * scripts/build-abuela-reel.mjs, so there is nothing left to swap, and the
 * caption follows playback time instead of a file boundary.
 *
 * The frame is SQUARED with a gold hairline. Not rounded. See theme.ts.
 */
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { colors, radius } from '../theme';
import { ABUELA_IDLE, ABUELA_POSES, abuelaReel, type AbuelaLang } from '../data/abuelaAssets';

export type AbuelaPose = 'greeting' | 'proud' | 'delighted' | 'sympathetic' | 'home';

/** How often playback time is reported. Captions change on a ~0.3 s dissolve. */
const TIME_INTERVAL = 0.2;

interface Props {
  /** Play the narration reel for this language. Omit for a still. */
  narrate?: boolean;
  /**
   * Loop her idle clip — breathing, blinking, waiting. For Home, where she is
   * present rather than speaking.
   *
   * The clip is played forward then backward by the build script, so its last
   * frame IS its first frame and the loop point cannot show. Ignored when
   * `narrate` is set; she does one thing at a time.
   */
  idle?: boolean;
  lang?: AbuelaLang;
  /** Shown as a still, and as the fallback whenever the reel cannot play. */
  pose: AbuelaPose;
  /** Muted playback — the caller decides, because the app has a sound toggle. */
  muted?: boolean;
  /** Seconds into the reel, so the caller can pick the caption. */
  onTime?: (seconds: number) => void;
  /**
   * The reel cannot play at all: reduce-motion, or a missing file. The caller
   * has to advance the captions itself, because playback never will.
   */
  onStill?: () => void;
  onEnd?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function Abuela({ narrate, idle, lang = 'es', pose, muted, onTime, onStill, onEnd, style }: Props) {
  const [reduced, setReduced] = useState(false);
  const [failed, setFailed] = useState(false);

  // Held in refs so a caller passing inline arrows does not re-run the player
  // effects on every render.
  const timeCb = useRef(onTime);
  timeCb.current = onTime;
  const stillCb = useRef(onStill);
  stillCb.current = onStill;
  const endCb = useRef(onEnd);
  endCb.current = onEnd;

  useEffect(() => {
    let on = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => on && setReduced(!!v))
      .catch(() => {});
    return () => {
      on = false;
    };
  }, []);

  const src = narrate ? abuelaReel(lang) : idle ? ABUELA_IDLE : undefined;
  const useVideo = src != null && !reduced && !failed;
  // Idle is scenery: it loops, and it is silent whatever the sound setting says.
  // A portrait in the corner of Home that makes noise is a portrait people turn
  // the sound off for.
  const looping = !narrate && !!idle;

  const player = useVideoPlayer(useVideo ? src : null, (p) => {
    p.loop = looping;
    p.muted = looping ? true : !!muted;
    p.timeUpdateEventInterval = TIME_INTERVAL;
  });

  // Idle has no beats, no captions and no end — just start it and leave it.
  useEffect(() => {
    if (narrate || !idle || !useVideo || !player) return;
    try {
      player.play();
    } catch {
      setFailed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrate, idle, useVideo, player]);

  useEffect(() => {
    if (!narrate) return;
    if (!useVideo || !player) {
      // Nothing will ever report a time, so say so once and let the caller
      // fall back to its own pacing.
      stillCb.current?.();
      return;
    }
    try {
      player.play();
    } catch {
      setFailed(true);
      return;
    }
    const subs = [
      player.addListener('timeUpdate', (e: unknown) => {
        const t = typeof e === 'number' ? e : (e as { currentTime?: number })?.currentTime;
        if (typeof t === 'number') timeCb.current?.(t);
      }),
      player.addListener('playToEnd', () => endCb.current?.()),
    ];
    return () => {
      for (const s of subs) {
        try {
          s.remove();
        } catch {
          /* ignore */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrate, useVideo, player, lang]);

  return (
    <View style={[styles.frame, style]}>
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
