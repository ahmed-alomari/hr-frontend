'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  HRSettingsFormDrawer,
  FormField,
  ConfirmationModal,
} from '@/components/ui/shared-dialogs';
import {
  useContactsDirectoryModel,
  USER_STATUS_OPTIONS,
} from '@/features/system/organization/contacts/hooks/useContactsDirectoryModel';
import { ContactsListViews, useContactsListTools } from '@/features/system/organization/contacts/components/contacts-list-views';
import { UserDetailDialog } from '@/features/system/organization/contacts/dialogs/user-detail-dialog';
import { ForbiddenState } from '@/components/shared/forbidden-state';
import { useDefaultCompanyId } from '@/features/hr/organization/lib/default-company-id';
import { useCompanySuperusers } from '@/features/system/organization/contacts/hooks/useCompanySuperusers';
import { userTypeFormOptions, type UserType } from '@/features/system/users/constants/user-type';

export default function ContactsPage() {
  const model = useContactsDirectoryModel();
  const userTypeOptions = React.useMemo(
    () => userTypeFormOptions(model.form.userType),
    [model.form.userType],
  );
  const companyId = useDefaultCompanyId();
  const superusers = useCompanySuperusers(companyId, model.perms.canRead);
  const tools = useContactsListTools(model, superusers.activeIds);

  if (model.accessDenied) {
    return <ForbiddenState />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <ContactsListViews model={model} tools={tools} superuserIds={superusers.activeIds} />

      <HRSettingsFormDrawer
        open={model.drawerOpen}
        onOpenChange={model.setDrawerOpen}
        title={model.editId ? 'تعديل مستخدم' : 'مستخدم جديد'}
        onSave={model.handleSave}
        saveDisabled={model.saving}
        error={model.error}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="البريد الإلكتروني" required span2>
            <Input
              dir="ltr"
              type="email"
              value={model.form.email}
              onChange={(e) => model.patch({ email: e.target.value })}
              placeholder="user@example.com"
            />
          </FormField>

          <FormField label={model.editId ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور'} required={!model.editId} span2>
            <Input
              dir="ltr"
              type="password"
              value={model.form.password}
              onChange={(e) => model.patch({ password: e.target.value })}
              placeholder="••••••••"
            />
          </FormField>

          <FormField label="الاسم">
            <Input
              value={model.form.fullNameAr}
              onChange={(e) => model.patch({ fullNameAr: e.target.value })}
            />
          </FormField>

          <FormField label="رقم الجوال">
            <Input
              dir="ltr"
              value={model.form.phone}
              onChange={(e) => model.patch({ phone: e.target.value })}
              placeholder="+966 …"
            />
          </FormField>

          <FormField label="نوع المستخدم">
            <Select
              value={model.form.userType}
              onValueChange={(v) => model.patch({ userType: v as UserType })}
              disabled={userTypeOptions.length <= 1}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {userTypeOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="الحالة">
            <Select value={model.form.status} onValueChange={(v) => model.patch({ status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {USER_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-border p-4">
            <span className="text-sm">نشط</span>
            <Switch checked={model.form.isActive} onCheckedChange={(v) => model.patch({ isActive: v })} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border p-4">
            <span className="text-sm">موثّق</span>
            <Switch checked={model.form.isVerified} onCheckedChange={(v) => model.patch({ isVerified: v })} />
          </div>
        </div>
      </HRSettingsFormDrawer>

      <ConfirmationModal
        open={!!model.confirmId}
        onOpenChange={(v) => { if (!v) model.setConfirmId(null); }}
        title="حذف المستخدم"
        description="هل أنت متأكد من حذف هذا الحساب؟ لا يمكن التراجع عن هذا الإجراء."
        confirmLabel="حذف"
        variant="destructive"
        onConfirm={model.handleDelete}
      />

      <UserDetailDialog
        user={model.viewRow}
        companies={model.companies}
        branches={model.branches}
        companyId={companyId}
        isCompanySuperuser={!!model.viewRow && superusers.activeIds.has(model.viewRow.id)}
        canMakeSuperuser={model.perms.canUpdate}
        makingSuperuser={!!model.viewRow && superusers.pendingUserId === model.viewRow.id}
        onMakeSuperuser={superusers.makeSuperuser}
        onRevokeSuperuser={superusers.revokeSuperuser}
        onOpenChange={(open) => { if (!open) model.setViewRow(null); }}
        onEdit={model.openEdit}
        onUserUpdated={model.patchUserInList}
      />
    </div>
  );
}
