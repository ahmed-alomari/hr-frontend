'use client';

import * as React from 'react';
import Link from 'next/link';
import { Ban, Check, ChevronDown, Plus, Search, Shield, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select';
import { systemPermissionsHref } from '@/features/system/permissions/constants/routes';
import { RolesAssignmentEditor } from '@/components/shared/permissions/roles-assignment-editor';
import { RolePermissionsBrowser } from '@/components/shared/permissions/role-permissions-browser';
import { permissionHaystack, permissionLabel } from '@/components/shared/permissions/permission-labels';
import type { UserPermissionsModel } from '@/features/system/organization/contacts/hooks/useUserPermissionsModel';

type Props = {
  model: UserPermissionsModel;
};

function SummaryPill({ label, value, tone }: { label: string; value: string; tone?: 'default' | 'success' | 'warning' }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/80 px-3 py-2.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 text-sm font-semibold ${
          tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-amber-600 dark:text-amber-400' : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function UserPermissionsPanel({ model }: Props) {
  const {
    rolePermissions,
    overlayMap,
    extraAllowPermissions,
    allPermissions,
    allActionPermissions,
    handleToggleDeny,
    handleGrantExtra,
    handleGrantExtraBulk,
    handleDenyRolePermissionsBulk,
    handleRemoveOverlay,
    isMutating,
    hasCompany,
    rolesPermissionsLoading,
    ...rolesModel
  } = model;

  const [extraQuery, setExtraQuery] = React.useState('');
  const [addingExtra, setAddingExtra] = React.useState(false);
  const [addingDeny, setAddingDeny] = React.useState(false);

  const deniedCount = React.useMemo(
    () => [...overlayMap.values()].filter((o) => o.effect === 'DENY').length,
    [overlayMap],
  );

  const parentTitleById = React.useMemo(() => {
    const titles = new Map<string, string>();
    for (const permission of allPermissions) {
      if (permission.nameAr?.trim()) titles.set(permission.id, permission.nameAr.trim());
    }
    return titles;
  }, [allPermissions]);

  const grantablePermissions = React.useMemo(() => {
    const inRole = new Set(rolePermissions.map((p) => p.id));
    const alreadyAllowed = new Set(extraAllowPermissions.map((p) => p.id));
    return allActionPermissions.filter((p) => !inRole.has(p.id) && !alreadyAllowed.has(p.id));
  }, [allActionPermissions, rolePermissions, extraAllowPermissions]);

  const extraMatches = React.useMemo(() => {
    const q = extraQuery.trim().toLowerCase();
    if (!q) return [];
    return grantablePermissions
      .filter((permission) => {
        const parentTitle = permission.parentId ? parentTitleById.get(permission.parentId) : undefined;
        return permissionHaystack(permission, parentTitle).includes(q);
      })
      .slice(0, 12);
  }, [extraQuery, grantablePermissions, parentTitleById]);

  const grantableOptions = React.useMemo(
    (): MultiSelectOption[] =>
      grantablePermissions.map((p) => ({
        value: p.id,
        label: permissionLabel(p),
        subtitle: p.code,
      })),
    [grantablePermissions],
  );

  const denyableOptions = React.useMemo(
    (): MultiSelectOption[] =>
      rolePermissions
        .filter((p) => overlayMap.get(p.id)?.effect !== 'DENY')
        .map((p) => ({
          value: p.id,
          label: permissionLabel(p),
          subtitle: p.code,
        })),
    [rolePermissions, overlayMap],
  );

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/5 via-card to-card p-4 shadow-soft sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Shield className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 text-right">
            <h3 className="text-base font-semibold">صلاحيات المستخدم</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              الأدوار والصلاحيات متقابلان. ابحث بالاسم العربي — مثل «نقاط التحضير» — أو بجزء من الرمز.{' '}
              <Link href={systemPermissionsHref()} className="font-medium text-primary hover:underline">
                إدارة الأدوار
              </Link>
            </p>
          </div>
        </div>

        {!hasCompany ? (
          <p className="mt-4 rounded-xl border border-amber-300/50 bg-amber-50 px-3 py-2.5 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
            يجب ربط المستخدم بشركة قبل إدارة الصلاحيات.
          </p>
        ) : null}

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
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
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="flex min-h-[280px] flex-col rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Shield className="h-4 w-4 text-primary" />
            الأدوار المعينة
            <Badge variant="subtle" className="text-[10px]">
              {rolesModel.assignedRoles.length}
            </Badge>
          </h4>
          <RolesAssignmentEditor
            model={{ ...rolesModel, rolePermissions, extraAllowPermissions, overlayMap }}
            rolesSelectId="user-role-add"
            disabled={!hasCompany}
            variant="list"
            hideSummary
          />
        </div>

        <div className="flex min-h-[280px] flex-col rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <Shield className="h-4 w-4 text-primary" />
              صلاحيات الأدوار
              <Badge variant="subtle" className="text-[10px]">
                {rolePermissions.length}
              </Badge>
            </h4>
            {hasCompany && denyableOptions.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs text-destructive hover:bg-destructive/10"
                onClick={() => setAddingDeny((v) => !v)}
              >
                <ChevronDown className={`h-3 w-3 transition-transform ${addingDeny ? 'rotate-180' : ''}`} />
                <Ban className="h-3 w-3" />
                حجب جماعي
              </Button>
            ) : null}
          </div>

          {addingDeny ? (
            <div className="mb-3">
              <MultiSelect
                id="user-role-permissions-deny"
                label="اختر صلاحيات الأدوار لحجبها"
                options={denyableOptions}
                value={[]}
                onChange={(ids) => {
                  if (ids.length === 0) return;
                  handleDenyRolePermissionsBulk(ids);
                  setAddingDeny(false);
                }}
                deferCommit
                applyLabel="حجب المحددة"
                placeholder="اختر صلاحية أو أكثر…"
                searchPlaceholder="بحث في صلاحيات الأدوار…"
                emptyMessage="لا توجد صلاحيات غير محجوبة"
                listMaxHeight="min(280px,40vh)"
                disabled={!hasCompany || isMutating}
                triggerClassName="h-10 rounded-xl bg-background"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                حدّد صلاحية أو أكثر ثم «حجب المحددة» — طلب واحد للدفعة كاملة.
              </p>
            </div>
          ) : null}
          <RolePermissionsBrowser
            permissions={rolePermissions}
            catalog={allPermissions}
            overlayMap={overlayMap}
            disabled={!hasCompany || isMutating}
            onToggleDeny={handleToggleDeny}
            emptyMessage={
              rolesPermissionsLoading
                ? 'جاري تحميل صلاحيات الأدوار…'
                : 'عيّن دوراً من القائمة المقابلة لعرض صلاحياته هنا.'
            }
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <Plus className="h-4 w-4 text-success" />
            صلاحيات إضافية
            {extraAllowPermissions.length > 0 ? (
              <Badge variant="subtle" className="text-[10px]">
                {extraAllowPermissions.length}
              </Badge>
            ) : null}
          </h4>
          {hasCompany && grantablePermissions.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => setAddingExtra((v) => !v)}
            >
              <ChevronDown className={`h-3 w-3 transition-transform ${addingExtra ? 'rotate-180' : ''}`} />
              منح جماعي
            </Button>
          ) : null}
        </div>

        {addingExtra ? (
          <div className="mb-3">
            <MultiSelect
              id="user-extra-permissions-grant"
              label="اختر صلاحيات لمنحها"
              options={grantableOptions}
              value={[]}
              onChange={(ids) => {
                if (ids.length === 0) return;
                handleGrantExtraBulk(ids);
                setAddingExtra(false);
              }}
              deferCommit
              applyLabel="منح المحددة"
              placeholder="اختر صلاحية أو أكثر…"
              searchPlaceholder="بحث في الصلاحيات…"
              emptyMessage="لا توجد صلاحيات متاحة للمنح"
              listMaxHeight="min(280px,40vh)"
              disabled={!hasCompany || isMutating}
              triggerClassName="h-10 rounded-xl bg-background"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              حدّد صلاحية أو أكثر ثم «منح المحددة» — طلب واحد للدفعة كاملة.
            </p>
          </div>
        ) : null}

        {hasCompany && grantablePermissions.length > 0 ? (
          <div className="mb-3 space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={extraQuery}
                onChange={(event) => setExtraQuery(event.target.value)}
                placeholder="ابحث لمنح صلاحية إضافية… مثال: العطل الرسمية"
                className="h-9 rounded-lg ps-9 text-sm"
                disabled={isMutating}
              />
            </div>
            {extraQuery.trim() && extraMatches.length === 0 ? (
              <p className="text-xs text-muted-foreground">لا توجد صلاحيات مطابقة يمكن منحها.</p>
            ) : null}
            {extraMatches.length > 0 ? (
              <ul className="max-h-52 space-y-1.5 overflow-y-auto overscroll-contain pe-1">
                {extraMatches.map((permission) => (
                  <li
                    key={permission.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/10 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">{permissionLabel(permission)}</p>
                      <code className="block truncate font-mono text-[10px] text-muted-foreground" dir="ltr">
                        {permission.code}
                      </code>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 shrink-0 gap-1 text-xs"
                      disabled={isMutating}
                      onClick={() => {
                        handleGrantExtra(permission.id);
                        setExtraQuery('');
                      }}
                    >
                      <Check className="h-3.5 w-3.5" /> منح
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {extraAllowPermissions.length === 0 ? (
          <p className="py-1 text-sm text-muted-foreground">لا توجد صلاحيات إضافية.</p>
        ) : (
          <ul className="max-h-52 space-y-2 overflow-y-auto overscroll-contain pe-1">
            {extraAllowPermissions.map((permission) => {
              const overlay = overlayMap.get(permission.id);
              return (
                <li
                  key={permission.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-success/25 bg-success/5 px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Check className="h-3.5 w-3.5 shrink-0 text-success" />
                    <div className="min-w-0">
                      <p className="text-sm leading-snug">{permissionLabel(permission)}</p>
                      <code className="block truncate font-mono text-[10px] text-muted-foreground" dir="ltr">
                        {permission.code}
                      </code>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 text-destructive hover:bg-destructive/10"
                    disabled={!hasCompany || isMutating}
                    onClick={() => overlay && handleRemoveOverlay(overlay.overlayId)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
