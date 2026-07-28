import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import type { Group } from '../types';
import { tierColors } from '../theme';
import { getCard } from '../data/cards';
import { useI18n } from '../i18n';

/** The banner shown once a group has been solved. Animates in on mount. */
export function SolvedGroup({ group }: { group: Group }) {
  const { t } = useI18n();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      friction: 7,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [anim]);

  const names = group.cardIds.map((id) => getCard(id).name).join(' · ');

  return (
    <Animated.View
      style={[
        styles.banner,
        { backgroundColor: tierColors[group.tier] },
        {
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
          ],
        },
      ]}
    >
      <Text style={styles.headerRow}>
        <Text style={styles.theme}>{group.theme}</Text>
      </Text>
      <Text style={styles.tier}>{t.tier[group.tier]}</Text>
      <Text style={styles.cards}>{names}</Text>
      <Text style={styles.explain}>{group.explanation}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 4,
    marginBottom: 8,
  },
  headerRow: {},
  theme: { color: '#0B1026', fontWeight: '800', fontSize: 15 },
  tier: {
    color: '#0B1026',
    fontWeight: '700',
    fontSize: 11,
    opacity: 0.65,
    position: 'absolute',
    top: 10,
    right: 14,
  },
  cards: { color: '#0B1026', fontWeight: '700', fontSize: 13, marginTop: 2 },
  explain: { color: '#0B1026', fontSize: 12, marginTop: 3, opacity: 0.9 },
});
