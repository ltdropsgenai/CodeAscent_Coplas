import { useEffect } from 'react';
import { useI18n } from '../i18n';
import { syncDailyReminder } from '../notify';

/**
 * Re-arms the daily reminder on every launch.
 *
 * Necessary because the schedule is not durable in the way it looks: it is
 * cleared by a reinstall, can be dropped when the OS reclaims background
 * scheduling, and — the one that actually bites — the notification body is
 * baked in at schedule time, so a player who switches the app language would
 * otherwise keep getting reminders in the old one until they toggled the
 * setting off and on again.
 *
 * Rendering nothing and depending on `lang` handles all three: every launch,
 * and every language change, rebuilds the schedule from current settings.
 * `syncDailyReminder` no-ops when the toggle is off or permission is absent.
 */
export function ReminderSync() {
  const { t, lang, ready } = useI18n();

  useEffect(() => {
    if (!ready) return;
    syncDailyReminder(t.reminder);
  }, [ready, lang, t]);

  return null;
}
