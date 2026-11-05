import { create } from 'zustand';
import { STATUS_PILL } from '@/shared/status-pill-classes';
import { AR_STATUS } from '@/shared/i18n/ar';
import { useAuthStore } from '@/features/auth/lib/auth-store';
import { getDefaultCompanyId } from '@/features/hr/organization/lib/default-company-id';
import { payrollPeriodsApi, type PayrollPeriodResponseDto } from './api/payroll-periods';
import { ApiError } from '@/features/hr/lib/api/client';
import {
  monthlyInputsApi,
  type MonthlyInputResponseDto,
  type MonthlyInputKindDto,
  type MonthlyInputDirectionDto,
} from './api/monthly-inputs';
import type { HRContractRecord } from '@/features/hr/contracts/lib/contracts-store';

export type HRPayrollPeriodStatus = 'draft' | 'open' | 'locked' | 'closed' | 'cancelled';

export const PERIOD_STATUS_ORDER: HRPayrollPeriodStatus[] = [
  'draft',
  'open',
  'locked',
  'closed',
  'cancelled',
];
export type HRPayrollReviewStage = 'first_review' | 'second_review' | 'third_review';

export type HRPayrollMonthlyInputKind =
  | 'absence_days'
  | 'late_minutes'
  | 'overtime_hours'
  | 'deduction_amount'
  | 'allowance_amount'
  | 'advance_recovery'
  | 'other';

export type HRPayrollMonthlyInput = {
  kind: HRPayrollMonthlyInputKind;
  value: number;
  note: string;
};

export type HRPayrollEmploymentLine = {
  id: string;
  sortOrder: number;
  employeeId: string;
  employeeNameAr: string;
  departmentSnapshot: string;
  jobTitleArSnapshot: string;
  baseSalarySnapshot: number;
  contractCurrency: string;
  contractId: string;
  contractNumber: string;
  capturedAt: string;
};

export type HRPayrollPeriodIncludeFlags = {
  includeOvertime: boolean;
  includeBonuses: boolean;
  includeAdvances: boolean;
  includeAbsence: boolean;
  includeLateness: boolean;
  includePenalties: boolean;
  includeManualInputs: boolean;
};

export type HRPayrollPeriodRecord = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  periodStart: string;
  periodEnd: string;
  status: HRPayrollPeriodStatus;
  reviewStage: HRPayrollReviewStage;
  isReviewCompleted: boolean;
  reviewNotes: string | null;
  firstReviewedBy: string | null;
  firstReviewedAt: string | null;
  secondReviewedBy: string | null;
  secondReviewedAt: string | null;
  thirdReviewedBy: string | null;
  thirdReviewedAt: string | null;
  snapshotContractIds: string[];
  employmentLines: HRPayrollEmploymentLine[];
  linesMaterializedAt: string | null;
  employmentLineMonthlyInputs: Record<string, HRPayrollMonthlyInput[]>;
  notes: string;
  createdAt: string;
  updatedAt: string;
} & HRPayrollPeriodIncludeFlags;

export type HRPayrollPeriodDraft = Omit<HRPayrollPeriodRecord, 'id' | 'createdAt' | 'updatedAt'>;

const MONTH_NAMES_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const MONTH_NAMES_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const STATUS_MAP: Record<string, HRPayrollPeriodStatus> = {
  draft: 'draft',
  open: 'open',
  locked: 'locked',
  closed: 'closed',
  cancelled: 'cancelled',
};

function defaultIncludeFlags(): HRPayrollPeriodIncludeFlags {
  return {
    includeOvertime: true,
    includeBonuses: true,
    includeAdvances: true,
    includeAbsence: true,
    includeLateness: true,
    includePenalties: true,
    includeManualInputs: true,
  };
}

export function mapPayrollPeriodFromApi(r: PayrollPeriodResponseDto): HRPayrollPeriodRecord {
  const m = r.periodMonth;
  const y = r.periodYear;
  const includes = defaultIncludeFlags();
  return {
    id: r.id,
    code: `PAY-${y}-${String(m).padStart(2, '0')}`,
    nameAr: `${MONTH_NAMES_AR[m - 1]} ${y}`,
    nameEn: `${MONTH_NAMES_EN[m - 1]} ${y}`,
    periodStart: r.startDate,
    periodEnd: r.endDate,
    status: STATUS_MAP[r.status] ?? 'draft',
    reviewStage: r.reviewStage ?? 'first_review',
    isReviewCompleted: r.isReviewCompleted ?? false,
    reviewNotes: r.reviewNotes ?? null,
    firstReviewedBy: r.firstReviewedBy ?? null,
    firstReviewedAt: r.firstReviewedAt ?? null,
    secondReviewedBy: r.secondReviewedBy ?? null,
    secondReviewedAt: r.secondReviewedAt ?? null,
    thirdReviewedBy: r.thirdReviewedBy ?? null,
    thirdReviewedAt: r.thirdReviewedAt ?? null,
    snapshotContractIds: [],
    employmentLines: [],
    linesMaterializedAt: null,
    employmentLineMonthlyInputs: {},
    notes: r.notes ?? '',
    includeOvertime: r.includeOvertime ?? includes.includeOvertime,
    includeBonuses: r.includeBonuses ?? includes.includeBonuses,
    includeAdvances: r.includeAdvances ?? includes.includeAdvances,
    includeAbsence: r.includeAbsence ?? includes.includeAbsence,
    includeLateness: r.includeLateness ?? includes.includeLateness,
    includePenalties: r.includePenalties ?? includes.includePenalties,
    includeManualInputs: r.includeManualInputs ?? includes.includeManualInputs,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function mergePeriodFromApi(
  existing: HRPayrollPeriodRecord,
  mapped: HRPayrollPeriodRecord,
): HRPayrollPeriodRecord {
  return {
    ...mapped,
    snapshotContractIds: existing.snapshotContractIds,
    employmentLines: existing.employmentLines,
    linesMaterializedAt: existing.linesMaterializedAt,
    employmentLineMonthlyInputs: existing.employmentLineMonthlyInputs,
  };
}

// Map a backend MonthlyInputResponseDto to a frontend HRPayrollMonthlyInput.
// baseSalarySnapshot is required to convert absence SAR → days correctly.
const ADMIN_DIRECT_NOTE = 'خصم او اضافة مباشرة';

export function buildAdminDirectInputNote(userNote?: string): string {
  const trimmed = userNote?.trim() ?? '';
  return trimmed ? `${ADMIN_DIRECT_NOTE}: ${trimmed}` : ADMIN_DIRECT_NOTE;
}

function isAdminDirectMonthlyInput(dto: MonthlyInputResponseDto): boolean {
  return dto.note === ADMIN_DIRECT_NOTE
    || (dto.note?.startsWith(`${ADMIN_DIRECT_NOTE}:`) ?? false)
    || (dto.sourceTable === 'frontend_compensation_panel'
      && (dto.inputKind === 'other_addition' || dto.inputKind === 'other_deduction'));
}

function fromBackendInput(dto: MonthlyInputResponseDto, baseSalarySnapshot = 0): HRPayrollMonthlyInput {
  const amount = parseFloat(String(dto.amount)) || 0;
  switch (dto.inputKind) {
    case 'overtime':
      return { kind: 'overtime_hours', value: amount, note: dto.note ?? '' };
    case 'allowance_extra':
    case 'bonus':
      return { kind: 'allowance_amount', value: amount, note: dto.note ?? '' };
    case 'absence_deduction': {
      const dailyRate = baseSalarySnapshot > 0 ? baseSalarySnapshot / 30 : 1;
      const days = Math.round((amount / dailyRate) * 1000) / 1000;
      return { kind: 'absence_days', value: days, note: dto.note ?? '' };
    }
    case 'lateness_deduction':
    case 'shortage_deduction':
      return { kind: 'late_minutes', value: amount, note: dto.note ?? '' };
    case 'advance_installment':
    case 'loan_installment':
      return { kind: 'advance_recovery', value: amount, note: dto.note ?? '' };
    case 'discipline_deduction':
      return { kind: 'deduction_amount', value: amount, note: dto.note ?? '' };
    case 'other_addition':
      return { kind: 'other', value: amount, note: dto.note ?? '' };
    case 'other_deduction':
      if (isAdminDirectMonthlyInput(dto)) {
        return { kind: 'other', value: -amount, note: dto.note ?? '' };
      }
      return { kind: 'deduction_amount', value: amount, note: dto.note ?? '' };
    default:
      return { kind: 'other', value: amount, note: dto.note ?? '' };
  }
}

interface State {
  periods: HRPayrollPeriodRecord[];
  catalogCompanyId: string | null;
  fullLoadCompanyId: string | null;
  isLoading: boolean;
  error: { message: string; status: number } | null;
  /** Raw backend inputs keyed by periodId → employeeId → list. Used to populate lines after materialize. */
  _rawInputs: Record<string, Record<string, MonthlyInputResponseDto[]>>;
  /** Period list only — for reports / dropdowns without loading all monthly inputs. */
  fetchCatalog: () => Promise<void>;
  /** Reload period list without monthly inputs (e.g. after finalize). */
  refreshCatalog: () => Promise<void>;
  fetch: () => Promise<void>;
  /** Fetch a single period by id when it is missing from the cached list (e.g. deep link refresh). */
  ensurePeriodLoaded: (id: string) => Promise<HRPayrollPeriodRecord | null>;
  materializeFromContracts: (contracts: HRContractRecord[]) => void;
  add: (data: HRPayrollPeriodDraft) => Promise<string>;
  update: (id: string, patch: Partial<HRPayrollPeriodDraft>) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  open: (id: string) => Promise<boolean>;
  close: (id: string) => Promise<boolean>;
  advanceReview: (id: string, notes?: string) => Promise<void>;
  revertReview: (id: string, notes?: string) => Promise<void>;
  setMonthlyInputs: (periodId: string, lineId: string, inputs: HRPayrollMonthlyInput[]) => Promise<void>;
  refreshMonthlyInputsForPeriod: (periodId: string) => Promise<void>;
}

let periodsCatalogFetchPromise: Promise<void> | null = null;
let periodsFullFetchPromise: Promise<void> | null = null;

export const useHRPayrollPeriodsStore = create<State>()((set, get) => ({
  periods: [],
  catalogCompanyId: null,
  fullLoadCompanyId: null,
  isLoading: false,
  error: null,
  _rawInputs: {},

  fetchCatalog: async () => {
    const companyId = getDefaultCompanyId();
    if (!companyId) return;

    const { catalogCompanyId, isLoading } = get();
    if (catalogCompanyId === companyId) return;
    if (isLoading && periodsCatalogFetchPromise) return periodsCatalogFetchPromise;

    periodsCatalogFetchPromise = (async () => {
      set({ isLoading: true, error: null });
      try {
        const periodsResult = await payrollPeriodsApi.list({ companyId, limit: 200 });
        set({
          periods: periodsResult.items.map(mapPayrollPeriodFromApi),
          catalogCompanyId: companyId,
          isLoading: false,
        });
      } catch (e) {
        set({ error: { message: (e as Error).message, status: e instanceof ApiError ? e.status : 0 }, isLoading: false, catalogCompanyId: null });
      } finally {
        periodsCatalogFetchPromise = null;
      }
    })();

    return periodsCatalogFetchPromise;
  },

  refreshCatalog: async () => {
    const companyId = getDefaultCompanyId();
    if (!companyId) return;

    set({ isLoading: true, error: null });
    try {
      const periodsResult = await payrollPeriodsApi.list({ companyId, limit: 200 });
      set({
        periods: periodsResult.items.map(mapPayrollPeriodFromApi),
        catalogCompanyId: companyId,
        isLoading: false,
      });
    } catch (e) {
      set({
        error: { message: (e as Error).message, status: e instanceof ApiError ? e.status : 0 },
        isLoading: false,
        catalogCompanyId: null,
      });
    }
  },

  fetch: async () => {
    const companyId = getDefaultCompanyId();
    if (!companyId) return;

    const { fullLoadCompanyId, isLoading } = get();
    if (fullLoadCompanyId === companyId) return;
    if (isLoading && periodsFullFetchPromise) return periodsFullFetchPromise;

    periodsFullFetchPromise = (async () => {
      set({ isLoading: true, error: null });
      try {
        const [periodsResult, inputsResult] = await Promise.all([
          payrollPeriodsApi.list({ companyId, limit: 200 }),
          monthlyInputsApi.list({ companyId, limit: 2000 }),
        ]);

        // Group backend inputs by periodId → employeeId
        const rawInputs: Record<string, Record<string, MonthlyInputResponseDto[]>> = {};
        for (const dto of inputsResult.items) {
          if (!rawInputs[dto.payrollPeriodId]) rawInputs[dto.payrollPeriodId] = {};
          if (!rawInputs[dto.payrollPeriodId][dto.employeeId]) rawInputs[dto.payrollPeriodId][dto.employeeId] = [];
          rawInputs[dto.payrollPeriodId][dto.employeeId].push(dto);
        }

        set({
          periods: periodsResult.items.map(mapPayrollPeriodFromApi),
          _rawInputs: rawInputs,
          catalogCompanyId: companyId,
          fullLoadCompanyId: companyId,
          isLoading: false,
        });
      } catch (e) {
        set({ error: { message: (e as Error).message, status: e instanceof ApiError ? e.status : 0 }, isLoading: false, fullLoadCompanyId: null });
      } finally {
        periodsFullFetchPromise = null;
      }
    })();

    return periodsFullFetchPromise;
  },

  ensurePeriodLoaded: async (id) => {
    const existing = get().periods.find((p) => p.id === id);
    if (existing) return existing;
    const companyId = getDefaultCompanyId();
    if (!companyId) return null;
    try {
      const r = await payrollPeriodsApi.get(id);
      const mapped = mapPayrollPeriodFromApi(r);
      set((s) => ({
        periods: s.periods.some((p) => p.id === id)
          ? s.periods.map((p) => (p.id === id ? mergePeriodFromApi(p, mapped) : p))
          : [...s.periods, mapped],
      }));
      return get().periods.find((p) => p.id === id) ?? mapped;
    } catch {
      return null;
    }
  },

  materializeFromContracts: (contracts) => {
    set((s) => ({
      periods: s.periods.map((period) => {
        if ((period.employmentLines?.length ?? 0) > 0) {
          return period;
        }
        const active = contracts.filter((c) => {
          if (c.status !== 'active') return false;
          if (!c.startDate) return false;
          if (c.startDate > period.periodEnd) return false;
          if (c.endDate && c.endDate < period.periodStart) return false;
          return true;
        });
        if (active.length === 0) return period;

        const capturedAt = new Date().toISOString();
        const lines: HRPayrollEmploymentLine[] = active.map((c, idx) => ({
          id: `${period.id}-${c.id}`,
          sortOrder: idx,
          employeeId: c.employeeId,
          employeeNameAr: c.employeeNameAr || '—',
          departmentSnapshot: c.branchNameAr || '—',
          jobTitleArSnapshot: '—',
          baseSalarySnapshot: c.baseSalary,
          contractCurrency: c.currency,
          contractId: c.id,
          contractNumber: c.contractNumber,
          capturedAt,
        }));

        // Populate monthly inputs from backend raw cache
        const periodRaw = s._rawInputs[period.id] ?? {};
        const employmentLineMonthlyInputs: Record<string, HRPayrollMonthlyInput[]> = {};
        for (const line of lines) {
          const dtos = periodRaw[line.employeeId] ?? [];
          if (dtos.length > 0) {
            employmentLineMonthlyInputs[line.id] = dtos.map(d =>
              fromBackendInput(d, line.baseSalarySnapshot),
            );
          }
        }

        return {
          ...period,
          employmentLines: lines,
          snapshotContractIds: active.map((c) => c.id),
          linesMaterializedAt: capturedAt,
          employmentLineMonthlyInputs,
        };
      }),
    }));
  },

  add: async (data) => {
    const companyId = getDefaultCompanyId() ?? '';
    const [yearStr, monthStr] = data.periodStart.split('-');
    const periodYear = parseInt(yearStr ?? '0', 10);
    const periodMonth = parseInt(monthStr ?? '0', 10);
    const created = await payrollPeriodsApi.create({
      companyId,
      periodYear,
      periodMonth,
      startDate: data.periodStart,
      endDate: data.periodEnd,
      payrollDate: data.periodEnd,
      status: (['draft', 'open', 'locked', 'closed', 'cancelled'].includes(data.status)
        ? data.status
        : 'draft') as PayrollPeriodResponseDto['status'],
      notes: data.notes || undefined,
    });
    const mapped = mapPayrollPeriodFromApi(created);
    set(s => ({ periods: [mapped, ...s.periods] }));
    return mapped.id;
  },

  update: async (id, patch) => {
    try {
      const updateBody: Parameters<typeof payrollPeriodsApi.update>[1] = {};
      if (patch.periodStart) updateBody.startDate = patch.periodStart;
      if (patch.periodEnd) {
        updateBody.endDate = patch.periodEnd;
        updateBody.payrollDate = patch.periodEnd;
      }
      if (patch.notes !== undefined) updateBody.notes = patch.notes;
      if (patch.includeOvertime !== undefined) updateBody.includeOvertime = patch.includeOvertime;
      if (patch.includeBonuses !== undefined) updateBody.includeBonuses = patch.includeBonuses;
      if (patch.includeAdvances !== undefined) updateBody.includeAdvances = patch.includeAdvances;
      if (patch.includeAbsence !== undefined) updateBody.includeAbsence = patch.includeAbsence;
      if (patch.includeLateness !== undefined) updateBody.includeLateness = patch.includeLateness;
      if (patch.includePenalties !== undefined) updateBody.includePenalties = patch.includePenalties;
      if (patch.includeManualInputs !== undefined) updateBody.includeManualInputs = patch.includeManualInputs;
      const updated = await payrollPeriodsApi.update(id, updateBody);
      set(s => ({
        periods: s.periods.map(p => {
          if (p.id !== id) return p;
          const base = mapPayrollPeriodFromApi(updated);
          return mergePeriodFromApi(p, {
            ...base,
            snapshotContractIds: patch.snapshotContractIds ?? p.snapshotContractIds,
            employmentLines: patch.employmentLines ?? p.employmentLines,
            linesMaterializedAt: patch.linesMaterializedAt !== undefined ? patch.linesMaterializedAt : p.linesMaterializedAt,
            employmentLineMonthlyInputs: patch.employmentLineMonthlyInputs ?? p.employmentLineMonthlyInputs,
          });
        }),
      }));
      return true;
    } catch {
      return false;
    }
  },

  remove: async (id) => {
    try {
      await payrollPeriodsApi.delete(id);
      set(s => ({ periods: s.periods.filter(p => p.id !== id) }));
      return true;
    } catch {
      return false;
    }
  },

  open: async (id) => {
    try {
      const updated = await payrollPeriodsApi.update(id, { status: 'open' });
      set(s => ({
        periods: s.periods.map(p => p.id === id ? mergePeriodFromApi(p, mapPayrollPeriodFromApi(updated)) : p),
      }));
      return true;
    } catch {
      return false;
    }
  },

  close: async (id) => {
    try {
      const updated = await payrollPeriodsApi.update(id, { status: 'closed' });
      set(s => ({
        periods: s.periods.map(p => p.id === id ? mergePeriodFromApi(p, mapPayrollPeriodFromApi(updated)) : p),
      }));
      return true;
    } catch {
      return false;
    }
  },

  advanceReview: async (id, notes) => {
    const reviewedBy = useAuthStore.getState().user?.email ?? undefined;
    const updated = await payrollPeriodsApi.advanceReview(id, { reviewedBy, notes });
    set(s => ({
      periods: s.periods.map(p => p.id === id ? mergePeriodFromApi(p, mapPayrollPeriodFromApi(updated)) : p),
    }));
  },

  revertReview: async (id, notes) => {
    const reviewedBy = useAuthStore.getState().user?.email ?? undefined;
    const updated = await payrollPeriodsApi.revertReview(id, { reviewedBy, notes });
    set(s => ({
      periods: s.periods.map(p => p.id === id ? mergePeriodFromApi(p, mapPayrollPeriodFromApi(updated)) : p),
    }));
  },

  setMonthlyInputs: async (periodId, lineId, inputs) => {
    // Optimistic local update
    set(s => ({
      periods: s.periods.map(p => {
        if (p.id !== periodId) return p;
        return {
          ...p,
          employmentLineMonthlyInputs: { ...p.employmentLineMonthlyInputs, [lineId]: inputs },
        };
      }),
    }));

    const companyId = getDefaultCompanyId();
    if (!companyId) return;

    const state = get();
    const period = state.periods.find(p => p.id === periodId);
    const line = period?.employmentLines.find(l => l.id === lineId || l.employeeId === lineId);
    const employeeId = line?.employeeId ?? lineId;
    const baseSalary = line?.baseSalarySnapshot ?? 0;
    if (!employeeId) return;

    try {
      // Delete all existing backend inputs for this (period, employee) pair that came from the compensation panel
      const existing = await monthlyInputsApi.list({
        companyId,
        payrollPeriodId: periodId,
        employeeId,
        limit: 500,
      });
      const toDelete = existing.items.filter(
        d => d.sourceTable === 'frontend_compensation_panel',
      );
      await Promise.all(toDelete.map(d => monthlyInputsApi.delete(d.id)));

      // Create new inputs
      const creates = inputs
        .filter(i => (i.kind === 'other' ? i.value !== 0 : i.value > 0))
        .map(i => {
          let inputKind: MonthlyInputKindDto;
          let direction: MonthlyInputDirectionDto;
          let amount: number;

          switch (i.kind) {
            case 'overtime_hours':
              inputKind = 'overtime'; direction = 'addition'; amount = i.value; break;
            case 'allowance_amount':
              inputKind = 'allowance_extra'; direction = 'addition'; amount = i.value; break;
            case 'absence_days':
              inputKind = 'absence_deduction'; direction = 'deduction';
              amount = Math.round(i.value * (baseSalary / 30) * 100) / 100; break;
            case 'late_minutes':
              inputKind = 'lateness_deduction'; direction = 'deduction'; amount = i.value; break;
            case 'deduction_amount':
              inputKind = 'other_deduction'; direction = 'deduction'; amount = i.value; break;
            case 'advance_recovery':
              inputKind = 'advance_installment'; direction = 'deduction'; amount = i.value; break;
            case 'other':
            default:
              if (i.value > 0) {
                inputKind = 'other_addition'; direction = 'addition'; amount = i.value;
              } else {
                inputKind = 'other_deduction'; direction = 'deduction'; amount = Math.abs(i.value);
              }
              break;
          }

          return monthlyInputsApi.create({
            companyId,
            payrollPeriodId: periodId,
            employeeId,
            inputKind,
            direction,
            amount,
            note: i.note || undefined,
            sourceKind: 'manual',
            sourceTable: 'frontend_compensation_panel',
            sourceId: employeeId,
          });
        });

      await Promise.all(creates);
    } catch {
      // Keep optimistic state on error; user sees data but it didn't persist
    }
  },

  refreshMonthlyInputsForPeriod: async (periodId) => {
    const companyId = getDefaultCompanyId();
    if (!companyId) return;

    try {
      const inputsResult = await monthlyInputsApi.list({
        companyId,
        payrollPeriodId: periodId,
        limit: 2000,
      });

      const byEmployee: Record<string, MonthlyInputResponseDto[]> = {};
      for (const dto of inputsResult.items) {
        if (!byEmployee[dto.employeeId]) byEmployee[dto.employeeId] = [];
        byEmployee[dto.employeeId].push(dto);
      }

      set((s) => {
        const period = s.periods.find((p) => p.id === periodId);
        if (!period) return s;

        const employmentLineMonthlyInputs: Record<string, HRPayrollMonthlyInput[]> = {
          ...period.employmentLineMonthlyInputs,
        };
        for (const line of period.employmentLines) {
          const dtos = byEmployee[line.employeeId] ?? [];
          employmentLineMonthlyInputs[line.id] = dtos.map((d) =>
            fromBackendInput(d, line.baseSalarySnapshot),
          );
        }

        return {
          _rawInputs: {
            ...s._rawInputs,
            [periodId]: byEmployee,
          },
          periods: s.periods.map((p) =>
            p.id === periodId ? { ...p, employmentLineMonthlyInputs } : p,
          ),
        };
      });
    } catch {
      // Caller handles user-facing errors
    }
  },
}));

export const PERIOD_STATUS_LABELS: Record<HRPayrollPeriodStatus, string> = {
  draft: AR_STATUS.draft,
  open: 'مفتوحة',
  locked: 'مقفلة',
  closed: 'مغلقة',
  cancelled: AR_STATUS.cancelled,
};

export const PERIOD_STATUS_COLORS: Record<HRPayrollPeriodStatus, string> = {
  draft: STATUS_PILL.muted,
  open: STATUS_PILL.approved,
  locked: STATUS_PILL.warning,
  closed: STATUS_PILL.muted,
  cancelled: STATUS_PILL.rejected,
};

/** Periods that allow editing metadata from the UI (matches backend rules). */
export function isPayrollPeriodEditable(status: HRPayrollPeriodStatus): boolean {
  return status === 'draft' || status === 'open';
}

export const REVIEW_STAGE_LABELS: Record<HRPayrollReviewStage, string> = {
  first_review: 'المراجعة الأولى',
  second_review: 'المراجعة الثانية',
  third_review: 'المراجعة الثالثة',
};

export const REVIEW_STAGE_BADGE: Record<HRPayrollReviewStage, string> = {
  first_review: 'bg-warning/10 text-warning border-warning/25',
  second_review: 'bg-gold/10 text-gold border-gold/25',
  third_review: 'bg-primary/10 text-primary border-primary/25',
};

export const REVIEW_COMPLETED_LABEL = 'مكتملة';

/** Periods that allow advancing/reverting the review workflow (matches backend). */
export function isPayrollPeriodReviewable(status: HRPayrollPeriodStatus): boolean {
  return status === 'draft' || status === 'open';
}

export const MONTHLY_INPUT_KIND_LABELS: Record<HRPayrollMonthlyInputKind, string> = {
  absence_days: 'أيام غياب',
  late_minutes: 'دقائق تأخير',
  overtime_hours: 'ساعات عمل إضافي',
  deduction_amount: 'خصم إضافي',
  allowance_amount: 'بدل إضافي',
  advance_recovery: 'استرداد سلفة',
  other: 'أخرى',
};
