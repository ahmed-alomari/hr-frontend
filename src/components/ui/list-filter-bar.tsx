'use client';

import * as React from 'react';
import {
  CalendarDays, LayoutGrid, List, X, SlidersHorizontal,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmployeePicker } from '@/components/ui/employee-picker';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MinimalDropdown } from '@/components/ui/shared-dialogs';
import { cn } from '@/shared/utils';
import {
  filterTabTriggerClass,
  STATUS_COUNT_BADGE,
  STATUS_FILTER_TAB_TONES,
} from '@/shared/status-pill-classes';
import type { DateFilterTab } from '@/features/hr/discipline/lib/discipline-date-filter';
import {
  effectiveDateRange,
  isPeriodFilterActive,
} from '@/features/hr/discipline/lib/discipline-date-filter';
import { DateRangeFilterTrigger } from '@/components/ui/date-range-filter-trigger';
import { SelectItem } from '@/components/ui/select';
import { SelectWithClear } from '@/components/ui/select-with-clear';
import { useEmployeeFilterPicker } from '@/features/hr/lib/use-employee-filter-picker';
import { FILTER_PERMISSIONS } from '@/features/auth/permissions/filter-permissions';
import type { EmployeePickerOption } from '@/components/ui/employee-picker';
import {
  EMPLOYEE_STATUS_FILTER_DEFAULT,
  EMPLOYEE_STATUS_FILTER_OPTIONS,
  employeeMatchesStatus,
  normalizeEmployeeStatusFilter,
} from '@/features/hr/lib/employee-status-filter';

export type PeriodRange = { from: string; to: string };

export const DATE_TAB_BASE =
  'discipline-tab-trigger shrink-0 gap-1 px-3 text-[11px] transition-all duration-150 border';

export const DATE_TAB_TRIGGER_CLASS: Record<DateFilterTab, string> = {
  all: filterTabTriggerClass('muted'),
  today: filterTabTriggerClass('primary'),
  week: filterTabTriggerClass('accent'),
  month: filterTabTriggerClass('success'),
  custom: filterTabTriggerClass('gold'),
};

export { STATUS_COUNT_BADGE };

export const STATUS_ALL_TRIGGER_CLASS = filterTabTriggerClass('muted');

export const STATUS_CYCLE_TRIGGER_CLASSES = STATUS_FILTER_TAB_TONES.map((tone) =>
  filterTabTriggerClass(tone),
);

export type ListFilterBarHandle = {
  resetDateFilter: () => void;
  resetStatusFilter: () => void;
};

export type ListDataViewIcon = 'list' | 'layout-grid' | 'calendar-days';

export type ListDataViewOption = {
  value: string;
  label: string;
  icon?: ListDataViewIcon;
};

export type ListDataViewConfig = {
  value: string;
  onChange: (value: string) => void;
  options: readonly ListDataViewOption[];
};

export type ListFilterInlineSelect = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  onOpen?: () => void;
};

const EMPTY_EMP_PICKER_LIST: EmployeePickerOption[] = [];
const EMPTY_SELECTED_EMP_IDS = new Set<string>();
const EMPTY_STATUS_ORDER_LIST: readonly string[] = [];
const EMPTY_STATUS_LABELS: Record<string, string> = {};
const DEFAULT_STATUS_COUNTS: Record<string, number> = { all: 0 };
const noopBounds = () => {};
const noopSetEmp = () => {};
const noopStatus = () => {};

const DATA_VIEW_TAB_CLASS =
  'entity-toolbar-view-tab flex h-8 w-8 shrink-0 items-center justify-center p-0 transition-all duration-150 data-[state=active]:!shadow-sm data-[state=active]:ring-2 data-[state=active]:ring-primary/40 data-[state=active]:ring-offset-2 data-[state=active]:ring-offset-background data-[state=active]:border data-[state=active]:border-primary/35';

function DataViewIcon({ name }: { name?: ListDataViewIcon }) {
  switch (name) {
    case 'layout-grid':
      return <LayoutGrid className="h-3.5 w-3.5 shrink-0" />;
    case 'calendar-days':
      return <CalendarDays className="h-3.5 w-3.5 shrink-0" />;
    case 'list':
    default:
      return <List className="h-3.5 w-3.5 shrink-0" />;
  }
}

export interface ListFilterBarProps {
  /** When set and `empPickerEmployees` is omitted, loads the company employee list (attendance daily UX). */
  companyId?: string | null;
  empPickerEmployees?: EmployeePickerOption[];
  selectedEmpIds?: Set<string>;
  onSelectedEmpIdsChange?: (s: Set<string>) => void;
  onEmployeePickerOpen?: () => void;
  employeePickerLoading?: boolean;
  /** Defaults to employee read; pass `null` when the picker is not the employee directory (e.g. audit actors). */
  employeePickerRequirePermission?: string | null;

  /**
   * Opt-in employee-status filter (نشط / موقوف / منتهي / كل الحالات), default
   * `active`. The employee picker then lists only employees of that status.
   */
  employeeStatus?: string;
  onEmployeeStatusChange?: (v: string) => void;

  statusFilter?: string;
  onStatusFilterChange?: (v: string) => void;
  statusOrder?: readonly string[];
  statusLabels?: Record<string, string>;
  statusCounts?: Record<string, number>;

  onDateBoundsChange?: (bounds: PeriodRange) => void;
  onDateFilterMetaChange?: (meta: { tab: DateFilterTab; hasRestriction: boolean }) => void;

  periodValue?: PeriodRange;
  onPeriodChange?: (range: PeriodRange) => void;
  defaultPeriod?: PeriodRange;

  showDateSection?: boolean;
  showStatusSection?: boolean;
  showEmployeePicker?: boolean;
  defaultDateFilterTab?: DateFilterTab;
  optionalDateRange?: boolean;

  trailingActions?: React.ReactNode;
  leadingFilters?: React.ReactNode;
  periodFilterActive?: boolean;
  onPeriodFilterClear?: () => void;
  /**
   * «مسح الكل» in one step. Pages that keep their filters in the URL must
   * pass it: clearing each filter by its own onChange replaces the URL once
   * per filter from the same old copy, so the last one undoes the others.
   */
  onClearAll?: () => void;
  beforeEmployeePicker?: React.ReactNode;

  inlineSelects?: readonly ListFilterInlineSelect[];
  moreFilters?: readonly ListFilterInlineSelect[];
  filterLayout?: 'tabs' | 'collapsible';
  dataView?: ListDataViewConfig;
}

export const ListFilterBar = React.forwardRef<ListFilterBarHandle, ListFilterBarProps>(
  function ListFilterBar(
    {
      companyId,
      empPickerEmployees,
      selectedEmpIds = EMPTY_SELECTED_EMP_IDS,
      onSelectedEmpIdsChange = noopSetEmp,
      onEmployeePickerOpen,
      employeePickerLoading = false,
      employeePickerRequirePermission,
      employeeStatus,
      onEmployeeStatusChange,
      statusFilter = 'all',
      onStatusFilterChange = noopStatus,
      statusOrder = EMPTY_STATUS_ORDER_LIST,
      statusLabels = EMPTY_STATUS_LABELS,
      statusCounts = DEFAULT_STATUS_COUNTS,
      onDateBoundsChange = noopBounds,
      onDateFilterMetaChange,
      periodValue,
      onPeriodChange,
      defaultPeriod,
      showDateSection = true,
      showStatusSection = true,
      showEmployeePicker = true,
      defaultDateFilterTab = 'all',
      trailingActions,
      leadingFilters,
      periodFilterActive = false,
      onPeriodFilterClear,
      onClearAll,
      beforeEmployeePicker,
      inlineSelects,
      moreFilters,
      filterLayout = 'tabs',
      dataView,
      optionalDateRange = false,
    },
    ref,
  ) {
    const skipAutoEmployeeLoad =
      empPickerEmployees !== undefined || onEmployeePickerOpen != null;
    const autoEmployeePicker = useEmployeeFilterPicker(
      skipAutoEmployeeLoad ? null : companyId,
    );
    const hasEmployeeStatusFilter = employeeStatus !== undefined && onEmployeeStatusChange != null;
    const employeeStatusValue = normalizeEmployeeStatusFilter(employeeStatus);
    const rawEmpPickerEmployees = empPickerEmployees ?? autoEmployeePicker.employees;
    // Options without a known status (`contractStatus` undefined) are kept.
    const resolvedEmpPickerEmployees = React.useMemo(
      () =>
        !hasEmployeeStatusFilter || employeeStatusValue === 'all'
          ? rawEmpPickerEmployees
          : rawEmpPickerEmployees.filter(
            (e) => e.contractStatus === undefined || employeeMatchesStatus(e.contractStatus, employeeStatusValue),
          ),
      [hasEmployeeStatusFilter, employeeStatusValue, rawEmpPickerEmployees],
    );
    const resolvedEmployeePickerLoading = employeePickerLoading || autoEmployeePicker.loading;

    const emptyPeriod = React.useMemo<PeriodRange>(() => ({ from: '', to: '' }), []);

    const resolvedDefaultPeriod = React.useMemo(
      () => (optionalDateRange ? emptyPeriod : (defaultPeriod ?? effectiveDateRange(defaultDateFilterTab, '', ''))),
      [optionalDateRange, emptyPeriod, defaultPeriod, defaultDateFilterTab],
    );

    const [internalPeriod, setInternalPeriod] = React.useState<PeriodRange>(resolvedDefaultPeriod);
    const isPeriodControlled = periodValue != null && onPeriodChange != null;
    const period = isPeriodControlled ? periodValue! : internalPeriod;

    React.useEffect(() => {
      if (!isPeriodControlled) {
        setInternalPeriod(resolvedDefaultPeriod);
      }
    }, [resolvedDefaultPeriod, isPeriodControlled]);

    const applyPeriod = React.useCallback((range: PeriodRange) => {
      if (isPeriodControlled) {
        onPeriodChange!(range);
      } else {
        setInternalPeriod(range);
      }
    }, [isPeriodControlled, onPeriodChange]);

    const onDateBoundsChangeRef = React.useRef(onDateBoundsChange);
    onDateBoundsChangeRef.current = onDateBoundsChange;
    const lastEmittedBoundsKeyRef = React.useRef<string | null>(null);
    React.useEffect(() => {
      if (!showDateSection) return;
      const key = `${period.from}\u0000${period.to}`;
      if (lastEmittedBoundsKeyRef.current === key) return;
      lastEmittedBoundsKeyRef.current = key;
      onDateBoundsChangeRef.current(period);
    }, [showDateSection, period.from, period.to]);

    const onDateFilterMetaChangeRef = React.useRef(onDateFilterMetaChange);
    onDateFilterMetaChangeRef.current = onDateFilterMetaChange;
    const lastEmittedMetaKeyRef = React.useRef<string | null>(null);
    React.useEffect(() => {
      if (!showDateSection) {
        const key = 'all|0';
        if (lastEmittedMetaKeyRef.current === key) return;
        lastEmittedMetaKeyRef.current = key;
        onDateFilterMetaChangeRef.current?.({ tab: 'all', hasRestriction: false });
        return;
      }
      const hasR = isPeriodFilterActive(period, resolvedDefaultPeriod);
      const key = `${hasR ? 'custom' : defaultDateFilterTab}|${hasR ? 1 : 0}`;
      if (lastEmittedMetaKeyRef.current === key) return;
      lastEmittedMetaKeyRef.current = key;
      onDateFilterMetaChangeRef.current?.({
        tab: hasR ? 'custom' : defaultDateFilterTab,
        hasRestriction: hasR,
      });
    }, [showDateSection, period, resolvedDefaultPeriod, defaultDateFilterTab]);

    const resetDateFilter = React.useCallback(() => {
      applyPeriod(resolvedDefaultPeriod);
    }, [applyPeriod, resolvedDefaultPeriod]);

    const resetStatusFilter = React.useCallback(() => {
      onStatusFilterChange('all');
    }, [onStatusFilterChange]);

    React.useImperativeHandle(ref, () => ({
      resetDateFilter,
      resetStatusFilter,
    }), [resetDateFilter, resetStatusFilter]);

    const internalPeriodActive = showDateSection && isPeriodFilterActive(period, resolvedDefaultPeriod);

    const statusSelectValue =
      statusFilter === 'all' || statusOrder.includes(statusFilter) ? statusFilter : 'all';

    const useFilterDropdowns = filterLayout === 'tabs' || filterLayout === 'collapsible';

    const statusFilterControl = useFilterDropdowns && showStatusSection && statusOrder.length > 0 ? (
      <MinimalDropdown
        value={statusSelectValue === 'all' ? '' : statusSelectValue}
        onChange={(v) => (v ? onStatusFilterChange(v) : resetStatusFilter())}
        allowClear
        placeholder="اختر الحالة"
        className="h-8 w-[9.25rem] min-w-[6.5rem] max-w-[9.25rem] text-xs max-sm:h-9"
        options={statusOrder.map((s) => ({ value: s, label: statusLabels[s] ?? s }))}
      />
    ) : null;

    const periodFilterControl = showDateSection ? (
      <DateRangeFilterTrigger
        value={period}
        onChange={applyPeriod}
        allowEmpty={optionalDateRange}
        triggerClassName="max-sm:h-9"
      />
    ) : null;

    const optionalDateActive = optionalDateRange && Boolean(period.from || period.to);

    const resetEmployeeStatus = React.useCallback(() => {
      onEmployeeStatusChange?.(EMPLOYEE_STATUS_FILTER_DEFAULT);
    }, [onEmployeeStatusChange]);

    const employeeStatusControl = hasEmployeeStatusFilter ? (
      <SelectWithClear
        value={employeeStatusValue === EMPLOYEE_STATUS_FILTER_DEFAULT ? '' : employeeStatusValue}
        onValueChange={(v) => onEmployeeStatusChange!(v || EMPLOYEE_STATUS_FILTER_DEFAULT)}
        onClear={resetEmployeeStatus}
        placeholder={EMPLOYEE_STATUS_FILTER_OPTIONS[0]!.label}
        className="w-[10.5rem] max-w-[10.5rem]"
      >
        {EMPLOYEE_STATUS_FILTER_OPTIONS.filter((o) => o.value !== EMPLOYEE_STATUS_FILTER_DEFAULT).map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectWithClear>
    ) : null;

    const hasSecondaryFilters =
      hasEmployeeStatusFilter || Boolean(inlineSelects?.length) || Boolean(beforeEmployeePicker) || showEmployeePicker;
    const hasDataView = Boolean(dataView && dataView.options.length >= 2);

    const pickerBlock = hasSecondaryFilters ? (
      <>
        {employeeStatusControl}
        {inlineSelects?.map((sel) => {
          const allowed = new Set(sel.options.map((o) => o.value));
          const coerced =
            allowed.has(sel.value)
              ? sel.value
              : (sel.options.find((o) => o.value === 'all')?.value ?? sel.options[0]?.value ?? '');
          if (!sel.options.length) return null;
          return (
            <MinimalDropdown
              key={sel.id}
              value={coerced === 'all' ? '' : coerced}
              onChange={(v) => sel.onChange(v || 'all')}
              allowClear
              placeholder={sel.placeholder ?? '—'}
              onOpenChange={(open) => {
                if (open) sel.onOpen?.();
              }}
              className={cn(
                'h-8 w-[9rem] min-w-[6.5rem] max-w-[9rem] text-xs max-sm:h-9 max-sm:w-[8.25rem] max-sm:max-w-[8.25rem]',
                sel.className,
              )}
              options={sel.options
                .filter((o) => o.value !== 'all' && o.value !== '')
                .map((o) => ({ value: o.value, label: o.label }))}
            />
          );
        })}
        {beforeEmployeePicker}
        {showEmployeePicker ? (
          <EmployeePicker
            employees={resolvedEmpPickerEmployees}
            selected={selectedEmpIds}
            onChange={onSelectedEmpIdsChange}
            loading={resolvedEmployeePickerLoading}
            onRequestLoad={onEmployeePickerOpen}
            requirePermission={
              employeePickerRequirePermission === null
                ? undefined
                : (employeePickerRequirePermission ?? FILTER_PERMISSIONS.employee)
            }
          />
        ) : null}
      </>
    ) : null;

    const [moreFiltersOpen, setMoreFiltersOpen] = React.useState(false);
    const activeMoreCount = React.useMemo(
      () => moreFilters?.filter((f) => f.value !== 'all' && f.value !== '').length ?? 0,
      [moreFilters],
    );

    const hasAnyActiveFilter = React.useMemo(() =>
      periodFilterActive ||
      optionalDateActive ||
      internalPeriodActive ||
      (showEmployeePicker && selectedEmpIds.size > 0) ||
      (hasEmployeeStatusFilter && employeeStatusValue !== EMPLOYEE_STATUS_FILTER_DEFAULT) ||
      (showStatusSection && statusFilter !== 'all') ||
      (inlineSelects?.some((s) => s.value !== 'all' && s.value !== '') ?? false) ||
      (moreFilters?.some((s) => s.value !== 'all' && s.value !== '') ?? false),
      [
        periodFilterActive,
        optionalDateActive,
        internalPeriodActive,
        showEmployeePicker,
        selectedEmpIds.size,
        hasEmployeeStatusFilter,
        employeeStatusValue,
        showStatusSection,
        statusFilter,
        inlineSelects,
        moreFilters,
      ],
    );

    const clearAllFilters = React.useCallback(() => {
      if (onClearAll) {
        resetDateFilter();
        resetStatusFilter();
        if (showEmployeePicker) onSelectedEmpIdsChange(new Set());
        onClearAll();
        return;
      }
      onPeriodFilterClear?.();
      resetDateFilter();
      resetStatusFilter();
      if (hasEmployeeStatusFilter) resetEmployeeStatus();
      if (showEmployeePicker) onSelectedEmpIdsChange(new Set());
      inlineSelects?.forEach((s) => s.onChange('all'));
      moreFilters?.forEach((s) => s.onChange('all'));
    }, [
      onClearAll,
      onPeriodFilterClear,
      resetDateFilter,
      resetStatusFilter,
      hasEmployeeStatusFilter,
      resetEmployeeStatus,
      showEmployeePicker,
      onSelectedEmpIdsChange,
      inlineSelects,
      moreFilters,
    ]);

    const moreFiltersPopover = moreFilters?.length ? (
      <Popover open={moreFiltersOpen} onOpenChange={setMoreFiltersOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              'relative h-8 gap-1.5 px-3 text-xs shrink-0 max-sm:h-9',
              activeMoreCount > 0 && 'border-primary/50 bg-primary/5 text-primary hover:bg-primary/10',
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            فلاتر
            {activeMoreCount > 0 && (
              <Badge
                variant="secondary"
                className="ms-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] text-primary-foreground"
              >
                {activeMoreCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={6} className="w-72 p-4" dir="rtl">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">فلاتر إضافية</p>
            {activeMoreCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => {
                  moreFilters.forEach((f) => {
                    const allOpt = f.options.find((o) => o.value === 'all');
                    if (allOpt) f.onChange('all');
                  });
                }}
              >
                <X className="h-3 w-3" />
                إعادة ضبط
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {moreFilters.map((sel) => {
              const allowed = new Set(sel.options.map((o) => o.value));
              const coerced = allowed.has(sel.value)
                ? sel.value
                : (sel.options.find((o) => o.value === 'all')?.value ?? sel.options[0]?.value ?? '');
              if (!sel.options.length) return null;
              const isActive = coerced !== 'all' && coerced !== '';
              return (
                <div key={sel.id} className="space-y-1.5">
                  <label className={cn('block text-xs font-medium', isActive ? 'text-primary' : 'text-muted-foreground')}>
                    {sel.placeholder ?? sel.id}
                  </label>
                  <MinimalDropdown
                    value={coerced === 'all' ? '' : coerced}
                    onChange={(v) => sel.onChange(v || 'all')}
                    allowClear
                    placeholder={sel.placeholder ?? '—'}
                    className={cn('w-full', isActive && 'border-primary/40 bg-primary/5')}
                    options={sel.options
                      .filter((o) => o.value !== 'all')
                      .map((o) => ({ value: o.value, label: o.label }))}
                  />
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    ) : null;

    return (
      <div className="rounded-xl border border-border/60 bg-card/80 px-3 py-2.5 shadow-sm backdrop-blur-sm overflow-visible sm:px-4">
        {/*
          One row at any width, each filter only as wide as it needs. Wide screens
          narrow the lists to fit; what still does not fit, and all of it on phones,
          scrolls sideways. The padding keeps the date's clear button and focus
          rings from being cut.
        */}
        <div className="-mx-1.5 -my-1.5 flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto overscroll-x-contain px-1.5 py-1.5 [scrollbar-width:thin] max-md:[scrollbar-width:none] max-md:[&>*]:shrink-0">
          {leadingFilters}
          {leadingFilters ? (
            <>
              {periodFilterControl}
              {pickerBlock}
              {statusFilterControl}
            </>
          ) : (
            <>
              {periodFilterControl}
              {statusFilterControl}
              {pickerBlock}
            </>
          )}
          {moreFiltersPopover}
          {hasAnyActiveFilter && (
            <button
              type="button"
              aria-label="مسح كل الفلاتر"
              className="flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              onClick={clearAllFilters}
            >
              <X className="h-3.5 w-3.5" />
              مسح الكل
            </button>
          )}
          {hasDataView && dataView ? (
            <div className="ms-auto">
              <Tabs value={dataView.value} onValueChange={dataView.onChange}>
                <TabsList className="h-8 shrink-0 gap-0.5 bg-muted/70 p-0.5">
                  {dataView.options.map((opt) => (
                    <TabsTrigger
                      key={opt.value}
                      value={opt.value}
                      className={DATA_VIEW_TAB_CLASS}
                      aria-label={opt.label}
                      title={opt.label}
                    >
                      <DataViewIcon name={opt.icon} />
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          ) : null}
          {trailingActions && (
            <div className={cn('flex items-center gap-2', !hasDataView && 'ms-auto')}>
              {trailingActions}
            </div>
          )}
        </div>
      </div>
    );
  },
);
