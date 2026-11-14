'use client';

import type { ColumnDef } from '@/components/ui/data-table';
import { ListToolsTable, useListTools } from '@/components/ui/list-tools';
import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, FileText, User, CalendarRange, Coins, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { ListFilterBar, type ListFilterInlineSelect } from '@/components/ui/list-filter-bar';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { usePageFilters } from '@/components/layouts/filter-panel-context';
import { EmptyState } from '@/components/ui/shared-dialogs';
import { DirectoryPagedViews, useServerDirectoryPagination } from '@/components/ui/paged-list';
import { employeeContractsApi } from '@/features/hr/contracts/lib/contracts-api';
import { useHRContractsStore, mapEmployeeContractFromApi, CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS, contractNatureLabel, workArrangementLabel, type HRContractLifecycleStatus, type HRContractNature, type HRContractRecord, type HRWorkArrangement } from '@/features/hr/contracts/lib/contracts-store';
import { useHRContractTemplatesStore } from '@/features/hr/contracts/lib/contract-templates-store';
import { contractTemplatesApi } from '@/features/hr/contracts/contract-templates/lib/api/contract-templates';
import { applyContractTemplateToForm, computeTemplateEndDate } from '@/features/hr/contracts/employment/utils/apply-contract-template';
import { useAllowanceTypes } from '@/features/hr/contracts/lib/hooks/use-allowance-types';
import { useContractArticles } from '@/features/hr/contracts/lib/hooks/use-contract-articles';
import type { HRContractArticle } from '@/features/hr/contracts/lib/contract-articles-store';
import type { HRAllowanceTypeRecord } from '@/features/hr/contracts/lib/allowance-types-store';
import { useEmployees } from '@/features/hr/organization/employees/hooks/useEmployees';
import { MoneyAmount } from '@/components/ui/sar-amount';
import { cn, formatMoneyDigits, formatNumber } from '@/shared/utils';
import { hrContractsRoutes } from '@/features/hr/contracts/constants/routes';
import { HR_CONTRACTS_MODE_PARAM, type AllowanceLine, type EmploymentContractFormValues, emptyEmploymentContractForm, recordToEmploymentForm, cloneEmploymentFormFromContract, employmentFormToDraft, mergeEssentialArticleIds, EMPLOYMENT_STATUS_FILTER_OPTIONS, EMPLOYMENT_KIND_FILTER_OPTIONS, EMPLOYMENT_WORK_ARRANGEMENT_FILTER_OPTIONS } from '@/features/hr/contracts/employment/utils/employment-contract-form';
import { buildEmployeeContractsListQuery } from '@/features/hr/contracts/lib/employee-contracts-list-query';
import { EmploymentContractTerminateModal as TerminateModal } from '@/features/hr/contracts/employment/components/employment-contract-terminate-modal';
import { EmploymentContractDetailDialog } from '@/features/hr/contracts/employment/components/employment-contract-detail-dialog';
import { EmploymentContractFormDialog } from '@/features/hr/contracts/employment/components/employment-contract-form-dialog';
import { ContractLeaveTypePickerDialog } from '@/features/hr/contracts/employment/components/contract-leave-type-picker-dialog';
import { contractCreditsLeaveDays, resolveContractActions } from '@/features/hr/contracts/employment/utils/contract-leave-credit';
import { PdfPreviewExportDialog } from '@/components/pdf/pdf-preview-export-dialog';
import { hrFiltersKey } from '@/features/hr/lib/use-persisted-filter-state';
import { CREATE_PICKER_ACTIVE_OR_SUSPENDED, employeeMatchesStatus, employeeStatusFilterLabelAr, isEmployeeStatusFilterActive, useEmployeeStatusFilter } from '@/features/hr/lib/employee-status-filter';
import { EmploymentContractPrintHtml } from '@/components/pdf/print/employment-contract-print-html';
import { companyCurrencyCode } from '@/features/auth/lib/company-currency';
import { useDefaultCompanyId } from '@/features/hr/organization/lib/default-company-id';
import { getSessionCompanyDisplay } from '@/features/hr/organization/lib/session-company-display';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';

type FormValues = EmploymentContractFormValues;
const recordToForm = recordToEmploymentForm;
const cloneFormFromContract = cloneEmploymentFormFromContract;
const formToDraft = employmentFormToDraft;

type PanelMode = 'create' | 'edit';
type StatusFilter = 'all' | HRContractLifecycleStatus;
type KindFilter = 'all' | HRContractNature;
type WorkFilter = 'all' | HRWorkArrangement;
type DraftFilter = 'all' | 'draft' | 'undraft';

const DRAFT_FILTER_OPTIONS: { value: DraftFilter; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'draft', label: 'مسودة' },
  { value: 'undraft', label: 'غير مسودة' },
];

/** Stable fallbacks — inline `= []` / `?? []` create a new array every render and can loop effects. */
const EMPTY_ALLOWANCE_TYPES: HRAllowanceTypeRecord[] = [];
const EMPTY_ARTICLES: HRContractArticle[] = [];
const EMPTY_EMPLOYEES: NonNullable<ReturnType<typeof useEmployees>['data']>['items'] = [];


export function EmploymentContractsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get(HR_CONTRACTS_MODE_PARAM);

  const companyId = useDefaultCompanyId();
  const { add, update, send, activate, terminate } = useHRContractsStore();
  const { templates, fetch: fetchTemplates } = useHRContractTemplatesStore();
  const { data: allowanceTypesData } = useAllowanceTypes();
  const allowanceTypes = allowanceTypesData ?? EMPTY_ALLOWANCE_TYPES;
  const { data: articlesData } = useContractArticles();
  const articles = articlesData ?? EMPTY_ARTICLES;
  /** قائمة الموظفين من GET /hr/employees (employeesApi.getAll). */
  const { data: employeesPage, refetch: refetchEmployees } = useEmployees();
  const employees = employeesPage?.items ?? EMPTY_EMPLOYEES;

  const ensureFormEmployeesLoaded = React.useCallback(() => {
    if (!companyId) return;
    if (employees.length > 0) return;
    void refetchEmployees();
  }, [companyId, employees.length, refetchEmployees]);

  const ensureFormCatalogLoaded = React.useCallback(async () => {
    if (!companyId) return;
    const tpl = useHRContractTemplatesStore.getState();
    if (tpl.templates.length === 0 && !tpl.isLoading) await fetchTemplates();
  }, [companyId, fetchTemplates]);

  const essentialArticleIds = React.useMemo(
    () => articles.filter(a => a.isActive && a.isBasic).map(a => a.id),
    [articles],
  );

  const activeArticles = React.useMemo(
    () => [...articles].filter(a => a.isActive).sort((a, b) => {
      if (a.isBasic !== b.isBasic) return a.isBasic ? -1 : 1;
      return a.code.localeCompare(b.code);
    }),
    [articles],
  );

  const empLabel = (e: { nameAr: string; position?: string | null; employeeCode?: string }) =>
    `${e.nameAr}${e.position ? ` — ${e.position}` : e.employeeCode ? ` — ${e.employeeCode}` : ''}`;


  const templateOptions = React.useMemo(
    () => [
      { value: '', label: 'بدون قالب' },
      ...[...templates]
        .filter((t) => t.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.nameAr.localeCompare(b.nameAr, 'ar'))
        .map((t) => ({ value: t.id, label: t.nameAr })),
    ],
    [templates],
  );
  const [applyingTemplate, setApplyingTemplate] = React.useState(false);
  const allowanceOptions = React.useMemo(() =>
    allowanceTypes.filter(a => a.isActive).map(a => ({ value: a.id, label: a.nameAr })),
    [allowanceTypes],
  );

  const { values, setValue } = usePageFilters([
    {
      key: 'status', label: 'الحالة', type: 'select',
      options: EMPLOYMENT_STATUS_FILTER_OPTIONS.map(({ value, label }) => ({ value, label })),
    },
    {
      key: 'kind', label: 'نوع العقد', type: 'select',
      options: EMPLOYMENT_KIND_FILTER_OPTIONS.map(({ value, label }) => ({ value, label })),
    },
    {
      key: 'work', label: 'نظام العمل', type: 'select',
      options: EMPLOYMENT_WORK_ARRANGEMENT_FILTER_OPTIONS.map(({ value, label }) => ({ value, label })),
    },
    {
      key: 'draft', label: 'المسودات', type: 'select',
      options: DRAFT_FILTER_OPTIONS,
    },
    {
      key: 'contractNumber',
      label: 'رقم العقد',
      type: 'text',
      placeholder: 'بحث جزئي برقم العقد…',
    },
  ]);

  const statusFilter = (values.status as StatusFilter) || 'all';
  const kindFilter = (values.kind as KindFilter) || 'all';
  const workFilter = (values.work as WorkFilter) || 'all';
  const draftFilter = (values.draft as DraftFilter) || 'all';
  const contractNumberFilter = typeof values.contractNumber === 'string' ? values.contractNumber : '';

  const [selectedEmpIds, setSelectedEmpIds] = React.useState<Set<string>>(new Set());
  const [employeeStatus, setEmployeeStatus] = useEmployeeStatusFilter(
    hrFiltersKey('contracts', 'employment', companyId, 'employeeStatus'),
  );

  const selectedEmpKey = React.useMemo(() => [...selectedEmpIds].sort().join(','), [selectedEmpIds]);

  const buildListQuery = React.useCallback((page: number, pageSize: number) => (
    buildEmployeeContractsListQuery({
      companyId: companyId!,
      page,
      limit: pageSize,
      status: statusFilter,
      draftMode: draftFilter,
      contractNature: kindFilter,
      workArrangement: workFilter,
      contractNumber: contractNumberFilter,
      employeeIds: selectedEmpIds,
      employeeStatus,
    })
  ), [companyId, statusFilter, kindFilter, workFilter, draftFilter, contractNumberFilter, selectedEmpIds, employeeStatus]);

  const loadPage = React.useCallback(async (page: number, pageSize: number) => {
    if (!companyId) return { items: [] as HRContractRecord[], total: 0 };
    try {
      const res = await employeeContractsApi.list(buildListQuery(page, pageSize));
      return { items: res.items.map(mapEmployeeContractFromApi), total: res.pagination.total };
    } catch (err) {
      handleApiError(err, 'contracts.list');
      return { items: [], total: 0 };
    }
  }, [buildListQuery, companyId]);

  const {
    items: filtered,
    loading: listLoading,
    pagination,
    reload: reloadList,
  } = useServerDirectoryPagination<HRContractRecord>(loadPage, {
    enabled: !!companyId,
    resetDeps: [
      companyId,
      statusFilter,
      kindFilter,
      workFilter,
      draftFilter,
      contractNumberFilter,
      selectedEmpKey,
      employeeStatus,
    ],
  });

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [panelMode, setPanelMode] = React.useState<PanelMode>('create');
  const [detailContractId, setDetailContractId] = React.useState<string | null>(null);
  const [detailRefreshKey, setDetailRefreshKey] = React.useState(0);
  const [selected, setSelected] = React.useState<HRContractRecord | null>(null);
  const [form, setForm] = React.useState<FormValues>(() => emptyEmploymentContractForm());
  const [error, setError] = React.useState<string | null>(null);
  const [terminateId, setTerminateId] = React.useState<string | null>(null);
  const [terminateReason, setTerminateReason] = React.useState('');
  const [leavePicker, setLeavePicker] = React.useState<{
    contractId: string;
    annualLeaveDays: number;
  } | null>(null);
  const [copyFromEmployeeId, setCopyFromEmployeeId] = React.useState('');
  const [copyFromContractId, setCopyFromContractId] = React.useState('');
  const [copySourceContracts, setCopySourceContracts] = React.useState<HRContractRecord[]>([]);

  React.useEffect(() => {
    if (drawerOpen) {
      void ensureFormCatalogLoaded();
      ensureFormEmployeesLoaded();
    }
  }, [drawerOpen, ensureFormCatalogLoaded, ensureFormEmployeesLoaded]);

  React.useEffect(() => {
    if (!copyFromEmployeeId || !companyId) {
      setCopySourceContracts([]);
      return;
    }
    void employeeContractsApi
      .list({ companyId, employeeId: copyFromEmployeeId, limit: 200 })
      .then((res) => setCopySourceContracts(res.items.map(mapEmployeeContractFromApi)))
      .catch(() => setCopySourceContracts([]));
  }, [copyFromEmployeeId, companyId]);

  const [contractPdfOpen, setContractPdfOpen] = React.useState(false);
  const [contractPrintable, setContractPrintable] = React.useState<React.ReactElement | null>(null);

  const getEmpName = (id: string, fallback?: string) =>
    fallback?.trim()
    || employees.find(e => e.id === id)?.nameAr
    || id;

  React.useEffect(() => {
    if (!contractPdfOpen) setContractPrintable(null);
  }, [contractPdfOpen]);

  const openEmploymentContractPdf = React.useCallback(async (
    source?: FormValues,
    employeeOverride?: {
      nameAr?: string;
      nationalId?: string | null;
      nationality?: string | null;
      phone?: string | null;
      email?: string | null;
      gender?: string | null;
      position?: string | null;
      branchNameAr?: string | null;
      city?: string | null;
    },
  ) => {
    await ensureFormCatalogLoaded();
    ensureFormEmployeesLoaded();
    const latestArticles = articles;
    const latestAllowanceTypes = allowanceTypes;
    const values = source ?? form;
    if (!values.employeeId.trim()) {
      toast.error('اختر الموظف أولاً');
      return;
    }
    if (!values.startDate.trim()) {
      toast.error('حدّد تاريخ البداية لاستكمال نص العرض');
      return;
    }

    const empFromList = employees.find((e) => e.id === values.employeeId);
    const empAr =
      employeeOverride?.nameAr?.trim()
      || empFromList?.nameAr
      || getEmpName(values.employeeId);
    const genderRaw = employeeOverride?.gender ?? empFromList?.gender ?? null;
    const employeeGender =
      genderRaw === 'female' || genderRaw === 'male' ? genderRaw : null;

    const allowanceRows = values.allowanceLines
      .filter((l) => l.allowanceTypeId.trim())
      .map((l) => ({
        labelAr: latestAllowanceTypes.find((a) => a.id === l.allowanceTypeId)?.nameAr ?? l.allowanceTypeId,
        amount: String(l.amount || '0'),
      }));
    const selectedArticles = values.articleIds
      .map((id) => latestArticles.find((a) => a.id === id))
      .filter(Boolean) as typeof latestArticles;

    selectedArticles.sort((a, b) => {
      if (a!.isBasic !== b!.isBasic) return a!.isBasic ? -1 : 1;
      return a!.code.localeCompare(b!.code);
    });

    const artLines = selectedArticles.map((a) => ({
      code: a.code,
      titleAr: a.title,
      bodyAr: (a.body || '').trim(),
      includesCompensation: a.includesCompensation,
    }));

    const company = getSessionCompanyDisplay(companyId);
    const branchNameAr =
      employeeOverride?.branchNameAr?.trim()
      || empFromList?.branchNameAr
      || null;
    const workCityAr =
      employeeOverride?.city?.trim()
      || (empFromList as { city?: string | null } | undefined)?.city
      || branchNameAr;

    const printable = (
      <EmploymentContractPrintHtml
        company={company}
        employeeNameAr={empAr}
        employeeGender={employeeGender}
        nationalId={employeeOverride?.nationalId ?? empFromList?.nationalId ?? null}
        nationality={employeeOverride?.nationality ?? empFromList?.nationality ?? null}
        employeePhone={employeeOverride?.phone ?? empFromList?.phone ?? null}
        employeeEmail={employeeOverride?.email ?? empFromList?.email ?? null}
        jobTitleAr={employeeOverride?.position ?? empFromList?.position ?? null}
        workCityAr={workCityAr}
        branchNameAr={branchNameAr}
        contractNumber={values.contractNumber.trim() || '—'}
        natureLabelAr={contractNatureLabel(values.contractType)}
        arrangementLabelAr={workArrangementLabel(values.workArrangement)}
        agreementDate={values.startDate}
        startDate={values.startDate}
        endDate={values.endDate}
        probationDaysLabel={values.probationDays.trim() ? `${values.probationDays} يوم` : 'بدون'}
        annualLeaveDaysLabel={`${values.annualLeaveDays || '—'} يوم`}
        baseSalary={formatNumber(Number(values.baseSalary) || 0)}
        currency={values.currency}
        allowancesNote={values.allowancesNote}
        deductionsNote={values.deductionsNote}
        allowanceRows={allowanceRows}
        articles={artLines}
      />
    );
    setContractPrintable(printable);
    setContractPdfOpen(true);
  }, [
    form,
    articles,
    allowanceTypes,
    companyId,
    employees,
    ensureFormCatalogLoaded,
    ensureFormEmployeesLoaded,
    getEmpName,
  ]);

  const openContractPdfFromRecord = React.useCallback((record: HRContractRecord) => {
    const emp = employees.find((e) => e.id === record.employeeId);
    const formValues = recordToForm(record);
    void openEmploymentContractPdf(formValues, {
      nameAr: record.employeeNameAr || emp?.nameAr || getEmpName(record.employeeId, record.employeeNameAr),
      nationalId: emp?.nationalId,
      nationality: emp?.nationality,
      phone: emp?.phone,
      email: emp?.email,
      gender: emp?.gender,
      position: emp?.position,
      branchNameAr: record.branchNameAr || emp?.branchNameAr,
      city: (emp as { city?: string | null } | undefined)?.city,
    });
  }, [openEmploymentContractPdf, getEmpName, employees]);

  const syncContractInStore = React.useCallback((record: HRContractRecord) => {
    useHRContractsStore.setState((s) => ({
      contracts: s.contracts.some((c) => c.id === record.id)
        ? s.contracts.map((c) => (c.id === record.id ? record : c))
        : [record, ...s.contracts],
    }));
  }, []);

  // New contracts: active or suspended employees (not ended); the contract's
  // own employee stays selectable when editing.
  const formEmpOptions = React.useMemo(
    () => employees
      .filter((e) => e.id === form.employeeId || employeeMatchesStatus(e.contractStatus, CREATE_PICKER_ACTIVE_OR_SUSPENDED))
      .map((e) => ({ value: e.id, label: empLabel(e) })),
    [employees, form.employeeId],
  );

  const copySourceEmpOptions = React.useMemo(() => {
    const ids = new Set(filtered.map(c => c.employeeId));
    return employees.filter(e => ids.has(e.id)).map(e => ({ value: e.id, label: empLabel(e) }));
  }, [filtered, employees]);

  const copySourceContractOptions = React.useMemo(() => {
    if (!copyFromEmployeeId) return [];
    return [...copySourceContracts]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(c => ({
        value: c.id,
        label: `${c.contractNumber} · ${contractNatureLabel(c.contractType)} · ${CONTRACT_STATUS_LABELS[c.status]} · ${c.startDate}`,
      }));
  }, [copySourceContracts, copyFromEmployeeId]);

  /* ── URL mode sync ── */
  React.useEffect(() => {
    if (modeParam !== 'createContract') return;
    // Essentials are merged by the effect below once articles load — do not
    // depend on essentialArticleIds here or unstable refs re-open/reset forever.
    setSelected(null);
    setForm(emptyEmploymentContractForm());
    setPanelMode('create');
    setError(null);
    setCopyFromEmployeeId('');
    setCopyFromContractId('');
    setDrawerOpen(true);
  }, [modeParam]);

  const essentialArticleIdsKey = essentialArticleIds.join(',');
  React.useEffect(() => {
    if (!drawerOpen || essentialArticleIds.length === 0) return;
    setForm((f) => {
      const merged = mergeEssentialArticleIds(f.articleIds, essentialArticleIds);
      if (merged.length === f.articleIds.length && essentialArticleIds.every((id) => f.articleIds.includes(id))) {
        return f;
      }
      return { ...f, articleIds: merged };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- compare by value, not array identity
  }, [essentialArticleIdsKey, drawerOpen]);

  const closeDrawer = () => {
    setDrawerOpen(false);
    setCopyFromEmployeeId('');
    setCopyFromContractId('');
    if (modeParam) {
      router.replace(hrContractsRoutes.employment, { scroll: false });
    }
  };

  const handleApplyCopyFromContract = () => {
    const src = copySourceContracts.find(c => c.id === copyFromContractId);
    if (!src) {
      toast.error('اختر عقد المصدر أولاً');
      return;
    }
    setForm(f => {
      const cloned = cloneFormFromContract(f.employeeId, src);
      return {
        ...cloned,
        articleIds: mergeEssentialArticleIds(cloned.articleIds, essentialArticleIds),
      };
    });
    toast.success('تم نسخ بيانات العقد. راجع الموظف المستهدف والتواريخ ثم احفظ.');
  };

  const openCreate = React.useCallback(() => {
    router.push(`${hrContractsRoutes.employment}?${HR_CONTRACTS_MODE_PARAM}=createContract`);
  }, [router]);

  const activeFilterCount = (kindFilter !== 'all' ? 1 : 0)
    + (workFilter !== 'all' ? 1 : 0)
    + (statusFilter !== 'all' ? 1 : 0)
    + (draftFilter !== 'all' ? 1 : 0)
    + (contractNumberFilter.trim() ? 1 : 0)
    + (selectedEmpIds.size > 0 ? 1 : 0)
    + (isEmployeeStatusFilterActive(employeeStatus) ? 1 : 0);

  const salaryText = (c: HRContractRecord) =>
    `${formatMoneyDigits(c.baseSalary, 0)} ${c.currency || companyCurrencyCode()}`;
  const salaryOf = (c: HRContractRecord) => Number(c.baseSalary) || 0;
  const columns: ColumnDef<HRContractRecord>[] = [
    { key: 'employee', title: 'الموظف', render: (c) => c.employeeNameAr || getEmpName(c.employeeId, c.employeeNameAr) },
    { key: 'contractNumber', title: 'رقم العقد', render: (c) => <span className="font-mono text-xs" dir="ltr">{c.contractNumber || '—'}</span> },
    {
      key: 'status',
      title: 'الحالة',
      render: (c) => (
        <Badge variant="outline" className={cn('text-[10px]', CONTRACT_STATUS_COLORS[c.status])}>
          {CONTRACT_STATUS_LABELS[c.status]}
        </Badge>
      ),
    },
    { key: 'kind', title: 'نوع العقد', render: (c) => contractNatureLabel(c.contractType) },
    { key: 'work', title: 'نظام العمل', render: (c) => workArrangementLabel(c.workArrangement) },
    { key: 'start', title: 'البداية', render: (c) => <span className="font-mono text-xs">{c.startDate || '—'}</span> },
    { key: 'end', title: 'النهاية', render: (c) => <span className="font-mono text-xs">{c.endDate || '—'}</span> },
    {
      key: 'salary',
      title: 'الراتب الأساسي',
      render: (c) => <MoneyAmount value={c.baseSalary} currency={c.currency} fractionDigits={0} className="text-sm font-bold" />,
    },
    { key: 'actions', title: '', isActions: true, render: (c) => <ContractActions c={c} /> },
  ];
  const tools = useListTools<HRContractRecord>({
    section: 'hr',
    page: 'employment-contracts',
    columns,
    rows: filtered,
    fetchAll: pagination.loadAll,
    resetKey: pagination.resetKey,
    fields: {
      employee: { kind: 'name', text: (c) => c.employeeNameAr || c.employeeId, group: (c) => c.employeeNameAr || null },
      contractNumber: { kind: 'code', text: (c) => c.contractNumber || '—' },
      status: { kind: 'status', text: (c) => CONTRACT_STATUS_LABELS[c.status] ?? c.status, group: (c) => CONTRACT_STATUS_LABELS[c.status] ?? c.status },
      kind: { kind: 'status', text: (c) => contractNatureLabel(c.contractType), group: (c) => contractNatureLabel(c.contractType) },
      work: { kind: 'status', text: (c) => workArrangementLabel(c.workArrangement), group: (c) => workArrangementLabel(c.workArrangement) },
      start: { kind: 'date', text: (c) => c.startDate || '—', group: (c) => (c.startDate ? c.startDate.slice(0, 7) : null) },
      end: { kind: 'date', text: (c) => c.endDate || '—', group: (c) => (c.endDate ? c.endDate.slice(0, 7) : null) },
      salary: { text: salaryText, sort: salaryOf, sum: salaryOf, formatSum: (n) => formatMoneyDigits(n, 0) },
    },
  });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        {tools.buttons}
        {tools.exportMenu('سجل عقود العمل', 'employment-contracts', [`حالة الموظفين: ${employeeStatusFilterLabelAr(employeeStatus)}`])}
        <Button variant="luxe" size="sm" className="h-8 gap-1.5 px-3 text-xs shadow-sm shrink-0" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          عقد جديد
        </Button>
      </div>
    ),
    [activeFilterCount, employeeStatus, openCreate, tools.depsKey],
  );

  const openView = (c: HRContractRecord) => {
    if (modeParam) router.replace(hrContractsRoutes.employment, { scroll: false });
    setDetailContractId(c.id);
  };

  const openEditFromDetail = (c: HRContractRecord) => {
    if (!resolveContractActions(c).canEditTerms) {
      toast.error('تعديل البنود غير متاح في هذه المرحلة (بعد موافقة الموظف أو بعد التفعيل).');
      return;
    }
    setDetailContractId(null);
    setSelected(c);
    setForm({
      ...recordToForm(c),
      articleIds: mergeEssentialArticleIds(c.articleIds, essentialArticleIds),
    });
    setPanelMode('edit');
    setError(null);
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!form.employeeId) { setError('اختر الموظف'); return; }
    if (!form.startDate) { setError('تاريخ البداية مطلوب'); return; }
    if (form.contractType === 'fixed_term' && !form.endDate) { setError('تاريخ الانتهاء مطلوب للعقود محددة المدة'); return; }
    const alRaw = form.annualLeaveDays.trim();
    const alNum = parseInt(alRaw, 10);
    if (alRaw === '' || !Number.isFinite(alNum) || alNum < 0 || alNum > 366) {
      setError('أدخل عدداً صحيحاً للإجازات السنوية (0–366 يوماً).');
      return;
    }
    try {
      const payload = {
        ...form,
        articleIds: mergeEssentialArticleIds(form.articleIds, essentialArticleIds),
      };
      if (panelMode === 'create') {
        await add(formToDraft(payload, 'draft'));
        toast.success(
          'تم إنشاء العقد كمسودة. أرسله للموظف عبر زر «إرسال» عند الجاهزية للتوقيع.',
        );
      } else if (panelMode === 'edit' && selected) {
        if (!resolveContractActions(selected).canEditTerms) {
          setError('تعديل البنود غير متاح في هذه المرحلة.');
          return;
        }
        const res = await update(selected.id, formToDraft(payload, selected.status));
        if (!res.ok) { setError(res.message); return; }
      }
      closeDrawer();
      await reloadList();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const runActivate = async (id: string, leaveTypeId?: string) => {
    const res = await activate(id, leaveTypeId);
    if (!res.ok) throw new Error(res.message);
    toast.success('تم تفعيل العقد.');
    setDetailRefreshKey((k) => k + 1);
    await reloadList();
  };

  const handleActivate = (contract: HRContractRecord) => {
    if (!resolveContractActions(contract).canActivate) {
      toast.error('التفعيل متاح فقط بعد موافقة الموظف (بانتظار التوقيع + موافقة).');
      return;
    }
    if (contractCreditsLeaveDays(contract)) {
      setLeavePicker({
        contractId: contract.id,
        annualLeaveDays: contract.annualLeaveDays ?? 0,
      });
      return;
    }
    void runActivate(contract.id);
  };

  const handleLeavePickerConfirm = async (leaveTypeId: string) => {
    if (!leavePicker) return;
    await runActivate(leavePicker.contractId, leaveTypeId);
  };

  const handleSend = async (c: HRContractRecord) => {
    if (!resolveContractActions(c).canSendToEmployee) {
      toast.error('إرسال العقد للموظف غير متاح حالياً.');
      return;
    }
    const res = await send(c.id);
    if (!res.ok) toast.error(res.message);
    else {
      toast.success('تم إرسال العقد للموظف بانتظار الموافقة.');
      setDetailRefreshKey((k) => k + 1);
      await reloadList();
    }
  };

  const handleTerminate = async () => {
    if (!terminateId) return;
    const target = filtered.find((c) => c.id === terminateId)
      ?? useHRContractsStore.getState().contracts.find((c) => c.id === terminateId);
    if (target && !resolveContractActions(target).canClose) {
      toast.error('إغلاق العقد متاح فقط للعقود النشطة.');
      setTerminateId(null);
      setTerminateReason('');
      return;
    }
    const res = await terminate(terminateId, terminateReason);
    if (!res.ok) toast.error(res.message); else {
      toast.success('تم إنهاء العقد.');
      await reloadList();
    }
    setTerminateId(null); setTerminateReason('');
  };

  const patch = (p: Partial<FormValues>) => setForm(f => ({ ...f, ...p }));

  const applyTemplate = async (tplId: string) => {
    if (!tplId) {
      patch({ templateId: '' });
      return;
    }
    setApplyingTemplate(true);
    try {
      const template = await contractTemplatesApi.get(tplId);
      patch(
        applyContractTemplateToForm(template, {
          essentialArticleIds,
          startDate: form.startDate,
        }),
      );
      toast.success(`تم تطبيق قالب «${template.nameAr}» على النموذج`);
    } catch (e) {
      toast.error((e as Error).message || 'تعذّر تحميل القالب');
      patch({ templateId: '' });
    } finally {
      setApplyingTemplate(false);
    }
  };

  React.useEffect(() => {
    if (!form.templateId || !form.startDate || !drawerOpen) return;
    const cached = templates.find((t) => t.id === form.templateId);
    if (!cached?.durationMonths) return;
    const end = computeTemplateEndDate(
      form.contractType,
      cached.durationMonths,
      form.startDate,
    );
    if (end && end !== form.endDate) {
      setForm((f) => ({ ...f, endDate: end }));
    }
  }, [form.startDate, form.templateId, form.contractType, form.endDate, templates, panelMode]);

  const updateAllowanceLine = (idx: number, p: Partial<AllowanceLine>) => {
    setForm(f => ({ ...f, allowanceLines: f.allowanceLines.map((l, i) => i === idx ? { ...l, ...p } : l) }));
  };
  const addAllowanceLine = () => setForm(f => ({ ...f, allowanceLines: [...f.allowanceLines, { allowanceTypeId: '', amount: '' }] }));
  const removeAllowanceLine = (idx: number) => setForm(f => ({
    ...f,
    allowanceLines: f.allowanceLines.length <= 1 ? [{ allowanceTypeId: '', amount: '' }] : f.allowanceLines.filter((_, i) => i !== idx),
  }));

  const toggleArticle = (id: string) => {
    if (essentialArticleIds.includes(id)) return;
    setForm(f => ({
      ...f,
      articleIds: f.articleIds.includes(id)
        ? f.articleIds.filter(x => x !== id)
        : mergeEssentialArticleIds([...f.articleIds, id], essentialArticleIds),
    }));
  };

  const employmentStatusOrder = React.useMemo(
    () => EMPLOYMENT_STATUS_FILTER_OPTIONS.filter((o): o is { value: HRContractLifecycleStatus; label: string } => o.value !== 'all').map(o => o.value),
    [],
  );

  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: pagination.total };
    for (const s of employmentStatusOrder) {
      counts[s] = filtered.filter(c => c.status === s).length;
    }
    return counts;
  }, [filtered, pagination.total, employmentStatusOrder]);

  const employmentInlineSelects = React.useMemo((): ListFilterInlineSelect[] => [
    {
      id: 'contract-kind',
      value: kindFilter,
      onChange: (v) => setValue('kind', v),
      options: EMPLOYMENT_KIND_FILTER_OPTIONS.map(({ value, label }) => ({ value, label })),
      placeholder: 'نوع العقد',
    },
    {
      id: 'work-arrangement',
      value: workFilter,
      onChange: (v) => setValue('work', v),
      options: EMPLOYMENT_WORK_ARRANGEMENT_FILTER_OPTIONS.map(({ value, label }) => ({ value, label })),
      placeholder: 'نظام العمل',
    },
    {
      id: 'draft',
      value: draftFilter,
      onChange: (v) => setValue('draft', v),
      options: DRAFT_FILTER_OPTIONS,
      placeholder: 'المسودات',
    },
  ], [kindFilter, workFilter, draftFilter, setValue]);

  const handleStatusFilterChange = React.useCallback(
    (v: string) => setValue('status', v),
    [setValue],
  );

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showDateSection={false}
        companyId={companyId}
        selectedEmpIds={selectedEmpIds}
        onSelectedEmpIdsChange={setSelectedEmpIds}
        employeeStatus={employeeStatus}
        onEmployeeStatusChange={setEmployeeStatus}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        statusOrder={employmentStatusOrder}
        statusLabels={CONTRACT_STATUS_LABELS as unknown as Record<string, string>}
        statusCounts={statusCounts}
        onDateBoundsChange={() => {}}
        inlineSelects={employmentInlineSelects}
      />
    ),
    [
      statusFilter,
      employeeStatus,
      kindFilter,
      workFilter,
      draftFilter,
      contractNumberFilter,
      selectedEmpKey,
      statusCounts,
      companyId,
      employmentStatusOrder,
      employmentInlineSelects,
      handleStatusFilterChange,
    ],
  );

  const ContractActions = ({ c }: { c: HRContractRecord }) => {
    const actions = resolveContractActions(c);

    return (
      <div className="flex items-center gap-1 flex-wrap" onClick={e => e.stopPropagation()}>
        {actions.canEditTerms ? (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEditFromDetail(c)}>تعديل</Button>
        ) : null}
        {actions.canSendToEmployee ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-primary hover:text-primary"
            onClick={() => { void handleSend(c); }}
          >
            إرسال
          </Button>
        ) : null}
        {actions.canActivate ? (
          <Button size="sm" variant="ghost" className="h-7 text-xs text-success hover:text-success" onClick={() => handleActivate(c)}>تفعيل</Button>
        ) : null}
        {actions.canClose ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-destructive hover:text-destructive"
            onClick={() => { setTerminateId(c.id); setTerminateReason(''); }}
          >
            إنهاء
          </Button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <SetPageTitle titleAr="عقود العمل" descriptionAr="إدارة دورة حياة عقود العمل الوظيفية." iconName="FileText" />

      {filtered.length === 0 && !listLoading ? (
        <EmptyState icon={FileText} title="لا توجد عقود" description="أنشئ عقد عمل جديداً للبدء." />
      ) : (
        <ListToolsTable tools={tools} keyExtractor={(c) => c.id} onRowClick={openView}>
        <DirectoryPagedViews
          items={tools.rows}
          serverPagination={tools.pagination(pagination)}
          loading={listLoading || tools.loading}
        >
          {(pageItems) => (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pageItems.map(c => (
            <div
              key={c.id}
              className="rounded-xl border border-border bg-card p-5 shadow-soft space-y-3 flex flex-col cursor-pointer"
              onClick={() => openView(c)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{c.employeeNameAr || getEmpName(c.employeeId, c.employeeNameAr)}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{c.contractNumber}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant="outline" className={cn('text-[10px]', CONTRACT_STATUS_COLORS[c.status])}>
                    {CONTRACT_STATUS_LABELS[c.status]}
                  </Badge>
                  {c.employeeSigned ? (
                    <span className="text-[10px] font-medium text-success">وافق الموظف</span>
                  ) : c.rejectionReason ? (
                    <span className="text-[10px] font-medium text-destructive">رفض الموظف</span>
                  ) : c.status === 'pending_signature' ? (
                    <span className="text-[10px] text-muted-foreground">بانتظار الموظف</span>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  <FileText className="h-3 w-3 shrink-0" />
                  <span className="min-w-0 leading-tight">
                    {contractNatureLabel(c.contractType)}
                    <span className="text-muted-foreground"> · </span>
                    {workArrangementLabel(c.workArrangement)}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-mono text-muted-foreground">
                  <CalendarRange className="h-3 w-3" />{c.startDate}
                  <ChevronRight className="h-3 w-3 opacity-40" />
                  {c.endDate}
                </span>
              </div>
              <div className="flex items-center gap-1 text-sm font-bold tabular-nums text-foreground">
                <Coins className="h-3.5 w-3.5 text-gold" />
                <MoneyAmount value={c.baseSalary} currency={c.currency} fractionDigits={0} className="text-sm font-bold" />
              </div>
              <div className="mt-auto flex flex-wrap items-center justify-end gap-1 border-t border-border pt-3" onClick={e => e.stopPropagation()}>
                <ContractActions c={c} />
              </div>
            </div>
          ))}
          </div>
          )}
        </DirectoryPagedViews>
        </ListToolsTable>
      )}

      <EmploymentContractDetailDialog
        contractId={detailContractId}
        open={!!detailContractId}
        onOpenChange={(open) => { if (!open) setDetailContractId(null); }}
        refreshKey={detailRefreshKey}
        onLoaded={syncContractInStore}
        onEditDraft={openEditFromDetail}
        onDownloadPdf={openContractPdfFromRecord}
      />

      <EmploymentContractFormDialog
        open={drawerOpen}
        onOpenChange={(open) => { if (!open) closeDrawer(); }}
        mode={panelMode}
        form={form}
        error={error}
        applyingTemplate={applyingTemplate}
        templateOptions={templateOptions}
        empOptions={formEmpOptions}
        allowanceOptions={allowanceOptions}
        activeArticles={activeArticles}
        essentialArticleIds={essentialArticleIds}
        copyFromEmployeeId={copyFromEmployeeId}
        copyFromContractId={copyFromContractId}
        copySourceEmpOptions={copySourceEmpOptions}
        copySourceContractOptions={copySourceContractOptions}
        getEmpName={getEmpName}
        onSave={() => { void handleSave(); }}
        onPreviewPdf={() => { void openEmploymentContractPdf(); }}
        onPatch={patch}
        onApplyTemplate={(id) => { void applyTemplate(id); }}
        onCopyFromEmployeeChange={(id) => { setCopyFromEmployeeId(id); setCopyFromContractId(''); }}
        onCopyFromContractChange={setCopyFromContractId}
        onApplyCopyFromContract={handleApplyCopyFromContract}
        onToggleArticle={toggleArticle}
        onUpdateAllowanceLine={updateAllowanceLine}
        onAddAllowanceLine={addAllowanceLine}
        onRemoveAllowanceLine={removeAllowanceLine}
      />

      <PdfPreviewExportDialog
        open={contractPdfOpen}
        onOpenChange={setContractPdfOpen}
        title="معاينة — عقد العمل الحالي في النموذج"
        fileName={`employment-contract-${(form.contractNumber || 'draft').replace(/[^\w\-]+/g, '_')}.pdf`}
        printable={contractPrintable}
        pageBreaks="flow"
        emptyMessage="تعذر إعداد المعاينة — تحقق من بيانات النموذج."
      />

      {/* Terminate */}
      <TerminateModal
        open={!!terminateId} reason={terminateReason}
        onReasonChange={setTerminateReason}
        onConfirm={handleTerminate}
        onCancel={() => { setTerminateId(null); setTerminateReason(''); }}
      />

      <ContractLeaveTypePickerDialog
        open={leavePicker != null}
        onOpenChange={(open) => { if (!open) setLeavePicker(null); }}
        companyId={companyId}
        title="تفعيل العقد"
        description="اختر نوع الإجازة الذي ستُضاف إليه أيام العقد عند التفعيل."
        annualLeaveDays={leavePicker?.annualLeaveDays}
        confirmLabel="تفعيل العقد"
        onConfirm={handleLeavePickerConfirm}
      />
    </div>
  );
}
