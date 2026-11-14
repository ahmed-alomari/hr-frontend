'use client';

import * as React from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePosContext } from '@/features/pos/hooks/use-pos-context';
import { usePosMenuCategories } from '@/features/pos/hooks/use-pos-menu-categories';
import { formatDateTime, formatMoney } from '@/features/pos/lib/format';
import { menuCategoryReport } from '@/features/pos/lib/menu-category-report';
import { POS_HISTORY_DAYS, usePosData } from '@/features/pos/lib/pos-store';
import { downloadXlsxFromAoA } from '@/shared/export/download-xlsx';

const PERIODS = [7, 30, POS_HISTORY_DAYS];

const periodStart = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

/** Each selling group added: when, its products, and what it sold. */
export function PosMenuCategoriesReport() {
  const { companyId, currency } = usePosContext();
  const categories = usePosMenuCategories(companyId);
  // This report reads history, unlike the settings around it.
  const data = usePosData(companyId, POS_HISTORY_DAYS);
  const [days, setDays] = React.useState(30);
  const rows = React.useMemo(() => {
    return menuCategoryReport(categories.data ?? [], data.sales, periodStart(days));
  }, [categories.data, data.sales, days]);

  const exportExcel = () =>
    downloadXlsxFromAoA(`pos-categories-${days}d.xlsx`, 'تقرير الفئات', [
      ['الفئة', 'أضيفت في', 'الأصناف', 'الكمية المباعة', 'المرتجع', 'الفواتير', 'صافي المبيعات'],
      ...rows.map((r) => [r.name, r.createdAt ? formatDateTime(r.createdAt) : '', r.id ? r.productCount : '', r.soldQuantity, r.returnedQuantity, r.invoices, r.netSales]),
    ]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">تقرير الفئات</h2>
          <p className="text-xs text-muted-foreground">الفئات المضافة، وأصنافها، وما بيع منها بعد المرتجعات.</p>
        </div>
        <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={rows.length === 0} onClick={() => void exportExcel()}>
          <Download className="h-4 w-4" />
          Excel
        </Button>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="h-9 w-36" aria-label="الفترة">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((d) => (
              <SelectItem key={d} value={String(d)}>
                آخر {d} يومًا
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        </div>
      </div>
      {categories.isError ? (
        <p className="text-sm text-destructive">تعذّر تحميل الفئات.</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">لا فئات بعد.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-start">الفئة</th>
                <th className="px-3 py-2 text-start">أضيفت في</th>
                <th className="px-3 py-2 text-start">الأصناف</th>
                <th className="px-3 py-2 text-start">الكمية المباعة</th>
                <th className="px-3 py-2 text-start">المرتجع</th>
                <th className="px-3 py-2 text-start">الفواتير</th>
                <th className="px-3 py-2 text-start">صافي المبيعات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id ?? 'none'} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.createdAt ? formatDateTime(r.createdAt) : '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{r.id ? r.productCount : '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{r.soldQuantity}</td>
                  <td className="px-3 py-2 tabular-nums">{r.returnedQuantity}</td>
                  <td className="px-3 py-2 tabular-nums">{r.invoices}</td>
                  <td className="px-3 py-2 tabular-nums">{formatMoney(r.netSales, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        «بلا فئة»: أصناف لم تُسند إلى فئة، أو بيعت قبل حفظ الفئة على البيع.
      </p>
    </div>
  );
}
