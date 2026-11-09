'use client';

import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  HRSettingsFormDrawer,
  FormField,
  ConfirmationModal,
  EmptyState,
  SearchableDropdown,
} from '@/components/ui/shared-dialogs';
import { ForbiddenState } from '@/components/shared/forbidden-state';
import { useBranchesDirectoryModel } from '@/features/system/organization/branches/hooks/useBranchesDirectoryModel';
import { BranchesListViews, useBranchesListTools } from '@/features/system/organization/branches/components/branches-list-views';
import { BranchDetailDialog } from '@/features/system/organization/branches/dialogs/branch-detail-dialog';

export default function BranchesPage() {
  const model = useBranchesDirectoryModel();
  const tools = useBranchesListTools(model);

  if (model.accessDenied) {
    return <ForbiddenState />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {model.loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">جاري التحميل…</div>
      ) : model.listError ? (
        <EmptyState title="تعذر تحميل الفروع" description={model.listError} />
      ) : (
        <BranchesListViews model={model} tools={tools} />
      )}

      <HRSettingsFormDrawer
        open={model.drawerOpen}
        onOpenChange={model.setDrawerOpen}
        title={model.editId ? 'تعديل الفرع' : 'فرع جديد'}
        onSave={model.handleSave}
        error={model.error}
      >
        <FormField label="اسم الفرع" required>
          <Input value={model.form.name} onChange={(e) => model.patch({ name: e.target.value })} placeholder="مثال: فرع الرياض" />
        </FormField>
        <FormField label="المدينة" required>
          <Input value={model.form.city} onChange={(e) => model.patch({ city: e.target.value })} placeholder="الرياض" />
        </FormField>
        <FormField label="مدير الفرع">
          <SearchableDropdown
            value={model.form.managerEmployeeId}
            onChange={model.setManagerEmployee}
            options={model.employeeOptions}
            placeholder={model.employeesLoading ? 'جاري تحميل الموظفين…' : 'اختر مدير الفرع…'}
            disabled={model.employeesLoading}
            allowClear
          />
        </FormField>
        <div className="flex items-center justify-between rounded-xl border border-border p-4">
          <span className="text-sm">المقر الرئيسي</span>
          <Switch checked={model.form.isHeadquarters} onCheckedChange={(v) => model.patch({ isHeadquarters: v })} />
        </div>
        {model.editId && (
          <div className="flex items-center justify-between rounded-xl border border-border p-4">
            <span className="text-sm">نشط</span>
            <Switch checked={model.form.isActive} onCheckedChange={(v) => model.patch({ isActive: v })} />
          </div>
        )}
      </HRSettingsFormDrawer>

      <ConfirmationModal
        open={!!model.confirmId}
        onOpenChange={(v) => {
          if (!v) model.setConfirmId(null);
        }}
        title="حذف الفرع"
        description="هل أنت متأكد من حذف هذا الفرع؟"
        confirmLabel="حذف"
        variant="destructive"
        onConfirm={model.handleDelete}
      />

      <BranchDetailDialog
        branch={model.viewBranch}
        onOpenChange={(open) => {
          if (!open) model.setViewBranch(null);
        }}
        onEdit={model.openEdit}
      />
    </div>
  );
}
