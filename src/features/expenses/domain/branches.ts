/**
 * Branches in expenses and custody (decisions.md §29). A record without a
 * branch is the company's own (head office); a group or cost center without
 * one is shared by every branch. Same rules as the server's `domain/branches`:
 * an expense of one branch paid from another branch's custody leaves the
 * expense's branch owing the custody's, net of the transfers between them.
 */
import type { Minor } from './money';
import type { ExpensesData } from './types';

export interface BranchDue {
  /** The branch that owes (null: the company). */
  fromBranchId: string | null;
  /** The branch owed (null: the company). */
  toBranchId: string | null;
  amount: Minor;
}

const key = (from: string | null, to: string | null) => `${from ?? ''}|${to ?? ''}`;

/** A group or cost center usable by a record of `branchId`: shared, or the same branch. */
export const usableIn = (branchId: string | null | undefined, ref: { branchId?: string | null }): boolean =>
  !ref.branchId || ref.branchId === (branchId ?? null);

/** What one branch owes another in `currency` (approved expenses), net. Positive dues only. */
export function branchDues(data: ExpensesData, currency: string): BranchDue[] {
  const owed = new Map<string, Minor>();
  const add = (from: string | null, to: string | null, amount: Minor) => {
    if (from === to || !amount) return;
    owed.set(key(from, to), (owed.get(key(from, to)) ?? 0) + amount);
  };
  const custodies = new Map(data.custodies.map((c) => [c.id, c]));
  for (const e of data.expenses) {
    if (e.status !== 'approved' || e.currency !== currency) continue;
    for (const p of e.payments) {
      if (p.source !== 'custody' || !p.custodyId) continue;
      const custody = custodies.get(p.custodyId);
      if (custody) add(e.branchId ?? null, custody.branchId ?? null, p.amount);
    }
  }
  for (const t of data.branchTransfers ?? []) {
    if (t.voidedAt || t.currency !== currency) continue;
    add(t.toBranchId, t.fromBranchId, t.amount);
  }
  const out: BranchDue[] = [];
  const seen = new Set<string>();
  for (const k of owed.keys()) {
    const [a, b] = k.split('|').map((x) => x || null);
    const pair = [a ?? '', b ?? ''].sort().join('|');
    if (seen.has(pair)) continue;
    seen.add(pair);
    const net = (owed.get(key(a, b)) ?? 0) - (owed.get(key(b, a)) ?? 0);
    if (net > 0) out.push({ fromBranchId: a, toBranchId: b, amount: net });
    else if (net < 0) out.push({ fromBranchId: b, toBranchId: a, amount: -net });
  }
  return out;
}
