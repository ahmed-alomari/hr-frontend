import type { CompanyResponseDto, UpdateCompanyDto } from '@/features/hr/organization/lib/api/companies';

export type CompanySettingsFormState = {
  nameAr: string;
  nameEn: string;
  commercialRegistrationNo: string;
  taxNumber: string;
  email: string;
  phone: string;
  mobile: string;
  website: string;
  country: string;
  city: string;
  district: string;
  address: string;
  postalCode: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  pdfWatermarkEnabled: boolean;
  pdfWatermarkOpacity: number;
  pdfContractFontScale: number;
  pdfEmployeeSignatureScale: number;
};

/** Visibility levels of the logo background on printed pages (percent). */
export const PDF_WATERMARK_LEVELS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 4, label: 'باهتة جدًا' },
  { value: 7, label: 'خفيفة' },
  { value: 10, label: 'متوسطة' },
  { value: 15, label: 'واضحة' },
  { value: 22, label: 'قوية' },
  { value: 30, label: 'قوية جدًا' },
];

/** Employment-contract text size, any integer percent in this range. */
export const PDF_CONTRACT_FONT_SCALE = { min: 30, max: 100 } as const;

/** Employee signature size on signed PDFs, any integer percent in this range. */
export const PDF_EMPLOYEE_SIGNATURE_SCALE = { min: 30, max: 200 } as const;

function clampScale(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function companyToSettingsForm(company: CompanyResponseDto): CompanySettingsFormState {
  return {
    nameAr: company.nameAr,
    nameEn: company.nameEn ?? '',
    commercialRegistrationNo: company.commercialRegistrationNo ?? '',
    taxNumber: company.taxNumber ?? '',
    email: company.email ?? '',
    phone: company.phone ?? '',
    mobile: company.mobile ?? '',
    website: company.website ?? '',
    country: company.country ?? '',
    city: company.city ?? '',
    district: company.district ?? '',
    address: company.address ?? '',
    postalCode: company.postalCode ?? '',
    logoUrl: company.logoUrl ?? '',
    primaryColor: company.primaryColor ?? '',
    secondaryColor: company.secondaryColor ?? '',
    pdfWatermarkEnabled: company.pdfWatermarkEnabled ?? true,
    pdfWatermarkOpacity: company.pdfWatermarkOpacity ?? 10,
    pdfContractFontScale: clampScale(
      company.pdfContractFontScale ?? 100,
      PDF_CONTRACT_FONT_SCALE.min,
      PDF_CONTRACT_FONT_SCALE.max,
    ),
    pdfEmployeeSignatureScale: clampScale(
      company.pdfEmployeeSignatureScale ?? 100,
      PDF_EMPLOYEE_SIGNATURE_SCALE.min,
      PDF_EMPLOYEE_SIGNATURE_SCALE.max,
    ),
  };
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_REGEX.test(value.trim());
}

export function settingsFormToUpdateDto(form: CompanySettingsFormState): UpdateCompanyDto {
  return {
    nameAr: form.nameAr.trim(),
    nameEn: emptyToNull(form.nameEn),
    commercialRegistrationNo: emptyToNull(form.commercialRegistrationNo),
    taxNumber: emptyToNull(form.taxNumber),
    email: emptyToNull(form.email),
    phone: emptyToNull(form.phone),
    mobile: emptyToNull(form.mobile),
    website: emptyToNull(form.website),
    country: emptyToNull(form.country),
    city: emptyToNull(form.city),
    district: emptyToNull(form.district),
    address: emptyToNull(form.address),
    postalCode: emptyToNull(form.postalCode),
    logoUrl: emptyToNull(form.logoUrl),
    primaryColor: emptyToNull(form.primaryColor),
    secondaryColor: emptyToNull(form.secondaryColor),
    pdfWatermarkEnabled: form.pdfWatermarkEnabled,
    pdfWatermarkOpacity: form.pdfWatermarkOpacity,
    pdfContractFontScale: clampScale(
      form.pdfContractFontScale,
      PDF_CONTRACT_FONT_SCALE.min,
      PDF_CONTRACT_FONT_SCALE.max,
    ),
    pdfEmployeeSignatureScale: clampScale(
      form.pdfEmployeeSignatureScale,
      PDF_EMPLOYEE_SIGNATURE_SCALE.min,
      PDF_EMPLOYEE_SIGNATURE_SCALE.max,
    ),
  };
}
