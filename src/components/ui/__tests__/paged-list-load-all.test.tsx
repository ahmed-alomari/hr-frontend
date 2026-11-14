import { act, renderHook, waitFor } from '@testing-library/react';
import { useServerDirectoryPagination } from '@/components/ui/paged-list';

const ALL = Array.from({ length: 450 }, (_, i) => ({ id: String(i) }));
const server = (page: number, size: number) =>
  Promise.resolve({ items: ALL.slice((page - 1) * size, page * size), total: ALL.length });

describe('reading every filtered row of a server list', () => {
  it('walks all the pages, and the screen stays on its own page', async () => {
    const loadPage = jest.fn(server);
    const { result } = renderHook(() => useServerDirectoryPagination(loadPage));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const shown = result.current.items;

    let all: { id: string }[] = [];
    await act(async () => {
      all = await result.current.pagination.loadAll();
    });

    expect(all).toHaveLength(450);
    expect(new Set(all.map((r) => r.id)).size).toBe(450);
    expect(result.current.items).toBe(shown);
    expect(result.current.pagination.page).toBe(1);
  });

  it('stops on an empty page when the total was wrong', async () => {
    const loadPage = jest.fn((page: number, size: number) =>
      Promise.resolve({ items: page === 1 ? ALL.slice(0, size) : [], total: 9999 }),
    );
    const { result } = renderHook(() => useServerDirectoryPagination(loadPage));
    await waitFor(() => expect(result.current.loading).toBe(false));
    let all: { id: string }[] = [];
    await act(async () => {
      all = await result.current.pagination.loadAll();
    });
    expect(all).toHaveLength(200);
  });

  it('a list held in the browser reads from its own bulk loader', async () => {
    const loadBulk = jest.fn(() => Promise.resolve({ items: ALL.slice(0, 3), total: 3 }));
    const { result } = renderHook(() =>
      useServerDirectoryPagination(() => Promise.resolve({ items: [], total: 0 }), { bulkMode: true, loadBulk }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    let all: { id: string }[] = [];
    await act(async () => {
      all = await result.current.pagination.loadAll();
    });
    expect(all).toHaveLength(3);
  });

  it('the filter key changes with the filters', async () => {
    const { result, rerender } = renderHook(
      ({ status }: { status: string }) => useServerDirectoryPagination(server, { resetDeps: [status] }),
      { initialProps: { status: 'a' } },
    );
    const first = result.current.pagination.resetKey;
    rerender({ status: 'b' });
    expect(result.current.pagination.resetKey).not.toBe(first);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });
});
