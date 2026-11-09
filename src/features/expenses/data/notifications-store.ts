import { create } from 'zustand';
import { apiRequest } from '@/features/hr/lib/api/client';
import { getDefaultCompanyId } from '@/features/hr/organization/lib/default-company-id';

export type ExpensesNotification = {
  recipientId: string;
  titleAr: string;
  bodyAr?: string | null;
  severity: string;
  sourceKind?: string | null;
  actionUrl?: string | null;
  actionLabelAr?: string | null;
  createdAt: string;
  readAt: string | null;
};

type ExpensesNotificationsState = {
  items: ExpensesNotification[];
  unreadTotal: number;
  isLoading: boolean;
  fetch: () => Promise<void>;
  markRead: (recipientId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

/** The signed-in user's expenses notifications: the server reads them from the session. */
export const useExpensesNotificationsStore = create<ExpensesNotificationsState>()((set, get) => ({
  items: [],
  unreadTotal: 0,
  isLoading: false,

  fetch: async () => {
    const companyId = getDefaultCompanyId();
    if (!companyId) return;
    set({ isLoading: true });
    try {
      const res = await apiRequest<{ items: ExpensesNotification[]; unread: number }>('/expenses/notifications', {
        query: { companyId },
        silent: true,
        throwOnError: true,
      });
      set({ items: res.items, unreadTotal: res.unread, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  markRead: async (recipientId) => {
    const item = get().items.find((x) => x.recipientId === recipientId);
    if (!item || item.readAt) return;
    set((s) => ({
      items: s.items.map((x) => (x.recipientId === recipientId ? { ...x, readAt: new Date().toISOString() } : x)),
      unreadTotal: Math.max(0, s.unreadTotal - 1),
    }));
    await apiRequest(`/expenses/notifications/${recipientId}/read`, { method: 'POST', silent: true }).catch(() => undefined);
  },

  markAllRead: async () => {
    const companyId = getDefaultCompanyId();
    if (!companyId) return;
    await apiRequest('/expenses/notifications/read-all', { method: 'POST', query: { companyId }, silent: true, throwOnError: true });
    const now = new Date().toISOString();
    set((s) => ({ items: s.items.map((x) => ({ ...x, readAt: x.readAt ?? now })), unreadTotal: 0 }));
  },
}));
