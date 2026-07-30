import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, displayFont, tierColors } from '../src/theme';
import { getCard } from '../src/data/cards';
import { CardTile } from '../src/components/CardTile';
import { ScenicBackground } from '../src/components/ScenicBackground';
import { useI18n } from '../src/i18n';
import { saveSettings } from '../src/storage/store';

/** Bilingual copy for the tutorial. */
const T = {
  es: {
    skip: 'Saltar',
    next: 'Siguiente',
    stepOf: (a: number, b: number) => `${a} de ${b}`,
    goalTitle: 'El objetivo',
    goalBody:
      'Cada día hay 16 cartas que esconden 4 grupos de 4. Tu misión es encontrar los cuatro grupos.',
    goalHint: 'Toca 4 cartas que crees que van juntas y presiona «Enviar».',
    tryTitle: 'Pruébalo',
    tryPrompt: 'Selecciona las 4 cosas del cielo.',
    check: 'Comprobar',
    tryWrong: 'Casi. Fíjate bien: busca solo lo que está en el cielo.',
    tryRight: '¡Eso es! Así se forma un grupo. 🎉',
    rulesTitle: 'Las reglas',
    rulesMistakes:
      'Tienes 4 intentos fallidos. Si te equivocas 4 veces, se acaba la ronda.',
    rulesColors:
      'Al resolver, cada grupo revela su nivel por color: verde (fácil) hasta morado (trampa).',
    rulesTrap:
      'Cuidado: algunas cartas parecen de un grupo pero pertenecen a otro. Esa es la trampa.',
    readyTitle: '¡Listo!',
    readyBody: 'Una copla nueva cada día. Resuélvela y mantén tu racha.',
    start: 'Empezar a jugar',
  },
  en: {
    skip: 'Skip',
    next: 'Next',
    stepOf: (a: number, b: number) => `${a} of ${b}`,
    goalTitle: 'The goal',
    goalBody:
      'Every day there are 16 cards hiding 4 groups of 4. Your job is to find all four groups.',
    goalHint: 'Tap 4 cards you think belong together, then press “Enviar” (Submit).',
    tryTitle: 'Try it',
    tryPrompt: 'Select the 4 things in the sky.',
    check: 'Check',
    tryWrong: 'Almost. Look again — pick only the things in the sky.',
    tryRight: "That's it! That's how a group works. 🎉",
    rulesTitle: 'The rules',
    rulesMistakes: 'You get 4 wrong guesses. Miss 4 times and the round ends.',
    rulesColors:
      'When solved, each group reveals its level by color: green (easy) to purple (trap).',
    rulesTrap:
      'Watch out: some cards look like one group but belong to another. That is the trap.',
    readyTitle: "You're ready!",
    readyBody: 'A new copla every day. Solve it and keep your streak alive.',
    start: 'Start playing',
  },
} as const;

const STEPS = 4;

// Practice: 4 "sky" cards + 4 distractors.
const SKY = ['la_luna', 'la_estrella', 'el_sol', 'el_mundo'];
const PRACTICE_BOARD = [
  'la_luna',
  'el_gallo',
  'la_estrella',
  'la_rosa',
  'el_sol',
  'el_tambor',
  'el_mundo',
  'el_pescado',
];

export default function Tutorial() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lang, setLang } = useI18n();

  const [step, setStep] = useState(0);

  // Practice state
  const [selected, setSelected] = useState<string[]>([]);
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState(false);

  const t = T[lang];

  async function finish() {
    await saveSettings({ tutorialDone: true });
    router.back();
  }

  function toggle(id: string) {
    if (solved) return;
    setWrong(false);
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : s.length >= 4 ? s : [...s, id]
    );
  }

  function check() {
    const ok = selected.length === 4 && SKY.every((id) => selected.includes(id));
    if (ok) {
      setSolved(true);
    } else {
      setWrong(true);
      setSelected([]);
    }
  }

  const canAdvance = step !== 1 || solved;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScenicBackground />
      {/* Header: language toggle + skip */}
      <View style={styles.head}>
        <View style={styles.langToggle}>
          <LangBtn label="ES" active={lang === 'es'} onPress={() => setLang('es')} />
          <LangBtn label="EN" active={lang === 'en'} onPress={() => setLang('en')} />
        </View>
        <Pressable onPress={finish} hitSlop={10}>
          <Text style={styles.skip}>{t.skip}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {step === 0 && (
          <Step title={t.goalTitle}>
            <Text style={styles.p}>{t.goalBody}</Text>
            <View style={styles.miniGrid}>
              {Array.from({ length: 16 }).map((_, i) => (
                <View
                  key={i}
                  style={[styles.miniCell, { backgroundColor: colors.surfaceAlt }]}
                />
              ))}
            </View>
            <Text style={styles.hint}>{t.goalHint}</Text>
          </Step>
        )}

        {step === 1 && (
          <Step title={t.tryTitle}>
            <Text style={styles.p}>{t.tryPrompt}</Text>
            <View style={styles.practice}>
              {[0, 1].map((r) => (
                <View key={r} style={styles.row}>
                  {PRACTICE_BOARD.slice(r * 4, r * 4 + 4).map((id) => (
                    <CardTile
                      key={id}
                      card={getCard(id)}
                      selected={selected.includes(id)}
                      disabled={solved}
                      onPress={toggle}
                    />
                  ))}
                </View>
              ))}
            </View>
            {solved ? (
              <Text style={styles.good}>{t.tryRight}</Text>
            ) : (
              <>
                {wrong && <Text style={styles.bad}>{t.tryWrong}</Text>}
                <Pressable
                  onPress={check}
                  disabled={selected.length !== 4}
                  style={({ pressed }) => [
                    styles.checkBtn,
                    selected.length !== 4 && styles.disabled,
                    pressed && selected.length === 4 && styles.pressed,
                  ]}
                >
                  <Text style={styles.checkText}>{t.check}</Text>
                </Pressable>
              </>
            )}
          </Step>
        )}

        {step === 2 && (
          <Step title={t.rulesTitle}>
            <Bullet dotColor={colors.danger} text={t.rulesMistakes} />
            <View style={styles.tierRow}>
              {([1, 2, 3, 4] as const).map((tier) => (
                <View
                  key={tier}
                  style={[styles.tierChip, { backgroundColor: tierColors[tier] }]}
                />
              ))}
            </View>
            <Bullet dotColor={colors.accent} text={t.rulesColors} />
            <Bullet dotColor="#9B5DE5" text={t.rulesTrap} />
          </Step>
        )}

        {step === 3 && (
          <Step title={t.readyTitle}>
            <Text style={styles.bigEmoji}>🎴</Text>
            <Text style={styles.p}>{t.readyBody}</Text>
          </Step>
        )}
      </ScrollView>

      {/* Footer: progress dots + next/start */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <View style={styles.dots}>
          {Array.from({ length: STEPS }).map((_, i) => (
            <View key={i} style={[styles.pdot, i === step && styles.pdotActive]} />
          ))}
        </View>
        {step < STEPS - 1 ? (
          <Pressable
            onPress={() => setStep((s) => s + 1)}
            disabled={!canAdvance}
            style={({ pressed }) => [
              styles.nextBtn,
              !canAdvance && styles.disabled,
              pressed && canAdvance && styles.pressed,
            ]}
          >
            <Text style={styles.nextText}>{t.next}</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={finish}
            style={({ pressed }) => [styles.nextBtn, pressed && styles.pressed]}
          >
            <Text style={styles.nextText}>{t.start}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.step}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

function LangBtn({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.langBtn, active && styles.langBtnActive]}>
      <Text style={[styles.langBtnText, active && styles.langBtnTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Bullet({ dotColor, text }: { dotColor: string; text: string }) {
  return (
    <View style={styles.bullet}>
      <View style={[styles.bulletDot, { backgroundColor: dotColor }]} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  langToggle: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 20, padding: 3 },
  langBtn: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 18 },
  langBtnActive: { backgroundColor: colors.accent },
  langBtnText: { color: colors.textDim, fontWeight: '800', fontSize: 13 },
  langBtnTextActive: { color: '#0B1026' },
  skip: { color: colors.textDim, fontWeight: '700', fontSize: 15 },
  body: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20 },
  step: { alignItems: 'center' },
  title: { color: colors.text, fontFamily: displayFont, fontSize: 30, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  p: { color: colors.text, fontSize: 17, lineHeight: 25, textAlign: 'center', marginBottom: 14 },
  hint: { color: colors.textDim, fontSize: 14, textAlign: 'center', marginTop: 6, fontStyle: 'italic' },
  miniGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 148,
    gap: 6,
    justifyContent: 'center',
    marginVertical: 10,
  },
  miniCell: { width: 30, height: 30, borderRadius: 6 },
  practice: { marginVertical: 10, alignSelf: 'stretch' },
  row: { flexDirection: 'row' },
  good: { color: colors.success, fontWeight: '800', fontSize: 16, textAlign: 'center', marginTop: 10 },
  bad: { color: colors.danger, fontWeight: '700', fontSize: 14, textAlign: 'center', marginBottom: 8 },
  checkBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 40,
    paddingVertical: 13,
    borderRadius: 6,
    alignSelf: 'center',
    marginTop: 8,
  },
  checkText: { color: '#0B1026', fontWeight: '800', fontSize: 16 },
  tierRow: { flexDirection: 'row', gap: 8, marginVertical: 14 },
  tierChip: { width: 46, height: 14, borderRadius: 4 },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, alignSelf: 'stretch' },
  bulletDot: { width: 12, height: 12, borderRadius: 6, marginTop: 5, marginRight: 12 },
  bulletText: { color: colors.text, fontSize: 16, lineHeight: 23, flex: 1 },
  bigEmoji: { fontSize: 72, marginBottom: 10 },
  footer: { paddingHorizontal: 20, paddingTop: 10 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 14 },
  pdot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  pdotActive: { backgroundColor: colors.accent, width: 22 },
  nextBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  nextText: { color: '#0B1026', fontWeight: '800', fontSize: 18 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
});
