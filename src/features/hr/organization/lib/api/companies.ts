import { apiRequest, type PaginatedResult } from '@/features/hr/lib/api/client';

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
  city: string | null;
  district: string | null;
  address: string | null;
  postalCode: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
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
  city?: string | null;
  district?: string | null;
  address?: string | null;
  postalCode?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  pdfWatermarkEnabled?: boolean;
  pdfWatermarkOpacity?: number;
  pdfContractFontScale?: number;
  pdfEmployeeSignatureScale?: number;
  timezone?: string;
  currencyCode?: string;
  languageCode?: string;
  isActive?: boolean;
  notes?: string | null;
};

export type UpdateCompanyDto = Partial<CreateCompanyDto>;

export type CompanyListQuery = {
  page?: number;
  limit?: number;
};

export const companiesApi = {
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
