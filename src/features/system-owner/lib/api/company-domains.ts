import { apiRequest } from '@/features/hr/lib/api/client';

/** Mirrors `CompanyDomainResponseDto` (hr-backend system-owner/company-domains). */
export type CompanyDomainKind = 'store' | 'admin';
export type CompanyDomainStatus = 'pending' | 'active' | 'disabled';

export type CompanyDomainDnsRecord = {
  type: 'TXT' | 'CNAME';
  name: string;
  value: string;
  purposeAr: string;
};

export type CompanyDomain = {
  id: string;
  companyId: string;
  hostname: string;
  kind: CompanyDomainKind;
  status: CompanyDomainStatus;
  isPrimary: boolean;
  isPlatformSubdomain: boolean;
  url: string;
  dnsRecords: CompanyDomainDnsRecord[];
  verifiedAt: string | null;
  lastCheckAt: string | null;
  lastCheckError: string | null;
  disabledAt: string | null;
  createdAt: string;
};

export type CompanyDomainSettings = {
  platformRootDomain: string | null;
  dnsTarget: string | null;
  reservedLabels: string[];
};

const base = (companyId: string) => `/system-owner/companies/${companyId}/domains`;

export const companyDomainsApi = {
  settings() {
    return apiRequest<CompanyDomainSettings>('/system-owner/domain-settings');
  },
  list(companyId: string) {
    return apiRequest<CompanyDomain[]>(base(companyId));
  },
  create(companyId: string, body: { hostname: string; kind: CompanyDomainKind; isPrimary?: boolean }) {
    return apiRequest<CompanyDomain>(base(companyId), { method: 'POST', body });
  },
  verify(companyId: string, domainId: string) {
    return apiRequest<CompanyDomain>(`${base(companyId)}/${domainId}/verify`, { method: 'POST' });
  },
  setPrimary(companyId: string, domainId: string) {
    return apiRequest<CompanyDomain>(`${base(companyId)}/${domainId}/primary`, { method: 'POST' });
  },
  disable(companyId: string, domainId: string) {
    return apiRequest<CompanyDomain>(`${base(companyId)}/${domainId}/disable`, { method: 'POST' });
  },
  restore(companyId: string, domainId: string) {
    return apiRequest<CompanyDomain>(`${base(companyId)}/${domainId}/restore`, { method: 'POST' });
  },
};
