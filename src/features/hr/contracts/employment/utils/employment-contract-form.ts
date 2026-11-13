import {
  CONTRACT_NATURE_LABELS,
  CONTRACT_STATUS_LABELS,
  WORK_ARRANGEMENT_LABELS,
} from '@/features/hr/contracts/lib/contracts-store';
import type {
  HRContractDraft,
  HRContractLifecycleStatus,
  HRContractNature,
  HRContractRecord,
  HRWorkArrangement,
} from '@/features/hr/contracts/lib/contracts-store';

export const HR_CONTRACTS_MODE_PARAM = 'mode';

export type AllowanceLine = { allowanceTypeId: string; amount: string };

export type EmploymentContractFormValues = {
  employeeId: string;
  contractNumber: string;
  contractType: HRContractNature;
  workArrangement: HRWorkArrangement;
  startDate: string;
  endDate: string;
  probationDays: string;
  annualLeaveDays: string;
  baseSalary: string;
  currency: string;
  templateId: string;
  allowanceLines: AllowanceLine[];
  allowancesNote: string;
  deductionsNote: string;
  articleIds: string[];
};

export function mergeEssentialArticleIds(
  articleIds: string[],
  essentialArticleIds: string[],
): string[] {
  if (essentialArticleIds.length === 0) return articleIds;
  // Keep the chosen order; essentials not yet chosen follow in library order.
  return [...new Set([...articleIds, ...essentialArticleIds])];
}

export function emptyEmploymentContractForm(essentialArticleIds: string[] = []): EmploymentContractFormValues {
  return {
    employeeId: '',
    contractNumber: '',
    contractType: 'fixed_term',
    workArrangement: 'full_time',
    startDate: '',
    endDate: '',
    probationDays: '90',
    annualLeaveDays: '21',
    baseSalary: '',
    currency: 'SAR',
    templateId: '',
    allowanceLines: [{ allowanceTypeId: '', amount: '' }],
    allowancesNote: '',
    deductionsNote: '',
    articleIds: [...essentialArticleIds],
  };
}

export function recordToEmploymentForm(r: HRContractRecord): EmploymentContractFormValues {
  return {
    employeeId: r.employeeId,
    contractNumber: r.contractNumber,
    contractType: r.contractType,
    workArrangement: r.workArrangement,
    startDate: r.startDate,
    endDate: r.endDate,
    probationDays: r.probationDays != null ? String(r.probationDays) : '',
    annualLeaveDays: r.annualLeaveDays != null ? String(r.annualLeaveDays) : '',
    baseSalary: String(r.baseSalary),
    currency: r.currency,
    templateId: r.templateId ?? '',
    allowanceLines:
      r.allowanceLines?.length > 0
        ? r.allowanceLines
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((l) => ({ allowanceTypeId: l.allowanceTypeId, amount: String(l.amount) }))
        : [{ allowanceTypeId: '', amount: '' }],
    allowancesNote: r.allowancesNote,
    deductionsNote: r.deductionsNote,
    articleIds: Array.isArray(r.articleIds) ? r.articleIds : [],
  };
}

export function cloneEmploymentFormFromContract(
  preserveEmployeeId: string,
  source: HRContractRecord,
): EmploymentContractFormValues {
  const merged = recordToEmploymentForm(source);
  return {
    ...merged,
    employeeId: preserveEmployeeId,
    contractNumber: '',
    templateId: source.templateId ?? '',
  };
}

export function employmentFormToDraft(
  v: EmploymentContractFormValues,
  status: HRContractLifecycleStatus = 'draft',
): HRContractDraft {
  const al = v.annualLeaveDays.trim();
  const annualLeaveDays =
    al === ''
      ? null
      : (() => {
          const n = parseInt(al, 10);
          return Number.isFinite(n) && n >= 0 ? n : null;
        })();
  return {
    employeeId: v.employeeId,
    employeeNameAr: '',
    branchNameAr: '',
    contractNumber: v.contractNumber.trim() || '',
    contractType: v.contractType,
    workArrangement: v.workArrangement,
    startDate: v.startDate,
    endDate: v.endDate,
    probationDays: v.probationDays ? parseInt(v.probationDays, 10) : null,
    annualLeaveDays,
    baseSalary: parseFloat(v.baseSalary) || 0,
    currency: v.currency,
    status,
    templateId: v.templateId || null,
    allowanceLines: v.allowanceLines
      .filter((l) => l.allowanceTypeId)
      .map((l, i) => ({
        allowanceTypeId: l.allowanceTypeId,
        allowanceTypeNameAr: '',
        allowanceTypeCode: '',
        amount: parseFloat(l.amount) || 0,
        sortOrder: i,
      })),
    allowancesNote: v.allowancesNote,
    deductionsNote: v.deductionsNote,
    amendsContractId: null,
    supersededByContractId: null,
    earlyTerminationReason: null,
    articleIds: v.articleIds,
    employeeSigned: false,
    signatureMethod: null,
    signedAttachmentId: null,
    signatureImageUrl: null,
    rejectionReason: null,
    signedAt: null,
  };
}

export type EmploymentStatusFilter = 'all' | HRContractLifecycleStatus;
export type EmploymentKindFilter = 'all' | HRContractNature;
export type EmploymentWorkArrangementFilter = 'all' | HRWorkArrangement;

export const EMPLOYMENT_STATUS_FILTER_OPTIONS: { value: EmploymentStatusFilter; label: string }[] = [
  { value: 'all', label: 'كل الحالات' },
  ...(Object.entries(CONTRACT_STATUS_LABELS) as [HRContractLifecycleStatus, string][])
    .filter(([status]) => status !== 'superseded' && status !== 'cancelled')
    .map(([value, label]) => ({ value, label })),
];

export const EMPLOYMENT_KIND_FILTER_OPTIONS: { value: EmploymentKindFilter; label: string }[] = [
  { value: 'all', label: 'كل الأنواع' },
  ...(Object.entries(CONTRACT_NATURE_LABELS) as [HRContractNature, string][]).map(([v, l]) => ({
    value: v,
    label: l,
  })),
];

export const EMPLOYMENT_WORK_ARRANGEMENT_FILTER_OPTIONS: {
  value: EmploymentWorkArrangementFilter;
  label: string;
}[] = [
  { value: 'all', label: 'كل أنظمة العمل' },
  ...(Object.entries(WORK_ARRANGEMENT_LABELS) as [HRWorkArrangement, string][]).map(([v, l]) => ({
    value: v,
    label: l,
  })),
];
