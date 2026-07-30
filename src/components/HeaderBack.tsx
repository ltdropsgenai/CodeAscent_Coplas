import { useCallback } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, monoFont } from '../theme';
import { useI18n } from '../i18n';

/**
 * The app's back affordance, used as `headerLeft` on every pushed screen.
 *
 * Why we don't rely on the navigator's own arrow: the stack only draws one when
 * there is something on the history stack to pop, so it silently disappears
 * whenever a screen is the FIRST route — a web reload, a deep link, or a cold
 * start that lands somewhere other than home. That is how gameplay ended up
 * with no way back to the menu.
 *
 * So we always render our own, and pass an explicit `fallback` route to
 * `replace` when there is nothing to pop. The label names the destination
 * ("‹ Inicio", "‹ Ajustes") rather than saying "Back", so the hierarchy is
 * legible: Home → Ajustes → any of its pages.
 */
export function HeaderBack({
  fallback,
  to,
}: {
  /** Route to replace with when the history stack is empty. */
  fallback: string;
  /** Which destination the label names. */
  to: 'home' | 'settings';
}) {
  const router = useRouter();
  const { t } = useI18n();

  const onPress = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback as never);
  }, [router, fallback]);

  return (
    <Pressable
      onPress={onPress}
      hitSlop={14}
      accessibilityRole="button"
      accessibilityLabel={to === 'home' ? t.nav.home : t.nav.settings}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
    >
      <Text style={styles.chevron}>‹</Text>
      <Text style={styles.label}>{to === 'home' ? t.nav.home : t.nav.settings}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', paddingRight: 12, paddingVertical: 4 },
  pressed: { opacity: 0.6 },
  chevron: { color: colors.accent, fontSize: 26, lineHeight: 28, marginRight: 3 },
  label: { color: colors.accent, fontFamily: monoFont, fontSize: 12, letterSpacing: 0.8 },
});
