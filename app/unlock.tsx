import { useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, displayFont, floatShadow, monoFont } from '../src/theme';
import { useI18n } from '../src/i18n';
import { usePurchases } from '../src/purchases';
import { FREE_ARCHIVE_WINDOW } from '../src/purchases/config';
import { CARDS } from '../src/data/cards';

/**
 * The paywall.
 *
 * Reachable only when `gateActive` is true; while IAP_ENABLED is false the
 * routes that push here are not rendered, and if someone deep-links in anyway
 * (the `coplas://unlock` scheme is public) they get the "nothing to buy" state
 * rather than a dead button.
 *
 * Deliberately honest about what is free: App Review rejects paywalls that
 * obscure what the free tier includes, and players resent them. The first line
 * the eye lands on is "today's copla is always free".
 */
export default function Unlock() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { ready, gateActive, unlocked, price, pkg, busy, error, clearError, purchase, restore } =
    usePurchases();
  const [notice, setNotice] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t.iap.title });
  }, [navigation, t]);

  // Surface SDK failures through the same one-line notice slot as everything
  // else, then clear them so they don't persist across a retry.
  useEffect(() => {
    if (error) {
      setNotice(t.iap.failed);
      clearError();
    }
  }, [error, clearError, t]);

  const onBuy = async () => {
    setNotice(null);
    const ok = await purchase();
    if (ok) router.back();
  };

  const onRestore = async () => {
    setNotice(null);
    const ok = await restore();
    setNotice(ok ? t.iap.restoredOk : t.iap.restoredNone);
    if (ok) setTimeout(() => router.back(), 900);
  };

  // Already a customer — no selling, just an acknowledgement.
  if (unlocked) {
    return (
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 30 }]}>
        <Text style={styles.owned}>{t.iap.owned}</Text>
        <Text style={styles.blurb}>{t.iap.ownedNote}</Text>
      </ScrollView>
    );
  }

  const canBuy = gateActive && !!pkg && !busy;

  return (
    <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 30 }]}>
      <Text style={styles.h1}>{t.iap.title}</Text>
      <Text style={styles.blurb}>{t.iap.blurb}</Text>

      <View style={styles.bullets}>
        <Bullet>{t.iap.b1}</Bullet>
        {/* Derived, never hardcoded — the deck size moves whenever a card is
            added or retired, and a paywall that overstates what you get is
            exactly the kind of claim App Review reads as misleading. */}
        <Bullet>{t.iap.b2(CARDS.length)}</Bullet>
        <Bullet>{t.iap.b3}</Bullet>
      </View>

      <Text style={styles.freeNote}>{t.iap.freeNote(FREE_ARCHIVE_WINDOW)}</Text>

      <Pressable
        disabled={!canBuy}
        onPress={onBuy}
        style={({ pressed }) => [styles.cta, !canBuy && styles.ctaOff, pressed && styles.pressed]}
      >
        {busy ? (
          <ActivityIndicator color={colors.ink} />
        ) : (
          <Text style={styles.ctaText}>
            {t.iap.cta}
            {gateActive ? `  ·  ${price}` : ''}
          </Text>
        )}
      </Pressable>

      {/* When offerings haven't loaded (or the gate is off) say so plainly
          instead of leaving a button that does nothing when tapped. */}
      {!busy && (!gateActive || !pkg) && ready && (
        <Text style={styles.notice}>{t.iap.unavailable}</Text>
      )}

      {!!notice && <Text style={styles.notice}>{notice}</Text>}

      {/* Apple requires a visible, working Restore control on any screen that
          sells a non-consumable. Guideline 3.1.1. */}
      <Pressable disabled={busy || !gateActive} onPress={onRestore} style={styles.restoreBtn}>
        <Text style={styles.restore}>{t.iap.restore}</Text>
      </Pressable>

      <Text style={styles.legal}>{t.iap.legal}</Text>
      <View style={styles.legalLinks}>
        <Link href="/legal?doc=terms" style={styles.legalLink}>
          {t.settings.terms}
        </Link>
        <Text style={styles.legalDot}>·</Text>
        <Link href="/legal?doc=privacy" style={styles.legalLink}>
          {t.settings.privacy}
        </Link>
      </View>
    </ScrollView>
  );
}

function Bullet({ children }: { children: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletMark}>✦</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 6, gap: 14 },
  h1: { color: colors.text, fontFamily: displayFont, fontSize: 27, fontWeight: '700', ...floatShadow },
  blurb: { color: colors.textDim, fontSize: 15, lineHeight: 22, ...floatShadow },
  bullets: { gap: 10, marginTop: 4 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletMark: { color: colors.accent, fontSize: 14, lineHeight: 21 },
  bulletText: { color: colors.text, fontSize: 15, lineHeight: 21, flex: 1, ...floatShadow },
  freeNote: { color: colors.textDim, fontSize: 13, lineHeight: 19, marginTop: 2, ...floatShadow },
  cta: {
    marginTop: 10,
    backgroundColor: colors.accent,
    borderRadius: 5,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  ctaOff: { opacity: 0.45 },
  ctaText: {
    color: colors.ink,
    fontFamily: monoFont,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  pressed: { opacity: 0.75 },
  notice: { color: colors.textDim, fontSize: 13, lineHeight: 19, textAlign: 'center', ...floatShadow },
  restoreBtn: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  restore: { color: colors.accent, fontWeight: '700', fontSize: 15, ...floatShadow },
  owned: {
    color: colors.success,
    fontFamily: displayFont,
    fontSize: 24,
    fontWeight: '700',
    marginTop: 10,
    ...floatShadow,
  },
  legal: {
    color: colors.textDim,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 6,
    opacity: 0.85,
    ...floatShadow,
  },
  legalLinks: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  legalLink: { color: colors.accent, fontSize: 12, ...floatShadow },
  legalDot: { color: colors.textDim, fontSize: 12 },
});
