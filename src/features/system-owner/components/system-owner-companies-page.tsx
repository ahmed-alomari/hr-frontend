'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Building2, Plus } from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { PageHeaderPrimaryButton } from '@/components/layouts/page-header-primary-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { systemOwnerRoutes } from '@/features/system-owner/constants/routes';
import {
  COMPANY_MODE_LABEL,
  COMPANY_STATUS_TABS,
} from '@/features/system-owner/constants/company-status';
import {
  useSystemOwnerCompanies,
  useSystemOwnerMutations,
} from '@/features/system-owner/hooks/use-system-owner';
import type { CompanyStatus } from '@/features/system-owner/lib/api/system-owner';
import { LauncherTile } from '@/features/system/applications/components/launcher-tile';
import { resolveIndexedTileClass } from '@/features/system/applications/lib/application-tile-config';
import { resolveUploadUrl } from '@/shared/resolve-upload-url';
import { cn } from '@/shared/utils';

const isStatus = (value: string | null): value is CompanyStatus =>
  COMPANY_STATUS_TABS.some((tab) => tab.value === value);

export function SystemOwnerCompaniesPage() {
  return (
    <React.Suspense fallback={null}>
      <CompaniesPageContent />
    </React.Suspense>
  );
}

function CompaniesPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requested = searchParams.get('tab');
  const tab: CompanyStatus = isStatus(requested) ? requested : 'active';
  const [search, setSearch] = React.useState('');
  const [formOpen, setFormOpen] = React.useState(false);
  const { data, isLoading, isError } = useSystemOwnerCompanies();
  const { createCompany } = useSystemOwnerMutations();
  const items = React.useMemo(() => data?.items ?? [], [data]);

  const counts = React.useMemo(() => {
    const out: Record<CompanyStatus, number> = { active: 0, suspended: 0, archived: 0 };
    for (const row of items) out[row.status] += 1;
    return out;
  }, [items]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (row) =>
        row.status === tab &&
        (!q ||
          [row.nameAr, row.nameEn, row.code, row.city, row.email]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q)),
    );
  }, [items, search, tab]);

  const selectTab = (value: CompanyStatus) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'active') params.delete('tab');
    else params.set('tab', value);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  usePageHeaderActions(
    () => (
      <PageHeaderPrimaryButton
        icon={Plus}
        label="شركة جديدة"
        onClick={() => setFormOpen(true)}
      >
        شركة جديدة
      </PageHeaderPrimaryButton>
    ),
    [],
  );

  return (
    <div className="flex flex-col items-center gap-5">
      <SetPageTitle titleAr="الشركات" descriptionAr="كل شركات المنصة" iconName="Building2" />
      <div
        role="tablist"
        aria-label="حالة الشركات"
        className="flex w-full max-w-md gap-1 rounded-xl border border-border bg-muted/30 p-1"
      >
        {COMPANY_STATUS_TABS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={tab === option.value}
            onClick={() => selectTab(option.value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors',
              tab === option.value ? 'bg-card font-medium shadow-sm' : 'text-muted-foreground',
            )}
          >
            {option.label}
            {isLoading ? null : (
              <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">
                {counts[option.value]}
              </span>
            )}
          </button>
        ))}
      </div>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="بحث بالاسم أو الرمز…"
        className="max-w-sm"
      />
      {isError ? (
        <p className="text-sm text-destructive">تعذر تحميل الشركات.</p>
      ) : isLoading ? (
        <div className="launcher-grid flex w-full max-w-3xl flex-wrap items-start justify-center gap-x-7 gap-y-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="launcher-tile flex w-[6.5rem] flex-col items-center gap-2 sm:w-[7.25rem]">
              <div className="launcher-square h-[4.5rem] w-[4.5rem] animate-pulse rounded-[0.85rem] bg-muted sm:h-20 sm:w-20" />
              <div className="h-3 w-16 animate-pulse rounded-full bg-muted" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {search.trim()
            ? 'لا توجد شركة بهذا الاسم هنا.'
            : tab === 'active'
              ? 'لا توجد شركات فعّالة.'
              : tab === 'suspended'
                ? 'لا توجد شركات متوقفة.'
                : 'لا توجد شركات منتهية.'}
        </p>
      ) : (
        <div className="launcher-grid flex w-full max-w-3xl flex-wrap items-start justify-center gap-x-7 gap-y-6">
          {filtered.map((row, index) => (
            <LauncherTile
              key={row.id}
              icon={Building2}
              imageSrc={row.logoUrl ? resolveUploadUrl(row.logoUrl) : null}
              label={row.nameAr}
              caption={[row.code, COMPANY_MODE_LABEL[row.operatingMode]].filter(Boolean).join(' · ')}
              tileClass={resolveIndexedTileClass(index)}
              href={systemOwnerRoutes.companyDetail(row.id)}
              muted={row.status !== 'active'}
            />
          ))}
        </div>
      )}

      <CreateCompanyDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        saving={createCompany.isPending}
        onSubmit={async (payload) => {
          await createCompany.mutateAsync(payload);
          setFormOpen(false);
        }}
      />
    </div>
  );
}

function CreateCompanyDialog({
  open,
  onOpenChange,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  onSubmit: (payload: { nameAr: string; code?: string; nameEn?: string }) => Promise<void>;
}) {
  const [nameAr, setNameAr] = React.useState('');
  const [code, setCode] = React.useState('');
  const [nameEn, setNameEn] = React.useState('');

  React.useEffect(() => {
    if (!open) {
      setNameAr('');
      setCode('');
      setNameEn('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>شركة جديدة</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="so-name-ar">اسم الشركة</Label>
            <Input id="so-name-ar" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="so-code">الرمز (اختياري)</Label>
            <Input id="so-code" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="so-name-en">الاسم الإنجليزي (اختياري)</Label>
            <Input id="so-name-en" dir="ltr" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            الشركة الجديدة تبدأ في وضع «تجربة» وتحصل على تطبيق النظام فقط. فعّل بقية التطبيقات، وأضف
            الشعار وبقية البيانات، من صفحة الشركة.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            إلغاء
          </Button>
          <Button
            disabled={saving || !nameAr.trim()}
            onClick={() =>
              void onSubmit({
                nameAr: nameAr.trim(),
                code: code.trim() || undefined,
                nameEn: nameEn.trim() || undefined,
              })
            }
          >
            {saving ? 'جاري الإنشاء…' : 'إنشاء'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
