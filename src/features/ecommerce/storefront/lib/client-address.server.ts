import { headers } from 'next/headers';

/**
 * The customer's address for API calls made by a server action (place an
 * order, track one, send a contact message). Without it the API sees only
 * this Next.js server and cannot apply its per-customer rate limits.
 * Traefik writes X-Forwarded-For and drops one sent by the browser; the web
 * container is reachable only through Traefik.
 *
 * Server actions only: reading the request headers in a page render would
 * make cached pages dynamic.
 */
export async function clientAddressHeaders(): Promise<Record<string, string>> {
  try {
    const forwardedFor = (await headers()).get('x-forwarded-for')?.trim();
    return forwardedFor ? { 'X-Forwarded-For': forwardedFor } : {};
  } catch {
    return {};
  }
}
