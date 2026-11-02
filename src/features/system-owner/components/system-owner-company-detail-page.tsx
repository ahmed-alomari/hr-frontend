'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { systemOwnerRoutes } from '@/features/system-owner/constants/routes';
import { useAuthStore } from '@/features/auth/lib/auth-store';
import {
  useSystemOwnerCompany,
  useSystemOwnerCompanyApplications,
  useSystemOwnerCompanyUsers,
  useSystemOwnerMutations,
  useSystemOwnerSuperusers,
} from '@/features/system-owner/hooks/use-system-owner';
import {
  systemOwnerApi,
  type CatalogDemoProfileCode,
  type CompanyDataCatalogApp,
  type CompanyDataCatalogSet,
  type CompanyDataKind,
  type CompanyDataRun,
  type DemoResetRun,
  type SystemOwnerCompanyApplication,
} from '@/features/system-owner/lib/api/system-owner';
import { ApiError } from '@/shared/api/client';
import { cn } from '@/shared/utils';

type TabId = 'apps' | 'data' | 'users' | 'superusers';

export function SystemOwnerCompanyDetailPage() {
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;
  const [tab, setTab] = React.useState<TabId>('apps');
  const companyQuery = useSystemOwnerCompany(companyId);
  const company = companyQuery.data;

  return (
    <div className="flex flex-col gap-4">
      <SetPageTitle
        titleAr={company?.nameAr ?? 'تفاصيل الشركة'}
        descriptionAr="تفعيل التطبيقات وتعيين صاحب الشركة المخوّل"
        iconName="Building2"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={systemOwnerRoutes.overview}>العودة للشركات</Link>
        </Button>
        {company?.code ? (
          <Badge variant="secondary" className="gap-1 text-xs">
            رمز الشركة:
            <span dir="ltr" className="font-mono">
              {company.code}
            </span>
          </Badge>
        ) : null}
      </div>

      {companyQuery.isError ? (
        <p className="text-sm text-destructive">تعذر تحميل الشركة.</p>
      ) : (
        <>
          <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
            {(
              [
                ['apps', 'التطبيقات'],
                ['data', 'البيانات الافتراضية'],
                ['users', 'المستخدمون'],
                ['superusers', 'Superusers'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  'flex-1 rounded-lg px-3 py-1.5 text-sm transition-colors',
                  tab === id ? 'bg-card font-medium shadow-sm' : 'text-muted-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'apps' ? <CompanyAppsTab companyId={companyId} /> : null}
          {tab === 'data' ? <CompanyDataTab companyId={companyId} /> : null}
          {tab === 'users' ? <CompanyUsersTab companyId={companyId} /> : null}
          {tab === 'superusers' ? <CompanySuperusersTab companyId={companyId} /> : null}
        </>
      )}
    </div>
  );
}

function CompanyAppsTab({ companyId }: { companyId: string }) {
  const { data, isLoading, isError } = useSystemOwnerCompanyApplications(companyId);
  const { patchCompanyApplication } = useSystemOwnerMutations();
  const queryClient = useQueryClient();
  /** The app whose switch was turned on while some of what it needs is off. */
  const [needsFirst, setNeedsFirst] = React.useState<SystemOwnerCompanyApplication | null>(null);
  const [enablingChain, setEnablingChain] = React.useState(false);

  const apps = data ?? [];
  const byCode = new Map(apps.map((a) => [a.code, a]));
  const nameOf = (code: string) => byCode.get(code)?.nameAr || code;
  const names = (codes: string[]) => codes.map((c) => `«${nameOf(c)}»`).join('، ');

  /** Enables what the app needs (in order), then the app; stops at the first refusal. */
  async function enableWithRequirements(app: SystemOwnerCompanyApplication) {
    setEnablingChain(true);
    const chain = [...app.missingDependencies, app.code];
    let done = 0;
    try {
      for (const code of chain) {
        const target = byCode.get(code);
        if (!target) throw new Error(`التطبيق ${code} غير موجود في قائمة الشركة`);
        await systemOwnerApi.patchCompanyApplication(companyId, target.applicationId || target.id, {
          isEnabled: true,
        });
        done += 1;
      }
      toast.success(`تم تفعيل ${names(chain)}`);
      setNeedsFirst(null);
    } catch (err) {
      // The API client already showed the reason; say how far it got.
      if (done > 0) toast.message(`فُعّل: ${names(chain.slice(0, done))}. توقّف عند «${nameOf(chain[done])}».`);
      if (!(err instanceof ApiError)) toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setEnablingChain(false);
      void queryClient.invalidateQueries({ queryKey: ['system-owner'] });
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">جاري التحميل…</p>;
  if (isError) return <p className="text-sm text-destructive">تعذر تحميل التطبيقات.</p>;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        «تفعيل» يتحكم بالترخيص والصلاحيات. «إظهار» يتحكم بظهور التطبيق في مشغّل الموظفين. تطبيق
        النظام وتطبيقات الشركة لا يمكن تعطيلهما، لكن يمكن إخفاؤهما من المشغّل. التطبيق لا يُفعَّل قبل
        ما يعتمد عليه، ولا يُعطَّل وتطبيق مفعّل يعتمد عليه.
      </p>
      {apps.map((app) => {
        const enableLocked = app.isAlwaysEnabled;
        const applicationId = app.applicationId || app.id;
        const pending = patchCompanyApplication.isPending || enablingChain;
        const missing = app.isEnabled ? [] : app.missingDependencies;
        const dependents = app.isEnabled ? app.enabledDependents : [];
        // §21: a link to inventory goes off only with one of its two apps.
        const followsApps = app.isEnabled && app.followsApps;
        const bridges = app.isEnabled ? app.followingBridges : [];

        return (
          <div
            key={app.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{app.nameAr}</p>
                {!app.isVisible && app.isEnabled ? (
                  <Badge variant="secondary" className="text-[10px]">
                    مخفي من المشغّل
                  </Badge>
                ) : null}
                {!app.platformActive ? (
                  <Badge variant="destructive" className="text-[10px]">
                    موقوف على مستوى المنصة
                  </Badge>
                ) : null}
              </div>
              {!app.platformActive ? (
                <p className="text-xs text-warning">
                  {app.isEnabled
                    ? 'مفعّل لهذه الشركة لكنه لا يعمل: التطبيق موقوف لكل الشركات. يبقى هذا الاختيار محفوظاً ويعمل عند تشغيله من «تطبيقات المنصة».'
                    : 'التطبيق موقوف لكل الشركات — تفعيله هنا يُحفظ ولا يعمل حتى يُشغَّل من «تطبيقات المنصة».'}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground" dir="ltr">
                {app.code}
              </p>
              {app.dependsOn.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  يعتمد على: {names(app.dependsOn)}
                </p>
              ) : null}
              {missing.length > 0 ? (
                <p className="text-xs text-warning">
                  يتطلب تفعيل {names(missing)} أولاً.
                </p>
              ) : null}
              {dependents.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  تعتمد عليه: {names(dependents)} — لا يُعطَّل قبلها.
                </p>
              ) : null}
              {bridges.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  يتوقف معه: {names(bridges)}، بعد فحوصه (الطلبات والورديات المفتوحة).
                </p>
              ) : null}
              {followsApps ? (
                <p className="text-xs text-muted-foreground">
                  ربط تلقائي: لا يُعطَّل وحده، ويتوقف بتعطيل {names(app.dependsOn)}.
                </p>
              ) : !app.isEnabled && app.followsApps ? (
                <p className="text-xs text-warning">
                  إعداد المخازن غير مكتمل: فعّله بعد اختيار المستودع وإدخال الرصيد. حتى ذلك يُباع من كمية المنتج.
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch
                  checked={app.isEnabled || enableLocked}
                  disabled={enableLocked || pending || followsApps}
                  onCheckedChange={(checked) => {
                    if (checked && missing.length > 0) {
                      setNeedsFirst(app);
                      return;
                    }
                    if (!checked && dependents.length > 0) {
                      toast.error(
                        `لا يمكن تعطيل «${app.nameAr}»: ${dependents.length > 1 ? 'هذه التطبيقات المفعّلة تعتمد عليه' : 'هذا التطبيق المفعّل يعتمد عليه'}: ${names(dependents)}. عطّلها أولاً.`,
                      );
                      return;
                    }
                    patchCompanyApplication.mutate({
                      companyId,
                      applicationId,
                      payload: { isEnabled: checked },
                    });
                  }}
                  aria-label={`تفعيل ${app.nameAr}`}
                />
                تفعيل
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch
                  checked={app.isVisible}
                  disabled={!app.isEnabled || pending}
                  onCheckedChange={(checked) =>
                    patchCompanyApplication.mutate({
                      companyId,
                      applicationId,
                      payload: { isVisible: checked },
                    })
                  }
                  aria-label={`إظهار ${app.nameAr} في المشغّل`}
                />
                إظهار
              </label>
            </div>
          </div>
        );
      })}
      {apps.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا توجد تطبيقات في الكتالوج.</p>
      ) : null}

      <Dialog open={needsFirst !== null} onOpenChange={(open) => (!open && !enablingChain ? setNeedsFirst(null) : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تفعيل «{needsFirst?.nameAr}» يتطلب تطبيقات أخرى</DialogTitle>
            <DialogDescription>
              «{needsFirst?.nameAr}» يعتمد على تطبيقات غير مفعّلة لهذه الشركة. تُفعَّل بهذا الترتيب ثم يُفعَّل هو:
            </DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-1 ps-5 text-sm">
            {(needsFirst?.missingDependencies ?? []).map((code) => (
              <li key={code}>{nameOf(code)}</li>
            ))}
            <li className="font-medium">{needsFirst?.nameAr}</li>
          </ol>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={enablingChain} onClick={() => setNeedsFirst(null)}>
              إلغاء
            </Button>
            <Button disabled={enablingChain} onClick={() => needsFirst && void enableWithRequirements(needsFirst)}>
              {enablingChain ? 'جارٍ التفعيل…' : 'تفعيل مع المتطلبات'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** How this app’s default data stays tied to the others. */
const APP_DATA_NOTE: Record<string, string> = {
  system: 'المسميات الوظيفية إعداد مشترك للشركة.',
  hr: 'أنواع الإجازات والطلبات إعداد رسمي للموارد البشرية.',
  contacts:
    'التصنيفات إعداد التشغيل. جهات الاتصال التجريبية وحساباتها عينة مستقلة (له وعليه)، وليست فواتير مخزون مرحّلة.',
  catalog:
    'التصنيفات والوحدات والخصائص أساس المنتجات. المنتجات التجريبية ومتغيراتها تُبنى عليها وتستخدمها المخازن والمتجر ومبيعات المحل بنفس الرموز.',
  inventory:
    'المستودع الرئيسي ومواقعه أساس الحركة. الأوامر التجريبية تصرف وتستلم منتجات الكتالوج بين المستودع الرئيسي والفرعي، ولا تُعاد كتابة سند موجود.',
  'shop-sales':
    'مواقع نقاط البيع مخزون لمبيعات المحل، والكميات على نفس منتجات الكتالوج. ليست شاشة كاشير نقاط البيع.',
  'store-admin':
    'فئات المتجر وعرضه يربطان المنتجات التجريبية نفسها. منتج وضعته الشركة في فئة خاصة لا يُنقل.',
  expenses:
    'الفئات إعداد التشغيل. العينة أشخاص وعهد ومصاريف وتسويات، ولا تُحمَّل إن وُجدت مصاريف أو عهد للشركة.',
  pos: 'لا تُزرع سجلات. النقطة والوردية والبيع تُنشأ من شاشة الكاشير.',
  accounting: 'لا توجد بيانات افتراضية للمحاسبة.',
  storefront: 'واجهة المتجر تعرض ما يجهزه تطبيق المتجر.',
  'store-stock-sync': 'يربط طلبات المتجر بالمخزون، بلا عينة خاصة.',
};

function CompanyDataTab({ companyId }: { companyId: string }) {
  const { data: apps } = useSystemOwnerCompanyApplications(companyId);
  const catalog = useQuery({
    queryKey: ['system-owner', 'data-catalog', companyId],
    queryFn: () => systemOwnerApi.companyDataCatalog(companyId),
  });
  const names = new Map((apps ?? []).map((a) => [a.code, a.nameAr]));
  const appName = (code: string) => names.get(code) || code;
  const [selectedProfile, setSelectedProfile] =
    React.useState<CatalogDemoProfileCode>('beauty');
  React.useEffect(() => {
    if (catalog.data?.catalogProfile) {
      setSelectedProfile(catalog.data.catalogProfile);
    }
  }, [catalog.data?.catalogProfile]);
  const cards = (catalog.data?.apps ?? []).filter(
    (app) => app.sets.length > 0 || app.enabled,
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        كل تطبيق له بياناته. التحديث يُكمل الناقص ويعيد السجلات التي ما زالت بيانات تهيئة إلى التعريف الرسمي.
        ما عدّلته الشركة يبقى. سندات المخزون وقيود الحسابات والمصاريف الموجودة لا تُعاد كتابتها حتى يبقى الرصيد
        مترابطاً. عاين أولاً.
      </p>
      {catalog.data ? (
        <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="space-y-1">
            <Label htmlFor="catalog-demo-profile">نوع بيانات النشاط التجريبية</Label>
            <p className="text-xs text-muted-foreground">
              يحدد فئات ومنتجات الكتالوج التي ستستخدمها المخازن والمتجر ومبيعات المحل.
              بعد أول إنشاء يثبت الاختيار لحماية السندات والكميات التاريخية.
            </p>
          </div>
          <Select
            value={selectedProfile}
            onValueChange={(value) =>
              setSelectedProfile(value as CatalogDemoProfileCode)
            }
            disabled={!!catalog.data.catalogProfile}
          >
            <SelectTrigger id="catalog-demo-profile" className="max-w-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {catalog.data.catalogProfileOptions.map((profile) => (
                <SelectItem key={profile.code} value={profile.code}>
                  {profile.labelAr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {
              catalog.data.catalogProfileOptions.find(
                (profile) => profile.code === selectedProfile,
              )?.descriptionAr
            }
          </p>
          {catalog.data.catalogProfile ? (
            <Badge variant="success">الباقة مثبتة لهذه الشركة</Badge>
          ) : (
            <Badge variant="warning">لم تُنشأ باقة بعد</Badge>
          )}
        </div>
      ) : null}
      {catalog.data ? <DemoResetCard companyId={companyId} /> : null}
      {catalog.isLoading ? (
        <p className="text-xs text-muted-foreground">جارٍ التحميل…</p>
      ) : null}
      {catalog.isError ? (
        <p className="text-sm text-destructive">تعذر تحميل بيانات التطبيقات.</p>
      ) : null}
      {cards.map((app) => (
        <AppDataCard
          key={app.code}
          companyId={companyId}
          app={app}
          appName={appName}
          profile={selectedProfile}
        />
      ))}
    </div>
  );
}

function DemoResetCard({ companyId }: { companyId: string }) {
  const { data: company } = useSystemOwnerCompany(companyId);
  const [run, setRun] = React.useState<DemoResetRun | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [typedCode, setTypedCode] = React.useState('');
  const queryClient = useQueryClient();
  const preview = useMutation({
    mutationFn: () => systemOwnerApi.previewDemoReset(companyId),
    onSuccess: setRun,
  });
  const apply = useMutation({
    mutationFn: () => systemOwnerApi.applyDemoReset(companyId),
    onSuccess: (result) => {
      setRun(result);
      setConfirming(false);
      if (!result.applied) {
        toast.error('لم يُحذف شيء: سجلات أخرى ما زالت مرتبطة بالبيانات التجريبية');
        return;
      }
      void queryClient.invalidateQueries({
        queryKey: ['system-owner', 'data-catalog', companyId],
      });
      toast.success(`حُذف ${result.totals.removed} سجلاً تجريبياً، ويمكن اختيار باقة أخرى الآن`);
    },
  });
  const busy = preview.isPending || apply.isPending;
  const companyCode = company?.code ?? '';
  const canRemove =
    !!run && !run.applied && run.blockers.length === 0 && run.totals.removed > 0;
  const openConfirm = () => {
    setTypedCode('');
    setConfirming(true);
  };

  return (
    <section className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">حذف البيانات التجريبية</h3>
        <p className="text-xs text-muted-foreground">
          يُفرغ الشركة من البيانات التجريبية (المنتجات والمستودع الفرعي والرفوف ونقاط البيع والسندات وجهات الاتصال
          والمصاريف التجريبية) ومن كل ما ارتبط بها من سندات ومبيعات وطلبات وحركات تكلفة وحسابات، ثم يفك تثبيت
          الباقة لاختيار نوع آخر. عاين أولاً لترى العدد.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => preview.mutate()}>
          {preview.isPending ? 'جارٍ الحساب…' : 'معاينة الحذف'}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={busy || !canRemove}
          onClick={openConfirm}
        >
          حذف البيانات التجريبية
        </Button>
      </div>
      {run ? <DemoResetResult run={run} /> : null}

      <Dialog
        open={confirming}
        onOpenChange={(open) => (!apply.isPending ? setConfirming(open) : undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حذف البيانات التجريبية — {company?.nameAr}</DialogTitle>
            <DialogDescription>
              سيُحذف {run?.totals.removed ?? 0} سجلاً تجريبياً نهائياً، ولا يمكن التراجع. اكتب رمز الشركة
              للتأكيد.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="demo-reset-code">
              رمز الشركة: <span dir="ltr">{companyCode}</span>
            </Label>
            <Input
              id="demo-reset-code"
              dir="ltr"
              value={typedCode}
              onChange={(e) => setTypedCode(e.target.value)}
              autoComplete="off"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={apply.isPending} onClick={() => setConfirming(false)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              disabled={apply.isPending || !companyCode || typedCode.trim() !== companyCode}
              onClick={() => apply.mutate()}
            >
              {apply.isPending ? 'جارٍ الحذف…' : 'حذف نهائي'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function DemoResetResult({ run }: { run: DemoResetRun }) {
  if (run.blockers.length > 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-destructive">
          تعذر الحذف ولم يتغير شيء: سجلات أخرى ما زالت مرتبطة بالبيانات التجريبية.
        </p>
        <ul className="space-y-1 text-xs">
          {run.blockers.map((b) => (
            <li key={b.code} className="rounded-lg border border-destructive/30 bg-card px-3 py-2">
              <span className="font-medium">{b.labelAr}</span>{' '}
              <span className="tabular-nums text-muted-foreground">({b.count})</span>
              {b.examples.length > 0 ? (
                <span className="ms-2 text-muted-foreground" dir="auto">
                  {b.examples.join('، ')}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (run.totals.removed === 0 && !run.applied) {
    return <p className="text-xs text-muted-foreground">لا توجد بيانات تجريبية لهذه الشركة.</p>;
  }
  const rows = [
    ...run.removed.map((line) => ({ ...line, kept: false })),
    ...run.kept.map((line) => ({ ...line, kept: true })),
  ];
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium">
        {run.applied ? 'النتيجة: حُذف' : 'المعاينة (لم يُحذف شيء): سيُحذف'} {run.totals.removed}
        {run.totals.kept > 0 ? `، ويبقى ${run.totals.kept}` : ''}
      </p>
      <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-start font-medium">البيانات</th>
              <th className="px-3 py-2 text-start font-medium">العدد</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.kept ? 'kept' : 'removed'}-${row.code}`} className="border-t border-border/60">
                <td className={cn('px-3 py-2', row.kept && 'text-muted-foreground')}>{row.labelAr}</td>
                <td className="px-3 py-2 tabular-nums">{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AppDataCard({
  companyId,
  app,
  appName,
  profile,
}: {
  companyId: string;
  app: CompanyDataCatalogApp;
  appName: (code: string) => string;
  profile: CatalogDemoProfileCode;
}) {
  const starter = app.sets.filter((set) => set.kind === 'starter');
  const demo = app.sets.filter((set) => set.kind === 'demo');
  const note = APP_DATA_NOTE[app.code];
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">{app.nameAr}</h3>
          {app.enabled ? null : <Badge variant="secondary">غير مفعّل</Badge>}
        </div>
        {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      </div>
      {starter.length > 0 ? (
        <AppDataKind
          companyId={companyId}
          appCode={app.code}
          appLabel={app.nameAr}
          enabled={app.enabled}
          kind="starter"
          sets={starter}
          appName={appName}
          profile={profile}
        />
      ) : null}
      {demo.length > 0 ? (
        <AppDataKind
          companyId={companyId}
          appCode={app.code}
          appLabel={app.nameAr}
          enabled={app.enabled}
          kind="demo"
          sets={demo}
          appName={appName}
          profile={profile}
        />
      ) : null}
      {app.sets.length === 0 ? (
        <p className="text-xs text-muted-foreground">لا توجد بيانات افتراضية لهذا التطبيق.</p>
      ) : null}
    </section>
  );
}

function AppDataKind({
  companyId,
  appCode,
  appLabel,
  enabled,
  kind,
  sets,
  appName,
  profile,
}: {
  companyId: string;
  appCode: string;
  appLabel: string;
  enabled: boolean;
  kind: CompanyDataKind;
  sets: CompanyDataCatalogSet[];
  appName: (code: string) => string;
  profile: CatalogDemoProfileCode;
}) {
  const [run, setRun] = React.useState<CompanyDataRun | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const queryClient = useQueryClient();
  const title = kind === 'starter' ? 'بيانات تأسيسية' : 'بيانات تجريبية';
  const preview = useMutation({
    mutationFn: () =>
      systemOwnerApi.previewAppCompanyData(
        companyId,
        appCode,
        kind,
        kind === 'demo' ? profile : undefined,
      ),
    onSuccess: setRun,
  });
  const apply = useMutation({
    mutationFn: () =>
      systemOwnerApi.applyAppCompanyData(
        companyId,
        appCode,
        kind,
        kind === 'demo' ? profile : undefined,
      ),
    onSuccess: (result) => {
      setRun(result);
      setConfirming(false);
      void queryClient.invalidateQueries({
        queryKey: ['system-owner', 'data-catalog', companyId],
      });
      const { created, updated } = result.totals;
      toast.success(
        created === 0 && updated === 0
          ? 'لا جديد: البيانات الرسمية متوافقة، وتعديلات الشركة بقيت'
          : `أُنشئ ${created} وحدّث ${updated}`,
      );
    },
  });
  const busy = preview.isPending || apply.isPending;
  const locked = !enabled || busy;

  return (
    <div className="space-y-2 rounded-lg border border-border/70 px-3 py-2">
      <p className="text-xs font-medium">{title}</p>
      <ul className="list-disc space-y-0.5 ps-4 text-xs text-muted-foreground">
        {sets.map((set) => (
          <li key={set.code}>{set.labelAr}</li>
        ))}
      </ul>
      {kind === 'demo' ? (
        <p className="text-xs text-warning">للعرض والتجربة، لا لشركة عميل تعمل عليها فعلياً.</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={locked} onClick={() => preview.mutate()}>
          {preview.isPending ? 'جارٍ الحساب…' : 'معاينة'}
        </Button>
        <Button size="sm" disabled={locked} onClick={() => setConfirming(true)}>
          تحديث البيانات
        </Button>
      </div>
      {run ? <CompanyDataResult run={run} appName={appName} /> : null}

      <Dialog open={confirming} onOpenChange={(open) => (!apply.isPending ? setConfirming(open) : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              تحديث {title} — {appLabel}
            </DialogTitle>
            <DialogDescription>
              تُستكمل السجلات الناقصة، وتُحدَّث السجلات التي ما زالت بيانات تهيئة. ما عدّلته الشركة يبقى.
              {kind === 'demo'
                ? ' سند أو قيد أو مصروف موجود لا يُعاد كتابته، والمنتجات تبقى على رموزها حتى يبقى الربط بين التطبيقات.'
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={apply.isPending} onClick={() => setConfirming(false)}>
              إلغاء
            </Button>
            <Button disabled={apply.isPending} onClick={() => apply.mutate()}>
              {apply.isPending ? 'جارٍ التحديث…' : 'تحديث'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CompanyDataResult({ run, appName }: { run: CompanyDataRun; appName: (code: string) => string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium">
        {run.applied ? 'النتيجة' : 'المعاينة (لم يُكتب شيء)'}: {run.applied ? 'أُنشئ' : 'سيُنشأ'}{' '}
        {run.totals.created}، {run.applied ? 'حُدّث' : 'سيُحدَّث'} {run.totals.updated}، بقي{' '}
        {run.totals.skipped}
      </p>
      <div className="overflow-x-auto rounded-xl border border-border/70">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-start font-medium">البيانات</th>
              <th className="px-3 py-2 text-start font-medium">{run.applied ? 'أُنشئ' : 'سيُنشأ'}</th>
              <th className="px-3 py-2 text-start font-medium">{run.applied ? 'حُدّث' : 'سيُحدَّث'}</th>
              <th className="px-3 py-2 text-start font-medium">بقي</th>
            </tr>
          </thead>
          <tbody>
            {run.sets.map((set) => (
              <tr key={set.code} className="border-t border-border/60">
                <td className="px-3 py-2">
                  {set.labelAr}
                  {set.missingApps.length > 0 ? (
                    <span className="ms-2 text-xs text-muted-foreground">
                      (لم يُنفَّذ: يتطلب تفعيل {set.missingApps.map((c) => `«${appName(c)}»`).join('، ')})
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 tabular-nums">{set.missingApps.length > 0 ? '—' : set.created}</td>
                <td className="px-3 py-2 tabular-nums">{set.missingApps.length > 0 ? '—' : set.updated}</td>
                <td className="px-3 py-2 tabular-nums">{set.missingApps.length > 0 ? '—' : set.skipped}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompanyUsersTab({ companyId }: { companyId: string }) {
  const currentUser = useAuthStore((s) => s.user);
  const { data, isLoading, isError } = useSystemOwnerCompanyUsers(companyId);
  const { createCompanyUser } = useSystemOwnerMutations();
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [fullNameAr, setFullNameAr] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [assignSuperuser, setAssignSuperuser] = React.useState(true);

  function resetForm() {
    setEmail('');
    setFullNameAr('');
    setPassword('');
    setShowPassword(false);
    setAssignSuperuser(true);
  }

  const canSubmit = email.trim() && fullNameAr.trim() && password.trim();
  const ownEmail = (currentUser?.email ?? '').trim().toLowerCase();
  const isOwnAccount = Boolean(ownEmail) && email.trim().toLowerCase() === ownEmail;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          أنشئ صاحب الشركة ببريد مختلف عن مالك النظام. بعد الدخول يدير المستخدمين والأدوار والصلاحيات بنفسه.
        </p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          إضافة مستخدم
        </Button>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">جاري التحميل…</p> : null}
      {isError ? <p className="text-sm text-destructive">تعذر تحميل المستخدمين.</p> : null}

      {(data ?? []).map((user) => (
        <div
          key={user.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
        >
          <div>
            <p className="text-sm font-medium">{user.fullNameAr || user.email || user.id.slice(0, 8)}</p>
            <p className="text-xs text-muted-foreground" dir="ltr">
              {user.email}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {user.isCompanySuperuser ? <Badge variant="gold">صاحب الشركة</Badge> : null}
            <Badge variant={user.isActive === false ? 'subtle' : 'success'}>
              {user.isActive === false ? 'غير نشط' : 'نشط'}
            </Badge>
          </div>
        </div>
      ))}
      {!isLoading && (data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">لا يوجد مستخدمون مرتبطون بالشركة.</p>
      ) : null}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة مستخدم للشركة</DialogTitle>
            <DialogDescription>
              يُنشأ المستخدم ويُربط بالشركة. إذا اخترت صاحب الشركة يصبح مخوّلاً بإدارة المستخدمين والأدوار والصلاحيات والتطبيقات المفعّلة.
            </DialogDescription>
          </DialogHeader>
          <div className="so-user-dialog-form space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="so-user-name">الاسم</Label>
              <Input
                id="so-user-name"
                value={fullNameAr}
                onChange={(e) => setFullNameAr(e.target.value)}
                placeholder="محمد العلي"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="so-user-email">البريد</Label>
              <Input
                id="so-user-email"
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@acme.com"
              />
              {isOwnAccount ? (
                <p className="text-xs text-destructive">
                  هذا بريد مالك النظام. أنشئ مستخدماً ببريد مختلف ليصبح صاحب الشركة.
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="so-user-password">كلمة المرور</Label>
              <div className="relative" dir="ltr">
                <Input
                  id="so-user-password"
                  type={showPassword ? 'text' : 'password'}
                  dir="ltr"
                  className="pe-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Str0ngP@ssw0rd!"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
              <span className="min-w-0">
                <span className="block text-sm">تعيين صاحب الشركة (Superuser)</span>
                <span className="block text-[11px] text-muted-foreground">
                  يخوّله بإدارة المستخدمين والأدوار والصلاحيات وكل تطبيق مفعّل على شركته.
                </span>
              </span>
              <Switch checked={assignSuperuser} onCheckedChange={setAssignSuperuser} />
            </label>
          </div>
          <DialogFooter>
            <Button
              disabled={!canSubmit || isOwnAccount || createCompanyUser.isPending}
              onClick={() =>
                createCompanyUser.mutate(
                  {
                    companyId,
                    payload: {
                      email: email.trim(),
                      fullNameAr: fullNameAr.trim(),
                      password,
                      assignSuperuser,
                    },
                  },
                  {
                    onSuccess: () => {
                      setOpen(false);
                      resetForm();
                    },
                  },
                )
              }
            >
              إنشاء
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CompanySuperusersTab({ companyId }: { companyId: string }) {
  const usersQuery = useSystemOwnerCompanyUsers(companyId);
  const superusersQuery = useSystemOwnerSuperusers(companyId);
  const { assignSuperuser, setSuperuserActive } = useSystemOwnerMutations();
  const [userId, setUserId] = React.useState('');
  const [notes, setNotes] = React.useState('');

  const assignedIds = new Set((superusersQuery.data ?? []).map((s) => s.userId));
  const availableUsers = (usersQuery.data ?? []).filter((u) => {
    if (assignedIds.has(u.id)) return false;
    if ((u.userType ?? '').toLowerCase() === 'platform_admin') return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-medium">تعيين Superuser</p>
        <p className="text-xs text-muted-foreground">
          مالك النظام لا يُعيَّن Superuser. صاحب الشركة المخوّل يدير المستخدمين والأدوار والصلاحيات والتطبيقات المفعّلة بعد دخوله.
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1.5">
            <Label>المستخدم</Label>
            <Select value={userId || '_none'} onValueChange={(v) => setUserId(v === '_none' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="اختر مستخدماً مربوطاً بالشركة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— اختر —</SelectItem>
                {availableUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.fullNameAr || user.email || user.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>ملاحظة</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="أساسي" />
          </div>
        </div>
        <Button
          disabled={!userId || assignSuperuser.isPending}
          onClick={() =>
            assignSuperuser.mutate(
              { companyId, userId, notes: notes.trim() || undefined },
              {
                onSuccess: () => {
                  setUserId('');
                  setNotes('');
                },
              },
            )
          }
        >
          تعيين
        </Button>
      </div>

      {(superusersQuery.data ?? []).map((row) => (
        <div
          key={row.userId}
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
        >
          <div>
            <p className="text-sm font-medium">{row.fullNameAr || row.email || row.userId.slice(0, 8)}</p>
            <p className="text-xs text-muted-foreground" dir="ltr">
              {row.email}
              {row.notes ? ` · ${row.notes}` : ''}
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>نشط</span>
            <Switch
              checked={row.isActive}
              disabled={setSuperuserActive.isPending}
              onCheckedChange={(checked) =>
                setSuperuserActive.mutate({
                  companyId,
                  userId: row.userId,
                  isActive: checked,
                })
              }
            />
          </label>
        </div>
      ))}
      {(superusersQuery.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">لم يُعيَّن Superuser بعد.</p>
      ) : null}
    </div>
  );
}
