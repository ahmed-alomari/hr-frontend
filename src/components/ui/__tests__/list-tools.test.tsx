import { act, renderHook, waitFor } from '@testing-library/react';
import type { ColumnDef } from '@/components/ui/data-table';
import { useListTools, type ListToolField } from '@/components/ui/list-tools';
import { useAuthStore } from '@/features/auth/lib/auth-store';

type Row = { id: string; name: string; status: string; amount: number };

const columns: ColumnDef<Row>[] = [
  { key: 'name', title: 'الاسم', render: (r) => r.name },
  { key: 'status', title: 'الحالة', render: (r) => r.status },
  { key: 'amount', title: 'المبلغ', render: (r) => String(r.amount) },
  { key: 'actions', title: 'إجراءات', isActions: true, render: () => null },
];
const fields: Partial<Record<string, ListToolField<Row>>> = {
  name: { text: (r) => r.name },
  status: { text: (r) => r.status, group: (r) => r.status },
  amount: { text: (r) => String(r.amount), sort: (r) => r.amount, sum: (r) => r.amount },
};
const row = (id: string, name: string, status: string, amount: number): Row => ({ id, name, status, amount });
const ALL = [row('1', 'ج', 'open', 30), row('2', 'أ', 'closed', 5), row('3', 'ب', 'open', 100)];

let counter = 0;
const pageKey = () => `test-${(counter += 1)}`;

beforeEach(() => {
  window.localStorage.clear();
  useAuthStore.setState({ activeCompanyId: 'company-1' } as never);
});

describe('a list with all its rows in the browser', () => {
  const setup = () => {
    const page = pageKey();
    return renderHook(() => useListTools<Row>({ section: 's', page, columns, fields, rows: ALL }));
  };

  it('offers only columns that can sort, group or hide, and never the actions', () => {
    const { result } = setup();
    expect(result.current.sort.options.map((o) => o.key)).toEqual(['name', 'status', 'amount']);
    expect(result.current.group.options.map((o) => o.key)).toEqual(['status']);
    expect(result.current.columns.at(-1)?.key).toBe('actions');
  });

  it('sorts numbers as numbers, both ways, and back to the original order', () => {
    const { result } = setup();
    expect(result.current.rows.map((r) => r.id)).toEqual(['1', '2', '3']);
    act(() => result.current.sort.toggle('amount'));
    expect(result.current.rows.map((r) => r.amount)).toEqual([5, 30, 100]);
    act(() => result.current.sort.toggle('amount'));
    expect(result.current.rows.map((r) => r.amount)).toEqual([100, 30, 5]);
    act(() => result.current.sort.toggle('amount'));
    expect(result.current.rows.map((r) => r.id)).toEqual(['1', '2', '3']);
  });

  it('hiding a column takes it off the table', () => {
    const { result } = setup();
    expect(result.current.columns.map((c) => c.key)).toContain('status');
    const hide = () => {
      const picker = result.current.buttons.props.children[0].props.model;
      picker.toggle('status');
    };
    act(hide);
    expect(result.current.columns.map((c) => c.key)).not.toContain('status');
    expect(result.current.columns[0].key).toBe('name');
  });

  it('groups count and sum every row, and a group opens with its own rows', async () => {
    const { result } = setup();
    act(() => result.current.group.setGroupBy('status'));
    await waitFor(() => expect(result.current.grouped.summary?.groups.length).toBe(2));
    const open = result.current.grouped.summary!.groups.find((g) => g.key === 'open')!;
    expect(open.count).toBe(2);
    expect(open.sums.amount).toBe(130);
    expect(result.current.grouped.summary!.total.sums.amount).toBe(135);
    act(() => result.current.grouped.toggle('open'));
    await waitFor(() => expect(result.current.grouped.rows.open?.items.length).toBe(2));
  });

  it('totals cover every row', () => {
    const { result } = setup();
    expect(result.current.totals?.count).toBe(3);
    expect(result.current.totals?.sums.amount).toBe(135);
  });
});

describe('a list the server pages', () => {
  const serverPage = { page: 1, pageSize: 2, total: 3, totalPages: 2, setPage: jest.fn(), setPageSize: jest.fn() };
  const setup = (fetchAll = jest.fn(() => Promise.resolve(ALL)), resetKey = 'a') => {
    const page = pageKey();
    const hook = renderHook(
      (props: { resetKey: string }) =>
        useListTools<Row>({ section: 's', page, columns, fields, rows: ALL.slice(0, 2), fetchAll, resetKey: props.resetKey }),
      { initialProps: { resetKey } },
    );
    return { ...hook, fetchAll };
  };

  it('stays on the server page and reads nothing more until asked', () => {
    const { result, fetchAll } = setup();
    expect(fetchAll).not.toHaveBeenCalled();
    expect(result.current.rows.map((r) => r.id)).toEqual(['1', '2']);
    expect(result.current.pagination(serverPage)).toBe(serverPage);
    expect(result.current.totals).toBeNull();
  });

  it('a sort reads every row and orders them all, not just the page', async () => {
    const { result, fetchAll } = setup();
    act(() => result.current.sort.toggle('amount'));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchAll).toHaveBeenCalledTimes(1);
    expect(result.current.rows.map((r) => r.amount)).toEqual([5, 30, 100]);
    expect(result.current.pagination(serverPage).total).toBe(3);
    expect(result.current.totals?.sums.amount).toBe(135);
  });

  it('changing a filter reads again; the same filter does not', async () => {
    const { result, fetchAll, rerender } = setup();
    act(() => result.current.sort.toggle('amount'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.sort.toggle('amount'));
    expect(fetchAll).toHaveBeenCalledTimes(1);
    rerender({ resetKey: 'b' });
    await waitFor(() => expect(fetchAll).toHaveBeenCalledTimes(2));
  });

  it('local pages cut the whole list once it is on hand', async () => {
    const many = Array.from({ length: 65 }, (_, i) => row(String(i), `n${i}`, 'open', i));
    const { result } = setup(jest.fn(() => Promise.resolve(many)));
    act(() => result.current.sort.toggle('amount'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows.length).toBe(30);
    const paged = result.current.pagination({ ...serverPage, pageSize: 30 });
    expect(paged.total).toBe(65);
    expect(paged.totalPages).toBe(3);
    act(() => paged.setPage(3));
    expect(result.current.rows.length).toBe(5);
    expect(result.current.rows[0].amount).toBe(60);
  });

  it('local pages keep the page size the user had on the server pages', async () => {
    const many = Array.from({ length: 65 }, (_, i) => row(String(i), `n${i}`, 'open', i));
    const fetchAll = jest.fn(() => Promise.resolve(many));
    const page = pageKey();
    const { result } = renderHook(() => {
      const tools = useListTools<Row>({ section: 's', page, columns, fields, rows: many.slice(0, 50), fetchAll, resetKey: 'a' });
      return { tools, paged: tools.pagination({ ...serverPage, pageSize: 50 }) };
    });
    act(() => result.current.tools.sort.toggle('amount'));
    await waitFor(() => expect(result.current.tools.loading).toBe(false));
    await waitFor(() => expect(result.current.tools.rows.length).toBe(50));
    expect(result.current.paged.pageSize).toBe(50);
    expect(result.current.paged.totalPages).toBe(2);
    act(() => result.current.paged.setPageSize(10));
    expect(result.current.tools.rows.length).toBe(10);
    expect(result.current.paged.totalPages).toBe(7);
  });

  it('a failed read goes back to the server page, never to an empty list', async () => {
    const { result } = setup(jest.fn(() => Promise.reject(new Error('down'))));
    act(() => result.current.sort.toggle('amount'));
    await waitFor(() => expect(result.current.sort.sort).toBeNull());
    expect(result.current.rows.map((r) => r.id)).toEqual(['1', '2']);
  });

  it('a row edited on the server page reads everything again', async () => {
    const fetchAll = jest.fn(() => Promise.resolve(ALL));
    const page = pageKey();
    const { result, rerender } = renderHook(
      (props: { rows: Row[] }) => useListTools<Row>({ section: 's', page, columns, fields, rows: props.rows, fetchAll, resetKey: 'a' }),
      { initialProps: { rows: ALL.slice(0, 2) } },
    );
    act(() => result.current.sort.toggle('amount'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchAll).toHaveBeenCalledTimes(1);
    rerender({ rows: [row('1', 'ج', 'closed', 30), ALL[1]] });
    await waitFor(() => expect(fetchAll).toHaveBeenCalledTimes(2));
  });
});
