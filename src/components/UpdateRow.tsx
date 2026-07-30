import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Updates from 'expo-updates';
import { colors, displayFont, floatShadow, monoFont } from '../theme';
import { useI18n } from '../i18n';

type State = 'idle' | 'checking' | 'downloading' | 'none' | 'error';

/**
 * Over-the-air update control.
 *
 * The app already checks on every cold start (`updates.checkAutomatically:
 * ON_LOAD` with `fallbackToCacheTimeout: 0`), which means a launch never waits
 * on the network — it boots the cached bundle, downloads any new one in the
 * background, and swaps it in on the NEXT launch. That is the right default for
 * players, but it is slow for a tester who wants a fix right now, so this row
 * forces the check and reloads immediately when something lands.
 *
 * Everything is wrapped: in Expo Go, on a simulator, or in any build without an
 * update channel, `expo-updates` throws or reports disabled — the row just says
 * "up to date" instead of taking the screen down with it.
 */
export function UpdateRow() {
  const { t, lang } = useI18n();
  const [state, setState] = useState<State>('idle');

  const onPress = useCallback(async () => {
    if (state === 'checking' || state === 'downloading') return;
    setState('checking');
    try {
      const check = await Updates.checkForUpdateAsync();
      if (!check.isAvailable) {
        setState('none');
        return;
      }
      setState('downloading');
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync(); // relaunches into the new bundle
    } catch {
      // Disabled in dev/Expo Go, or offline. Not worth alarming anyone over.
      setState('error');
    }
  }, [state]);

  const status =
    state === 'checking'
      ? t.settings.updateChecking
      : state === 'downloading'
        ? t.settings.updateDownloading
        : state === 'none'
          ? t.settings.updateNone
          : state === 'error'
            ? t.settings.updateUnavailable
            : t.settings.updateHint;

  // Which bundle is actually running — the single most useful thing to read off
  // a tester's screen when a report doesn't match the code.
  const id = Updates.updateId ? Updates.updateId.slice(0, 8) : lang === 'es' ? 'incluido' : 'bundled';
  const busy = state === 'checking' || state === 'downloading';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && !busy && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={t.settings.updateTitle}
    >
      <View style={styles.body}>
        <Text style={styles.title}>{t.settings.updateTitle}</Text>
        <Text style={styles.sub}>{status}</Text>
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : (
        <Text style={styles.id}>{id}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(244,185,66,0.15)',
  },
  pressed: { opacity: 0.6 },
  body: { flex: 1, paddingRight: 14 },
  title: { color: colors.text, fontFamily: displayFont, fontSize: 17, fontWeight: '700', ...floatShadow },
  sub: { color: colors.textDim, fontSize: 12, marginTop: 3, lineHeight: 17, ...floatShadow },
  id: { color: colors.accent, fontFamily: monoFont, fontSize: 10, letterSpacing: 0.8, opacity: 0.8 },
});
