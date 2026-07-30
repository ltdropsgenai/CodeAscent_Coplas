import { useCallback, useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from 'expo-router';
import { colors, monoFont } from '../src/theme';
import { useI18n, type Lang } from '../src/i18n';
import { useAudio } from '../src/audio';
import { DEFAULT_SETTINGS, getSettings, saveSettings, type Settings } from '../src/storage/store';
import type { Difficulty } from '../src/types';

const DIFFS: Difficulty[] = ['facil', 'media', 'dificil'];

export default function SettingsScreen() {
  const { t, lang, setLang } = useI18n();
  const { soundEnabled, toggleSound } = useAudio();
  const navigation = useNavigation();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t.nav.settings });
  }, [navigation, t]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getSettings().then((s) => active && setSettings(s));
      return () => {
        active = false;
      };
    }, [])
  );

  async function update(patch: Partial<Settings>) {
    const next = await saveSettings(patch);
    setSettings(next);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Language segmented control (drives the whole UI via i18n) */}
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.title}>{t.settings.langTitle}</Text>
          <Text style={styles.subtitle}>{t.settings.langSub}</Text>
        </View>
        <View style={styles.segment}>
          <SegBtn label="ES" active={lang === 'es'} onPress={() => setLang('es' as Lang)} />
          <SegBtn label="EN" active={lang === 'en'} onPress={() => setLang('en' as Lang)} />
        </View>
      </View>

      {/* Difficulty segmented control — drives the continuous-play pool. */}
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.title}>{t.settings.difficultyTitle}</Text>
          <Text style={styles.subtitle}>{t.settings.difficultySub}</Text>
        </View>
      </View>
      <View style={styles.diffRow}>
        {DIFFS.map((d) => (
          <Pressable
            key={d}
            onPress={() => update({ difficulty: d })}
            style={[styles.diffBtn, settings.difficulty === d && styles.diffBtnActive]}
          >
            <Text style={[styles.diffText, settings.difficulty === d && styles.diffTextActive]}>
              {t.diff[d]}
            </Text>
          </Pressable>
        ))}
      </View>

      <Row
        title={t.settings.soundTitle}
        subtitle={t.settings.soundSub}
        value={soundEnabled}
        onValueChange={() => toggleSound()}
      />
      <Row
        title={t.settings.relaxedTitle}
        subtitle={t.settings.relaxedSub}
        value={settings.relaxed}
        onValueChange={(v) => update({ relaxed: v })}
      />
      <Row
        title={t.settings.notifTitle}
        subtitle={t.settings.notifSub}
        value={settings.notifications}
        onValueChange={(v) => update({ notifications: v })}
      />

      <Text style={styles.version}>{t.settings.version}</Text>
    </ScrollView>
  );
}

function Row({
  title,
  subtitle,
  value,
  onValueChange,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor="#fff"
      />
    </View>
  );
}

function SegBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.segBtn, active && styles.segBtnActive]}>
      <Text style={[styles.segText, active && styles.segTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowText: { flex: 1, paddingRight: 12 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  subtitle: { color: colors.textDim, fontSize: 12, marginTop: 4, lineHeight: 17 },
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: 20, padding: 3 },
  segBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18 },
  segBtnActive: { backgroundColor: colors.accent },
  segText: { color: colors.textDim, fontWeight: '800', fontSize: 13 },
  segTextActive: { color: '#0B1026' },
  diffRow: { flexDirection: 'row', gap: 8, marginTop: -4 },
  diffBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  diffBtnActive: { borderColor: colors.borderGold, backgroundColor: colors.selected },
  diffText: { color: colors.textDim, fontFamily: monoFont, fontWeight: '800', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  diffTextActive: { color: colors.accent },
  version: { color: colors.textDim, textAlign: 'center', marginTop: 20, fontSize: 12 },
});
