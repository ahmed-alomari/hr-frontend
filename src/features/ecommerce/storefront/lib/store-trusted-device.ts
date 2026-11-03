import type { PartnerAuthSessionPayload } from '@/features/ecommerce/storefront/domain/partner-auth';

/**
 * Trusted-device sign-in (store setting, 2026-11-01): sign-up and a password
 * sign-in give this device a key; with the same email or mobile it signs in
 * without the password. One device remembers one account per store.
 */
type TrustedDevice = { email: string | null; mobile: string | null; token: string };

const storageKey = (companyId: string) => `store-trusted-device:${companyId}`;

/** The email as the account keeps it (trimmed, lower case). */
export const trustedDeviceEmail = (email: string) => email.trim().toLowerCase();

export function readTrustedDevice(companyId: string): TrustedDevice | null {
  try {
    const raw = window.localStorage.getItem(storageKey(companyId));
    if (!raw) return null;
    // Keys saved before email support carry only the mobile.
    const value = JSON.parse(raw) as Partial<TrustedDevice>;
    const email = value.email ? trustedDeviceEmail(value.email) : null;
    const mobile = value.mobile || null;
    return value.token && (email || mobile) ? { email, mobile, token: value.token } : null;
  } catch {
    return null;
  }
}

/** Keeps the key the session carries (only when the store setting is on). */
export function rememberTrustedDevice(session: PartnerAuthSessionPayload): void {
  const email = session.user.email ? trustedDeviceEmail(session.user.email) : null;
  const mobile = session.user.phone || null;
  if (!session.deviceToken || (!email && !mobile)) return;
  try {
    window.localStorage.setItem(
      storageKey(session.companyId),
      JSON.stringify({ email, mobile, token: session.deviceToken }),
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
