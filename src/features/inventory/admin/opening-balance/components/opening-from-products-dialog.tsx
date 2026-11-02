'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { warehouseOperationsQueryKeys } from '@/features/inventory/admin/hooks/query-keys';
import {
  openingFromProductsApi,
  type OpeningFromProductsPreview,
} from '@/features/inventory/admin/opening-balance/lib/opening-from-products';
import { useWarehouses } from '@/features/inventory/admin/warehouses/hooks/use-warehouses';
import { getInventoryCompanyId } from '@/features/inventory/lib/company-id';
import { handleApiError } from '@/shared/api/global-error-handler';

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

const BLOCKERS: Record<OpeningFromProductsPreview['blockers'][number], string> = {
  channels_linked:
    'كل القنوات (المتجر ونقاط البيع) تبيع من المخازن الآن: كميات المنتجات لم تعد تُستخدم، ونقلها يعدّ البضاعة مرتين.',
  nothing_to_move: 'لا كميات منتجات تُنقل إلى هذا المستودع.',
};

/**
 * The product quantities (products app) become the chosen warehouse's opening
 * at each item's purchase price (backend decisions.md §21.2): nothing is
 * entered twice, and linking the store or the point of sale later is only
 * choosing the warehouse. A draft document: stock moves when it is posted.
 */
export function OpeningFromProductsDialog({ open, onOpenChange }: Props) {
  const companyId = getInventoryCompanyId();
  const queryClient = useQueryClient();
  const [warehouseId, setWarehouseId] = React.useState('');
  const { data: warehousesData } = useWarehouses({ companyId, limit: 200 }, { enabled: open && Boolean(companyId) });
  const warehouses = React.useMemo(() => warehousesData?.items ?? [], [warehousesData]);

  React.useEffect(() => {
    if (open && !warehouseId && warehouses[0]) setWarehouseId(warehouses[0].id);
  }, [open, warehouseId, warehouses]);

  const preview = useQuery({
    queryKey: ['inventory', 'opening-from-products', companyId, warehouseId],
    queryFn: () => openingFromProductsApi.preview(companyId, warehouseId),
    enabled: open && Boolean(companyId && warehouseId),
  });
  const create = useMutation({
    mutationFn: () => openingFromProductsApi.create(companyId, warehouseId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: warehouseOperationsQueryKeys.root(companyId) });
      toast.success(
        `أُنشئ المستند ${result.reference} كمسودة (${result.lines} صنف). راجعه ثم صدّقه ليدخل المستودع.`,
      );
      onOpenChange(false);
    },
    onError: (error) => handleApiError(error, 'inventory.opening-from-products'),
  });

  const p = preview.data;
  const leftOut = p ? p.skipped.filter((item) => item.reason === 'warehouse_has_moves').length : 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !create.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>الرصيد الافتتاحي من كميات المنتجات</DialogTitle>
          <DialogDescription>
            تصبح كمية كل منتج رصيداً افتتاحياً في المستودع بسعر شرائه، فلا تُدخل البضاعة مرتين، ويكفي بعدها اختيار
            المستودع في ربط المتجر ونقاط البيع. يُنشأ مستند مسودة؛ لا يتغيّر المخزون حتى تصدّقه.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>المستودع</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId} disabled={create.isPending}>
              <SelectTrigger aria-label="المستودع">
                <SelectValue placeholder="اختر المستودع" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.nameAr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!warehouseId ? null : preview.isLoading ? (
            <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
          ) : preview.isError || !p ? (
            <button type="button" className="text-sm text-destructive underline" onClick={() => void preview.refetch()}>
              تعذّر تحميل المعاينة — أعد المحاولة
            </button>
          ) : (
            <div className="space-y-2">
              {p.blockers.length > 0 ? (
                <ul className="list-disc space-y-1 ps-5 text-sm text-warning">
                  {p.blockers.map((b) => (
                    <li key={b}>{BLOCKERS[b]}</li>
                  ))}
                </ul>
              ) : null}
              {p.lines.length > 0 ? (
                <div className="max-h-72 overflow-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/60 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-start font-medium">الصنف</th>
                        <th className="px-3 py-2 text-start font-medium">الكمية</th>
                        <th className="px-3 py-2 text-start font-medium">سعر الشراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.lines.map((l) => (
                        <tr key={`${l.productId}:${l.variantId ?? ''}`} className="border-t border-border">
                          <td className="px-3 py-2">{l.name}</td>
                          <td className="px-3 py-2 tabular-nums">{l.quantity}</td>
                          <td className="px-3 py-2 tabular-nums">
                            {l.unitCost ?? <span className="text-warning">بلا سعر — حدده قبل التصديق</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {leftOut > 0 ? (
                <p className="text-xs text-muted-foreground">
                  يُترك {leftOut} صنف له حركة في هذا المستودع، فلا يُحسب مرتين.
                </p>
              ) : null}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            إلغاء
          </Button>
          <Button type="button" onClick={() => create.mutate()} disabled={!p?.canCreate || create.isPending}>
            {create.isPending ? 'جارٍ الإنشاء…' : 'أنشئ مسودة الرصيد الافتتاحي'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
