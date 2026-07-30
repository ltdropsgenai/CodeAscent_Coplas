import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import type { Group } from '../types';
import { CARD_ASPECT, colors, displayFont, radius, tierColors } from '../theme';
import { getCard } from '../data/cards';
import { cardImage } from '../data/cardImages';
import { hasCardVideo } from '../data/cardVideos';
import { CardVideo } from './CardVideo';
import { useI18n } from '../i18n';

/**
 * Solved group as a framed "board entry": a dark glass plaque with a gold
 * hairline, a colored tier ribbon down the left edge, and a serif theme —
 * not a candy-colored rounded block. Animates in on mount.
 */
export function SolvedGroup({ group, animate }: { group: Group; animate?: boolean }) {
  const { t } = useI18n();
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
      <View style={[styles.ribbon, { backgroundColor: color }]} />
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={styles.theme}>{group.theme}</Text>
          <Text style={[styles.tier, { color }]}>{t.tier[group.tier].toUpperCase()}</Text>
        </View>
        {/* The four cards you just matched. Only the freshly-solved group
            animates (at most four players at a time); older plaques show
            stills, which keeps memory and mobile data in check. */}
        <View style={styles.thumbs}>
          {group.cardIds.map((id) =>
            animate && hasCardVideo(id) ? (
              <View key={id} style={styles.thumb}>
                <CardVideo cardId={id} borderColor={color} cornerRadius={4} />
              </View>
            ) : (
              <View key={id} style={[styles.thumb, styles.thumbStill, { borderColor: color }]}>
                <Image
                  source={{ uri: cardImage(id) as string }}
                  style={styles.thumbImg}
                  resizeMode="cover"
                />
              </View>
            )
          )}
        </View>
        <Text style={styles.cards}>{names}</Text>
        <Text style={styles.explain}>{group.explanation}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    marginHorizontal: 4,
    marginBottom: 8,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: 'rgba(13, 11, 28, 0.9)',
    borderWidth: 1,
    borderColor: colors.borderGold,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  ribbon: { width: 6 },
  body: { flex: 1, paddingHorizontal: 14, paddingVertical: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  theme: { color: colors.accent, fontFamily: displayFont, fontWeight: '700', fontSize: 17, flex: 1 },
  tier: { fontWeight: '800', fontSize: 10, letterSpacing: 1, marginLeft: 8 },
  thumbs: { flexDirection: 'row', gap: 4, marginTop: 6 },
  thumb: { width: 34, aspectRatio: CARD_ASPECT, borderRadius: 4, overflow: 'hidden' },
  thumbStill: { borderWidth: 1, backgroundColor: colors.surfaceSolid },
  thumbImg: { width: '100%', height: '100%' },
  cards: { color: colors.text, fontWeight: '700', fontSize: 13, marginTop: 5 },
  explain: { color: colors.textDim, fontSize: 12, marginTop: 3 },
});
