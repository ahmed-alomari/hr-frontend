'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  LayoutList,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Coins,
} from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { accountingRoutes } from '@/features/accounting/constants/routes';
import { useCurrenciesStore } from '@/features/accounting/currencies/lib/currencies-store';
import type { Currency } from '@/features/accounting/domain/types/currency';

export function CurrenciesListPage() {
  const router = useRouter();
  const currencies = useCurrenciesStore((state) => state.currencies);
  const baseCurrencyCode = useCurrenciesStore((state) => state.baseCurrencyCode);
  const toggleActive = useCurrenciesStore((state) => state.toggleActive);

  const [search, setSearch] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [viewMode, setViewMode] = React.useState<'list' | 'kanban'>('list');
  const [activeFilter, setActiveFilter] = React.useState<'all' | 'active' | 'inactive'>('all');

  const filtered = React.useMemo(() => {
    return currencies.filter((c) => {
      if (activeFilter === 'active' && !c.active) return false;
      if (activeFilter === 'inactive' && c.active) return false;

      const term = search.trim().toLowerCase();
      if (!term) return true;
      return (
        c.code.toLowerCase().includes(term) ||
        c.nameAr.toLowerCase().includes(term) ||
        c.symbol.toLowerCase().includes(term) ||
        (c.currencyUnit && c.currencyUnit.toLowerCase().includes(term))
      );
    });
  }, [currencies, search, activeFilter]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((c) => c.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleRowClick = (currencyId: string, e: React.MouseEvent) => {
    // Avoid opening row if click was on a checkbox or switch
    const target = e.target as HTMLElement;
    if (target.closest('input[type="checkbox"]') || target.closest('button[role="switch"]')) {
      return;
    }
    router.push(accountingRoutes.currencyDetail(currencyId));
  };

  const formatRate = (rate?: number) => {
    if (rate === undefined || rate === null) return '1.000000';
    if (rate === 1) return '1.000000';
    // Format to 6 decimal places
    return rate.toFixed(6);
  };

  return (
    <div className="flex flex-col gap-4">
      <SetPageTitle
        titleAr="العملات"
        descriptionAr="إدارة أسعار العملات وتكوينها"
        iconName="Coins"
      />

      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-background p-2 border border-border/40 shadow-xs">
        {/* Right side in RTL (Title and Action) */}
        <div className="flex items-center gap-2 order-1 md:order-2">
          <Button
            type="button"
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 h-9 font-medium shadow-xs"
            onClick={() => router.push(accountingRoutes.currencyNew)}
          >
            جديد
          </Button>
          <div className="flex items-center gap-1.5 me-1">
            <span className="text-lg font-bold text-foreground">العملات</span>
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

        {/* Left side in RTL (Views switcher & Pagination) */}
        <div className="flex items-center gap-2 order-2 md:order-1">
          {/* View Mode Switcher */}
          <div className="flex items-center rounded-md border border-border/60 p-0.5 bg-muted/20">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="عرض القائمة"
              className={`p-1.5 rounded transition-all ${
                viewMode === 'list'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              title="عرض البطاقات"
              className={`p-1.5 rounded transition-all ${
                viewMode === 'kanban'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>

          {/* Pagination Navigation */}
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

          {/* Pagination Counter text */}
          <span className="text-xs text-muted-foreground font-mono tabular-nums px-1">
            {currencies.length} / 1-{filtered.length}
          </span>
        </div>
      </div>

      {/* Main Table / Kanban Content */}
      {viewMode === 'list' ? (
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
                  العملة
                </th>
                <th className="px-4 py-3 text-start font-semibold text-foreground">
                  الرمز
                </th>
                <th className="px-4 py-3 text-start font-semibold text-foreground">
                  الاسم
                </th>
                <th className="px-4 py-3 text-start font-semibold text-foreground">
                  آخر تحديث
                </th>
                <th className="px-4 py-3 text-start font-semibold text-foreground">
                  وحدة لكل {baseCurrencyCode}
                </th>
                <th className="px-4 py-3 text-start font-semibold text-foreground">
                  نشط
                </th>
                <th className="w-8 px-2 py-3 text-start">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground/70" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.map((currency) => {
                const isSelected = selectedIds.includes(currency.id);
                return (
                  <tr
                    key={currency.id}
                    className={`group transition-colors cursor-pointer ${
                      isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'
                    }`}
                    onClick={(e) => handleRowClick(currency.id, e)}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(currency.id)}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground font-mono">
                      {currency.code}
                    </td>
                    <td className="px-4 py-3 text-foreground font-medium">
                      {currency.symbol}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-normal">
                      {currency.nameAr}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {currency.lastUpdated || '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums text-foreground">
                      {formatRate(currency.unitPerBaseRate)}
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={currency.active}
                        onCheckedChange={() => toggleActive(currency.id)}
                        aria-label={`تفعيل ${currency.nameAr}`}
                      />
                    </td>
                    <td className="px-2 py-3" />
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">
                    <Coins className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                    لا توجد عملات مطابقة لبحثك.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Kanban View Option */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((currency) => (
            <div
              key={currency.id}
              onClick={(e) => handleRowClick(currency.id, e)}
              className="rounded-xl border border-border/60 bg-card p-4 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-3 group hover:border-primary/40"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-foreground font-mono">{currency.code}</span>
                    <span className="text-sm font-medium text-muted-foreground">({currency.symbol})</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{currency.nameAr}</p>
                </div>
                <Switch
                  checked={currency.active}
                  onCheckedChange={() => toggleActive(currency.id)}
                  aria-label={`تفعيل ${currency.nameAr}`}
                />
              </div>

              <div className="border-t border-border/40 pt-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">وحدة لكل {baseCurrencyCode}:</span>
                <span className="font-mono font-medium text-foreground">{formatRate(currency.unitPerBaseRate)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
