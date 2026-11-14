'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { HRSettingsFormDrawer, FormField, ConfirmationModal, EmptyState } from '@/components/ui/shared-dialogs';
import { ForbiddenState } from '@/components/shared/forbidden-state';
import { useJobTitlesDirectoryModel } from '@/features/system/organization/job-titles/hooks/useJobTitlesDirectoryModel';
import { JobTitlesListViews, useJobTitlesListTools } from '@/features/system/organization/job-titles/components/job-titles-list-views';
import { JobTitleTemplateDetailDialog } from '@/features/system/organization/job-titles/dialogs/job-title-template-detail-dialog';

export default function JobTitlesPage() {
  const model = useJobTitlesDirectoryModel();
  const tools = useJobTitlesListTools(model);

  if (model.accessDenied) {
    return <ForbiddenState />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {model.loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">جاري التحميل…</div>
      ) : model.listError ? (
        <EmptyState title="تعذر تحميل المسميات" description={model.listError} />
      ) : (
        <JobTitlesListViews model={model} tools={tools} />
      )}

      <HRSettingsFormDrawer
        open={model.drawerOpen}
        onOpenChange={model.setDrawerOpen}
        title={model.editId ? 'تعديل القالب' : 'قالب مسمى جديد'}
        onSave={model.handleSave}
        error={model.error}
      >
        <FormField label="المسمى الوظيفي" required>
          <Input
            value={model.form.titleAr}
            onChange={(e) => model.patch({ titleAr: e.target.value })}
            placeholder="مثال: مدير مبيعات إقليمي"
          />
        </FormField>
        <FormField label="وصف">
          <Textarea
            value={model.form.descriptionAr}
            onChange={(e) => model.patch({ descriptionAr: e.target.value })}
            rows={3}
          />
        </FormField>
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
        title="حذف القالب"
        description="لن يؤثر ذلك على الموظفين الحاليين — فقط على القائمة عند إنشاء موظف جديد."
        confirmLabel="حذف"
        variant="destructive"
        onConfirm={model.handleDelete}
      />

      <JobTitleTemplateDetailDialog
        row={model.viewRow}
        onOpenChange={(open) => {
          if (!open) model.setViewRow(null);
        }}
        onEdit={model.openEdit}
      />
    </div>
  );
}
