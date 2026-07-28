import { memo, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import type { Card } from '../types';
import { colors } from '../theme';

interface Props {
  card: Card;
  selected: boolean;
  disabled?: boolean;
  onPress: (id: string) => void;
}

/**
 * A single card in the grid. Placeholder art = emoji glyph + name.
 * Selecting it gives a small spring "pop". When commissioned art arrives,
 * swap the glyph <Text> for an <Image>.
 */
function CardTileBase({ card, selected, disabled, onPress }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: selected ? 1.07 : 1,
      friction: 6,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [selected, scale]);

  return (
    <Animated.View style={[styles.wrap, { transform: [{ scale }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={card.name}
        accessibilityState={{ selected }}
        disabled={disabled}
        onPress={() => onPress(card.id)}
        style={({ pressed }) => [
          styles.tile,
          selected && styles.tileSelected,
          pressed && !disabled && styles.tilePressed,
        ]}
      >
        <Text style={styles.glyph} allowFontScaling={false}>
          {card.emoji ?? '🂠'}
        </Text>
        <Text style={styles.name} numberOfLines={2} adjustsFontSizeToFit>
          {card.name}
        </Text>
        <Text style={styles.numberText}>{card.number}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  tile: {
    flex: 1,
    aspectRatio: 0.82,
    margin: 4,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  tileSelected: {
    backgroundColor: colors.selected,
    borderColor: colors.accent,
  },
  tilePressed: {
    opacity: 0.7,
  },
  glyph: {
    fontSize: 30,
    marginBottom: 4,
  },
  name: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  numberText: {
    position: 'absolute',
    top: 4,
    left: 6,
    color: colors.textDim,
    fontSize: 9,
    fontWeight: '700',
  },
});

export const CardTile = memo(CardTileBase);
