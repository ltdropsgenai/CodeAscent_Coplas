import { Linking } from 'react-native';
import Constants from 'expo-constants';
import * as StoreReview from 'expo-store-review';
import { getSettings, saveSettings, type Stats } from './storage/store';
import { storeUrl } from './links';

export { storeUrl };

/**
 * Asking for a rating.
 *
 * Both stores cap this hard — iOS shows the native prompt at most three times
 * per user per year and silently swallows the rest — so the only real decision
 * is *when* to spend one. The rule here: at a peak, never at a low, never
 * before the player has any reason to have an opinion.
 *
 * Concretely, all of these must hold:
 *   • the round was just WON, flawlessly (no mistakes, no hint)
 *   • the win streak just landed on a milestone
 *   • the player has finished at least MIN_ROUNDS rounds overall
 *   • we have not already prompted on this app version
 *
 * A prompt after a loss is how you buy one-star reviews, so `maybePrompt` is
 * only ever called from the win path.
 */

/**
 * Win streak at which a flawless round is worth spending the prompt on.
 *
 * This was `[5, 20, 50]` matched EXACTLY, which never fired in practice: the
 * exact-match window had to coincide with a flawless win AND with having
 * already played MIN_ROUNDS. A tester on a 13-round win streak sailed past it
 * — at streak 5 they had only played 5 rounds, and streak 20 was still miles
 * off. A threshold fires on the first flawless win once the player is clearly
 * enjoying themselves, which is the whole point.
 */
const MIN_WIN_STREAK = 5;

/** Never ask someone who has barely played. */
const MIN_ROUNDS = 10;

function appVersion(): string {
  return Constants.expoConfig?.version ?? '0';
}

/**
 * Open the store listing directly. Used by the Settings row, which must always
 * do something — unlike the native prompt, which may decide to no-op.
 */
export async function openStoreListing(): Promise<boolean> {
  try {
    await Linking.openURL(storeUrl());
    return true;
  } catch {
    return false;
  }
}

/**
 * Fire the native review prompt if this is a good moment. Safe to call after
 * every win; it decides for itself and never throws.
 */
export async function maybePromptForReview(stats: Stats, flawless: boolean): Promise<void> {
  try {
    if (!flawless) return;
    if (stats.played < MIN_ROUNDS) return;
    if (stats.winStreak < MIN_WIN_STREAK) return;

    const settings = await getSettings();
    const version = appVersion();
    if (settings.ratedVersion === version) return;

    // hasAction() is false on devices/simulators where the prompt can't show.
    // Record the attempt either way so we don't retry on every milestone.
    const available =
      (await StoreReview.hasAction()) && (await StoreReview.isAvailableAsync());
    if (available) await StoreReview.requestReview();

    await saveSettings({ ratedVersion: version });
  } catch {
    // Never let a nice-to-have interrupt a win.
  }
}
