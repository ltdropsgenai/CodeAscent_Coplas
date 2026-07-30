import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';
import {
  ENTITLEMENT_ID,
  FALLBACK_PRICE,
  FREE_ARCHIVE_WINDOW,
  IAP_ENABLED,
  IAP_SUPPORTED,
  OFFERING_ID,
  RC_API_KEY,
} from './config';

/**
 * The purchase layer.
 *
 * Design rules this file follows, in priority order:
 *
 *  1. **It can never crash the app.** Every call into the RevenueCat SDK is
 *     wrapped. A store outage, a missing product, an unconfigured credential —
 *     all of them degrade to "not entitled, no price shown", never to a red
 *     screen. Losing a sale is survivable; losing the session is not.
 *
 *  2. **Off means genuinely off.** When `IAP_ENABLED` is false the SDK is never
 *     configured and `gateActive` is false, so `isLocked()` returns false for
 *     every index. Nothing in the app is capped for testers.
 *
 *  3. **The entitlement is the source of truth, not the purchase call.** After
 *     any purchase or restore we re-read `customerInfo.entitlements.active`.
 *     A customer-info listener also keeps this fresh when a purchase completes
 *     out of band (a family-share grant, a promo code redeemed in the store
 *     app, a purchase finished after the app was backgrounded).
 */

interface PurchasesValue {
  /** True once we've made our first entitlement check (or decided not to). */
  ready: boolean;
  /** Is the paywall live at all? Mirrors IAP_ENABLED and platform support. */
  gateActive: boolean;
  /** Does this customer own the archive unlock? */
  unlocked: boolean;
  /** Localized price from the store, e.g. "$4.99" / "MX$99". */
  price: string;
  /** The package we sell. Null until offerings load, or if none is configured. */
  pkg: PurchasesPackage | null;
  /** A purchase or restore is in flight. */
  busy: boolean;
  /** Last user-visible failure, already de-noised (cancels are not errors). */
  error: string | null;
  clearError: () => void;
  /** Returns true if the archive row at `index` should be gated. */
  isLocked: (index: number) => boolean;
  /** Runs the purchase. Resolves true if the entitlement is now held. */
  purchase: () => Promise<boolean>;
  /** Restores prior purchases. Resolves true if the entitlement is now held. */
  restore: () => Promise<boolean>;
}

const DEFAULTS: PurchasesValue = {
  ready: false,
  gateActive: false,
  unlocked: false,
  price: FALLBACK_PRICE,
  pkg: null,
  busy: false,
  error: null,
  clearError: () => {},
  isLocked: () => false,
  purchase: async () => false,
  restore: async () => false,
};

const PurchasesContext = createContext<PurchasesValue>(DEFAULTS);

/** Is the paywall actually operable in this build, on this platform? */
const GATE_ACTIVE = IAP_ENABLED && IAP_SUPPORTED && RC_API_KEY.length > 0;

function hasEntitlement(info: CustomerInfo | null | undefined): boolean {
  if (!info) return false;
  try {
    return typeof info.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
  } catch {
    return false;
  }
}

export function PurchasesProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!GATE_ACTIVE);
  const [unlocked, setUnlocked] = useState(false);
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = useRef(false);

  // ── Configure once, then load entitlement + offering in parallel ──────────
  useEffect(() => {
    if (!GATE_ACTIVE || configured.current) return;
    configured.current = true;
    let active = true;

    (async () => {
      try {
        if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
        Purchases.configure({ apiKey: RC_API_KEY });
      } catch {
        // Nothing else in this effect can succeed without configure(), but the
        // app itself is fine — we simply stay locked-out-of-selling.
        if (active) setReady(true);
        return;
      }

      // Entitlement and offering are independent; a failure in one must not
      // hide the other. Someone who already owns the unlock should see their
      // archive even if the store is down and no price can be fetched.
      const [info, offerings] = await Promise.all([
        Purchases.getCustomerInfo().catch(() => null),
        Purchases.getOfferings().catch(() => null),
      ]);
      if (!active) return;

      setUnlocked(hasEntitlement(info));

      try {
        const offering = offerings?.all?.[OFFERING_ID] ?? offerings?.current ?? null;
        // Prefer the canonical lifetime slot; fall back to the first package so
        // a dashboard misconfiguration degrades to "still sellable".
        const found = offering?.lifetime ?? offering?.availablePackages?.[0] ?? null;
        setPkg(found);
      } catch {
        setPkg(null);
      }

      setReady(true);
    })();

    return () => {
      active = false;
    };
  }, []);

  // ── Keep entitlement fresh when it changes outside a purchase() call ──────
  useEffect(() => {
    if (!GATE_ACTIVE) return;
    const listener = (info: CustomerInfo) => setUnlocked(hasEntitlement(info));
    try {
      Purchases.addCustomerInfoUpdateListener(listener);
    } catch {
      return;
    }
    return () => {
      try {
        Purchases.removeCustomerInfoUpdateListener(listener);
      } catch {
        /* SDK already torn down */
      }
    };
  }, []);

  const purchase = useCallback(async (): Promise<boolean> => {
    if (!GATE_ACTIVE || !pkg) return false;
    setBusy(true);
    setError(null);
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const ok = hasEntitlement(customerInfo);
      setUnlocked(ok);
      return ok;
    } catch (e: unknown) {
      // A cancel is a normal outcome of showing a paywall, not a failure to
      // report back to the player.
      const err = e as { userCancelled?: boolean; message?: string };
      if (!err?.userCancelled) setError(err?.message ?? 'unknown');
      return false;
    } finally {
      setBusy(false);
    }
  }, [pkg]);

  const restore = useCallback(async (): Promise<boolean> => {
    if (!GATE_ACTIVE) return false;
    setBusy(true);
    setError(null);
    try {
      const info = await Purchases.restorePurchases();
      const ok = hasEntitlement(info);
      setUnlocked(ok);
      return ok;
    } catch (e: unknown) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (!err?.userCancelled) setError(err?.message ?? 'unknown');
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const isLocked = useCallback(
    (index: number) => GATE_ACTIVE && !unlocked && index >= FREE_ARCHIVE_WINDOW,
    [unlocked]
  );

  const value = useMemo<PurchasesValue>(
    () => ({
      ready,
      gateActive: GATE_ACTIVE,
      unlocked,
      price: pkg?.product?.priceString || FALLBACK_PRICE,
      pkg,
      busy,
      error,
      clearError: () => setError(null),
      isLocked,
      purchase,
      restore,
    }),
    [ready, unlocked, pkg, busy, error, isLocked, purchase, restore]
  );

  return <PurchasesContext.Provider value={value}>{children}</PurchasesContext.Provider>;
}

export function usePurchases(): PurchasesValue {
  return useContext(PurchasesContext);
}

export { FREE_ARCHIVE_WINDOW, IAP_ENABLED, PRODUCT_ID } from './config';
