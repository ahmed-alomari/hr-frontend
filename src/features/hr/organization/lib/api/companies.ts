import { apiRequest, type PaginatedResult } from '@/features/hr/lib/api/client';
import type { CurrencyDefinition } from '@/shared/currencies';

export type CompanyResponseDto = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string | null;
  commercialRegistrationNo: string | null;
  taxNumber: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  website: string | null;
  country: string | null;
  /** Base country (ISO code): its profile drives the store (currency, phone code, map). */
  baseCountryCode: string;
  city: string | null;
  district: string | null;
  address: string | null;
  postalCode: string | null;
  logoUrl: string | null;
  stampUrl?: string | null;
  representativeTitleAr?: string | null;
  representativeNameAr?: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  storefrontPrimaryColor: string | null;
  storefrontSecondaryColor: string | null;
  storefrontBodyFont: string | null;
  storefrontDisplayFont: string | null;
  storefrontBodyFontUrl: string | null;
  storefrontDisplayFontUrl: string | null;
  /** The logo as a faded background on printed pages. */
  pdfWatermarkEnabled?: boolean;
  /** Its visibility in percent (2–40). */
  pdfWatermarkOpacity?: number;
  /** Employment-contract PDF text size in percent (30–100, 100 = standard). */
  pdfContractFontScale?: number;
  /** Employee signature size on signed PDFs, in percent (30–200, 100 = standard). */
  pdfEmployeeSignatureScale?: number;
  timezone: string;
  currencyCode: string;
  /** Sales tax of the company, used by every app that sells. */
  taxEnabled?: boolean;
  /** Percent, 0–100. */
  taxRate?: number;
  pricesIncludeTax?: boolean;
  languageCode: string;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
};

export type CreateCompanyDto = {
  code: string;
  nameAr: string;
  nameEn?: string | null;
  commercialRegistrationNo?: string | null;
  taxNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  website?: string | null;
  country?: string | null;
  baseCountryCode?: string;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  postalCode?: string | null;
  logoUrl?: string | null;
  stampUrl?: string | null;
  representativeTitleAr?: string | null;
  representativeNameAr?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  storefrontPrimaryColor?: string | null;
  storefrontSecondaryColor?: string | null;
  storefrontBodyFont?: string | null;
  storefrontDisplayFont?: string | null;
  storefrontBodyFontUrl?: string | null;
  storefrontDisplayFontUrl?: string | null;
  pdfWatermarkEnabled?: boolean;
  pdfWatermarkOpacity?: number;
  pdfContractFontScale?: number;
  pdfEmployeeSignatureScale?: number;
  timezone?: string;
  currencyCode?: string;
  taxEnabled?: boolean;
  taxRate?: number;
  pricesIncludeTax?: boolean;
  languageCode?: string;
  isActive?: boolean;
  notes?: string | null;
};

export type UpdateCompanyDto = Partial<CreateCompanyDto>;

export type CompanyListQuery = {
  page?: number;
  limit?: number;
};

/** What a base country decides (backend core/countries/country-profiles). */
export type CountryProfile = {
  code: string;
  nameAr: string;
  nameEn: string;
  currencyCode: string;
  phoneCode: string;
  mapRegion: string;
};

/** The base currency and the records that keep their own currency on a change. */
export type CompanyCurrencyStatus = {
  currencyCode: string;
  currency: CurrencyDefinition | null;
  hasRecords: boolean;
  usages: Array<{ app: string; labelAr: string; count: number }>;
  /** Why the currency cannot change now (e.g. stock valued in it); empty: it can. */
  blockers?: string[];
};

export const companiesApi = {
  countryProfiles() {
    return apiRequest<CountryProfile[]>('/companies/country-profiles');
  },
  currencies() {
    return apiRequest<CurrencyDefinition[]>('/companies/currencies');
  },
  currencyStatus(id: string) {
    return apiRequest<CompanyCurrencyStatus>(`/companies/${id}/currency`, { throwOnError: true });
  },
  getAll(query?: CompanyListQuery) {
    return apiRequest<PaginatedResult<CompanyResponseDto>>('/companies', { query });
  },
  getById(id: string) {
    return apiRequest<CompanyResponseDto>(`/companies/${id}`);
  },
  create(payload: CreateCompanyDto) {
    return apiRequest<CompanyResponseDto>('/companies', { method: 'POST', body: payload });
  },
  update(id: string, payload: UpdateCompanyDto) {
    return apiRequest<CompanyResponseDto>(`/companies/${id}`, { method: 'PATCH', body: payload });
  },
  remove(id: string) {
    return apiRequest<void>(`/companies/${id}`, { method: 'DELETE' });
  },
};
