import { resolveApiBaseUrl } from '@/shared/api-base-url';

/**
 * Which company a hostname opens (company domains, 2026-11-13). Server only:
 * the proxy and server components call it; the browser never does.
 *
 * Answers are kept in memory (a minute, unknown hostnames half a minute) so
 * a page view does not ask the API every time. A domain added or disabled
 * by the platform owner shows within that delay.
 */
export type ResolvedStorefrontHost = {
  kind: 'store' | 'admin';
  /** Store domains: the company, or null when its storefront is not enabled. */
  companyId: string | null;
  hostname: string;
  primaryHostname: string | null;
};

const FOUND_TTL_MS = 60_000;
const UNKNOWN_TTL_MS = 30_000;
const ERROR_TTL_MS = 5_000;
const MAX_ENTRIES = 5_000;

const cache = new Map<string, { at: number; ttl: number; value: ResolvedStorefrontHost | null }>();

/** `Shop.Example.com:443` → `shop.example.com`; null for local and IP hosts. */
export function normalizeRequestHost(host: string | null | undefined): string | null {
  const value = (host ?? '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
  if (!value || !value.includes('.')) return null;
  if (/^\d+(\.\d+){3}$/.test(value) || value.startsWith('[')) return null;
  return value;
}

function remember(host: string, value: ResolvedStorefrontHost | null, ttl: number) {
  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(host, { at: Date.now(), ttl, value });
}

export async function resolveStorefrontHost(
  rawHost: string | null | undefined,
): Promise<ResolvedStorefrontHost | null> {
  const host = normalizeRequestHost(rawHost);
  if (!host) return null;

  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value;

  try {
    const res = await fetch(
      `${resolveApiBaseUrl()}/public/domains/resolve?host=${encodeURIComponent(host)}`,
      { cache: 'no-store', signal: AbortSignal.timeout(2500) },
    );
    if (res.status === 404) {
      remember(host, null, UNKNOWN_TTL_MS);
      return null;
    }
    if (!res.ok) {
      remember(host, null, ERROR_TTL_MS);
      return null;
    }
    const payload = (await res.json()) as { data?: ResolvedStorefrontHost } | ResolvedStorefrontHost;
    const value =
      payload && typeof payload === 'object' && 'data' in payload && payload.data
        ? payload.data
        : (payload as ResolvedStorefrontHost);
    if (value?.kind !== 'store' && value?.kind !== 'admin') {
      remember(host, null, ERROR_TTL_MS);
      return null;
    }
    remember(host, value, FOUND_TTL_MS);
    return value;
  } catch {
    // API down or slow: behave as before domains existed, retry soon.
    remember(host, null, ERROR_TTL_MS);
    return null;
  }
}
