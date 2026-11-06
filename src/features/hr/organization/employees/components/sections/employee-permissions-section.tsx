'use client';

import * as React from 'react';
import Link from 'next/link';
import { Check, Plus, Shield, UserPlus, X } from 'lucide-react';
import { CreateUserAttentionButton } from '@/features/hr/organization/employees/components/create-user-attention-button';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select';
import { systemPermissionsHref } from '@/features/system/permissions/constants/routes';
import { RolesAssignmentEditor } from '@/components/shared/permissions/roles-assignment-editor';
import { RolePermissionsBrowser } from '@/components/shared/permissions/role-permissions-browser';
import { permissionLabel } from '@/components/shared/permissions/permission-labels';
import type { EmployeeProfileModel } from '@/features/hr/organization/employees/hooks/useEmployeeProfileModel';
import { cn } from '@/shared/utils';

function SummaryPill({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning';
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/80 px-3 py-2.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-sm font-semibold tabular-nums',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-amber-600 dark:text-amber-400',
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function EmployeePermissionsSection({ model }: { model: EmployeeProfileModel }) {
  const {
    hasLinkedUser,
    assignedRoles,
    rolePermissions,
    overlayMap,
    extraAllowPermissions,
    allPermissions,
    allActionPermissions,
    rolesPermissionsLoading,
    handleToggleDeny,
    handleGrantExtra,
    handleRemoveOverlay,
    isMutating,
    setCreateUserOpen,
  } = model;

  const rolesEditorModel = {
    allRoles: model.allRoles,
    assignedRoles: model.assignedRoles,
    assignedRoleIds: model.assignedRoleIds,
    rolesAssignLoading: model.rolesAssignLoading,
    isSyncingRoles: model.isSyncingRoles,
    handleAssignedRolesChange: model.handleAssignedRolesChange,
    hasLinkedUser,
    rolePermissions,
    extraAllowPermissions,
    overlayMap,
  };

  const deniedCount = React.useMemo(
    () => [...overlayMap.values()].filter((o) => o.effect === 'DENY').length,
    [overlayMap],
  );

  const grantablePermissions = React.useMemo(() => {
    const inRole = new Set(rolePermissions.map((p) => p.id));
    const alreadyAllowed = new Set(extraAllowPermissions.map((p) => p.id));
    return allActionPermissions.filter((p) => !inRole.has(p.id) && !alreadyAllowed.has(p.id));
  }, [allActionPermissions, rolePermissions, extraAllowPermissions]);

  const extraPermissionOptions = React.useMemo((): MultiSelectOption[] => {
    const merged = [...extraAllowPermissions, ...grantablePermissions];
    const seen = new Set<string>();
    return merged
      .filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      })
      .map((p) => ({
        value: p.id,
        label: permissionLabel(p),
        subtitle: p.code,
      }));
  }, [extraAllowPermissions, grantablePermissions]);

  const extraPermissionIds = React.useMemo(
    () => extraAllowPermissions.map((p) => p.id),
    [extraAllowPermissions],
  );

  const handleExtraPermissionsChange = React.useCallback(
    (nextIds: string[]) => {
      const current = new Set(extraPermissionIds);
      const next = new Set(nextIds);

      for (const id of nextIds) {
        if (!current.has(id)) handleGrantExtra(id);
      }
      for (const id of extraPermissionIds) {
        if (!next.has(id)) {
          const overlay = overlayMap.get(id);
          if (overlay) handleRemoveOverlay(overlay.overlayId);
        }
      }
    },
    [extraPermissionIds, overlayMap, handleGrantExtra, handleRemoveOverlay],
  );

  return (
    <section className="space-y-4">
      {/* ── Roles & overview ── */}
      <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/5 via-card to-card p-4 shadow-soft sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Shield className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 text-right">
            <h2 className="text-base font-semibold sm:text-lg">صلاحيات الموظف</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              عيّن دوراً أو أكثر ثم خصّص الصلاحيات — يمكن حجب صلاحيات الأدوار أو منح صلاحيات إضافية.{' '}
              <Link href={systemPermissionsHref()} className="font-medium text-primary hover:underline">
                إدارة الأدوار
              </Link>
            </p>
          </div>
        </div>

        {!hasLinkedUser ? (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-amber-300/50 bg-amber-50 p-3 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="flex items-start gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
              <UserPlus className="mt-0.5 h-4 w-4 shrink-0" />
              <span>هذا الموظف غير مرتبط بحساب مستخدم — أنشئ له حساباً لتفعيل الصلاحيات</span>
            </div>
            <CreateUserAttentionButton className="w-full shrink-0 sm:w-auto" onClick={() => setCreateUserOpen(true)} />
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryPill
            label="الأدوار"
            value={assignedRoles.length > 0 ? String(assignedRoles.length) : '—'}
          />
          <SummaryPill
            label="صلاحيات الأدوار"
            value={rolePermissions.length > 0 ? String(rolePermissions.length) : '—'}
          />
          <SummaryPill
            label="صلاحيات إضافية"
            value={String(extraAllowPermissions.length)}
            tone={extraAllowPermissions.length > 0 ? 'success' : 'default'}
          />
          <SummaryPill
            label="محجوبة"
            value={String(deniedCount)}
            tone={deniedCount > 0 ? 'warning' : 'default'}
          />
        </div>

        <div className="mt-4">
          <RolesAssignmentEditor
            model={rolesEditorModel}
            rolesSelectId="employee-roles-multiselect"
            disabled={!hasLinkedUser}
            compact
            hideSummary
          />
        </div>
      </div>

      {/* ── Permissions detail ── */}
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Shield className="h-4 w-4 text-primary" />
              صلاحيات الأدوار
              {rolePermissions.length > 0 ? (
                <Badge variant="subtle" className="text-[10px]">
                  {rolePermissions.length}
                </Badge>
              ) : null}
            </h3>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            ابحث بالاسم العربي أو الرمز، ثم اضغط «حجب» لإزالة صلاحية من هذا الموظف دون تغيير الأدوار.
          </p>

          <RolePermissionsBrowser
            permissions={rolePermissions}
            catalog={allPermissions}
            overlayMap={overlayMap}
            disabled={!hasLinkedUser || isMutating}
            onToggleDeny={handleToggleDeny}
            emptyMessage={
              !hasLinkedUser
                ? 'اربط الموظف بحساب مستخدم أولاً.'
                : rolesPermissionsLoading
                  ? 'جاري تحميل صلاحيات الأدوار…'
                  : 'عيّن أدواراً لعرض صلاحياتها هنا.'
            }
          />
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Plus className="h-4 w-4 text-success" />
              صلاحيات إضافية
              {extraAllowPermissions.length > 0 ? (
                <Badge variant="subtle" className="text-[10px]">
                  {extraAllowPermissions.length}
                </Badge>
              ) : null}
            </h3>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            صلاحيات ممنوحة مباشرةً خارج نطاق الأدوار — اختر من القائمة أو ألغِ التحديد لإزالتها.
          </p>

          <MultiSelect
            id="employee-extra-permissions"
            label="منح صلاحيات إضافية"
            options={extraPermissionOptions}
            value={extraPermissionIds}
            onChange={handleExtraPermissionsChange}
            deferCommit
            applyLabel="حفظ الصلاحيات"
            placeholder={
              !hasLinkedUser
                ? 'اربط الموظف بحساب مستخدم أولاً'
                : extraPermissionOptions.length === 0
                  ? 'لا توجد صلاحيات متاحة'
                  : 'اختر صلاحيات إضافية…'
            }
            searchPlaceholder="بحث في الصلاحيات…"
            emptyMessage="لا توجد نتائج"
            selectAllLabel="تحديد الكل"
            deselectAllLabel="إلغاء الكل"
            listMaxHeight="min(240px,40vh)"
            disabled={!hasLinkedUser || isMutating || extraPermissionOptions.length === 0}
            triggerClassName="h-10 rounded-xl bg-background"
            className="mb-4"
          />

          {extraAllowPermissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد صلاحيات إضافية ممنوحة.</p>
          ) : (
            <ul className="max-h-[min(40vh,320px)] space-y-2 overflow-y-auto overscroll-contain pr-1">
              {extraAllowPermissions.map((p) => {
                const overlay = overlayMap.get(p.id);
                return (
                  <li
                    key={p.id}
                    className="flex flex-col gap-2 rounded-xl border border-success/25 bg-success/5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                  >
                    <div className="flex min-w-0 items-start gap-2 sm:items-center">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success sm:mt-0" />
                      <div className="min-w-0">
                        <p className="text-sm leading-snug">{permissionLabel(p)}</p>
                        <code className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground" dir="ltr">
                          {p.code}
                        </code>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-full shrink-0 text-destructive hover:bg-destructive/10 sm:w-auto"
                      disabled={!hasLinkedUser || isMutating}
                      onClick={() => overlay && handleRemoveOverlay(overlay.overlayId)}
                    >
                      <X className="h-3.5 w-3.5" />
                      <span className="sm:sr-only">إزالة</span>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
