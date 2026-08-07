/**
 * DealOverlay — sixteen cards dealt from a deck into their places on the board.
 *
 * WHY IT IS AN OVERLAY AND NOT PART OF THE GRID. The cards travel from a deck
 * that sits above the board into cells inside it, so for most of each flight a
 * card is outside the bounds of the row it belongs to. iOS draws children that
 * overflow their parent; ANDROID CLIPS THEM. That is exactly how the launch
 * intro lost its assembly animation on Android for four builds — the pieces
 * were flying correctly the whole time, outside a 216pt box. This layer is
 * sized to contain the entire travel path, deck included, so nothing ever has
 * to draw outside itself and both platforms show the same thing.
 *
 * EVERYTHING IS TRANSFORM AND OPACITY. No width, height, top or left is
 * animated anywhere here. The native driver supports only those two, and
 * feeding a natively-driven value into a layout property is what froze the
 * whole intro timeline on Android — one three-pixel gold rule took every other
 * interpolation with it. Positions are static; movement is `translate`.
 *
 * The parent measures the grid with onLayout and positions this to match, so
 * the cell arithmetic here is local and needs no window-coordinate conversion.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { CARD_ASPECT, colors, radius } from '../theme';

/**
 * The deck sits INSIDE the board rect, centred over the top row — not in
 * headroom above it.
 *
 * Headroom was the first design and it reintroduced the bug this file's header
 * is about: a layer extending above its parent draws outside that parent's
 * bounds, and Android clips it, so the deck itself would have been invisible on
 * exactly one platform. Keeping every pixel of the animation inside the
 * measured grid rect makes that impossible rather than merely unlikely.
 */

const COLS = 4;
const ROWS = 4;
/** Matches CardTile's `margin: 4` so a landed back sits exactly on its tile. */
const GUTTER = 4;

interface Props {
  /** Width of the grid this is covering. */
  width: number;
  /** Height of the grid this is covering. */
  height: number;
  /** Abbreviated deal, for rounds after the first. */
  fast?: boolean;
  /** Skip straight to the end — the player tapped, or motion is reduced. */
  skip?: boolean;
  onDone: () => void;
}

export function DealOverlay({ width, height, fast, skip, onDone }: Props) {
  const cellW = width / COLS;
  const cellH = height / ROWS;
  const cardW = Math.max(1, cellW - GUTTER * 2);
  const cardH = Math.max(1, Math.min(cellH - GUTTER * 2, cardW / CARD_ASPECT));

  const STAGGER = fast ? 22 : 55;
  const TRAVEL = fast ? 220 : 350;
  const HOLD = fast ? 120 : 200;

  // Centred over the top row: cards to row 0 barely move, cards to row 3
  // travel the full board, which is what reads as dealing.
  const deckX = width / 2;
  const deckY = cellH / 2;

  const cards = useMemo(
    () =>
      Array.from({ length: COLS * ROWS }, (_, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        return {
          i,
          // Target centre, local to this layer.
          tx: (col + 0.5) * cellW - deckX,
          ty: (row + 0.5) * cellH - deckY,
          // A little variation so the deal does not look mechanical. Derived
          // from the index, not Math.random, so a re-render cannot reshuffle
          // a flight that is already in the air.
          tilt: ((i * 37) % 13) - 6,
        };
      }),
    [cellW, cellH, deckX, deckY]
  );

  const progress = useRef(cards.map(() => new Animated.Value(0))).current;
  const deckFade = useRef(new Animated.Value(1)).current;
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };

  /**
   * Reduce-motion is honoured HERE rather than by the caller, so the policy
   * travels with the animation. AppBackground already did this; SplashSequence
   * did not, and an intro that ignores the setting is the worst place to have
   * that gap. A player who has asked for less motion gets the board, not a
   * fourteen-hundred-millisecond deal they did not want.
   */
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let on = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => on && setReduced(!!v))
      .catch(() => {});
    return () => {
      on = false;
    };
  }, []);

  useEffect(() => {
    if (skip || reduced) {
      progress.forEach((v) => v.setValue(1));
      deckFade.setValue(0);
      finish();
      return;
    }
    const anim = Animated.parallel([
      ...progress.map((v, i) =>
        Animated.timing(v, {
          toValue: 1,
          delay: i * STAGGER,
          duration: TRAVEL,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      ),
      Animated.timing(deckFade, {
        toValue: 0,
        delay: (cards.length - 2) * STAGGER,
        duration: TRAVEL,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]);
    anim.start(({ finished }) => {
      if (finished) setTimeout(finish, HOLD);
    });
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, reduced]);

  const back = (key: string, style: any) => (
    <Animated.View key={key} style={[styles.back, { width: cardW, height: cardH }, style]}>
      <Image source={require('../../assets/icon.png')} style={styles.backArt} resizeMode="cover" />
    </Animated.View>
  );

  return (
    <View
      style={[styles.root, { width, height }]}
      pointerEvents="none"
    >
      {/* The deck: a few backs stacked with a slight offset, sitting in the
          headroom. It fades as the last cards leave rather than vanishing, so
          the stack never appears to run out early. */}
      <Animated.View
        style={{
          position: 'absolute',
          left: deckX - cardW / 2,
          top: deckY - cardH / 2,
          opacity: deckFade,
        }}
      >
        {[6, 3, 0].map((off) =>
          back(`deck${off}`, {
            position: 'absolute',
            left: off * 0.6,
            top: off * 0.5,
            opacity: off === 0 ? 1 : 0.55,
          })
        )}
      </Animated.View>

      {/* The sixteen in flight. */}
      {cards.map((c) => {
        const p = progress[c.i];
        return (
          <View
            key={c.i}
            style={{ position: 'absolute', left: deckX - cardW / 2, top: deckY - cardH / 2 }}
          >
            {back(`fly${c.i}`, {
              opacity: p.interpolate({ inputRange: [0, 0.08, 1], outputRange: [0, 1, 1] }),
              transform: [
                { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, c.tx] }) },
                { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, c.ty] }) },
                {
                  rotate: p.interpolate({
                    inputRange: [0, 1],
                    outputRange: [`${c.tilt}deg`, '0deg'],
                  }),
                },
                { scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
              ],
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, top: 0, zIndex: 20, elevation: 20 },
  back: {
    borderRadius: radius.tile,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,240,200,0.5)',
    backgroundColor: colors.bgDeep,
  },
  backArt: { width: '100%', height: '100%' },
});
