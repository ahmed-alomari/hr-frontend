'use client';

import * as React from 'react';
import { Ban, Clock, Eye, EyeOff, Lock } from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ForbiddenState } from '@/components/shared/forbidden-state';
import { ApiError } from '@/features/hr/lib/api/client';
import { useAuthStore } from '@/features/auth/lib/auth-store';
import {
  useIsCompanySuperuser,
  useIsSystemOwner,
} from '@/features/auth/hooks/use-system-owner';
import {
  useCancelAppActivationRequest,
  useCompanyAppsCatalog,
  useCreateAppActivationRequest,
  useSetApplicationVisibility,
} from '@/features/system-owner/hooks/use-company-apps';
import type { CompanyAppCatalogItem } from '@/features/system-owner/lib/api/system-owner';
import {
  looksLikeStorefrontApp,
  resolveApplicationExternalUrl,
  resolveApplicationLaunchPath,
  type ApplicationResponseDto,
} from '@/features/system/applications/lib/api/applications';
import {
  resolveApplicationIcon,
  resolveApplicationTileClass,
} from '@/features/system/applications/lib/application-tile-config';
import { LauncherTile } from '@/features/system/applications/components/launcher-tile';

type FilterId = 'all' | 'enabled' | 'available' | 'pending';

function toLauncherApp(app: CompanyAppCatalogItem): ApplicationResponseDto {
  return {
    id: app.applicationId,
    code: app.code,
    nameAr: app.nameAr,
    nameEn: app.nameEn ?? '',
    description: app.description ?? null,
    icon: app.icon ?? null,
    routePath: app.routePath ?? null,
    launchUrl: app.launchUrl ?? null,
    sortOrder: app.sortOrder,
    isActive: true,
    status: 'active',
  };
}

function MarketplaceTile({
  app,
  index,
  cancelPending,
  onRequest,
  onVisibilityChange,
  visibilityPending,
}: {
  app: CompanyAppCatalogItem;
  index: number;
  cancelPending: { isPending: boolean; mutate: (id: string) => void };
  onRequest: (app: CompanyAppCatalogItem) => void;
  onVisibilityChange?: (app: CompanyAppCatalogItem, isVisible: boolean) => void;
  visibilityPending?: boolean;
}) {
  const launcherApp = toLauncherApp(app);
  const Icon = resolveApplicationIcon(launcherApp);
  const externalUrl = resolveApplicationExternalUrl(launcherApp);
  const href = externalUrl ?? resolveApplicationLaunchPath(launcherApp);
  const tileClass = resolveApplicationTileClass(launcherApp, index);
  // Stopped by the platform owner for every company: the company's choice is
  // kept (still "enabled" here) but the app does not run until started again.
  const platformStopped = !app.platformActive;
  const canOpen =
    !platformStopped && (app.activationState === 'enabled' || app.activationState === 'always_on');
  const isPending = app.activationState === 'pending';
  const isLocked = !canOpen;

  const overlay = platformStopped ? (
    <span
      className="absolute -end-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
      title="موقوف على مستوى المنصة"
    >
      <Ban className="h-3 w-3" />
    </span>
  ) : isPending ? (
    <span className="absolute -end-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-warning text-warning-foreground">
      <Clock className="h-3 w-3" />
    </span>
  ) : isLocked ? (
    <span className="absolute -end-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <Lock className="h-3 w-3" />
    </span>
  ) : null;

  const caption = platformStopped
    ? 'موقوف على مستوى المنصة'
    : canOpen
    ? undefined
    : isPending
      ? 'بانتظار الموافقة'
      : app.canRequestActivation
        ? 'طلب تفعيل'
        : 'غير مفعّل';

  const tile = (
    <LauncherTile
      icon={Icon}
      label={app.nameAr}
      caption={caption}
      tileClass={tileClass}
      href={canOpen ? href : undefined}
      external={canOpen && Boolean(externalUrl)}
      hardNavigation={canOpen && !externalUrl && looksLikeStorefrontApp(launcherApp)}
      onClick={!canOpen && app.canRequestActivation ? () => onRequest(app) : undefined}
      muted={isLocked}
      overlay={overlay}
    />
  );

  if (isPending && app.canCancelPendingRequest && app.pendingRequest) {
    return (
      <div className="flex flex-col items-center gap-1">
        {tile}
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          disabled={cancelPending.isPending}
          onClick={() => cancelPending.mutate(app.pendingRequest!.id)}
        >
          إلغاء الطلب
        </button>
      </div>
    );
  }

  const visibilityControl =
    app.canSetVisibility && onVisibilityChange ? (
      <button
        type="button"
        className="flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
        disabled={visibilityPending}
        onClick={() => onVisibilityChange(app, !app.isVisible)}
      >
        {app.isVisible ? (
          <>
            <Eye className="h-3 w-3" />
            ظاهر في المشغّل
          </>
        ) : (
          <>
            <EyeOff className="h-3 w-3" />
            مخفي من المشغّل
          </>
        )}
      </button>
    ) : canOpen && !app.isVisible ? (
      <span className="text-[11px] text-muted-foreground">مخفي عن الموظفين</span>
    ) : null;

  if (visibilityControl) {
    return (
      <div className="flex flex-col items-center gap-1">
        {tile}
        {visibilityControl}
      </div>
    );
  }

  return tile;
}

export function CompanyApplicationsPage() {
  const companyId = useAuthStore((s) => s.activeCompanyId);
  const isSuperuser = useIsCompanySuperuser();
  const isSystemOwner = useIsSystemOwner();
  const catalogQuery = useCompanyAppsCatalog(companyId ?? '');
  const createRequest = useCreateAppActivationRequest(companyId ?? '');
  const cancelRequest = useCancelAppActivationRequest(companyId ?? '');
  const setVisibility = useSetApplicationVisibility(companyId ?? '');
  const [filter, setFilter] = React.useState<FilterId>('all');
  const [requestingApp, setRequestingApp] = React.useState<CompanyAppCatalogItem | null>(null);
  const [message, setMessage] = React.useState('');

  const catalog = catalogQuery.data;
  const canOpenPage =
    isSuperuser
    || isSystemOwner
    || catalog?.isCompanySuperuser === true
    || catalog?.isSystemOwner === true;

  const apps = (catalog?.applications ?? []).filter((app) => {
    const code = app.code.trim().toLowerCase();
    if (code === 'company-apps' || code === 'system-owner') return false;
    return app.includeInMarketplace;
  });
  const enabledApps = apps.filter(
    (app) => app.activationState === 'enabled' || app.activationState === 'always_on',
  );
  const pendingApps = apps.filter((app) => app.activationState === 'pending');
  const availableApps = apps.filter((app) => app.activationState === 'available');
  const visibleApps =
    filter === 'enabled'
      ? enabledApps
      : filter === 'pending'
        ? pendingApps
        : filter === 'available'
          ? availableApps
          : apps;

  if (!companyId) {
    return <ForbiddenState title="اختر شركة" description="لا توجد شركة نشطة في الجلسة." />;
  }

  if (catalogQuery.isError) {
    const status = catalogQuery.error instanceof ApiError ? catalogQuery.error.status : 0;
    if (status === 403) {
      return (
        <ForbiddenState
          title="لا تملك صلاحية الوصول"
          description="تطبيقات الشركة تظهر لصاحب الشركة (Superuser) أو مالك النظام."
        />
      );
    }
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <SetPageTitle titleAr="تطبيقات الشركة" iconName="LayoutGrid" />
        <p className="text-sm text-destructive">تعذر تحميل كتالوج التطبيقات.</p>
      </div>
    );
  }

  if (!catalogQuery.isLoading && catalog && !canOpenPage) {
    return (
      <ForbiddenState
        title="لا تملك صلاحية الوصول"
        description="تطبيقات الشركة تظهر لصاحب الشركة فقط."
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <SetPageTitle
        titleAr="تطبيقات الشركة"
        descriptionAr="المفعّلة وغير المفعّلة — اطلب التفعيل ليصل مالك النظام"
        iconName="LayoutGrid"
      />

      <p className="text-sm text-muted-foreground">
        اضغط التطبيق المفعّل لفتحه. غير المفعّل اطلب تفعيله ليصل الطلب إلى مالك النظام.
      </p>

      <div className="flex flex-wrap justify-center gap-2">
        {(
          [
            ['all', `الكل (${apps.length})`],
            ['enabled', `مفعّل (${enabledApps.length})`],
            ['available', `غير مفعّل (${availableApps.length})`],
            ['pending', `بانتظار الموافقة (${pendingApps.length})`],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            size="sm"
            variant={filter === id ? 'default' : 'outline'}
            onClick={() => setFilter(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      <section className="launcher-grid mx-auto flex w-full max-w-3xl flex-wrap items-start justify-center gap-x-7 gap-y-6">
        {catalogQuery.isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="launcher-tile flex w-[6.5rem] flex-col items-center gap-2 sm:w-[7.25rem]">
                <div className="launcher-square h-[4.5rem] w-[4.5rem] animate-pulse rounded-[0.85rem] bg-muted sm:h-20 sm:w-20" />
                <div className="h-3 w-16 animate-pulse rounded-full bg-muted" />
              </div>
            ))
          : null}
        {visibleApps.map((app, index) => (
          <MarketplaceTile
            key={app.applicationId || app.code}
            app={app}
            index={index}
            cancelPending={cancelRequest}
            onRequest={setRequestingApp}
            onVisibilityChange={(item, isVisible) =>
              setVisibility.mutate({ applicationId: item.applicationId, isVisible })
            }
            visibilityPending={setVisibility.isPending}
          />
        ))}
        {!catalogQuery.isLoading && visibleApps.length === 0 ? (
          <p className="w-full text-center text-sm text-muted-foreground">لا توجد تطبيقات في هذا التصنيف.</p>
        ) : null}
      </section>

      <Dialog
        open={Boolean(requestingApp)}
        onOpenChange={(open) => {
          if (!open) {
            setRequestingApp(null);
            setMessage('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>طلب تفعيل {requestingApp?.nameAr}</DialogTitle>
            <DialogDescription>
              يصل الطلب إلى مالك النظام للموافقة. بعد الموافقة يظهر التطبيق في المشغّل.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="activation-request-message">رسالة الطلب (اختياري)</Label>
            <Textarea
              id="activation-request-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="مثال: نحتاج المخازن لفرع الرياض"
              className="min-h-22"
            />
          </div>
          <DialogFooter>
            <Button
              disabled={!requestingApp || createRequest.isPending}
              onClick={() => {
                if (!requestingApp) return;
                createRequest.mutate(
                  {
                    applicationId: requestingApp.applicationId,
                    message: message.trim() || undefined,
                  },
                  {
                    onSuccess: () => {
                      setRequestingApp(null);
                      setMessage('');
                    },
                  },
                );
              }}
            >
              إرسال الطلب
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRequestingApp(null);
                setMessage('');
              }}
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
