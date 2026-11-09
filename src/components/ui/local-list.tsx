'use client';

import * as React from 'react';
import type { RegisterColumnKind } from '@/components/pdf/print/register-document';
import { registerExportRows, type RegisterExportColumn } from '@/components/pdf/lib/register-export-rows';
import { RegisterExportMenu } from '@/components/pdf/register-export-menu';
import { ListColumnsPicker, useColumnVisibility } from '@/components/ui/list-columns-picker';
import {
  ListGroupMenu,
  listGroupValue,
  useListGroup,
  type ListGroupOption,
  type ListGroupSummary,
  type ListTotals,
} from '@/components/ui/list-group';
import { ListSavedViews, listStateKeys } from '@/components/ui/list-saved-views';
import { ListSortMenu, useListSort } from '@/components/ui/list-sort';
import { DEFAULT_PAGE_SIZE, StickyPagination } from '@/components/ui/sticky-pagination';
import { useAuthStore } from '@/features/auth/lib/auth-store';
import { hrFiltersKey, usePersistedFilterState } from '@/features/hr/lib/use-persisted-filter-state';
import { cn } from '@/shared/utils';

/**
 * One field of a list whose rows are all in the browser (AGENTS.md §8): its
 * column on screen, its text for sorting, grouping and the PDF / Excel, and
 * optionally a sum for subtotals and the grand total.
 */
export type LocalListField<T> = {
  key: string;
  label: string;
  /** The screen cell; defaults to `text`. */
  cell?: (row: T) => React.ReactNode;
  /** Plain text: the export cell, and the sort / group value by default. */
  text: (row: T) => string;
  /** Sort value when the text does not sort right (amounts, dates). */
  sortValue?: (row: T) => string | number;
  /** False: not offered in «ترتيب». */
  sortable?: boolean;
  /** Set to make the field a «تجميع» choice: the row's group key (null = none). */
  groupKey?: (row: T) => string | null;
  /** The group's name from its key (defaults to the key). */
  groupLabel?: (key: string) => string;
  /** Amount summed per group and over every row (shown with `formatSum`). */
  sum?: (row: T) => number;
  formatSum?: (n: number) => string;
  /** Optional columns can be hidden from «الأعمدة»; fixed ones always show. */
  optional?: boolean;
  hiddenByDefault?: boolean;
  /** Not a column on screen nor in the export (a sort / group choice only). */
  hiddenColumn?: boolean;
  /** On screen only (row buttons): left out of the PDF and Excel. */
  screenOnly?: boolean;
  kind?: RegisterColumnKind;
  className?: string;
};

const compare = (a: string | number, b: string | number) =>
  typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'ar');

/**
 * The state of a list held in the browser: sort, grouping and visible
 * columns kept per user, company and screen (saved views carry them), and
 * the rows sorted and grouped — every filtered row, not a page.
 */
export function useLocalList<T>({
  section,
  page,
  fields,
  rows,
}: {
  section: string;
  page: string;
  fields: readonly LocalListField<T>[];
  /** The filtered rows, in the list's default order. */
  rows: readonly T[];
}) {
  const companyId = useAuthStore((s) => s.activeCompanyId);
  const keys = listStateKeys(section, page, companyId);
  const sortOptions = React.useMemo(() => fields.filter((f) => f.sortable !== false).map((f) => ({ key: f.key, label: f.label })), [fields]);
  const groupOptions = React.useMemo<ListGroupOption[]>(
    () => fields.filter((f) => f.groupKey).map((f) => ({ key: f.key, label: f.label, formatKey: f.groupLabel })),
    [fields],
  );
  const measures = React.useMemo(() => fields.filter((f) => f.sum).map((f) => ({ key: f.key, label: f.label })), [fields]);
  const optional = React.useMemo(() => fields.filter((f) => f.optional && !f.hiddenColumn).map((f) => ({ key: f.key, label: f.label })), [fields]);
  const defaultHidden = React.useMemo(() => fields.filter((f) => f.optional && f.hiddenByDefault).map((f) => f.key), [fields]);

  const sort = useListSort(keys.sort, sortOptions);
  const group = useListGroup(keys.group, groupOptions, measures);
  const columns = useColumnVisibility(hrFiltersKey(section, page, companyId, 'hiddenColumns'), optional, defaultHidden);

  const sorted = React.useMemo(() => {
    const field = sort.sort ? fields.find((f) => f.key === sort.sort!.key) : undefined;
    if (!field) return [...rows];
    const value = field.sortValue ?? field.text;
    const sign = sort.sort!.dir === 'asc' ? 1 : -1;
    return rows
      .map((row, index) => ({ row, index, v: value(row) }))
      .sort((a, b) => compare(a.v, b.v) * sign || a.index - b.index)
      .map((x) => x.row);
  }, [rows, fields, sort.sort]);

  const totalsOf = React.useCallback(
    (list: readonly T[]): ListTotals => ({
      count: list.length,
      sums: Object.fromEntries(fields.filter((f) => f.sum).map((f) => [f.key, list.reduce((s, r) => s + f.sum!(r), 0)])),
    }),
    [fields],
  );
  const total = React.useMemo(() => totalsOf(sorted), [sorted, totalsOf]);

  const groupField = group.groupBy ? fields.find((f) => f.key === group.groupBy && f.groupKey) : undefined;
  const groups = React.useMemo(() => {
    if (!groupField?.groupKey) return null;
    const byKey = new Map<string, T[]>();
    for (const row of sorted) {
      const value = listGroupValue(groupField.groupKey(row));
      const list = byKey.get(value);
      if (list) list.push(row);
      else byKey.set(value, [row]);
    }
    const summaries: Array<ListGroupSummary & { rows: T[] }> = [...byKey.entries()].map(([value, list]) => {
      const key = value === listGroupValue(null) ? null : value;
      return { key, label: key && groupField.groupLabel ? groupField.groupLabel(key) : key, rows: list, ...totalsOf(list) };
    });
    const order = group.sortGroups(summaries);
    return order.map((g) => summaries.find((s) => s.key === g.key)!);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- group.sortGroups follows group.group
  }, [sorted, groupField, totalsOf, group.group]);

  const visibleFields = React.useMemo(
    () => fields.filter((f) => !f.hiddenColumn && (!f.optional || columns.isVisible(f.key))),
    [fields, columns],
  );

  const pageSizeKey = hrFiltersKey(section, page, companyId, 'pageSize');
  return { keys, pageSizeKey, sort, group, columns, fields, visibleFields, rows: sorted, total, groups, groupField };
}

export type LocalListModel<T> = ReturnType<typeof useLocalList<T>>;

/**
 * The header tools of the list, in the order of AGENTS.md §8: columns, sort,
 * grouping, saved views, then PDF / Excel of what the screen shows.
 */
export function LocalListToolbar<T>({
  list,
  title,
  fileName,
  subtitleLines = [],
  landscape,
  before,
  primary,
}: {
  list: LocalListModel<T>;
  title: string;
  fileName: string;
  subtitleLines?: string[];
  landscape?: boolean;
  /** Import and filter buttons (they come first). */
  before?: React.ReactNode;
  /** The screen's main «add» button (just before the export). */
  primary?: React.ReactNode;
}) {
  const exportColumns: RegisterExportColumn<T>[] = list.visibleFields.filter((f) => !f.screenOnly).map((f) => ({
    label: f.label,
    kind: f.kind ?? (f.sum ? 'number' : 'text'),
    key: f.key,
    value: f.text,
    total: f.sum ? (t: ListTotals) => (f.formatSum ?? String)(t.sums[f.key] ?? 0) : undefined,
  }));
  const lines = [...subtitleLines, list.sort.label, list.group.label].filter((x): x is string => Boolean(x));
  return (
    <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
      {before}
      <ListColumnsPicker model={list.columns} />
      <ListSortMenu model={list.sort} />
      {list.group.options.length ? <ListGroupMenu model={list.group} /> : null}
      <ListSavedViews storageKey={list.keys.views} prefixes={list.keys.prefixes} />
      {primary}
      <RegisterExportMenu
        title={title}
        fileName={fileName}
        columns={exportColumns}
        subtitleLines={lines}
        landscape={landscape ?? exportColumns.length > 6}
        getRows={() =>
          registerExportRows({
            columns: exportColumns,
            rows: list.rows,
            total: list.total,
            grouping: list.groups && list.groupField
              ? {
                  fieldLabel: list.groupField.label,
                  groups: list.groups,
                  labelOf: list.group.labelOf,
                  groupKeyOf: (row) => list.groupField!.groupKey!(row),
                }
              : undefined,
          })
        }
      />
    </div>
  );
}

function SumsLine<T>({ list, totals, className }: { list: LocalListModel<T>; totals: ListTotals; className?: string }) {
  const summed = list.visibleFields.filter((f) => f.sum);
  return (
    <span className={cn('flex flex-wrap gap-x-3 gap-y-0.5', className)}>
      <span>{totals.count.toLocaleString('en-US')} سجل</span>
      {summed.map((f) => (
        <span key={f.key}>
          {f.label}: <span className="font-semibold tabular-nums">{(f.formatSum ?? String)(totals.sums[f.key] ?? 0)}</span>
        </span>
      ))}
    </span>
  );
}

/** One page of rows, each under its group's heading with the group's full subtotals. */
function pageOfSections<S extends { rows: readonly unknown[] }>(sections: readonly S[], start: number, size: number): S[] {
  const out: S[] = [];
  let skip = start;
  let left = size;
  for (const section of sections) {
    if (left === 0) break;
    const dropped = Math.min(skip, section.rows.length);
    skip -= dropped;
    const rows = section.rows.slice(dropped, dropped + left);
    left -= rows.length;
    if (rows.length > 0) out.push({ ...section, rows });
  }
  return out;
}

/**
 * The list on screen: cards on phones, a table from md up (`cardsOnly`: cards
 * at every width, for rows a table cannot hold); when grouped, each group's
 * heading with its count and subtotals, then the grand total. Pages through
 * the rows: totals, group subtotals and the export always cover every row.
 */
export function LocalListTable<T>({
  list,
  rowKey,
  card,
  onRowClick,
  empty,
  cardsOnly = false,
  cardsClassName,
}: {
  list: LocalListModel<T>;
  rowKey: (row: T) => string;
  card: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  empty?: React.ReactNode;
  cardsOnly?: boolean;
  cardsClassName?: string;
}) {
  const rowCount = list.rows.length;
  const [pageSize, setPageSize] = usePersistedFilterState<number>(list.pageSizeKey, DEFAULT_PAGE_SIZE);
  const [page, setPage] = React.useState(1);
  const totalPages = Math.max(1, Math.ceil(rowCount / pageSize));
  // A filter, tab, sort or grouping starts over; a refresh of the same rows stays.
  React.useEffect(() => {
    setPage(1);
  }, [rowCount, list.sort.sortKey, list.group.groupBy, pageSize]);
  const shownPage = Math.min(page, totalPages);

  if (rowCount === 0) return <>{empty ?? null}</>;
  const allSections: Array<{ key: string; title: string | null; totals: ListTotals | null; rows: T[] }> = list.groups
    ? list.groups.map((g) => ({ key: listGroupValue(g.key), title: `${list.groupField!.label}: ${list.group.labelOf(g)}`, totals: g, rows: g.rows }))
    : [{ key: 'all', title: null, totals: null, rows: list.rows }];
  const sections = pageOfSections(allSections, (shownPage - 1) * pageSize, pageSize);
  const hasSums = list.visibleFields.some((f) => f.sum);
  const clickable = (row: T) =>
    onRowClick
      ? {
          role: 'button' as const,
          tabIndex: 0,
          onClick: () => onRowClick(row),
          onKeyDown: (e: React.KeyboardEvent) => (e.key === 'Enter' ? onRowClick(row) : undefined),
        }
      : {};

  return (
    <div className="space-y-2">
      <div className={cn('space-y-3', !cardsOnly && 'md:hidden')}>
        {sections.map((s) => (
          <div key={s.key} className="space-y-2">
            {s.title ? (
              <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs">
                <p className="font-semibold">{s.title}</p>
                {s.totals ? <SumsLine list={list} totals={s.totals} className="mt-0.5 text-muted-foreground" /> : null}
              </div>
            ) : null}
            <div className={cn('space-y-2', cardsClassName && `space-y-0 ${cardsClassName}`)}>
              {s.rows.map((row) => (
                <div key={rowKey(row)} {...clickable(row)} className={cn(!cardsClassName && 'rounded-xl border border-border bg-card p-3', cardsClassName && 'min-w-0', onRowClick && 'cursor-pointer active:bg-muted/50')}>
                  {card(row)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {cardsOnly ? null : <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              {list.visibleFields.map((f) => (
                <th key={f.key} className={cn('px-3 py-2.5 text-start font-medium', f.className)}>{f.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map((s) => (
              <React.Fragment key={s.key}>
                {s.title ? (
                  <tr className="border-t border-border bg-muted/30">
                    <td colSpan={list.visibleFields.length} className="px-3 py-2 text-xs">
                      <span className="font-semibold">{s.title}</span>
                      {s.totals ? <SumsLine list={list} totals={s.totals} className="ms-3 inline-flex text-muted-foreground" /> : null}
                    </td>
                  </tr>
                ) : null}
                {s.rows.map((row) => (
                  <tr key={rowKey(row)} {...clickable(row)} className={cn('border-t border-border/70', onRowClick && 'cursor-pointer hover:bg-muted/30')}>
                    {list.visibleFields.map((f) => (
                      <td key={f.key} className={cn('px-3 py-2.5 align-middle', f.className)}>{f.cell ? f.cell(row) : f.text(row)}</td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
          {hasSums ? (
            <tfoot className="border-t-2 border-border bg-muted/40 text-xs font-semibold">
              <tr>
                {list.visibleFields.map((f, i) => (
                  <td key={f.key} className={cn('px-3 py-2.5', f.className)}>
                    {i === 0 ? `الإجمالي (${list.total.count.toLocaleString('en-US')})` : f.sum ? (f.formatSum ?? String)(list.total.sums[f.key] ?? 0) : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>}
      {hasSums ? (
        <div className={cn('rounded-lg bg-muted/60 px-3 py-2 text-xs', !cardsOnly && 'md:hidden')}>
          <SumsLine list={list} totals={list.total} />
        </div>
      ) : null}
      <div className="flex justify-center pt-1">
        <StickyPagination
          page={shownPage}
          pageSize={pageSize}
          total={rowCount}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
}
