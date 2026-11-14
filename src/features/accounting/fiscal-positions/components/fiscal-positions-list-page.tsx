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
  CalendarRange,
} from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { accountingRoutes } from '@/features/accounting/constants/routes';
import { useFiscalPositionsStore } from '@/features/accounting/fiscal-positions/lib/fiscal-positions-store';

export function FiscalPositionsListPage() {
  const router = useRouter();
  const positions = useFiscalPositionsStore((state) => state.positions);
  const [search, setSearch] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return positions;
    return positions.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.country && p.country.toLowerCase().includes(term)),
    );
  }, [positions, search]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((p) => p.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleRowClick = (id: string, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('input[type="checkbox"]')) return;
    router.push(accountingRoutes.fiscalPositionDetail(id));
  };

  return (
    <div className="flex flex-col gap-4">
      <SetPageTitle
        titleAr="الأوضاع المالية"
        descriptionAr="إدارة الأوضاع المالية وقواعد الضرائب والحسابات"
        iconName="CalendarRange"
      />

      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-background p-2 border border-border/40 shadow-xs">
        {/* Right side in RTL (Title and Action) */}
        <div className="flex items-center gap-2 order-1 md:order-2">
          <Button
            type="button"
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 h-9 font-medium shadow-xs"
            onClick={() => router.push(accountingRoutes.fiscalPositionNew)}
          >
            جديد
          </Button>
          <div className="flex items-center gap-1.5 me-1">
            <span className="text-lg font-bold text-foreground">الأوضاع المالية</span>
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
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="p-1.5 hover:text-foreground hover:bg-background rounded-e transition-colors disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          <span className="text-xs text-muted-foreground font-mono tabular-nums px-1">
            {positions.length} / 1-{filtered.length}
          </span>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto rounded-lg border border-border/60 bg-card shadow-xs">
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 bg-muted/30 text-muted-foreground select-none">
            <tr>
              <th className="w-10 px-3 py-3 text-start">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selectedIds.length === filtered.length}
                  onChange={toggleSelectAll}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                />
              </th>
              <th className="px-4 py-3 text-start font-semibold text-foreground">
                الوضع المالي
              </th>
              <th className="w-10 px-2 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filtered.map((pos) => {
              const isSelected = selectedIds.includes(pos.id);
              return (
                <tr
                  key={pos.id}
                  className={`group transition-colors cursor-pointer ${
                    isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'
                  }`}
                  onClick={(e) => handleRowClick(pos.id, e)}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectOne(pos.id)}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {pos.name}
                  </td>
                  <td className="px-2 py-3 text-muted-foreground/40 group-hover:text-muted-foreground text-end">
                    <GripVertical className="h-4 w-4 ms-auto" />
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-16 text-center text-muted-foreground">
                  <CalendarRange className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  لا توجد أوضاع مالية مطابقة.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
