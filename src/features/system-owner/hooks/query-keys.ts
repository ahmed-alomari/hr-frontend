export const systemOwnerQueryKeys = {
  companies: () => ['system-owner', 'companies'] as const,
  company: (companyId: string) => ['system-owner', 'company', companyId] as const,
  companyUsers: (companyId: string) => ['system-owner', 'company-users', companyId] as const,
  companyApplications: (companyId: string) =>
    ['system-owner', 'company-applications', companyId] as const,
  superusers: (companyId: string) => ['system-owner', 'superusers', companyId] as const,
  activationRequests: (status?: string) =>
    ['system-owner', 'activation-requests', status ?? 'all'] as const,
  companyAppsCatalog: (companyId: string) => ['company-apps', 'catalog', companyId] as const,
  platformApplications: () => ['system-owner', 'platform-applications'] as const,
  companyDomains: (companyId: string) => ['system-owner', 'company-domains', companyId] as const,
  domainSettings: () => ['system-owner', 'domain-settings'] as const,
  rateLimits: () => ['system-owner', 'rate-limits'] as const,
};
