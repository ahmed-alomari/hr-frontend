'use client';

/**
 * Client store of the expenses app: the company's data as the server sends it
 * (`GET /expenses/data`), the signed-in user as a party (`actorId`), the
 * company currency and the participants. Every operation is a command run by
 * the server (`POST /expenses/commands`) with the same domain rules and its
 * own `exp.*` permission; the screens get the updated data back.
 */
import { create } from 'zustand';
import { ApiError, apiRequest } from '@/shared/api/client';
import type { ExpensesData, Participant } from '../domain/types';
import { randomUUID } from '@/shared/utils';
import { IDEMPOTENT_COMMANDS, type ExpensesCommand } from './commands';

type SourceState = 'loading' | 'live' | 'unavailable';

type ExpensesView = ExpensesData & { actorId: string; currency: string; fullAccess: boolean };

/** A command's answer: only what it changed. */
type CommandAnswer<R> = {
  changes: Partial<ExpensesData>;
  result: R;
  actorId: string;
  currency: string;
  fullAccess: boolean;
};

/** New and edited rows into the data the screen already holds. */
export function mergeChanges(data: ExpensesData, changes: Partial<ExpensesData>): ExpensesData {
  const next = { ...data } as unknown as Record<string, unknown>;
  for (const [key, rows] of Object.entries(changes)) {
    if (!Array.isArray(rows)) {
      next[key] = rows;
      continue;
    }
    const current = (next[key] ?? []) as Array<{ id: string }>;
    const byId = new Map(rows.map((row: { id: string }) => [row.id, row]));
    const known = new Set(current.map((row) => row.id));
    next[key] = [...current.map((row) => byId.get(row.id) ?? row), ...rows.filter((row: { id: string }) => !known.has(row.id))];
  }
  return next as unknown as ExpensesData;
}

type ExpensesState = {
  companyId: string | null;
  data: ExpensesData | null;
  /** The signed-in user as a party (`u:<userId>`). */
  actorId: string | null;
  /** The company's base currency (balances and new records). */
  currency: string;
  /** False: the data holds only this person's own records. */
  fullAccess: boolean;
  liveParticipants: Participant[];
  participants: SourceState;
  loadError: string | null;
  /** True while a command runs (buttons wait for it). */
  busy: boolean;

  init: (companyId: string) => Promise<void>;
  reload: () => Promise<void>;
  /** Runs an operation on the server; throws an Error with the Arabic reason. */
  exec: <R = unknown>(command: ExpensesCommand) => Promise<R>;
};

/** No answer reached the browser: the operation may or may not have run. */
function isLostAnswer(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 0 || err.status === 502 || err.status === 503 || err.status === 504;
  return err instanceof TypeError;
}

/** The command with a `requestId` when it creates a record (not an edit). */
function withRequestId(command: ExpensesCommand): ExpensesCommand {
  if (command.requestId || !IDEMPOTENT_COMMANDS.has(command.type)) return command;
  if (command.type === 'saveExpense' && command.draft.id) return command;
  return { ...command, requestId: randomUUID() };
}

/** The server's refusal (Arabic) or a generic message. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return 'ليست لديك صلاحية لهذا الإجراء.';
    return err.message || 'تعذر التنفيذ';
  }
  return err instanceof Error ? err.message : 'تعذر التنفيذ';
}

export const useExpensesStore = create<ExpensesState>((set, get) => {
  const apply = (view: ExpensesView) => {
    const { actorId, currency, fullAccess, ...data } = view;
    set({ data, actorId, currency, fullAccess });
  };

  const load = async (companyId: string) => {
    try {
      const view = await apiRequest<ExpensesView>('/expenses/data', {
        query: { companyId },
        silent: true,
        throwOnError: true,
      });
      if (get().companyId === companyId) {
        apply(view);
        set({ loadError: null });
      }
    } catch (err) {
      if (get().companyId === companyId) set({ loadError: errorMessage(err) });
    }
  };

  const loadParticipants = async (companyId: string) => {
    try {
      const list = await apiRequest<Participant[]>('/expenses/participants', {
        query: { companyId },
        silent: true,
        throwOnError: true,
      });
      if (get().companyId === companyId) {
        set({ liveParticipants: Array.isArray(list) ? list : [], participants: 'live' });
      }
    } catch {
      if (get().companyId === companyId) set({ liveParticipants: [], participants: 'unavailable' });
    }
  };

  return {
    companyId: null,
    data: null,
    actorId: null,
    currency: 'YER',
    fullAccess: true,
    liveParticipants: [],
    participants: 'loading',
    loadError: null,
    busy: false,

    init: async (companyId) => {
      if (get().companyId === companyId && get().data) {
        // Users and internal contacts change in other apps: refresh who can
        // be chosen each time the app opens, keeping the current list meanwhile.
        await loadParticipants(companyId);
        return;
      }
      set({
        companyId,
        data: null,
        actorId: null,
        loadError: null,
        liveParticipants: [],
        participants: 'loading',
      });
      await Promise.all([load(companyId), loadParticipants(companyId)]);
    },

    reload: async () => {
      const companyId = get().companyId;
      if (companyId) await load(companyId);
    },

    exec: async <R,>(command: ExpensesCommand): Promise<R> => {
      const companyId = get().companyId;
      if (!companyId) throw new Error('البيانات غير جاهزة');
      set({ busy: true });
      try {
        const sent = withRequestId(command);
        const send = () =>
          apiRequest<CommandAnswer<R>>('/expenses/commands', {
            method: 'POST',
            body: { companyId, command: sent, respond: 'changes' },
            silent: true,
            throwOnError: true,
          });
        // No answer: send it once more with the same requestId (runs once).
        const res = await send().catch((err: unknown) => {
          if (isLostAnswer(err) && sent.requestId) return send();
          throw err;
        });
        if (get().companyId === companyId) {
          const { data, fullAccess } = get();
          // A setting can change what this person may read: read it all again.
          if (!data || res.changes.settings || res.fullAccess !== fullAccess) await load(companyId);
          else set({ data: mergeChanges(data, res.changes), actorId: res.actorId, currency: res.currency, fullAccess: res.fullAccess });
        }
        return res.result;
      } catch (err) {
        throw new Error(errorMessage(err));
      } finally {
        set({ busy: false });
      }
    },
  };
});
