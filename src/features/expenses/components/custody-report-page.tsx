'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { Badge } from '@/components/ui/badge';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { LocalListTable, LocalListToolbar, useLocalList, type LocalListField } from '@/components/ui/local-list';
import { expensesRoutes } from '../constants/routes';
import type { CustodyBalance } from '../domain/ledger';
import { EmptyState, LoadingBlock, Money } from './common';
import { ReportSummaryCard } from './report-common';
import { useCurrency, useDirectory, useExpensesData, useLedger } from './expenses-provider';

const ALL = 'all';

function statusBadge(b: CustodyBalance) {
  if (b.custody.archived) return <Badge variant="subtle">مؤرشفة</Badge>;
  return b.custody.status === 'open' ? <Badge variant="success">مفتوحة</Badge> : <Badge variant="subtle">مقفلة</Badge>;
}

export function CustodyReportPage() {
  const router = useRouter();
  const data = useExpensesData();
  const ledger = useLedger();
  const currency = useCurrency();
  const directory = useDirectory();
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [holderId, setHolderId] = React.useState(ALL);
  const [status, setStatus] = React.useState(ALL);

  React.useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const balances = React.useMemo(() => [...(ledger?.custodies.values() ?? [])], [ledger]);
  const holders = React.useMemo(
    () => [...new Set(balances.map((b) => b.custody.holderId))].map((id) => ({ value: id, label: directory.nameOf(id) })),
    [balances, directory],
  );

  const rows = React.useMemo(
    () =>
      balances
        .filter((b) => holderId === ALL || b.custody.holderId === holderId)
        .filter((b) => (status === ALL ? !b.custody.archived : status === 'archived' ? b.custody.archived : b.custody.status === status && !b.custody.archived))
        .filter((b) => !search || directory.nameOf(b.custody.holderId).toLowerCase().includes(search) || b.custody.purpose.toLowerCase().includes(search))
        .sort((a, b) => (a.custody.status === b.custody.status ? b.actual - a.actual : a.custody.status === 'open' ? -1 : 1)),
    [balances, holderId, status, search, directory],
  );

  const fields = React.useMemo<LocalListField<CustodyBalance>[]>(() => {
    const money = (key: string, label: string, value: (r: CustodyBalance) => number, opts: Partial<LocalListField<CustodyBalance>> = {}): LocalListField<CustodyBalance> => ({
      key,
      label,
      kind: 'number',
      text: (r) => currency.format(value(r)),
      sortValue: value,
      sum: value,
      formatSum: currency.format,
      cell: (r) => <Money value={value(r)} />,
      ...opts,
    });
    const groupName = (id: string | null) => data?.groups.find((g) => g.id === id)?.name ?? '—';
    return [
      { key: 'holder', label: 'الحامل', kind: 'name', text: (r) => directory.nameOf(r.custody.holderId), cell: (r) => <span className="font-medium">{directory.nameOf(r.custody.holderId)}</span>, groupKey: (r) => r.custody.holderId, groupLabel: (id) => directory.nameOf(id) },
      { key: 'purpose', label: 'الغرض', text: (r) => r.custody.purpose },
      { key: 'group', label: 'المجموعة', optional: true, hiddenByDefault: true, text: (r) => groupName(r.custody.groupId ?? null), groupKey: (r) => r.custody.groupId ?? null, groupLabel: groupName },
      { key: 'openedAt', label: 'فُتحت', optional: true, hiddenByDefault: true, kind: 'date', text: (r) => r.custody.openedAt, groupKey: (r) => r.custody.openedAt.slice(0, 7) },
      money('issued', 'مسلّم', (r) => r.issued + r.toppedUp),
      money('spent', 'مصروف', (r) => r.spent),
      money('returned', 'مرتجع', (r) => r.returned, { optional: true }),
      money('pending', 'معلق', (r) => r.pendingOut, { optional: true, hiddenByDefault: true }),
      money('actual', 'الرصيد', (r) => r.actual, { cell: (r) => <Money value={r.actual} className="font-semibold" /> }),
      { key: 'status', label: 'الحالة', kind: 'status', text: (r) => (r.custody.archived ? 'مؤرشفة' : r.custody.status === 'open' ? 'مفتوحة' : 'مقفلة'), cell: statusBadge, groupKey: (r) => r.custody.status, groupLabel: (k) => (k === 'open' ? 'مفتوحة' : 'مقفلة') },
    ];
  }, [data, directory, currency]);
  const list = useLocalList({ section: 'expenses', page: 'custody-report', fields, rows });

  const activeFilterCount = [holderId, status].filter((v) => v !== ALL).length + (search ? 1 : 0);

  usePageHeaderActions(
    () => (
      <LocalListToolbar
        list={list}
        title="تقرير العهد"
        fileName="custody-report"
        subtitleLines={['التسليم والتغذية والإرجاع تحويلات، لا تُحسب مصروفات.']}
        before={<FilterToggleButton activeFilterCount={activeFilterCount} />}
      />
    ),
    [activeFilterCount, list.rows, list.visibleFields, list.groups, list.sort.sortKey],
  );

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showDateSection={false}
        showStatusSection={false}
        showEmployeePicker={false}
        leadingFilters={<EntityFilterSearchField value={searchInput} onChange={setSearchInput} placeholder="ابحث بالحامل أو الغرض…" />}
        inlineSelects={[
          {
            id: 'holder',
            value: holderId,
            onChange: setHolderId,
            placeholder: 'كل الحاملين',
            options: [{ value: ALL, label: 'كل الحاملين' }, ...holders],
          },
          {
            id: 'status',
            value: status,
            onChange: setStatus,
            placeholder: 'كل الحالات',
            options: [
              { value: ALL, label: 'كل الحالات' },
              { value: 'open', label: 'مفتوحة' },
              { value: 'closed', label: 'مقفلة' },
              { value: 'archived', label: 'المؤرشفة' },
            ],
          },
        ]}
      />
    ),
    [searchInput, holderId, status, holders],
  );

  if (!ledger) return <LoadingBlock />;

  return (
    <div className="flex flex-col gap-5">
      <SetPageTitle titleAr="تقرير العهد" descriptionAr="التسليم والتغذية والإرجاع تحويلات — لا تُحسب مصروفات." iconName="Wallet" />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <ReportSummaryCard label="مسلّم" value={<Money value={list.total.sums.issued ?? 0} />} hint={`${rows.length} عهدة`} />
        <ReportSummaryCard label="مصروف" value={<Money value={list.total.sums.spent ?? 0} />} />
        <ReportSummaryCard label="مرتجع" value={<Money value={list.total.sums.returned ?? 0} />} />
        <ReportSummaryCard label="الرصيد" value={<Money value={list.total.sums.actual ?? 0} />} />
      </div>

      <LocalListTable
        list={list}
        rowKey={(r) => r.custody.id}
        onRowClick={(r) => router.push(expensesRoutes.custodyDetail(r.custody.id))}
        empty={<EmptyState text="لا عهد ضمن الفلاتر الحالية." />}
        card={(r) => (
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{directory.nameOf(r.custody.holderId)}</p>
                <p className="truncate text-xs text-muted-foreground">{r.custody.purpose}</p>
              </div>
              <div className="shrink-0">{statusBadge(r)}</div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>مسلّم <Money value={r.issued + r.toppedUp} className="text-foreground" /></span>
              <span>مصروف <Money value={r.spent} className="text-foreground" /></span>
              <span>الرصيد <Money value={r.actual} className="font-semibold text-foreground" /></span>
            </div>
          </div>
        )}
      />
    </div>
  );
}
