import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Reaching a human, and reporting a bug.
 *
 * WHY THIS IS NOT JUST A mailto: LINK. A bug report that says "it broke" costs
 * a round trip to become useful, and most players never make that round trip —
 * they write once, get a question back, and never answer. So everything we
 * would have had to ask for is filled in before the player starts typing:
 * which build, which platform, which OS, which language, which difficulty, and
 * — for an in-game report — which round and which four groups were on the
 * board. The player writes the one thing only they can know, which is what
 * they saw.
 *
 * WHAT IS DELIBERATELY NOT IN HERE. No identifier of any kind, no stats, no
 * streak, no purchase state, nothing that could single out a person. The
 * privacy page says the app keeps everything on the device and sends nothing,
 * and a diagnostics blob that quietly carried an install id would make that
 * page untrue. Everything below is either a property of the BUILD or of the
 * round on screen, and the player can read the whole thing in their mail app
 * before they hit send — which is the real reason it is a mailto: and not a
 * silent POST to an endpoint of ours. Nothing leaves the phone without the
 * player pressing send in their own mail client.
 */

export const SUPPORT_EMAIL = 'sysadmin@codeascent.online';

/** Build identity — the questions we would otherwise have to ask first. */
export function buildInfo(): string {
  const e = Constants.expoConfig;
  const version = e?.version ?? '?';
  const native =
    Platform.OS === 'ios'
      ? (e?.ios?.buildNumber ?? '?')
      : String(e?.android?.versionCode ?? '?');
  const os = `${Platform.OS} ${String(Platform.Version)}`;
  return `Coplas ${version} (${native}) · ${os}`;
}

export interface ReportContext {
  /** UI language at the time of the report. */
  lang?: string;
  /** Difficulty the round was composed at. */
  difficulty?: string;
  /** Round number on screen. */
  round?: number;
  /** The four group themes dealt — what the player was actually looking at. */
  themes?: string[];
}

/**
 * The block appended under the player's own words.
 *
 * Fenced by a marker line so it is obvious to the player that everything below
 * it is automatic, and obvious to us where their description ends.
 */
export function diagnostics(ctx: ReportContext = {}): string {
  const lines = [buildInfo()];
  if (ctx.lang) lines.push(`lang: ${ctx.lang}`);
  if (ctx.difficulty) lines.push(`difficulty: ${ctx.difficulty}`);
  if (typeof ctx.round === 'number') lines.push(`round: ${ctx.round}`);
  if (ctx.themes?.length) lines.push(`groups: ${ctx.themes.join(' · ')}`);
  return lines.join('\n');
}

/**
 * Build a mailto: URL.
 *
 * encodeURIComponent, not encodeURI, and on every part. A theme string can
 * contain «», &, # and + — `&` would start a bogus mail header and `#` would
 * truncate the body at the fragment — so a half-escaped subject silently
 * arrives with the diagnostics chopped off, which is the one thing this
 * feature exists to prevent.
 */
export function mailtoUrl(subject: string, body: string): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Open the player's mail app. Returns false when the device has no mail client
 * configured — common on a fresh simulator and not unheard of on a real phone
 * — so the caller can show the address as selectable text instead of doing
 * nothing at all, which is how a "contact us" button becomes a dead end.
 */
export async function openMail(subject: string, body: string): Promise<boolean> {
  const url = mailtoUrl(subject, body);
  try {
    // NOTE: canOpenURL is NOT consulted first. On Android 11+ it returns false
    // for mailto: unless the scheme is declared in the manifest <queries>, so
    // gating on it reports "no mail app" on devices that have one. Attempting
    // the open and catching the failure is the check that actually works.
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
