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
 */
const STRINGS = {
  es: {
    nav: { play: 'Jugar', archive: 'Archivo', stats: 'Estadísticas', settings: 'Ajustes', howToPlay: 'Cómo jugar', home: 'Inicio' },
    home: {
      tagline: 'Agrupa las cartas de la Lotería.',
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
      note: (n: number) =>
        `Las últimas ${n} coplas son gratis. El archivo completo se desbloqueará con una compra (próximamente).`,
      lock: '🔒 Archivo',
      play: 'Jugar ›',
      perfect: '✨ Perfecto',
      failed: '✗ Fallada',
      err: (n: number) => `✓ ${n} err.`,
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
    },
    diff: { facil: 'Fácil', media: 'Media', dificil: 'Difícil' } as Record<string, string>,
    tier: { 1: 'Fácil', 2: 'Media', 3: 'Difícil', 4: 'Trampa' } as Record<number, string>,
  },
  en: {
    nav: { play: 'Play', archive: 'Archive', stats: 'Stats', settings: 'Settings', howToPlay: 'How to play', home: 'Home' },
    home: {
      tagline: 'Group the Lotería cards.',
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
      note: (n: number) =>
        `The latest ${n} coplas are free. The full archive unlocks with a purchase (coming soon).`,
      lock: '🔒 Archive',
      play: 'Play ›',
      perfect: '✨ Perfect',
      failed: '✗ Failed',
      err: (n: number) => `✓ ${n} mist.`,
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
