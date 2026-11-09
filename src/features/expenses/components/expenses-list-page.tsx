'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { PageHeaderPrimaryButton } from '@/components/layouts/page-header-primary-button';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { Button } from '@/components/ui/button';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { LocalListTable, LocalListToolbar, useLocalList, type LocalListField } from '@/components/ui/local-list';
import { hrFiltersKey, usePersistedFilterState } from '@/features/hr/lib/use-persisted-filter-state';
import { useExpensesStore } from '../data/store';
import { involves } from '../domain/reports';
import { STATUS_LABELS_AR } from '../domain/policy';
import type { Expense, ExpensesData, TxnStatus } from '../domain/types';
import { expensesRoutes } from '../constants/routes';
import { EmptyState, LoadingBlock, Money, PartyName, StatusBadge } from './common';
import { ExpenseFormDialog } from './expense-form-dialog';
import { ImportLinkButton } from './import-page';
import { useCurrency, useDirectory, useExpensesData, useExpensesPermissions } from './expenses-provider';

export type ListFilters = {
  q: string;
  status: TxnStatus | 'all';
  categoryId: string;
  groupId: string;
  personId: string;
  from: string;
  to: string;
};

export const EMPTY_FILTERS: ListFilters = { q: '', status: 'all', categoryId: 'all', groupId: 'all', personId: 'all', from: '', to: '' };

export function activeFilterCount(f: ListFilters): number {
  return (Object.keys(EMPTY_FILTERS) as Array<keyof ListFilters>).filter((k) => f[k] !== EMPTY_FILTERS[k]).length;
}

function applyFilters(rows: Expense[], f: ListFilters): Expense[] {
  const q = f.q.trim();
  return rows.filter(
    (e) =>
      (f.status === 'all' || e.status === f.status) &&
      (f.categoryId === 'all' || e.categoryId === f.categoryId) &&
      (f.groupId === 'all' || e.groupId === f.groupId || e.allocation.some((a) => a.groupId === f.groupId)) &&
      (f.personId === 'all' || involves(e, f.personId)) &&
      (!f.from || e.date >= f.from) &&
      (!f.to || e.date <= f.to) &&
      (!q || e.description.includes(q) || (e.note ?? '').includes(q)),
  );
}

export function FiltersPanel({ data, value, onChange, hideStatus }: { data: ExpensesData; value: ListFilters; onChange: (f: ListFilters) => void; hideStatus?: boolean }) {
  const directory = useDirectory();
  const set = <K extends keyof ListFilters>(k: K, v: ListFilters[K]) => onChange({ ...value, [k]: v });
  return (
    <ListFilterBar
      optionalDateRange
      showStatusSection={false}
      showEmployeePicker={false}
      periodValue={{ from: value.from, to: value.to }}
      onPeriodChange={(p) => onChange({ ...value, from: p.from, to: p.to })}
      periodFilterActive={activeFilterCount(value) > 0}
      onClearAll={() => onChange(EMPTY_FILTERS)}
      leadingFilters={<EntityFilterSearchField value={value.q} onChange={(q) => set('q', q)} placeholder="بحث في الوصف" />}
      inlineSelects={[
        ...(hideStatus
          ? []
          : [{
              id: 'status',
              value: value.status,
              onChange: (v: string) => set('status', v as ListFilters['status']),
              placeholder: 'كل الحالات',
              options: [{ value: 'all', label: 'كل الحالات' }, ...(Object.keys(STATUS_LABELS_AR) as TxnStatus[]).map((s) => ({ value: s, label: STATUS_LABELS_AR[s] }))],
            }]),
        {
          id: 'category',
          value: value.categoryId,
          onChange: (v) => set('categoryId', v),
          placeholder: 'كل الفئات',
          options: [{ value: 'all', label: 'كل الفئات' }, ...data.categories.map((c) => ({ value: c.id, label: c.name }))],
        },
        {
          id: 'group',
          value: value.groupId,
          onChange: (v) => set('groupId', v),
          placeholder: 'كل المجموعات',
          options: [{ value: 'all', label: 'كل المجموعات' }, ...data.groups.map((g) => ({ value: g.id, label: g.name }))],
        },
        {
          id: 'person',
          value: value.personId,
          onChange: (v) => set('personId', v),
          placeholder: 'كل الأشخاص',
          options: [{ value: 'all', label: 'كل الأشخاص' }, ...directory.choices.map((p) => ({ value: p.id, label: p.name }))],
        },
      ]}
    />
  );
}

const payLabel = (e: Expense) => e.payments.map((p) => (p.source === 'org' ? 'المنشأة' : p.source === 'custody' ? 'عهدة' : 'شخصي')).join(' + ');

/** Fields of the expenses list: fixed columns, optional ones, sort and grouping. */
function useExpenseFields(data: ExpensesData | null): LocalListField<Expense>[] {
  const currency = useCurrency();
  const directory = useDirectory();
  return React.useMemo(() => {
    const catName = (id: string) => data?.categories.find((c) => c.id === id)?.name ?? '—';
    const home = data?.groups.find((g) => g.isDefault)?.id ?? null;
    const groupName = (id: string | null) => data?.groups.find((g) => g.id === id)?.name ?? '—';
    const centerName = (id: string | null | undefined) => {
      const c = id ? data?.costCenters.find((x) => x.id === id) : undefined;
      return c ? `${c.code} ${c.name}` : '—';
    };
    const advanced = data?.settings.mode === 'advanced';
    const fields: LocalListField<Expense>[] = [
      { key: 'date', label: 'التاريخ', kind: 'date', text: (e) => e.date, cell: (e) => <span className="tabular-nums text-muted-foreground">{e.date}</span>, groupKey: (e) => e.date.slice(0, 7) },
      { key: 'description', label: 'الوصف', kind: 'name', text: (e) => e.description, cell: (e) => <span className="font-medium">{e.description}</span> },
      { key: 'category', label: 'الفئة', text: (e) => catName(e.categoryId), groupKey: (e) => e.categoryId, groupLabel: catName },
      { key: 'group', label: 'المجموعة', optional: true, text: (e) => groupName(e.groupId ?? home), groupKey: (e) => e.groupId ?? home, groupLabel: groupName },
      { key: 'payment', label: 'الدفع', optional: true, text: payLabel, groupKey: payLabel },
      { key: 'bearing', label: 'التحميل', optional: true, hiddenByDefault: true, text: (e) => (e.bearing.method === 'org' ? 'المنشأة' : `${e.bearing.shares.length} أطراف`) },
      ...(advanced ? [{ key: 'center', label: 'مركز التكلفة', optional: true, hiddenByDefault: true, text: (e: Expense) => centerName(e.costCenterId), groupKey: (e: Expense) => e.costCenterId ?? null, groupLabel: (id: string) => centerName(id) }] : []),
      { key: 'note', label: 'ملاحظة', optional: true, hiddenByDefault: true, sortable: false, text: (e) => e.note ?? '' },
      { key: 'createdBy', label: 'سجّله', optional: true, text: (e) => directory.nameOf(e.createdBy), cell: (e) => <PartyName id={e.createdBy} link={false} />, groupKey: (e) => e.createdBy, groupLabel: (id) => directory.nameOf(id) },
      { key: 'amount', label: 'المبلغ', kind: 'number', text: (e) => currency.format(e.amount), sortValue: (e) => e.amount, sum: (e) => (e.status === 'approved' ? e.amount : 0), formatSum: currency.format, cell: (e) => <Money value={e.amount} className="font-semibold" /> },
      { key: 'status', label: 'الحالة', kind: 'status', text: (e) => STATUS_LABELS_AR[e.status], cell: (e) => <StatusBadge status={e.status} />, groupKey: (e) => e.status, groupLabel: (s) => STATUS_LABELS_AR[s as TxnStatus] ?? s },
    ];
    return fields;
  }, [data, currency, directory]);
}

export function ExpensesListPage() {
  const data = useExpensesData();
  const currency = useCurrency();
  const directory = useDirectory();
  const perms = useExpensesPermissions();
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const companyId = useExpensesStore((s) => s.companyId);
  const [filters, setFilters] = usePersistedFilterState<ListFilters>(hrFiltersKey('expenses', 'transactions', companyId, 'filters'), EMPTY_FILTERS);
  const count = activeFilterCount(filters);
  const fields = useExpenseFields(data);
  const rows = React.useMemo(
    () => (data ? applyFilters(data.expenses.filter((e) => e.currency === currency.code), filters).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)) : []),
    [data, currency.code, filters],
  );
  const list = useLocalList({ section: 'expenses', page: 'transactions', fields, rows });
  const filterLines = ['المبالغ المجمّعة للمعتمد فقط', filters.from || filters.to ? `الفترة: ${filters.from || '…'} إلى ${filters.to || '…'}` : null, count > 0 ? `فلاتر مفعّلة: ${count}` : null].filter((x): x is string => Boolean(x));

  usePageHeaderActions(
    () => (
      <LocalListToolbar
        list={list}
        title="سجل المصروفات"
        fileName="expenses"
        subtitleLines={filterLines}
        before={<><ImportLinkButton /><FilterToggleButton activeFilterCount={count} /></>}
        primary={
          <PageHeaderPrimaryButton icon={Plus} label="مصروف جديد" disabled={!perms.create} onClick={() => setAdding(true)}>
            مصروف جديد
          </PageHeaderPrimaryButton>
        }
      />
    ),
    [count, perms.create, list.rows, list.visibleFields, list.groups, list.sort.sortKey, list.columns.hiddenKey, filterLines.join('|')],
  );
  useEntityFilterSlot(() => (data ? <FiltersPanel data={data} value={filters} onChange={setFilters} /> : null), [filters, data?.categories, data?.groups, directory.choices]);

  if (!data) return <LoadingBlock />;
  const total = rows.filter((e) => e.status === 'approved').reduce((t, e) => t + e.amount, 0);
  const catName = (id: string) => data.categories.find((c) => c.id === id)?.name ?? '—';

  return (
    <div className="space-y-3">
      <SetPageTitle titleAr="المصروفات" descriptionAr="كل المصروفات وحالاتها" iconName="Receipt" />
      <p className="text-xs text-muted-foreground">
        {rows.length} مصروف · المعتمد منها <Money value={total} className="font-semibold text-foreground" />
      </p>
      {rows.length === 0 ? (
        <EmptyState text={count > 0 ? 'لا نتائج لهذه الفلاتر' : 'لا مصروفات بعد'} action={perms.create ? <Button size="sm" onClick={() => setAdding(true)}>مصروف جديد</Button> : undefined} />
      ) : (
        <LocalListTable
          list={list}
          rowKey={(e) => e.id}
          onRowClick={(e) => router.push(expensesRoutes.expenseDetail(e.id))}
          card={(e) => (
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-sm font-medium">{e.description}</p>
                <Money value={e.amount} className="shrink-0 text-sm font-semibold" />
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>{e.date}</span><span>·</span><span>{catName(e.categoryId)}</span><span>·</span><span>{payLabel(e)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">{directory.nameOf(e.createdBy)}</span>
                <StatusBadge status={e.status} />
              </div>
            </div>
          )}
        />
      )}
      <ExpenseFormDialog open={adding} onOpenChange={setAdding} />
    </div>
  );
}
