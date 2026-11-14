import { QueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/shared/api/client';
import { EMPTY_POS_DATA, PosRuleError, posActions, posDataQueryKey } from '@/features/pos/lib/pos-store';

jest.mock('@/shared/api/client', () => ({ apiRequest: jest.fn() }));

/**
 * The POS client (data on the server since 2026-10-10): the rules themselves
 * are the backend's (test/e2e/pos-data.e2e.ts). Here: actions reach the
 * server one after the other, carry their own ids, update the cached data,
 * and a refusal comes back with the server's reason.
 */
const COMPANY = 'company-1';
const request = apiRequest as jest.MockedFunction<typeof apiRequest>;

function setup() {
  const client = new QueryClient();
  return { client, actions: posActions(COMPANY, client) };
}

afterEach(() => request.mockReset());

describe('posActions', () => {
  it('sends commands in order, even when the first answers late', async () => {
    const order: string[] = [];
    request.mockImplementation(async (_path, options) => {
      const type = (options?.body as { command: { type: string } }).command.type;
      if (type === 'commitSale') await new Promise((r) => setTimeout(r, 20));
      order.push(type);
      return { data: EMPTY_POS_DATA, result: type === 'completeSale' ? 'POS1-000001' : null } as never;
    });
    const { actions } = setup();
    const sale = actions.commitSale({
      registerId: 'r1',
      sessionId: 's1',
      stockSource: 'none',
      customer: { kind: 'walk_in' },
      lines: [],
      orderDiscount: null,
      totals: { subtotal: 0, discount: 0, tax: 0, total: 0 },
    });
    const done = actions.completeSale('sale-1');
    await expect(sale).resolves.toEqual(expect.any(String));
    await expect(done).resolves.toBe('POS1-000001');
    expect(order).toEqual(['commitSale', 'completeSale']);
  });

  it('new records carry an id made here (a retry has one effect on the server)', async () => {
    request.mockResolvedValue({ data: EMPTY_POS_DATA, result: null } as never);
    const { actions } = setup();
    const id = await actions.openSession('r1', 'u1', 'كاشير', 50);
    const body = request.mock.calls[0][1]?.body as { companyId: string; command: Record<string, unknown> };
    expect(body.companyId).toBe(COMPANY);
    expect(body.command).toMatchObject({ type: 'openSession', id, registerId: 'r1', openingFloat: 50 });
  });

  it('the answer replaces the cached data; an action without a result resolves to true', async () => {
    const next = { ...EMPTY_POS_DATA, returnSequence: 7 };
    request.mockResolvedValue({ data: next, result: null } as never);
    const { client, actions } = setup();
    const key = [...posDataQueryKey(COMPANY), 90];
    client.setQueryData(key, EMPTY_POS_DATA);
    await expect(actions.cancelSale('sale-1', 'سبب')).resolves.toBe(true);
    expect(client.getQueryData(key)).toEqual(next);
  });

  it('a refusal rejects with the server reason, and the next command still goes', async () => {
    request
      .mockRejectedValueOnce({ name: 'ApiError', message: 'لهذه النقطة وردية مفتوحة.', status: 400 })
      .mockResolvedValueOnce({ data: EMPTY_POS_DATA, result: null } as never);
    const { actions } = setup();
    const refused = actions.openSession('r1', 'u1', 'كاشير', 0);
    const after = actions.dropHeldCart('h1');
    await expect(refused).rejects.toEqual(new PosRuleError('لهذه النقطة وردية مفتوحة.'));
    await expect(after).resolves.toBe(true);
  });

  it('no connection: a plain reason, not "HTTP 0"', async () => {
    request.mockRejectedValueOnce({ message: 'HTTP 503', status: 503 });
    const { actions } = setup();
    await expect(actions.dropHeldCart('h1')).rejects.toThrow('تعذّر تنفيذ الإجراء الآن، حاول مرة أخرى.');
  });
});
