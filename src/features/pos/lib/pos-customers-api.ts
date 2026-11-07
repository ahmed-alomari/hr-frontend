import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/shared/api/client';

import type { PosCollection, PosMoneyMethod, PosPaymentMethod, PosSaleCredit } from '@/features/pos/domain/types';

/** A contact as the register picks it, with the customer's account balance per currency. */
export type PosCustomerOption = {
  id: string;
  name: string;
  phone: string | null;
  taxNumber: string | null;
  refCode: string | null;
  isCustomer: boolean;
  /** debit − credit: positive = عليه, negative = له. */
  balances: Array<{ currencyCode: string; balance: string }>;
};

/** A contact's credit invoice from the point of sale (any age). */
export type PosPartnerCreditSale = {
  id: string;
  number: string | null;
  completedAt: string | null;
  cashierName: string;
  registerId: string;
  currency: string | null;
  total: number;
  credit: PosSaleCredit;
  payments: Array<{ method: PosPaymentMethod; amount: number }>;
  collections: PosCollection[];
  returns: Array<{ id: string; number: string; amount: number; createdAt: string }>;
};

export function usePosCustomerSearch(companyId: string | null | undefined, term: string, enabled = true) {
  return useQuery({
    queryKey: ['pos', 'customers', companyId, term],
    queryFn: () =>
      apiRequest<PosCustomerOption[]>('/pos/customers', {
        query: { companyId: companyId!, q: term },
        throwOnError: true,
        silent: true,
      }),
    enabled: Boolean(companyId) && enabled,
    staleTime: 15_000,
  });
}

export function createPosCustomer(
  companyId: string,
  input: { name: string; mobile?: string | null; taxNumber?: string | null },
): Promise<PosCustomerOption> {
  return apiRequest<Omit<PosCustomerOption, 'balances'>>('/pos/customers', {
    method: 'POST',
    body: { companyId, ...input },
    throwOnError: true,
  }).then((c) => ({ ...c, balances: [] }));
}

/**
 * A payment on a credit invoice from outside the register (the contact's page):
 * no shift, so it never enters a drawer. Keep one id per payment: a resend
 * with the same id counts once.
 */
export function collectPosCredit(
  companyId: string,
  input: { id: string; saleId: string; method: PosMoneyMethod; amount: number; reference: string | null },
): Promise<unknown> {
  return apiRequest('/pos/commands', {
    method: 'POST',
    body: { companyId, command: { type: 'collectCredit', ...input, sessionId: null } },
    throwOnError: true,
    silent: true,
  });
}

export const partnerCreditSalesKey = (companyId: string | null | undefined, partnerId: string) => [
  'pos',
  'partner-credit-sales',
  companyId ?? '',
  partnerId,
];

export function usePartnerCreditSales(companyId: string | null | undefined, partnerId: string, enabled = true) {
  return useQuery({
    queryKey: partnerCreditSalesKey(companyId, partnerId),
    queryFn: () =>
      apiRequest<PosPartnerCreditSale[]>(`/pos/customers/${partnerId}/credit-sales`, {
        query: { companyId: companyId! },
        throwOnError: true,
        silent: true,
      }),
    enabled: Boolean(companyId && partnerId) && enabled,
  });
}
