/**
 * Reports. An expense is counted once, by its own amount (or the part of its
 * allocation that matches a cost center / group filter). Handing over,
 * refilling or returning a custody is a transfer of the organization's money,
 * not an expense: it appears in the custody and cash reports only, so paying
 * from a custody is never counted twice.
 */
import { computeLedger, effectsOf, partyBalance } from './ledger';
import { txnGroupId } from './policy';
import type { Minor } from './money';
import { ORG } from './types';
import type { AnyTxn, Expense, ExpensesData, PartyId } from './types';

export type Period = 'day' | 'week' | 'month';

export type ReportFilter = {
  currency: string;
  from?: string | null;
  to?: string | null;
  participantIds?: string[];
  groupIds?: string[];
  categoryIds?: string[];
  costCenterIds?: string[];
  /** Also count submitted (not yet approved) expenses. */
  includePending?: boolean;
};

const DAY_MS = 86_400_000;

/** Week starts on Saturday (as in Yemen and the Gulf). */
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const back = (d.getUTCDay() + 1) % 7; // Sat → 0, Sun → 1, … Fri → 6
  return new Date(d.getTime() - back * DAY_MS).toISOString().slice(0, 10);
}

export function bucketOf(date: string, period: Period): string {
  if (period === 'day') return date;
  if (period === 'week') return weekStart(date);
  return date.slice(0, 7);
}

/** A participant takes part in an expense as creator, payer or bearer. */
export function involves(expense: Expense, participantId: string): boolean {
  return (
    expense.createdBy === participantId ||
    expense.payments.some((p) => p.payerId === participantId) ||
    expense.bearing.shares.some((s) => s.partyId === participantId)
  );
}

function lineMatches(expense: Expense, line: Expense['allocation'][number], filter: ReportFilter): boolean {
  const cc = filter.costCenterIds?.length ? filter.costCenterIds : null;
  const gr = filter.groupIds?.length ? filter.groupIds : null;
  const group = line.groupId ?? expense.groupId ?? null;
  const center = line.costCenterId ?? expense.costCenterId ?? null;
  return (!cc || (center !== null && cc.includes(center))) && (!gr || (group !== null && gr.includes(group)));
}

/** The part of the expense the filter covers (all of it without cost center / group filters). */
export function countedAmount(expense: Expense, filter: ReportFilter): Minor {
  if (!filter.costCenterIds?.length && !filter.groupIds?.length) return expense.amount;
  return expense.allocation
    .filter((line) => lineMatches(expense, line, filter))
    .reduce((t, line) => t + line.amount, 0);
}

export function filterExpenses(data: ExpensesData, filter: ReportFilter): Expense[] {
  const statuses = new Set(filter.includePending ? ['approved', 'submitted'] : ['approved']);
  const people = filter.participantIds?.length ? filter.participantIds : null;
  const categories = filter.categoryIds?.length ? new Set(filter.categoryIds) : null;
  return data.expenses.filter(
    (e) =>
      e.currency === filter.currency &&
      statuses.has(e.status) &&
      (!filter.from || e.date >= filter.from) &&
      (!filter.to || e.date <= filter.to) &&
      (!categories || categories.has(e.categoryId)) &&
      (!people || people.some((p) => involves(e, p))) &&
      countedAmount(e, filter) > 0,
  );
}

export type Row = { key: string; amount: Minor; count: number };

function addTo(map: Map<string, Row>, key: string, amount: Minor) {
  const row = map.get(key) ?? { key, amount: 0, count: 0 };
  row.amount += amount;
  row.count += 1;
  map.set(key, row);
}

const sorted = (map: Map<string, Row>) => [...map.values()].sort((a, b) => b.amount - a.amount);

export type ExpenseReport = {
  total: Minor;
  count: number;
  series: Row[];
  byCategory: Row[];
  byGroup: Row[];
  byCostCenter: Row[];
  /** Who bears the cost (ORG or a participant). */
  byBearer: Row[];
  /** org / custody / personal. */
  byPaymentSource: Row[];
  /** Who recorded it. */
  byCreator: Row[];
  /** Submitted, not approved — reported apart (not in `total` unless includePending). */
  pendingTotal: Minor;
  pendingCount: number;
};

export function expenseReport(data: ExpensesData, filter: ReportFilter, period: Period): ExpenseReport {
  const rows = filterExpenses(data, filter);
  const series = new Map<string, Row>();
  const byCategory = new Map<string, Row>();
  const byGroup = new Map<string, Row>();
  const byCostCenter = new Map<string, Row>();
  const byBearer = new Map<string, Row>();
  const byPaymentSource = new Map<string, Row>();
  const byCreator = new Map<string, Row>();
  let total = 0;
  for (const e of rows) {
    const amount = countedAmount(e, filter);
    const ratio = amount / e.amount;
    total += amount;
    addTo(series, bucketOf(e.date, period), amount);
    addTo(byCategory, e.categoryId, amount);
    addTo(byCreator, e.createdBy, amount);
    for (const line of e.allocation) {
      if (!lineMatches(e, line, filter)) continue;
      addTo(byGroup, line.groupId ?? e.groupId ?? '—', line.amount);
      addTo(byCostCenter, line.costCenterId ?? e.costCenterId ?? '—', line.amount);
    }
    for (const share of e.bearing.shares) addTo(byBearer, share.partyId, Math.round(share.amount * ratio));
    for (const part of e.payments) addTo(byPaymentSource, part.source, Math.round(part.amount * ratio));
  }
  const pending = filter.includePending
    ? []
    : filterExpenses(data, { ...filter, includePending: true }).filter((e) => e.status === 'submitted');
  return {
    total,
    count: rows.length,
    series: [...series.values()].sort((a, b) => a.key.localeCompare(b.key)),
    byCategory: sorted(byCategory),
    byGroup: sorted(byGroup),
    byCostCenter: sorted(byCostCenter),
    byBearer: sorted(byBearer),
    byPaymentSource: sorted(byPaymentSource),
    byCreator: sorted(byCreator),
    pendingTotal: pending.reduce((t, e) => t + countedAmount(e, filter), 0),
    pendingCount: pending.length,
  };
}

export type CashReport = {
  /** Expenses paid from the organization's cash (not from custodies). */
  expensesPaidDirect: Minor;
  /** Custodies handed over and refilled. */
  custodyFunding: Minor;
  custodyReturns: Minor;
  advancesPaid: Minor;
  settlementsPaid: Minor;
  settlementsReceived: Minor;
  /** Cash out − cash in. */
  netOutflow: Minor;
};

/** The organization's cash movements in the period (approved records). */
export function cashReport(data: ExpensesData, filter: Pick<ReportFilter, 'currency' | 'from' | 'to'>): CashReport {
  const r: CashReport = {
    expensesPaidDirect: 0,
    custodyFunding: 0,
    custodyReturns: 0,
    advancesPaid: 0,
    settlementsPaid: 0,
    settlementsReceived: 0,
    netOutflow: 0,
  };
  const all = [...data.expenses, ...data.custodyMoves, ...data.advances, ...data.settlements];
  for (const t of all) {
    if (t.status !== 'approved' || t.currency !== filter.currency) continue;
    if ((filter.from && t.date < filter.from) || (filter.to && t.date > filter.to)) continue;
    for (const effect of effectsOf(t)) {
      if (effect.type !== 'orgCash') continue;
      r.netOutflow -= effect.amount;
      if (t.kind === 'expense') r.expensesPaidDirect += -effect.amount;
      else if (t.kind === 'custody_move') {
        if (effect.amount < 0) r.custodyFunding += -effect.amount;
        else r.custodyReturns += effect.amount;
      } else if (t.kind === 'advance') r.advancesPaid += -effect.amount;
      else if (effect.amount < 0) r.settlementsPaid += -effect.amount;
      else r.settlementsReceived += effect.amount;
    }
  }
  return r;
}

export type CashMovementType =
  | 'expense'
  | 'custody_issue'
  | 'custody_topup'
  | 'custody_return'
  | 'advance'
  | 'settlement_paid'
  | 'settlement_received';

export const CASH_MOVEMENT_LABELS_AR: Record<CashMovementType, string> = {
  expense: 'مصروف مدفوع من المنشأة',
  custody_issue: 'تسليم عهدة',
  custody_topup: 'تغذية عهدة',
  custody_return: 'مرتجع عهدة',
  advance: 'سلفة شخصية',
  settlement_paid: 'تعويض أو سداد للشخص',
  settlement_received: 'سداد مستلم من الشخص',
};

/** One approved record that moved the organization's cash. */
export type CashMovement = {
  id: string;
  kind: AnyTxn['kind'];
  type: CashMovementType;
  direction: 'out' | 'in';
  date: string;
  createdAt: string;
  /** Always positive; the direction says which way it went. */
  amount: Minor;
  /** The person on the other side (custody holder, borrower, or the non-organization side). */
  partyId: PartyId | null;
  description: string;
  groupId: string | null;
  /** Expenses only. */
  categoryId: string | null;
  /** Expenses only; several when the cost is split across centers. */
  costCenterIds: string[];
  createdBy: string;
  /** Settlement method; null when the money left or entered the organization's own cash. */
  method: 'cash' | 'transfer' | 'payroll' | 'other' | null;
  note: string;
};

/**
 * Every approved record that moved the organization's cash in the period,
 * oldest first. Spending from a custody or paid personally does not move the
 * organization's cash (the custody handover already did), so it is not listed.
 * The sum of the movements equals `cashReport`.
 */
export function cashMovements(data: ExpensesData, filter: Pick<ReportFilter, 'currency' | 'from' | 'to'>): CashMovement[] {
  const custodies = new Map(data.custodies.map((c) => [c.id, c]));
  const all: AnyTxn[] = [...data.expenses, ...data.custodyMoves, ...data.advances, ...data.settlements];
  const rows: CashMovement[] = [];
  for (const t of all) {
    if (t.status !== 'approved' || t.currency !== filter.currency) continue;
    if ((filter.from && t.date < filter.from) || (filter.to && t.date > filter.to)) continue;
    const net = effectsOf(t).reduce((sum, e) => (e.type === 'orgCash' ? sum + e.amount : sum), 0);
    if (net === 0) continue;
    const direction: CashMovement['direction'] = net < 0 ? 'out' : 'in';
    const centers = t.kind === 'expense'
      ? [...new Set([t.costCenterId, ...t.allocation.map((l) => l.costCenterId)].filter((id): id is string => Boolean(id)))]
      : [];
    const common = {
      id: t.id,
      kind: t.kind,
      direction,
      date: t.date,
      createdAt: t.createdAt,
      amount: Math.abs(net),
      groupId: txnGroupId(data, t),
      categoryId: t.kind === 'expense' ? t.categoryId : null,
      costCenterIds: centers,
      createdBy: t.createdBy,
      method: t.kind === 'settlement' ? t.method : null,
      note: t.kind === 'settlement' ? '' : (t.note ?? ''),
    };
    switch (t.kind) {
      case 'expense':
        rows.push({ ...common, type: 'expense', partyId: null, description: t.description });
        break;
      case 'custody_move': {
        const custody = custodies.get(t.custodyId);
        const type: CashMovementType = t.type === 'issue' ? 'custody_issue' : t.type === 'topup' ? 'custody_topup' : 'custody_return';
        rows.push({ ...common, type, partyId: custody?.holderId ?? null, description: custody?.purpose ?? '' });
        break;
      }
      case 'advance':
        rows.push({ ...common, type: 'advance', partyId: t.personId, description: t.purpose });
        break;
      case 'settlement':
        rows.push({
          ...common,
          type: direction === 'out' ? 'settlement_paid' : 'settlement_received',
          partyId: t.fromId === ORG ? t.toId : t.fromId,
          description: t.note ?? '',
        });
        break;
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

export type PersonReportRow = {
  partyId: PartyId;
  /** Distinct days in the period with spending, custody, an advance or a settlement. */
  days: number;
  /** Paid from their own money, in the period. */
  spentPersonal: Minor;
  /** Spent from a custody they hold, in the period. */
  spentCustody: Minor;
  /** spentPersonal + spentCustody. Bearing a cost is separate, so it is not added twice. */
  spent: Minor;
  /** Cost charged to them in the period. */
  borne: Minor;
  /** Custody handed to them (issue and refill) in the period. */
  custodyIn: Minor;
  /** Custody they returned in the period. */
  custodyOut: Minor;
  /** Approved custody they hold now, whatever the period. */
  custodyNow: Minor;
  hasCustody: boolean;
  /** Personal advances they received in the period. */
  advances: Minor;
  /** Settlements they paid in the period. */
  paidOut: Minor;
  /** Settlements they received in the period. */
  paidIn: Minor;
  /** Others owe them now (pair-netted, all dates). */
  owedToThem: Minor;
  /** They owe others now. */
  theyOwe: Minor;
};

type PersonBucket = {
  days: Set<string>;
  spentPersonal: Minor;
  spentCustody: Minor;
  borne: Minor;
  custodyIn: Minor;
  custodyOut: Minor;
  advances: Minor;
  paidOut: Minor;
  paidIn: Minor;
};

function inReportPeriod(date: string, filter: Pick<ReportFilter, 'from' | 'to'>): boolean {
  return (!filter.from || date >= filter.from) && (!filter.to || date <= filter.to);
}

/**
 * One row per person who spent, held custody, borrowed, settled, or still has
 * a balance. Period columns follow the dates. «له» and «عليه» and the custody
 * still held are the position now, so a settlement outside the period still
 * shows in the balance.
 */
export function peopleReport(data: ExpensesData, filter: Pick<ReportFilter, 'currency' | 'from' | 'to'>): PersonReportRow[] {
  const ledger = computeLedger(data, filter.currency);
  const holderOf = new Map(data.custodies.map((c) => [c.id, c.holderId]));
  const buckets = new Map<PartyId, PersonBucket>();
  const bucket = (id: PartyId, date: string): PersonBucket | null => {
    if (!id || id === ORG) return null;
    let row = buckets.get(id);
    if (!row) {
      row = { days: new Set(), spentPersonal: 0, spentCustody: 0, borne: 0, custodyIn: 0, custodyOut: 0, advances: 0, paidOut: 0, paidIn: 0 };
      buckets.set(id, row);
    }
    row.days.add(date);
    return row;
  };

  for (const expense of data.expenses) {
    if (expense.status !== 'approved' || expense.currency !== filter.currency || !inReportPeriod(expense.date, filter)) continue;
    for (const part of expense.payments) {
      if (part.amount <= 0) continue;
      if (part.source === 'personal' && part.payerId) {
        const row = bucket(part.payerId, expense.date);
        if (row) row.spentPersonal += part.amount;
      } else if (part.source === 'custody' && part.custodyId) {
        const row = bucket(holderOf.get(part.custodyId) ?? '', expense.date);
        if (row) row.spentCustody += part.amount;
      }
    }
    for (const share of expense.bearing.shares) {
      if (share.amount <= 0) continue;
      const row = bucket(share.partyId, expense.date);
      if (row) row.borne += share.amount;
    }
  }
  for (const move of data.custodyMoves) {
    if (move.status !== 'approved' || move.currency !== filter.currency || !inReportPeriod(move.date, filter)) continue;
    const row = bucket(holderOf.get(move.custodyId) ?? '', move.date);
    if (!row) continue;
    if (move.type === 'return') row.custodyOut += move.amount;
    else row.custodyIn += move.amount;
  }
  for (const advance of data.advances) {
    if (advance.status !== 'approved' || advance.currency !== filter.currency || !inReportPeriod(advance.date, filter)) continue;
    const row = bucket(advance.personId, advance.date);
    if (row) row.advances += advance.amount;
  }
  for (const settlement of data.settlements) {
    if (settlement.status !== 'approved' || settlement.currency !== filter.currency || !inReportPeriod(settlement.date, filter)) continue;
    const from = bucket(settlement.fromId, settlement.date);
    if (from) from.paidOut += settlement.amount;
    const to = bucket(settlement.toId, settlement.date);
    if (to) to.paidIn += settlement.amount;
  }

  const ids = new Set<PartyId>([...buckets.keys(), ...ledger.parties.keys()]);
  ids.delete(ORG);
  const rows: PersonReportRow[] = [];
  for (const partyId of ids) {
    const activity = buckets.get(partyId);
    const balance = partyBalance(ledger, partyId);
    const spentPersonal = activity?.spentPersonal ?? 0;
    const spentCustody = activity?.spentCustody ?? 0;
    const row: PersonReportRow = {
      partyId,
      days: activity?.days.size ?? 0,
      spentPersonal,
      spentCustody,
      spent: spentPersonal + spentCustody,
      borne: activity?.borne ?? 0,
      custodyIn: activity?.custodyIn ?? 0,
      custodyOut: activity?.custodyOut ?? 0,
      custodyNow: balance.custodyActual,
      hasCustody: balance.custodyActual > 0,
      advances: activity?.advances ?? 0,
      paidOut: activity?.paidOut ?? 0,
      paidIn: activity?.paidIn ?? 0,
      owedToThem: balance.entitlements,
      theyOwe: balance.liabilities,
    };
    const empty = row.spent === 0 && row.borne === 0 && row.custodyIn === 0 && row.custodyOut === 0
      && row.advances === 0 && row.paidOut === 0 && row.paidIn === 0 && row.days === 0
      && row.owedToThem === 0 && row.theyOwe === 0 && row.custodyNow === 0;
    if (!empty) rows.push(row);
  }
  return rows.sort((a, b) => b.spent - a.spent || b.custodyNow - a.custodyNow || (b.owedToThem + b.theyOwe) - (a.owedToThem + a.theyOwe) || a.partyId.localeCompare(b.partyId));
}

/** CSV (UTF-8 with BOM for Excel) of the filtered expenses. */
export function expensesCsv(
  rows: readonly Expense[],
  names: { category: (id: string) => string; party: (id: PartyId) => string; money: (minor: Minor) => string },
): string {
  const head = ['التاريخ', 'الوصف', 'الفئة', 'المبلغ', 'الحالة', 'سجّله', 'مصدر الدفع', 'التحميل'];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((e) =>
    [
      e.date,
      e.description,
      names.category(e.categoryId),
      names.money(e.amount),
      e.status,
      names.party(e.createdBy),
      e.payments.map((p) => (p.source === 'org' ? 'المنشأة' : p.source === 'custody' ? 'عهدة' : `شخصي: ${names.party(p.payerId ?? '')}`)).join(' + '),
      e.bearing.shares.map((s) => `${s.partyId === ORG ? 'المنشأة' : names.party(s.partyId)}: ${names.money(s.amount)}`).join('، '),
    ]
      .map(esc)
      .join(','),
  );
  return `﻿${[head.map(esc).join(','), ...lines].join('\n')}`;
}
