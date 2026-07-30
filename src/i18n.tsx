import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { getSettings, saveSettings } from './storage/store';

export type Lang = 'es' | 'en';

/**
 * All UI copy, in both languages. NOTE: puzzle *content* (group themes and
 * explanations, card names) stays in Spanish by design — this app is a
 * Spanish word game; only the surrounding UI chrome is translated.
 *
 * ON THE WORD "LOTERÍA": it is a contested trademark whose owner is actively
 * litigating, so it does not appear anywhere in this file, in the app name, or
 * in a store title. It survives only inside full descriptive sentences in
 * app/legal.tsx ("inspirado en la lotería mexicana"), lowercase, naming the
 * tradition rather than labelling the product. Keep it that way; the store
 * keywords field carries the search term instead. See
 * claude/coplas-monetization.md and the legal notes for the reasoning.
 */
const STRINGS = {
  es: {
    nav: { play: 'Jugar', archive: 'Archivo', stats: 'Estadísticas', settings: 'Ajustes', howToPlay: 'Cómo jugar', home: 'Inicio', more: 'Ajustes y más' },
    home: {
      tagline: 'Agrupa las cartas de la baraja mexicana.',
      todaysCopla: 'Copla de hoy',
      play: 'Jugar',
      viewResult: 'Ver resultado',
      playedNote: 'Ya jugaste la de hoy — vuelve mañana.',
      streak: 'Racha',
      best: 'Mejor',
      wins: 'Victorias',
      howToPlay: '¿Cómo se juega?',
      howToPlayHint: 'Aprende las reglas en 20 segundos',
      archiveHint: 'Juega coplas anteriores',
      statsHint: 'Tu racha y aciertos',
      settingsHint: 'Modo relajado, idioma',
      moreHint: 'Cómo jugar, archivo, estadísticas y ajustes',
    },
    play: {
      subtitle: 'Encuentra los 4 grupos de 4.',
      relaxed: 'modo relajado',
      errors: 'Errores: ',
      oneAway: '¡Casi! Te faltó una.',
      shuffle: 'Barajar',
      remove: 'Quitar',
      submit: 'Enviar',
      hint: '💡 Pista',
      hintNote: 'Usaste una pista',
      perfect: '¡Sin errores! ✨',
      solved: '¡Resuelto! 🎉',
      lost: 'Se acabó 😅',
      lostNote: 'Los grupos ya se muestran arriba.',
      share: 'Compartir',
      loading: 'Cargando…',
      round: 'Ronda',
      nextRound: 'Siguiente ronda',
      sessionWon: 'ganadas',
      correctCheer: '¡Bien hecho!',
      wrongCheer: '¡Uy! Intenta otra',
    },
    archive: {
      note: 'Vuelve a jugar cualquier copla anterior.',
      lock: '🔒 Archivo',
      play: 'Jugar ›',
      perfect: '✨ Perfecto',
      failed: '✗ Fallada',
      err: (n: number) => `✓ ${n} err.`,
    },
    // Compra única del archivo. Todo esto queda inerte mientras IAP_ENABLED
    // sea false (ver src/purchases/config.ts) — nada se bloquea en pruebas.
    iap: {
      title: 'Archivo completo',
      blurb:
        'La copla de hoy siempre es gratis. Desbloquea el archivo completo y vuelve a jugar cualquier copla anterior, para siempre.',
      b1: 'Todas las coplas anteriores, sin límite',
      b2: (n: number) => `Las ${n} cartas de la baraja, animadas`,
      b3: 'Pago único — sin suscripción, sin anuncios',
      cta: 'Desbloquear',
      ctaBusy: 'Procesando…',
      owned: 'Archivo desbloqueado ✓',
      ownedNote: 'Gracias. Ya tienes acceso a todas las coplas.',
      restore: 'Restaurar compra',
      restoreHint: '¿Ya lo compraste? Recupéralo aquí.',
      restoredOk: 'Listo, tu archivo está desbloqueado.',
      restoredNone: 'No encontramos una compra en esta cuenta.',
      failed: 'No se pudo completar la compra. Inténtalo de nuevo.',
      unavailable: 'La tienda no está disponible en este momento.',
      legal:
        'Pago único a través de tu tienda de aplicaciones. Al comprar aceptas los Términos y la Política de privacidad.',
      lockedCta: 'Desbloquear el archivo',
      freeNote: (n: number) => `Las ${n} coplas más recientes son siempre gratis.`,
    },
    stats: {
      played: 'Jugadas',
      wins: 'Victorias',
      streak: 'Racha',
      best: 'Mejor racha',
      perfect: 'Perfectas',
      noError: 'Sin error',
      errorsPerWin: 'Errores por victoria',
      empty: 'Aún no juegas ninguna copla. ¡Empieza hoy!',
      loading: 'Cargando…',
    },
    settings: {
      relaxedTitle: 'Modo relajado',
      relaxedSub:
        'Sin límite de errores. Las partidas en este modo no cuentan para tu racha.',
      langTitle: 'Idioma / Language',
      langSub: 'Cambia el idioma de la app. Los nombres de las cartas siguen en español.',
      notifTitle: 'Notificaciones',
      notifSub:
        'Aviso diario cuando la nueva copla esté lista. (Se conectará en una próxima versión.)',
      soundTitle: 'Sonido',
      soundSub: 'Música de fondo y efectos durante el juego.',
      difficultyTitle: 'Dificultad',
      difficultySub: 'Qué tan tramposas son las agrupaciones. En Difícil las cartas engañan más.',
      version: 'Coplas · versión 0.1.0 (prototipo)',
      groupGame: 'El juego',
      groupPrefs: 'Preferencias',
      groupAbout: 'Información',
      terms: 'Términos y condiciones',
      termsHint: 'Las reglas del servicio',
      privacy: 'Privacidad',
      privacyHint: 'Qué datos guardamos (y cuáles no)',
      about: 'Acerca de Coplas',
      aboutHint: 'Quién lo hace y con qué',
      updateTitle: 'Buscar actualización',
      updateHint: 'Toca para traer la última versión',
      updateChecking: 'Buscando…',
      updateDownloading: 'Descargando… la app se reiniciará',
      updateNone: 'Ya tienes la versión más reciente',
      updateUnavailable: 'No disponible en esta versión',
    },
    diff: { facil: 'Fácil', media: 'Media', dificil: 'Difícil' } as Record<string, string>,
    tier: { 1: 'Fácil', 2: 'Media', 3: 'Difícil', 4: 'Trampa' } as Record<number, string>,
  },
  en: {
    nav: { play: 'Play', archive: 'Archive', stats: 'Stats', settings: 'Settings', howToPlay: 'How to play', home: 'Home', more: 'Settings & more' },
    home: {
      tagline: 'Group the cards of the Mexican deck.',
      todaysCopla: "Today's copla",
      play: 'Play',
      viewResult: 'View result',
      playedNote: 'You already played today — come back tomorrow.',
      streak: 'Streak',
      best: 'Best',
      wins: 'Wins',
      howToPlay: 'How to play?',
      howToPlayHint: 'Learn the rules in 20 seconds',
      archiveHint: 'Play past coplas',
      statsHint: 'Your streak and wins',
      settingsHint: 'Relaxed mode, language',
      moreHint: 'How to play, archive, stats and settings',
    },
    play: {
      subtitle: 'Find the 4 groups of 4.',
      relaxed: 'relaxed mode',
      errors: 'Mistakes: ',
      oneAway: 'So close! One away.',
      shuffle: 'Shuffle',
      remove: 'Deselect',
      submit: 'Submit',
      hint: '💡 Hint',
      hintNote: 'You used a hint',
      perfect: 'Flawless! ✨',
      solved: 'Solved! 🎉',
      lost: 'Out of tries 😅',
      lostNote: 'The groups are shown above.',
      share: 'Share',
      loading: 'Loading…',
      round: 'Round',
      nextRound: 'Next round',
      sessionWon: 'won',
      correctCheer: 'Nice!',
      wrongCheer: 'Oops! Try again',
    },
    archive: {
      note: 'Replay any earlier copla.',
      lock: '🔒 Archive',
      play: 'Play ›',
      perfect: '✨ Perfect',
      failed: '✗ Failed',
      err: (n: number) => `✓ ${n} mist.`,
    },
    // One-time archive unlock. All of this stays inert while IAP_ENABLED is
    // false (see src/purchases/config.ts) — nothing is gated during testing.
    iap: {
      title: 'Full archive',
      blurb:
        "Today's copla is always free. Unlock the full archive and replay any earlier copla, forever.",
      b1: 'Every past copla, no limit',
      b2: (n: number) => `All ${n} cards in the deck, animated`,
      b3: 'One-time purchase — no subscription, no ads',
      cta: 'Unlock',
      ctaBusy: 'Working…',
      owned: 'Archive unlocked ✓',
      ownedNote: 'Thank you. You have access to every copla.',
      restore: 'Restore purchase',
      restoreHint: 'Already bought it? Get it back here.',
      restoredOk: 'Done — your archive is unlocked.',
      restoredNone: "We couldn't find a purchase on this account.",
      failed: "That purchase didn't go through. Please try again.",
      unavailable: 'The store is unavailable right now.',
      legal:
        'One-time purchase through your app store. By buying you accept the Terms and the Privacy Policy.',
      lockedCta: 'Unlock the archive',
      freeNote: (n: number) => `The ${n} most recent coplas are always free.`,
    },
    stats: {
      played: 'Played',
      wins: 'Wins',
      streak: 'Streak',
      best: 'Best streak',
      perfect: 'Perfect',
      noError: 'No mistakes',
      errorsPerWin: 'Mistakes per win',
      empty: "You haven't played a copla yet. Start today!",
      loading: 'Loading…',
    },
    settings: {
      relaxedTitle: 'Relaxed mode',
      relaxedSub:
        "No mistake limit. Games in this mode don't count toward your streak.",
      langTitle: 'Idioma / Language',
      langSub: 'Switch the app language. Card names stay in Spanish.',
      notifTitle: 'Notifications',
      notifSub:
        'Daily reminder when the new copla is ready. (Coming in a later version.)',
      soundTitle: 'Sound',
      soundSub: 'Background music and effects during play.',
      difficultyTitle: 'Difficulty',
      difficultySub: 'How tricky the groupings are. Hard leans on decoys and wordplay.',
      version: 'Coplas · version 0.1.0 (prototype)',
      groupGame: 'The game',
      groupPrefs: 'Preferences',
      groupAbout: 'Information',
      terms: 'Terms & conditions',
      termsHint: 'The rules of the service',
      privacy: 'Privacy',
      privacyHint: 'What we store (and what we don’t)',
      about: 'About Coplas',
      aboutHint: 'Who makes it, and with what',
      updateTitle: 'Check for update',
      updateHint: 'Tap to pull the latest version',
      updateChecking: 'Checking…',
      updateDownloading: 'Downloading… the app will restart',
      updateNone: 'You’re on the latest version',
      updateUnavailable: 'Not available in this build',
    },
    diff: { facil: 'Easy', media: 'Medium', dificil: 'Hard' } as Record<string, string>,
    tier: { 1: 'Easy', 2: 'Medium', 3: 'Hard', 4: 'Trap' } as Record<number, string>,
  },
};

export type Strings = (typeof STRINGS)['es'];

interface I18nValue {
  lang: Lang;
  t: Strings;
  setLang: (l: Lang) => void;
  ready: boolean;
}

const I18nContext = createContext<I18nValue>({
  lang: 'es',
  t: STRINGS.es,
  setLang: () => {},
  ready: false,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('es');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      setLangState(s.lang);
      setReady(true);
    });
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    saveSettings({ lang: l });
  };

  return (
    <I18nContext.Provider value={{ lang, t: STRINGS[lang], setLang, ready }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
