import { Platform } from 'react-native';

/**
 * Monetization configuration — the single place every purchase decision reads
 * from.
 *
 * Model (decided 2026-07-30): today's copla is always free and unlimited; the
 * back-catalog beyond FREE_ARCHIVE_WINDOW requires a one-time, non-consumable
 * unlock. No subscription, no consumables, no ads.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE MASTER SWITCH
 *
 * `IAP_ENABLED` is false, and it must STAY false until every one of these is
 * true:
 *
 *   1. `react-native-purchases` is installed and a native build containing it
 *      has shipped to both stores.
 *   2. The product `PRODUCT_ID` exists and is "Ready to submit" (App Store
 *      Connect) / "Active" (Play Console in-app products).
 *   3. That product is registered in RevenueCat and attached to the
 *      `ENTITLEMENT_ID` entitlement AND to the lifetime package of the
 *      `OFFERING_ID` offering.
 *   4. Store credentials are configured in RevenueCat (App Store Connect API
 *      key + in-app purchase key for iOS; Play service account for Android) —
 *      without them RevenueCat cannot validate a receipt and every purchase
 *      silently fails to grant.
 *   5. A sandbox purchase AND a restore have been verified on real hardware,
 *      on both platforms.
 *
 * With it false the app behaves exactly as it does today: nothing anywhere is
 * locked, the paywall route is unreachable from the UI, and the RevenueCat SDK
 * is never configured. That is deliberate — a paywall that a tester cannot
 * complete a purchase through is both a bad test and an App Review rejection
 * ("in-app purchase does not work"). Test tracks are never capped.
 *
 * Flipping this to `true` is a one-line change that needs no other code edits.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const IAP_ENABLED = false;

/**
 * How many of the most recent coplas stay free forever, counted from newest.
 * 30 ≈ a month of dailies, so a player has to have been around a while before
 * the gate is even visible to them.
 */
export const FREE_ARCHIVE_WINDOW = 30;

/** RevenueCat entitlement identifier — must match the dashboard exactly. */
export const ENTITLEMENT_ID = 'archivo';

/** RevenueCat offering identifier holding the unlock package. */
export const OFFERING_ID = 'default';

/**
 * Store SKU. The SAME string must be created in App Store Connect (Non-
 * Consumable) and Play Console (One-time product), then registered in
 * RevenueCat for each app.
 */
export const PRODUCT_ID = 'coplas_archive_unlock';

/**
 * RevenueCat *public* SDK keys. These are publishable by design — they are
 * embedded in every shipped client and grant no server-side authority. The
 * secret keys are not, and must never appear in this repo.
 *
 * Project: CodeAscent: Coplas Lotería (proj69e83728)
 */
export const RC_API_KEY: string =
  Platform.select({
    ios: 'appl_dbeOPjmLZQjfYprNZorJRFgmUfU',
    android: 'goog_eETEvbrAmmaXiqmAciNOyHowGGu',
    default: '',
  }) ?? '';

/**
 * Purchases only works on the native SDKs. On web (`expo start --web`, which we
 * use for layout work) there is no StoreKit or Play Billing, so the provider
 * short-circuits rather than throwing.
 */
export const IAP_SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';

/** Price shown before the store's real localized price has loaded. */
export const FALLBACK_PRICE = '$4.99';
