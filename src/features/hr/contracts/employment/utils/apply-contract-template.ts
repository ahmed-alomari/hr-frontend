import type {
  ContractNature,
  ContractTemplateDto,
  WorkArrangement,
} from '@/features/hr/contracts/contract-templates/types/contract-template';
import type { EmploymentContractFormValues } from '@/features/hr/contracts/employment/utils/employment-contract-form';

const CONTRACT_NATURE_VALUES: ContractNature[] = ['indefinite', 'fixed_term', 'project_based'];
const WORK_ARRANGEMENT_VALUES: WorkArrangement[] = ['full_time', 'part_time', 'remote', 'hybrid'];

function toContractNature(value: string): ContractNature {
  if (CONTRACT_NATURE_VALUES.includes(value as ContractNature)) return value as ContractNature;
  return 'fixed_term';
}

function toWorkArrangement(value: string): WorkArrangement {
  if (WORK_ARRANGEMENT_VALUES.includes(value as WorkArrangement)) return value as WorkArrangement;
  return 'full_time';
}

export function computeTemplateEndDate(
  nature: ContractNature,
  durationMonths: number | null,
  startDate: string,
): string | undefined {
  if (nature !== 'fixed_term' || !durationMonths || !startDate.trim()) return undefined;
  return addMonthsToDate(startDate.trim(), durationMonths);
}

function addMonthsToDate(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setMonth(date.getMonth() + months);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** يطبّق قالب العقد على حقول نموذج عقد العمل */
export function applyContractTemplateToForm(
  template: ContractTemplateDto,
  options?: { essentialArticleIds?: string[]; startDate?: string },
): Partial<EmploymentContractFormValues> {
  const nature = toContractNature(template.defaultContractNature);
  const templateArticleIds = (template.articles ?? []).map((a) => a.articleId);
  const essential = options?.essentialArticleIds ?? [];
  const articleIds =
    templateArticleIds.length > 0
      ? [...new Set([...templateArticleIds, ...essential])]
      : [...essential];

  const start = options?.startDate?.trim();
  const endDate = computeTemplateEndDate(nature, template.durationMonths, start ?? '') ?? '';

  return {
    templateId: template.id,
    contractType: nature,
    workArrangement: toWorkArrangement(template.defaultWorkArrangement),
    probationDays:
      template.defaultProbationDays != null ? String(template.defaultProbationDays) : '',
    annualLeaveDays:
      template.defaultAnnualLeaveDays != null ? String(template.defaultAnnualLeaveDays) : '',
    baseSalary: template.suggestedBaseSalary
      ? String(parseFloat(template.suggestedBaseSalary) || 0)
      : '',
    currency: template.currency || 'SAR',
    allowancesNote: template.allowancesHint ?? '',
    allowanceLines:
      (template.allowanceLines?.length ?? 0) > 0
        ? template.allowanceLines.map((l) => ({
            allowanceTypeId: l.allowanceTypeId,
            amount: String(parseFloat(l.amount) || 0),
          }))
        : [{ allowanceTypeId: '', amount: '' }],
    articleIds,
    ...(endDate ? { endDate } : {}),
  };
}
