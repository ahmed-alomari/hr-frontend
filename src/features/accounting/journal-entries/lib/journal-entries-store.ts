import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { JournalEntry } from '@/features/accounting/domain/types/journal-entry';
import { INITIAL_MOCK_JOURNAL_ENTRIES } from './mock-journal-entries';

interface JournalEntriesState {
  entries: JournalEntry[];
  getEntry: (id: string) => JournalEntry | undefined;
  saveEntry: (entry: JournalEntry) => void;
  deleteEntry: (id: string) => void;
  postEntry: (id: string) => void;
  resetToDraft: (id: string) => void;
  reverseEntry: (id: string) => string | undefined; // returns new reversed entry ID
}

export const useJournalEntriesStore = create<JournalEntriesState>()(
  persist(
    (set, get) => ({
      entries: INITIAL_MOCK_JOURNAL_ENTRIES,

      getEntry: (id: string) => {
        return get().entries.find((e) => e.id === id);
      },

      saveEntry: (entry: JournalEntry) => {
        set((state) => {
          const index = state.entries.findIndex((e) => e.id === entry.id);
          if (index >= 0) {
            const updated = [...state.entries];
            updated[index] = entry;
            return { entries: updated };
          }
          return { entries: [entry, ...state.entries] };
        });
      },

      deleteEntry: (id: string) => {
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
        }));
      },

      postEntry: (id: string) => {
        set((state) => ({
          entries: state.entries.map((entry) => {
            if (entry.id !== id) return entry;
            const isDraftNumber = !entry.name || entry.name.startsWith('مسودة') || entry.name === '/';
            return {
              ...entry,
              state: 'posted',
              name: isDraftNumber ? `المتف/2026/09/${String(state.entries.length + 1).padStart(4, '0')}` : entry.name,
            };
          }),
        }));
      },

      resetToDraft: (id: string) => {
        set((state) => ({
          entries: state.entries.map((entry) =>
            entry.id === id ? { ...entry, state: 'draft' } : entry,
          ),
        }));
      },

      reverseEntry: (id: string) => {
        const source = get().entries.find((e) => e.id === id);
        if (!source) return undefined;

        const reversedId = `je-${Date.now()}`;
        const reversedItems = source.items.map((item, idx) => ({
          ...item,
          id: `ji-rev-${Date.now()}-${idx}`,
          name: `عكس قيد: ${source.name} - ${item.name}`,
          debit: item.credit, // swap debit & credit
          credit: item.debit,
        }));

        const newEntry: JournalEntry = {
          ...source,
          id: reversedId,
          name: `عكس/${source.name}`,
          date: new Date().toISOString().split('T')[0],
          accountingDate: new Date().toISOString().split('T')[0],
          reference: `Reversal of ${source.name}`,
          state: 'draft',
          items: reversedItems,
        };

        set((state) => ({
          entries: [newEntry, ...state.entries],
        }));

        return reversedId;
      },
    }),
    {
      name: 'accounting-journal-entries-storage',
    },
  ),
);
