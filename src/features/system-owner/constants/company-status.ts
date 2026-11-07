import type {
  CompanyOperatingMode,
  CompanyStatus,
  CompanyStatusAction,
} from '@/features/system-owner/lib/api/system-owner';

export const COMPANY_STATUS_LABEL: Record<CompanyStatus, string> = {
  active: 'فعّالة',
  suspended: 'متوقفة',
  archived: 'منتهية',
};

export const COMPANY_STATUS_TABS: ReadonlyArray<{ value: CompanyStatus; label: string }> = [
  { value: 'active', label: 'الفعّالة' },
  { value: 'suspended', label: 'المتوقفة' },
  { value: 'archived', label: 'المنتهية' },
];

export const COMPANY_STATUS_ACTION_DONE: Record<CompanyStatusAction, string> = {
  suspend: 'أُوقفت الشركة مؤقتاً. لا يدخلها مستخدموها حتى تستأنفها.',
  resume: 'استُؤنفت الشركة، ويدخلها مستخدموها كما كانوا.',
  archive: 'انتقلت الشركة إلى «المنتهية». بياناتها محفوظة.',
  restore: 'أُعيدت الشركة إلى العمل.',
};

export const COMPANY_MODE_LABEL: Record<CompanyOperatingMode, string> = {
  trial: 'تجربة',
  testing: 'فحص',
  production: 'إنتاج',
};

export const COMPANY_MODE_HINT: Record<CompanyOperatingMode, string> = {
  trial: 'للعرض والتجربة: تُحمَّل البيانات التجريبية وتُحذف بحرية.',
  testing: 'العميل يفحص النظام قبل التشغيل: البيانات التجريبية ما زالت متاحة.',
  production: 'الشركة تعمل على بيانات حقيقية: لا تُحمَّل البيانات التجريبية ولا تُحذف.',
};

export const COMPANY_MODES: readonly CompanyOperatingMode[] = ['trial', 'testing', 'production'];
