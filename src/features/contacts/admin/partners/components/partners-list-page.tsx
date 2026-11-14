'use client';

import { ListToolsTable, useListTools } from '@/components/ui/list-tools';
import { fetchAllPaginatedItems } from '@/shared/api/client';
import { partnersApi } from '@/features/contacts/admin/partners/lib/api/partners';
import { PARTNER_STATUS_LABELS } from '@/features/contacts/domain/constants/labels';
import { FoldedHeaderTool } from '@/components/layouts/phone-fold';
import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Building2, Eye, LayoutGrid, List, Mail, Pencil, Phone, Plus, Trash2 } from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { PageHeaderPrimaryButton } from '@/components/layouts/page-header-primary-button';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import { Button } from '@/components/ui/button';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { DirectoryPagedViews, DEFAULT_PAGE_SIZE } from '@/components/ui/paged-list';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getContactsCompanyId } from '@/features/contacts/lib/company-id';
import { contactsAdminRoutes } from '@/features/contacts/admin/constants/routes';
import { usePartners } from '@/features/contacts/admin/partners/hooks/use-partners';
import { usePartnerMutations } from '@/features/contacts/admin/partners/hooks/use-partner-mutations';
import { lazyDialog } from '@/shared/lib/lazy-dialog';
import { PartnersCardView } from '@/features/contacts/admin/partners/components/partners-card-view';
import {
  PartnerRoleBadges,
  PartnerStatusBadge,
  partnerInitials,
} from '@/features/contacts/admin/partners/components/partner-role-badges';
import type { Partner, PartnerStatus } from '@/features/contacts/domain/types/partner';
import { cn } from '@/shared/utils';

// Loads on first open: keeps the form's code (and zod) out of the page's first load.
const PartnerFormDialog = lazyDialog(() =>
  import('@/features/contacts/admin/partners/components/partner-form-dialog').then((m) => m.PartnerFormDialog),
);

type ViewMode = 'list' | 'cards';

export function PartnersListPage() {
  const companyId = getContactsCompanyId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = searchParams.get('q') ?? '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Number(searchParams.get('pageSize')) || DEFAULT_PAGE_SIZE;
  const rawView = searchParams.get('view');
  const view: ViewMode = rawView === 'cards' ? 'cards' : 'list';
  const roleFilter = searchParams.get('role') ?? 'all';
  const statusFilter = (searchParams.get('status') as PartnerStatus | 'all') || 'all';

  const [searchInput, setSearchInput] = React.useState(search);
  const [formState, setFormState] = React.useState<{ open: boolean; partner: Partner | null }>({
    open: false,
    partner: null,
  });
  const [toDelete, setToDelete] = React.useState<Partner | null>(null);

  function updateParams(next: {
    q?: string;
    page?: number;
    pageSize?: number;
    view?: ViewMode;
    role?: string;
    status?: string;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.q !== undefined) {
      if (next.q) params.set('q', next.q);
      else params.delete('q');
    }
    if (next.page !== undefined) {
      if (next.page > 1) params.set('page', String(next.page));
      else params.delete('page');
    }
    if (next.pageSize !== undefined) {
      if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set('pageSize', String(next.pageSize));
      else params.delete('pageSize');
    }
    if (next.view !== undefined) {
      if (next.view !== 'list') params.set('view', next.view);
      else params.delete('view');
    }
    if (next.role !== undefined) {
      if (next.role !== 'all') params.set('role', next.role);
      else params.delete('role');
    }
    if (next.status !== undefined) {
      if (next.status !== 'all') params.set('status', next.status);
      else params.delete('status');
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const searchRef = React.useRef(search);
  const updateParamsRef = React.useRef(updateParams);
  searchRef.current = search;
  updateParamsRef.current = updateParams;

  // Legacy `?view=kanban` → list (status-column board removed).
  React.useEffect(() => {
    if (rawView === 'kanban') updateParamsRef.current({ view: 'list', page: 1 });
  }, [rawView]);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchInput.trim() !== searchRef.current) {
        updateParamsRef.current({ q: searchInput.trim(), page: 1 });
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const listQuery = {
    companyId,
    search: search || undefined,
    page: view === 'list' ? page : 1,
    limit: view === 'list' ? pageSize : 200,
    status: statusFilter === 'all' ? undefined : statusFilter,
    isCustomer: roleFilter === 'customer' ? true : undefined,
    isVendor: roleFilter === 'vendor' ? true : undefined,
    isEmployee: roleFilter === 'employee' ? true : undefined,
    isInternal: roleFilter === 'internal' ? true : undefined,
  };

  const { data, isLoading, isError } = usePartners(listQuery);
  const { remove } = usePartnerMutations(companyId);

  const openPartner = (partner: Partner) => {
    router.push(contactsAdminRoutes.partnerDetail(partner.id));
  };

  const columns: ColumnDef<Partner>[] = [
    {
      key: 'name',
      title: 'جهة الاتصال',
      render: (row) => (
        <button
          type="button"
          className="flex flex-col text-start transition-colors hover:text-primary"
          onClick={() => openPartner(row)}
        >
          <span className="font-medium text-foreground">{row.displayName}</span>
          {row.refCode ? (
            <span className="text-xs text-muted-foreground" dir="ltr">
              {row.refCode}
            </span>
          ) : null}
        </button>
      ),
    },
    {
      key: 'roles',
      title: 'النوع / الأدوار',
      render: (row) => <PartnerRoleBadges partner={row} />,
    },
    {
      key: 'mobile',
      title: 'الجوال',
      render: (row) => (
        <span className="text-sm text-muted-foreground" dir="ltr">
          {row.mobile || row.phone || '—'}
        </span>
      ),
    },
    {
      key: 'email',
      title: 'البريد',
      hideOnMobile: true,
      render: (row) => (
        <span className="text-sm text-muted-foreground" dir="ltr">
          {row.email || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      title: 'الحالة',
      render: (row) => <PartnerStatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      title: '',
      isActions: true,
      render: (row) => (
        <>
          <Button variant="ghost" size="icon" aria-label="عرض التفاصيل" onClick={() => openPartner(row)}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="تعديل"
            onClick={() => setFormState({ open: true, partner: row })}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="أرشفة" onClick={() => setToDelete(row)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </>
      ),
    },
  ];

  const rolesOf = (p: Partner) =>
    [p.isCustomer && 'عميل', p.isVendor && 'مورد', p.isEmployee && 'موظف', p.isInternal && 'داخلي'].filter(Boolean).join('، ') || '—';
  const tools = useListTools<Partner>({
    section: 'contacts',
    page: 'partners',
    columns,
    rows: data?.items ?? [],
    fetchAll: async () =>
      (await fetchAllPaginatedItems((p, limit) => partnersApi.getAll({ ...listQuery, page: p, limit }))).items,
    resetKey: JSON.stringify({ ...listQuery, page: 0, limit: 0 }),
    fields: {
      name: { kind: 'name', text: (p) => p.displayName },
      roles: { text: rolesOf, group: rolesOf },
      mobile: { kind: 'code', text: (p) => p.mobile || p.phone || '—', sortable: false },
      email: { text: (p) => p.email || '—' },
      status: { kind: 'status', text: (p) => PARTNER_STATUS_LABELS[p.status], group: (p) => p.status, groupLabel: (k) => PARTNER_STATUS_LABELS[k as PartnerStatus] ?? k },
    },
  });

  const viewButtons: { mode: ViewMode; icon: typeof List; label: string }[] = [
    { mode: 'list', icon: List, label: 'قائمة' },
    { mode: 'cards', icon: LayoutGrid, label: 'بطاقات' },
  ];

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton />
        {tools.buttons}
        {tools.exportMenu('جهات الاتصال', 'contacts')}
        <FoldedHeaderTool>
          <div className="flex rounded-lg border border-border p-0.5">
            {viewButtons.map(({ mode, icon: Icon, label }) => (
              <Button
                key={mode}
                type="button"
                size="sm"
                variant="ghost"
                className={cn('h-7 gap-1.5 px-2', view === mode && 'bg-muted')}
                onClick={() => updateParams({ view: mode, page: 1 })}
                aria-label={label}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </Button>
            ))}
          </div>
        </FoldedHeaderTool>
        <PageHeaderPrimaryButton
          icon={Plus}
          label="جهة اتصال جديدة"
          disabled={!companyId}
          onClick={() => setFormState({ open: true, partner: null })}
        />
      </div>
    ),
    [view, companyId, tools.depsKey],
  );

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showDateSection={false}
        showStatusSection={false}
        showEmployeePicker={false}
        leadingFilters={
          <EntityFilterSearchField
            value={searchInput}
            onChange={setSearchInput}
            placeholder="ابحث بالاسم أو الجوال أو البريد أو الرقم الضريبي…"
          />
        }
        inlineSelects={[
          {
            id: 'role',
            value: roleFilter,
            onChange: (value) => updateParams({ role: value, page: 1 }),
            placeholder: 'كل الأدوار',
            options: [
              { value: 'all', label: 'كل الأدوار' },
              { value: 'customer', label: 'عملاء' },
              { value: 'vendor', label: 'موردون' },
              { value: 'employee', label: 'موظفون' },
              { value: 'internal', label: 'داخلي' },
            ],
          },
          {
            id: 'status',
            value: statusFilter,
            onChange: (value) => updateParams({ status: value, page: 1 }),
            placeholder: 'كل الحالات',
            options: [
              { value: 'all', label: 'كل الحالات' },
              { value: 'draft', label: 'مسودة' },
              { value: 'active', label: 'نشط' },
              { value: 'inactive', label: 'غير نشط' },
            ],
          },
        ]}
      />
    ),
    [searchInput, roleFilter, statusFilter],
  );

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <SetPageTitle
        titleAr="جهات الاتصال"
        descriptionAr="السجل المركزي لجهات الاتصال — العملاء والموردون والموظفون والجهات الداخلية."
        iconName="Users"
      />

      {!companyId ? (
        <p className="text-sm text-destructive">اختر شركة نشطة لعرض جهات الاتصال.</p>
      ) : null}
      {isError ? <p className="text-sm text-destructive">تعذر تحميل جهات الاتصال.</p> : null}

      {view === 'list' ? (
        <ListToolsTable tools={tools} keyExtractor={(p) => p.id} onRowClick={(p) => openPartner(p)}>
        <DirectoryPagedViews
          items={tools.rows}
          loading={isLoading}
          serverPagination={
            data
              ? tools.pagination({
                  page,
                  pageSize,
                  total: data.pagination.total,
                  totalPages: Math.max(1, Math.ceil(data.pagination.total / pageSize)),
                  setPage: (nextPage) => updateParams({ page: nextPage }),
                  setPageSize: (size) => updateParams({ pageSize: size, page: 1 }),
                })
              : undefined
          }
        >
          {(rowsPage) => (
            <DataTable
              variant="directory"
              className="ctc-table-host"
              columns={tools.columns}
              {...tools.tableSort}
              data={rowsPage}
              keyExtractor={(row) => row.id}
              loading={isLoading}
              onRowClick={openPartner}
              emptyText="لا توجد جهات اتصال بعد. أنشئ جهة اتصال لتكون المرجع المركزي للنظام."
              mobileCard={(row) => (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold text-foreground">
                      {row.isCompany ? (
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        partnerInitials(row.displayName)
                      )}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate font-medium text-foreground">{row.displayName}</p>
                        <PartnerStatusBadge status={row.status} />
                      </div>
                      {row.refCode ? (
                        <p className="text-xs text-muted-foreground" dir="ltr">
                          {row.refCode}
                        </p>
                      ) : null}
                      <PartnerRoleBadges partner={row} />
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {row.mobile || row.phone ? (
                      <p className="flex items-center gap-1.5 truncate" dir="ltr">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        {row.mobile || row.phone}
                      </p>
                    ) : null}
                    {row.email ? (
                      <p className="flex items-center gap-1.5 truncate" dir="ltr">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        {row.email}
                      </p>
                    ) : null}
                  </div>
                  <div
                    className="flex items-center justify-end gap-1 border-t border-border/60 pt-2"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Button variant="ghost" size="icon" aria-label="عرض التفاصيل" onClick={() => openPartner(row)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="تعديل"
                      onClick={() => setFormState({ open: true, partner: row })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="أرشفة" onClick={() => setToDelete(row)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              )}
            />
          )}
        </DirectoryPagedViews>
        </ListToolsTable>
      ) : null}

      {view === 'cards' ? (
        isLoading ? (
          <p className="text-sm text-muted-foreground">جاري التحميل…</p>
        ) : (
          <PartnersCardView partners={data?.items ?? []} onOpen={openPartner} />
        )
      ) : null}

      <PartnerFormDialog
        open={formState.open}
        partner={formState.partner}
        onOpenChange={(open) => setFormState((s) => ({ ...s, open }))}
        onCreated={(created) => router.push(contactsAdminRoutes.partnerDetail(created.id))}
      />

      <Dialog open={Boolean(toDelete)} onOpenChange={(open) => !open && setToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>أرشفة جهة الاتصال؟</DialogTitle>
            <DialogDescription>
              سيتم أرشفة «{toDelete?.displayName}». السجلات المرتبطة في الوحدات الأخرى ستبقى عبر
              partner_id.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="ctc-dialog-footer">
            <Button variant="outline" onClick={() => setToDelete(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={async () => {
                if (!toDelete) return;
                await remove.mutateAsync(toDelete.id);
                setToDelete(null);
              }}
            >
              أرشفة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
