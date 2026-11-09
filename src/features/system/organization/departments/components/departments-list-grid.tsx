'use client';

import type { ColumnDef } from '@/components/ui/data-table';
import type { DepartmentsDirectoryModel } from '@/features/system/organization/departments/hooks/useDepartmentsDirectoryModel';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { Can } from '@/components/shared/can';
import { useListTools } from '@/components/ui/list-tools';
import * as React from 'react';
import { Pencil, Plus, Trash2, Building2, Network } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ActiveBadge } from '@/components/ui/shared-dialogs';
import type { HRDepartmentEntity } from '@/features/hr/requests/lib/types';
import { DirectoryGrid, DirectoryGridCard, DirectoryGridCardDecoration, DirectoryGridCardEyebrow, DirectoryGridCardFooter, DirectoryGridCardHeading, DirectoryGridCardIconWrap, DirectoryGridCardMetaChips } from '@/components/ui/directory-grid-card';
import type { DepartmentRecord } from '@/features/system/organization/departments/constants/departments-directory';

type FlatNode = { dept: HRDepartmentEntity; depth: number };

type DepartmentsListGridProps = {
  departments: DepartmentRecord[];
  filtered: FlatNode[];
  branchLabel?: (branchId: string) => string | undefined;
  companyLabel?: (companyId: string) => string;
  canUpdate?: boolean;
  canDelete?: boolean;
  onEdit: (dept: HRDepartmentEntity) => void;
  onDelete: (id: string) => void;
};

/** Columns, sort, grouping, export and the page header. */
export function useDepartmentsListTools(model: DepartmentsDirectoryModel) {
  const { departments, filtered, pagination, companyLabel, branchLabel, perms, openCreate, openEdit, confirmDelete, exportSubtitleLines } = model;
  type Row = (typeof filtered)[number];
  const recordOf = (n: Row) => n.dept as DepartmentRecord;
  const parentOf = (n: Row) => departments.find((d) => d.id === n.dept.parentId)?.nameAr ?? '—';
  const branchOf = (n: Row) => branchLabel(recordOf(n).branchId) ?? '—';
  const companyOf = (n: Row) => companyLabel(recordOf(n).companyId);
  const subCount = (n: Row) => departments.filter((d) => d.parentId === n.dept.id).length;
  const managerOf = (n: Row) => {
    const id = recordOf(n).managerEmployeeId;
    return id ? `${id.slice(0, 8)}…` : '—';
  };
  const statusOf = (n: Row) => (n.dept.isActive ? 'نشط' : 'غير نشط');
  const columns: ColumnDef<Row>[] = [
    { key: 'name', title: 'القسم', render: (n) => n.dept.nameAr },
    { key: 'parent', title: 'القسم الأب', render: parentOf },
    { key: 'company', title: 'الشركة', render: companyOf },
    { key: 'branch', title: 'الفرع', render: branchOf },
    { key: 'manager', title: 'المدير', render: managerOf },
    { key: 'children', title: 'الأقسام الفرعية', render: (n) => String(subCount(n)) },
    { key: 'description', title: 'الوصف', render: (n) => recordOf(n).description?.trim() || '—' },
    { key: 'status', title: 'الحالة', render: (n) => <ActiveBadge active={n.dept.isActive} /> },
    {
      key: 'actions',
      title: '',
      isActions: true,
      render: (n) => (
        <div className="flex items-center gap-1">
          {perms.canUpdate ? (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEdit(n.dept); }} aria-label="تعديل">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          {perms.canDelete ? (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); confirmDelete(n.dept.id); }} aria-label="حذف">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];
  const tools = useListTools<Row>({
    section: 'organization',
    page: 'departments',
    columns,
    rows: filtered,
    fetchAll: pagination.loadAll,
    resetKey: pagination.resetKey,
    fields: {
      name: { kind: 'name', text: (n) => n.dept.nameAr },
      parent: { text: parentOf, group: parentOf },
      company: { text: companyOf, group: companyOf },
      branch: { text: branchOf, group: branchOf },
      manager: { kind: 'code', text: managerOf, sortable: false },
      children: { text: (n) => String(subCount(n)), sort: subCount },
      description: { text: (n) => recordOf(n).description?.trim() || '—', sortable: false },
      status: { kind: 'status', text: statusOf, group: statusOf },
    },
  });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton />
        {tools.buttons}
        {tools.exportMenu('سجل الأقسام', 'departments', exportSubtitleLines)}
        <Can when={perms.canCreate}>
          <Button variant="luxe" size="sm" className="h-8 shrink-0 gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" /> قسم جديد
          </Button>
        </Can>
      </div>
    ),
    [openCreate, perms.canCreate, exportSubtitleLines, tools.depsKey],
  );

  return tools;
}

export function DepartmentsListGrid({
  departments,
  filtered,
  branchLabel,
  companyLabel,
  canUpdate = false,
  canDelete = false,
  onEdit,
  onDelete,
}: DepartmentsListGridProps) {
  return (
    <DirectoryGrid variant="wide">
      {filtered.map(({ dept, depth }) => {
        const record = dept as DepartmentRecord;
        const parent = departments.find((d) => d.id === dept.parentId);
        const subDepts = departments.filter((d) => d.parentId === dept.id);
        const branchName = branchLabel?.(record.branchId);
        return (
          <DirectoryGridCard
            key={dept.id}
            interactive={canUpdate}
            hoverLift={canUpdate}
            onClick={canUpdate ? () => onEdit(dept) : undefined}
            className="p-3.5 space-y-1.5"
          >
            <DirectoryGridCardDecoration />
            <div className="relative mb-2 flex items-start justify-between">
              <DirectoryGridCardIconWrap active={dept.isActive} className="h-7 w-7">
                <Building2 className="h-4 w-4" />
              </DirectoryGridCardIconWrap>
              <ActiveBadge active={dept.isActive} />
            </div>

            <div className="relative mb-2">
              {parent && (
                <DirectoryGridCardEyebrow>
                  <Building2 className="h-3 w-3 shrink-0" />
                  <span className="truncate">{parent.nameAr}</span>
                </DirectoryGridCardEyebrow>
              )}
              <DirectoryGridCardHeading className="text-sm">{dept.nameAr}</DirectoryGridCardHeading>
            </div>

            {record.description ? (
              <p className="relative mb-1   text-xs text-muted-foreground">{record.description}</p>
            ) : null}

            <DirectoryGridCardMetaChips className="pt-0.5 pb-1 gap-2">
              {companyLabel ? (
                <Badge variant="secondary" className="text-[10px] font-normal">{companyLabel(record.companyId)}</Badge>
              ) : null}
              {branchName ? (
                <Badge variant="outline" className="text-[10px] font-normal">{branchName}</Badge>
              ) : null}
              {record.managerEmployeeId ? (
                <span className="text-[10px] text-muted-foreground" dir="ltr">
                  مدير: {record.managerEmployeeId.slice(0, 8)}…
                </span>
              ) : null}
              {subDepts.length > 0 && (
                <span className="flex items-center gap-1">
                  <Network className="h-3.5 w-3.5" />
                  {subDepts.length} فرعي
                </span>
              )}
           
            </DirectoryGridCardMetaChips>

            <DirectoryGridCardFooter className="border-border/60 pt-1">
              {canUpdate ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(dept);
                  }}
                  aria-label="تعديل"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(dept.id);
                  }}
                  aria-label="حذف"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </DirectoryGridCardFooter>
          </DirectoryGridCard>
        );
      })}
    </DirectoryGrid>
  );
}
