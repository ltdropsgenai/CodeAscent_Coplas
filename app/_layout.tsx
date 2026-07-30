import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, ThemeProvider, DarkTheme, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
// CodeAscent house type — the same faces the other apps use.
import { useFonts, Fraunces_400Regular, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { colors, displayFont } from '../src/theme';
import { I18nProvider } from '../src/i18n';
import { AudioProvider } from '../src/audio';
import { AppBackground } from '../src/components/AppBackground';
import { SplashSequence } from '../src/components/SplashSequence';
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
              <Stack.Screen name="play" options={{ title: 'Coplas' }} />
              <Stack.Screen name="archive" options={{ title: 'Archivo' }} />
              <Stack.Screen name="stats" options={{ title: 'Estadísticas' }} />
              <Stack.Screen name="settings" options={{ title: 'Ajustes' }} />
            </Stack>
            </ThemeProvider>
            </View>
            {showIntro && <SplashSequence onDone={onIntroDone} />}
          </View>
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
});
