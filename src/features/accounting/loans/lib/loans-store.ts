import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Loan } from '@/features/accounting/domain/types/loan';
import { INITIAL_MOCK_LOANS } from './mock-loans';

interface LoansState {
  loans: Loan[];
  getLoan: (id: string) => Loan | undefined;
  saveLoan: (loan: Loan) => void;
  deleteLoan: (id: string) => void;
  confirmLoan: (id: string) => void; // move to 'running'
  closeLoan: (id: string) => void; // move to 'closed'
  cancelLoan: (id: string) => void;
  resetLoan: (id: string) => void;
}

export const useLoansStore = create<LoansState>()(
  persist(
    (set, get) => ({
      loans: INITIAL_MOCK_LOANS,

      getLoan: (id: string) => {
        return get().loans.find((l) => l.id === id);
      },

      saveLoan: (loan: Loan) => {
        set((state) => {
          const index = state.loans.findIndex((l) => l.id === loan.id);
          if (index >= 0) {
            const updated = [...state.loans];
            updated[index] = loan;
            return { loans: updated };
          }
          return { loans: [loan, ...state.loans] };
        });
      },

      deleteLoan: (id: string) => {
        set((state) => ({
          loans: state.loans.filter((l) => l.id !== id),
        }));
      },

      confirmLoan: (id: string) => {
        set((state) => ({
          loans: state.loans.map((loan) =>
            loan.id === id ? { ...loan, state: 'running' } : loan,
          ),
        }));
      },

      closeLoan: (id: string) => {
        set((state) => ({
          loans: state.loans.map((loan) =>
            loan.id === id ? { ...loan, state: 'closed' } : loan,
          ),
        }));
      },

      cancelLoan: (id: string) => {
        set((state) => ({
          loans: state.loans.map((loan) =>
            loan.id === id ? { ...loan, state: 'draft' } : loan,
          ),
        }));
      },

      resetLoan: (id: string) => {
        set((state) => ({
          loans: state.loans.map((loan) =>
            loan.id === id ? { ...loan, state: 'draft' } : loan,
          ),
        }));
      },
    }),
    {
      name: 'accounting-loans-storage',
    },
  ),
);
