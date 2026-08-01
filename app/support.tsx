import { useLayoutEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, displayFont, floatShadow, monoFont } from '../src/theme';
import { useI18n } from '../src/i18n';
import { GradientButton } from '../src/components/GradientButton';
import { SUPPORT_EMAIL, buildInfo, diagnostics, openMail } from '../src/support';

/**
 * Support and bug reporting.
 *
 * Two buttons, not one. "Report a bug" and "Write to us" open the same mailbox
 * but with different subjects and different starting text, because the two
 * asks want different things from the player: a bug wants steps and what they
 * expected, a message wants nothing in particular. A single generic button
 * gets generic mail.
 *
 * The build line is printed on screen, not only buried in the mail body. When
 * a player writes from a different device, or their mail app strips the
 * signature, or they reach us through the store instead, that line is the
 * thing we ask for first — so it is visible and copyable without composing
 * anything.
 */
export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const { t, lang } = useI18n();
  const navigation = useNavigation();
  const [note, setNote] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t.support.title });
  }, [navigation, t]);

  async function compose(subject: string, intro: string) {
    const body = `${intro}\n\n\n—————————————\n${diagnostics({ lang })}`;
    // A device with no mail client must not leave the player tapping a dead
    // button. The address and build line at the bottom of this screen are
    // `selectable`, so the fallback is to say so and let them long-press it —
    // rather than pull in expo-clipboard, a native module added to one screen
    // for one line of text.
    if (!(await openMail(subject, body))) setNote(t.support.noMail);
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 34 }]}>
      <Text style={styles.lead}>{t.support.lead}</Text>

      <View style={styles.block}>
        <Text style={styles.h}>{t.support.bugTitle}</Text>
        <Text style={styles.p}>{t.support.bugBody}</Text>
        <GradientButton
          label={t.support.bugCta}
          onPress={() => compose(t.support.bugSubject, t.support.bugTemplate)}
        />
      </View>

      <View style={styles.block}>
        <Text style={styles.h}>{t.support.contactTitle}</Text>
        <Text style={styles.p}>{t.support.contactBody}</Text>
        <GradientButton
          label={t.support.contactCta}
          onPress={() => compose(t.support.contactSubject, '')}
        />
      </View>

      <View style={styles.block}>
        <Text style={styles.h}>{t.support.privacyTitle}</Text>
        <Text style={styles.p}>{t.support.privacyBody}</Text>
      </View>

      {/* selectable: long-press to copy, with no native clipboard module. This
          is also the only route to us if the device has no mail app at all. */}
      <View style={styles.stampBox}>
        <Text selectable style={styles.stamp}>
          {SUPPORT_EMAIL}
        </Text>
        <Text selectable style={styles.stamp}>
          {buildInfo()}
        </Text>
        <Text style={styles.stampHint}>{note ?? t.support.tapToCopy}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 6 },
  lead: {
    color: colors.text,
    fontFamily: displayFont,
    fontSize: 20,
    lineHeight: 29,
    marginBottom: 24,
    ...floatShadow,
  },
  block: { marginBottom: 30 },
  h: {
    color: colors.accent,
    fontFamily: displayFont,
    fontSize: 21,
    fontWeight: '700',
    marginBottom: 8,
    ...floatShadow,
  },
  // 16pt with generous leading: this screen is read by someone who is already
  // annoyed, on a photographic background. Small dim type would be a joke.
  p: {
    color: colors.textDim,
    fontSize: 16,
    lineHeight: 25,
    marginBottom: 16,
    ...floatShadow,
  },
  stampBox: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(244,185,66,0.15)',
    paddingTop: 18,
    alignItems: 'center',
  },
  stamp: {
    color: colors.textDim,
    fontFamily: monoFont,
    fontSize: 13,
    letterSpacing: 0.6,
    marginBottom: 4,
    ...floatShadow,
  },
  stampHint: {
    color: colors.accent,
    fontFamily: monoFont,
    fontSize: 12,
    letterSpacing: 1,
    marginTop: 6,
    opacity: 0.9,
    textAlign: 'center',
    ...floatShadow,
  },
});
