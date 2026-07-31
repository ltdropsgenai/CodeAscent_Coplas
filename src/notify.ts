import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getSettings, saveSettings } from './storage/store';

/**
 * The daily reminder.
 *
 * The Settings toggle for this has existed since the first build and did
 * nothing — its own subtitle admitted "se conectará en una próxima versión."
 * This wires it up.
 *
 * Design notes:
 *
 *  • It is a LOCAL notification on a repeating daily trigger. No push tokens,
 *    no server, no account, nothing leaves the device — which keeps the "no
 *    accounts, no data collection" posture of the store listing honest.
 *
 *  • The schedule is rebuilt from scratch every time rather than diffed.
 *    Cancel-all-then-schedule-one is idempotent and cheap; trying to reconcile
 *    an existing schedule is how apps end up firing four reminders a day.
 *
 *  • Permission is requested at the moment the player turns the toggle ON,
 *    never at launch. A permission dialog on first open is the single fastest
 *    way to get denied permanently.
 *
 *  • Every call is wrapped. A reminder failing to schedule must never break
 *    the settings screen.
 */

const CATEGORY = 'coplas.daily';

/** Text is passed in so the caller can localize it from the live i18n dict. */
export interface ReminderCopy {
  title: string;
  body: string;
}

/** "HH:MM" → {hour, minute}, defaulting to 19:00 on anything malformed. */
function parseTime(hhmm: string): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '');
  if (!m) return { hour: 19, minute: 0 };
  const hour = Math.min(23, Math.max(0, Number(m[1])));
  const minute = Math.min(59, Math.max(0, Number(m[2])));
  return { hour, minute };
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CATEGORY, {
    name: 'Coplas',
    importance: Notifications.AndroidImportance.DEFAULT,
    // A daily nudge should be quiet and skippable, not an alarm.
    vibrationPattern: [0, 120],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

/**
 * Ask for permission. Returns whether we ended up with it.
 * Only ever called from an explicit user action.
 */
export async function requestPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') return false;
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync();
    return !!asked.granted;
  } catch {
    return false;
  }
}

/** Drop every scheduled Coplas reminder. */
export async function cancelReminder(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    /* nothing scheduled, or unsupported platform */
  }
}

/**
 * Make the device's schedule match the stored settings.
 *
 * Call on app start and whenever the toggle or the time changes. Returns the
 * state actually achieved, which may be `false` if permission was refused —
 * the caller should write that back so the toggle reflects reality rather than
 * sitting on while nothing is scheduled.
 */
export async function syncDailyReminder(copy: ReminderCopy): Promise<boolean> {
  try {
    if (Platform.OS === 'web') return false;

    const settings = await getSettings();
    await cancelReminder();
    if (!settings.notifications) return false;

    const existing = await Notifications.getPermissionsAsync();
    if (!existing.granted) return false;

    await ensureAndroidChannel();
    const { hour, minute } = parseTime(settings.reminderTime);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: copy.title,
        body: copy.body,
        ...(Platform.OS === 'android' ? { channelId: CATEGORY } : null),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Turn the reminder on or off from the Settings toggle. Handles the permission
 * round-trip and persists the outcome, so the switch can never show "on" while
 * nothing is actually scheduled.
 */
export async function setReminderEnabled(
  enabled: boolean,
  copy: ReminderCopy
): Promise<boolean> {
  if (!enabled) {
    await saveSettings({ notifications: false });
    await cancelReminder();
    return false;
  }
  const ok = await requestPermission();
  await saveSettings({ notifications: ok });
  if (!ok) {
    await cancelReminder();
    return false;
  }
  return syncDailyReminder(copy);
}
