/**
 * Company domains (2026-11-13): which company a hostname opens, as the
 * server-side page and the proxy ask it.
 */
import {
  normalizeRequestHost,
  resolveStorefrontHost,
} from '@/features/ecommerce/storefront/lib/storefront-host-resolver';

const COMPANY = '11111111-1111-4111-8111-111111111111';

function response(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('normalizeRequestHost', () => {
  it('keeps the hostname only, lower case', () => {
    expect(normalizeRequestHost('Shop.Example.com:443')).toBe('shop.example.com');
    expect(normalizeRequestHost('shop.example.com.')).toBe('shop.example.com');
  });

  it('skips local, IP and empty hosts (no lookup)', () => {
    expect(normalizeRequestHost('localhost:3001')).toBeNull();
    expect(normalizeRequestHost('192.168.1.5:3001')).toBeNull();
    expect(normalizeRequestHost('[::1]:3001')).toBeNull();
    expect(normalizeRequestHost(null)).toBeNull();
  });
});

describe('resolveStorefrontHost', () => {
  const fetchMock = jest.fn();
  beforeAll(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  beforeEach(() => fetchMock.mockReset());

  it('reads the company from the API envelope and keeps it a minute', async () => {
    fetchMock.mockResolvedValue(
      response(200, {
        status: 200,
        data: { kind: 'store', companyId: COMPANY, hostname: 'a1.example.com', primaryHostname: null },
        error: null,
      }),
    );
    const first = await resolveStorefrontHost('A1.example.com');
    const second = await resolveStorefrontHost('a1.example.com:443');
    expect(first?.companyId).toBe(COMPANY);
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/public/domains/resolve?host=a1.example.com');
  });

  it('an unknown hostname is null (the deployment store), remembered too', async () => {
    fetchMock.mockResolvedValue(response(404, { status: 404, data: null }));
    expect(await resolveStorefrontHost('nobody.example.com')).toBeNull();
    expect(await resolveStorefrontHost('nobody.example.com')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a store domain without the storefront keeps companyId null', async () => {
    fetchMock.mockResolvedValue(
      response(200, { data: { kind: 'store', companyId: null, hostname: 'off.example.com', primaryHostname: null } }),
    );
    const resolved = await resolveStorefrontHost('off.example.com');
    expect(resolved).toEqual({ kind: 'store', companyId: null, hostname: 'off.example.com', primaryHostname: null });
  });

  it('an API failure falls back (null) without throwing', async () => {
    fetchMock.mockRejectedValue(new Error('down'));
    expect(await resolveStorefrontHost('down.example.com')).toBeNull();
  });

  it('never asks for local hosts', async () => {
    expect(await resolveStorefrontHost('localhost:3001')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
