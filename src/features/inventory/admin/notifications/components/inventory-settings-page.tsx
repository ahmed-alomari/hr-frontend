'use client';

import * as React from 'react';
import { Bell, Coins, Info, Layers, Lock, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { useAuthStore } from '@/features/auth/lib/auth-store';
import { useCan } from '@/features/auth/hooks/use-can';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import {
  INVENTORY_NOTIFICATION_GROUPS,
  type InventoryNotificationKey,
} from '@/features/inventory/admin/notifications/constants/notification-groups';
import { useInventoryCompanySettings } from '@/features/inventory/admin/notifications/hooks/use-inventory-settings';
import type {
  InventoryCompanySettings,
  UpdateInventoryCompanySettingsDto,
} from '@/features/inventory/admin/notifications/lib/api/inventory-settings';
import { InventoryPeriodLockPanel } from '@/features/inventory/admin/notifications/components/inventory-period-lock-panel';
import { NotificationTogglesCard } from '@/features/system/organization/pages/_shared/components/notification-toggles-card';
import {
  SettingsPageEmpty,
  SettingsPageError,
  SettingsPageLoading,
} from '@/features/system/organization/pages/_shared/components/settings-page-states';
import { useModuleEnablementContext } from '@/features/auth/hooks/use-system-owner';
import { isModuleEnabledFor } from '@/shared/modules/registry';
import { useCompanyApps } from '@/shared/modules/company-apps';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/shared/utils';

const SETTINGS_TABS = [
  { value: 'general', label: 'عام', icon: Settings2 },
  { value: 'batches', label: 'الدفعات', icon: Layers },
  { value: 'costing', label: 'التكلفة', icon: Coins },
  { value: 'closing', label: 'إقفال الفترة', icon: Lock },
  { value: 'notifications', label: 'الإشعارات', icon: Bell },
] as const;

type SettingsTab = (typeof SETTINGS_TABS)[number]['value'];

type CostingPatch = Pick<
  UpdateInventoryCompanySettingsDto,
  'costingStatus' | 'costingMethod' | 'costingScope'
>;

const COSTING_METHOD_LABELS: Record<string, string> = {
  moving_average: 'المتوسط المتحرك',
  fifo: 'FIFO — الأقدم أولًا',
  lifo: 'LIFO — الأحدث أولًا',
  standard: 'تكلفة معيارية',
  specific: 'تحديد دفعة بعينها',
  periodic_weighted_average: 'متوسط مرجّح دوري',
};

const TAB_TRIGGER_CLASS =
  'flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium text-muted-foreground shadow-none transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-soft sm:text-sm';

function SettingsPanel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-2xl border border-border/80 bg-card p-4 sm:p-5', className)}>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold sm:text-base">{title}</h2>
        {description ? <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">{description}</p> : null}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function InventorySettingsPage() {
  const can = useCan();
  const canRead = can('inv.settings.read');
  const canUpdate = can('inv.settings.update');
  const [activeTab, setActiveTab] = React.useState<SettingsTab>('general');

  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const companyApps = useCompanyApps();
  const { companyId: moduleCompanyId, ...moduleContext } = useModuleEnablementContext();
  const inventoryEnabled = isModuleEnabledFor(
    'inventory',
    activeCompanyId ?? moduleCompanyId,
    moduleContext,
  );

  const { data: settings, isLoading, isError, error, update, companyId } =
    useInventoryCompanySettings();

  const handleToggle = async (key: string, value: boolean) => {
    if (!settings || !canUpdate) return;
    try {
      await update.mutateAsync({ [key]: value });
      toast.success('تم تحديث الإعداد');
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'settings.inventory.update');
      toast.error(displayMessage);
    }
  };

  const handleBatchStrategy = async (
    value: InventoryCompanySettings['batchAllocationStrategy'],
  ) => {
    if (!settings || !canUpdate) return;
    try {
      await update.mutateAsync({ batchAllocationStrategy: value });
      toast.success('تم تحديث استراتيجية استهلاك الدفعات');
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'settings.inventory.update');
      toast.error(displayMessage);
    }
  };

  const saveCosting = async (patch: CostingPatch) => {
    if (!settings || !canUpdate) return;
    try {
      await update.mutateAsync(patch);
      toast.success('تم تحديث إعدادات التكلفة');
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'settings.inventory.update');
      toast.error(displayMessage);
    }
  };

  /**
   * Turning costing on is confirmed with the method and scope it keeps: both
   * are fixed by the first cost movement, so the choice is made knowingly.
   */
  const [pendingCosting, setPendingCosting] = React.useState<CostingPatch | null>(null);
  const handleCostingField = (patch: CostingPatch) => {
    if (!settings || !canUpdate) return;
    if (patch.costingStatus === 'active' && settings.costingStatus !== 'active') {
      setPendingCosting(patch);
      return;
    }
    void saveCosting(patch);
  };

  const handleDisplayDecimals = async (
    patch: Pick<UpdateInventoryCompanySettingsDto, 'quantityDisplayDecimals' | 'costDisplayDecimals'>,
  ) => {
    if (!settings || !canUpdate) return;
    try {
      await update.mutateAsync(patch);
      toast.success('تم تحديث دقة عرض الأرقام');
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'settings.inventory.update');
      toast.error(displayMessage);
    }
  };

  if (!inventoryEnabled) {
    return (
      <SettingsPageEmpty message="تطبيق المخازن غير مفعّل لهذه الشركة." />
    );
  }

  if (!canRead) {
    return <SettingsPageEmpty message="ليس لديك صلاحية عرض إعدادات المخازن." />;
  }

  if (!companyId) {
    return <SettingsPageEmpty message="لا توجد شركة افتراضية — سجّل الدخول أو اختر شركة." />;
  }

  if (isLoading) {
    return <SettingsPageLoading />;
  }

  if (isError || !settings) {
    const { displayMessage } = handleApiError(error, 'settings.inventory.get');
    return <SettingsPageError message={displayMessage} />;
  }

  const controlsDisabled = update.isPending || !canUpdate;
  const costingLocked = settings.costingLocked === true;
  // FIFO/LIFO costing takes the layers in its own order (server rule).
  const allocationFromCosting =
    settings.costingStatus === 'active' &&
    (settings.costingMethod === 'fifo' || settings.costingMethod === 'lifo');

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <SetPageTitle titleAr="إعدادات المخازن" iconName="Settings" />

      <p className="text-xs text-muted-foreground sm:text-sm">
        إعدادات على مستوى <span className="font-medium text-foreground">الشركة</span> — تُطبَّق على كل المستودعات
        والمواقع ما لم يُضاف لاحقاً استثناء لكل مستودع.
      </p>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as SettingsTab)}
        dir="rtl"
        className="flex min-h-0 flex-1 flex-col gap-4"
      >
        <TabsList className="sto-tabs-scroll h-auto w-full justify-start rounded-2xl border border-border/80 bg-muted/40 p-1">
          {SETTINGS_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.value} value={tab.value} className={TAB_TRIGGER_CLASS}>
                <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="general" className="mt-0 space-y-4 focus-visible:outline-none">
          <SettingsPanel
            title="دقة عرض الأرقام"
            description="يتحكم بالعرض في الشاشات فقط — القيم المحفوظة تبقى بدقة كاملة للمحاسبة."
          >
            <div className="grid grid-cols-1 gap-4 sm:max-w-lg sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="quantity-display-decimals">خانات الكمية العشرية</Label>
                <Input
                  id="quantity-display-decimals"
                  type="number"
                  min={0}
                  max={4}
                  disabled={controlsDisabled}
                  defaultValue={settings.quantityDisplayDecimals}
                  onBlur={(e) => {
                    const value = Math.min(4, Math.max(0, Number(e.target.value) || 0));
                    if (value !== settings.quantityDisplayDecimals) {
                      void handleDisplayDecimals({ quantityDisplayDecimals: value });
                    }
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cost-display-decimals">خانات التكلفة العشرية</Label>
                <Input
                  id="cost-display-decimals"
                  type="number"
                  min={0}
                  max={8}
                  disabled={controlsDisabled}
                  defaultValue={settings.costDisplayDecimals}
                  onBlur={(e) => {
                    const value = Math.min(8, Math.max(0, Number(e.target.value) || 0));
                    if (value !== settings.costDisplayDecimals) {
                      void handleDisplayDecimals({ costDisplayDecimals: value });
                    }
                  }}
                />
              </div>
            </div>
          </SettingsPanel>
        </TabsContent>

        <TabsContent value="batches" className="mt-0 focus-visible:outline-none">
          <SettingsPanel
            title="استراتيجية استهلاك الدفعات"
            description="ترتيب خروج الدفعات عند الصرف والتحويل والجرد — داخل الموقع/العملية المعتمدة."
          >
            <div className="max-w-md space-y-1.5">
              <Label htmlFor="batch-allocation-strategy">الاستراتيجية</Label>
              <Select
                value={settings.batchAllocationStrategy}
                disabled={controlsDisabled || allocationFromCosting}
                onValueChange={(value) =>
                  void handleBatchStrategy(
                    value as InventoryCompanySettings['batchAllocationStrategy'],
                  )
                }
              >
                <SelectTrigger id="batch-allocation-strategy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fifo">FIFO — الأقدم دخولًا أولًا</SelectItem>
                  <SelectItem value="lifo">LIFO — الأحدث دخولًا أولًا</SelectItem>
                  <SelectItem value="fefo">FEFO — الأقرب انتهاءً أولًا</SelectItem>
                </SelectContent>
              </Select>
              {allocationFromCosting ? (
                <p className="text-xs text-muted-foreground">
                  تحددها طريقة التكلفة ({COSTING_METHOD_LABELS[settings.costingMethod]}): الدفعة التي تُسحب هي التي
                  تُحسب تكلفتها.
                </p>
              ) : null}
              {settings.batchAllocationStrategy === 'fefo' ? (
                <p className="text-xs text-muted-foreground">
                  الدفعات بلا تاريخ صلاحية تُستهلك بعد المؤرخة، بترتيب FIFO.
                </p>
              ) : null}
            </div>
          </SettingsPanel>
        </TabsContent>

        <TabsContent value="costing" className="mt-0 space-y-4 focus-visible:outline-none">
          {costingLocked ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 p-3 text-sm">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="space-y-0.5">
                <p className="font-medium">
                  طريقة التقييم مقفلة: {COSTING_METHOD_LABELS[settings.costingMethod] ?? settings.costingMethod} ·{' '}
                  {settings.costingScope === 'warehouse' ? 'كل مستودع على حدة' : 'الشركة كاملة'}
                </p>
                <p className="text-xs text-muted-foreground">
                  سُجّلت حركات تكلفة بهذه الطريقة. تغييرها الآن يغيّر قيمة المخزون وأرباح الفترات السابقة، فلا يُغيَّر من
                  هنا؛ يتطلب إجراء انتقال مضبوط من تاريخ محدد.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="space-y-1">
                <p className="font-medium">قرار يُتخذ مرة واحدة، قبل إدخال الرصيد الافتتاحي</p>
                <ul className="list-disc space-y-0.5 ps-4 text-xs text-muted-foreground">
                  <li>
                    <b className="text-foreground">المتوسط المتحرك (موصى به):</b> للأصناف التي تُشترى بأسعار مختلفة؛ أرباح
                    مستقرة وسهلة المتابعة.
                  </li>
                  <li>
                    <b className="text-foreground">FIFO:</b> للبضاعة ذات الصلاحية أو التي تتقادم، أو إذا طلبه المحاسب.
                  </li>
                  <li>الطريقة والنطاق يُقفلان بعد أول حركة مخزون بتكلفة.</li>
                </ul>
              </div>
            </div>
          )}
          <SettingsPanel
            title="تكلفة المخزون"
            description="تؤثر على تكلفة الاستلام والصرف والتقارير — اختر طريقة ونطاقاً يناسب محاسبتك."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="costing-status">احتساب التكلفة</Label>
                <Select
                  value={settings.costingStatus}
                  disabled={controlsDisabled}
                  onValueChange={(value) =>
                    handleCostingField({
                      costingStatus: value as InventoryCompanySettings['costingStatus'],
                    })
                  }
                >
                  <SelectTrigger id="costing-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disabled">معطّل</SelectItem>
                    <SelectItem value="active">مفعّل</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="costing-method">طريقة التقييم</Label>
                <Select
                  value={settings.costingMethod}
                  disabled={controlsDisabled || costingLocked}
                  onValueChange={(value) =>
                    handleCostingField({
                      costingMethod: value as InventoryCompanySettings['costingMethod'],
                    })
                  }
                >
                  <SelectTrigger id="costing-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Only the methods the server can run. */}
                    <SelectItem value="moving_average">{COSTING_METHOD_LABELS.moving_average} (موصى به)</SelectItem>
                    <SelectItem value="fifo">{COSTING_METHOD_LABELS.fifo}</SelectItem>
                    <SelectItem value="lifo">{COSTING_METHOD_LABELS.lifo}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="costing-scope">نطاق التكلفة</Label>
                <Select
                  value={settings.costingScope}
                  disabled={controlsDisabled || costingLocked}
                  onValueChange={(value) =>
                    handleCostingField({
                      costingScope: value as InventoryCompanySettings['costingScope'],
                    })
                  }
                >
                  <SelectTrigger id="costing-scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company">الشركة كاملة</SelectItem>
                    <SelectItem value="warehouse">كل مستودع على حدة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {settings.costingStatus === 'disabled' && !costingLocked ? (
              <p className="mt-3 text-xs text-muted-foreground">
                اختر الطريقة والنطاق، ثم فعّل احتساب التكلفة — قبل إدخال الرصيد الافتتاحي حتى يدخل بتكلفته.
              </p>
            ) : null}
          </SettingsPanel>

          <Dialog open={pendingCosting !== null} onOpenChange={(open) => !open && setPendingCosting(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>تفعيل احتساب التكلفة</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <p>
                    الطريقة: <b>{COSTING_METHOD_LABELS[settings.costingMethod] ?? settings.costingMethod}</b>
                  </p>
                  <p>
                    النطاق: <b>{settings.costingScope === 'warehouse' ? 'كل مستودع على حدة' : 'الشركة كاملة'}</b>
                  </p>
                </div>
                <p className="text-muted-foreground">
                  بعد أول حركة مخزون بتكلفة <b className="text-foreground">لا يمكن تغيير الطريقة ولا النطاق</b>، لأن تغييرهما
                  يغيّر قيمة المخزون وأرباح الفترات السابقة. تأكد من الاختيار مع المحاسب.
                </p>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setPendingCosting(null)}>
                  مراجعة الاختيار
                </Button>
                <Button
                  disabled={update.isPending}
                  onClick={() => {
                    const patch = pendingCosting;
                    setPendingCosting(null);
                    if (patch) void saveCosting(patch);
                  }}
                >
                  تأكيد وتفعيل
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="closing" className="mt-0 focus-visible:outline-none">
          <SettingsPanel
            title="إقفال فترة المخازن"
            description="بعد مراجعة الجرد وتسليم الأرقام للمحاسب: أقفل الفترة حتى لا يُرحَّل فيها مستند بتاريخ قديم."
          >
            <InventoryPeriodLockPanel
              settings={settings}
              disabled={controlsDisabled}
              save={(patch) => update.mutateAsync(patch)}
            />
          </SettingsPanel>
        </TabsContent>

        <TabsContent value="notifications" className="mt-0 focus-visible:outline-none">
          <NotificationTogglesCard
            title="إشعارات المخازن"
            groups={companyApps.filter(INVENTORY_NOTIFICATION_GROUPS)}
            values={settings as Pick<InventoryCompanySettings, InventoryNotificationKey>}
            disabled={controlsDisabled}
            masterDisabled={!settings.notificationsEnabled}
            onToggle={(key, value) => void handleToggle(key, value)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
