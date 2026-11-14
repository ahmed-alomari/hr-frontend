'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronUp,
  Database,
  Eye,
  EyeOff,
  FlaskConical,
  Lock,
  Plus,
  Sprout,
} from 'lucide-react';
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
import { CompanyDomainsTab } from '@/features/system-owner/components/company-domains-tab';
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
  type CompanyDataCatalog,
  type CompanyDataCatalogApp,
  type CompanyDataCatalogSet,
  type CompanyDataKind,
  type CompanyDataRun,
  type DemoResetRun,
  type SystemOwnerCompany,
  type SystemOwnerCompanyApplication,
} from '@/features/system-owner/lib/api/system-owner';
import { CompanyModeCard } from '@/features/system-owner/components/company-mode-card';
import { CompanyOverviewCards } from '@/features/system-owner/components/company-overview-cards';
import { CompanyProfileHeader } from '@/features/system-owner/components/company-profile-header';
import {
  resolveApplicationIcon,
  resolveApplicationTileClass,
} from '@/features/system/applications/lib/application-tile-config';
import { ApiError } from '@/shared/api/client';
import { cn } from '@/shared/utils';

type TabId = 'apps' | 'people' | 'mode' | 'domains';

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
        descriptionAr="بيانات الشركة وحالتها وتطبيقاتها وصاحبها المخوّل"
        iconName="Building2"
      />
      {company ? (
        <CompanyProfileHeader company={company} />
      ) : (
        <div className="flex">
          <Button variant="outline" size="sm" asChild>
            <Link href={systemOwnerRoutes.overview}>العودة للشركات</Link>
          </Button>
        </div>
      )}

      {companyQuery.isError ? (
        <div className="flex items-center gap-2 text-sm text-destructive">
          تعذر تحميل الشركة.
          <Button size="sm" variant="outline" onClick={() => void companyQuery.refetch()}>
            إعادة المحاولة
          </Button>
        </div>
      ) : (
        <>
          {company ? (
            <CompanyOverviewCards company={company} onOpen={setTab} />
          ) : null}

          <div
            role="tablist"
            aria-label="أقسام الشركة"
            className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-muted/30 p-1"
          >
            {/* On a phone the bar scrolls instead of widening the page. */}
            {(
              [
                ['apps', 'التطبيقات'],
                ['people', 'المستخدمون والملاك'],
                ['domains', 'النطاقات'],
                ['mode', 'وضع الشركة'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  'flex-1 shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors',
                  tab === id ? 'bg-card font-medium shadow-sm' : 'text-muted-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'apps' ? <CompanyAppsTab companyId={companyId} company={company} /> : null}
          {tab === 'people' ? <CompanyPeopleTab companyId={companyId} /> : null}
          {tab === 'domains' ? <CompanyDomainsTab companyId={companyId} /> : null}
          {tab === 'mode' && company ? <CompanyModeCard company={company} /> : null}
        </>
      )}
    </div>
  );
}

function CompanyAppsTab({
  companyId,
  company,
}: {
  companyId: string;
  company: SystemOwnerCompany | undefined;
}) {
  const { data, isLoading, isError } = useSystemOwnerCompanyApplications(companyId);
  const catalog = useQuery({
    queryKey: ['system-owner', 'data-catalog', companyId],
    queryFn: () => systemOwnerApi.companyDataCatalog(companyId),
  });
  const setsByApp = new Map((catalog.data?.apps ?? []).map((app) => [app.code, app]));
  const [selectedProfile, setSelectedProfile] =
    React.useState<CatalogDemoProfileCode>('beauty');
  React.useEffect(() => {
    if (catalog.data?.catalogProfile) setSelectedProfile(catalog.data.catalogProfile);
  }, [catalog.data?.catalogProfile]);
  const production = company?.operatingMode === 'production';
  /** One app's data panel open at a time; closed again on leaving the tab. */
  const [openData, setOpenData] = React.useState<string | null>(null);
  const { patchCompanyApplication } = useSystemOwnerMutations();
  const queryClient = useQueryClient();
  /** The app whose switch was turned on while some of what it needs is off. */
  const [needsFirst, setNeedsFirst] = React.useState<SystemOwnerCompanyApplication | null>(null);
  const [enablingChain, setEnablingChain] = React.useState(false);

  const apps = data ?? [];
  /**
   * A switch shows its new state at once and stays locked until the
   * reloaded list agrees (2026-11-14): a second click on a stale switch
   * used to undo the first.
   */
  const [optimistic, setOptimistic] = React.useState<Record<string, boolean>>({});
  React.useEffect(() => {
    setOptimistic((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const app of data ?? []) {
        if (app.id in next && next[app.id] === app.isEnabled) {
          delete next[app.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [data]);
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

  const renderApp = (app: SystemOwnerCompanyApplication, index: number) => {
        const enableLocked = app.isAlwaysEnabled;
        const Icon = resolveApplicationIcon(app);
        const dataApp = setsByApp.get(app.code);
        const dataSets = dataApp?.sets ?? [];
        const dataOpen = openData === app.code;
        const applicationId = app.applicationId || app.id;
        const pending = patchCompanyApplication.isPending || enablingChain;
        const missing = app.isEnabled ? [] : app.missingDependencies;
        const dependents = app.isEnabled ? app.enabledDependents : [];
        // §21: a link to inventory goes off only with one of its two apps.
        const followsApps = app.isEnabled && app.followsApps;
        const bridges = app.isEnabled ? app.followingBridges : [];

        return (
          <li key={app.id}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
            <span
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                resolveApplicationTileClass(app, index),
                !(app.isEnabled || enableLocked) && 'opacity-45 grayscale',
              )}
              aria-hidden
            >
              <Icon className="h-5 w-5" strokeWidth={2} />
            </span>
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
                  checked={(optimistic[app.id] ?? app.isEnabled) || enableLocked}
                  disabled={enableLocked || pending || followsApps || app.id in optimistic}
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
                    setOptimistic((prev) => ({ ...prev, [app.id]: checked }));
                    patchCompanyApplication.mutate(
                      { companyId, applicationId, payload: { isEnabled: checked } },
                      {
                        onError: () =>
                          setOptimistic((prev) => {
                            const next = { ...prev };
                            delete next[app.id];
                            return next;
                          }),
                      },
                    );
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
          {dataApp ? (
            <AppDataPanel
              companyId={companyId}
              app={dataApp}
              appName={nameOf}
              profile={selectedProfile}
              production={production}
              open={dataOpen}
              onOpenChange={(open) => setOpenData(open ? app.code : null)}
              hasSets={dataSets.length > 0}
            />
          ) : null}
          </li>
        );
  };

  const enabledApps = apps.filter((app) => app.isEnabled || app.isAlwaysEnabled);
  const otherApps = apps.filter((app) => !(app.isEnabled || app.isAlwaysEnabled));

  return (
    <div className="space-y-3">
      {catalog.data && company ? (
        <CompanyDemoSection
          company={company}
          profile={selectedProfile}
          onProfileChange={setSelectedProfile}
          catalogProfile={catalog.data.catalogProfile}
          profileOptions={catalog.data.catalogProfileOptions}
          production={production}
          open={openData === DEMO_SECTION}
          onOpenChange={(open) => setOpenData(open ? DEMO_SECTION : null)}
        />
      ) : null}
      <p className="text-xs text-muted-foreground">
        «تفعيل» يتحكم بالترخيص والصلاحيات. «إظهار» يتحكم بظهور التطبيق في مشغّل الموظفين. تطبيق
        النظام وتطبيقات الشركة لا يمكن تعطيلهما، لكن يمكن إخفاؤهما من المشغّل. التطبيق لا يُفعَّل قبل
        ما يعتمد عليه، ولا يُعطَّل وتطبيق مفعّل يعتمد عليه.
      </p>

      {(
        [
          ['مفعّلة لهذه الشركة', enabledApps],
          ['متاحة للتفعيل', otherApps],
        ] as const
      ).map(([title, list]) =>
        list.length ? (
          <section key={title} className="space-y-1.5">
            <h3 className="px-1 text-xs font-semibold text-muted-foreground">
              {title} <span className="tabular-nums">({list.length})</span>
            </h3>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {list.map((app) => renderApp(app, apps.indexOf(app)))}
            </ul>
          </section>
        ) : null,
      )}
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

const DEMO_SECTION = '__demo__';

/** Collapsible trigger shared by the company and app data panels. */
function DataToggle({
  open,
  onOpenChange,
  label,
  locked,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  locked?: boolean;
  children?: React.ReactNode;
}) {
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => onOpenChange(!open)}
      className="flex w-full flex-wrap items-center gap-2 px-4 py-2 text-start text-xs text-muted-foreground hover:bg-muted/30"
    >
      <Database className="h-3.5 w-3.5" />
      <span className="font-medium text-foreground">{label}</span>
      {children}
      {locked ? (
        <span className="inline-flex items-center gap-1 text-[11px]">
          <Lock className="h-3 w-3" />
          التجريبية مقفلة في الإنتاج
        </span>
      ) : null}
      <Chevron className="ms-auto h-4 w-4" />
    </button>
  );
}

function CompanyDemoSection({
  company,
  profile,
  onProfileChange,
  catalogProfile,
  profileOptions,
  production,
  open,
  onOpenChange,
}: {
  company: SystemOwnerCompany;
  profile: CatalogDemoProfileCode;
  onProfileChange: (profile: CatalogDemoProfileCode) => void;
  catalogProfile: CatalogDemoProfileCode | null;
  profileOptions: CompanyDataCatalog['catalogProfileOptions'];
  production: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <DataToggle
        open={open}
        onOpenChange={onOpenChange}
        label="البيانات التجريبية للشركة"
        locked={production}
      >
        <Badge variant={catalogProfile ? 'success' : 'secondary'} className="text-[10px]">
          {catalogProfile
            ? `الباقة: ${profileOptions.find((option) => option.code === catalogProfile)?.labelAr ?? catalogProfile}`
            : 'لم تُنشأ باقة'}
        </Badge>
      </DataToggle>
      {open ? (
        <div className="space-y-3 border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">
            بيانات كل تطبيق تحت التطبيق نفسه. التحديث يُكمل الناقص ويعيد ما زال بيانات تهيئة إلى التعريف
            الرسمي، وما عدّلته الشركة يبقى. سندات المخزون وقيود الحسابات والمصاريف لا تُعاد كتابتها. عاين أولاً.
          </p>
          <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
            <Label htmlFor="catalog-demo-profile">نوع بيانات النشاط التجريبية</Label>
            <p className="text-xs text-muted-foreground">
              يحدد فئات ومنتجات الكتالوج التي ستستخدمها المخازن والمتجر ومبيعات المحل. بعد أول إنشاء يثبت
              الاختيار لحماية السندات والكميات التاريخية.
            </p>
            <Select
              value={profile}
              onValueChange={(value) => onProfileChange(value as CatalogDemoProfileCode)}
              disabled={!!catalogProfile || production}
            >
              <SelectTrigger id="catalog-demo-profile" className="max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {profileOptions.map((option) => (
                  <SelectItem key={option.code} value={option.code}>
                    {option.labelAr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {profileOptions.find((option) => option.code === profile)?.descriptionAr}
            </p>
          </div>
          {production ? (
            <p className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
              <Lock className="h-3.5 w-3.5" />
              الشركة في وضع الإنتاج: لا تُحمَّل البيانات التجريبية ولا تُحذف. غيّر الوضع إلى «تجربة» أو «فحص» أولاً.
            </p>
          ) : (
            <DemoResetCard companyId={company.id} />
          )}
        </div>
      ) : null}
    </section>
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

function AppDataPanel({
  companyId,
  app,
  appName,
  profile,
  production,
  open,
  onOpenChange,
  hasSets,
}: {
  companyId: string;
  app: CompanyDataCatalogApp;
  appName: (code: string) => string;
  profile: CatalogDemoProfileCode;
  production: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasSets: boolean;
}) {
  const starter = app.sets.filter((set) => set.kind === 'starter');
  const demo = app.sets.filter((set) => set.kind === 'demo');
  const note = APP_DATA_NOTE[app.code];
  return (
    <div className="border-t border-border/70">
      <DataToggle
        open={open}
        onOpenChange={onOpenChange}
        label="البيانات الافتراضية"
        locked={production && demo.length > 0}
      >
        <span className="flex flex-wrap items-center gap-1">
          {app.sets.map((set) => (
            <DataSetChip key={set.code} set={set} dimmed={!app.enabled || (production && set.kind === 'demo')} />
          ))}
          {!hasSets ? <span className="text-[11px]">لا توجد</span> : null}
        </span>
      </DataToggle>
      {open ? (
        <div className="space-y-2 px-4 pb-3">
          {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
          {!app.enabled && hasSets ? (
            <p className="text-xs text-warning">فعّل التطبيق أولاً ليمكن تحميل بياناته.</p>
          ) : null}
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
            production ? (
              <p className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
                <Lock className="h-3.5 w-3.5" />
                البيانات التجريبية مقفلة: الشركة في وضع الإنتاج.
              </p>
            ) : (
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
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** One data set as a small icon: a sprout for starter data, a flask for demo data. */
function DataSetChip({ set, dimmed }: { set: CompanyDataCatalogSet; dimmed: boolean }) {
  const Icon = set.kind === 'starter' ? Sprout : FlaskConical;
  return (
    <span
      title={`${set.kind === 'starter' ? 'تأسيسية' : 'تجريبية'}: ${set.labelAr}`}
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-[11px]',
        set.kind === 'starter'
          ? 'border-success/40 bg-success/10 text-foreground'
          : 'border-warning/40 bg-warning/10 text-foreground',
        dimmed && 'opacity-50',
      )}
    >
      <Icon className="h-3 w-3" />
      <span className="max-w-[9rem] truncate">{set.labelAr}</span>
    </span>
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

/**
 * Users and owners in one list (owner 2026-11-14): every user of the company,
 * the owners (company superusers) marked with their own on/off switch, and
 * «تعيين صاحباً للشركة» on the others.
 */
function CompanyPeopleTab({ companyId }: { companyId: string }) {
  const currentUser = useAuthStore((s) => s.user);
  const { data, isLoading, isError, refetch } = useSystemOwnerCompanyUsers(companyId);
  const superusersQuery = useSystemOwnerSuperusers(companyId);
  const {
    createCompanyUser,
    assignSuperuser: assignOwner,
    setSuperuserActive,
  } = useSystemOwnerMutations();
  const ownerRows = superusersQuery.data ?? [];
  const ownerById = new Map(ownerRows.map((row) => [row.userId, row]));
  const users = data ?? [];
  // Owners not (or no longer) linked as users still show, after the users.
  const ownersOnly = ownerRows.filter((row) => !users.some((u) => u.id === row.userId));
  const ownerCount = ownerRows.filter((row) => row.isActive).length;
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
        <div className="space-y-0.5">
          <p className="text-sm font-medium">
            المستخدمون والملاك
            {!isLoading ? (
              <span className="ms-2 text-xs font-normal text-muted-foreground">
                {users.length} مستخدم · {ownerCount} صاحب شركة
              </span>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground">
            صاحب الشركة المخوّل يدير المستخدمين والأدوار والصلاحيات والتطبيقات المفعّلة بعد دخوله. مالك النظام لا يُعيَّن صاحباً للشركة.
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          إضافة مستخدم
        </Button>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">جاري التحميل…</p> : null}
      {isError ? (
        <div className="flex items-center gap-2 text-sm text-destructive">
          تعذر تحميل المستخدمين.
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            إعادة المحاولة
          </Button>
        </div>
      ) : null}

      {users.length > 0 || ownersOnly.length > 0 ? (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {users.map((user) => {
            const owner = ownerById.get(user.id);
            const isPlatformAdmin = (user.userType ?? '').toLowerCase() === 'platform_admin';
            return (
              <PersonRow
                key={user.id}
                name={user.fullNameAr || user.email || user.id.slice(0, 8)}
                email={user.email ?? null}
                active={user.isActive !== false}
                owner={owner ? { isActive: owner.isActive, notes: owner.notes ?? null } : null}
                ownerBusy={setSuperuserActive.isPending || assignOwner.isPending}
                canAssign={!owner && !isPlatformAdmin}
                onAssign={() => assignOwner.mutate({ companyId, userId: user.id })}
                onOwnerActive={(checked) =>
                  setSuperuserActive.mutate({ companyId, userId: user.id, isActive: checked })
                }
              />
            );
          })}
          {ownersOnly.map((row) => (
            <PersonRow
              key={row.userId}
              name={row.fullNameAr || row.email || row.userId.slice(0, 8)}
              email={row.email ?? null}
              active
              owner={{ isActive: row.isActive, notes: row.notes ?? null }}
              ownerBusy={setSuperuserActive.isPending}
              canAssign={false}
              onAssign={() => undefined}
              onOwnerActive={(checked) =>
                setSuperuserActive.mutate({ companyId, userId: row.userId, isActive: checked })
              }
            />
          ))}
        </ul>
      ) : !isLoading && !isError ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          لا يوجد مستخدمون مرتبطون بالشركة. أضف صاحب الشركة أولاً.
        </p>
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

/** One person of the company: the user, and their owner role when they have one. */
function PersonRow({
  name,
  email,
  active,
  owner,
  ownerBusy,
  canAssign,
  onAssign,
  onOwnerActive,
}: {
  name: string;
  email: string | null;
  active: boolean;
  owner: { isActive: boolean; notes: string | null } | null;
  ownerBusy: boolean;
  canAssign: boolean;
  onAssign: () => void;
  onOwnerActive: (checked: boolean) => void;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
            owner?.isActive ? 'bg-amber-100 text-amber-800' : 'bg-muted text-muted-foreground',
          )}
          aria-hidden
        >
          {name.trim().charAt(0) || '؟'}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-medium">{name}</p>
            {owner ? (
              <Badge variant={owner.isActive ? 'gold' : 'subtle'} className="text-[10px]">
                {owner.isActive ? 'صاحب الشركة' : 'صاحب شركة موقوف'}
              </Badge>
            ) : null}
            {!active ? (
              <Badge variant="subtle" className="text-[10px]">
                حساب غير نشط
              </Badge>
            ) : null}
          </div>
          <p className="truncate text-xs text-muted-foreground" dir="ltr">
            {email}
            {owner?.notes ? ` · ${owner.notes}` : ''}
          </p>
        </div>
      </div>
      {owner ? (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          صلاحية صاحب الشركة
          <Switch
            checked={owner.isActive}
            disabled={ownerBusy}
            onCheckedChange={onOwnerActive}
            aria-label={`صلاحية صاحب الشركة: ${name}`}
          />
        </label>
      ) : canAssign ? (
        <Button size="sm" variant="outline" disabled={ownerBusy} onClick={onAssign}>
          تعيين صاحباً للشركة
        </Button>
      ) : null}
    </li>
  );
}
