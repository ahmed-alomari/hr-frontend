'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Filter, SlidersHorizontal, Settings2, GripVertical } from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { RowActions } from '@/components/ui/row-actions';
import { accountingRoutes } from '@/features/accounting/constants/routes';

export type TaxItem = {
  id: string;
  nameAr: string;
  description?: string;
  taxType: 'sales' | 'purchases'; // نوع الضريبة: المبيعات | المشتريات
  taxScope?: string; // نطاق الضريبة
  invoiceLabel?: string; // بطاقة العنوان على الفواتير
  active: boolean; // نشط
};

const initialTaxes: TaxItem[] = [
  {
    id: 'tax-1',
    nameAr: '15%',
    description: '',
    taxType: 'sales',
    taxScope: '',
    invoiceLabel: '',
    active: true,
  },
  {
    id: 'tax-2',
    nameAr: '15%',
    description: '',
    taxType: 'purchases',
    taxScope: '',
    invoiceLabel: '',
    active: true,
  },
  {
    id: 'tax-3',
    nameAr: 'Exports 0%',
    description: '',
    taxType: 'sales',
    taxScope: '',
    invoiceLabel: '',
    active: true,
  },
  {
    id: 'tax-4',
    nameAr: 'Imports 0%',
    description: '',
    taxType: 'purchases',
    taxScope: '',
    invoiceLabel: '',
    active: true,
  },
];

export function TaxesListPage() {
  const router = useRouter();
  const [taxes, setTaxes] = React.useState<TaxItem[]>(initialTaxes);
  const [search, setSearch] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const toggleActive = (id: string) => {
    setTaxes((prev) =>
      prev.map((t) => (t.id === id ? { ...t, active: !t.active } : t)),
    );
  };

  const filtered = taxes.filter((t) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    const typeLabel = t.taxType === 'sales' ? 'المبيعات' : 'المشتريات';
    return [t.nameAr, t.description, typeLabel, t.invoiceLabel]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(term);
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((t) => t.id));
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
        titleAr="الضرائب"
        descriptionAr="إدارة واحتساب الضرائب"
        iconName="Percent"
      />

      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-background p-1.5 border border-border/40">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4"
            onClick={() => router.push(accountingRoutes.taxNew)}
          >
            جديد
          </Button>
          <span className="text-lg font-semibold text-foreground me-2">
            الضرائب
          </span>
          <Settings2 className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground" />
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center min-w-[260px] sm:min-w-[340px]">
            <div className="relative flex-1">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث..."
                className="ps-8 pe-14 h-9 rounded-lg text-sm bg-muted/20"
              />
              <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              {/* Filter badge tag inside input */}
              <div className="absolute end-2 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary border border-primary/20">
                <Filter className="h-3 w-3" />
                <span>بيع / الشراء</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 border-s border-border ps-2">
            <span className="text-xs text-muted-foreground tabular-nums px-2">
              1 / 1-4
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
                اسم الضريبة
              </th>
              <th className="px-3 py-3 text-start font-semibold text-foreground">
                الوصف
              </th>
              <th className="px-3 py-3 text-start font-semibold text-foreground">
                نوع الضريبة
              </th>
              <th className="px-3 py-3 text-start font-semibold text-foreground">
                نطاق الضريبة
              </th>
              <th className="px-3 py-3 text-start font-semibold text-foreground">
                بطاقة العنوان على الفواتير
              </th>
              <th className="px-3 py-3 text-start font-semibold text-foreground">
                نشط
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tax) => {
              const isSelected = selectedIds.includes(tax.id);
              return (
                <tr
                  key={tax.id}
                  className={`group border-b border-border/40 transition-colors cursor-pointer ${
                    isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'
                  }`}
                  onClick={(e) => {
                    // avoid opening row if click was inside checkbox or switch
                    if ((e.target as HTMLElement).closest('input') || (e.target as HTMLElement).closest('button[role="switch"]')) return;
                    router.push(accountingRoutes.taxDetail(tax.id));
                  }}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectOne(tax.id)}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                    />
                  </td>
                  <td className="px-1 py-3 text-muted-foreground/40 group-hover:text-muted-foreground cursor-grab">
                    <GripVertical className="h-4 w-4" />
                  </td>
                  <td className="px-3 py-3 font-medium text-foreground">
                    {tax.nameAr}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {tax.description || '—'}
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-primary font-medium">
                      {tax.taxType === 'sales' ? 'المبيعات' : 'المشتريات'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {tax.taxScope || '—'}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {tax.invoiceLabel || '—'}
                  </td>
                  <td className="px-3 py-3">
                    <Switch
                      checked={tax.active}
                      onCheckedChange={() => toggleActive(tax.id)}
                      aria-label="نشط"
                    />
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-12 text-center text-muted-foreground"
                >
                  لا توجد ضرائب مطابقة.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
