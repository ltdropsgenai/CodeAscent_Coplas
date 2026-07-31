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
 * Central audio. A single looping *bed* plays under each screen — the home
 * track on the menu, a rotating Latin genre (bachata, reggaetón, cumbia…) per
 * round so no two rounds sound alike — while short SFX fire on events and a
 * mariachi *fanfare* celebrates a win over the (briefly paused) bed. Music is
 * streamed from our Supabase `audio` bucket.
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
        if (enabledRef.current) {
          if (contextRef.current === 'home') playBed(MUSIC.home);
          else if (contextRef.current === 'round' && contextTrackRef.current) {
            playBed(contextTrackRef.current);
          }
        }
        cleanupGesture();
      };
      window.addEventListener('pointerdown', resume);
      window.addEventListener('keydown', resume);
      removeGesture = cleanupGesture;
    }

    return () => {
      removeGesture?.();
      try {
        musicRef.current?.remove();
        winRef.current?.remove();
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
        startPlayer(musicRef.current);
        return;
      }
      removeBed();
      const p = createAudioPlayer(src);
      p.loop = true;
      p.volume = 0.4;
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

  function playHomeMusic() {
    contextRef.current = 'home';
    contextTrackRef.current = MUSIC.home;
    stopWin();
    if (!enabledRef.current) return;
    playBed(MUSIC.home);
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
    // Duck out the bed so the fanfare rings clear.
    try {
      musicRef.current?.pause();
    } catch {
      /* ignore */
    }
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
   * Fourteen clips across eight Spanish voices (four Mexican, four Argentine),
   * so with a line on every win neither the phrase nor the speaker repeats
   * often enough to become wallpaper. The regionally-marked slang is all in the
   * Mexican voices; see scripts/fetch-audio.mjs for the casting.
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
      } else if (contextRef.current === 'home') {
        playBed(MUSIC.home);
      } else if (contextRef.current === 'round' && contextTrackRef.current) {
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
