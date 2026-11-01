import type { PartnerAuthSessionPayload } from '@/features/ecommerce/storefront/domain/partner-auth';

/**
 * Trusted-device sign-in (store setting, 2026-11-01): sign-up and a password
 * sign-in give this device a key; with the same mobile it signs in without
 * the password. One device remembers one account per store.
 */
type TrustedDevice = { mobile: string; token: string };

const storageKey = (companyId: string) => `store-trusted-device:${companyId}`;

export function readTrustedDevice(companyId: string): TrustedDevice | null {
  try {
    const raw = window.localStorage.getItem(storageKey(companyId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<TrustedDevice>;
    return value.mobile && value.token ? { mobile: value.mobile, token: value.token } : null;
  } catch {
    return null;
  }
}

/** Keeps the key the session carries (only when the store setting is on). */
export function rememberTrustedDevice(session: PartnerAuthSessionPayload): void {
  if (!session.deviceToken || !session.user.phone) return;
  try {
    window.localStorage.setItem(
      storageKey(session.companyId),
      JSON.stringify({ mobile: session.user.phone, token: session.deviceToken }),
    );
  } catch {
    /* private mode: the password still works */
  }
}

export function forgetTrustedDevice(companyId: string): void {
  try {
    window.localStorage.removeItem(storageKey(companyId));
  } catch {
    /* ignore */
  }
}
