'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Archive, Briefcase, MapPin, Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldGroup } from '@/features/hr/organization/employees/components/EmployeeProfilePrimitives';
import type { EmployeeProfileModel } from '@/features/hr/organization/employees/hooks/useEmployeeProfileModel';
import { EmployeeAssignmentList } from '@/features/hr/organization/employees/components/sections/employee-assignment-list';
import { EmployeePrimaryAssignmentCard } from '@/features/hr/organization/employees/components/sections/employee-primary-assignment-card';
import { employeesApi } from '@/features/hr/organization/employees/lib/api/employees';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';

/** Work city — printed in the employment contract ({{city}}); the branch name stands in when empty. */
function EmployeeWorkCity({ model }: { model: EmployeeProfileModel }) {
  const { employee, onEmployeeUpdated, setDraft } = model;
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(employee.city ?? '');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setValue(employee.city ?? '');
    setEditing(false);
  }, [employee.id, employee.city]);

  const save = async () => {
    setSaving(true);
    try {
      const city = value.trim();
      await employeesApi.update(employee.id, { city: city || null });
      // The personal tab's draft spreads over the employee on its save — keep it current.
      setDraft((prev) => ({ ...prev, city }));
      onEmployeeUpdated?.({ ...employee, city });
      toast.success('تم حفظ مدينة العمل');
      setEditing(false);
    } catch (e) {
      toast.error(handleApiError(e, 'employee.update').displayMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FieldGroup title="مدينة العمل">
      <div className="col-span-full flex flex-col gap-2 sm:flex-row sm:items-center">
        {editing ? (
          <>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="مثال: الرياض"
              maxLength={100}
              className="h-9 sm:max-w-xs"
              autoFocus
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" className="h-9" onClick={save} disabled={saving}>
                حفظ
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9"
                disabled={saving}
                onClick={() => {
                  setValue(employee.city ?? '');
                  setEditing(false);
                }}
              >
                إلغاء
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              {employee.city?.trim() ? (
                <span className="font-medium text-foreground">{employee.city}</span>
              ) : (
                <span className="text-muted-foreground">
                  غير محددة — يُطبع اسم الفرع مكانها في عقد العمل
                </span>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 shrink-0 gap-1.5"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
              تعديل
            </Button>
          </>
        )}
      </div>
    </FieldGroup>
  );
}

export function EmployeeEmploymentSection({ model }: { model: EmployeeProfileModel }) {
  const {
    hrAssignments,
    primaryAssignment,
    assignmentsLoading,
    assignmentsError,
    setAssignmentDialogOpen,
    setEditAssignment,
    setDeleteAssignmentTarget,
  } = model;

  const activeCount = hrAssignments.filter((a) => !a.isArchived).length;
  const archivedCount = hrAssignments.filter((a) => a.isArchived).length;
  const showArchivedBlock = !assignmentsLoading && archivedCount > 0;

  return (
    <section>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-arabic-display text-lg font-semibold tracking-tight text-foreground">
            <Briefcase className="h-5 w-5 shrink-0 text-primary" />
            بيانات التوظيف
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            الإسناد التنظيمي (شركة · فرع · قسم · مسمى) وسجل التعيينات
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-9 shrink-0 gap-2 shadow-sm"
          onClick={() => setAssignmentDialogOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          إضافة إسناد
        </Button>
      </div>

      <EmployeePrimaryAssignmentCard
        assignment={primaryAssignment}
        loading={assignmentsLoading}
      />

      <EmployeeWorkCity model={model} />

      <FieldGroup title="الإسنادات الفعّالة" hint={`${activeCount} سجل`}>
        <EmployeeAssignmentList
          mode="active"
          assignments={hrAssignments}
          loading={assignmentsLoading}
          error={assignmentsError}
          onEdit={(row) => setEditAssignment(row)}
          onDelete={(row) => setDeleteAssignmentTarget(row)}
        />
      </FieldGroup>

      {showArchivedBlock ? (
        <FieldGroup title="الإسنادات المؤرشفة" hint={`${archivedCount} سجل`}>
          <div className="col-span-full mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Archive className="h-3.5 w-3.5 shrink-0" />
            سجلات سابقة منتهية أو مؤرشفة — للعرض فقط دون تعديل.
          </div>
          <EmployeeAssignmentList
            mode="archived"
            assignments={hrAssignments}
            loading={false}
            error={null}
            onDelete={(row) => setDeleteAssignmentTarget(row)}
          />
        </FieldGroup>
      ) : null}
    </section>
  );
}
