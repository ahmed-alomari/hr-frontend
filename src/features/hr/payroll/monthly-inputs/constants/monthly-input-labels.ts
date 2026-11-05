import type {
  MonthlyInputDirectionDto,
  MonthlyInputKindDto,
  MonthlyInputSourceKindDto,
} from '@/features/hr/payroll/lib/api/monthly-inputs';

export const MONTHLY_INPUT_KIND_LABELS: Record<MonthlyInputKindDto, string> = {
  bonus: 'مكافأة',
  overtime: 'عمل إضافي',
  allowance_extra: 'بدل إضافي',
  absence_deduction: 'خصم غياب',
  lateness_deduction: 'خصم تأخير',
  shortage_deduction: 'خصم نقص الدوام',
  unpaid_leave_deduction: 'خصم إجازة بدون راتب',
  discipline_deduction: 'خصم انضباط',
  advance_installment: 'قسط سلفة',
  loan_installment: 'قسط قرض',
  gosi_adjustment: 'تعديل تأمينات',
  other_addition: 'إضافة أخرى',
  other_deduction: 'خصم آخر',
};

export const MONTHLY_INPUT_KIND_ORDER: MonthlyInputKindDto[] = [
  'bonus',
  'overtime',
  'allowance_extra',
  'absence_deduction',
  'lateness_deduction',
  'shortage_deduction',
  'unpaid_leave_deduction',
  'discipline_deduction',
  'advance_installment',
  'loan_installment',
  'gosi_adjustment',
  'other_addition',
  'other_deduction',
];

export const MONTHLY_INPUT_DIRECTION_LABELS: Record<MonthlyInputDirectionDto, string> = {
  addition: 'إضافة',
  deduction: 'خصم',
};

export const MONTHLY_INPUT_SOURCE_KIND_LABELS: Record<MonthlyInputSourceKindDto, string> = {
  manual: 'يدوي',
  attendance: 'حضور',
  discipline: 'انضباط',
  advance: 'سلفة',
  leave: 'إجازة',
  other: 'أخرى',
};

export const MONTHLY_INPUT_SOURCE_KIND_ORDER: MonthlyInputSourceKindDto[] = [
  'manual',
  'attendance',
  'discipline',
  'advance',
  'leave',
  'other',
];

export const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

export function formatPayrollPeriodLabel(year: number | null, month: number | null): string {
  if (!year || !month) return '—';
  const name = AR_MONTHS[month - 1];
  return name ? `${name} ${year}` : `${month}/${year}`;
}

import { formatMoneyDigits } from '@/shared/utils';

export function formatAmount(amount: string | number, _currency?: string): string {
  return formatMoneyDigits(amount, 2);
}
