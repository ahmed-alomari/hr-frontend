'use client';

import { companyCurrencyCode } from '@/features/auth/lib/company-currency';
import * as React from 'react';
import { Archive, CreditCard, Loader2, Pencil, Plus, RotateCcw } from 'lucide-react';
import { PageHeaderPrimaryButton } from '@/components/layouts/page-header-primary-button';
import { InlineFilterToggleButton } from '@/components/shared/inline-filter-toggle-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { paginationBar, useListPagination } from '@/components/ui/paged-list';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useCan } from '@/features/auth/hooks/use-can';
import { useAuthStore } from '@/features/auth/lib/auth-store';
import { ImagePicker } from '@/features/ecommerce/admin/cms/homepage/components/section-entity-pickers';
import {
  useCreatePaymentAccount,
  useDeletePaymentAccount,
  usePaymentAccounts,
  useRestorePaymentAccount,
  useUpdatePaymentAccount,
} from '@/features/ecommerce/admin/payment-accounts/hooks/use-payment-accounts';
import {
  PAYMENT_ACCOUNT_TYPE_LABELS_AR,
  type ArchiveScope,
  type PaymentAccountType,
  type StorePaymentAccount,
} from '@/features/ecommerce/admin/payment-accounts/lib/api/payment-accounts-api';
import { PAYMENT_ACCOUNTS_PERMISSIONS } from '@/features/ecommerce/admin/payment-accounts/permissions';
import { isMultiLangEnabled } from '@/i18n/locale-flags';
import { useHeaderExtrasBridge } from '@/features/ecommerce/admin/cms/settings/lib/use-header-extras-bridge';

type Props = {
  companyId: string;
  currencyCode?: string;
  /** Pushes the filter-toggle + add-new buttons into the settings page header, next to Save. */
  onHeaderExtrasChange?: (node: React.ReactNode | null) => void;
};

type FormState = {
  type: PaymentAccountType;
  nameAr: string;
  nameEn: string;
  providerName: string;
  accountHolderName: string;
  mobile: string;
  accountNumber: string;
  iban: string;
  currencyCode: string;
  countryCode: string;
  instructionsAr: string;
  instructionsEn: string;
  qrImageUrl: string;
  logoUrl: string;
  internalNote: string;
  sortOrder: string;
  isActive: boolean;
  showInStore: boolean;
};

const EMPTY_FORM: FormState = {
  type: 'wallet',
  nameAr: '',
  nameEn: '',
  providerName: '',
  accountHolderName: '',
  mobile: '',
  accountNumber: '',
  iban: '',
  currencyCode: '',
  countryCode: 'YE',
  instructionsAr: '',
  instructionsEn: '',
  qrImageUrl: '',
  logoUrl: '',
  internalNote: '',
  sortOrder: '0',
  isActive: true,
  showInStore: true,
};

const ACCOUNT_TYPES = Object.keys(PAYMENT_ACCOUNT_TYPE_LABELS_AR) as PaymentAccountType[];

function formToPayload(form: FormState) {
  return {
    type: form.type,
    nameAr: form.nameAr,
    nameEn: isMultiLangEnabled ? form.nameEn || null : null,
    providerName: form.providerName || null,
    accountHolderName: form.accountHolderName || null,
    mobile: form.mobile || null,
    accountNumber: form.accountNumber || null,
    iban: form.iban || null,
    currencyCode: form.currencyCode || null,
    countryCode: form.countryCode || null,
    instructionsAr: form.instructionsAr || null,
    instructionsEn: isMultiLangEnabled ? form.instructionsEn || null : null,
    qrImageUrl: form.qrImageUrl || null,
    logoUrl: form.logoUrl || null,
    internalNote: form.internalNote || null,
    sortOrder: Number(form.sortOrder) || 0,
    isActive: form.isActive,
    showInStore: form.showInStore,
  };
}

export function PaymentAccountsPanel({ companyId, currencyCode, onHeaderExtrasChange }: Props) {
  const can = useCan();
  const accessProfile = useAuthStore((s) => s.accessProfile);
  const [archiveScope, setArchiveScope] = React.useState<ArchiveScope>('active');
  const [typeFilter, setTypeFilter] = React.useState<'all' | PaymentAccountType>('all');
  const [search, setSearch] = React.useState('');
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<StorePaymentAccount | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);

  const listQuery = {
    page: 1,
    limit: 100,
    archiveScope,
    type: typeFilter === 'all' ? undefined : typeFilter,
    search: search.trim() || undefined,
  };

  const accountsQuery = usePaymentAccounts(companyId, listQuery, Boolean(companyId));
  const createAccount = useCreatePaymentAccount(companyId);
  const updateAccount = useUpdatePaymentAccount(companyId);
  const deleteAccount = useDeletePaymentAccount(companyId);
  const restoreAccount = useRestorePaymentAccount(companyId);

  function hasPermission(code: string): boolean {
    if (can(code)) return true;
    // CMS APIs use the storefront company — check that company even if session
    // active company differs.
    const company = accessProfile?.companies.find((row) => row.companyId === companyId);
    if (!company || company.deniedPermissions.includes(code)) return false;
    return company.permissions.includes(code);
  }

  function openCreate() {
    setEditTarget(null);
    setForm({
      ...EMPTY_FORM,
      currencyCode: currencyCode ?? companyCurrencyCode(),
    });
    setDialogOpen(true);
  }

  function openEdit(row: StorePaymentAccount) {
    setEditTarget(row);
    setForm({
      type: row.type,
      nameAr: row.nameAr,
      nameEn: row.nameEn ?? '',
      providerName: row.providerName ?? '',
      accountHolderName: row.accountHolderName ?? '',
      mobile: row.mobile ?? '',
      accountNumber: row.accountNumber ?? '',
      iban: row.iban ?? '',
      currencyCode: row.currencyCode ?? '',
      countryCode: row.countryCode ?? '',
      instructionsAr: row.instructionsAr ?? '',
      instructionsEn: row.instructionsEn ?? '',
      qrImageUrl: row.qrImageUrl ?? '',
      logoUrl: row.logoUrl ?? '',
      internalNote: row.internalNote ?? '',
      sortOrder: String(row.sortOrder ?? 0),
      isActive: row.isActive,
      showInStore: row.showInStore,
    });
    setDialogOpen(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.nameAr.trim()) return;
    const payload = formToPayload(form);
    if (editTarget) {
      const { type: _type, ...patch } = payload;
      void _type;
      await updateAccount.mutateAsync({ id: editTarget.id, patch });
    } else {
      await createAccount.mutateAsync(payload);
    }
    setDialogOpen(false);
  }

  const saving = createAccount.isPending || updateAccount.isPending;
  const canCreate = hasPermission(PAYMENT_ACCOUNTS_PERMISSIONS.create);
  const canUpdate = hasPermission(PAYMENT_ACCOUNTS_PERMISSIONS.update);
  const canDelete = hasPermission(PAYMENT_ACCOUNTS_PERMISSIONS.delete);

  const accountsPagination = useListPagination(accountsQuery.data?.items ?? [], [
    typeFilter,
    archiveScope,
    search,
  ]);
  const activeFilterCount =
    (typeFilter !== 'all' ? 1 : 0) + (archiveScope !== 'active' ? 1 : 0) + (search.trim() ? 1 : 0);

  useHeaderExtrasBridge(
    onHeaderExtrasChange,
    () => (
      <div className="flex flex-wrap items-center gap-2">
        <InlineFilterToggleButton
          open={filtersOpen}
          onToggle={() => setFiltersOpen((v) => !v)}
          activeFilterCount={activeFilterCount}
        />
        {canCreate ? (
          <PageHeaderPrimaryButton
            icon={Plus}
            label="حساب جديد"
            className="h-10 px-3.5 text-sm"
            onClick={openCreate}
          >
            حساب جديد
          </PageHeaderPrimaryButton>
        ) : null}
      </div>
    ),
    [filtersOpen, activeFilterCount, canCreate, onHeaderExtrasChange],
  );

  return (
      <div className="space-y-4">
        {!canCreate ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            لا تملك صلاحية الإنشاء (`sta.payment-accounts.create`). حدّث الصفحة أو أعد تسجيل
            الدخول بعد منح الصلاحية.
          </p>
        ) : null}

        {filtersOpen ? (
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border/60 bg-muted/15 p-3">
            <div className="space-y-1.5">
              <Label>النوع</Label>
              <Select
                value={typeFilter}
                onValueChange={(v) => setTypeFilter(v as 'all' | PaymentAccountType)}
              >
                <SelectTrigger className="h-10 w-40 rounded-lg bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {ACCOUNT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {PAYMENT_ACCOUNT_TYPE_LABELS_AR[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>الأرشيف</Label>
              <Select
                value={archiveScope}
                onValueChange={(v) => setArchiveScope(v as ArchiveScope)}
              >
                <SelectTrigger className="h-10 w-36 rounded-lg bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">النشطة</SelectItem>
                  <SelectItem value="archived">المؤرشفة</SelectItem>
                  <SelectItem value="all">الكل</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[10rem] flex-1 space-y-1.5">
              <Label>بحث</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="اسم الحساب…"
                className="h-10 rounded-lg bg-card"
              />
            </div>
          </div>
        ) : null}

        {accountsQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/40" />
            ))}
          </div>
        ) : accountsQuery.isError ? (
          <div className="rounded-xl border border-destructive/30 bg-card p-4 text-sm text-destructive">
            تعذر تحميل حسابات الدفع.
            <button
              type="button"
              className="ms-2 underline"
              onClick={() => void accountsQuery.refetch()}
            >
              إعادة المحاولة
            </button>
          </div>
        ) : (accountsQuery.data?.items ?? []).length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
            <CreditCard className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">لا توجد حسابات ضمن هذا الفلتر.</p>
          </div>
        ) : (
          <>
          <ul className="space-y-2">
            {accountsPagination.pageItems.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
              >
                {/* Phones: details full width, actions on their own row. */}
                <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{row.nameAr}</p>
                    <Badge variant="subtle">{PAYMENT_ACCOUNT_TYPE_LABELS_AR[row.type]}</Badge>
                    {row.showInStore && !row.isArchived && row.isActive ? (
                      <Badge
                        variant="subtle"
                        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                      >
                        بالمتجر
                      </Badge>
                    ) : null}
                    {row.isArchived ? (
                      <Badge variant="subtle" className="text-muted-foreground">
                        مؤرشف
                      </Badge>
                    ) : !row.isActive ? (
                      <Badge variant="subtle" className="text-amber-700 dark:text-amber-400">
                        غير نشط
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[row.providerName, row.mobile, row.iban, row.accountNumber]
                      .filter(Boolean)
                      .join(' · ') || row.code || '—'}
                  </p>
                </div>
                <div className="ms-auto flex items-center gap-1">
                  {canUpdate && !row.isArchived ? (
                    <div className="me-1 flex items-center gap-1.5 rounded-lg border border-border px-2 py-1">
                      <span className="text-[11px] text-muted-foreground">متجر</span>
                      <Switch
                        checked={row.showInStore}
                        onCheckedChange={(showInStore) =>
                          updateAccount.mutate({ id: row.id, patch: { showInStore } })
                        }
                        aria-label="ظهور بالمتجر"
                      />
                    </div>
                  ) : null}
                  {canUpdate && !row.isArchived ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(row)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {row.isArchived && canUpdate ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title="استرجاع"
                      onClick={() => {
                        if (window.confirm('استرجاع حساب الدفع من الأرشيف؟')) {
                          restoreAccount.mutate(row.id);
                        }
                      }}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {canDelete && !row.isArchived ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (window.confirm('أرشفة حساب الدفع؟')) deleteAccount.mutate(row.id);
                      }}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {paginationBar({
            page: accountsPagination.page,
            pageSize: accountsPagination.pageSize,
            total: accountsPagination.total,
            totalPages: accountsPagination.totalPages,
            setPage: accountsPagination.setPage,
            setPageSize: accountsPagination.setPageSize,
          })}
          </>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editTarget ? 'تعديل حساب الدفع' : 'حساب دفع جديد'}
              </DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
              <div className="space-y-1.5">
                <Label>النوع</Label>
                <Select
                  value={form.type}
                  onValueChange={(type) =>
                    setForm((prev) => ({ ...prev, type: type as PaymentAccountType }))
                  }
                  disabled={Boolean(editTarget)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {PAYMENT_ACCOUNT_TYPE_LABELS_AR[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className={isMultiLangEnabled ? 'grid gap-3 sm:grid-cols-2' : undefined}>
                <div className="space-y-1.5">
                  <Label>{isMultiLangEnabled ? 'الاسم (عربي)' : 'الاسم'}</Label>
                  <Input
                    value={form.nameAr}
                    onChange={(e) => setForm((prev) => ({ ...prev, nameAr: e.target.value }))}
                    required
                  />
                </div>
                {isMultiLangEnabled ? (
                  <div className="space-y-1.5">
                    <Label>الاسم (إنجليزي)</Label>
                    <Input
                      dir="ltr"
                      value={form.nameEn}
                      onChange={(e) => setForm((prev) => ({ ...prev, nameEn: e.target.value }))}
                    />
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>المزوّد</Label>
                  <Input
                    value={form.providerName}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, providerName: e.target.value }))
                    }
                    placeholder="Jawali / Alahli"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>اسم صاحب الحساب</Label>
                  <Input
                    value={form.accountHolderName}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, accountHolderName: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>الجوال</Label>
                  <Input
                    dir="ltr"
                    value={form.mobile}
                    onChange={(e) => setForm((prev) => ({ ...prev, mobile: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>رقم الحساب</Label>
                  <Input
                    dir="ltr"
                    value={form.accountNumber}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, accountNumber: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>IBAN</Label>
                <Input
                  dir="ltr"
                  value={form.iban}
                  onChange={(e) => setForm((prev) => ({ ...prev, iban: e.target.value }))}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>العملة</Label>
                  <Input
                    dir="ltr"
                    maxLength={8}
                    value={form.currencyCode}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        currencyCode: e.target.value.toUpperCase(),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>الدولة</Label>
                  <Input
                    dir="ltr"
                    maxLength={2}
                    value={form.countryCode}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        countryCode: e.target.value.toUpperCase(),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>الترتيب</Label>
                  <Input
                    dir="ltr"
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
                  />
                </div>
              </div>

              <div className={isMultiLangEnabled ? 'grid gap-3 sm:grid-cols-2' : undefined}>
                <div className="space-y-1.5">
                  <Label>
                    {isMultiLangEnabled ? 'تعليمات للعميل (عربي)' : 'تعليمات للعميل'}
                  </Label>
                  <Textarea
                    value={form.instructionsAr}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, instructionsAr: e.target.value }))
                    }
                    rows={2}
                  />
                </div>
                {isMultiLangEnabled ? (
                  <div className="space-y-1.5">
                    <Label>تعليمات للعميل (إنجليزي)</Label>
                    <Textarea
                      dir="ltr"
                      value={form.instructionsEn}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, instructionsEn: e.target.value }))
                      }
                      rows={2}
                    />
                  </div>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label>ملاحظة داخلية (للإدارة فقط)</Label>
                <Textarea
                  value={form.internalNote}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, internalNote: e.target.value }))
                  }
                  rows={2}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>شعار</Label>
                  <ImagePicker
                    value={form.logoUrl || null}
                    onChange={(logoUrl) =>
                      setForm((prev) => ({ ...prev, logoUrl: logoUrl ?? '' }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>صورة QR</Label>
                  <ImagePicker
                    value={form.qrImageUrl || null}
                    onChange={(qrImageUrl) =>
                      setForm((prev) => ({ ...prev, qrImageUrl: qrImageUrl ?? '' }))
                    }
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
                  <span className="text-sm">نشط</span>
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(isActive) => setForm((prev) => ({ ...prev, isActive }))}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
                  <span className="text-sm">بالمتجر</span>
                  <Switch
                    checked={form.showInStore}
                    onCheckedChange={(showInStore) =>
                      setForm((prev) => ({ ...prev, showInStore }))
                    }
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={saving || !form.nameAr.trim()}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  حفظ
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
  );
}
