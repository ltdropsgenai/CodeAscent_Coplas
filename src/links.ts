import { Platform } from 'react-native';

/**
 * Public URLs, in one place.
 *
 * Separate from rate.ts on purpose: the share sheet needs the store link, and
 * pulling it out of rate.ts would drag `expo-store-review` into the share path
 * for no reason.
 */

export const IOS_APP_ID = '6796142121';
export const ANDROID_PACKAGE = 'com.codeascent.coplas';

/** The listing for the store this copy of the app came from. */
export function storeUrl(): string {
  return Platform.OS === 'ios'
    ? `https://apps.apple.com/app/id${IOS_APP_ID}`
    : `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
}

/**
 * Where a share should point. Shares travel across platforms — an Android
 * player's screenshot lands in an iPhone user's chat — so a share must not
 * hand out a store-specific deep link. The website redirects per device.
 */
export const SHARE_URL = 'https://coplas-web.vercel.app';
