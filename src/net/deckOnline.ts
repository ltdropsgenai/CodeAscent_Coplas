/**
 * Deck connectivity gate.
 *
 * The expanded deck (~940 new cards) streams its baked art from Supabase; only
 * the 54 classics are bundled for offline play. So a round may only include
 * expansion cards when we're reasonably sure their images will load. This
 * module is the single source of truth for that decision:
 *
 *   • `isDeckOnline()` — read the current gate (composer.ts calls this to pick
 *     its group pool). Starts `false` so a cold, offline launch composes only
 *     from the bundled 54 and never shows a broken/placeholder-only board.
 *   • `probeDeckOnline()` — fire a cheap reachability check against the public
 *     bucket and flip the gate. Called once when Play mounts.
 *   • `subscribeDeckOnline()` — let the UI react when the gate flips (Play
 *     recomposes a pristine round so the expansion appears without waiting for
 *     the next one).
 *
 * Deliberately dependency-free (no NetInfo native module): a short-timeout
 * `fetch` HEAD is enough and keeps the Expo build pure-JS.
 */

/** A tiny, always-present object used purely as a reachability sentinel. */
const PROBE_URL =
  'https://bmybvrqbpachjxrejxdj.supabase.co/storage/v1/object/public/cards/la_naranja.webp';

let online = false;
let probed = false;
const listeners = new Set<(v: boolean) => void>();

/** Current gate. `true` → rounds may include expansion cards. */
export function isDeckOnline(): boolean {
  return online;
}

/** Force the gate (used by the probe; exported for tests / manual override). */
export function setDeckOnline(next: boolean): void {
  if (next === online) return;
  online = next;
  for (const l of listeners) l(online);
}

/** Subscribe to gate flips. Returns an unsubscribe fn. */
export function subscribeDeckOnline(l: (v: boolean) => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/**
 * Check whether the Supabase art host is reachable and update the gate. Safe to
 * call repeatedly; the network check itself only runs once per app session
 * unless `force` is set. Never throws — any failure just leaves us offline.
 */
export async function probeDeckOnline(opts?: { force?: boolean; timeoutMs?: number }): Promise<boolean> {
  if (probed && !opts?.force) return online;
  probed = true;
  const timeoutMs = opts?.timeoutMs ?? 4000;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(PROBE_URL, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);
    setDeckOnline(res.ok);
  } catch {
    setDeckOnline(false);
  }
  return online;
}
