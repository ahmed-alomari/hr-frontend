import type { PermissionResponseDto } from '@/features/system/permissions/lib/api/permissions';

export const PERMISSION_RESOURCE_AR: Record<string, string> = {
  employees: 'الموظفين',
  attendance: 'الحضور',
  requests: 'الطلبات',
  payroll: 'الرواتب',
  hr: 'الموارد البشرية',
  reports: 'التقارير',
  settings: 'الإعدادات',
  leaves: 'الإجازات',
  contracts: 'العقود',
  organization: 'المنظمة',
};

export const PERMISSION_ACTION_AR: Record<string, string> = {
  read: 'عرض',
  create: 'إنشاء',
  update: 'تعديل',
  delete: 'حذف',
  approve: 'موافقة',
  export: 'تصدير',
};

export function permissionLabel(p: PermissionResponseDto): string {
  const named = p.nameAr?.trim();
  if (named) return named;
  const res = PERMISSION_RESOURCE_AR[p.resource ?? ''] ?? p.resource ?? '';
  const act = PERMISSION_ACTION_AR[p.action ?? ''] ?? p.action ?? '';
  return `${act}${res ? ` (${res})` : ''}`;
}

/** Text used to match a permission against a search box: Arabic name, code, resource, and parent group. */
export function permissionHaystack(p: PermissionResponseDto, parentTitle?: string): string {
  return [permissionLabel(p), p.nameEn, p.code, p.resource, p.action, parentTitle]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' ')
    .toLowerCase();
}
