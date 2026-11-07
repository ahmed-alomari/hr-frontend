import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ReconciliationAccountGroup } from '@/features/accounting/domain/types/reconciliation';
import { INITIAL_MOCK_RECONCILIATIONS } from './mock-reconciliation';

interface ReconciliationState {
  accountGroups: ReconciliationAccountGroup[];
  autoReconcile: () => void;
  reconcileItem: (itemId: string) => void;
}

export const useReconciliationStore = create<ReconciliationState>()(
  persist(
    (set) => ({
      accountGroups: INITIAL_MOCK_RECONCILIATIONS,

      autoReconcile: () => {
        // Run auto reconciliation
      },

      reconcileItem: (itemId: string) => {
        set((state) => ({
          accountGroups: state.accountGroups.map((group) => ({
            ...group,
            partnerGroups: group.partnerGroups.map((pg) => ({
              ...pg,
              items: pg.items.filter((item) => item.id !== itemId),
            })),
          })),
        }));
      },
    }),
    {
      name: 'accounting-reconciliation-storage',
    },
  ),
);
