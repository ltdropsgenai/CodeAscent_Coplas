import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { AUDIO, MUSIC, VOICE, type AudioKey } from './data/audioAssets';
import { getSettings, saveSettings, type Settings } from './storage/store';

/**
 * A music track: a remote URL while the beds stream, a Metro asset handle
 * (number) once they are bundled. Identity comparison still works either way,
 * which is what bedSrcRef relies on to avoid restarting a bed that is already
 * playing.
 */
type MusicSrc = number | string;

/** Background beds sit well under the SFX and the voice lines. */
const BED_VOLUME = 0.4;

/**
 * MUSIC.home was a single track and is now a list of three.
 *
 * This normalises both shapes, for the window between editing this file and
 * re-running scripts/fetch-audio.mjs. In that window `MUSIC.home` is still a
 * lone `require()` — typed `any`, so reading `.length` off it compiles
 * perfectly and then plays no music, with no error anywhere.
 *
 * The hop through `unknown` is deliberate. Once the registry is regenerated,
 * `MUSIC.home` is a readonly 3-tuple and TypeScript rightly objects to casting
 * a tuple to a single source — the branch is unreachable, but only for as long
 * as the generated file stays in its current shape, which is exactly the thing
 * this guard exists to not depend on.
 */
const HOME_SRC: unknown = MUSIC.home;
const HOME_BEDS: MusicSrc[] = Array.isArray(HOME_SRC)
  ? (HOME_SRC as MusicSrc[])
  : [HOME_SRC as MusicSrc];

/**
 * How long the bed takes to get out of the way when a round is won.
 *
 * Long enough not to be a cut, short enough that the fanfare still lands on
 * the win rather than after it. At 40 ms a step that is nine steps.
 */
const BED_FADE_MS = 360;

/**
 * The win mix, and the reasoning behind these three numbers.
 *
 * The fanfare used to sit at 0.85 and buried the voice line underneath it.
 * Raising the voice was not available — it was already at 1.0, the ceiling —
 * so the only way to hear it was to bring the music down. The voice is the
 * more important of the two: a mariachi flourish is decoration, and "¡tá to'!
 * in a Dominican accent is the game reacting to *you*.
 *
 * WIN_DUCK is a further cut applied only while a voice line is actually
 * sounding, then released. Between lines the fanfare comes back up, so it
 * still reads as a celebration rather than as background.
 */
const WIN_VOLUME = 0.45;
const WIN_DUCK = 0.22;
const VOICE_VOLUME = 1;

/** The tic-tac bed. Well under the music — it is a presence, not a part. */
const TICK_VOLUME = 0.22;

/**
 * Start a player, tolerating both synchronous throws and the async rejection
 * web browsers raise (`NotAllowedError`) when audio hasn't been unlocked by a
 * user gesture yet. Without swallowing the promise it surfaces as an unhandled
 * error in the console on web; native autoplay is unaffected.
 */
function safePlay(p: AudioPlayer | null | undefined): void {
  if (!p) return;
  try {
    const r = (p as unknown as { play: () => unknown }).play();
    if (r && typeof (r as Promise<unknown>).then === 'function') {
      (r as Promise<unknown>).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

/**
 * Ramp a player's volume to silence over `ms`, pause it, then put the volume
 * back where it was so the player is reusable.
 *
 * expo-audio has no fade, so this is a plain interval stepping `volume`. 40 ms
 * is below the threshold where a listener hears the steps as steps rather than
 * as a fade, and it is coarse enough that a few hundred milliseconds of it
 * costs nothing.
 *
 * Guarded throughout: the player it is fading can be removed out from under it
 * (a new round starting during the fade), and writing to a removed player
 * throws rather than no-opping.
 */
function fadeAndPause(p: AudioPlayer | null | undefined, ms: number): () => void {
  if (!p) return () => {};
  let from = 1;
  try {
    from = p.volume ?? 1;
  } catch {
    /* ignore */
  }
  const steps = Math.max(1, Math.round(ms / 40));
  let i = 0;
  const id = setInterval(() => {
    i += 1;
    try {
      p.volume = from * (1 - i / steps);
    } catch {
      clearInterval(id);
      return;
    }
    if (i >= steps) {
      clearInterval(id);
      try {
        p.pause();
        p.volume = from; // so resuming this bed later is not silent
      } catch {
        /* ignore */
      }
    }
  }, 40);
  return () => clearInterval(id);
}

interface AudioValue {
  soundEnabled: boolean;
  toggleSound: () => void;
  /** What plays under a round: music, a tic-tac, or nothing. */
  playAudio: Settings['playAudio'];
  setPlayAudio: (mode: Settings['playAudio']) => void;
  /** Stop the menu bed on leaving Home. No-op if a round already took over. */
  stopHomeMusic: () => void;
  /** Held by app/_layout.tsx while the launch intro overlay is on screen. */
  setIntroActive: (active: boolean) => void;
  playSfx: (key: Exclude<AudioKey, 'music'>) => void;
  /** Loop the home-screen bed. */
  playHomeMusic: () => void;
  /** Switch to a fresh, non-repeating round bed (call once per round). */
  playRoundMusic: () => void;
  /** Fire the triumphant win fanfare once, pausing the round bed under it. */
  playWinFanfare: () => void;
  /** One celebratory Spanish exclamation, over the fanfare. */
  playVoice: () => void;
  /** Pause whatever music/fanfare is playing. */
  stopMusic: () => void;
}

const AudioContext = createContext<AudioValue>({
  soundEnabled: true,
  toggleSound: () => {},
  playAudio: 'musica',
  setPlayAudio: () => {},
  stopHomeMusic: () => {},
  setIntroActive: () => {},
  playSfx: () => {},
  playHomeMusic: () => {},
  playRoundMusic: () => {},
  playWinFanfare: () => {},
  playVoice: () => {},
  stopMusic: () => {},
});

/**
 * Central audio. A single looping *bed* plays under each screen — one of three
 * menu tracks on Home, and one of sixty beds across fifteen Latin genres per
 * round so no two rounds sound alike — while short SFX fire on events and a
 * mariachi *fanfare* celebrates a win over the bed, which fades out from under
 * it rather than cutting.
 *
 * Every track is bundled. Nothing here touches the network — see
 * scripts/encode-music.mjs, which also bakes each bed into a seamless loop so
 * `loop = true` has no join to expose.
 *
 * Everything is guarded: sources missing from the registry simply don't play,
 * and any platform hiccup is swallowed — so the app never crashes for want of
 * a sound file.
 */
export function AudioProvider({ children }: { children: ReactNode }) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [playAudio, setPlayAudioState] = useState<Settings['playAudio']>('musica');
  const enabledRef = useRef(true);

  // The looping background bed (home or round) and the one-shot win fanfare.
  const musicRef = useRef<AudioPlayer | null>(null);
  const winRef = useRef<AudioPlayer | null>(null);
  const voiceRef = useRef<AudioPlayer | null>(null);
  // A music track is a URL while music streams and a Metro asset NUMBER once
  // scripts/encode-music.mjs bundles it. Both are valid AudioSource, and
  // createAudioPlayer already takes numbers here (see VOICE) — but the types
  // have to admit it or the switch to bundled music breaks the build.
  const bedSrcRef = useRef<MusicSrc | null>(null);
  // Cancels an in-flight bed fade. Without it, a fade started by one win can
  // still be stepping the volume of a player the next round has already
  // reused, which silences a bed that is supposed to be playing.
  const bedFadeRef = useRef<(() => void) | null>(null);
  // Detaches the end-of-track listener when a bed is replaced. Without it the
  // listeners accumulate one per track change and every one of them advances
  // the playlist, so the music starts skipping faster and faster.
  const bedEndSubRef = useRef<(() => void) | null>(null);
  // Shuffled deal queues, so no track repeats until its pool is exhausted.
  const roundPoolRef = useRef<number[]>([]);
  const homePoolRef = useRef<number[]>([]);
  const playAudioRef = useRef<Settings['playAudio']>('musica');
  const sfxRef = useRef<Partial<Record<AudioKey, AudioPlayer>>>({});
  // Web can't call play() until a user gesture unlocks audio; native is always
  // unlocked. We create players eagerly but defer actual playback until this
  // flips true (on the first tap/key), which avoids the NotAllowedError.
  const unlockedRef = useRef(Platform.OS !== 'web');

  // Which context owns the bed right now, and the exact track to resume if the
  // player re-enables sound mid-screen (so we don't jump to a different song).
  const contextRef = useRef<'home' | 'round' | null>(null);
  const contextTrackRef = useRef<MusicSrc | null>(null);
  /**
   * True while the launch intro overlay is on screen.
   *
   * SplashSequence is a SIBLING of <Stack> in app/_layout.tsx, not a screen in
   * it — so app/index.tsx is mounted AND focused underneath it, its focus
   * effect fires immediately, and the menu bed started playing under the intro
   * animation. The intro has no audio of its own, so what a player heard "on
   * the splash" was already Home's music, arriving over an animation it was
   * never scored for.
   *
   * Home still CLAIMS the context while this is set — it really is the screen
   * that owns audio — it just does not start the bed until the overlay is gone.
   */
  const introActiveRef = useRef(false);
  const lastRoundRef = useRef<number>(-1);
  const lastHomeRef = useRef<number>(-1);
  const lastWinRef = useRef<number>(-1);
  const lastVoiceRef = useRef<number>(-1);

  useEffect(() => {
    enabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    (async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true });
      } catch {
        /* not fatal */
      }
      const s = await getSettings();
      playAudioRef.current = s.playAudio ?? 'musica';
      setPlayAudioState(s.playAudio ?? 'musica');
      setSoundEnabled(s.soundEnabled);
    })();

    // Web blocks audio until the first user gesture. Resume whatever bed the
    // active screen wants the moment the user first taps/keys, then detach.
    let removeGesture: (() => void) | undefined;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const cleanupGesture = () => {
        window.removeEventListener('pointerdown', resume);
        window.removeEventListener('keydown', resume);
      };
      const resume = () => {
        unlockedRef.current = true;
        // Re-enter through the context's own starter rather than replaying the
        // last src directly, so the round honours the tic-tac / silencio
        // setting and the end-of-track advance is wired up either way.
        if (enabledRef.current) {
          if (contextRef.current === 'round') playRoundMusic();
          else if (contextRef.current === 'home') playHomeMusic();
        }
        cleanupGesture();
      };
      window.addEventListener('pointerdown', resume);
      window.addEventListener('keydown', resume);
      removeGesture = cleanupGesture;
    }

    return () => {
      removeGesture?.();
      bedFadeRef.current?.(); // an interval outliving the provider is a leak
      bedFadeRef.current = null;
      try {
        musicRef.current?.remove();
        winRef.current?.remove();
        voiceRef.current?.remove();
        Object.values(sfxRef.current).forEach((p) => p?.remove());
      } catch {
        /* ignore */
      }
    };
  }, []);

  // Play only once audio is unlocked (always, on native).
  function startPlayer(p: AudioPlayer | null | undefined) {
    if (!unlockedRef.current) return;
    safePlay(p);
  }

  // ── SFX ────────────────────────────────────────────────────────────────
  function ensureSfx(key: Exclude<AudioKey, 'music'>): AudioPlayer | null {
    const src = AUDIO[key];
    if (!src) return null;
    if (!sfxRef.current[key]) {
      try {
        sfxRef.current[key] = createAudioPlayer(src);
      } catch {
        return null;
      }
    }
    return sfxRef.current[key] ?? null;
  }

  function playSfx(key: Exclude<AudioKey, 'music'>) {
    if (!enabledRef.current) return;
    const player = ensureSfx(key);
    if (!player) return;
    try {
      player.seekTo(0);
    } catch {
      /* ignore */
    }
    startPlayer(player);
  }

  // ── Music bed ────────────────────────────────────────────────────────────
  /**
   * Tear the current bed down.
   *
   * PAUSE BEFORE REMOVE, and that order is the fix for a real bug rather than
   * defensiveness. Every deliberate stop in this file pauses — `stopMusic()`
   * does — but this function, which EVERY bed switch goes through, only called
   * `remove()`. Toggling sound off was therefore the only thing in the whole
   * app that actually paused a bed, which is exactly the workaround a player
   * reported finding: menu music carried into a round and went away when they
   * toggled sound off and on.
   *
   * `remove()` releases the native player, and a released player that was never
   * paused can keep sounding with nothing left holding a reference to stop it.
   * Pausing first means the audio is silent before we drop the handle.
   */
  function removeBed() {
    bedFadeRef.current?.();
    bedFadeRef.current = null;
    bedEndSubRef.current?.();
    bedEndSubRef.current = null;
    try {
      musicRef.current?.pause();
    } catch {
      /* ignore */
    }
    try {
      musicRef.current?.remove();
    } catch {
      /* ignore */
    }
    musicRef.current = null;
    bedSrcRef.current = null;
  }

  /**
   * Play `src` as the background bed.
   *
   * `loop` is false for music and true for the tic-tac. Music beds do NOT loop
   * on themselves any more — when one ends, `onEnd` picks a different track.
   * Hearing the same fifty-five seconds come round again is what made the
   * music feel thin no matter how many tracks were in the pool.
   */
  function playBed(src: MusicSrc, opts: { loop: boolean; volume?: number; onEnd?: () => void }) {
    try {
      if (bedSrcRef.current === src && musicRef.current) {
        // Cancel any fade still running on this player and restore the bed
        // level, or resuming lands mid-fade and the bed comes back quiet.
        bedFadeRef.current?.();
        bedFadeRef.current = null;
        try {
          musicRef.current.volume = opts.volume ?? BED_VOLUME;
        } catch {
          /* ignore */
        }
        startPlayer(musicRef.current);
        return;
      }
      removeBed();
      const p = createAudioPlayer(src);
      p.loop = opts.loop;
      p.volume = opts.volume ?? BED_VOLUME;
      musicRef.current = p;
      bedSrcRef.current = src;

      if (opts.onEnd) {
        const onEnd = opts.onEnd;
        try {
          // `didJustFinish` is the only reliable end signal here; a status of
          // 'idle' also fires when a player is torn down, which would advance
          // the playlist every time we simply stopped it.
          const sub = p.addListener(
            'playbackStatusUpdate',
            (s: { didJustFinish?: boolean }) => {
              if (!s?.didJustFinish) return;
              if (musicRef.current !== p) return; // superseded; do not advance
              onEnd();
            }
          );
          bedEndSubRef.current = () => {
            try {
              sub.remove();
            } catch {
              /* ignore */
            }
          };
        } catch {
          /* older API shape — the bed simply stops at the end of the track */
        }
      }
      startPlayer(p);
    } catch {
      /* ignore */
    }
  }

  /**
   * The next track index from a pool, never repeating until the pool is spent.
   *
   * Anti-repeat used to be "not the previous index", which at sixty tracks
   * still let the same handful recur within a sitting — with 60 beds a naive
   * random draw repeats something about every 8 rounds. This shuffles the whole
   * pool and deals from it, so you hear all sixty before hearing any twice, and
   * the refill excludes whatever just played so the seam is not a repeat either.
   */
  function nextFrom(poolRef: { current: number[] }, size: number, lastRef: { current: number }) {
    if (size <= 1) return 0;
    if (!poolRef.current.length) {
      const all = Array.from({ length: size }, (_, i) => i).filter((i) => i !== lastRef.current);
      for (let i = all.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
      }
      poolRef.current = all;
    }
    const i = poolRef.current.pop() ?? 0;
    lastRef.current = i;
    return i;
  }

  function stopWin() {
    try {
      winRef.current?.pause();
    } catch {
      /* ignore */
    }
  }

  /**
   * The menu bed. Three of them now, drawn on ARRIVAL at the home screen — not
   * on every call.
   *
   * app/index.tsx calls this from a focus effect, which can fire more than once
   * for a single visit. Re-drawing each time would restart the music under
   * someone who is standing still on the menu, so a fresh track is only chosen
   * when we are coming from somewhere else.
   */
  function playHomeMusic() {
    stopWin();
    if (contextRef.current !== 'home' || contextTrackRef.current == null) {
      contextTrackRef.current = HOME_BEDS[nextFrom(homePoolRef, HOME_BEDS.length, lastHomeRef)];
    }
    contextRef.current = 'home';
    if (introActiveRef.current) return; // claimed, but silent until the intro ends
    if (!enabledRef.current || contextTrackRef.current == null) return;
    playBed(contextTrackRef.current, { loop: false, onEnd: advanceHome });
  }

  /**
   * Called by app/_layout.tsx around the launch intro.
   *
   * Releasing re-enters through the owning context's own starter rather than
   * playing `contextTrackRef` directly: by the time the intro finishes the
   * player may already have been sent to the tutorial and back, or straight
   * into a round on a resumed session, and only the starter knows what that
   * context is supposed to sound like.
   */
  function setIntroActive(active: boolean) {
    introActiveRef.current = active;
    if (active) {
      // Silence anything that already started. SplashSequence and <Stack> are
      // siblings, so Home's focus effect can fire BEFORE the overlay's mount
      // effect gets here — setting the flag alone would arrive too late and
      // leave the bed it was meant to prevent already playing. Home keeps its
      // claim on the context and is resumed below when the intro ends.
      removeBed();
      return;
    }
    if (!enabledRef.current) return;
    if (contextRef.current === 'round') playRoundMusic();
    else if (contextRef.current === 'home') playHomeMusic();
  }

  function advanceHome() {
    if (!enabledRef.current || introActiveRef.current || contextRef.current !== 'home') return;
    const src = HOME_BEDS[nextFrom(homePoolRef, HOME_BEDS.length, lastHomeRef)];
    contextTrackRef.current = src;
    playBed(src, { loop: false, onEnd: advanceHome });
  }

  /**
   * Stop the menu bed — but ONLY if Home still owns it.
   *
   * Called from Home's focus-effect cleanup. The guard is the whole point: on
   * some transitions the play screen mounts and starts its own bed BEFORE Home
   * is told it lost focus, and an unguarded stop here would then kill the round
   * music a moment after it started. Checking the context means this can only
   * ever stop something Home itself put there.
   */
  function stopHomeMusic() {
    if (contextRef.current !== 'home') return;
    contextRef.current = null;
    contextTrackRef.current = null;
    removeBed();
  }

  /**
   * Start whatever plays under a round, per the player's `playAudio` setting.
   *
   * Note the unconditional removeBed() before the switch. Entering a round has
   * to silence Home immediately and in every mode — including 'silencio', where
   * there is nothing to replace it with, and that is exactly the case a
   * "replace the bed" approach would have missed.
   */
  function playRoundMusic() {
    contextRef.current = 'round';
    contextTrackRef.current = null;
    stopWin();
    removeBed();
    if (!enabledRef.current) return;

    if (playAudioRef.current === 'silencio') return;

    if (playAudioRef.current === 'tictac') {
      // Looked up by string rather than as AUDIO.tictac on purpose. AudioKey is
      // GENERATED from scripts/fetch-audio.mjs, so the key only enters the type
      // after that script has run — and typing it statically would make the
      // whole repo fail typecheck until someone remembers to. The clip is
      // verified by `npm run assets` instead, which checks it is really on disk.
      const tick = (AUDIO as Record<string, unknown>).tictac as MusicSrc | undefined;
      // If it did not bundle, a round is simply quiet rather than a crash.
      if (tick != null) playBed(tick, { loop: true, volume: TICK_VOLUME });
      return;
    }

    advanceRound();
  }

  function advanceRound() {
    if (!enabledRef.current || contextRef.current !== 'round') return;
    if (playAudioRef.current !== 'musica') return;
    const tracks = MUSIC.rounds;
    const src = tracks[nextFrom(roundPoolRef, tracks.length, lastRoundRef)];
    contextTrackRef.current = src;
    playBed(src, { loop: false, onEnd: advanceRound });
  }

  function playWinFanfare() {
    if (!enabledRef.current) return;
    // Take the bed out under the fanfare rather than cutting it.
    //
    // A bed now ends on its own 2.5s fade (scripts/encode-music.mjs), but a win
    // almost never lands on that ending — it lands wherever the player happened
    // to solve the board, which is mid-phrase by definition. pause() there is a
    // hard cut; a short ramp is not. And it lands on the win, the one moment of
    // the round the player is paying attention to.
    //
    // It is deliberately shorter than a musical fade. The fanfare has to arrive
    // while the win still feels like it just happened, so the bed gets out of
    // the way rather than making an exit.
    bedFadeRef.current?.();
    bedFadeRef.current = fadeAndPause(musicRef.current, BED_FADE_MS);
    // Pick a fresh fanfare, never the one we just played (anti-repeat).
    const tracks = MUSIC.wins;
    let i = Math.floor(Math.random() * tracks.length);
    if (tracks.length > 1 && i === lastWinRef.current) i = (i + 1) % tracks.length;
    lastWinRef.current = i;
    try {
      if (winRef.current) {
        winRef.current.remove();
        winRef.current = null;
      }
      winRef.current = createAudioPlayer(tracks[i]);
      winRef.current.loop = false;
      winRef.current.volume = WIN_VOLUME;
      startPlayer(winRef.current);
    } catch {
      /* ignore */
    }
  }

  /**
   * A celebratory exclamation on a win — ¡Órale!, ¡Qué padre!, ¡Lo lograste!
   *
   * Forty-six clips across Mexican, Dominican, Argentine and accent-neutral
   * Spanish voices, so with a line on every win neither the phrase nor the
   * speaker repeats often enough to become wallpaper.
   *
   * Regionally marked slang is cast only to voices from that region — ¡órale!
   * and ¡qué padre! to Mexican actors, ¡tá to'! and ¡qué vaina buena! to
   * Dominican ones — because an actor performing another country's slang is
   * exactly what this audience hears instantly. Voices whose accent label is
   * ambiguous carry only pan-regional lines. See scripts/fetch-audio.mjs for
   * the casting.
   *
   * Anti-repeat is on the *previous* index only, matching how the fanfares and
   * round beds already behave: cheap, and enough to kill the thing players
   * actually notice, which is hearing the same clip twice in a row.
   *
   * Bundled, not streamed — a celebration sting that arrives after a network
   * round-trip has already missed the moment it was celebrating.
   */
  function playVoice() {
    if (!enabledRef.current) return;
    if (!VOICE.length) return;
    let i = Math.floor(Math.random() * VOICE.length);
    if (VOICE.length > 1 && i === lastVoiceRef.current) i = (i + 1) % VOICE.length;
    lastVoiceRef.current = i;
    try {
      if (voiceRef.current) {
        voiceRef.current.remove();
        voiceRef.current = null;
      }
      voiceRef.current = createAudioPlayer(VOICE[i]);
      voiceRef.current.loop = false;
      voiceRef.current.volume = VOICE_VOLUME;

      // Duck the fanfare under the line, then let it back up.
      //
      // The voice is already at 1.0, so there was no headroom left to raise it
      // — the only way to hear the line was to lower what was covering it. The
      // release matters as much as the duck: hold it down and the celebration
      // ends in a whimper, so the music comes back the moment the voice stops.
      try {
        if (winRef.current) winRef.current.volume = WIN_DUCK;
      } catch {
        /* ignore */
      }
      try {
        const vp = voiceRef.current;
        const sub = vp.addListener('playbackStatusUpdate', (s: { didJustFinish?: boolean }) => {
          if (!s?.didJustFinish) return;
          try {
            if (winRef.current) winRef.current.volume = WIN_VOLUME;
          } catch {
            /* ignore */
          }
          try {
            sub.remove();
          } catch {
            /* ignore */
          }
        });
      } catch {
        // No status events on this platform: restore on a timer instead, so a
        // missed event cannot leave the fanfare permanently ducked.
        setTimeout(() => {
          try {
            if (winRef.current) winRef.current.volume = WIN_VOLUME;
          } catch {
            /* ignore */
          }
        }, 2500);
      }

      startPlayer(voiceRef.current);
    } catch {
      /* ignore */
    }
  }

  function stopMusic() {
    try {
      voiceRef.current?.pause();
    } catch {
      /* ignore */
    }
    try {
      musicRef.current?.pause();
    } catch {
      /* ignore */
    }
    stopWin();
  }

  /**
   * Change what plays under a round, and apply it to the round in progress.
   *
   * Applying it live is the point: a setting you have to leave and re-enter a
   * round to hear is a setting nobody can evaluate.
   */
  function setPlayAudio(mode: Settings['playAudio']) {
    playAudioRef.current = mode;
    setPlayAudioState(mode);
    saveSettings({ playAudio: mode });
    if (contextRef.current === 'round') playRoundMusic();
  }

  function toggleSound() {
    setSoundEnabled((prev) => {
      const next = !prev;
      enabledRef.current = next;
      saveSettings({ soundEnabled: next });
      if (!next) {
        stopMusic();
      } else if (contextRef.current === 'round') {
        // Re-enter through playRoundMusic so the tic-tac and silencio modes are
        // honoured; resuming the last track directly would ignore the setting.
        playRoundMusic();
      } else if (contextRef.current === 'home') {
        playHomeMusic();
      }
      return next;
    });
  }

  return (
    <AudioContext.Provider
      value={{
        soundEnabled,
        toggleSound,
        playAudio,
        setPlayAudio,
        stopHomeMusic,
        setIntroActive,
        playSfx,
        playVoice,
        playHomeMusic,
        playRoundMusic,
        playWinFanfare,
        stopMusic,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio(): AudioValue {
  return useContext(AudioContext);
}
