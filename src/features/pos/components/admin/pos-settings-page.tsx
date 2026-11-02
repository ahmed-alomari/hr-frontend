'use client';

import * as React from 'react';
import Link from 'next/link';
import { Boxes, CreditCard, PackageX, Percent, Printer, Save, Undo2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/shared/utils';
import { PRINT_PAPERS } from '@/features/print-templates/domain/types';
import { usePrintTemplateSettings } from '@/features/print-templates/lib/print-template-store';
import {
  PAYMENT_METHOD_LABELS,
  type PosInvoiceStyle,
  type PosPaymentMethod,
  type PosSettings,
  type PosStockMode,
  type PosStockTiming,
} from '@/features/pos/domain/types';
import { usePosContext } from '@/features/pos/hooks/use-pos-context';
import { usePosStockLink } from '@/features/pos/lib/pos-stock-link-api';
import { parseAmount } from '@/features/pos/lib/format';
import { PosGate } from '@/features/pos/components/shared/pos-shared';
import { PosMenuCategoriesCard } from '@/features/pos/components/admin/pos-menu-categories';

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <h3 className="text-sm font-semibold">{title}</h3>
      {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
      <span>
        {label}
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function NumberField({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input dir="ltr" inputMode="decimal" value={String(value)} onChange={(e) => onChange(parseAmount(e.target.value))} className="h-9" />
        {suffix ? <span className="text-sm text-muted-foreground">{suffix}</span> : null}
      </div>
    </div>
  );
}

const STOCK_MODES: ReadonlyArray<{ id: PosStockMode; title: string; description: string; icon: typeof Boxes }> = [
  {
    id: 'none',
    title: 'دون تتبع الكمية',
    description: 'يبيع دون فحص أو خصم كمية. مناسب لمن لا يستخدم المخازن. الكميات المباعة تظهر في التقارير.',
    icon: PackageX,
  },
  {
    id: 'inventory',
    title: 'مربوط بالمخازن',
    description: 'كل نقطة تبيع من مستودعها: صرف عند إتمام البيع، ويعود المرتجع السليم إليه، وبقواعد المخازن عند نقص الكمية.',
    icon: Boxes,
  },
];

const STOCK_TIMINGS: ReadonlyArray<{ id: PosStockTiming; title: string; description: string }> = [
  {
    id: 'reserve_on_commit',
    title: 'حجز عند تثبيت السلة، وصرف عند الإتمام',
    description: 'لا يبيع كاشير آخر آخر قطعة أثناء الدفع. الإلغاء يفك الحجز.',
  },
  {
    id: 'issue_on_complete',
    title: 'صرف عند الإتمام فقط',
    description: 'تُفحص الكمية عند التثبيت دون حجز، وتُصرف عند الإتمام. قد يُرفض الإتمام إن بيعت الكمية من نقطة أخرى أثناء الدفع.',
  },
];

type SettingsTab = 'stock' | 'pricing' | 'payment' | 'returns' | 'shifts' | 'print';

/** The tabs, and the settings each one edits (for its unsaved mark). */
const TABS: ReadonlyArray<{ id: SettingsTab; label: string; icon: typeof Boxes; keys: ReadonlyArray<keyof PosSettings> }> = [
  { id: 'stock', label: 'المنتجات والمخزون', icon: Boxes, keys: ['onlyPosAvailableProducts', 'stockTiming'] },
  { id: 'pricing', label: 'الأسعار والضريبة', icon: Percent, keys: ['tax', 'discounts'] },
  { id: 'payment', label: 'الدفع', icon: CreditCard, keys: ['paymentMethods'] },
  { id: 'returns', label: 'المرتجعات', icon: Undo2, keys: ['returns'] },
  { id: 'shifts', label: 'الورديات والنقد', icon: Wallet, keys: ['shifts'] },
  { id: 'print', label: 'الطباعة', icon: Printer, keys: [] },
];

function Settings() {
  const { companyId, data, actions, can, userName } = usePosContext();
  const template = usePrintTemplateSettings(companyId);
  const [draft, setDraft] = React.useState<PosSettings>(data.settings);
  React.useEffect(() => setDraft(data.settings), [data.settings]);

  const canEdit = can('pos.settings.manage');
  const link = usePosStockLink(companyId);
  const linked = data.settings.stockMode === 'inventory';
  const openSessions = data.sessions.filter((s) => s.status === 'open').length;
  const unsettledSales = data.sales.filter(
    (s) => s.status === 'awaiting_payment' || s.status === 'payment_exception',
  ).length;
  const change = data.settings.stockModeChange;
  const drained = openSessions === 0 && unsettledSales === 0;
  const modeTitle = (id: PosStockMode) => STOCK_MODES.find((m) => m.id === id)?.title ?? id;
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.settings);
  const [tab, setTab] = React.useState<SettingsTab>('stock');
  const tabDirty = (keys: ReadonlyArray<keyof PosSettings>) =>
    keys.some((k) => JSON.stringify(draft[k]) !== JSON.stringify(data.settings[k]));
  const templateName = PRINT_PAPERS.find((paper) => paper.id === template.paper)?.nameAr ?? 'حراري 80 مم';
  const chooseInvoice = async (invoiceStyle: PosInvoiceStyle) => {
    if (!actions || !canEdit) return;
    if (!(await actions.saveSettings({ ...data.settings, invoiceStyle }))) return;
    toast.success(invoiceStyle === 'standard' ? 'أصبحت الفاتورة العادية هي الافتراضية.' : 'أصبح الإيصال الحراري هو الافتراضي.');
  };

  const set = <K extends keyof PosSettings>(key: K, patch: Partial<PosSettings[K]>) =>
    setDraft((d) => ({ ...d, [key]: { ...(d[key] as object), ...patch } }));

  const save = async () => {
    if (!actions) return;
    if (!Object.values(draft.paymentMethods).some(Boolean)) {
      toast.error('فعّل وسيلة دفع واحدة على الأقل');
      return;
    }
    if (!(await actions.saveSettings(draft))) return;
    toast.success('حُفظت إعدادات نقاط البيع');
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <SetPageTitle titleAr="إعدادات نقاط البيع" iconName="Settings" />

      <Tabs value={tab} onValueChange={(v) => setTab(v as SettingsTab)}>
        <TabsList className="flex h-auto w-full justify-start gap-1 rounded-xl bg-muted/60 p-1 max-md:overflow-x-auto md:flex-wrap">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <TabsTrigger key={t.id} value={t.id} className="shrink-0 gap-1.5 px-3">
                <Icon className="h-4 w-4" />
                {t.label}
                {tabDirty(t.keys) ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-label="تغييرات غير محفوظة" />
                ) : null}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="stock" className="space-y-4">
          <Card
            title="وضع المخزون"
            description="على مستوى الشركة: كل نقاط البيع مربوطة أو لا شيء منها، فلا تبيع نقطتان البضاعة نفسها إحداهما تخصم والأخرى لا."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Linking is the «ربط نقاط البيع بالمخازن» app's switch (company apps);
                  here a linked company can only stop new shifts before disabling it.
                  The linked card shows only while the app is enabled (or still linked). */}
              {STOCK_MODES.filter((m) => m.id !== 'inventory' || linked || link.bridgeOn).map((m) => {
                const Icon = m.icon;
                const active = data.settings.stockMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={active}
                    disabled={!canEdit || active || Boolean(change) || m.id === 'inventory'}
                    onClick={() => actions?.requestStockModeChange(m.id, userName)}
                    className={cn(
                      'flex gap-3 rounded-lg border p-3 text-start transition disabled:cursor-not-allowed',
                      active ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/40',
                    )}
                  >
                    <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                    <span>
                      <span className="block text-sm font-semibold">{m.title}</span>
                      <span className="block text-xs text-muted-foreground">{m.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {change ? (
              <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs leading-relaxed">
                <p className="font-semibold">
                  تبديل قيد التنفيذ: من «{modeTitle(data.settings.stockMode)}» إلى «{modeTitle(change.to)}» (طلبه{' '}
                  {change.requestedBy}).
                </p>
                <p>
                  لا تُفتح ورديات جديدة الآن. الورديات المفتوحة ({openSessions}) تكمل بوضعها، والمبيعات بانتظار الدفع
                  أو الاستثناءات ({unsettledSales}) تُحسم. بعدها تؤكد الوضع الجديد صراحة — لا انتقال تلقائي.
                </p>
                {change.to === 'none' ? (
                  <p className="text-warning">
                    بعد التأكيد لن ترى المخازن مبيعات نقاط البيع، ومرتجعات مبيعات المخازن السابقة تُسجَّل «ترحيلًا
                    معلّقًا» حتى تُراجع.
                  </p>
                ) : null}
                {change.to === 'none' && link.data?.enabled ? (
                  <p className="font-semibold">
                    لإتمام فك الربط: بعد إغلاق الورديات أوقف تطبيق «ربط نقاط البيع بالمخازن» من تطبيقات الشركة.
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {change.to === 'none' && link.data?.enabled ? null : (
                    <Button
                      size="sm"
                      disabled={!canEdit || !drained}
                      onClick={() => {
                        actions?.confirmStockModeChange(userName);
                      }}
                    >
                      تأكيد الوضع الجديد
                    </Button>
                  )}
                  <Button size="sm" variant="outline" disabled={!canEdit} onClick={() => actions?.cancelStockModeChange(userName)}>
                    إلغاء التبديل
                  </Button>
                </div>
              </div>
            ) : linked ? (
              <p className="text-xs text-muted-foreground">
                مربوط عبر تطبيق «ربط نقاط البيع بالمخازن». مستودع كل نقطة في{' '}
                <Link href="/point-of-sale/registers" className="text-primary underline">
                  نقاط البيع والأجهزة
                </Link>
                . الربط تلقائي: لا يُوقف وحده، ويتوقف بإيقاف نقاط البيع أو المخازن من تطبيقات الشركة بعد إغلاق الورديات.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {link.data?.installed && link.inventoryOn
                  ? 'إعداد المخازن غير مكتمل: تبيع النقاط من كمية المنتج حتى يُفعَّل الربط. أدخل كميات المنتجات إلى المستودع من «الرصيد الافتتاحي ← من كميات المنتجات» في المخازن، ثم اختر مستودع كل نقطة في «نقاط البيع والأجهزة» (النقطة التي لفرعها مستودع واحد يُختار لها تلقائيًا)، وفعّل «ربط نقاط البيع بالمخازن» من تطبيقات الشركة والورديات مغلقة.'
                  : 'تبيع نقاط البيع من كمية المنتج، وبسعر البيع والتكلفة من صفحة المنتج.'}
              </p>
            )}
            {link.data?.installed && link.bridgeOn ? (
              <div className="space-y-2">
                <Label>متى تتحرك الكمية في المخازن</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {STOCK_TIMINGS.map((option) => {
                    const active = draft.stockTiming === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={active}
                        disabled={!canEdit}
                        onClick={() => setDraft((d) => ({ ...d, stockTiming: option.id }))}
                        className={cn(
                          'rounded-lg border p-3 text-start transition disabled:cursor-not-allowed',
                          active ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/40',
                        )}
                      >
                        <span className="block text-sm font-semibold">{option.title}</span>
                        <span className="block text-xs text-muted-foreground">{option.description}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  يسري على المبيعات الجديدة. نقص الكمية يتبع قواعد المخازن: لا يُصرف أكثر من المتاح، والصنف غير المتتبَّع لا ينقص.
                </p>
              </div>
            ) : null}
            <Toggle
              label="الأصناف المتاحة في نقطة البيع فقط"
              hint="يعرض الأصناف المعلَّمة «متاح في نقطة البيع» في تطبيق المنتجات."
              checked={draft.onlyPosAvailableProducts}
              onChange={(v) => setDraft((d) => ({ ...d, onlyPosAvailableProducts: v }))}
            />
          </Card>
          <PosMenuCategoriesCard />
        </TabsContent>

        <TabsContent value="pricing" className="grid gap-4 lg:grid-cols-2">
          <Card title="الضريبة" description="تُحفظ نسبتها ومبلغها على كل سطر بيع. الفوترة الإلكترونية تُضاف لكل دولة على حدة.">
            <Toggle label="تطبيق ضريبة على المبيعات" checked={draft.tax.enabled} onChange={(v) => set('tax', { enabled: v })} />
            {draft.tax.enabled ? (
              <>
                <NumberField label="النسبة" value={draft.tax.rate} onChange={(v) => set('tax', { rate: v })} suffix="%" />
                <Toggle label="الأسعار شاملة الضريبة" checked={draft.tax.pricesIncludeTax} onChange={(v) => set('tax', { pricesIncludeTax: v })} />
              </>
            ) : null}
          </Card>

          <Card title="الخصومات والأسعار">
            <NumberField
              label="أعلى خصم يمنحه الكاشير وحده"
              value={draft.discounts.cashierMaxPercent}
              onChange={(v) => set('discounts', { cashierMaxPercent: v })}
              suffix="%"
            />
            <Toggle
              label="موافقة مشرف فوق الحد"
              hint="وإلا يُرفض الخصم الأعلى."
              checked={draft.discounts.supervisorApprovalAbove}
              onChange={(v) => set('discounts', { supervisorApprovalAbove: v })}
            />
            <Toggle
              label="السماح بتغيير سعر الصنف"
              hint="لمن يملك صلاحية «تغيير سعر الصنف» فقط، ويُسجَّل."
              checked={draft.discounts.allowPriceOverride}
              onChange={(v) => set('discounts', { allowPriceOverride: v })}
            />
          </Card>
        </TabsContent>

        <TabsContent value="payment" className="grid gap-4 lg:grid-cols-2">
          <Card title="وسائل الدفع" description="البطاقة والتحويل تُسجَّل بمرجعها بعد تنفيذها على الجهاز أو الحساب.">
            {(Object.keys(PAYMENT_METHOD_LABELS) as PosPaymentMethod[]).map((m) => (
              <Toggle
                key={m}
                label={PAYMENT_METHOD_LABELS[m]}
                checked={draft.paymentMethods[m]}
                onChange={(v) => set('paymentMethods', { [m]: v })}
              />
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="returns" className="grid gap-4 lg:grid-cols-2">
          <Card title="المرتجعات">
            <NumberField
              label="مدة قبول المرتجع"
              value={draft.returns.windowDays}
              onChange={(v) => set('returns', { windowDays: Math.max(0, Math.round(v)) })}
              suffix="يوم"
            />
            <Toggle
              label="الرد بوسيلة غير الأصلية يحتاج موافقة"
              checked={draft.returns.refundToOtherMethodNeedsApproval}
              onChange={(v) => set('returns', { refundToOtherMethodNeedsApproval: v })}
            />
          </Card>
        </TabsContent>

        <TabsContent value="shifts" className="grid gap-4 lg:grid-cols-2">
          <Card title="الورديات والنقد">
            <Toggle
              label="عدّ أعمى عند الإغلاق"
              hint="لا يرى الكاشير المتوقع قبل إدخال المعدود."
              checked={draft.shifts.blindCount}
              onChange={(v) => set('shifts', { blindCount: v })}
            />
            <Toggle
              label="العدّ بالفئات"
              checked={draft.shifts.countByDenomination}
              onChange={(v) => set('shifts', { countByDenomination: v })}
            />
            <NumberField
              label="فرق مقبول بلا سبب"
              value={draft.shifts.differenceTolerance}
              onChange={(v) => set('shifts', { differenceTolerance: Math.max(0, v) })}
            />
            {draft.shifts.countByDenomination ? (
              <div className="space-y-1.5">
                <Label>الفئات (مفصولة بفواصل)</Label>
                <Input
                  dir="ltr"
                  className="h-9"
                  value={draft.shifts.denominations.join(', ')}
                  onChange={(e) =>
                    set('shifts', {
                      denominations: e.target.value
                        .split(',')
                        .map((x) => parseAmount(x))
                        .filter((x) => x > 0),
                    })
                  }
                />
              </div>
            ) : null}
          </Card>
        </TabsContent>

        <TabsContent value="print" className="grid gap-4 lg:grid-cols-2">
          <Card
            title="طريقة الفاتورة"
            description="الافتراضي لكل نقطة بيع لم تختر طريقتها. نقطة بيع التجزئة تبقى حرارية، ونقطة تبيع بالجملة أو بعرض سعر تستخدم الورقة العادية."
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ['thermal', 'إيصال حراري', 'ورقة 80 أو 58 مم للكاشير.'],
                  ['standard', 'فاتورة عادية', 'ورقة A4 بهوية الشركة، كعرض سعر أو فاتورة.'],
                ] as const
              ).map(([id, label, hint]) => (
                <button
                  key={id}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => void chooseInvoice(id)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-start text-sm',
                    (data.settings.invoiceStyle ?? 'thermal') === id
                      ? 'border-primary bg-primary/5'
                      : 'border-border',
                  )}
                >
                  <span className="block font-semibold">{label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
                </button>
              ))}
            </div>
          </Card>
          <Card title="شكل الورق" description="الحراري من قالب إيصال نقاط البيع، والعادية من الهوية الرسمية للشركة.">
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              <span>
                الإيصال الحراري: <b>{templateName}</b>
              </span>
              <Button asChild size="sm" variant="outline">
                <Link href="/system/organization/pages/company">قوالب الشركة</Link>
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {canEdit && tab !== 'print' ? (
        <div className="sticky bottom-3 flex justify-end">
          <Button onClick={save} disabled={!dirty}>
            <Save className="h-4 w-4" />
            حفظ الإعدادات
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function PosSettingsPage() {
  return (
    <PosGate permission="pos.settings.manage">
      <Settings />
    </PosGate>
  );
}
