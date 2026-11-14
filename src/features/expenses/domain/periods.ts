/**
 * Period closing (إقفال الفترات) of the expenses app. Periods follow each
 * other: the first one starts on a chosen date, every next one the day after
 * the last closed one ends. A record dated inside a closed period cannot be
 * recorded, edited, sent, decided or voided. Only the latest closed period
 * can be reopened, with a reason; the closing stays on record.
 */
import { CommandError } from './errors';
import { allTxns, effectsOf } from './ledger';
import type { Ctx } from './commands';
import type { ExpensesData, PeriodClosing, PeriodSummary } from './types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** `date` moved by `days` (YYYY-MM-DD, calendar days). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Periods that are closed now (not reopened), oldest first. */
export function closedPeriods(data: ExpensesData): PeriodClosing[] {
  return (data.closings ?? [])
    .filter((c) => c.status === 'closed')
    .sort((a, b) => a.to.localeCompare(b.to));
}

/** Last day of the latest closed period: nothing on or before it changes. */
export function lockedThrough(data: ExpensesData): string | null {
  const closed = closedPeriods(data);
  return closed.length ? closed[closed.length - 1].to : null;
}

/** Where the next period starts (the day after the last closed one). */
export function nextPeriodStart(data: ExpensesData): string | null {
  const last = lockedThrough(data);
  return last ? addDays(last, 1) : null;
}

/** Why a record dated `date` cannot change, or null when its period is open. */
export function periodLockMessage(
  data: ExpensesData,
  date: string | null | undefined,
): string | null {
  const last = lockedThrough(data);
  if (!last || !date || date.slice(0, 10) > last) return null;
  const day = date.slice(0, 10);
  const period = closedPeriods(data).find(
    (c) => c.from <= day && day <= c.to,
  );
  return period
    ? `الفترة «${period.label}» (${period.from} إلى ${period.to}) مقفلة: لا يُسجَّل فيها ولا يُعدَّل شيء`
    : `الفترات مقفلة حتى ${last}: لا يُسجَّل قبلها ولا يُعدَّل شيء`;
}

export function assertPeriodOpen(
  data: ExpensesData,
  date: string | null | undefined,
): void {
  const message = periodLockMessage(data, date);
  if (message) throw new CommandError(message);
}

/** Totals of approved records dated in the period (one currency). */
export function periodSummary(
  data: ExpensesData,
  from: string,
  to: string,
  currency: string,
): PeriodSummary {
  const summary: PeriodSummary = {
    currency,
    expensesCount: 0,
    expensesTotal: 0,
    cashOut: 0,
    cashIn: 0,
  };
  for (const txn of allTxns(data)) {
    if (txn.status !== 'approved' || txn.currency !== currency) continue;
    if (txn.date < from || txn.date > to) continue;
    if (txn.kind === 'expense') {
      summary.expensesCount += 1;
      summary.expensesTotal += txn.amount;
    }
    for (const effect of effectsOf(txn)) {
      if (effect.type !== 'orgCash') continue;
      if (effect.amount < 0) summary.cashOut -= effect.amount;
      else summary.cashIn += effect.amount;
    }
  }
  return summary;
}

/** Records still waiting for approval in the period. */
export function pendingInPeriod(
  data: ExpensesData,
  from: string,
  to: string,
): number {
  return allTxns(data).filter(
    (t) => t.status === 'submitted' && t.date >= from && t.date <= to,
  ).length;
}

/** «أكتوبر 2026» for a whole month, else «2026-10-01 إلى 2026-10-15». */
export function periodLabel(from: string, to: string): string {
  const whole =
    from.slice(8) === '01' &&
    from.slice(0, 7) === to.slice(0, 7) &&
    addDays(to, 1).slice(8) === '01';
  if (whole) {
    const month = Number(from.slice(5, 7));
    return `${MONTHS_AR[month - 1]} ${from.slice(0, 4)}`;
  }
  return `${from} إلى ${to}`;
}

const MONTHS_AR = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

/**
 * Closes the next period, up to `to` (inclusive). The first closing starts
 * on `from`; later ones start the day after the last closed period.
 */
export function closePeriod(
  data: ExpensesData,
  input: {
    from?: string | null;
    to: string;
    label?: string | null;
    note?: string | null;
  },
  ctx: Ctx,
) {
  if (!isIsoDate(input.to)) throw new CommandError('حدّد تاريخ نهاية الفترة');
  const start = nextPeriodStart(data);
  const from = start ?? input.from ?? null;
  if (!from || !isIsoDate(from))
    throw new CommandError('حدّد تاريخ بداية أول فترة');
  if (start && input.from && input.from !== start) {
    throw new CommandError(
      `الفترة التالية تبدأ ${start} (بعد آخر فترة مقفلة مباشرة)`,
    );
  }
  if (input.to < from)
    throw new CommandError('نهاية الفترة قبل بدايتها');
  if (input.to >= ctx.now.slice(0, 10))
    throw new CommandError('لا تُقفل فترة لم تنتهِ بعد: نهايتها قبل اليوم');
  const pending = pendingInPeriod(data, from, input.to);
  if (pending > 0) {
    throw new CommandError(
      `في الفترة ${pending} عملية بانتظار الاعتماد: اعتمدها أو ارفضها قبل الإقفال`,
    );
  }
  const closing: PeriodClosing = {
    id: ctx.newId('cls'),
    from,
    to: input.to,
    label: input.label?.trim() || periodLabel(from, input.to),
    status: 'closed',
    note: input.note?.trim() || null,
    summary: periodSummary(data, from, input.to, ctx.currency),
    closedBy: ctx.actorId,
    closedAt: ctx.now,
    reopenedBy: null,
    reopenedAt: null,
    reopenReason: null,
  };
  return {
    data: { ...data, closings: [...(data.closings ?? []), closing] },
    closing,
  };
}

/** Reopens the latest closed period (only that one), with a reason. */
export function reopenPeriod(
  data: ExpensesData,
  closingId: string,
  reason: string,
  ctx: Ctx,
): ExpensesData {
  const closing = (data.closings ?? []).find((c) => c.id === closingId);
  if (!closing || closing.status !== 'closed')
    throw new CommandError('الفترة غير مقفلة');
  if (closing.to !== lockedThrough(data))
    throw new CommandError('لا يُعاد فتح إلا آخر فترة مقفلة');
  if (!reason.trim()) throw new CommandError('اكتب سبب إعادة الفتح');
  return {
    ...data,
    closings: (data.closings ?? []).map((c) =>
      c.id === closingId
        ? {
            ...c,
            status: 'reopened' as const,
            reopenedBy: ctx.actorId,
            reopenedAt: ctx.now,
            reopenReason: reason.trim(),
          }
        : c,
    ),
  };
}
