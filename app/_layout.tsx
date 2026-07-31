import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, ThemeProvider, DarkTheme, useRouter, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
// CodeAscent house type — the same faces the other apps use.
import { useFonts, Fraunces_400Regular, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { colors, displayFont } from '../src/theme';
import { I18nProvider } from '../src/i18n';
import { AudioProvider } from '../src/audio';
import { PurchasesProvider } from '../src/purchases';
import { AppBackground } from '../src/components/AppBackground';
import { HeaderBack } from '../src/components/HeaderBack';
import { SplashSequence } from '../src/components/SplashSequence';
import { ReminderSync } from '../src/components/ReminderSync';
import { getSettings } from '../src/storage/store';

// Session flag: the animated intro plays once per cold start ("every launch").
let INTRO_PLAYED = false;

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Transparent navigation theme — this is the key to "floating" content. The
 * navigator otherwise paints every screen with an opaque theme background
 * (light on web), which covers the animated scene behind a solid column.
 * Making background + card transparent lets the single root AppBackground show
 * through everywhere, so text/logo/panels float on the living scene.
 */
const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: 'transparent', card: 'transparent' },
};

/**
 * Expo Router picks this export up as the root error boundary.
 *
 * Without it, ANY error thrown while rendering or inside an effect goes
 * unhandled, reaches RCTExceptionsManager and aborts the process — the app just
 * dies, and in a TestFlight build the crash log contains only the native
 * backtrace, not the JavaScript message. That is exactly how the round-one
 * crash on JUGAR presented, and it cost a whole build cycle to identify.
 *
 * With this in place the failure degrades into a screen the player can back out
 * of, and — crucially — it prints the message and stack, so a screenshot from a
 * tester is enough to diagnose the next one.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.errRoot}>
      <ScrollView contentContainerStyle={styles.errBody}>
        <Text style={styles.errTitle}>Algo se descosió</Text>
        <Text style={styles.errDim}>
          Se produjo un error inesperado. Puedes reintentar; si vuelve a pasar, comparte esta
          pantalla con nosotros.
        </Text>
        <Text style={styles.errMsg}>{error?.message ?? 'Error desconocido'}</Text>
        {!!error?.stack && <Text style={styles.errStack}>{error.stack.split('\n').slice(0, 12).join('\n')}</Text>}
        <Pressable onPress={() => retry()} style={styles.errBtn}>
          <Text style={styles.errBtnText}>REINTENTAR</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

export default function RootLayout() {
  const router = useRouter();
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_400Regular,
    Fraunces_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  // Animated launch intro (overlay). Plays each cold start; on finish it hands
  // off to the tutorial the first time only, otherwise straight to home.
  const [showIntro, setShowIntro] = useState(!INTRO_PLAYED);
  const onIntroDone = () => {
    INTRO_PLAYED = true;
    setShowIntro(false);
    getSettings()
      .then((s) => {
        if (!s.tutorialDone) router.push('/tutorial');
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  // Hold the (native) splash until the brand fonts are ready — but never block
  // forever: if the fonts error out we render anyway and fall back gracefully.
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AudioProvider>
          {/* Entitlement state is read by archive/settings/unlock, so it sits
              above the navigator. Inert while IAP_ENABLED is false. */}
          <PurchasesProvider>
          {/* Renders nothing; rebuilds the daily reminder schedule on launch
              and on language change. */}
          <ReminderSync />
          <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <AppBackground />
            <StatusBar style="light" />
            {/* Constrain to a phone-width column and center it (matters on web/desktop). */}
            <View style={styles.shell}>
            <ThemeProvider value={navTheme}>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: 'transparent' },
                headerTintColor: colors.text,
                headerTitleStyle: { fontWeight: '700', fontFamily: displayFont, fontSize: 20 },
                headerShadowVisible: false,
                headerTransparent: false,
                contentStyle: { backgroundColor: 'transparent' },
              }}
            >
              {/* Empty title on Home so the floating hero logo isn't duplicated
                  by a header title; the sound toggle still floats top-right. */}
              <Stack.Screen name="index" options={{ title: '' }} />
              <Stack.Screen
                name="tutorial"
                options={{ presentation: 'modal', headerShown: false }}
              />
              {/* Every pushed screen gets an explicit back button naming its
                  parent, so the way out is never missing (see HeaderBack).
                  Hierarchy: Home → Ajustes → archive / stats / legal pages. */}
              <Stack.Screen
                name="play"
                options={{ title: 'Coplas', headerLeft: () => <HeaderBack fallback="/" to="home" /> }}
              />
              <Stack.Screen
                name="settings"
                options={{ title: 'Ajustes', headerLeft: () => <HeaderBack fallback="/" to="home" /> }}
              />
              <Stack.Screen
                name="archive"
                options={{ title: 'Archivo', headerLeft: () => <HeaderBack fallback="/settings" to="settings" /> }}
              />
              <Stack.Screen
                name="stats"
                options={{ title: 'Estadísticas', headerLeft: () => <HeaderBack fallback="/settings" to="settings" /> }}
              />
              {/* Title is set per-document by the screen itself. */}
              <Stack.Screen
                name="legal"
                options={{ title: '', headerLeft: () => <HeaderBack fallback="/settings" to="settings" /> }}
              />
              {/* Paywall. Pushed from the archive (and from settings); the
                  route always exists so `coplas://unlock` can't 404, but with
                  the gate off it renders its "nothing to sell" state. */}
              <Stack.Screen
                name="unlock"
                options={{ title: '', headerLeft: () => <HeaderBack fallback="/archive" to="archive" /> }}
              />
              <Stack.Screen
                name="achievements"
                options={{ title: '', headerLeft: () => <HeaderBack fallback="/settings" to="settings" /> }}
              />
            </Stack>
            </ThemeProvider>
            </View>
            {showIntro && <SplashSequence onDone={onIntroDone} />}
          </View>
          </PurchasesProvider>
        </AudioProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  errRoot: { flex: 1, backgroundColor: colors.bg },
  errBody: { padding: 26, paddingTop: 90, gap: 14, maxWidth: 480, width: '100%', alignSelf: 'center' },
  errTitle: { color: colors.text, fontFamily: displayFont, fontSize: 26 },
  errDim: { color: colors.textDim, fontSize: 14, lineHeight: 20 },
  errMsg: { color: colors.accent, fontSize: 14, fontWeight: '700', marginTop: 6 },
  errStack: { color: colors.textDim, fontSize: 11, lineHeight: 15, opacity: 0.8 },
  errBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.borderGold,
  },
  errBtnText: { color: colors.text, fontWeight: '800', letterSpacing: 0.6, fontSize: 13 },
});
