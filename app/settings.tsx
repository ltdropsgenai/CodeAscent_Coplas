import { useCallback, useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, displayFont, floatShadow, monoFont } from '../src/theme';
import { useI18n, type Lang } from '../src/i18n';
import { useAudio } from '../src/audio';
import { NavGroupLabel, NavRow } from '../src/components/NavRow';
import { UpdateRow } from '../src/components/UpdateRow';
import { usePurchases } from '../src/purchases';
import { setReminderEnabled } from '../src/notify';
import { openStoreListing } from '../src/rate';
import { DEFAULT_SETTINGS, getSettings, saveSettings, type Settings } from '../src/storage/store';
import type { Difficulty } from '../src/types';

const DIFFS: Difficulty[] = ['facil', 'media', 'dificil'];

/**
 * What plays under a round. Three modes, not a switch, because "turn the music
 * off" and "I want silence" are different asks: the tick-tock exists for players
 * who wanted to feel time passing without the game ever adding a clock.
 *
 * Order is deliberate — loudest to quietest, so the row reads as a dial.
 */
const PLAY_AUDIO: Settings['playAudio'][] = ['musica', 'tictac', 'silencio'];

/**
 * The one hub behind home.
 *
 * Home is deliberately about a single action — play today's copla — so
 * everything else lands here in three groups: the game's own screens (rules,
 * archive, stats), the preferences that change how a round plays, and the
 * informational pages the App Store expects every app to carry.
 *
 * No panels. Rows are separated by gold hairlines and float on the animated
 * scene, matching home and the rest of the CodeAscent apps — bordered boxes
 * around every setting is the giveaway house style we're avoiding.
 */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { t, lang, setLang } = useI18n();
  const { soundEnabled, toggleSound, setPlayAudio } = useAudio();
  const { gateActive, unlocked, busy, restore } = usePurchases();
  const navigation = useNavigation();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [restoreNote, setRestoreNote] = useState<string | null>(null);
  const [notifNote, setNotifNote] = useState<string | null>(null);

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
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 30 }]}>
      <NavGroupLabel>{t.settings.groupGame}</NavGroupLabel>
      <NavRow href="/tutorial" label={t.home.howToPlay} hint={t.home.howToPlayHint} icon="el_naipe" first />
      <NavRow href="/archive" label={t.nav.archive} hint={t.home.archiveHint} icon="el_archivero" />
      <NavRow href="/stats" label={t.nav.stats} hint={t.home.statsHint} icon="el_trofeo" />
      <NavRow
        href="/achievements"
        label={t.settings.achievements}
        hint={t.settings.achievementsHint}
        icon="la_corona"
      />

      <NavGroupLabel>{t.settings.groupPrefs}</NavGroupLabel>

      {/* Language — drives the whole UI through i18n. */}
      <View style={[styles.row, styles.rowFirst]}>
        <View style={styles.rowText}>
          <Text style={styles.title}>{t.settings.langTitle}</Text>
          <Text style={styles.subtitle}>{t.settings.langSub}</Text>
        </View>
        <View style={styles.segment}>
          <SegBtn label="ES" active={lang === 'es'} onPress={() => setLang('es' as Lang)} />
          <SegBtn label="EN" active={lang === 'en'} onPress={() => setLang('en' as Lang)} />
        </View>
      </View>

      {/* Difficulty — sets how many trap groups the composer puts in a round. */}
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
            style={({ pressed }) => [
              styles.diffBtn,
              settings.difficulty === d && styles.diffBtnActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.diffText, settings.difficulty === d && styles.diffTextActive]}>
              {t.diff[d]}
            </Text>
          </Pressable>
        ))}
      </View>

      <ToggleRow
        title={t.settings.soundTitle}
        subtitle={t.settings.soundSub}
        value={soundEnabled}
        onValueChange={() => toggleSound()}
      />

      {/* Only meaningful while sound is on at all, so it is hidden when the
          master switch is off rather than shown as three dead buttons. */}
      {soundEnabled && (
        <>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.title}>{t.settings.playAudioTitle}</Text>
              <Text style={styles.subtitle}>{t.settings.playAudioSub}</Text>
            </View>
          </View>
          <View style={styles.diffRow}>
            {PLAY_AUDIO.map((m) => (
              <Pressable
                key={m}
                onPress={() => {
                  update({ playAudio: m });
                  // The audio engine keeps its own ref so a mode change takes
                  // effect on the CURRENT round, not the next one — a player
                  // reaching for silence mid-round means now.
                  setPlayAudio(m);
                }}
                style={({ pressed }) => [
                  styles.diffBtn,
                  settings.playAudio === m && styles.diffBtnActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[styles.diffText, settings.playAudio === m && styles.diffTextActive]}
                >
                  {t.settings[
                    `playAudio${m.charAt(0).toUpperCase()}${m.slice(1)}` as 'playAudioMusica'
                  ]}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
      <ToggleRow
        title={t.settings.relaxedTitle}
        subtitle={t.settings.relaxedSub}
        value={settings.relaxed}
        onValueChange={(v) => update({ relaxed: v })}
      />
      {/* The reminder switch reflects what is actually SCHEDULED, not what was
          tapped. `setReminderEnabled` does the permission round-trip and hands
          back the state it really achieved, so a denied prompt leaves the
          switch off with an explanation instead of on and silently dead —
          which is what it did for every build before this one. */}
      <ToggleRow
        title={t.settings.notifTitle}
        subtitle={notifNote ?? t.settings.notifSub}
        value={settings.notifications}
        onValueChange={async (v) => {
          const actual = await setReminderEnabled(v, t.reminder);
          setSettings((s) => ({ ...s, notifications: actual }));
          setNotifNote(v && !actual ? t.settings.notifDenied : null);
        }}
      />

      {/* Purchase group. The whole block is absent while the gate is off, so a
          tester never sees a Restore button that can't find anything and never
          sees a price for something they can't buy. */}
      {gateActive && (
        <>
          <NavGroupLabel>{t.iap.title}</NavGroupLabel>
          {unlocked ? (
            <View style={[styles.row, styles.rowFirst]}>
              <View style={styles.rowText}>
                <Text style={styles.title}>{t.iap.owned}</Text>
                <Text style={styles.subtitle}>{t.iap.ownedNote}</Text>
              </View>
            </View>
          ) : (
            <NavRow
              href="/unlock"
              label={t.iap.lockedCta}
              hint={t.iap.b1}
              icon="la_llave"
              first
            />
          )}
          {/* Apple guideline 3.1.1: a non-consumable must be restorable from
              somewhere the player can find without having hit the paywall. */}
          <Pressable
            disabled={busy}
            onPress={async () => {
              const ok = await restore();
              setRestoreNote(ok ? t.iap.restoredOk : t.iap.restoredNone);
            }}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.rowText}>
              <Text style={styles.title}>{t.iap.restore}</Text>
              <Text style={styles.subtitle}>{restoreNote ?? t.iap.restoreHint}</Text>
            </View>
          </Pressable>
        </>
      )}

      <NavGroupLabel>{t.settings.groupAbout}</NavGroupLabel>
      <NavRow
        href="/legal?doc=about"
        label={t.settings.about}
        hint={t.settings.aboutHint}
        icon="el_corazon"
        first
      />
      <NavRow
        href="/legal?doc=terms"
        label={t.settings.terms}
        hint={t.settings.termsHint}
        icon="el_pergamino"
      />
      <NavRow
        href="/legal?doc=privacy"
        label={t.settings.privacy}
        hint={t.settings.privacyHint}
        icon="el_candado"
      />
      {/* Support sits in About rather than in its own group on purpose: a
          player looking for it is looking for "the boring pages", and burying
          it one level deeper is how a bug report becomes a one-star review. */}
      <NavRow
        href="/support"
        label={t.settings.support}
        hint={t.settings.supportHint}
        icon="el_sobre"
      />
      {/* Over-the-air: pulls a JS/asset fix without a new App Store build. */}
      <UpdateRow />
      {/* Always available, unlike the native review prompt, which the OS may
          decline to show. This one always opens the listing. */}
      <Pressable
        onPress={openStoreListing}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.rowText}>
          <Text style={styles.title}>{t.rate.title}</Text>
          <Text style={styles.subtitle}>{t.rate.hint}</Text>
        </View>
      </Pressable>

      <Text style={styles.version}>{t.settings.version}</Text>
    </ScrollView>
  );
}

function ToggleRow({
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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.segBtn, active && styles.segBtnActive, pressed && styles.pressed]}>
      <Text style={[styles.segText, active && styles.segTextActive]}>{label}</Text>
    </Pressable>
  );
}

const HAIRLINE = 'rgba(244,185,66,0.15)';

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
  },
  rowFirst: { borderTopWidth: 0 },
  rowText: { flex: 1, paddingRight: 14 },
  title: {
    color: colors.text,
    fontFamily: displayFont,
    fontSize: 19,
    fontWeight: '700',
    ...floatShadow,
  },
  // 14pt, not 12. These sit on a photographic background where a dim 12pt line
  // is genuinely hard to read — and the people most likely to want a Spanish
  // word game about traditional picture cards are not uniformly twenty-five.
  subtitle: { color: colors.textDim, fontSize: 14, marginTop: 4, lineHeight: 20, ...floatShadow },
  segment: { flexDirection: 'row', borderWidth: 1, borderColor: colors.borderGold, borderRadius: 4 },
  segBtn: { paddingHorizontal: 16, paddingVertical: 9 },
  segBtnActive: { backgroundColor: colors.accent },
  segText: { color: colors.textDim, fontFamily: monoFont, fontWeight: '800', fontSize: 14, letterSpacing: 1 },
  segTextActive: { color: colors.ink },
  diffRow: { flexDirection: 'row', gap: 10, paddingBottom: 4 },
  diffBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  diffBtnActive: { borderColor: colors.borderGold, backgroundColor: colors.selected },
  diffText: {
    color: colors.textDim,
    fontFamily: monoFont,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  diffTextActive: { color: colors.accent },
  pressed: { opacity: 0.6 },
  version: {
    color: colors.textDim,
    textAlign: 'center',
    marginTop: 30,
    fontFamily: monoFont,
    fontSize: 12,
    letterSpacing: 1.2,
    opacity: 0.8,
    ...floatShadow,
  },
});
