'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCan } from '@/features/auth/hooks/use-can';
import { getInventoryCompanyId } from '@/features/inventory/lib/company-id';
import { useWarehouses } from '@/features/inventory/admin/warehouses/hooks/use-warehouses';
import { warehouseOperationsQueryKeys } from '@/features/inventory/admin/hooks/query-keys';
import {
  fetchReplenishmentSuggestions,
  warehouseOperationsApi,
} from '@/features/inventory/admin/operations/lib/api/warehouse-operations';
import { newOperationLineDraftId } from '@/features/inventory/admin/operations/lib/operation-line-draft';
import { FlexibleQuantityInput } from '@/features/inventory/admin/operations/components/flexible-quantity-input';
import { WarehouseOperationDetailDialog } from '@/features/inventory/admin/operations/components/warehouse-operation-detail-dialog';
import { WarehouseOperationsPanel } from '@/features/inventory/admin/operations/components/warehouse-operations-panel';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import { RegisterExportMenu } from '@/components/pdf/register-export-menu';
import { registerExportRows, type RegisterExportColumn } from '@/components/pdf/lib/register-export-rows';
import { SUGGESTIONS_REPLENISHMENT_SOURCE_DOCUMENT } from '@/features/catalog/products/constants/replenishment';
import type {
  ReplenishmentSuggestion,
  WarehouseOperation,
} from '@/features/inventory/domain/types/warehouse';

const ALL_WAREHOUSES = 'all';

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
}

/**
 * Replenishment: the products at or below their low-stock
 * threshold (counting what open purchase orders will bring), and a purchase
 * order drafted from the ones picked. Stock enters only when that order is
 * received. Each drafted order stays listed as a replenishment request, its
 * decision read from the order: confirmed accepts it, cancelled rejects it.
 */
export function ReplenishmentPage() {
  const companyId = getInventoryCompanyId();
  const can = useCan();
  const canCreate = can('inv.warehouse.operations.create');
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState('suggestions');
  const [warehouseId, setWarehouseId] = React.useState('');
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = React.useState<Record<string, number>>({});
  const [creating, setCreating] = React.useState(false);
  const [createdOrder, setCreatedOrder] = React.useState<WarehouseOperation | null>(null);

  const { data: warehousesData } = useWarehouses(
    { companyId, limit: 100 },
    { enabled: Boolean(companyId) },
  );
  const warehouses = React.useMemo(() => warehousesData?.items ?? [], [warehousesData?.items]);

  React.useEffect(() => {
    if (!warehouseId && warehouses.length > 0) setWarehouseId(warehouses[0]!.id);
  }, [warehouseId, warehouses]);

  React.useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const scopedWarehouseId = warehouseId && warehouseId !== ALL_WAREHOUSES ? warehouseId : undefined;
  const suggestionsQuery = useQuery({
    queryKey: [
      ...warehouseOperationsQueryKeys.root(companyId),
      'replenishment-suggestions',
      { warehouseId: scopedWarehouseId ?? null, search },
    ],
    queryFn: () =>
      fetchReplenishmentSuggestions({ companyId, warehouseId: scopedWarehouseId, search: search || undefined }),
    enabled: Boolean(companyId && warehouseId),
  });
  const suggestions = React.useMemo(() => suggestionsQuery.data ?? [], [suggestionsQuery.data]);

  // A new list (other warehouse, search, refetch) starts from its suggested quantities.
  React.useEffect(() => {
    setSelected({});
    setQuantities(Object.fromEntries(suggestions.map((row) => [row.productId, row.suggestedQuantity])));
  }, [suggestions]);

  const selectable = (row: ReplenishmentSuggestion) => !row.hasVariants;
  const pickedRows = suggestions.filter(
    (row) => selectable(row) && selected[row.productId] && (quantities[row.productId] ?? 0) > 0,
  );
  const selectableRows = suggestions.filter(selectable);
  const allSelected =
    selectableRows.length > 0 && selectableRows.every((row) => selected[row.productId]);

  function toggleAll(next: boolean) {
    setSelected(Object.fromEntries(selectableRows.map((row) => [row.productId, next])));
  }

  async function createPurchaseOrder() {
    if (!companyId || !scopedWarehouseId || pickedRows.length === 0 || creating) return;
    setCreating(true);
    try {
      const created = await warehouseOperationsApi.create({
        companyId,
        warehouseId: scopedWarehouseId,
        kind: 'purchase_order',
        origin: 'replenishment',
        status: 'draft',
        occurredAt: new Date().toISOString(),
        sourceDocument: SUGGESTIONS_REPLENISHMENT_SOURCE_DOCUMENT,
        lines: pickedRows.map((row) => ({
          id: newOperationLineDraftId(),
          productId: row.productId,
          productName: row.productName,
          sku: row.sku ?? undefined,
          demandQuantity: quantities[row.productId]!,
          quantity: quantities[row.productId]!,
        })),
      });
      void queryClient.invalidateQueries({ queryKey: warehouseOperationsQueryKeys.root(companyId) });
      toast.success(
        `أُنشئ طلب التجديد ${created.reference} كأمر شراء مسودة. اختر المورد وراجع الأسعار، ثم أكّده لقبوله أو ألغه لرفضه.`,
      );
      setCreatedOrder((await warehouseOperationsApi.getById(companyId, created.id)) ?? created);
    } catch (error) {
      const { displayMessage } = handleApiError(error, 'ecommerce.warehouseOperations.create');
      toast.error(displayMessage);
    } finally {
      setCreating(false);
    }
  }

  const quantityInput = (row: ReplenishmentSuggestion) => (
    <FlexibleQuantityInput
      className="h-9 w-28"
      aria-label={`كمية ${row.productName}`}
      value={quantities[row.productId] ?? 0}
      disabled={!selectable(row)}
      onChange={(quantity) => setQuantities((prev) => ({ ...prev, [row.productId]: quantity }))}
    />
  );

  const rowCheckbox = (row: ReplenishmentSuggestion) => (
    <Checkbox
      aria-label={`اختيار ${row.productName}`}
      checked={Boolean(selected[row.productId])}
      disabled={!selectable(row)}
      onCheckedChange={(next) => setSelected((prev) => ({ ...prev, [row.productId]: next === true }))}
    />
  );

  const exportColumns: RegisterExportColumn<ReplenishmentSuggestion>[] = [
    { label: 'المنتج', kind: 'name', value: (row) => row.productName },
    { label: 'SKU', kind: 'code', value: (row) => row.sku ?? '' },
    { label: 'الرصيد', kind: 'number', value: (row) => formatQuantity(row.onHand) },
    { label: 'منتظر من أوامر الشراء', kind: 'number', value: (row) => formatQuantity(row.onOrder) },
    { label: 'حدّ التنبيه', kind: 'number', value: (row) => formatQuantity(row.threshold) },
    {
      label: 'الكمية المطلوبة',
      kind: 'number',
      value: (row) => formatQuantity(quantities[row.productId] ?? row.suggestedQuantity),
    },
  ];

  const variantsNote = (
    <p className="text-xs text-muted-foreground">له متغيرات: أضف كل متغير إلى أمر الشراء بنفسك.</p>
  );

  const suggestionsBody = (
    <div className="flex flex-col gap-4">
      <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        المنتجات التي وصل رصيدها، مع ما ستجلبه أوامر الشراء المفتوحة، إلى حدّ تنبيه انخفاض المخزون أو أقل.
        اختر ما تريد شراءه وعدّل الكمية، ثم أنشئ أمر شراء. البضاعة لا تدخل المخزون إلا باستلامها من أمر الشراء.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <Select value={warehouseId || undefined} onValueChange={setWarehouseId}>
          <SelectTrigger className="h-10 w-full sm:w-56" aria-label="المستودع">
            <SelectValue placeholder="المستودع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_WAREHOUSES}>كل المستودعات</SelectItem>
            {warehouses.map((warehouse) => (
              <SelectItem key={warehouse.id} value={warehouse.id}>
                {warehouse.nameAr}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="h-10 w-full sm:w-64"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="ابحث بالاسم أو الرمز…"
          aria-label="بحث"
        />
        <div className="sm:ms-auto">
          <RegisterExportMenu
            title="اقتراحات تجديد المخزون"
            fileName="inventory-replenishment"
            columns={exportColumns}
            getRows={async () => registerExportRows({ columns: exportColumns, rows: suggestions })}
            subtitleLines={[
              warehouseId === ALL_WAREHOUSES
                ? 'كل المستودعات'
                : `المستودع: ${warehouses.find((w) => w.id === warehouseId)?.nameAr ?? ''}`,
              ...(search ? [`بحث: ${search}`] : []),
            ]}
            emptyMessage="لا توجد اقتراحات تجديد ضمن الفلاتر الحالية."
          />
        </div>
        {canCreate ? (
          <Button
            type="button"
            className="h-10 max-sm:w-full"
            disabled={!scopedWarehouseId || pickedRows.length === 0 || creating}
            onClick={() => void createPurchaseOrder()}
          >
            <ClipboardList className="h-4 w-4" />
            {creating
              ? 'جاري الإنشاء…'
              : pickedRows.length > 0
                ? `إنشاء أمر شراء (${pickedRows.length})`
                : 'إنشاء أمر شراء'}
          </Button>
        ) : null}
      </div>
      {canCreate && !scopedWarehouseId && warehouseId ? (
        <p className="text-xs text-muted-foreground">اختر المستودع الذي سيستلم البضاعة لإنشاء أمر شراء.</p>
      ) : null}

      {suggestionsQuery.isError ? (
        <p className="text-sm text-destructive">تعذر تحميل اقتراحات التجديد.</p>
      ) : suggestionsQuery.isLoading || !warehouseId ? (
        <p className="text-sm text-muted-foreground">جاري التحميل…</p>
      ) : suggestions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          لا توجد منتجات تحتاج تجديداً: كل الأرصدة، مع المنتظر من أوامر الشراء، فوق حدّ التنبيه.
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-border sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                  <th className="w-10 px-3 py-2.5">
                    <Checkbox
                      aria-label="اختيار الكل"
                      checked={allSelected}
                      disabled={selectableRows.length === 0}
                      onCheckedChange={(next) => toggleAll(next === true)}
                    />
                  </th>
                  <th className="px-3 py-2.5 text-start font-medium">المنتج</th>
                  <th className="px-3 py-2.5 text-center font-medium">الرصيد</th>
                  <th className="px-3 py-2.5 text-center font-medium">منتظر من أوامر الشراء</th>
                  <th className="px-3 py-2.5 text-center font-medium">حدّ التنبيه</th>
                  <th className="px-3 py-2.5 text-start font-medium">الكمية المطلوبة</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((row) => (
                  <tr key={row.productId} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5">{rowCheckbox(row)}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{row.productName}</div>
                      {row.sku ? (
                        <div className="text-xs text-muted-foreground" dir="ltr">
                          {row.sku}
                        </div>
                      ) : null}
                      {row.hasVariants ? variantsNote : null}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{formatQuantity(row.onHand)}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{formatQuantity(row.onOrder)}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{formatQuantity(row.threshold)}</td>
                    <td className="px-3 py-2.5">{quantityInput(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 sm:hidden">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={allSelected}
                disabled={selectableRows.length === 0}
                onCheckedChange={(next) => toggleAll(next === true)}
              />
              اختيار الكل
            </label>
            {suggestions.map((row) => (
              <div key={row.productId} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-start gap-2">
                  <div className="pt-0.5">{rowCheckbox(row)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{row.productName}</p>
                    {row.sku ? (
                      <p className="text-xs text-muted-foreground" dir="ltr">
                        {row.sku}
                      </p>
                    ) : null}
                    {row.hasVariants ? variantsNote : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="subtle">الرصيد {formatQuantity(row.onHand)}</Badge>
                  <Badge variant="subtle">منتظر {formatQuantity(row.onOrder)}</Badge>
                  <Badge variant="subtle">الحدّ {formatQuantity(row.threshold)}</Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">الكمية المطلوبة</span>
                  {quantityInput(row)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <SetPageTitle
        titleAr="تجديد المخزون"
        descriptionAr="اقتراحات الشراء للمنتجات التي وصلت إلى حدّ التنبيه، وإنشاء أمر شراء منها."
        iconName="Package"
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="suggestions">الاقتراحات</TabsTrigger>
          <TabsTrigger value="requests">طلبات التجديد</TabsTrigger>
        </TabsList>
        <TabsContent value="suggestions" className="mt-4">
          {suggestionsBody}
        </TabsContent>
        <TabsContent value="requests" className="mt-4">
          <p className="mb-4 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            كل طلب تجديد هو أمر شراء: يبقى «بانتظار القرار» وهو مسودة، ويصبح «مقبولاً» بتأكيد أمر الشراء،
            و«مرفوضاً» بإلغائه مع كتابة السبب.
          </p>
          <WarehouseOperationsPanel kind="purchase_order" origin="replenishment" enableInventoryFilters />
        </TabsContent>
      </Tabs>

      <WarehouseOperationDetailDialog
        open={Boolean(createdOrder)}
        onOpenChange={(next) => {
          if (!next) setCreatedOrder(null);
        }}
        operation={createdOrder}
      />
    </div>
  );
}
