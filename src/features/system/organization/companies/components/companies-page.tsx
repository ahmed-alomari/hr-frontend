'use client';

import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  HRSettingsFormDrawer,
  FormField,
  ConfirmationModal,
  EmptyState,
} from '@/components/ui/shared-dialogs';
import { ForbiddenState } from '@/components/shared/forbidden-state';
import { useCompaniesDirectoryModel } from '@/features/system/organization/companies/hooks/useCompaniesDirectoryModel';
import { CompaniesListViews, useCompaniesListTools } from '@/features/system/organization/companies/components/companies-list-views';
import { CompanyDetailDialog } from '@/features/system/organization/companies/dialogs/company-detail-dialog';

export default function CompaniesPage() {
  const model = useCompaniesDirectoryModel();
  const tools = useCompaniesListTools(model);

  if (model.accessDenied) {
    return <ForbiddenState />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {model.loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">جاري التحميل…</div>
      ) : model.listError ? (
        <EmptyState title="تعذر تحميل الشركات" description={model.listError} />
      ) : (
        <CompaniesListViews model={model} tools={tools} />
      )}

      <HRSettingsFormDrawer
        open={model.drawerOpen}
        onOpenChange={model.setDrawerOpen}
        title={model.editId ? 'تعديل الشركة' : 'شركة جديدة'}
        onSave={model.handleSave}
        saveDisabled={model.saving}
        error={model.error}
      >
        <FormField label="اسم الشركة" required>
          <Input value={model.form.nameAr} onChange={(e) => model.patch({ nameAr: e.target.value })} />
        </FormField>
        <FormField label="الرمز">
          <Input dir="ltr" value={model.form.code} onChange={(e) => model.patch({ code: e.target.value })} placeholder="يُولَّد تلقائياً من الاسم إن تُرك فارغاً" />
        </FormField>
        <FormField label="السجل التجاري">
          <Input dir="ltr" value={model.form.commercialRegistrationNo} onChange={(e) => model.patch({ commercialRegistrationNo: e.target.value })} />
        </FormField>
        <FormField label="الرقم الضريبي">
          <Input dir="ltr" value={model.form.taxNumber} onChange={(e) => model.patch({ taxNumber: e.target.value })} />
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
        onOpenChange={(v) => { if (!v) model.setConfirmId(null); }}
        title="حذف الشركة"
        description="سيتم حذف الشركة وجميع الفروع والأقسام المرتبطة. هل أنت متأكد؟"
        confirmLabel="حذف"
        variant="destructive"
        onConfirm={model.handleDelete}
      />

      <CompanyDetailDialog
        row={model.viewRow}
        formatDate={model.formatDate}
        onOpenChange={(open) => { if (!open) model.setViewRow(null); }}
        onEdit={model.openEdit}
      />
    </div>
  );
}
