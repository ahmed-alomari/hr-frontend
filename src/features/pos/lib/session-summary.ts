import type { PosCompanyData } from '@/features/pos/lib/pos-store';
import type { PosSession } from '@/features/pos/domain/types';
import { round2 } from '@/features/pos/lib/calc';

/**
 * Money of one shift. Payments count where they were taken (their session),
 * whatever happened to the sale after — a payment on an exception sale is
 * still in this drawer. «آجل» is sold, not taken: it never enters the drawer.
 */
export function summarizeSession(data: PosCompanyData, session: PosSession) {
  const sales = data.sales.filter((s) => s.sessionId === session.id && s.status === 'completed');
  const payments = data.sales.flatMap((s) => s.payments).filter((p) => p.sessionId === session.id);

  const byMethod: Record<string, number> = {};
  for (const p of payments) {
    if (p.kind !== 'payment' || p.status !== 'succeeded') continue;
    byMethod[p.method] = round2((byMethod[p.method] ?? 0) + p.amount);
  }

  // Cash given back: returns refunded in cash, and refund payments (an
  // exception's overpayment) — the same sum the server closes the shift with.
  const refundsCash = round2(
    data.returns
      .filter((r) => r.sessionId === session.id && r.refund.method === 'cash' && r.refund.status === 'done')
      .reduce((a, r) => a + r.refund.amount, 0) +
      payments
        .filter((p) => p.kind === 'refund' && p.method === 'cash' && p.status === 'succeeded')
        .reduce((a, p) => a + p.amount, 0),
  );
  const moves = data.cashMovements.filter((m) => m.sessionId === session.id);
  const cashIn = round2(moves.filter((m) => m.type === 'in').reduce((a, m) => a + m.amount, 0));
  const cashOut = round2(moves.filter((m) => m.type === 'out').reduce((a, m) => a + m.amount, 0));
  // Payments on credit invoices taken in this shift (any invoice's): cash ones are in the drawer.
  const collections = (data.collections ?? []).filter((c) => c.sessionId === session.id);
  const collectionsByMethod: Record<string, number> = {};
  for (const c of collections) collectionsByMethod[c.method] = round2((collectionsByMethod[c.method] ?? 0) + c.amount);
  const collectionsTotal = round2(collections.reduce((a, c) => a + c.amount, 0));
  const expectedCash = round2(
    session.openingFloat + (byMethod.cash ?? 0) + (collectionsByMethod.cash ?? 0) - refundsCash + cashIn - cashOut,
  );

  const openSales = data.sales.filter((s) => s.sessionId === session.id && s.status === 'awaiting_payment');
  const exceptions = data.sales.filter((s) => s.sessionId === session.id && s.status === 'payment_exception');

  return {
    salesCount: sales.length,
    salesTotal: round2(sales.reduce((a, s) => a + s.totals.total, 0)),
    byMethod,
    collectionsByMethod,
    collectionsTotal,
    refundsCash,
    cashIn,
    cashOut,
    expectedCash,
    openSales,
    exceptions,
  };
}
