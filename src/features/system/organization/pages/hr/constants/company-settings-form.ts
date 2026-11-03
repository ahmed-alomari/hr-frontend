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

/** Text sizes of the employment-contract PDF (percent of the standard size). */
export const PDF_CONTRACT_FONT_SCALES: ReadonlyArray<{ value: number; label?: string }> = [
  { value: 30, label: 'أصغر حجم' },
  { value: 35 },
  { value: 40 },
  { value: 45 },
  { value: 50, label: 'صغير جدًا' },
  { value: 55 },
  { value: 60 },
  { value: 65 },
  { value: 70, label: 'صغير' },
  { value: 75 },
  { value: 80 },
  { value: 85, label: 'متوسط' },
  { value: 90 },
  { value: 95 },
  { value: 100, label: 'عادي' },
];

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
    pdfContractFontScale: company.pdfContractFontScale ?? 100,
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
    pdfContractFontScale: form.pdfContractFontScale,
  };
}
