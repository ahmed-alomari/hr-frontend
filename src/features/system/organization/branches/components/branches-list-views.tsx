'use client';

import { Plus } from 'lucide-react';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { Can } from '@/components/shared/can';
import { ListToolsTable, useListTools, type ListToolsModel } from '@/components/ui/list-tools';
import * as React from 'react';
import { Building2, Eye, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { TableRowActions } from '@/components/ui/table-cells';
import { DirectoryGrid, DirectoryGridCard, DirectoryGridCardFooter, DirectoryGridCardHeader, DirectoryGridCardMeta, DirectoryGridCardMetaRow, DirectoryGridCardTitle } from '@/components/ui/directory-grid-card';
import { EmptyState } from '@/components/ui/shared-dialogs';
import { DirectoryPagedViews } from '@/components/ui/paged-list';
import type { BranchesDirectoryModel } from '@/features/system/organization/branches/hooks/useBranchesDirectoryModel';
import type { BranchRow } from '@/features/system/organization/branches/constants/branches-directory';

function statusBadge(active: boolean) {
  return active ? (
    <Badge variant="outline" className="text-[10px] border-success/40 text-success dark:text-success">نشط</Badge>
  ) : (
    <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">غير نشط</Badge>
  );
}

/** Columns, sort, grouping, export and the page header: stays mounted while the list loads. */
export function useBranchesListTools(model: BranchesDirectoryModel) {
  const { filtered, pagination, setViewBranch, openEdit, setConfirmId, companyLabel, perms, openCreate, archiveScopeLabel } = model;

  const columns = React.useMemo((): ColumnDef<BranchRow>[] => [
    {
      key: 'company',
      title: 'الشركة',
      hideOnMobile: true,
      className: 'text-muted-foreground',
      render: (b) => companyLabel(b.companyId),
    },
    {
      key: 'name',
      title: 'الفرع',
      render: (b) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{b.name}</span>
          {b.code ? <span className="text-[10px] text-muted-foreground" dir="ltr">{b.code}</span> : null}
        </div>
      ),
    },
    {
      key: 'city',
      title: 'المدينة',
      className: 'text-muted-foreground',
      render: (b) => b.city || '—',
    },
    {
      key: 'manager',
      title: 'المدير',
      hideOnMobile: true,
      className: 'text-muted-foreground',
      render: (b) => b.manager || '—',
    },
    {
      key: 'phone',
      title: 'الهاتف',
      hideOnMobile: true,
      className: 'text-muted-foreground',
      render: (b) => <span dir="ltr">{b.phone ?? b.mobile ?? '—'}</span>,
    },
    {
      key: 'flags',
      title: 'الحالة',
      render: (b) => (
        <div className="flex flex-wrap gap-1">
          {statusBadge(b.isActive)}
          {b.isHeadquarters ? (
            <Badge variant="secondary" className="text-[10px]">المقر الرئيسي</Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: 'actions',
      title: 'إجراءات',
      isActions: true,
      headerClassName: 'text-start w-16',
      render: (b) => (
        <TableRowActions
          menuItems={[
            ...(perms.canUpdate
              ? [{ label: 'تعديل', onClick: (e: React.MouseEvent) => { e.stopPropagation(); openEdit(b); } }]
              : []),
            ...(perms.canDelete
              ? [{
                  label: 'حذف',
                  onClick: (e: React.MouseEvent) => { e.stopPropagation(); setConfirmId(b.id); },
                  destructive: true,
                  separator: true,
                }]
              : []),
          ]}
        />
      ),
    },
  ], [companyLabel, openEdit, perms.canDelete, perms.canUpdate, setConfirmId]);

  const flagsOf = (b: BranchRow) =>
    [b.isActive ? 'نشط' : 'غير نشط', b.isHeadquarters ? 'المقر الرئيسي' : null].filter(Boolean).join(' — ');
  const tools = useListTools<BranchRow>({
    section: 'organization',
    page: 'branches',
    columns,
    rows: filtered,
    fetchAll: pagination.loadAll,
    resetKey: pagination.resetKey,
    fields: {
      company: { text: (b) => companyLabel(b.companyId), group: (b) => companyLabel(b.companyId) },
      name: { kind: 'name', text: (b) => b.name, alsoExport: [{ label: 'الرمز', text: (b) => b.code || '—' }] },
      city: { text: (b) => b.city || '—', group: (b) => b.city || null },
      manager: { kind: 'name', text: (b) => b.manager || '—', group: (b) => b.manager || null },
      phone: { kind: 'code', text: (b) => b.phone ?? b.mobile ?? '—', sortable: false },
      flags: { kind: 'status', text: flagsOf, group: flagsOf },
    },
  });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton />
        {tools.buttons}
        {tools.exportMenu('سجل الفروع', 'branches', [`العرض: ${archiveScopeLabel}`])}
        <Can when={perms.canCreate}>
          <Button variant="luxe" size="sm" className="h-8 gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" /> فرع جديد
          </Button>
        </Can>
      </div>
    ),
    [openCreate, perms.canCreate, archiveScopeLabel, tools.depsKey],
  );

  return tools;
}

export function BranchesListViews({ model, tools }: { model: BranchesDirectoryModel; tools: ListToolsModel<BranchRow> }) {
  const { layoutView, pagination, loading, setViewBranch, openEdit, setConfirmId, companyLabel, perms } = model;


  return (
    <ListToolsTable tools={tools} keyExtractor={(b) => b.id} onRowClick={(b) => setViewBranch(b)}>
    <DirectoryPagedViews
      items={tools.rows}
      serverPagination={tools.pagination(pagination)}
      loading={loading || tools.loading}
      empty={<EmptyState icon={Building2} title="لا توجد فروع" description="لا توجد فروع في القائمة." />}
    >
      {(pageItems) => layoutView === 'grid' ? (
        <DirectoryGrid>
          {pageItems.map((b) => (
            <DirectoryGridCard key={b.id} interactive onClick={() => setViewBranch(b)}>
              <DirectoryGridCardHeader>
                <DirectoryGridCardTitle>{b.name}</DirectoryGridCardTitle>
                {b.isHeadquarters ? (
                  <Badge variant="secondary" className="shrink-0 text-[10px]">المقر</Badge>
                ) : null}
              </DirectoryGridCardHeader>
              <DirectoryGridCardMeta>
                <DirectoryGridCardMetaRow>
                  <span className="text-muted-foreground">الشركة</span>
                  <span className="truncate font-medium">{companyLabel(b.companyId)}</span>
                </DirectoryGridCardMetaRow>
                <DirectoryGridCardMetaRow>
                  <span className="text-muted-foreground">المدينة</span>
                  <span className="truncate font-medium">{b.city || '—'}</span>
                </DirectoryGridCardMetaRow>
                {b.manager ? (
                  <DirectoryGridCardMetaRow>
                    <span className="text-muted-foreground">المدير</span>
                    <span className="truncate">{b.manager}</span>
                  </DirectoryGridCardMetaRow>
                ) : null}
                {(b.phone ?? b.email) ? (
                  <DirectoryGridCardMetaRow dir="ltr">
                    <span className="text-muted-foreground">تواصل</span>
                    <span className="truncate">{b.phone ?? b.email}</span>
                  </DirectoryGridCardMetaRow>
                ) : null}
              </DirectoryGridCardMeta>
              <DirectoryGridCardFooter>
                {statusBadge(b.isActive)}
                <div className="ms-auto flex gap-0.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="عرض" onClick={() => setViewBranch(b)}><Eye className="h-4 w-4" /></Button>
                  {perms.canUpdate ? (
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="تعديل" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                  ) : null}
                  {perms.canDelete ? (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="حذف" onClick={() => setConfirmId(b.id)}><Trash2 className="h-4 w-4" /></Button>
                  ) : null}
                </div>
              </DirectoryGridCardFooter>
            </DirectoryGridCard>
          ))}
        </DirectoryGrid>
      ) : (
        <DataTable
          variant="directory"
          className="sys-table-host"
          columns={tools.columns}
          {...tools.tableSort}
          data={pageItems}
          keyExtractor={(b) => b.id}
          onRowClick={(b) => setViewBranch(b)}
        />
      )}
    </DirectoryPagedViews>
    </ListToolsTable>
  );
}
