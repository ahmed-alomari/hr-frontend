import { apiRequest, type PaginatedResult } from '@/features/hr/lib/api/client';
import type { ListGroupsResult } from '@/components/ui/list-group';

export type MonthlyInputKindDto =
  | 'bonus'
  | 'overtime'
  | 'allowance_extra'
  | 'absence_deduction'
  | 'lateness_deduction'
  | 'shortage_deduction'
  | 'unpaid_leave_deduction'
  | 'discipline_deduction'
  | 'advance_installment'
  | 'loan_installment'
  | 'gosi_adjustment'
  | 'other_addition'
  | 'other_deduction';

export type MonthlyInputDirectionDto = 'addition' | 'deduction';

export type MonthlyInputSourceKindDto =
  | 'manual'
  | 'attendance'
  | 'discipline'
  | 'advance'
  | 'leave'
  | 'other';

export type MonthlyInputResponseDto = {
  id: string;
  companyId: string;
  payrollPeriodId: string;
  periodYear: number | null;
  periodMonth: number | null;
  employeeId: string;
  employeeNameAr: string | null;
  inputKind: MonthlyInputKindDto;
  direction: MonthlyInputDirectionDto;
  amount: string;
  currency: string;
  note: string | null;
  sourceKind: MonthlyInputSourceKindDto | null;
  sourceTable: string | null;
  sourceId: string | null;
  affectsSalary: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  /** With `groupBy`: the key of the row's group (as in `/groups`). */
  groupKey?: string | null;
};

export type MonthlyInputListQuery = {
  /** Employee status filter (empty status = active); absent = every status. */
  employeeStatus?: 'active' | 'suspended' | 'ended';
  page?: number;
  limit?: number;
  companyId?: string;
  payrollPeriodId?: string;
  employeeId?: string;
  /** Unique ids — serialized as comma-separated (`id1,id2`). */
  employeeIds?: string[];
  inputKind?: MonthlyInputKindDto;
  direction?: MonthlyInputDirectionDto;
  sourceKind?: MonthlyInputSourceKindDto;
  sourceTable?: string;
  sourceId?: string;
  affectsSalary?: boolean;
  /** Employee's primary assignment branch / department. */
  branchId?: string;
  departmentId?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  /** Group field (`/groups`), or with `groupValue` the rows of one group. */
  groupBy?: string;
  groupValue?: string;
};

export type MonthlyInputKindSummaryEmployeeDto = {
  employeeId: string;
  employeeNameAr: string | null;
  totalAmount: string;
  count: number;
};

export type MonthlyInputKindSummaryResponseDto = {
  payrollPeriodId: string;
  periodYear: number | null;
  periodMonth: number | null;
  inputKind: MonthlyInputKindDto;
  direction: MonthlyInputDirectionDto;
  currency: string;
  totalAmount: string;
  totalCount: number;
  employeesCount: number;
  byEmployee: MonthlyInputKindSummaryEmployeeDto[];
};

export type CreateMonthlyInputDto = {
  companyId: string;
  payrollPeriodId: string;
  employeeId: string;
  inputKind: MonthlyInputKindDto;
  direction: MonthlyInputDirectionDto;
  amount: number;
  currency?: string;
  note?: string;
  sourceKind?: string;
  sourceTable?: string;
  sourceId?: string;
  affectsSalary?: boolean;
  createdBy?: string | null;
};

export type UpdateMonthlyInputDto = Partial<
  Omit<CreateMonthlyInputDto, 'companyId' | 'payrollPeriodId' | 'employeeId'>
>;

export const monthlyInputsApi = {
  list: (params?: MonthlyInputListQuery) =>
    apiRequest<PaginatedResult<MonthlyInputResponseDto>>('/payroll/monthly-inputs', {
      query: params,
    }),
  /** Counts and amounts of the filtered list, per `groupBy` group and overall. */
  groups: (params?: Omit<MonthlyInputListQuery, 'page' | 'limit' | 'sortBy' | 'sortDir' | 'groupValue'>) =>
    apiRequest<ListGroupsResult>('/payroll/monthly-inputs/groups', { query: params }),
  get: (id: string) =>
    apiRequest<MonthlyInputResponseDto>(`/payroll/monthly-inputs/${id}`),
  create: (body: CreateMonthlyInputDto) =>
    apiRequest<MonthlyInputResponseDto>('/payroll/monthly-inputs', { method: 'POST', body }),
  update: (id: string, body: UpdateMonthlyInputDto) =>
    apiRequest<MonthlyInputResponseDto>(`/payroll/monthly-inputs/${id}`, {
      method: 'PATCH',
      body,
    }),
  delete: (id: string) =>
    apiRequest<void>(`/payroll/monthly-inputs/${id}`, { method: 'DELETE' }),

  summarizeAbsence: (payrollPeriodId: string) =>
    apiRequest<MonthlyInputKindSummaryResponseDto>(
      `/payroll/monthly-inputs/summary/absence/${payrollPeriodId}`,
    ),
  summarizeLateness: (payrollPeriodId: string) =>
    apiRequest<MonthlyInputKindSummaryResponseDto>(
      `/payroll/monthly-inputs/summary/lateness/${payrollPeriodId}`,
    ),
  summarizeOvertime: (payrollPeriodId: string) =>
    apiRequest<MonthlyInputKindSummaryResponseDto>(
      `/payroll/monthly-inputs/summary/overtime/${payrollPeriodId}`,
    ),
  summarizeAdvances: (payrollPeriodId: string) =>
    apiRequest<MonthlyInputKindSummaryResponseDto>(
      `/payroll/monthly-inputs/summary/advances/${payrollPeriodId}`,
    ),
  summarizeBonuses: (payrollPeriodId: string) =>
    apiRequest<MonthlyInputKindSummaryResponseDto>(
      `/payroll/monthly-inputs/summary/bonuses/${payrollPeriodId}`,
    ),
  summarizePenalties: (payrollPeriodId: string) =>
    apiRequest<MonthlyInputKindSummaryResponseDto>(
      `/payroll/monthly-inputs/summary/penalties/${payrollPeriodId}`,
    ),
};
