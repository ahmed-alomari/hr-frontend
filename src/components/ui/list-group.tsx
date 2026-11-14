'use client';

import { FoldedHeaderTool } from '@/components/layouts/phone-fold';
import * as React from 'react';
import { ArrowDown, ArrowUp, Check, Layers, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { SortDir } from '@/components/ui/list-sort';
import type { PaginatedResult } from '@/features/hr/lib/api/client';
import { useLatestCallback } from '@/shared/hooks/use-latest-callback';
import { cn } from '@/shared/utils';
import { usePersistedStateRestore } from '@/shared/hooks/use-persisted-state-restore';

/** `groupValue` of the group of rows with no value (no branch, no department…). */
export const LIST_GROUP_NONE = '__none__';

/** Counts and sums of a list's filtered rows (the server's `/groups`). */
export type ListTotals = { count: number; sums: Record<string, number> };

export type ListGroupSummary = ListTotals & {
  /** The group's key (`groupValue` of its rows); null for rows with no value. */
  key: string | null;
  /** The server's name for the group (employee, branch…), if it has one. */
  label: string | null;
};

export type ListGroupsResult = {
  groupBy: string | null;
  groups: ListGroupSummary[];
  /** Over every filtered row, not only the visible page. */
  total: ListTotals;
};

/** A field the list can be grouped by — `key` is the server's `groupBy` value. */
export type ListGroupOption = {
  key: string;
  label: string;
  /** The group's name when the server sends none (status labels, dates…). */
  formatKey?: (key: string) => string;
  /** The name of the group of rows with no value. */
  emptyLabel?: string;
  /** Order groups by their key rather than their name (dates). */
  orderByKey?: boolean;
};

/** A sum groups can be ordered by (e.g. late minutes). */
export type ListGroupMeasure = { key: string; label: string };

/** How groups are ordered: by name, by row count, or by one of the sums. */
export type ListGroupOrder = { by: 'name' | 'count' | `sum:${string}`; dir: SortDir };

export type ListGroupState = { by: string; order: ListGroupOrder } | null;

const DEFAULT_ORDER: ListGroupOrder = { by: 'name', dir: 'asc' };
const DIR_LABEL: Record<SortDir, string> = { asc: 'تصاعدي', desc: 'تنازلي' };

/** `groupValue` of a group (its key, or `__none__`). */
export function listGroupValue(key: string | null): string {
  return key ?? LIST_GROUP_NONE;
}

/** A group's display name. */
export function listGroupLabel(option: ListGroupOption | undefined, group: ListGroupSummary): string {
  if (group.key == null) return option?.emptyLabel ?? 'غير محدد';
  if (group.label?.trim()) return group.label.trim();
  return option?.formatKey?.(group.key) ?? group.key;
}

/** Groups in the chosen order; the group with no value always comes last. */
export function sortListGroups(
  groups: readonly ListGroupSummary[],
  order: ListGroupOrder,
  option: ListGroupOption | undefined,
): ListGroupSummary[] {
  const sign = order.dir === 'asc' ? 1 : -1;
  const name = (g: ListGroupSummary) => (option?.orderByKey ? g.key ?? '' : listGroupLabel(option, g));
  return [...groups].sort((a, b) => {
    if (a.key == null || b.key == null) return a.key == null ? (b.key == null ? 0 : 1) : -1;
    let diff = 0;
    if (order.by === 'count') diff = a.count - b.count;
    else if (order.by.startsWith('sum:')) {
      const m = order.by.slice(4);
      diff = (a.sums[m] ?? 0) - (b.sums[m] ?? 0);
    }
    if (diff === 0) diff = name(a).localeCompare(name(b), 'ar');
    return diff * sign;
  });
}

function readGroup(storageKey: string | null, options: readonly ListGroupOption[]): ListGroupState {
  if (!storageKey || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { by?: unknown; order?: { by?: unknown; dir?: unknown } } | null;
    if (!parsed || typeof parsed.by !== 'string' || !options.some((o) => o.key === parsed.by)) return null;
    const order = parsed.order;
    return {
      by: parsed.by,
      order:
        order
        && typeof order.by === 'string'
        && (order.by === 'name' || order.by === 'count' || order.by.startsWith('sum:'))
        && (order.dir === 'asc' || order.dir === 'desc')
          ? { by: order.by as ListGroupOrder['by'], dir: order.dir }
          : DEFAULT_ORDER,
    };
  } catch {
    return null;
  }
}

function writeGroup(storageKey: string | null, group: ListGroupState): void {
  if (!storageKey || typeof window === 'undefined') return;
  try {
    if (group) window.localStorage.setItem(storageKey, JSON.stringify(group));
    else window.localStorage.removeItem(storageKey);
  } catch {
    // ignore quota / private mode errors
  }
}

/**
 * A list's grouping (like its sort order): the field rows are grouped by and
 * the order of the groups, kept per user and screen. The server groups every
 * filtered row (not only the page), so the counts, subtotals and the export
 * cover the whole list.
 */
export function useListGroup(
  storageKey: string | null,
  options: readonly ListGroupOption[],
  measures: readonly ListGroupMeasure[] = [],
) {
  const optionsRef = React.useRef(options);
  optionsRef.current = options;

  const [group, setGroupState] = React.useState<ListGroupState>(() => readGroup(storageKey, options));

  React.useEffect(() => {
    setGroupState(readGroup(storageKey, optionsRef.current));
  }, [storageKey]);

  usePersistedStateRestore(() => setGroupState(readGroup(storageKey, optionsRef.current)));

  const setGroup = React.useCallback((next: ListGroupState) => {
    setGroupState(next);
    writeGroup(storageKey, next);
  }, [storageKey]);

  const setGroupBy = React.useCallback((by: string | null) => {
    setGroupState((prev) => {
      const next: ListGroupState = by ? { by, order: prev?.order ?? DEFAULT_ORDER } : null;
      writeGroup(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const setOrder = React.useCallback((order: ListGroupOrder) => {
    setGroupState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, order };
      writeGroup(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const option = group ? options.find((o) => o.key === group.by) : undefined;
  const orderLabel = (order: ListGroupOrder): string => {
    const by = order.by === 'name'
      ? 'الاسم'
      : order.by === 'count'
        ? 'عدد السجلات'
        : measures.find((m) => `sum:${m.key}` === order.by)?.label ?? order.by;
    return `${by} — ${DIR_LABEL[order.dir]}`;
  };

  return {
    group,
    groupBy: group?.by ?? null,
    option,
    setGroup,
    setGroupBy,
    setOrder,
    options,
    measures,
    /** Stable string for memo / effect deps (field only — the order is applied on the client). */
    groupKey: group?.by ?? '',
    /** «التجميع: الموظف (ترتيب المجموعات: …)», for printed registers; null when not grouped. */
    label: group && option
      ? `التجميع حسب: ${option.label} — ترتيب المجموعات: ${orderLabel(group.order)}`
      : null,
    /** The groups in the chosen order. */
    sortGroups: (groups: readonly ListGroupSummary[]) =>
      sortListGroups(groups, group?.order ?? DEFAULT_ORDER, option),
    /** A group's display name. */
    labelOf: (g: ListGroupSummary) => listGroupLabel(option, g),
  };
}

export type ListGroupModel = ReturnType<typeof useListGroup>;

/** `groupBy` for the list API (nothing when not grouped). */
export function listGroupQuery(groupBy: string | null): { groupBy?: string } {
  return groupBy ? { groupBy } : {};
}

/**
 * «تجميع» button for the page header: the fields to group by, how the groups
 * are ordered (name, row count, a total), and a reset.
 */
export function ListGroupMenu({ model }: { model: ListGroupModel }) {
  const { group, options, measures, setGroupBy, setOrder } = model;
  if (options.length === 0) return null;

  const orderItems: { by: ListGroupOrder['by']; label: string }[] = [
    { by: 'name', label: 'الاسم' },
    { by: 'count', label: 'عدد السجلات' },
    ...measures.map((m) => ({ by: `sum:${m.key}` as const, label: m.label })),
  ];

  return (
    <FoldedHeaderTool>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn('relative h-8 w-8 shrink-0', group && 'border-primary/40 text-primary')}
            aria-label={model.label ?? 'تجميع'}
            title={model.label ?? 'تجميع'}
          >
            <Layers className="h-4 w-4" />
            {group ? <span className="absolute -top-1 -end-1 h-2 w-2 rounded-full bg-primary" /> : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-[70vh] w-60 overflow-y-auto">
          <DropdownMenuLabel className="text-xs">تجميع حسب</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setGroupBy(null)} className="justify-between text-sm">
            بدون تجميع
            {!group ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
          </DropdownMenuItem>
          {options.map((o) => (
            <DropdownMenuItem
              key={o.key}
              onSelect={() => setGroupBy(o.key)}
              className={cn('justify-between text-sm', group?.by === o.key && 'font-semibold text-primary')}
            >
              {o.label}
              {group?.by === o.key ? <Check className="h-3.5 w-3.5" /> : null}
            </DropdownMenuItem>
          ))}
          {group ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs">ترتيب المجموعات</DropdownMenuLabel>
              {orderItems.map((item) => (
                <div key={item.by} className="flex items-center justify-between gap-1 px-2 py-1">
                  <span className={cn('truncate text-sm', group.order.by === item.by && 'font-semibold text-primary')}>
                    {item.label}
                  </span>
                  <div className="flex shrink-0 gap-0.5">
                    {(['asc', 'desc'] as const).map((dir) => {
                      const selected = group.order.by === item.by && group.order.dir === dir;
                      return (
                        <DropdownMenuItem
                          key={dir}
                          onSelect={(e) => {
                            e.preventDefault();
                            setOrder({ by: item.by, dir });
                          }}
                          className={cn('h-7 gap-1 rounded-md px-1.5 text-[11px]', selected && 'bg-primary/10 text-primary')}
                        >
                          {dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                          {DIR_LABEL[dir]}
                        </DropdownMenuItem>
                      );
                    })}
                  </div>
                </div>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setGroupBy(null)} className="gap-2 text-xs">
                <RotateCcw className="h-3.5 w-3.5" />
                إلغاء التجميع
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </FoldedHeaderTool>
  );
}

/* ── Group fields over dates ─────────────────────────────────────────── */

const MONTH_FORMAT = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { month: 'long', year: 'numeric' });

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Day / week (Sunday to Saturday) / month group fields, labelled like the server keys them. */
export function dateListGroupOptions(prefix = ''): ListGroupOption[] {
  return [
    { key: 'day', label: `${prefix}اليوم`, orderByKey: true, formatKey: (k) => k },
    {
      key: 'week',
      label: `${prefix}الأسبوع`,
      orderByKey: true,
      formatKey: (k) => `أسبوع ${k} — ${addDays(k, 6)}`,
    },
    {
      key: 'month',
      label: `${prefix}الشهر`,
      orderByKey: true,
      formatKey: (k) => {
        const d = new Date(`${k}-01T00:00:00Z`);
        return Number.isNaN(d.getTime()) ? k : MONTH_FORMAT.format(d);
      },
    },
  ];
}

/** Branch / department / job title of the employee's primary assignment. */
export const ORG_LIST_GROUP_OPTIONS: ListGroupOption[] = [
  { key: 'branch', label: 'الفرع', emptyLabel: 'بدون فرع' },
  { key: 'department', label: 'القسم', emptyLabel: 'بدون قسم' },
  { key: 'jobTitle', label: 'المسمى الوظيفي', emptyLabel: 'بدون مسمى' },
];

/* ── Loading a grouped list ──────────────────────────────────────────── */

export type ListGroupRowsState<T> = { items: T[]; total: number; page: number; loading: boolean };

type UseGroupedListParams<T> = {
  /** False while the list cannot load (no company, invalid period…). */
  enabled: boolean;
  groupBy: string | null;
  /** Changes whenever the filters or the row order change (reloads everything). */
  resetKey: string;
  /** The list's `/groups` for the current filters and `groupBy`. */
  fetchGroups: () => Promise<ListGroupsResult>;
  /** One page of a group's rows (the list with `groupBy` + `groupValue`). */
  fetchGroupRows: (groupValue: string, page: number, limit: number) => Promise<PaginatedResult<T>>;
  pageSize?: number;
};

/**
 * The groups of a list (counts, subtotals, grand total over every filtered
 * row) and the rows of the groups the user opens, a page at a time. Without
 * `groupBy` it loads only the grand total (for the list's totals row).
 */
export function useGroupedList<T>({
  enabled,
  groupBy,
  resetKey,
  fetchGroups,
  fetchGroupRows,
  pageSize = 50,
}: UseGroupedListParams<T>) {
  const [summary, setSummary] = React.useState<ListGroupsResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
  const [rows, setRows] = React.useState<Record<string, ListGroupRowsState<T>>>({});
  const generation = React.useRef(0);
  const getGroups = useLatestCallback(fetchGroups);
  const getRows = useLatestCallback(fetchGroupRows);

  const loadRows = React.useCallback(async (value: string, page: number) => {
    const gen = generation.current;
    setRows((prev) => ({
      ...prev,
      [value]: { items: prev[value]?.items ?? [], total: prev[value]?.total ?? 0, page, loading: true },
    }));
    try {
      const res = await getRows(value, page, pageSize);
      if (gen !== generation.current) return;
      setRows((prev) => ({
        ...prev,
        [value]: {
          items: page === 1 ? res.items : [...(prev[value]?.items ?? []), ...res.items],
          total: res.pagination.total,
          page,
          loading: false,
        },
      }));
    } catch {
      if (gen !== generation.current) return;
      setRows((prev) => ({ ...prev, [value]: { ...(prev[value] ?? { items: [], total: 0, page }), loading: false } }));
    }
  }, [getRows, pageSize]);

  const expandedRef = React.useRef(expanded);
  expandedRef.current = expanded;

  const reload = React.useCallback(async (keepOpen = true) => {
    generation.current += 1;
    const gen = generation.current;
    if (!enabled) {
      setSummary(null);
      setRows({});
      return;
    }
    setLoading(true);
    setRows({});
    if (!keepOpen) setExpanded(new Set());
    try {
      const res = await getGroups();
      if (gen !== generation.current) return;
      setSummary(res);
      if (keepOpen && groupBy) {
        const present = new Set(res.groups.map((g) => listGroupValue(g.key)));
        const open = [...expandedRef.current].filter((v) => present.has(v));
        setExpanded(new Set(open));
        open.forEach((v) => void loadRows(v, 1));
      }
    } catch {
      if (gen === generation.current) setSummary(null);
    } finally {
      if (gen === generation.current) setLoading(false);
    }
  }, [enabled, getGroups, groupBy, loadRows]);

  // Filters, row order or the field changed: reload, keeping open the groups
  // that still exist (their rows reload in the new order).
  React.useEffect(() => {
    void reload(true);
  }, [reload, resetKey, groupBy]);

  const toggle = React.useCallback((value: string) => {
    const next = new Set(expandedRef.current);
    if (next.has(value)) next.delete(value);
    else {
      next.add(value);
      void loadRows(value, 1);
    }
    setExpanded(next);
  }, [loadRows]);

  const expandAll = React.useCallback(() => {
    const values = (summary?.groups ?? []).map((g) => listGroupValue(g.key));
    setExpanded(new Set(values));
    values.filter((v) => !rows[v]).forEach((v) => void loadRows(v, 1));
  }, [loadRows, rows, summary]);

  const collapseAll = React.useCallback(() => setExpanded(new Set()), []);

  const loadMore = React.useCallback((value: string) => {
    const state = rows[value];
    if (!state || state.loading || state.items.length >= state.total) return;
    void loadRows(value, state.page + 1);
  }, [loadRows, rows]);

  return {
    summary,
    loading,
    expanded,
    rows,
    toggle,
    expandAll,
    collapseAll,
    loadMore,
    reload: () => reload(true),
  };
}

export type GroupedListModel<T> = ReturnType<typeof useGroupedList<T>>;
