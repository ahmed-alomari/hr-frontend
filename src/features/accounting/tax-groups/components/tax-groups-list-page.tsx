'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Settings2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  GripVertical,
  Layers,
} from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { accountingRoutes } from '@/features/accounting/constants/routes';
import { useTaxGroupsStore } from '@/features/accounting/tax-groups/lib/tax-groups-store';

export function TaxGroupsListPage() {
  const router = useRouter();
  const taxGroups = useTaxGroupsStore((state) => state.taxGroups);
  const [search, setSearch] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return taxGroups;
    return taxGroups.filter(
      (tg) =>
        tg.name.toLowerCase().includes(term) ||
        (tg.country && tg.country.toLowerCase().includes(term)) ||
        (tg.taxPayableAccount && tg.taxPayableAccount.toLowerCase().includes(term)) ||
        (tg.taxReceivableAccount && tg.taxReceivableAccount.toLowerCase().includes(term)) ||
        (tg.advanceTaxAccount && tg.advanceTaxAccount.toLowerCase().includes(term)),
    );
  }, [taxGroups, search]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((tg) => tg.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleRowClick = (id: string, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('input[type="checkbox"]') || target.closest('button')) return;
    router.push(accountingRoutes.taxGroupDetail(id));
  };

  return (
    <div className="flex flex-col gap-4">
      <SetPageTitle
        titleAr="مجموعات الضرائب"
        descriptionAr="إدارة مجموعات الضرائب وحسابات الضرائب المستحقة والقبض"
        iconName="Layers"
      />

      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-background p-2 border border-border/40 shadow-xs">
        {/* Right side in RTL (Title and Action) */}
        <div className="flex items-center gap-2 order-1 md:order-2">
          <Button
            type="button"
            className="bg-[#714B67] hover:bg-[#5e3e56] text-white rounded px-4 h-9 font-medium shadow-xs"
            onClick={() => router.push(accountingRoutes.taxGroupNew)}
          >
            جديد
          </Button>
          <div className="flex items-center gap-1.5 me-1">
            <span className="text-lg font-bold text-foreground">مجموعات الضرائب</span>
            <Settings2 className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" />
          </div>
        </div>

        {/* Center: Search & Filter */}
        <div className="flex items-center gap-2 flex-1 max-w-md mx-auto order-3 md:order-2">
          <div className="relative w-full">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="...بحث"
              className="ps-4 pe-10 h-9 rounded-lg text-sm bg-muted/20 border-border/60 focus:bg-background transition-colors"
            />
            <div className="absolute end-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-muted-foreground">
              <Search className="h-4 w-4" />
              <ChevronDown className="h-3 w-3 text-muted-foreground/60" />
            </div>
          </div>
        </div>

        {/* Left side in RTL (Pagination) */}
        <div className="flex items-center gap-2 order-2 md:order-1">
          <div className="flex items-center rounded-md border border-border/60 bg-muted/20 text-muted-foreground">
            <button
              type="button"
              className="p-1.5 hover:text-foreground hover:bg-background rounded-s transition-colors disabled:opacity-40"
              aria-label="الصفحة السابقة"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="p-1.5 hover:text-foreground hover:bg-background rounded-e transition-colors disabled:opacity-40"
              aria-label="الصفحة التالية"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          <span className="text-xs text-muted-foreground font-mono tabular-nums px-1">
            {taxGroups.length} / 1-{filtered.length}
          </span>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-lg border border-border/60 bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-start border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-muted-foreground text-xs select-none">
                <th className="w-10 px-3 py-2.5 text-center font-normal">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.length === filtered.length}
                    onChange={toggleSelectAll}
                    className="h-3.5 w-3.5 rounded border-border/80 accent-primary cursor-pointer align-middle"
                    aria-label="تحديد الكل"
                  />
                </th>
                <th className="px-4 py-2.5 text-start font-medium text-foreground">الاسم</th>
                <th className="px-4 py-2.5 text-start font-medium text-foreground">الدولة</th>
                <th className="px-4 py-2.5 text-start font-medium text-foreground">حساب الضريبة المستحقة</th>
                <th className="px-4 py-2.5 text-start font-medium text-foreground">حساب الضريبة مستحقة القبض</th>
                <th className="px-4 py-2.5 text-start font-medium text-foreground">حساب الضريبة المسبقة</th>
                <th className="px-4 py-2.5 text-end font-medium text-foreground">أداة العرض</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    لا توجد مجموعات ضرائب مطابقة
                  </td>
                </tr>
              ) : (
                filtered.map((tg) => {
                  const isSelected = selectedIds.includes(tg.id);
                  return (
                    <tr
                      key={tg.id}
                      onClick={(e) => handleRowClick(tg.id, e)}
                      className={`group hover:bg-muted/30 transition-colors cursor-pointer ${
                        isSelected ? 'bg-muted/40' : ''
                      }`}
                    >
                      <td className="w-10 px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(tg.id)}
                          className="h-3.5 w-3.5 rounded border-border/80 accent-primary cursor-pointer align-middle"
                          aria-label={`تحديد ${tg.name}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <span>{tg.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{tg.country || '—'}</td>
                      <td className="px-4 py-3 text-foreground font-mono text-xs">{tg.taxPayableAccount || '—'}</td>
                      <td className="px-4 py-3 text-foreground font-mono text-xs">{tg.taxReceivableAccount || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{tg.advanceTaxAccount || '—'}</td>
                      <td className="px-4 py-3 text-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-[#008784] hover:text-[#00706d] hover:bg-teal-50/50 dark:hover:bg-teal-950/20 text-xs px-2 h-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(accountingRoutes.taxGroupDetail(tg.id));
                          }}
                        >
                          أداة العرض
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
