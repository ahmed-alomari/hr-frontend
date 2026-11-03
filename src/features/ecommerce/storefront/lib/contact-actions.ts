'use server';

import {
  submitPublicContactMessage,
  type StoreContactMessageType,
} from '@/features/ecommerce/shared/lib/api/store-content-api';
import { isStoreHttpEnabled } from '@/features/ecommerce/storefront/lib/api/store-http';
import { getPublicStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';

export async function submitStorefrontContactMessage(input: {
  name: string;
  email: string;
  phone?: string;
  type: StoreContactMessageType;
  message: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = input.name.trim();
  const email = input.email.trim();
  const phone = input.phone?.trim() ?? '';
  const message = input.message.trim();

  if (!name || !email || !message || !input.type) {
    return { ok: false, error: 'INVALID_INPUT' };
  }

  if (!isStoreHttpEnabled()) {
    return { ok: false, error: 'STORE_HTTP_DISABLED' };
  }

  try {
    await submitPublicContactMessage({
      companyId: getPublicStorefrontCompanyId(),
      name,
      email,
      phone: phone || undefined,
      type: input.type,
      message,
    });
    return { ok: true };
  } catch (error) {
    console.warn('[store] contact message failed', error);
    return { ok: false, error: 'SUBMIT_FAILED' };
  }
}
