'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Settings2, GripVertical, SlidersHorizontal } from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { accountingRoutes } from '@/features/accounting/constants/routes';

export type JournalItem = {
  id: string;
  nameAr: string;
  typeAr: string; // النوع (المبيعات | الشراء | البنك | متفرقات)
  sequencePrefix: string; // بادئة التسلسل
  defaultAccount?: string; // حساب افتراضي
};

const initialJournals: JournalItem[] = [
  {
    id: 'j-1',
    nameAr: 'المبيعات',
    typeAr: 'المبيعات',
    sequencePrefix: 'الفات',
    defaultAccount: 'Product Sales 400000',
  },
  {
    id: 'j-2',
    nameAr: 'المشتريات',
    typeAr: 'الشراء',
    sequencePrefix: 'فاتور',
    defaultAccount: 'Expenses 600000',
  },
  {
    id: 'j-3',
    nameAr: 'البنك',
    typeAr: 'البنك',
    sequencePrefix: 'BNK1',
    defaultAccount: '101401 البنك',
  },
  {
    id: 'j-4',
    nameAr: 'عمليات متنوعة',
    typeAr: 'متفرقات',
    sequencePrefix: 'المتفر',
    defaultAccount: '',
  },
  {
    id: 'j-5',
    nameAr: 'الفرق في سعر الصرف',
    typeAr: 'متفرقات',
    sequencePrefix: 'سعرا',
    defaultAccount: '',
  },
  {
    id: 'j-6',
    nameAr: 'ضرائب بأساس نقدي',
    typeAr: 'متفرقات',
    sequencePrefix: 'CABA',
    defaultAccount: '',
  },
  {
    id: 'j-7',
    nameAr: 'تقييم المخزون',
    typeAr: 'متفرقات',
    sequencePrefix: 'STJ',
    defaultAccount: '',
  },
  {
    id: 'j-8',
    nameAr: 'Tax Returns',
    typeAr: 'متفرقات',
    sequencePrefix: 'TAX',
    defaultAccount: '',
  },
];

export function JournalsListPage() {
  const router = useRouter();
  const [journals] = React.useState<JournalItem[]>(initialJournals);
  const [search, setSearch] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const filtered = journals.filter((j) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [j.nameAr, j.typeAr, j.sequencePrefix, j.defaultAccount]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(term);
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((j) => j.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <SetPageTitle
        titleAr="دفاتر اليومية"
        descriptionAr="إدارة دفاتر اليومية المحاسبية"
        iconName="BookOpen"
      />

      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-background p-1.5 border border-border/40">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4"
            onClick={() => router.push(accountingRoutes.journalNew)}
          >
            جديد
          </Button>
          <span className="text-lg font-semibold text-foreground me-2">
            دفاتر اليومية
          </span>
          <Settings2 className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground" />
        </div>

        {/* Search & Counter */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center min-w-[240px] sm:min-w-[300px]">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث..."
              className="ps-8 h-9 rounded-lg text-sm bg-muted/20"
            />
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>

          <div className="flex items-center gap-1 border-s border-border ps-2">
            <span className="text-xs text-muted-foreground tabular-nums px-2">
              8 / 1-8
            </span>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto rounded-lg border border-border/60 bg-card shadow-xs">
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 bg-muted/30 text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-3 text-start">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selectedIds.length === filtered.length}
                  onChange={toggleSelectAll}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                />
              </th>
              <th className="w-8 px-1 py-3 text-start">
                <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground/70" />
              </th>
              <th className="px-3 py-3 text-start font-semibold text-foreground">
                اسم دفتر اليومية
              </th>
              <th className="px-3 py-3 text-start font-semibold text-foreground">
                النوع
              </th>
              <th className="px-3 py-3 text-start font-semibold text-foreground">
                بادئة التسلسل
              </th>
              <th className="px-3 py-3 text-start font-semibold text-foreground">
                حساب افتراضي
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((j) => {
              const isSelected = selectedIds.includes(j.id);
              return (
                <tr
                  key={j.id}
                  className={`group border-b border-border/40 transition-colors cursor-pointer ${
                    isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'
                  }`}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('input')) return;
                    router.push(accountingRoutes.journalDetail(j.id));
                  }}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectOne(j.id)}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                    />
                  </td>
                  <td className="px-1 py-3 text-muted-foreground/40 group-hover:text-muted-foreground cursor-grab">
                    <GripVertical className="h-4 w-4" />
                  </td>
                  <td className="px-3 py-3 font-medium text-foreground">
                    {j.nameAr}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {j.typeAr}
                  </td>
                  <td className="px-3 py-3 text-foreground font-mono text-xs">
                    {j.sequencePrefix}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {j.defaultAccount || ''}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-12 text-center text-muted-foreground">
                  لا توجد دفاتر يومية مطابقة.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
