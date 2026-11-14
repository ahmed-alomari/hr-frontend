'use client';

import { Plus } from 'lucide-react';
import { USER_TYPE_LABELS as USER_TYPE_LABEL_MAP } from '@/features/system/organization/contacts/constants/users-directory';
import { userStatusLabel } from '@/features/system/organization/contacts/hooks/useContactsDirectoryModel';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { Can } from '@/components/shared/can';
import { ListToolsTable, useListTools, type ListToolsModel } from '@/components/ui/list-tools';
import * as React from 'react';
import { UserCircle, Eye, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { TableRowActions } from '@/components/ui/table-cells';
import { DirectoryGrid, DirectoryGridCard, DirectoryGridCardFooter, DirectoryGridCardHeader, DirectoryGridCardMeta, DirectoryGridCardMetaRow, DirectoryGridCardTitle } from '@/components/ui/directory-grid-card';
import { ForbiddenState } from '@/components/shared/forbidden-state';
import { EmptyState } from '@/components/ui/shared-dialogs';
import { DirectoryPagedViews } from '@/components/ui/paged-list';
import { userTypeLabelAr } from '@/features/system/organization/contacts/hooks/useContactsDirectoryModel';
import type { UserRecord, ContactsDirectoryModel } from '@/features/system/organization/contacts/hooks/useContactsDirectoryModel';

type Props = {
  model: ContactsDirectoryModel;
  superuserIds: Set<string>;
};

function SuperuserBadge() {
  return <Badge variant="gold" className="w-fit text-[10px]">Superuser</Badge>;
}

function statusBadge(user: UserRecord) {
  if (!user.isActive) return <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">غير نشط</Badge>;
  if (!user.canSignIn) return <Badge variant="outline" className="text-[10px]">لا يمكن الدخول</Badge>;
  return <Badge variant="outline" className="text-[10px] border-success/40 text-success dark:text-success">نشط</Badge>;
}

function primaryCompanyLabel(row: UserRecord, model: ContactsDirectoryModel) {
  const link = row.companies.find((c) => c.isDefault) ?? row.companies[0];
  if (link) return model.companyLinkLabel(link);
  if (row.defaultCompanyId) {
    const c = model.companies.find((x) => x.id === row.defaultCompanyId);
    return c?.nameAr ?? row.defaultCompanyId.slice(0, 8);
  }
  return '—';
}

function primaryBranchLabel(row: UserRecord, model: ContactsDirectoryModel) {
  const link = row.branches.find((b) => b.isDefault) ?? row.branches[0];
  if (link) return model.branchLinkLabel(link);
  if (row.defaultBranchId) {
    const b = model.branches.find((x) => x.id === row.defaultBranchId);
    return b?.nameAr ?? row.defaultBranchId.slice(0, 8);
  }
  return '—';
}

/** Columns, sort, grouping, export and the page header. */
export function useContactsListTools(model: ContactsDirectoryModel, superuserIds: Props['superuserIds']) {
  const { users, pagination, setViewRow, openEdit, setConfirmId, formatDate, perms, openCreate, usersFilterSummaryLine } = model;

  const columns = React.useMemo((): ColumnDef<UserRecord>[] => [
    {
      key: 'name',
      title: 'الاسم',
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{row.fullNameAr ?? row.email}</span>
          {superuserIds.has(row.id) ? <SuperuserBadge /> : null}
        </div>
      ),
    },
    {
      key: 'email',
      title: 'البريد',
      hideOnMobile: true,
      className: 'text-muted-foreground',
      render: (row) => <span dir="ltr">{row.email}</span>,
    },
    {
      key: 'userType',
      title: 'النوع',
      hideOnMobile: true,
      render: (row) => (
        <Badge variant="outline" className="text-[10px]">
          {userTypeLabelAr(row.userType)}
        </Badge>
      ),
    },
    {
      key: 'company',
      title: 'الشركة',
      hideOnMobile: true,
      className: 'text-muted-foreground text-xs',
      render: (row) => primaryCompanyLabel(row, model),
    },
    {
      key: 'status',
      title: 'الحالة',
      render: (row) => statusBadge(row),
    },
    {
      key: 'actions',
      title: 'إجراءات',
      isActions: true,
      headerClassName: 'text-start w-16',
      render: (row) => (
        <TableRowActions
          menuItems={[
            { label: 'عرض التفاصيل', onClick: (e) => { e.stopPropagation(); setViewRow(row); } },
            ...(perms.canUpdate
              ? [{ label: 'تعديل', onClick: (e: React.MouseEvent) => { e.stopPropagation(); openEdit(row); } }]
              : []),
            ...(perms.canDelete
              ? [{
                  label: 'حذف',
                  onClick: (e: React.MouseEvent) => { e.stopPropagation(); setConfirmId(row.id); },
                  destructive: true,
                  separator: true,
                }]
              : []),
          ]}
        />
      ),
    },
  ], [formatDate, model, openEdit, perms.canDelete, perms.canUpdate, setConfirmId, setViewRow, superuserIds]);

  const companyOf = (row: UserRecord) => primaryCompanyLabel(row, model);
  const typeOf = (row: UserRecord) => USER_TYPE_LABEL_MAP[row.userType ?? ''] ?? row.userType ?? '—';
  const tools = useListTools<UserRecord>({
    section: 'organization',
    page: 'users',
    columns,
    rows: users,
    fetchAll: pagination.loadAll,
    resetKey: pagination.resetKey,
    fields: {
      name: { kind: 'name', text: (row) => row.fullNameAr ?? row.email },
      email: { kind: 'code', text: (row) => row.email },
      userType: { kind: 'status', text: typeOf, group: typeOf },
      company: { text: companyOf, group: companyOf },
      status: { kind: 'status', text: userStatusLabel, group: userStatusLabel },
    },
  });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton />
        {tools.buttons}
        {tools.exportMenu('سجل المستخدمين', 'users', [usersFilterSummaryLine])}
        <Can when={perms.canCreate}>
          <Button variant="luxe" size="sm" className="h-8 gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" /> مستخدم جديد
          </Button>
        </Can>
      </div>
    ),
    [openCreate, perms.canCreate, usersFilterSummaryLine, tools.depsKey],
  );

  return tools;
}

export function ContactsListViews({ model, tools, superuserIds }: Props & { tools: ListToolsModel<UserRecord> }) {
  const { loading, pagination, listError, accessDenied, layoutView, setViewRow, openEdit, setConfirmId, formatDate, perms } = model;


  if (accessDenied) {
    return <ForbiddenState />;
  }

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl border border-border bg-muted/30" />
        ))}
      </div>
    );
  }

  if (listError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {listError}
      </div>
    );
  }

  return (
    <ListToolsTable tools={tools} keyExtractor={(row) => row.id} onRowClick={(row) => setViewRow(row)}>
    <DirectoryPagedViews
      items={tools.rows}
      serverPagination={tools.pagination(pagination)}
      loading={loading || tools.loading}
      empty={<EmptyState icon={UserCircle} title="لا توجد مستخدمون" description="أضف حسابات مستخدمي النظام." />}
    >
      {(pageItems) => layoutView === 'grid' ? (
        <DirectoryGrid>
          {pageItems.map((row) => (
            <UserGridCard
              key={row.id}
              row={row}
              model={model}
              canUpdate={perms.canUpdate}
              canDelete={perms.canDelete}
              onOpen={() => setViewRow(row)}
              onEdit={() => openEdit(row)}
              onDelete={() => setConfirmId(row.id)}
              isSuperuser={superuserIds.has(row.id)}
            />
          ))}
        </DirectoryGrid>
      ) : (
        <DataTable
          variant="directory"
          className="sys-table-host"
          columns={tools.columns}
          {...tools.tableSort}
          data={pageItems}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => setViewRow(row)}
        />
      )}
    </DirectoryPagedViews>
    </ListToolsTable>
  );
}

function UserGridCard({
  row,
  model,
  canUpdate,
  canDelete,
  onOpen,
  onEdit,
  onDelete,
  isSuperuser,
}: {
  row: UserRecord;
  model: ContactsDirectoryModel;
  canUpdate: boolean;
  canDelete: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isSuperuser: boolean;
}) {
  return (
    <DirectoryGridCard interactive onClick={onOpen}>
      <DirectoryGridCardHeader>
        <DirectoryGridCardTitle>{row.fullNameAr ?? row.email}</DirectoryGridCardTitle>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {isSuperuser ? <SuperuserBadge /> : null}
          <Badge variant="secondary" className="text-[10px]">
            {userTypeLabelAr(row.userType)}
          </Badge>
        </div>
      </DirectoryGridCardHeader>
      <DirectoryGridCardMeta>
        <DirectoryGridCardMetaRow dir="ltr">
          <span className="text-muted-foreground">البريد</span>
          <span className="truncate">{row.email}</span>
        </DirectoryGridCardMetaRow>
        <DirectoryGridCardMetaRow>
          <span className="text-muted-foreground">الشركة</span>
          <span className="truncate">{primaryCompanyLabel(row, model)}</span>
        </DirectoryGridCardMetaRow>
        <DirectoryGridCardMetaRow>
          <span className="text-muted-foreground">الفرع</span>
          <span className="truncate">{primaryBranchLabel(row, model)}</span>
        </DirectoryGridCardMetaRow>
        <DirectoryGridCardMetaRow>
          <span className="text-muted-foreground">الإسناد</span>
          <span>{row.companies.length} شركة · {row.branches.length} فرع</span>
        </DirectoryGridCardMetaRow>
      </DirectoryGridCardMeta>
      <DirectoryGridCardFooter>
        {statusBadge(row)}
        <div className="ms-auto flex gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7" title="عرض" onClick={onOpen}><Eye className="h-4 w-4" /></Button>
          {canUpdate ? (
            <Button variant="ghost" size="icon" className="h-7 w-7" title="تعديل" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
          ) : null}
          {canDelete ? (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="حذف" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
          ) : null}
        </div>
      </DirectoryGridCardFooter>
    </DirectoryGridCard>
  );
}
