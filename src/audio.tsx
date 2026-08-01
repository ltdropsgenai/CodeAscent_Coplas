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
import { getSettings, saveSettings } from './storage/store';

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
  const sfxRef = useRef<Partial<Record<AudioKey, AudioPlayer>>>({});
  // Web can't call play() until a user gesture unlocks audio; native is always
  // unlocked. We create players eagerly but defer actual playback until this
  // flips true (on the first tap/key), which avoids the NotAllowedError.
  const unlockedRef = useRef(Platform.OS !== 'web');

  // Which context owns the bed right now, and the exact track to resume if the
  // player re-enables sound mid-screen (so we don't jump to a different song).
  const contextRef = useRef<'home' | 'round' | null>(null);
  const contextTrackRef = useRef<MusicSrc | null>(null);
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
        // Resume the exact track the active screen chose, not a fresh draw —
        // the bed was already picked when the screen mounted, and re-picking
        // here would swap the music on the player's first tap.
        if (enabledRef.current && contextTrackRef.current) playBed(contextTrackRef.current);
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
  function removeBed() {
    bedFadeRef.current?.();
    bedFadeRef.current = null;
    try {
      musicRef.current?.remove();
    } catch {
      /* ignore */
    }
    musicRef.current = null;
    bedSrcRef.current = null;
  }

  /** Loop `src` as the background bed, reusing the player if it's already it. */
  function playBed(src: MusicSrc) {
    try {
      if (bedSrcRef.current === src && musicRef.current) {
        // Cancel any fade still running on this player and restore the bed
        // level, or resuming lands mid-fade and the bed comes back quiet.
        bedFadeRef.current?.();
        bedFadeRef.current = null;
        try {
          musicRef.current.volume = BED_VOLUME;
        } catch {
          /* ignore */
        }
        startPlayer(musicRef.current);
        return;
      }
      removeBed();
      const p = createAudioPlayer(src);
      p.loop = true;
      p.volume = BED_VOLUME;
      musicRef.current = p;
      bedSrcRef.current = src;
      startPlayer(p);
    } catch {
      /* ignore */
    }
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
      const tracks = HOME_BEDS;
      let i = Math.floor(Math.random() * tracks.length);
      if (tracks.length > 1 && i === lastHomeRef.current) i = (i + 1) % tracks.length;
      lastHomeRef.current = i;
      contextTrackRef.current = tracks[i];
    }
    contextRef.current = 'home';
    if (!enabledRef.current || contextTrackRef.current == null) return;
    playBed(contextTrackRef.current);
  }

  function playRoundMusic() {
    // Pick a fresh genre, never the one we just played (anti-repeat).
    const tracks = MUSIC.rounds;
    let i = Math.floor(Math.random() * tracks.length);
    if (tracks.length > 1 && i === lastRoundRef.current) i = (i + 1) % tracks.length;
    lastRoundRef.current = i;
    contextRef.current = 'round';
    contextTrackRef.current = tracks[i];
    stopWin();
    if (!enabledRef.current) return;
    playBed(tracks[i]);
  }

  function playWinFanfare() {
    if (!enabledRef.current) return;
    // Take the bed out under the fanfare rather than cutting it.
    //
    // The beds are baked as seamless loops (scripts/encode-music.mjs), so the
    // only abrupt thing left in the music is this transition — and it lands on
    // the win, the one moment of the round the player is paying attention to.
    // pause() here is a hard cut mid-phrase; a short ramp is not.
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
      winRef.current.volume = 0.85;
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
      // Sits on top of the fanfare rather than replacing it, so it needs to cut
      // through without shouting.
      voiceRef.current.volume = 1;
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

  function toggleSound() {
    setSoundEnabled((prev) => {
      const next = !prev;
      enabledRef.current = next;
      saveSettings({ soundEnabled: next });
      if (!next) {
        stopMusic();
      } else if (contextTrackRef.current) {
        // Whatever this screen was playing, not a new draw — toggling sound off
        // and on again should not change the song.
        playBed(contextTrackRef.current);
      }
      return next;
    });
  }

  return (
    <AudioContext.Provider
      value={{
        soundEnabled,
        toggleSound,
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
