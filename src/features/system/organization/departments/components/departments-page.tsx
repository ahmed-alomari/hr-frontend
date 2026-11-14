'use client';

import { ListToolsTable } from '@/components/ui/list-tools';
import { Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  MinimalDropdown,
  ConfirmationModal,
  HRSettingsFormDrawer,
  FormField,
  EmptyState,
} from '@/components/ui/shared-dialogs';
import { cn } from '@/shared/utils';
import { ForbiddenState } from '@/components/shared/forbidden-state';
import { useDepartmentsDirectoryModel } from '@/features/system/organization/departments/hooks/useDepartmentsDirectoryModel';
import { DepartmentsListGrid, useDepartmentsListTools } from '@/features/system/organization/departments/components/departments-list-grid';
import { DirectoryPagedViews } from '@/components/ui/paged-list';

export default function DepartmentsPage() {
  const model = useDepartmentsDirectoryModel();
  const tools = useDepartmentsListTools(model);

  if (model.accessDenied) {
    return <ForbiddenState />;
  }

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4 pt-2">
      {model.loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">جاري التحميل…</div>
      ) : model.listError ? (
        <EmptyState icon={Building2} title="تعذر تحميل الأقسام" description={model.listError} />
      ) : model.filtered.length === 0 ? (
        <EmptyState icon={Building2} title="لا توجد أقسام" />
      ) : (
        <ListToolsTable tools={tools} keyExtractor={(n) => n.dept.id} onRowClick={model.perms.canUpdate ? (n) => model.openEdit(n.dept) : undefined}>
        <DirectoryPagedViews
          items={tools.rows}
          serverPagination={tools.pagination(model.pagination)}
          loading={model.loading || tools.loading}
        >
          {(pageItems) => (
        <DepartmentsListGrid
          departments={model.departments}
          filtered={pageItems}
          branchLabel={model.branchLabel}
          companyLabel={model.companyLabel}
          canUpdate={model.perms.canUpdate}
          canDelete={model.perms.canDelete}
          onEdit={model.openEdit}
          onDelete={model.confirmDelete}
        />
          )}
        </DirectoryPagedViews>
        </ListToolsTable>
      )}

      <HRSettingsFormDrawer
        open={model.drawerOpen}
        onOpenChange={model.setDrawerOpen}
        title={model.editId ? 'تعديل القسم' : 'إضافة قسم جديد'}
        onSave={model.handleSave}
        error={model.formError}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="الاسم" required span2>
            <Input
              value={model.draft.nameAr}
              onChange={(e) => model.patch('nameAr', e.target.value)}
              placeholder="الموارد البشرية"
            />
          </FormField>
          <FormField label="الفرع" required span2>
            {model.editId ? (
              <Input readOnly value={model.branchLabel(model.draft.branchId) ?? '—'} className="bg-muted/30" />
            ) : (
              <Select
                value={model.draft.branchId || '_none'}
                onValueChange={(v) => model.patch('branchId', v === '_none' ? '' : v)}
              >
                <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— اختر الفرع —</SelectItem>
                  {model.formBranches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.nameAr}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
         
          <FormField label="القسم الأصل" span2>
            <MinimalDropdown
              value={model.draft.parentId}
              onChange={(v) => model.patch('parentId', v)}
              options={model.parentOptions}
              placeholder={model.parentPickerLoading ? 'جاري تحميل الأقسام…' : 'اختر القسم الأصل'}
              disabled={model.parentPickerLoading}
            />
          </FormField>
          {model.editId && (
            <FormField label="الحالة">
              <label
                className={cn(
                  'flex cursor-pointer items-center justify-between rounded-xl border-2 px-4 py-3 transition-all h-10',
                  model.draft.isActive ? 'border-primary/30 bg-primary/5' : 'border-border',
                )}
              >
                <span className="text-sm font-medium">نشط</span>
                <Switch checked={model.draft.isActive} onCheckedChange={(v) => model.patch('isActive', v)} />
              </label>
            </FormField>
          )}
        </div>
      </HRSettingsFormDrawer>

      <ConfirmationModal
        open={!!model.deleteId}
        onOpenChange={(v) => !v && model.setDeleteId(null)}
        title="حذف القسم"
        description={model.deleteWarning}
        onConfirm={model.handleDelete}
      />
    </div>
  );
}
