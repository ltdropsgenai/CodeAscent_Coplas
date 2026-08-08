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
      /** Screen-reader label for Abuela on Home. She is a button now. */
      abuelaHint: 'Abuela: escuchar cómo se juega',
      // Two separate features, so two separate buttons. The daily copla is one
      // board a day, identical worldwide; JUGAR is the endless stream.
      playDaily: 'Jugar la copla de hoy',
      playEndless: 'Rondas sin fin',
      endlessHint: 'Juega todas las que quieras — cada ronda se arma al momento',
      dailyHint: 'La misma para todo el mundo, hoy',
      play: 'Jugar',
      viewResult: 'Ver resultado',

      streak: 'Racha',
      best: 'Mejor',
      days: 'Días',
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
      // NOTE: this used to read "Los grupos ya se muestran arriba" while the
      // screen showed nothing of the sort — the board unmounted and the
      // unsolved groups were never rendered. Don't reintroduce a note that
      // describes something the UI isn't doing.
      lostNote: 'Se te acabaron los errores.',
      retry: 'Reintentar',
      retryNote: 'Te queda un intento. La ronda ya cuenta como perdida.',
      retryAgainNote: 'Ya usaste tu intento.',
      reveal: 'Ver la respuesta',
      revealedNote: 'Esto era lo que faltaba.',
      retriedWon: '¡La sacaste! 👏',
      retriedWonNote: 'Cuenta como perdida, pero la resolviste.',
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
      winStreak: 'Racha de victorias',
      dayStreak: 'Días seguidos',
      bestDayStreak: 'Máximo de días',
      daysPlayed: 'Días jugados',
      dayStreakLapsed: 'Tu racha de días se enfrió. Juega hoy para empezar otra.',
      byDifficulty: 'Por dificultad',
      calendar: 'Últimos 30 días',
      retried: 'Resueltas al reintentar',
      deckSeen: 'Cartas vistas',
      deckSeenNote: (seen: number, total: number) =>
        `Has visto ${seen} de ${total} cartas de la baraja.`,
      noRounds: '—',
    },
    achievements: {
      title: 'Logros',
      hint: 'Lo que has ido consiguiendo',
      count: (n: number, total: number) => `${n} de ${total} desbloqueados`,
      empty: 'Juega una ronda y empiezan a aparecer.',
      unlockedOne: '¡Logro desbloqueado!',
      unlockedMany: (n: number) => `¡${n} logros desbloqueados!`,
      names: {
        first_round: 'La primera',
        first_win: 'Primera victoria',
        flawless: 'Sin un error',
        win_streak_3: 'Tres seguidas',
        win_streak_10: 'Diez seguidas',
        win_streak_25: 'Veinticinco seguidas',
        perfect_streak_5: 'Cinco impecables',
        day_streak_3: 'Tres días',
        day_streak_7: 'Una semana',
        day_streak_10: 'Diez días',
        day_streak_30: 'Un mes entero',
        perfect_10: 'Diez perfectas',
        hard_win: 'A la difícil',
        comeback: 'La vuelta',
        deck_quarter: 'Un cuarto de baraja',
        deck_half: 'Media baraja',
        deck_all: 'La baraja completa',
      } as Record<string, string>,
      descs: {
        first_round: 'Juega tu primera ronda.',
        first_win: 'Gana una ronda.',
        flawless: 'Gana sin errores y sin pista.',
        win_streak_3: 'Gana 3 rondas seguidas.',
        win_streak_10: 'Gana 10 rondas seguidas.',
        win_streak_25: 'Gana 25 rondas seguidas.',
        perfect_streak_5: 'Gana 5 rondas seguidas sin un solo error.',
        day_streak_3: 'Juega 3 días seguidos.',
        day_streak_7: 'Juega 7 días seguidos.',
        day_streak_10: 'Juega 10 días seguidos.',
        day_streak_30: 'Juega 30 días seguidos.',
        perfect_10: 'Gana 10 rondas sin un solo error.',
        hard_win: 'Gana una ronda en dificultad Difícil.',
        comeback: 'Falla una ronda, reinténtala y resuélvela.',
        deck_quarter: 'Ve la cuarta parte de las cartas.',
        deck_half: 'Ve la mitad de las cartas.',
        deck_all: 'Ve todas las cartas de la baraja.',
      } as Record<string, string>,
    },
    support: {
      title: 'Soporte',
      lead: 'Si algo no funciona como esperabas, cuéntanoslo. Lo lee una persona.',
      bugTitle: 'Reportar un error',
      bugBody:
        'Cuéntanos qué hacías, qué esperabas que pasara y qué pasó en su lugar. Si fue en una ronda, dinos qué grupo o qué carta se veía mal. Adjuntamos solos la versión de la app y tu dispositivo, así no tenemos que preguntártelo.',
      bugCta: 'Escribir el reporte',
      bugSubject: 'Coplas — reporte de error',
      bugTemplate:
        'Qué hacía:\n\nQué esperaba:\n\nQué pasó:\n',
      contactTitle: 'Escríbenos',
      contactBody:
        'Una idea, una carta mal dibujada, una categoría que no cuadra, o solo saludar. Todo sirve.',
      contactCta: 'Enviar un mensaje',
      contactSubject: 'Coplas — mensaje',
      privacyTitle: 'Qué se envía',
      privacyBody:
        'Solo lo que escribas y las líneas técnicas que verás al final del correo: versión, sistema, idioma, dificultad y la ronda. Nada que te identifique. El correo lo mandas tú desde tu propia app de correo, así que puedes leerlo entero — y borrar lo que quieras — antes de enviarlo.',
      noMail: 'No encontramos una app de correo. Mantén pulsada la dirección para copiarla.',
      tapToCopy: 'Mantén pulsado para copiar',
      reportRound: 'Reportar un problema con esta ronda',
    },
    rate: {
      title: 'Califica Coplas',
      hint: 'Si te está gustando, dilo en la tienda',
      unavailable: 'No disponible en este dispositivo',
    },
    // Copy for the daily local notification. Kept short: a reminder that
    // needs two lines has already lost.
    reminder: {
      title: '¿Jugamos una copla?',
      body: 'Tu baraja te espera.',
    },
    settings: {
      relaxedTitle: 'Modo relajado',
      relaxedSub:
        'Sin límite de errores. Las partidas en este modo no cuentan para tu racha.',
      langTitle: 'Idioma / Language',
      langSub: 'Cambia el idioma de la app. Los nombres de las cartas siguen en español.',
      notifTitle: 'Recordatorio diario',
      notifSub: 'Un aviso al día para que no se te enfríe la racha.',
      notifDenied: 'Sin permiso de notificaciones. Actívalo en los ajustes del sistema.',
      achievements: 'Logros',
      achievementsHint: 'Lo que has ido consiguiendo',
      // Ambiente de la partida. Tres modos, no un interruptor: apagar la música
      // no es lo mismo que querer silencio, y el tic-tac existe porque varios
      // jugadores querían sentir que el tiempo pasa sin que hubiera reloj.
      playAudioTitle: 'Durante la partida',
      playAudioSub: 'Qué se oye mientras juegas. Las voces de celebración suenan en los tres.',
      playAudioMusica: 'Música',
      playAudioTictac: 'Tic-tac',
      playAudioSilencio: 'Silencio',
      support: 'Soporte y reportar un error',
      supportHint: 'Escríbenos: algo falla o quieres decirnos algo',
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
      abuelaHint: "Abuela: hear how to play",
      playDaily: "Play today's copla",
      playEndless: 'Endless rounds',
      endlessHint: 'Play as many as you like — every round is built on the spot',
      dailyHint: 'The same one for everyone, today',
      play: 'Play',
      viewResult: 'View result',

      streak: 'Streak',
      best: 'Best',
      days: 'Days',
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
      // NOTE: this used to read "The groups are shown above" while the screen
      // showed nothing of the sort — the board unmounted and the unsolved
      // groups were never rendered. Don't reintroduce a note that describes
      // something the UI isn't doing.
      lostNote: 'You are out of mistakes.',
      retry: 'Try again',
      retryAgainNote: 'You already used your retry.',
      retryNote: 'One attempt left. The round already counts as a loss.',
      reveal: 'Show the answer',
      revealedNote: 'This is what you were missing.',
      retriedWon: 'You got it! 👏',
      retriedWonNote: 'It still counts as a loss, but you solved it.',
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
      winStreak: 'Win streak',
      dayStreak: 'Day streak',
      bestDayStreak: 'Best day streak',
      daysPlayed: 'Days played',
      dayStreakLapsed: 'Your day streak went cold. Play today to start another.',
      byDifficulty: 'By difficulty',
      calendar: 'Last 30 days',
      retried: 'Solved on the retry',
      deckSeen: 'Cards seen',
      deckSeenNote: (seen: number, total: number) =>
        `You've seen ${seen} of ${total} cards in the deck.`,
      noRounds: '—',
    },
    achievements: {
      title: 'Achievements',
      hint: 'What you have picked up so far',
      count: (n: number, total: number) => `${n} of ${total} unlocked`,
      empty: 'Play a round and these start showing up.',
      unlockedOne: 'Achievement unlocked!',
      unlockedMany: (n: number) => `${n} achievements unlocked!`,
      names: {
        first_round: 'The first one',
        first_win: 'First win',
        flawless: 'Not one mistake',
        win_streak_3: 'Three in a row',
        win_streak_10: 'Ten in a row',
        win_streak_25: 'Twenty-five in a row',
        perfect_streak_5: 'Five flawless',
        day_streak_3: 'Three days',
        day_streak_7: 'A whole week',
        day_streak_10: 'Ten days',
        day_streak_30: 'A whole month',
        perfect_10: 'Ten flawless',
        hard_win: 'The hard way',
        comeback: 'The comeback',
        deck_quarter: 'A quarter of the deck',
        deck_half: 'Half the deck',
        deck_all: 'The whole deck',
      } as Record<string, string>,
      descs: {
        first_round: 'Play your first round.',
        first_win: 'Win a round.',
        flawless: 'Win with no mistakes and no hint.',
        win_streak_3: 'Win 3 rounds in a row.',
        win_streak_10: 'Win 10 rounds in a row.',
        win_streak_25: 'Win 25 rounds in a row.',
        perfect_streak_5: 'Win 5 rounds in a row without a single mistake.',
        day_streak_3: 'Play 3 days running.',
        day_streak_7: 'Play 7 days running.',
        day_streak_10: 'Play 10 days running.',
        day_streak_30: 'Play 30 days running.',
        perfect_10: 'Win 10 rounds without a single mistake.',
        hard_win: 'Win a round on Hard.',
        comeback: 'Fail a round, take the retry, and solve it.',
        deck_quarter: 'See a quarter of the cards.',
        deck_half: 'See half the cards.',
        deck_all: 'See every card in the deck.',
      } as Record<string, string>,
    },
    support: {
      title: 'Support',
      lead: 'If something is not working the way you expected, tell us. A person reads it.',
      bugTitle: 'Report a bug',
      bugBody:
        'Tell us what you were doing, what you expected, and what happened instead. If it was during a round, say which group or which card looked wrong. We attach the app version and your device automatically, so we do not have to ask.',
      bugCta: 'Write the report',
      bugSubject: 'Coplas — bug report',
      bugTemplate:
        'What I was doing:\n\nWhat I expected:\n\nWhat happened:\n',
      contactTitle: 'Write to us',
      contactBody:
        'An idea, a card drawn wrong, a category that does not add up, or just hello. All of it helps.',
      contactCta: 'Send a message',
      contactSubject: 'Coplas — message',
      privacyTitle: 'What gets sent',
      privacyBody:
        'Only what you type, plus the technical lines you will see at the end of the mail: version, system, language, difficulty and the round. Nothing that identifies you. You send the mail yourself from your own mail app, so you can read all of it — and delete any of it — before it goes.',
      noMail: 'We could not find a mail app. Long-press the address below to copy it.',
      tapToCopy: 'Long-press to copy',
      reportRound: 'Report a problem with this round',
    },
    rate: {
      title: 'Rate Coplas',
      hint: 'If you are enjoying it, say so in the store',
      unavailable: 'Not available on this device',
    },
    // Copy for the daily local notification. Kept short: a reminder that
    // needs two lines has already lost.
    reminder: {
      title: 'Time for a copla?',
      body: 'Your deck is waiting.',
    },
    settings: {
      relaxedTitle: 'Relaxed mode',
      relaxedSub:
        "No mistake limit. Games in this mode don't count toward your streak.",
      langTitle: 'Idioma / Language',
      langSub: 'Switch the app language. Card names stay in Spanish.',
      notifTitle: 'Daily reminder',
      notifSub: 'One nudge a day so your streak does not go cold.',
      notifDenied: 'Notifications are not permitted. Turn them on in system settings.',
      achievements: 'Achievements',
      achievementsHint: 'What you have picked up so far',
      playAudioTitle: 'During a round',
      playAudioSub: 'What you hear while you play. The celebration voices play in all three.',
      playAudioMusica: 'Music',
      playAudioTictac: 'Tick-tock',
      playAudioSilencio: 'Silence',
      support: 'Support & report a bug',
      supportHint: 'Write to us: something is broken, or you want to tell us something',
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
