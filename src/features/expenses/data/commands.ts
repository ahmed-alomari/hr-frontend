/**
 * Operations the screens send to the server (`POST /expenses/commands`).
 * The server runs them with `domain/commands` and checks each one's `exp.*`
 * permission; amounts are integers in minor units.
 */
import type { ExpenseDraft } from '../domain/commands';
import type { AnyTxn, Category, CostCenter, ExpenseGroup, ExpensesSettings, PartyId, Settlement } from '../domain/types';
import type { Minor } from '../domain/money';

/**
 * `requestId` (operations that create a record): the new record's id, so the
 * same operation sent again — a retry after a lost answer, a second tab —
 * runs once on the server. The store adds one when it is missing.
 */
export type ExpensesCommand = ExpensesCommandBody & { requestId?: string };

/** Operations that create a record and accept a `requestId`. */
export const IDEMPOTENT_COMMANDS: ReadonlySet<ExpensesCommand['type']> = new Set([
  'saveExpense',
  'openCustody',
  'addCustodyMove',
  'addAdvance',
  'addSettlement',
]);

type ExpensesCommandBody =
  | { type: 'saveExpense'; draft: ExpenseDraft; submit: boolean }
  | { type: 'submit'; kind: AnyTxn['kind']; id: string }
  | { type: 'decide'; kind: AnyTxn['kind']; id: string; decision: 'approved' | 'rejected'; note?: string | null }
  | { type: 'void'; kind: AnyTxn['kind']; id: string; reason: string }
  | { type: 'openCustody'; holderId: string; purpose: string; limit: Minor | null; amount: Minor; date: string; groupId?: string | null }
  | { type: 'addCustodyMove'; custodyId: string; moveType: 'topup' | 'return'; amount: Minor; date: string; note: string | null }
  | { type: 'closeCustody'; custodyId: string; date: string }
  | { type: 'addAdvance'; personId: string; amount: Minor; purpose: string; date: string; groupId?: string | null }
  | { type: 'addSettlement'; fromId: PartyId; toId: PartyId; amount: Minor; method: Settlement['method']; date: string; note: string | null; groupId?: string | null }
  /** A new row is sent with an empty id; the server gives it one. */
  | { type: 'upsertCategory'; category: Category }
  | { type: 'upsertCostCenter'; center: CostCenter }
  | { type: 'upsertGroup'; group: ExpenseGroup }
  | { type: 'updateSettings'; patch: Partial<ExpensesSettings> };
