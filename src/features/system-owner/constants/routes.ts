/**
 * Standalone System Owner app — platform_admin only.
 */
export const SYSTEM_OWNER_BASE = '/system-owner' as const;

export const systemOwnerRoutes = {
  overview: SYSTEM_OWNER_BASE,
  companies: `${SYSTEM_OWNER_BASE}/companies`,
  companyDetail: (companyId: string) => `${SYSTEM_OWNER_BASE}/companies/${companyId}`,
  requests: `${SYSTEM_OWNER_BASE}/requests`,
  /** Platform status of every application (started / stopped for all companies). */
  applications: `${SYSTEM_OWNER_BASE}/applications`,
  /** Read-only: request limits in force (rate limits). */
  security: `${SYSTEM_OWNER_BASE}/security`,
} as const;

export function isSystemOwnerAppPath(pathname: string): boolean {
  return pathname === SYSTEM_OWNER_BASE || pathname.startsWith(`${SYSTEM_OWNER_BASE}/`);
}

/** Company Superuser catalog — enabled + disabled apps and activation requests. */
export const COMPANY_APPS_BASE = '/company-apps' as const;

export const companyAppsRoutes = {
  overview: COMPANY_APPS_BASE,
} as const;

export function isCompanyAppsPath(pathname: string): boolean {
  return pathname === COMPANY_APPS_BASE || pathname.startsWith(`${COMPANY_APPS_BASE}/`);
}
