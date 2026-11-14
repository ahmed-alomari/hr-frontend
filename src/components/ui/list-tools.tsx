'use client';

import * as React from 'react';
import { toast } from 'sonner';
import type { RegisterColumnKind } from '@/components/pdf/print/register-document';
import { registerExportRows, type RegisterExportColumn } from '@/components/pdf/lib/register-export-rows';
import { RegisterExportMenu } from '@/components/pdf/register-export-menu';
import type { ColumnDef } from '@/components/ui/data-table';
import { GroupedDataTable } from '@/components/ui/grouped-data-table';
import { ListColumnsPicker, useColumnVisibility } from '@/components/ui/list-columns-picker';
import {
  LIST_GROUP_NONE,
  ListGroupMenu,
  listGroupValue,
  useGroupedList,
  useListGroup,
  type ListGroupOption,
  type ListGroupSummary,
  type ListTotals,
} from '@/components/ui/list-group';
import { ListSavedViews, listStateKeys } from '@/components/ui/list-saved-views';
import { ListSortMenu, useListSort } from '@/components/ui/list-sort';
import { useAuthStore } from '@/features/auth/lib/auth-store';
import { hrFiltersKey } from '@/features/hr/lib/use-persisted-filter-state';

/** What a screen tells about one of its table columns (same `key` as its `ColumnDef`). */
export type ListToolField<T> = {
  /** Plain text: the export cell, and the sort value by default. */
  text: (row: T) => string;
  /** Sort value when the text does not sort right (amounts, dates). */
  sort?: (row: T) => string | number;
  /** False: not offered in «ترتيب». */
  sortable?: boolean;
  /** Makes the column a «تجميع» choice: the row's group (null = no value). */
  group?: (row: T) => string | null | undefined;
  groupLabel?: (key: string) => string;
  /** Summed per group and over every row. */
  sum?: (row: T) => number;
  formatSum?: (n: number) => string;
  kind?: RegisterColumnKind;
  /** Details the cell shows under its main value: their own columns in the export. */
  alsoExport?: { label: string; text: (row: T) => string }[];
  /** Always shown: not offered in «الأعمدة». */
  fixed?: boolean;
  hiddenByDefault?: boolean;
};

const compare = (a: string | number, b: string | number) =>
  typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'ar');

type PagedState = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
};

/**
 * Columns, sort, grouping, saved views and export for any table, in a few lines
 * (AGENTS.md §8). A list whose rows are all in the browser uses them directly.
 * A list the server pages (`fetchAll` given) stays paged until the user asks
 * for a sort or a grouping: then every filtered row is read, the way its export
 * reads them, so the order, the groups and their totals cover the whole list,
 * never one page.
 */
export function useListTools<T>({
  section,
  page,
  columns,
  fields,
  rows,
  fetchAll,
  resetKey = '',
  savedViews = true,
  extraExportRows,
}: {
  section: string;
  page: string;
  columns: readonly ColumnDef<T>[];
  fields: Partial<Record<string, ListToolField<T>>>;
  /** The rows on hand: all of them, or the server's page when `fetchAll` is given. */
  rows: readonly T[];
  /** Every row under the current filters. */
  fetchAll?: () => Promise<T[]>;
  /** Changes with the filters. */
  resetKey?: string;
  /** False: the screen already shows its own saved views. */
  savedViews?: boolean;
  /** Rows the export adds after the list: not on the screen, not in the totals. */
  extraExportRows?: readonly T[];
}) {
  const companyId = useAuthStore((s) => s.activeCompanyId);
  const keys = listStateKeys(section, page, companyId);
  const fieldOf = React.useCallback((key: string) => fields[key], [fields]);

  const columnKeys = columns.map((c) => c.key).join('|');
  const sortOptions = React.useMemo(
    () => columns.filter((c) => !c.isActions && c.title && fieldOf(c.key) && fieldOf(c.key)!.sortable !== false).map((c) => ({ key: c.key, label: c.title })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the options follow the column keys
    [columnKeys],
  );
  const groupOptions = React.useMemo<ListGroupOption[]>(
    () => columns.filter((c) => fieldOf(c.key)?.group).map((c) => ({ key: c.key, label: c.title, formatKey: fieldOf(c.key)!.groupLabel })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the options follow the column keys
    [columnKeys],
  );
  const measures = React.useMemo(
    () => columns.filter((c) => fieldOf(c.key)?.sum).map((c) => ({ key: c.key, label: c.title })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the options follow the column keys
    [columnKeys],
  );
  const optional = React.useMemo(
    () => columns.slice(1).filter((c) => !c.isActions && c.title && !fieldOf(c.key)?.fixed).map((c) => ({ key: c.key, label: c.title })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the options follow the column keys
    [columnKeys],
  );
  const defaultHidden = React.useMemo(
    () => columns.filter((c) => fieldOf(c.key)?.hiddenByDefault).map((c) => c.key),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the options follow the column keys
    [columnKeys],
  );

  const sort = useListSort(keys.sort, sortOptions);
  const group = useListGroup(keys.group, groupOptions, measures);
  const columnsModel = useColumnVisibility(hrFiltersKey(section, page, companyId, 'hiddenColumns'), optional, defaultHidden);

  // A server-paged list reads everything only while a sort or grouping is on.
  const serverPaged = Boolean(fetchAll);
  const wantsAll = serverPaged && Boolean(sort.sort || group.groupBy);
  const [loaded, setLoaded] = React.useState<{ key: string; rows: T[] } | null>(null);
  const [loadingAll, setLoadingAll] = React.useState(false);
  const fetchAllRef = React.useRef(fetchAll);
  fetchAllRef.current = fetchAll;
  // The filters, or a saved / edited row seen on the server's page, read it all again.
  const rowsKey = serverPaged ? `${resetKey}|${JSON.stringify(rows)}` : resetKey;
  const clearTools = React.useRef(() => {});
  clearTools.current = () => {
    sort.setSort(null);
    group.setGroup(null);
  };
  React.useEffect(() => {
    if (!wantsAll || loaded?.key === rowsKey) return;
    let stale = false;
    setLoadingAll(true);
    void fetchAllRef.current?.()
      .then((all) => {
        if (!stale) setLoaded({ key: rowsKey, rows: all });
      })
      .catch(() => {
        if (stale) return;
        // Back to the server's page: a failure never shows as an empty list.
        clearTools.current();
        toast.error('تعذر تحميل كل الصفوف للترتيب أو التجميع. أعد المحاولة.');
      })
      .finally(() => {
        if (!stale) setLoadingAll(false);
      });
    return () => {
      stale = true;
    };
  }, [wantsAll, rowsKey, loaded?.key]);

  const allRows = React.useMemo<readonly T[]>(
    () => (serverPaged ? (loaded?.key === rowsKey ? loaded.rows : []) : rows),
    [serverPaged, loaded, rowsKey, rows],
  );
  const sorted = React.useMemo(() => {
    const field = sort.sort ? fields[sort.sort.key] : undefined;
    if (!field) return [...allRows];
    const value = field.sort ?? field.text;
    const sign = sort.sort!.dir === 'asc' ? 1 : -1;
    return allRows
      .map((row, index) => ({ row, index, v: value(row) }))
      .sort((a, b) => compare(a.v, b.v) * sign || a.index - b.index)
      .map((x) => x.row);
  }, [allRows, fields, sort.sort]);

  const totalsOf = React.useCallback(
    (list: readonly T[]): ListTotals => {
      const sums: Record<string, number> = {};
      for (const [key, field] of Object.entries(fields)) {
        if (field?.sum) sums[key] = list.reduce((s, r) => s + field.sum!(r), 0);
      }
      return { count: list.length, sums };
    },
    [fields],
  );
  const total = React.useMemo(() => totalsOf(sorted), [sorted, totalsOf]);

  const groupField = group.groupBy ? fields[group.groupBy] : undefined;
  const groupKeyOf = React.useCallback(
    (row: T) => listGroupValue(groupField?.group?.(row) ?? null),
    [groupField],
  );
  const summaries = React.useMemo<ListGroupSummary[]>(() => {
    if (!groupField?.group) return [];
    const byKey = new Map<string, T[]>();
    for (const row of sorted) {
      const key = groupKeyOf(row);
      const list = byKey.get(key);
      if (list) list.push(row);
      else byKey.set(key, [row]);
    }
    return [...byKey.entries()].map(([value, list]) => ({
      key: value === LIST_GROUP_NONE ? null : value,
      label: null,
      ...totalsOf(list),
    }));
  }, [sorted, groupField, groupKeyOf, totalsOf]);

  const grouped = useGroupedList<T>({
    enabled: Boolean(group.groupBy),
    groupBy: group.groupBy,
    resetKey: `${resetKey}|${sort.sortKey}|${sorted.length}`,
    fetchGroups: () => Promise.resolve({ groupBy: group.groupBy, groups: summaries, total }),
    fetchGroupRows: (value, p, limit) => {
      const list = sorted.filter((row) => groupKeyOf(row) === value);
      return Promise.resolve({
        items: list.slice((p - 1) * limit, p * limit),
        pagination: { page: p, limit, total: list.length, totalPages: Math.max(1, Math.ceil(list.length / limit)) },
      });
    },
  });

  // Local pages of a server list while everything is on hand.
  const [localPage, setLocalPage] = React.useState(1);
  // The page size the user already has on the server's pages, until they pick another here.
  const [pickedSize, setPickedSize] = React.useState<number | null>(null);
  const serverSize = React.useRef(30);
  const localSize = pickedSize ?? serverSize.current;
  React.useEffect(() => {
    setLocalPage(1);
  }, [resetKey, sort.sortKey]);
  const localState: PagedState = {
    page: localPage,
    pageSize: localSize,
    total: sorted.length,
    totalPages: Math.max(1, Math.ceil(sorted.length / localSize)),
    setPage: setLocalPage,
    setPageSize: (size) => {
      setPickedSize(size);
      setLocalPage(1);
    },
  };

  const visibleColumns = React.useMemo(
    () =>
      columns
        .filter((c) => !optional.some((o) => o.key === c.key) || columnsModel.isVisible(c.key))
        .map((c) => {
          const field = fields[c.key];
          return {
            ...c,
            sortKey: c.sortKey ?? (field && field.sortable !== false && c.title ? c.key : undefined),
            total: c.total ?? (field?.sum ? (t: ListTotals) => (field.formatSum ?? String)(t.sums[c.key] ?? 0) : undefined),
          };
        }),
    [columns, optional, columnsModel, fields],
  );

  const shownRows = React.useMemo<readonly T[]>(() => {
    if (!serverPaged) return sorted;
    if (!wantsAll) return rows;
    return sorted.slice((localPage - 1) * localSize, localPage * localSize);
  }, [serverPaged, wantsAll, rows, sorted, localPage, localSize]);

  const exportColumns = (): RegisterExportColumn<T>[] =>
    visibleColumns.flatMap((c) => {
      const field = fields[c.key];
      if (!field || c.isActions) return [];
      return [
        {
          label: c.title,
          kind: field.kind ?? (field.sum ? 'number' as const : 'text' as const),
          key: c.key,
          value: field.text,
          total: field.sum ? (t: ListTotals) => (field.formatSum ?? String)(t.sums[c.key] ?? 0) : undefined,
        },
        ...(field.alsoExport ?? []).map((extra, i) => ({
          label: extra.label,
          kind: 'text' as const,
          key: `${c.key}.${i}`,
          value: extra.text,
        })),
      ];
    });

  // The menu is memoized in the page header: it reads the rows of the moment it is opened.
  const latest = React.useRef({ sorted, summaries });
  latest.current = { sorted, summaries };

  /** PDF and Excel of every filtered row, following the screen. */
  const exportMenu = (title: string, fileName: string, subtitleLines: string[] = []) => {
    const cols = exportColumns();
    return (
      <RegisterExportMenu
        title={title}
        fileName={fileName}
        columns={cols}
        subtitleLines={[...subtitleLines, sort.label, group.label].filter((x): x is string => Boolean(x))}
        landscape={cols.length > 6}
        getRows={async () => {
          const list = serverPaged && !wantsAll ? await fetchAllRef.current!() : latest.current.sorted;
          return registerExportRows({
            columns: cols,
            rows: [...list, ...(extraExportRows ?? [])],
            total: totalsOf(list),
            grouping: groupField?.group && group.groupBy
              ? {
                  fieldLabel: columns.find((c) => c.key === group.groupBy)?.title ?? '',
                  groups: group.sortGroups(latest.current.summaries),
                  labelOf: group.labelOf,
                  groupKeyOf: (row) => groupField.group!(row) ?? null,
                }
              : undefined,
          });
        }}
      />
    );
  };

  const buttons = (
    <>
      <ListColumnsPicker model={columnsModel} />
      <ListSortMenu model={sort} />
      {groupOptions.length ? <ListGroupMenu model={group} /> : null}
      {savedViews ? <ListSavedViews storageKey={keys.views} prefixes={keys.prefixes} /> : null}
    </>
  );

  return {
    /** Visible columns, with sort keys and totals: give them to the table. */
    columns: visibleColumns,
    /** The rows to show: pass them where the table reads its rows. */
    rows: shownRows as T[],
    /** Over every filtered row, once they are on hand. */
    totals: serverPaged && !wantsAll ? null : total,
    /** True while every row is being read for a sort or a grouping. */
    loading: wantsAll && (loadingAll || loaded?.key !== rowsKey),
    /** A server list's pagination, replaced by local pages while everything is on hand. */
    pagination: <P extends PagedState>(server: P): P | PagedState => {
      serverSize.current = server.pageSize;
      return wantsAll ? localState : server;
    },
    /** Sort arrows on the table's headers. */
    tableSort: { sort: sort.sort, onSort: sort.toggle },
    /** Columns, sort, grouping and saved views, for the page header. */
    buttons,
    exportMenu,
    sort,
    group,
    grouped,
    /** Stable string for the header's dependencies. */
    depsKey: [sort.sortKey, group.groupKey, columnsModel.hiddenKey, JSON.stringify(group.group?.order ?? null), resetKey, sorted.length].join('|'),
  };
}

export type ListToolsModel<T> = ReturnType<typeof useListTools<T>>;

/** Shows the groups while the list is grouped, else the screen's own table. */
export function ListToolsTable<T>({
  tools,
  keyExtractor,
  onRowClick,
  emptyText,
  children,
}: {
  tools: ListToolsModel<T>;
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyText?: string;
  children: React.ReactNode;
}) {
  if (!tools.group.groupBy) return <>{children}</>;
  return (
    <GroupedDataTable
      columns={tools.columns}
      group={tools.group}
      list={tools.grouped}
      keyExtractor={keyExtractor}
      onRowClick={onRowClick}
      sort={tools.sort.sort}
      onSort={tools.sort.toggle}
      emptyText={emptyText}
    />
  );
}
