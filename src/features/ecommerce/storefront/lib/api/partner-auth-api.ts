import { getStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import {
  PartnerAuthApiError,
  type PartnerAuthSessionPayload,
  type PartnerLoginInput,
  type PartnerMePayload,
  type PartnerRegisterInput,
  type PartnerUpdateProfileInput,
} from '@/features/ecommerce/storefront/domain/partner-auth';
import { resolveApiBaseUrl } from '@/shared/api-base-url';
import { publicConfig } from '@/shared/config';
import { unwrapApiEnvelope } from '@/features/ecommerce/storefront/lib/api/store-http';

/**
 * Public Partner Auth — HTTP only.
 * Base: `/public/partners/auth` (typ=partner) — separate from staff `/auth/login`.
 */

function apiBaseUrl(): string {
  return resolveApiBaseUrl(publicConfig.apiUrl).replace(/\/$/, '');
}

async function parseError(response: Response): Promise<PartnerAuthApiError> {
  let message = 'Request failed';
  let code: string | undefined;
  try {
    const body = (await response.json()) as {
      message?: string | string[];
      code?: string;
      error?: { message?: string; code?: string; statusCode?: number };
    };
    if (Array.isArray(body.message)) message = body.message.join(' · ');
    else if (typeof body.message === 'string' && body.message.trim()) message = body.message;
    else if (typeof body.error?.message === 'string') message = body.error.message;
    code = body.code ?? body.error?.code;
  } catch {
    /* ignore */
  }
  return new PartnerAuthApiError(message, response.status, code);
}

async function partnerAuthFetch<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (init.token) {
    headers.set('Authorization', `Bearer ${init.token}`);
  }

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;

  const payload = (await response.json()) as unknown;
  const data = unwrapApiEnvelope<T>(payload);
  if (data == null) {
    throw new PartnerAuthApiError('Empty partner auth response', response.status);
  }
  return data;
}

type PartnerSessionApiDto = {
  access_token: string;
  userId: string;
  partnerId: string;
  companyId: string;
  user: PartnerAuthSessionPayload['user'];
  partner: PartnerAuthSessionPayload['partner'] & { companyId?: string; accountKind?: string };
  message?: string | null;
  deviceToken?: string | null;
};

type PartnerMeApiDto = {
  userId: string;
  partnerId: string;
  companyId: string;
  email?: string | null;
  phone?: string | null;
  fullNameAr?: string | null;
  userType?: string | null;
  partnerName?: string | null;
  displayName?: string | null;
  partnerStatus?: string | null;
  isCustomer?: boolean;
  isVendor?: boolean;
  partnerEmail?: string | null;
  partnerMobile?: string | null;
};

function mapSessionPayload(dto: PartnerSessionApiDto): PartnerAuthSessionPayload {
  return {
    access_token: dto.access_token,
    userId: dto.userId,
    partnerId: dto.partnerId,
    companyId: dto.companyId,
    user: {
      id: dto.user.id,
      email: dto.user.email ?? '',
      phone: dto.user.phone ?? '',
      fullNameAr: dto.user.fullNameAr ?? '',
      userType: dto.user.userType ?? 'external_customer',
    },
    partner: {
      id: dto.partner.id,
      companyId: dto.partner.companyId ?? dto.companyId,
      name: dto.partner.name ?? '',
      displayName: dto.partner.displayName ?? dto.partner.name ?? '',
      isCustomer: dto.partner.isCustomer ?? true,
      isVendor: dto.partner.isVendor ?? false,
      email: dto.partner.email ?? '',
      mobile: dto.partner.mobile ?? '',
      accountKind: dto.partner.accountKind as PartnerAuthSessionPayload['partner']['accountKind'],
    },
    message: dto.message ?? undefined,
    deviceToken: dto.deviceToken ?? null,
  };
}

function mapMePayload(dto: PartnerMeApiDto): PartnerMePayload {
  return {
    userId: dto.userId,
    partnerId: dto.partnerId,
    companyId: dto.companyId,
    user: {
      id: dto.userId,
      email: dto.email ?? '',
      phone: dto.phone ?? '',
      fullNameAr: dto.fullNameAr ?? dto.displayName ?? dto.partnerName ?? '',
      userType: dto.userType ?? 'external_customer',
    },
    partner: {
      id: dto.partnerId,
      companyId: dto.companyId,
      name: dto.partnerName ?? dto.displayName ?? '',
      displayName: dto.displayName ?? dto.partnerName ?? '',
      isCustomer: dto.isCustomer ?? true,
      isVendor: dto.isVendor ?? false,
      email: dto.partnerEmail ?? dto.email ?? '',
      mobile: dto.partnerMobile ?? dto.phone ?? '',
    },
    partnerStatus: dto.partnerStatus ?? undefined,
  };
}

/** POST /public/partners/auth/register → 201 */
export async function registerPartner(
  input: PartnerRegisterInput,
): Promise<PartnerAuthSessionPayload> {
  const dto = await partnerAuthFetch<PartnerSessionApiDto>('/public/partners/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      companyId: input.companyId || getStorefrontCompanyId(),
      name: input.name.trim(),
      email: input.email?.trim().toLowerCase() || null,
      mobile: input.mobile?.trim() || null,
      password: input.password,
      accountKind: input.accountKind ?? 'customer',
      branchId: input.branchId ?? null,
    }),
  });
  return mapSessionPayload(dto);
}

/** POST /public/partners/auth/login → 200 */
export async function loginPartner(input: PartnerLoginInput): Promise<PartnerAuthSessionPayload> {
  const dto = await partnerAuthFetch<PartnerSessionApiDto>('/public/partners/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      identifier: input.identifier.trim(),
      password: input.password,
      companyId: input.companyId || getStorefrontCompanyId(),
    }),
  });
  return mapSessionPayload(dto);
}

/** POST /public/partners/auth/device-login → 200 (trusted device, no password) */
export async function deviceLoginPartner(input: {
  mobile: string;
  deviceToken: string;
}): Promise<PartnerAuthSessionPayload> {
  const dto = await partnerAuthFetch<PartnerSessionApiDto>('/public/partners/auth/device-login', {
    method: 'POST',
    body: JSON.stringify({
      companyId: getStorefrontCompanyId(),
      mobile: input.mobile,
      deviceToken: input.deviceToken,
    }),
  });
  return mapSessionPayload(dto);
}

/** GET /public/partners/auth/me — Bearer typ=partner */
export async function getPartnerMe(token: string): Promise<PartnerMePayload> {
  if (!token) throw new PartnerAuthApiError('PARTNER_TOKEN_REQUIRED', 401);
  const dto = await partnerAuthFetch<PartnerMeApiDto>('/public/partners/auth/me', {
    method: 'GET',
    token,
  });
  return mapMePayload(dto);
}

/** PATCH /public/partners/auth/profile — Bearer typ=partner */
export async function updatePartnerProfile(
  token: string,
  input: PartnerUpdateProfileInput,
): Promise<PartnerAuthSessionPayload> {
  if (!token) throw new PartnerAuthApiError('PARTNER_TOKEN_REQUIRED', 401);
  const dto = await partnerAuthFetch<PartnerSessionApiDto>('/public/partners/auth/profile', {
    method: 'PATCH',
    token,
    body: JSON.stringify({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase() || null,
      mobile: input.mobile.trim() || null,
    }),
  });
  return mapSessionPayload(dto);
}

/** POST /public/partners/auth/forgot-password — same answer with or without an account. */
export async function requestPartnerPasswordReset(email: string): Promise<{ message: string }> {
  return partnerAuthFetch<{ message: string }>('/public/partners/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ companyId: getStorefrontCompanyId(), email: email.trim().toLowerCase() }),
  });
}

/** POST /public/partners/auth/reset-password — the emailed link's token, once. */
export async function resetPartnerPassword(token: string, password: string): Promise<{ message: string }> {
  return partnerAuthFetch<{ message: string }>('/public/partners/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ companyId: getStorefrontCompanyId(), token: token.trim(), password }),
  });
}

/** POST /public/partners/auth/logout — invalidates tokenVersion */
export async function logoutPartner(token: string): Promise<{ success: boolean; message: string }> {
  if (!token) throw new PartnerAuthApiError('PARTNER_TOKEN_REQUIRED', 401);
  return partnerAuthFetch<{ success: boolean; message: string }>('/public/partners/auth/logout', {
    method: 'POST',
    token,
  });
}
