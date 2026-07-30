import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { auroraOrbs, colors, gradients } from '../theme';

/**
 * A living background: a dark gradient wash, several slow-drifting glowing
 * "aurora" orbs, and a few papel-picado diamonds floating upward. All motion
 * runs on the native driver (transforms/opacity only) so it stays smooth.
 *
 * Render it once, absolutely filling the screen, behind everything else.
 */
export function AnimatedBackground() {
  const { width, height } = useWindowDimensions();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={gradients.night}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <Orb index={0} size={width * 1.1} startX={-width * 0.3} startY={-height * 0.05} />
      <Orb index={1} size={width * 0.95} startX={width * 0.5} startY={height * 0.12} />
      <Orb index={2} size={width * 1.05} startX={-width * 0.1} startY={height * 0.55} />
      <Orb index={3} size={width * 0.8} startX={width * 0.55} startY={height * 0.62} />

      <Diamonds width={width} height={height} />
    </View>
  );
}

function Orb({
  index,
  size,
  startX,
  startY,
}: {
  index: number;
  size: number;
  startX: number;
  startY: number;
}) {
  const drift = useRef(new Animated.Value(0)).current;
  const pair = auroraOrbs[index % auroraOrbs.length];

  // Each orb drifts on its own period/direction so they never sync up.
  const dur = 9000 + index * 2600;
  const dx = (index % 2 === 0 ? 1 : -1) * (26 + index * 8);
  const dy = (index % 2 === 0 ? -1 : 1) * (22 + index * 6);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: dur,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: dur,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [drift, dur]);

  const translateX = drift.interpolate({ inputRange: [0, 1], outputRange: [0, dx] });
  const translateY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, dy] });
  const scale = drift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: startX,
        top: startY,
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        opacity: 0.9,
        transform: [{ translateX }, { translateY }, { scale }],
      }}
    >
      <LinearGradient
        colors={pair}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 1, y: 1 }}
      />
    </Animated.View>
  );
}

/** A handful of slowly rising, rotating papel-picado diamonds. */
function Diamonds({ width, height }: { width: number; height: number }) {
  const specs = useMemo(
    () =>
      [0, 1, 2, 3, 4, 5].map((i) => ({
        x: ((i * 37) % 100) / 100,
        size: 10 + (i % 3) * 6,
        dur: 12000 + i * 2400,
        delay: i * 1500,
        color:
          [colors.accent, colors.magenta, colors.teal, colors.violet][i % 4],
      })),
    []
  );

  return (
    <>
      {specs.map((s, i) => (
        <Diamond key={i} spec={s} width={width} height={height} />
      ))}
    </>
  );
}

function Diamond({
  spec,
  width,
  height,
}: {
  spec: { x: number; size: number; dur: number; delay: number; color: string };
  width: number;
  height: number;
}) {
  const p = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(p, {
        toValue: 1,
        duration: spec.dur,
        delay: spec.delay,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [p, spec.dur, spec.delay]);

  const translateY = p.interpolate({ inputRange: [0, 1], outputRange: [height + 40, -40] });
  const rotate = p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '220deg'] });
  const opacity = p.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 0.5, 0.5, 0] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: spec.x * width,
        width: spec.size,
        height: spec.size,
        backgroundColor: spec.color,
        borderRadius: 2,
        opacity,
        transform: [{ translateY }, { rotate }],
      }}
    />
  );
}
