import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { resolveStorefrontHost } from './features/ecommerce/storefront/lib/storefront-host-resolver';

/**
 * Next.js 16: this file must be `proxy.ts` only — do not add `middleware.ts`.
 *
 * Two jobs:
 *  1. Host split — the storefront owns the bare domain (qutb.tech), the ERP
 *     console lives on `admin.` of that same domain. Both are served by this
 *     one Next app; only the hostname decides which side a visitor sees.
 *  2. Locale routing for the public storefront (next-intl). ERP routes are
 *     never locale-prefixed, so they must not pass through the locale
 *     middleware — it would redirect `/hr` to `/ar/hr` and break the console.
 */
const handleLocale = createMiddleware(routing);

/**
 * Top-level segments the storefront owns. On the public domain these belong to
 * the shop, never to the console — `/login` there means the customer portal.
 * Mirrors the folders under `src/app/[locale]/store/`.
 */
const STOREFRONT_SEGMENTS = new Set([
  'about',
  'account',
  'brands',
  'cart',
  'categories',
  'checkout',
  'contact',
  'faq',
  'forgot-password',
  'legal',
  'login',
  'offers',
  'orders',
  'products',
  'register',
  'search',
  'wholesale',
  'wishlist',
]);

/**
 * Console-only segments. On the public domain these must not resolve and must
 * not bounce the visitor to the console either — a shopper should never be
 * handed an admin screen. They land back on the shop instead.
 */
const CONSOLE_SEGMENTS = new Set([
  'accounting',
  'attributes',
  'cms',
  'catalog',
  'company-apps',
  'contacts',
  'expenses',
  'hr',
  'inventory',
  'overview',
  'point-of-sale',
  'pos',
  'reports',
  'reviews',
  'system',
  'system-owner',
]);

/**
 * Locale prefix the storefront lives under (`/ar`), empty in Arabic-only mode,
 * plus the shop's landing path built from it.
 */
const STORE_ROOT = routing.localePrefix === 'never' ? '' : `/${routing.defaultLocale}`;
const STOREFRONT_HOME = `${STORE_ROOT}/store`;

type HostKind = 'admin' | 'store' | 'both';

function requestHost(request: NextRequest): string {
  return (request.headers.get('host') ?? '').split(':')[0].toLowerCase();
}

/**
 * Hosts that serve the console on their bare name, for a deployment without a
 * storefront domain (`NEXT_PUBLIC_CONSOLE_HOSTS=nazafa.qutb.tech`). Baked at
 * build time like every `NEXT_PUBLIC_*`. Empty on a deployment that sets none.
 */
const CONSOLE_HOSTS = new Set(
  (process.env.NEXT_PUBLIC_CONSOLE_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
);

async function hostKind(host: string): Promise<HostKind> {
  // Local dev, LAN IPs and tunnels: keep every route reachable from one origin,
  // otherwise `npm run dev` on localhost could never open the console.
  if (!host || !host.includes('.') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return 'both';
  if (host.startsWith('admin.') || CONSOLE_HOSTS.has(host)) return 'admin';
  // A console domain added by the platform owner (company domains), e.g.
  // `erp.amarstore.com`. Every other hostname is a store; which company's
  // store is decided by the page itself (storefront-company.server.ts).
  const resolved = await resolveStorefrontHost(host);
  if (resolved?.kind === 'admin') return 'admin';
  return 'store';
}

/** Storefront paths — the only ones next-intl should touch. */
function isStorefrontPath(pathname: string): boolean {
  if (pathname === '/store' || pathname.startsWith('/store/')) return true;
  return routing.locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = requestHost(request);

  if ((await hostKind(host)) === 'store') {
    // The bare domain shows the shop, and keeps showing `qutb.tech` in the
    // address bar — a rewrite, not a redirect.
    if (pathname === '/') {
      const url = request.nextUrl.clone();
      url.pathname = STOREFRONT_HOME;
      return NextResponse.rewrite(url);
    }

    const segment = pathname.split('/')[1] ?? '';

    // `/login`, `/orders`, `/products` … name real shop pages as well as
    // console ones. On the public domain the shop always wins: send the
    // visitor to its own version rather than across to the console.
    //
    // Cloning nextUrl keeps the public host — building from `request.url`
    // picks up the container's internal address behind the proxy.
    if (STOREFRONT_SEGMENTS.has(segment)) {
      const url = request.nextUrl.clone();
      url.pathname = `${STOREFRONT_HOME}${pathname}`;
      return NextResponse.redirect(url, 307);
    }

    // Console-only paths simply do not exist out here. Returning the shop home
    // keeps the console unreachable and unadvertised from the public domain.
    if (CONSOLE_SEGMENTS.has(segment)) {
      const url = request.nextUrl.clone();
      url.pathname = STOREFRONT_HOME;
      url.search = '';
      return NextResponse.redirect(url, 307);
    }
  }

  return isStorefrontPath(pathname) ? handleLocale(request) : NextResponse.next();
}

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
