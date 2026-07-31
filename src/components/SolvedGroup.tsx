import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import type { Group } from '../types';
import { CARD_ASPECT, colors, displayFont, floatShadow, tierColors } from '../theme';
import { getCard } from '../data/cards';
import { imageSource } from '../data/cardImages';
import { hasCardVideo } from '../data/cardVideos';
import { groupTheme, groupWhy } from '../data/groupText';
import { CardVideo } from './CardVideo';
import { useI18n } from '../i18n';

/**
 * A solved group floats directly on the scene: serif theme in gold, a short
 * tier-colored hairline, the four cards, then the names and the reason.
 *
 * NO PANEL. It used to be a dark plaque with a border and a drop shadow and a
 * colored ribbon down one edge, and four of those stacked turned the finish of
 * a round into a column of boxes. The house style is content floating on the
 * living background — the same move the legal screens make with their little
 * rule. Legibility over a busy scene comes from text shadows (floatShadow),
 * not from putting a lid over the artwork.
 *
 * Animates in on mount.
 */
/** See the comment on the thumbnail strip below before turning this on. */
const THUMBS_ANIMATE = false;

/** Thumbnail width in pt. Height follows from CARD_ASPECT. */
const THUMB_W = 34;

export function SolvedGroup({ group, animate }: { group: Group; animate?: boolean }) {
  const { t, lang } = useI18n();
  const anim = useRef(new Animated.Value(0)).current;
  const color = tierColors[group.tier];

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }).start();
  }, [anim]);

  const names = group.cardIds.map((id) => getCard(id).name).join(' · ');

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
          ],
        },
      ]}
    >
      {/* Title beside the cards, not above them.

          Stacked, a group ran about 140pt and four of them pushed SIGUIENTE
          RONDA below the fold. The thumbnail strip is 46pt tall and the title
          block is about the same, so putting them side by side reclaims a whole
          strip per group — roughly 180pt over the screen, more than the
          overflow. Nothing shrinks and no group loses its explanation. */}
      <View style={styles.topRow}>
        <View style={styles.titleCol}>
          {/* Localized at render only — `group.theme` stays Spanish everywhere
              it is used as an identity key (engine.ts, the React key in
              play.tsx). See src/data/groupText.ts. */}
          <Text style={styles.theme}>{groupTheme(group.theme, lang)}</Text>
          <View style={[styles.rule, { backgroundColor: color }]} />
          <Text style={[styles.tier, { color }]}>{t.tier[group.tier].toUpperCase()}</Text>
        </View>

        {/* The four cards you just matched.

            These render 34 pt wide. The clips are deliberately *subtle* — a
            slow breath, a flicker, drifting dust — and none of that is
            perceptible at 34 pt, while each clip is ~1.3 MB. Playing four of
            them per solved group would spend ~21 MB of a player's data over a
            round to animate something nobody can see. So the thumbnails stay
            still by default and motion is spent where it reads: the 128 pt home
            hero and the win celebration. Flip THUMBS_ANIMATE to re-enable. */}
        <View style={styles.thumbs}>
          {group.cardIds.map((id) =>
            THUMBS_ANIMATE && animate && hasCardVideo(id) ? (
              <View key={id} style={styles.thumbBox}>
                <CardVideo cardId={id} borderColor={color} cornerRadius={4} />
              </View>
            ) : (
              /* The Image IS the thumbnail — no wrapper for it to fill.

                 This used to be a sized <View> with an <Image> told to fill it,
                 and the images never appeared. Rather than keep guessing at why
                 a child fails to fill its parent, this now mirrors the shape
                 that is known to work everywhere else in the app (NavRow.icon,
                 the achievement icons, the home stat icons): one <Image> with
                 numeric width and height and the border drawn on itself. There
                 is no parent-child sizing relationship left to get wrong.

                 imageSource, never `{ uri: cardImage(id) as string }` — a
                 bundled asset is a number, and wrapping a number in `uri`
                 renders nothing and reports no error. */
              <Image
                key={id}
                source={imageSource(id)}
                style={[styles.thumb, { borderColor: color }]}
                resizeMode="cover"
              />
            )
          )}
        </View>
      </View>
      <Text style={styles.cards}>{names}</Text>
      <Text style={styles.explain}>{groupWhy(group.explanation, lang)}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 8, marginBottom: 16 },
  // Title on the left, the four cards on the right, vertically centred on each
  // other so a one-line and a two-line theme both sit level with the strip.
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleCol: { flex: 1 },
  // Carries the tier where the ribbon used to. Same motif as the legal screens.
  rule: { width: 44, height: 2, borderRadius: 1, opacity: 0.9, marginTop: 7, marginBottom: 6 },
  theme: {
    color: colors.accent,
    fontFamily: displayFont,
    fontWeight: '700',
    fontSize: 19,
    ...floatShadow,
  },
  tier: { fontWeight: '800', fontSize: 10, letterSpacing: 1.2, ...floatShadow },
  thumbs: { flexDirection: 'row', gap: 6 },
  // Numeric width and height, border on the image itself. See the note at the
  // call site: this deliberately matches NavRow.icon rather than inventing a
  // wrapper the image has to fill.
  thumb: {
    width: THUMB_W,
    height: Math.round(THUMB_W / CARD_ASPECT),
    borderRadius: 4,
    borderWidth: 1,
    backgroundColor: colors.surfaceSolid,
  },
  // Only the animated branch still needs a box for CardVideo to fill.
  thumbBox: { width: THUMB_W, height: Math.round(THUMB_W / CARD_ASPECT), borderRadius: 4, overflow: 'hidden' },
  cards: { color: colors.text, fontWeight: '700', fontSize: 13.5, marginTop: 9, ...floatShadow },
  explain: { color: colors.textDim, fontSize: 12.5, marginTop: 3, ...floatShadow },
});
