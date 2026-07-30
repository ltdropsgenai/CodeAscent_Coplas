import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radius } from '../theme';

type Variant = 'gold' | 'teal' | 'magenta' | 'success' | 'ghost';

const VARIANT_GRADIENT: Record<Exclude<Variant, 'ghost'>, readonly [string, string]> = {
  gold: gradients.goldButton,
  teal: gradients.teal,
  magenta: gradients.magenta,
  success: gradients.success,
};

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  size?: 'md' | 'lg';
  style?: ViewStyle;
}

/**
 * A stamped-plaque button: squared corners, a gold hairline frame, a bright
 * top bevel, and letter-spaced uppercase type. Deliberately not a pill.
 * Ghost = dark plaque with a gold outline for secondary actions.
 */
export function GradientButton({
  label,
  onPress,
  variant = 'gold',
  disabled,
  size = 'md',
  style,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, friction: 7, tension: 160 }).start();

  const pad = size === 'lg' ? styles.lg : styles.md;
  const ink = variant === 'ghost' ? colors.text : colors.ink;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, styles.shadow, style]}>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => !disabled && to(0.96)}
        onPressOut={() => to(1)}
        style={[styles.base, disabled && styles.disabled]}
      >
        {variant === 'ghost' ? (
          <Animated.View style={[styles.fill, pad, styles.ghost]}>
            <Text style={[styles.label, { color: ink }]}>{label.toUpperCase()}</Text>
          </Animated.View>
        ) : (
          <LinearGradient
            colors={VARIANT_GRADIENT[variant]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[styles.fill, pad, styles.gold]}
          >
            <Text style={[styles.label, { color: ink }]}>{label.toUpperCase()}</Text>
          </LinearGradient>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  base: { borderRadius: radius.button, overflow: 'hidden' },
  fill: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
  },
  gold: {
    borderWidth: 1.5,
    borderColor: 'rgba(120, 84, 12, 0.8)',
    borderTopColor: 'rgba(255,255,255,0.55)',
  },
  ghost: {
    backgroundColor: 'rgba(12,10,26,0.8)',
    borderWidth: 1.5,
    borderColor: colors.borderGold,
  },
  md: { paddingHorizontal: 24, paddingVertical: 13 },
  lg: { paddingHorizontal: 40, paddingVertical: 16 },
  label: { fontWeight: '900', fontSize: 14, letterSpacing: 1.5 },
  disabled: { opacity: 0.4 },
});
