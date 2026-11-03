'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Can } from '@/components/shared/can';
import { PageHeaderPrimaryButton } from '@/components/layouts/page-header-primary-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCan } from '@/features/auth/hooks/use-can';
import { useHeaderExtrasBridge } from '@/features/ecommerce/admin/cms/settings/lib/use-header-extras-bridge';
import {
  stockSyncApi,
  stockSyncStatusApi,
  type StockSyncItem,
  type StockSyncPreview,
  type StockSyncRun,
  type StockSyncStatus,
} from '@/features/ecommerce/admin/stock/lib/api/stock-sync-api';
import { storeStockOpeningApi } from '@/features/ecommerce/admin/stock/lib/api/store-stock-api';
import { ecommerceAdminRoutes } from '@/features/ecommerce/admin/constants/routes';
import { handleApiError } from '@/shared/api/global-error-handler';
import { cn } from '@/shared/utils';

const READ = 'sta.stock.read';
const UPDATE = 'sta.stock.update';

const KIND_LABEL: Record<string, string> = {
  enable: 'عند تفعيل الربط',
  disable: 'عند تعطيل الربط',
  manual: 'يدوي',
};

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return value;
  }
}

const qty = (n: number | null) => (n === null ? '—' : Number(n.toFixed(4)).toString());

/**
 * The store–inventory link (phase 4): the store's warehouse, the preview
 * before enabling (and what stops it), draining before disabling, the open
 * work (reservation shortfalls, older orders to review), the local opening
 * (while draining or after disabling), and the reconciliation reports.
 */
export function StockSyncPanel({
  companyId,
  onHeaderExtrasChange,
}: {
  companyId: string;
  onHeaderExtrasChange?: (node: React.ReactNode | null) => void;
}) {
  const can = useCan();
  const canUpdate = can(UPDATE);
  const queryClient = useQueryClient();
  const statusKey = ['ecommerce', 'stock-sync', 'status', companyId];
  const runsKey = ['ecommerce', 'stock-sync', 'runs', companyId];
  const status = useQuery({
    queryKey: statusKey,
    queryFn: () => stockSyncStatusApi.get(companyId),
    enabled: Boolean(companyId) && can(READ),
  });
  const runs = useQuery({
    queryKey: runsKey,
    queryFn: () => stockSyncApi.list(companyId),
    enabled: Boolean(companyId) && can(READ),
  });
  const previewKey = ['ecommerce', 'stock-sync', 'preview', companyId];
  const s = status.data;
  // Before enabling (what it would do), and for the local opening (draining
  // or after disabling): the store's items against the store warehouse.
  const needsPreview = Boolean(s && (!s.enabled || s.state === 'draining'));
  const preview = useQuery({
    queryKey: previewKey,
    queryFn: () => stockSyncStatusApi.preview(companyId),
    enabled: Boolean(companyId) && can(READ) && needsPreview,
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: statusKey });
    void queryClient.invalidateQueries({ queryKey: runsKey });
    void queryClient.invalidateQueries({ queryKey: previewKey });
  };
  const onError = (error: unknown) => {
    handleApiError(error, 'ecommerce.stock-sync');
  };
  const run = useMutation({
    mutationFn: () => stockSyncApi.run(companyId),
    onSuccess: () => {
      toast.success('تمت المطابقة وضُبطت حالة التوفر من مستودع المتجر');
      refresh();
    },
    onError,
  });

  const canRun =Boolean(s?.enabled && s.warehouseId) && canUpdate;
  useHeaderExtrasBridge(
    onHeaderExtrasChange,
    () =>
      canRun ? (
        <PageHeaderPrimaryButton
          icon={RefreshCw}
          label={run.isPending ? 'جارٍ المطابقة…' : 'مطابقة الآن'}
          className="h-10 px-3.5 text-sm"
          disabled={run.isPending}
          loading={run.isPending}
          onClick={() => run.mutate()}
        />
      ) : null,
    [canRun, run.isPending, onHeaderExtrasChange],
  );

  return (
    <Can
      permission={READ}
      fallback={<p className="text-sm text-muted-foreground">لا تملك صلاحية عرض كميات المنتجات.</p>}
    >
      {status.isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-muted/40" />
      ) : status.isError || !s ? (
        <button type="button" className="text-sm text-destructive underline" onClick={() => void status.refetch()}>
          تعذّر التحميل — أعد المحاولة
        </button>
      ) : (
        <div className="space-y-5">
          <StatusBanner status={s} />
          <WarehouseSetting
            companyId={companyId}
            status={s}
            canUpdate={canUpdate}
            onDone={refresh}
            onError={onError}
          />
          {!s.enabled ? <EnablePreview preview={preview.data} loading={preview.isLoading} /> : null}
          {s.enabled ? (
            <>
              <DrainControl
                companyId={companyId}
                status={s}
                canUpdate={canUpdate}
                onDone={refresh}
                onError={onError}
              />
              <Shortfalls status={s} />
            </>
          ) : null}
          <UnresolvedOrders status={s} />
          {s.localState === 'needs_opening' && (!s.enabled || s.state === 'draining') ? (
            <LocalOpening
              companyId={companyId}
              canUpdate={canUpdate}
              draining={s.enabled}
              items={preview.data?.report.items}
              onDone={refresh}
              onError={onError}
            />
          ) : null}
          <Reports runs={runs.data?.runs ?? []} />
        </div>
      )}
    </Can>
  );
}

function StatusBanner({ status: s }: { status: StockSyncStatus }) {
  const tone = !s.enabled
    ? 'border-border bg-muted/40 text-muted-foreground'
    : s.needsWarehouse || s.state === 'draining'
      ? 'border-warning/30 bg-warning/10 text-warning'
      : 'border-success/30 bg-success/10 text-success';
  const text = !s.enabled
    ? s.localState === 'needs_opening'
      ? 'الربط معطّل. البيع من كمية المنتج متوقف للأصناف المتتبَّعة حتى تُعتمد الكميات الافتتاحية أدناه.'
      : 'إعداد المخازن غير مكتمل: المتجر يبيع من كمية المنتج (في صفحة المنتج). أدخل كميات المنتجات إلى المستودع من «الرصيد الافتتاحي ← من كميات المنتجات» في المخازن وصدّق المستند، ثم اختر مستودع المتجر أدناه وفعّل «ربط المتجر بالمخازن» من إدارة التطبيقات.'
    : s.needsWarehouse
      ? 'الربط مفعّل لكن مستودع المتجر غير محدد: الطلبات مرفوضة حتى تختاره.'
      : s.state === 'draining'
        ? s.sellingLocally
          ? 'قيد التصريف: الطلبات الجديدة تُخصم من كمية المنتج، وطلبات المخازن المفتوحة تُشحن من المستودع. بعد إنهائها يتوقف الربط بتعطيل المتجر أو المخازن من إدارة التطبيقات.'
          : 'قيد التصريف: الطلبات الجديدة متوقفة حتى تُعتمد كميات المنتجات الافتتاحية أدناه. اشحن طلبات المخازن المفتوحة أو ألغها، ثم يتوقف الربط بتعطيل المتجر أو المخازن من إدارة التطبيقات.'
        :`المتجر يبيع من مستودع «${s.warehouseNameAr ?? '—'}»: يُحجز عند الطلب ويُصرف عند الشحن.`;
  return <div className={cn('rounded-xl border px-3.5 py-2.5 text-sm', tone)}>{text}</div>;
}

function WarehouseSetting({
  companyId,
  status: s,
  canUpdate,
  onDone,
  onError,
}: {
  companyId: string;
  status: StockSyncStatus;
  canUpdate: boolean;
  onDone: () => void;
  onError: (e: unknown) => void;
}) {
  const [value, setValue] = React.useState(s.warehouseId ?? '');
  React.useEffect(() => setValue(s.warehouseId ?? ''), [s.warehouseId]);
  const save = useMutation({
    mutationFn: () => stockSyncStatusApi.setWarehouse(companyId, value),
    onSuccess: () => {
      toast.success('تم حفظ مستودع المتجر');
      onDone();
    },
    onError,
  });
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">مستودع المتجر</h3>
      <p className="text-xs text-muted-foreground">
        مستودع واحد يخدم المتجر: منه الحجز والتجهيز والصرف والتوفر المعروض. لا يُختار تلقائياً، ولا يتغير وفيه حجوزات مفتوحة.
        {s.enabled ? '' : ' احفظه هنا قبل تفعيل الربط، وإلا يبقى المتجر على كمية المنتج.'}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={value} onValueChange={setValue} disabled={!canUpdate || save.isPending}>
          <SelectTrigger className="h-10 w-64" aria-label="مستودع المتجر">
            <SelectValue placeholder="اختر المستودع" />
          </SelectTrigger>
          <SelectContent>
            {s.warehouses.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.nameAr} ({w.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={!canUpdate || !value || value === s.warehouseId || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          حفظ
        </Button>
      </div>
    </section>
  );
}

function DrainControl({
  companyId,
  status: s,
  canUpdate,
  onDone,
  onError,
}: {
  companyId: string;
  status: StockSyncStatus;
  canUpdate: boolean;
  onDone: () => void;
  onError: (e: unknown) => void;
}) {
  const drain = useMutation({
    mutationFn: () =>
      s.state === 'draining' ? stockSyncStatusApi.resume(companyId) : stockSyncStatusApi.drain(companyId),
    onSuccess: () => {
      toast.success(
        s.state === 'draining'
          ? 'استُؤنف البيع من المخازن'
          : 'بدأ التصريف: الطلبات الجديدة متوقفة حتى تعتمد كميات المنتجات الافتتاحية',
      );
      onDone();
    },
    onError,
  });
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">تعطيل الربط</h3>
      <div className={cn('grid gap-2', s.state === 'draining' ? 'sm:grid-cols-4' : 'sm:grid-cols-3')}>
        <Stat label="حجوزات مفتوحة" value={s.openReservations} />
        <Stat label="طلبات مخازن مفتوحة" value={s.openInventoryOrders} />
        <Stat label="طلبات قديمة للمراجعة" value={s.unresolvedOrders.length} warn={s.unresolvedOrders.length > 0} />
        {s.state === 'draining' ? <Stat label="طلبات من كمية المنتج" value={s.openLocalOrders} /> : null}
      </div>
      <p className="text-xs text-muted-foreground">
        التعطيل يمر بالتصريف: المتجر يواصل البيع من المستودع حتى تُعتمد كميات المنتجات الافتتاحية، ثم تُخصم الطلبات الجديدة من كمية
        المنتج. بعد شحن طلبات المخازن المفتوحة أو إلغائها يتوقف الربط بتعطيل المتجر أو المخازن من إدارة التطبيقات (لا يُعطَّل الربط وحده). استئناف البيع من المخازن غير متاح
        وطلبات من كمية المنتج مفتوحة.
        {s.state === 'draining'
          ? s.canDisable
            ? ' لا عمل مفتوحاً: يمكن الآن تعطيل المتجر أو المخازن.'
            : ' ما زال عمل مفتوح.'
          : ''}
      </p>
      <Button
        size="sm"
        variant={s.state === 'draining' ? 'outline' : 'destructive'}
        disabled={!canUpdate || drain.isPending}
        onClick={() => drain.mutate()}
      >
        {drain.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {s.state === 'draining' ? 'إيقاف التصريف واستئناف البيع' : 'بدء التصريف'}
      </Button>
    </section>
  );
}

function Shortfalls({ status: s }: { status: StockSyncStatus }) {
  if (s.shortfalls.length === 0) return null;
  return (
    <section className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
      <h3 className="text-sm font-semibold text-destructive">عجز في الحجوزات</h3>
      <p className="text-xs text-muted-foreground">
        نقص الرصيد الصالح للبيع عن المحجوز (تلف أو جرد). هذه الطلبات لا تُجهَّز ولا تُشحن حتى يُستلم مخزون أو تُلغى.
      </p>
      <ul className="space-y-1 text-xs">
        {s.shortfalls.map((f) => (
          <li key={`${f.productId}:${f.variantId ?? ''}`}>
            المحجوز {qty(f.reserved)} · الصالح {qty(f.sellable)} · الناقص {qty(f.missing)} — الطلبات:{' '}
            <span className="font-medium">{f.uncoveredOrders.join('، ')}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function UnresolvedOrders({ status: s }: { status: StockSyncStatus }) {
  if (s.unresolvedOrders.length === 0) return null;
  return (
    <section className="space-y-2 rounded-xl border border-warning/30 bg-warning/5 p-3">
      <h3 className="text-sm font-semibold">طلبات قديمة تحتاج تحديد مصدر المخزون</h3>
      <p className="text-xs text-muted-foreground">
        طلبات مفتوحة بلا حركة مخزون ولا حجز. لا تُشحن قبل اختيار مصدرها من صفحة الطلب.
      </p>
      <ul className="flex flex-wrap gap-2 text-xs">
        {s.unresolvedOrders.map((o) => (
          <li key={o.id}>
            <Link
              href={`${ecommerceAdminRoutes.orders}?order=${o.id}`}
              className="rounded-md border border-border px-2 py-1 hover:bg-muted"
            >
              {o.orderNumber}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Before enabling the link: what it would do (the same report, nothing
 * written) and what stops it now. Enabling itself is in app management.
 */
function EnablePreview({ preview, loading }: { preview: StockSyncPreview | undefined; loading: boolean }) {
  if (loading) return <div className="h-24 animate-pulse rounded-2xl bg-muted/40" />;
  if (!preview) return null;
  const { report, blockers, openLocalOrders } = preview;
  return (
    <section className="space-y-3 rounded-xl border border-border p-3">
      <h3 className="text-sm font-semibold">معاينة التفعيل</h3>
      <p className="text-xs text-muted-foreground">
        هذا ما سيحدث عند تفعيل الربط، دون أن يتغير شيء الآن: يُحسب توفر كل صنف متتبَّع من المستودع (الأصناف بلا رصيد تظهر غير
        متوفرة)، وتُترك كميات المنتجات الحالية. أدخل البضاعة في المستودع قبل التفعيل: من «الرصيد الافتتاحي ← من كميات المنتجات» في المخازن، أو باستلام أو جرد.
      </p>
      {blockers.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-warning/30 bg-warning/10 px-3.5 py-2.5 text-xs text-warning">
          <p className="font-semibold">لا يمكن التفعيل الآن:</p>
          {blockers.includes('no_warehouse') ? (
            <p>مستودع المتجر غير محدد: اختره أعلاه واحفظه. لا يُؤخذ مستودع تلقائياً.</p>
          ) : null}
          {blockers.includes('open_local_orders') ? (
            <div className="space-y-1.5">
              <p>
                {openLocalOrders.length} طلب مفتوح خُصم من كمية المنتج: لن يُصرف من المستودع عند شحنه، فاشحنه أو ألغه قبل التفعيل.
              </p>
              <ul className="flex flex-wrap gap-2">
                {openLocalOrders.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`${ecommerceAdminRoutes.orders}?order=${o.id}`}
                      className="rounded-md border border-warning/40 px-2 py-1 hover:bg-warning/10"
                    >
                      {o.orderNumber}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="rounded-xl border border-success/30 bg-success/10 px-3.5 py-2.5 text-xs text-success">
          جاهز للتفعيل: فعّل «ربط المتجر بالمخازن» من إدارة التطبيقات.
        </p>
      )}
      {report.warehouseId ? <RunReport run={{ report }} /> : null}
    </section>
  );
}

function LocalOpening({
  companyId,
  canUpdate,
  draining,
  items,
  onDone,
  onError,
}: {
  companyId: string;
  canUpdate: boolean;
  /** The link is draining (still enabled): approving resumes taking orders from the store quantity. */
  draining: boolean;
  /** The store's items against the store warehouse (the preview report). */
  items: StockSyncItem[] | undefined;
  onDone: () => void;
  onError: (e: unknown) => void;
}) {
  const queryClient = useQueryClient();
  const key = ['ecommerce', 'stock-opening', companyId];
  const opening = useQuery({ queryKey: key, queryFn: () => storeStockOpeningApi.get(companyId) });
  const itemKey = (i: { productId: string; variantId: string | null }) => `${i.productId}:${i.variantId ?? ''}`;
  const levels = new Map((opening.data?.levels ?? []).map((l) => [itemKey(l), l.quantity]));
  // Every item tracked in inventory (unlisted, it would sell without a
  // limit) and every item that had a store quantity; the warehouse's
  // available quantity is the starting suggestion.
  const loaded = items !== undefined && !opening.isLoading;
  const rows = (items ?? [])
    .filter((i) => i.tracked || levels.has(itemKey(i)))
    .map((i) => ({
      key: itemKey(i),
      productId: i.productId,
      variantId: i.variantId,
      name: i.name,
      old: levels.get(itemKey(i)) ?? null,
      available: i.tracked ? i.available : null,
      suggested: i.tracked ? i.available : (levels.get(itemKey(i)) ?? 0),
    }));
  const [values, setValues] = React.useState<Record<string, string>>({});
  const valueOf = (r: (typeof rows)[number]) => Number(values[r.key] ?? r.suggested);
  const approve = useMutation({
    mutationFn: () =>
      storeStockOpeningApi.approve(
        companyId,
        rows.map((r) => ({ productId: r.productId, variantId: r.variantId, quantity: valueOf(r) })),
      ),
    onSuccess: () => {
      toast.success(
        draining
          ? 'اعتُمدت الكميات الافتتاحية: الطلبات الجديدة تُخصم من كمية المنتج'
          : 'اعتُمدت الكميات الافتتاحية واستُؤنف البيع المحلي',
      );
      void queryClient.invalidateQueries({ queryKey: key });
      onDone();
    },
    onError,
  });
  const valid = rows.every((r) => {
    const v = valueOf(r);
    return Number.isFinite(v) && v >= 0;
  });

  return (
    <section className="space-y-2 rounded-xl border border-border p-3">
      <h3 className="text-sm font-semibold">الكميات الافتتاحية للمتجر</h3>
      <p className="text-xs text-muted-foreground">
        {draining
          ? 'أثناء التصريف تتوقف الطلبات الجديدة حتى تعتمد كمية المنتج لكل صنف؛ بعدها تُخصم الطلبات الجديدة منها بدل المستودع. '
          : 'بعد تعطيل الربط لا تُستخدم كميات المنتجات القديمة تلقائياً. '}
        الكمية المقترحة هي المتاح في مستودع المتجر بعد المحجوز لطلبات المخازن المفتوحة. الأصناف غير المدرجة يتوقف تتبّعها.
      </p>
      {!loaded ? (
        <div className="h-20 animate-pulse rounded-xl bg-muted/40" />
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">لا توجد أصناف متتبَّعة؛ الاعتماد يستأنف البيع المحلي.</p>
      ) : (
        <>
        {/* Phones: one card per item, the opening quantity full width. */}
        <div className="space-y-2 md:hidden">
          {rows.map((r) => (
            <div key={r.key} className="rounded-xl border border-border/70 bg-card p-3">
              <p className="text-sm font-medium">{r.name || r.productId.slice(0, 8)}</p>
              <dl className="mt-1.5 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">الكمية القديمة</dt>
                  <dd className="tabular-nums">{qty(r.old)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">المتاح في المستودع</dt>
                  <dd className="tabular-nums">{qty(r.available)}</dd>
                </div>
              </dl>
              <label className="mt-2 block text-xs text-muted-foreground">
                الافتتاحية
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  dir="rtl"
                  className="mt-1 h-10"
                  value={values[r.key] ?? String(r.suggested)}
                  onChange={(event) => setValues((prev) => ({ ...prev, [r.key]: event.target.value }))}
                  disabled={!canUpdate}
                />
              </label>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto rounded-xl border border-border/70 md:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-start font-medium">الصنف</th>
                <th className="px-3 py-2 text-start font-medium">الكمية القديمة</th>
                <th className="px-3 py-2 text-start font-medium">المتاح في المستودع</th>
                <th className="px-3 py-2 text-start font-medium">الافتتاحية</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-border/60">
                  <td className="px-3 py-2">{r.name || r.productId.slice(0, 8)}</td>
                  <td className="px-3 py-2 tabular-nums">{qty(r.old)}</td>
                  <td className="px-3 py-2 tabular-nums">{qty(r.available)}</td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      dir="rtl"
                      className="h-8 w-24"
                      value={values[r.key] ?? String(r.suggested)}
                      onChange={(event) => setValues((prev) => ({ ...prev, [r.key]: event.target.value }))}
                      disabled={!canUpdate}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
      <Button size="sm" disabled={!canUpdate || !loaded || !valid || approve.isPending} onClick={() => approve.mutate()}>
        {approve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {draining ? 'اعتماد الكميات والبيع منها أثناء التصريف' : 'اعتماد الكميات واستئناف البيع المحلي'}
      </Button>
    </section>
  );
}

function Reports({ runs }: { runs: StockSyncRun[] }) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const selected = runs.find((r) => r.id === selectedId) ?? runs[0] ?? null;
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">تقارير المطابقة</h3>
      {runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا توجد تقارير مطابقة بعد.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {runs.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedId(r.id)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs',
                  r.id === selected?.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-muted/50',
                )}
              >
                {formatDate(r.createdAt)} · {KIND_LABEL[r.kind] ?? r.kind}
              </button>
            ))}
          </div>
          {selected ? <RunReport run={selected} /> : null}
        </>
      )}
    </section>
  );
}

function RunReport({ run }: { run: Pick<StockSyncRun, 'report'> }) {
  const { totals, items, openLocalOrders } = run.report;
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <Stat label="الأصناف" value={totals.items} />
        <Stat label="متتبَّعة في المخازن" value={totals.tracked} />
        <Stat label="فرق مع كمية المنتج" value={totals.mismatched} warn={totals.mismatched > 0} />
        <Stat label="غير متوفرة" value={totals.outOfStock} />
      </div>
      {openLocalOrders > 0 ? (
        <p className="rounded-xl border border-warning/30 bg-warning/10 px-3.5 py-2.5 text-xs text-warning">
          {openLocalOrders} طلب مفتوح خُصم من كمية المنتج: إن أُلغي يعود لكمية المنتج، وعند شحنه لا يُصرف من المخازن.
        </p>
      ) : null}
      {/* Phones: one card per item. */}
      <div className="space-y-2 md:hidden">
        {items.map((item) => {
          const differs = item.difference !== null && Math.abs(item.difference) > 1e-9;
          return (
            <div
              key={`${item.productId}:${item.variantId ?? ''}`}
              className={cn('rounded-xl border bg-card p-3', differs ? 'border-warning/40' : 'border-border/70')}
            >
              <p className="text-sm font-medium">
                {item.name || item.productId.slice(0, 8)}
                {!item.tracked ? <span className="ms-2 text-xs text-muted-foreground">(غير متتبَّع)</span> : null}
              </p>
              <dl className="mt-1.5 grid grid-cols-3 gap-2 text-xs">
                {(
                  [
                    ['كمية المنتج', item.localQuantity],
                    ['الرصيد الصالح', item.onHand],
                    ['محجوز', item.reserved],
                    ['المتاح', item.available],
                    ['الفرق', item.difference],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd
                      className={cn(
                        'tabular-nums',
                        label === 'الفرق' && differs && 'font-medium text-warning',
                      )}
                    >
                      {qty(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </div>
      <div className="hidden overflow-x-auto rounded-xl border border-border/70 md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-start font-medium">الصنف</th>
              <th className="px-3 py-2 text-start font-medium">كمية المنتج</th>
              <th className="px-3 py-2 text-start font-medium">الرصيد الصالح</th>
              <th className="px-3 py-2 text-start font-medium">محجوز</th>
              <th className="px-3 py-2 text-start font-medium">المتاح</th>
              <th className="px-3 py-2 text-start font-medium">الفرق</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={`${item.productId}:${item.variantId ?? ''}`} className="border-t border-border/60">
                <td className="px-3 py-2">
                  {item.name || item.productId.slice(0, 8)}
                  {!item.tracked ? <span className="ms-2 text-xs text-muted-foreground">(غير متتبَّع)</span> : null}
                </td>
                <td className="px-3 py-2 tabular-nums">{qty(item.localQuantity)}</td>
                <td className="px-3 py-2 tabular-nums">{qty(item.onHand)}</td>
                <td className="px-3 py-2 tabular-nums">{qty(item.reserved)}</td>
                <td className="px-3 py-2 tabular-nums">{qty(item.available)}</td>
                <td
                  className={cn(
                    'px-3 py-2 tabular-nums',
                    item.difference !== null && Math.abs(item.difference) > 1e-9 && 'font-medium text-warning',
                  )}
                >
                  {qty(item.difference)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-border/70 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-lg font-semibold tabular-nums', warn && 'text-warning')}>{value}</p>
    </div>
  );
}
