import { apiRequest, ensurePaginatedResult, type PaginatedResult } from '@/features/hr/lib/api/client';

function asItems<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object' && Array.isArray((value as { items?: unknown }).items)) {
    return (value as { items: T[] }).items;
  }
  return [];
}

function asPaginated<T>(value: unknown): PaginatedResult<T> {
  if (value && typeof value === 'object' && Array.isArray((value as { items?: unknown }).items)) {
    return ensurePaginatedResult(value as PaginatedResult<T>);
  }
  const items = asItems<T>(value);
  return {
    items,
    pagination: { page: 1, limit: items.length || 50, total: items.length, totalPages: 1 },
  };
}

export type SystemOwnerCompany = {
  id: string;
  code?: string | null;
  nameAr: string;
  nameEn?: string | null;
  commercialRegistrationNo?: string | null;
  taxNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateSystemOwnerCompanyDto = {
  nameAr: string;
  code?: string;
  nameEn?: string | null;
  commercialRegistrationNo?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  isActive?: boolean;
};

export type SystemOwnerCompanyUser = {
  id: string;
  email?: string | null;
  fullNameAr?: string | null;
  fullNameEn?: string | null;
  phone?: string | null;
  isActive?: boolean;
  userType?: string | null;
  isCompanySuperuser?: boolean;
};

export type CreateSystemOwnerCompanyUserDto = {
  email: string;
  fullNameAr: string;
  password: string;
  assignSuperuser?: boolean;
};

export type CreateSystemOwnerCompanyUserResult = {
  user: { id: string; email?: string | null; fullNameAr?: string | null };
  companyId: string;
  isCompanySuperuser: boolean;
  accountKind?: string | null;
  homeConsole?: string | null;
};

export type SystemOwnerCompanyApplication = {
  id: string;
  applicationId?: string;
  code: string;
  nameAr: string;
  nameEn?: string | null;
  isEnabled: boolean;
  isVisible: boolean;
  isAlwaysEnabled: boolean;
  /**
   * Platform status. False: stopped for every company by the platform owner —
   * `isEnabled` is kept (the company's choice) but has no effect meanwhile.
   */
  platformActive: boolean;
  notes?: string | null;
  /** App codes this app needs (manifest). */
  dependsOn: string[];
  /** Those still to enable for this company, in the order to enable them (indirect ones too). */
  missingDependencies: string[];
  /** Enabled apps of this company that need this one (links to inventory excluded: they go off with it). */
  enabledDependents: string[];
  /** Enabled links to inventory that go off with this app (backend decisions.md §21). */
  followingBridges: string[];
  /** A link whose two apps are enabled: on once its setup is done, off only with one of them. */
  followsApps: boolean;
};

/** The System Owner "company data" buttons: real starting setup, or samples to try the system. */
export type CompanyDataKind = 'starter' | 'demo';
export type CatalogDemoProfileCode =
  | 'beauty'
  | 'abayas'
  | 'shoes'
  | 'restaurant'
  | 'cleaning';

export type CompanyDataSetResult = {
  code: string;
  labelAr: string;
  apps: string[];
  /** Apps this set needs that the company has not enabled (not run). */
  missingApps: string[];
  created: number;
  /** Official rows brought back in line with the definitions. */
  updated: number;
  /** Already there, or a row the company edited: left as it is. */
  skipped: number;
};

export type CompanyDataRun = {
  kind: CompanyDataKind;
  /** Set when the button is for one app. */
  appCode: string | null;
  profileCode: CatalogDemoProfileCode | null;
  /** false: a preview (nothing written). */
  applied: boolean;
  sets: CompanyDataSetResult[];
  totals: { created: number; updated: number; skipped: number };
};

export type CompanyDataCatalogSet = {
  code: string;
  kind: CompanyDataKind;
  labelAr: string;
  apps: string[];
};

export type CompanyDataCatalogApp = {
  code: string;
  nameAr: string;
  enabled: boolean;
  sets: CompanyDataCatalogSet[];
};

export type CompanyDataProfileOption = {
  code: CatalogDemoProfileCode;
  labelAr: string;
  descriptionAr: string;
};

export type CompanyDataCatalog = {
  apps: CompanyDataCatalogApp[];
  /** Null until the first demo pack is applied. */
  catalogProfile: CatalogDemoProfileCode | null;
  catalogProfileOptions: CompanyDataProfileOption[];
};

export type DemoResetLine = { code: string; labelAr: string; count: number };

export type DemoResetBlocker = DemoResetLine & { examples: string[] };

export type DemoResetRun = {
  /** false: a preview, or refused because of blockers (nothing written). */
  applied: boolean;
  blockers: DemoResetBlocker[];
  removed: DemoResetLine[];
  /** Demo rows left because the company uses or changed them. */
  kept: DemoResetLine[];
  totals: { removed: number; kept: number };
};

export type PatchCompanyApplicationDto = {
  isEnabled?: boolean;
  isVisible?: boolean;
  notes?: string;
};

export type SystemOwnerSuperuser = {
  userId: string;
  email?: string | null;
  fullNameAr?: string | null;
  fullNameEn?: string | null;
  isActive: boolean;
  notes?: string | null;
};

export type AppActivationRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type CompanyAppActivationState = 'always_on' | 'enabled' | 'pending' | 'available';

export type CompanyAppCatalogRequest = {
  id: string;
  message?: string | null;
  status: AppActivationRequestStatus | string;
  createdAt?: string;
};

export type CompanyAppCatalogItem = {
  applicationId: string;
  code: string;
  nameAr: string;
  nameEn?: string | null;
  description?: string | null;
  icon?: string | null;
  routePath?: string | null;
  launchUrl?: string | null;
  sortOrder: number;
  isEnabled: boolean;
  isAlwaysEnabled: boolean;
  /** Platform status. False: stopped for every company — enabling has no effect meanwhile. */
  platformActive: boolean;
  isVisible: boolean;
  includeInMarketplace: boolean;
  canSetVisibility: boolean;
  activationState: CompanyAppActivationState | string;
  canRequestActivation: boolean;
  canCancelPendingRequest: boolean;
  pendingRequest: CompanyAppCatalogRequest | null;
  latestRequest: CompanyAppCatalogRequest | null;
  enabledAt?: string | null;
  disabledAt?: string | null;
  notes?: string | null;
};

export type CompanyAppsCatalog = {
  companyId: string;
  isCompanySuperuser: boolean;
  isSystemOwner: boolean;
  canRequestActivation: boolean;
  applications: CompanyAppCatalogItem[];
};

export type AppActivationRequest = {
  id: string;
  companyId: string;
  companyNameAr?: string | null;
  applicationId: string;
  applicationCode?: string | null;
  applicationNameAr?: string | null;
  message?: string | null;
  status: AppActivationRequestStatus | string;
  decisionNote?: string | null;
  createdAt?: string;
};

function readIsEnabled(raw: Record<string, unknown>): boolean {
  if (raw.isEnabled === true || raw.enabled === true) return true;
  if (raw.isEnabled === false || raw.enabled === false) return false;
  return true;
}

function readIsVisible(raw: Record<string, unknown>): boolean {
  if (raw.isVisible === true) return true;
  if (raw.isVisible === false) return false;
  return true;
}

function readIsAlwaysEnabled(raw: Record<string, unknown>): boolean {
  if (raw.isAlwaysEnabled === true) return true;
  const code = String(raw.code ?? (raw.application as Record<string, unknown> | undefined)?.code ?? '')
    .trim()
    .toLowerCase();
  return code === 'system' || code === 'company-apps';
}

function mapCompanyUser(raw: Record<string, unknown>): SystemOwnerCompanyUser {
  const nested = (raw.user as Record<string, unknown> | undefined) ?? {};
  return {
    id: String(raw.id ?? nested.id ?? raw.userId ?? ''),
    email: (raw.email as string | null | undefined) ?? (nested.email as string | null | undefined) ?? null,
    fullNameAr:
      (raw.fullNameAr as string | null | undefined)
      ?? (nested.fullNameAr as string | null | undefined)
      ?? null,
    fullNameEn:
      (raw.fullNameEn as string | null | undefined)
      ?? (nested.fullNameEn as string | null | undefined)
      ?? null,
    phone: (raw.phone as string | null | undefined) ?? (nested.phone as string | null | undefined) ?? null,
    isActive: raw.isActive !== false && nested.isActive !== false,
    userType:
      (raw.userType as string | null | undefined)
      ?? (nested.userType as string | null | undefined)
      ?? null,
    isCompanySuperuser: raw.isCompanySuperuser === true || nested.isCompanySuperuser === true,
  };
}

function mapCreatedCompanyUser(raw: unknown, companyId: string): CreateSystemOwnerCompanyUserResult {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const userRaw = (row.user as Record<string, unknown> | undefined) ?? row;
  return {
    user: {
      id: String(userRaw.id ?? row.userId ?? ''),
      email: (userRaw.email as string | null | undefined) ?? (row.email as string | null | undefined) ?? null,
      fullNameAr:
        (userRaw.fullNameAr as string | null | undefined)
        ?? (row.fullNameAr as string | null | undefined)
        ?? null,
    },
    companyId: String(row.companyId ?? companyId),
    isCompanySuperuser: row.isCompanySuperuser === true,
    accountKind: (row.accountKind as string | null | undefined) ?? null,
    homeConsole: (row.homeConsole as string | null | undefined) ?? null,
  };
}

function mapCompanyApplication(raw: Record<string, unknown>): SystemOwnerCompanyApplication {
  const nested = (raw.application as Record<string, unknown> | undefined) ?? {};
  const applicationId = String(raw.applicationId ?? nested.id ?? raw.id ?? '');
  return {
    id: applicationId || String(raw.id ?? ''),
    applicationId,
    code: String(raw.code ?? nested.code ?? ''),
    nameAr: String(raw.nameAr ?? nested.nameAr ?? raw.name ?? nested.name ?? ''),
    nameEn:
      (raw.nameEn as string | null | undefined)
      ?? (nested.nameEn as string | null | undefined)
      ?? null,
    isEnabled: readIsEnabled(raw),
    isVisible: readIsVisible(raw),
    isAlwaysEnabled: readIsAlwaysEnabled(raw),
    platformActive: raw.platformActive !== false,
    notes: (raw.notes as string | null | undefined) ?? null,
    dependsOn: readCodes(raw.dependsOn),
    missingDependencies: readCodes(raw.missingDependencies),
    enabledDependents: readCodes(raw.enabledDependents),
    followingBridges: readCodes(raw.followingBridges),
    followsApps: raw.followsApps === true,
  };
}

function readCodes(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)) : [];
}

function mapCatalogRequest(raw: unknown): CompanyAppCatalogRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = String(row.id ?? '');
  if (!id) return null;
  return {
    id,
    message: (row.message as string | null | undefined) ?? null,
    status: String(row.status ?? 'pending'),
    createdAt: (row.createdAt as string | undefined) ?? undefined,
  };
}

function inferActivationState(raw: Record<string, unknown>): CompanyAppActivationState {
  const explicit = String(raw.activationState ?? '').toLowerCase();
  if (explicit === 'always_on' || explicit === 'enabled' || explicit === 'pending' || explicit === 'available') {
    return explicit;
  }
  if (raw.isAlwaysEnabled === true) return 'always_on';
  if (mapCatalogRequest(raw.pendingRequest)) return 'pending';
  if (raw.isEnabled === true) return 'enabled';
  return 'available';
}

function mapCatalogItem(raw: Record<string, unknown>): CompanyAppCatalogItem {
  const nested = (raw.application as Record<string, unknown> | undefined) ?? {};
  const applicationId = String(raw.applicationId ?? nested.id ?? raw.id ?? '');
  const pendingRequest = mapCatalogRequest(raw.pendingRequest);
  const activationState = inferActivationState(raw);
  return {
    applicationId,
    code: String(raw.code ?? nested.code ?? ''),
    nameAr: String(raw.nameAr ?? nested.nameAr ?? raw.name ?? nested.name ?? ''),
    nameEn:
      (raw.nameEn as string | null | undefined)
      ?? (nested.nameEn as string | null | undefined)
      ?? null,
    description:
      (raw.description as string | null | undefined)
      ?? (nested.description as string | null | undefined)
      ?? null,
    icon: (raw.icon as string | null | undefined) ?? (nested.icon as string | null | undefined) ?? null,
    routePath:
      (raw.routePath as string | null | undefined)
      ?? (nested.routePath as string | null | undefined)
      ?? null,
    launchUrl:
      (raw.launchUrl as string | null | undefined)
      ?? (nested.launchUrl as string | null | undefined)
      ?? null,
    sortOrder: typeof raw.sortOrder === 'number' ? raw.sortOrder : 0,
    isEnabled: raw.isEnabled === true || activationState === 'enabled' || activationState === 'always_on',
    isAlwaysEnabled: raw.isAlwaysEnabled === true || activationState === 'always_on',
    platformActive: raw.platformActive !== false,
    isVisible: readIsVisible(raw),
    includeInMarketplace: raw.includeInMarketplace !== false,
    canSetVisibility: raw.canSetVisibility === true,
    activationState,
    canRequestActivation: raw.canRequestActivation === true,
    canCancelPendingRequest: raw.canCancelPendingRequest === true,
    pendingRequest,
    latestRequest: mapCatalogRequest(raw.latestRequest),
    enabledAt: (raw.enabledAt as string | null | undefined) ?? null,
    disabledAt: (raw.disabledAt as string | null | undefined) ?? null,
    notes: (raw.notes as string | null | undefined) ?? null,
  };
}

function asCatalog(value: unknown, companyId: string): CompanyAppsCatalog {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const applications = asItems<Record<string, unknown>>(raw.applications ?? raw.items ?? value)
    .map(mapCatalogItem)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.nameAr.localeCompare(b.nameAr, 'ar'));
  return {
    companyId: String(raw.companyId ?? companyId),
    isCompanySuperuser: raw.isCompanySuperuser === true,
    isSystemOwner: raw.isSystemOwner === true,
    canRequestActivation: raw.canRequestActivation === true,
    applications,
  };
}

function mapSuperuser(raw: Record<string, unknown>): SystemOwnerSuperuser {
  const user = (raw.user as Record<string, unknown> | undefined) ?? raw;
  return {
    userId: String(raw.userId ?? user.id ?? ''),
    email: (raw.email as string | null | undefined) ?? (user.email as string | null | undefined) ?? null,
    fullNameAr:
      (raw.fullNameAr as string | null | undefined)
      ?? (user.fullNameAr as string | null | undefined)
      ?? null,
    fullNameEn:
      (raw.fullNameEn as string | null | undefined)
      ?? (user.fullNameEn as string | null | undefined)
      ?? null,
    isActive: raw.isActive !== false,
    notes: (raw.notes as string | null | undefined) ?? null,
  };
}

function mapActivationRequest(raw: Record<string, unknown>): AppActivationRequest {
  const company = raw.company as Record<string, unknown> | undefined;
  const application = raw.application as Record<string, unknown> | undefined;
  return {
    id: String(raw.id ?? ''),
    companyId: String(raw.companyId ?? company?.id ?? ''),
    companyNameAr:
      (raw.companyNameAr as string | null | undefined)
      ?? (company?.nameAr as string | null | undefined)
      ?? null,
    applicationId: String(raw.applicationId ?? application?.id ?? ''),
    applicationCode:
      (raw.applicationCode as string | null | undefined)
      ?? (application?.code as string | null | undefined)
      ?? null,
    applicationNameAr:
      (raw.applicationNameAr as string | null | undefined)
      ?? (application?.nameAr as string | null | undefined)
      ?? null,
    message: (raw.message as string | null | undefined) ?? null,
    status: String(raw.status ?? 'pending'),
    decisionNote: (raw.decisionNote as string | null | undefined) ?? null,
    createdAt: (raw.createdAt as string | undefined) ?? undefined,
  };
}

/** A platform application with its platform status (system owner console). */
export type PlatformApplication = {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string | null;
  description?: string | null;
  icon?: string | null;
  sortOrder: number;
  isActive: boolean;
  /** The platform itself (system, company apps, owner console): never stopped. */
  isCore: boolean;
  isPlatformOnly: boolean;
  /** Companies that have it enabled — all of them lose it while it is stopped. */
  enabledCompanyCount: number;
};

function mapPlatformApplication(raw: Record<string, unknown>): PlatformApplication {
  return {
    id: String(raw.id ?? ''),
    code: String(raw.code ?? ''),
    nameAr: String(raw.nameAr ?? raw.code ?? ''),
    nameEn: (raw.nameEn as string | null | undefined) ?? null,
    description: (raw.description as string | null | undefined) ?? null,
    icon: (raw.icon as string | null | undefined) ?? null,
    sortOrder: typeof raw.sortOrder === 'number' ? raw.sortOrder : 0,
    isActive: raw.isActive === true || raw.status === 'active',
    isCore: raw.isCore === true,
    isPlatformOnly: raw.isPlatformOnly === true,
    enabledCompanyCount: Number(raw.enabledCompanyCount ?? 0) || 0,
  };
}

export const systemOwnerApi = {
  listPlatformApplications() {
    return apiRequest<unknown>('/system-owner/applications').then((res) =>
      asItems<Record<string, unknown>>(res).map(mapPlatformApplication),
    );
  },

  /** Starts or stops the app for the whole platform (every company). */
  setPlatformApplicationActive(applicationId: string, isActive: boolean) {
    return apiRequest<unknown>(`/applications/${applicationId}`, {
      method: 'PATCH',
      body: { isActive },
    });
  },

  listCompanies(query?: { page?: number; limit?: number; search?: string }) {
    return apiRequest<PaginatedResult<SystemOwnerCompany> | SystemOwnerCompany[]>(
      '/system-owner/companies',
      { query },
    ).then((res) => asPaginated<SystemOwnerCompany>(res));
  },

  getCompany(companyId: string) {
    return apiRequest<SystemOwnerCompany>(`/system-owner/companies/${companyId}`);
  },

  createCompany(payload: CreateSystemOwnerCompanyDto) {
    return apiRequest<SystemOwnerCompany>('/system-owner/companies', {
      method: 'POST',
      body: payload,
    });
  },

  updateCompany(companyId: string, payload: Partial<CreateSystemOwnerCompanyDto>) {
    return apiRequest<SystemOwnerCompany>(`/system-owner/companies/${companyId}`, {
      method: 'PATCH',
      body: payload,
    });
  },

  listCompanyUsers(companyId: string) {
    return apiRequest<unknown>(`/system-owner/companies/${companyId}/users`).then((res) =>
      asItems<Record<string, unknown>>(res).map(mapCompanyUser),
    );
  },

  createCompanyUser(companyId: string, payload: CreateSystemOwnerCompanyUserDto) {
    return apiRequest<unknown>(`/system-owner/companies/${companyId}/users`, {
      method: 'POST',
      body: payload,
    }).then((res) => mapCreatedCompanyUser(res, companyId));
  },

  listCompanyApplications(companyId: string) {
    return apiRequest<unknown>(`/system-owner/companies/${companyId}/applications`).then((res) =>
      asItems<Record<string, unknown>>(res).map(mapCompanyApplication),
    );
  },

  patchCompanyApplication(
    companyId: string,
    applicationId: string,
    payload: PatchCompanyApplicationDto,
  ) {
    return apiRequest<unknown>(
      `/system-owner/companies/${companyId}/applications/${applicationId}`,
      { method: 'PATCH', body: payload },
    );
  },

  /** Sets each application owns. Nothing is written. */
  companyDataCatalog(companyId: string) {
    return apiRequest<CompanyDataCatalog>(
      `/system-owner/companies/${companyId}/data-catalog`,
      { throwOnError: true },
    );
  },

  /** What one app’s refresh would create or update (nothing written). */
  previewAppCompanyData(
    companyId: string,
    appCode: string,
    kind: CompanyDataKind,
    profile?: CatalogDemoProfileCode,
  ) {
    const query = profile ? `?profile=${encodeURIComponent(profile)}` : '';
    return apiRequest<CompanyDataRun>(
      `/system-owner/companies/${companyId}/apps/${appCode}/data-sets/${kind}${query}`,
      { throwOnError: true },
    );
  },

  /** Creates missing official rows and updates rows still owned by system:init. */
  applyAppCompanyData(
    companyId: string,
    appCode: string,
    kind: CompanyDataKind,
    profile?: CatalogDemoProfileCode,
  ) {
    const query = profile ? `?profile=${encodeURIComponent(profile)}` : '';
    return apiRequest<CompanyDataRun>(
      `/system-owner/companies/${companyId}/apps/${appCode}/data-sets/${kind}${query}`,
      { method: 'POST', throwOnError: true },
    );
  },

  /** What removing the demo data would delete, and what blocks it (nothing written). */
  previewDemoReset(companyId: string) {
    return apiRequest<DemoResetRun>(
      `/system-owner/companies/${companyId}/demo-data/reset`,
      { throwOnError: true },
    );
  },

  /** Removes the demo data and unlocks the activity pack. */
  applyDemoReset(companyId: string) {
    return apiRequest<DemoResetRun>(
      `/system-owner/companies/${companyId}/demo-data/reset`,
      { method: 'POST', throwOnError: true },
    );
  },

  /** @deprecated Use patchCompanyApplication */
  setCompanyApplicationEnabled(
    companyId: string,
    applicationId: string,
    payload: { isEnabled: boolean; notes?: string },
  ) {
    return this.patchCompanyApplication(companyId, applicationId, payload);
  },

  listSuperusers(companyId: string) {
    return apiRequest<unknown>(`/system-owner/companies/${companyId}/superusers`).then((res) =>
      asItems<Record<string, unknown>>(res).map(mapSuperuser),
    );
  },

  assignSuperuser(companyId: string, payload: { userId: string; notes?: string }) {
    return apiRequest<unknown>(`/system-owner/companies/${companyId}/superusers`, {
      method: 'POST',
      body: payload,
    });
  },

  setSuperuserActive(companyId: string, userId: string, isActive: boolean) {
    return apiRequest<unknown>(`/system-owner/companies/${companyId}/superusers/${userId}`, {
      method: 'PATCH',
      body: { isActive },
    });
  },

  listActivationRequests(query?: { status?: string }) {
    return apiRequest<unknown>('/system-owner/app-activation-requests', { query }).then((res) =>
      asItems<Record<string, unknown>>(res).map(mapActivationRequest),
    );
  },

  approveActivationRequest(id: string, decisionNote?: string) {
    return apiRequest<unknown>(`/system-owner/app-activation-requests/${id}/approve`, {
      method: 'POST',
      body: { decisionNote: decisionNote || undefined },
    });
  },

  rejectActivationRequest(id: string, decisionNote?: string) {
    return apiRequest<unknown>(`/system-owner/app-activation-requests/${id}/reject`, {
      method: 'POST',
      body: { decisionNote: decisionNote || undefined },
    });
  },
};

export const companyAppsApi = {
  getCatalog(companyId: string) {
    return apiRequest<unknown>(`/company-apps/${companyId}/catalog`, { throwOnError: true }).then(
      (res) => asCatalog(res, companyId),
    );
  },

  listActivationRequests(companyId: string) {
    return apiRequest<unknown>(`/company-apps/${companyId}/activation-requests`).then((res) =>
      asItems<Record<string, unknown>>(res).map(mapActivationRequest),
    );
  },

  createActivationRequest(payload: {
    companyId: string;
    applicationId: string;
    message?: string;
  }) {
    return apiRequest<unknown>('/company-apps/activation-requests', {
      method: 'POST',
      body: payload,
    });
  },

  cancelActivationRequest(id: string) {
    return apiRequest<unknown>(`/company-apps/activation-requests/${id}/cancel`, {
      method: 'POST',
    });
  },

  patchApplication(
    companyId: string,
    applicationId: string,
    payload: { isVisible: boolean },
  ) {
    return apiRequest<unknown>(`/company-apps/${companyId}/applications/${applicationId}`, {
      method: 'PATCH',
      body: payload,
    });
  },
};
