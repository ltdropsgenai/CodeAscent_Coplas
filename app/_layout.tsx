import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../src/theme';
import { I18nProvider } from '../src/i18n';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '800' },
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Coplas' }} />
          <Stack.Screen
            name="tutorial"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen name="play" options={{ title: 'Coplas' }} />
          <Stack.Screen name="archive" options={{ title: 'Archivo' }} />
          <Stack.Screen name="stats" options={{ title: 'Estadísticas' }} />
          <Stack.Screen name="settings" options={{ title: 'Ajustes' }} />
        </Stack>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
