'use client';

import * as React from 'react';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/shared/api/client';
import {
  DEFAULT_POS_SETTINGS,
  type PosAuditEvent,
  type PosCashMovement,
  type PosCollection,
  type PosCustomer,
  type PosDevice,
  type PosDiscount,
  type PosHeldCart,
  type PosMenuCategory,
  type PosMoneyMethod,
  type PosPayment,
  type PosRegister,
  type PosReturn,
  type PosSale,
  type PosSaleLine,
  type PosSaleTotals,
  type PosSession,
  type PosSettings,
  type PosStockMode,
} from '@/features/pos/domain/types';

/**
 * Point of sale data, on the server (since 2026-10-10): every device of the
 * company sees the same settings, registers, shifts and sales.
 *
 * - Reading: GET /pos/data (refreshed every 30 s, and after each action).
 * - Actions: POST /pos/commands — the server runs the POS rules under a lock
 *   and answers with the new data. Actions of a company are sent one after
 *   the other (a payment never reaches the server before its sale), and the
 *   ids of new records are made here, so a retried action has one effect.
 * - A refused action (rule or permission) rejects with the server's Arabic
 *   reason (PosRuleError); usePosContext shows it.
 */

export type PosCompanyData = {
  settings: PosSettings;
  registers: PosRegister[];
  devices: PosDevice[];
  sessions: PosSession[];
  sales: PosSale[];
  returns: PosReturn[];
  cashMovements: PosCashMovement[];
  /** Collections of credit invoices (recent ones, and the open shifts'). */
  collections: PosCollection[];
  heldCarts: PosHeldCart[];
  menuCategories: PosMenuCategory[];
  audit: PosAuditEvent[];
  returnSequence: number;
};

export const EMPTY_POS_DATA: PosCompanyData = {
  settings: DEFAULT_POS_SETTINGS,
  registers: [],
  devices: [],
  sessions: [],
  sales: [],
  returns: [],
  cashMovements: [],
  collections: [],
  heldCarts: [],
  menuCategories: [],
  audit: [],
  returnSequence: 1,
};

export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
        (Number(c) ^ (Math.floor(Math.random() * 256) & (15 >> (Number(c) / 4)))).toString(16),
      );

export const posDataQueryKey = (companyId: string | null | undefined) => ['pos', 'data', companyId ?? ''];

function withDefaults(data: Partial<PosCompanyData> | undefined | null): PosCompanyData {
  if (!data) return EMPTY_POS_DATA;
  const settings = (data.settings ?? {}) as Partial<PosSettings>;
  return {
    ...EMPTY_POS_DATA,
    ...data,
    settings: {
      ...DEFAULT_POS_SETTINGS,
      ...settings,
      tax: { ...DEFAULT_POS_SETTINGS.tax, ...settings.tax },
      discounts: { ...DEFAULT_POS_SETTINGS.discounts, ...settings.discounts },
      returns: { ...DEFAULT_POS_SETTINGS.returns, ...settings.returns },
      shifts: { ...DEFAULT_POS_SETTINGS.shifts, ...settings.shifts },
      paymentMethods: { ...DEFAULT_POS_SETTINGS.paymentMethods, ...settings.paymentMethods },
    },
    menuCategories: data.menuCategories ?? [],
    collections: data.collections ?? [],
  } as PosCompanyData;
}

export function usePosData(companyId: string | null | undefined): PosCompanyData {
  const { data } = useQuery({
    queryKey: posDataQueryKey(companyId),
    queryFn: () =>
      apiRequest<PosCompanyData>('/pos/data', {
        query: { companyId: companyId! },
        throwOnError: true,
        silent: true,
      }),
    enabled: Boolean(companyId),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
  // Stable while the data does not change (screens copy settings into drafts
  // in effects; a new object each render would loop).
  return React.useMemo(() => withDefaults(data), [data]);
}

/** A rule (or permission) the server refused: the action did nothing; the message says why. */
export class PosRuleError extends Error {}

/** One queue per company: actions reach the server in the order they were made. */
const queues = new Map<string, Promise<unknown>>();

type CommandResponse = { data: PosCompanyData; result: unknown };

/** Actions bound to one company; each is one server command. */
export function posActions(companyId: string, queryClient: QueryClient) {
  const run = <T = true>(command: Record<string, unknown>): Promise<T> => {
    const previous = queues.get(companyId) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        try {
          const res = await apiRequest<CommandResponse>('/pos/commands', {
            method: 'POST',
            body: { companyId, command },
            throwOnError: true,
            silent: true,
          });
          queryClient.setQueryData(posDataQueryKey(companyId), res.data);
          // Actions without a result resolve to true (a refused one rejects).
          return (res.result ?? true) as T;
        } catch (error) {
          // ApiError is not an Error: read its message (the server's Arabic reason).
          const raw = (error as { message?: unknown } | null)?.message;
          const message =
            typeof raw === 'string' && raw && !raw.startsWith('HTTP ') ? raw : 'تعذّر تنفيذ الإجراء الآن، حاول مرة أخرى.';
          // The server's data may have moved on: read it again.
          void queryClient.invalidateQueries({ queryKey: posDataQueryKey(companyId) });
          throw new PosRuleError(message);
        }
      });
    queues.set(companyId, next);
    return next;
  };

  const read = () => withDefaults(queryClient.getQueryData<PosCompanyData>(posDataQueryKey(companyId)));

  return {
    /** Settings other than the stock mode (that one goes through the drain). */
    saveSettings(settings: PosSettings) {
      return run({ type: 'saveSettings', settings });
    },

    /** Starts the drain: no new shifts from now; open ones finish in their mode. */
    requestStockModeChange(to: PosStockMode, _by?: string) {
      return run({ type: 'requestStockModeChange', to });
    },

    cancelStockModeChange(_by?: string) {
      return run({ type: 'cancelStockModeChange' });
    },

    /** Explicit choice once drained: no open shift, nothing awaiting payment or in exception. */
    confirmStockModeChange(_by?: string) {
      return run({ type: 'confirmStockModeChange' });
    },

    saveRegister(input: Omit<PosRegister, 'id' | 'createdAt' | 'nextSequence'> & { id?: string }) {
      const id = input.id ?? newId();
      return run({ type: 'saveRegister', register: { ...input, id } }).then(() => id);
    },

    pairDevice(registerId: string, label: string, _by?: string) {
      const id = newId();
      return run({ type: 'pairDevice', id, registerId, label }).then(() => id);
    },

    revokeDevice(deviceId: string, _by?: string) {
      return run({ type: 'revokeDevice', deviceId });
    },

    openSession(registerId: string, _cashierId: string, _cashierName: string, openingFloat: number, _stockMode?: PosStockMode) {
      const id = newId();
      return run({ type: 'openSession', id, registerId, openingFloat }).then(() => id);
    },

    closeSession(
      sessionId: string,
      result: {
        countedCash: number;
        expectedCash: number;
        difference: number;
        differenceReason: string | null;
        denominationCounts: Record<string, number> | null;
      },
      _by?: string,
    ) {
      return run({ type: 'closeSession', sessionId, result });
    },

    addCashMovement(sessionId: string, type: 'in' | 'out', amount: number, reason: string, _by?: string) {
      return run({ type: 'addCashMovement', id: newId(), sessionId, movementType: type, amount, reason });
    },

    holdCart(cart: Omit<PosHeldCart, 'id' | 'createdAt'>) {
      const id = newId();
      return run({ type: 'holdCart', cart: { ...cart, id } }).then(() => id);
    },

    dropHeldCart(id: string) {
      return run({ type: 'dropHeldCart', id });
    },

    voidCart(_by: string, itemCount: number, value: number) {
      return run({ type: 'voidCart', itemCount, value });
    },

    logAudit(_by: string, type: PosAuditEvent['type'], detail: string) {
      return run({ type: 'logAudit', auditType: type, detail });
    },

    /** Commit the cart: prices and snapshot fixed on the server. */
    commitSale(input: {
      registerId: string;
      sessionId: string;
      cashierName?: string;
      stockSource: PosStockMode;
      customer: PosCustomer;
      lines: PosSaleLine[];
      orderDiscount: PosDiscount | null;
      totals: PosSaleTotals;
    }) {
      const id = newId();
      const { cashierName: _cashier, ...sale } = input;
      return run({ type: 'commitSale', id, sale }).then(() => id);
    },

    addPayment(saleId: string, payment: Omit<PosPayment, 'id' | 'createdAt'>) {
      const id = newId();
      return run({ type: 'addPayment', saleId, payment: { ...payment, id } }).then(() => id);
    },

    updatePayment(saleId: string, paymentId: string, patch: Partial<PosPayment>) {
      return run({ type: 'updatePayment', saleId, paymentId, patch });
    },

    /** The customer of an open sale (a contact for a credit sale; the server reads its name). */
    setSaleCustomer(saleId: string, customer: PosCustomer) {
      return run({ type: 'setSaleCustomer', saleId, customer });
    },

    /** A payment on a credit invoice: in the open shift (into its drawer), or outside one (null). */
    collectCredit(input: {
      /** One per payment, kept across retries: a resend counts once. */
      id?: string;
      saleId: string;
      method: PosMoneyMethod;
      amount: number;
      reference: string | null;
      sessionId: string | null;
    }) {
      const id = input.id ?? newId();
      return run({ type: 'collectCredit', ...input, id }).then(() => id);
    },

    /** Paid in full: the receipt number is given by the server, from the register's sequence. */
    completeSale(saleId: string) {
      return run<string>({ type: 'completeSale', saleId });
    },

    cancelSale(saleId: string, reason: string, _by?: string) {
      return run({ type: 'cancelSale', saleId, reason });
    },

    markException(saleId: string, reason: string) {
      return run({ type: 'markException', saleId, reason });
    },

    /** Item swap after payment: the previous version is kept, never edited silently. */
    reviseSale(saleId: string, lines: PosSaleLine[], totals: PosSaleTotals, reason: string, _by?: string) {
      return run({ type: 'reviseSale', saleId, lines, totals, reason });
    },

    createReturn(input: Omit<PosReturn, 'id' | 'number' | 'createdAt'>) {
      const id = newId();
      const { createdBy: _createdBy, stockPosting: _stockPosting, ...ret } = input;
      return run<{ id: string; number: string }>({ type: 'createReturn', id, ret });
    },

    recordRefund(returnId: string, reference: string | null, _by?: string) {
      return run({ type: 'recordRefund', returnId, reference });
    },

    /** Goods received while not linked: reviewed (counted) before they are posted to inventory. */
    reviewStockPosting(returnId: string, _by?: string) {
      return run({ type: 'reviewStockPosting', returnId });
    },

    setDamagedDecision(returnId: string, decision: NonNullable<PosReturn['damagedDecision']>) {
      return run({ type: 'setDamagedDecision', returnId, decision });
    },

    read,
  };
}

/** This browser's paired device, per company. */
const DEVICE_KEY = 'erp.pos.device';

export function readPairedDevice(companyId: string): string | null {
  try {
    const all = JSON.parse(localStorage.getItem(DEVICE_KEY) ?? '{}') as Record<string, string>;
    return all[companyId] ?? null;
  } catch {
    return null;
  }
}

export function writePairedDevice(companyId: string, deviceId: string | null): void {
  try {
    const all = JSON.parse(localStorage.getItem(DEVICE_KEY) ?? '{}') as Record<string, string>;
    if (deviceId) all[companyId] = deviceId;
    else delete all[companyId];
    localStorage.setItem(DEVICE_KEY, JSON.stringify(all));
  } catch {
    // Storage blocked: the register still works, pairing is just not remembered.
  }
}

/**
 * Menu categories kept in this browser before they moved to the server
 * (zustand persist `erp.pos.v1`), read once to copy them up.
 */
export function readLegacyMenuCategories(companyId: string): PosMenuCategory[] {
  try {
    const stored = JSON.parse(localStorage.getItem('erp.pos.v1') ?? '{}') as {
      state?: { companies?: Record<string, { menuCategories?: PosMenuCategory[] }> };
    };
    return stored.state?.companies?.[companyId]?.menuCategories ?? [];
  } catch {
    return [];
  }
}
