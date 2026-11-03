import { INVENTORY_FALLBACK_COMPANY_ID } from '@/features/inventory/lib/company-constants';
import { useAuthStore } from '@/features/auth/lib/auth-store';

/**
 * Storefront tenant id — must match seeded store config + catalog in the backend.
 * Override via `NEXT_PUBLIC_STOREFRONT_COMPANY_ID` when the seed company differs
 * from the inventory fallback (common after system:init on a fresh DB).
 */
export const STOREFRONT_FALLBACK_COMPANY_ID =
  process.env.NEXT_PUBLIC_STOREFRONT_COMPANY_ID?.trim() || INVENTORY_FALLBACK_COMPANY_ID;

/** Legacy mock slug previously used in seeds — remapped to the UUID above. */
export const LEGACY_STOREFRONT_COMPANY_ID = 'demo-company';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCompanyIdUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Normalize legacy `demo-company` (and any non-UUID) to the seeded storefront UUID. */
export function resolveStorefrontCompanyId(companyId?: string | null): string {
  if (!companyId || companyId === LEGACY_STOREFRONT_COMPANY_ID || !isCompanyIdUuid(companyId)) {
    return STOREFRONT_FALLBACK_COMPANY_ID;
  }
  return companyId;
}

/**
 * The public store's company: always the deployment's store, never the admin
 * session. The admin panel shares the store's origin, so a signed-in admin
 * whose active company differs would otherwise ask for another company's
 * cities and districts (empty → free-text fields) and catalog. Matches what
 * the server renders.
 */
export function getPublicStorefrontCompanyId(): string {
  return STOREFRONT_FALLBACK_COMPANY_ID;
}

/**
 * Resolve storefront / catalog tenant id for admin screens.
 * Prefer explicit env override; on the client also honor the logged-in default company.
 * The public store uses {@link getPublicStorefrontCompanyId}.
 */
export function getStorefrontCompanyId(): string {
  if (typeof window !== 'undefined') {
    const state = useAuthStore.getState();
    const sessionCompanyId = state.activeCompanyId || state.accessProfile?.defaultCompanyId;
    if (sessionCompanyId && isCompanyIdUuid(sessionCompanyId)) {
      return sessionCompanyId;
    }
    const stored = localStorage.getItem('rose-hr-default-company-id');
    if (stored && isCompanyIdUuid(stored)) return stored;
  }
  return STOREFRONT_FALLBACK_COMPANY_ID;
}
