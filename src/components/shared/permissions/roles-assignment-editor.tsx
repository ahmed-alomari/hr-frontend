'use client';

import * as React from 'react';
import { Search, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select';
import type { UserRolesPermissionsModel } from '@/components/shared/permissions/use-user-roles-permissions-model';
import { cn } from '@/shared/utils';

type Props = {
  model: Pick<
    UserRolesPermissionsModel,
    | 'allRoles'
    | 'assignedRoles'
    | 'assignedRoleIds'
    | 'rolesAssignLoading'
    | 'isSyncingRoles'
    | 'handleAssignedRolesChange'
    | 'hasLinkedUser'
    | 'rolePermissions'
    | 'extraAllowPermissions'
    | 'overlayMap'
  >;
  disabled?: boolean;
  rolesSelectId?: string;
  compact?: boolean;
  hideSummary?: boolean;
  summaryClassName?: string;
  /** dropdown: القائمة المنسدلة. list: قائمة ظاهرة بجانب الصلاحيات مع بحث. */
  variant?: 'dropdown' | 'list';
};

function sameIds(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const selected = new Set(a);
  return b.every((id) => selected.has(id));
}

function RolesAssignmentList({
  model,
  disabled,
}: {
  model: Props['model'];
  disabled: boolean;
}) {
  const canEdit = model.hasLinkedUser && !disabled;
  const [query, setQuery] = React.useState('');
  const [pending, setPending] = React.useState<string[]>(model.assignedRoleIds);

  React.useEffect(() => {
    setPending(model.assignedRoleIds);
  }, [model.assignedRoleIds]);

  const roles = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...model.allRoles].sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar'));
    if (!q) return sorted;
    return sorted.filter((role) =>
      [role.nameAr, role.nameEn, role.code, role.description]
        .filter((part): part is string => Boolean(part && part.trim()))
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [model.allRoles, query]);

  const dirty = !sameIds(pending, model.assignedRoleIds);
  const locked = !canEdit || model.rolesAssignLoading || model.isSyncingRoles;

  function toggle(roleId: string, checked: boolean) {
    setPending((current) =>
      checked ? (current.includes(roleId) ? current : [...current, roleId]) : current.filter((id) => id !== roleId),
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="بحث في الأدوار…"
          className="h-9 rounded-lg ps-9 text-sm"
          disabled={model.rolesAssignLoading}
        />
      </div>

      <p className="text-[11px] text-muted-foreground">
        {model.rolesAssignLoading
          ? 'جاري تحميل الأدوار…'
          : query.trim()
            ? `${roles.length} من ${model.allRoles.length} دور`
            : `${pending.length} محدد من ${model.allRoles.length}`}
      </p>

      {model.allRoles.length === 0 && !model.rolesAssignLoading ? (
        <p className="rounded-xl border border-dashed border-border/70 px-3 py-6 text-center text-sm text-muted-foreground">
          لا توجد أدوار
        </p>
      ) : roles.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/70 px-3 py-6 text-center text-sm text-muted-foreground">
          لا توجد أدوار مطابقة للبحث.
        </p>
      ) : (
        <ul className="max-h-[min(52vh,460px)] space-y-1.5 overflow-y-auto overscroll-contain pe-1">
          {roles.map((role) => {
            const checked = pending.includes(role.id);
            return (
              <li key={role.id}>
                <label
                  className={cn(
                    'flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors',
                    checked ? 'border-primary/30 bg-primary/5' : 'border-border/60 bg-muted/10',
                    locked && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <Checkbox
                    checked={checked}
                    disabled={locked}
                    onCheckedChange={(value) => toggle(role.id, value === true)}
                    className="mt-0.5"
                    aria-label={role.nameAr}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-snug">{role.nameAr}</span>
                    {role.description ? (
                      <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                        {role.description}
                      </span>
                    ) : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {model.isSyncingRoles ? 'جاري حفظ الأدوار…' : 'اختر الأدوار ثم اضغط «حفظ الأدوار».'}
        </p>
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0"
          disabled={!dirty || locked}
          onClick={() => model.handleAssignedRolesChange(pending)}
        >
          حفظ الأدوار
        </Button>
      </div>
    </div>
  );
}

function RolesAssignmentDropdown({
  model,
  disabled = false,
  rolesSelectId = 'user-roles-add',
  compact = false,
  hideSummary = false,
  summaryClassName,
}: Omit<Props, 'variant'>) {
  const canEdit = model.hasLinkedUser && !disabled;
  const deniedCount = [...model.overlayMap.values()].filter((o) => o.effect === 'DENY').length;

  const roleOptions = React.useMemo(
    (): MultiSelectOption[] =>
      model.allRoles.map((role) => ({
        value: role.id,
        label: role.nameAr,
        subtitle: role.description ?? undefined,
      })),
    [model.allRoles],
  );

  return (
    <div className={cn('grid gap-4', !hideSummary && !compact && 'lg:grid-cols-2')}>
      <div className="space-y-3">
        <MultiSelect
          id={rolesSelectId}
          label="الأدوار المعيّنة"
          options={roleOptions}
          value={model.assignedRoleIds}
          onChange={model.handleAssignedRolesChange}
          deferCommit
          applyLabel="حفظ الأدوار"
          placeholder={model.rolesAssignLoading ? 'جاري تحميل الأدوار…' : 'اختر الأدوار…'}
          searchPlaceholder="بحث في الأدوار…"
          emptyMessage="لا توجد أدوار"
          selectAllLabel="تحديد الكل"
          deselectAllLabel="إلغاء الكل"
          listMaxHeight="min(280px,45vh)"
          disabled={!canEdit || model.rolesAssignLoading || model.isSyncingRoles}
          triggerClassName="h-10 rounded-xl bg-background"
        />

        {model.isSyncingRoles ? (
          <p className="text-xs text-muted-foreground">جاري حفظ الأدوار…</p>
        ) : (
          <p className="text-xs text-muted-foreground">اختر الأدوار ثم اضغط «حفظ الأدوار» لتطبيق التغييرات.</p>
        )}

        {model.assignedRoles.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {model.assignedRoles.map((role) => (
              <Badge key={role.assignmentId} variant="secondary" className="text-[11px] font-normal">
                {role.nameAr}
              </Badge>
            ))}
          </div>
        ) : canEdit ? (
          <p className="text-xs text-muted-foreground">لم يُعيَّن أي دور بعد.</p>
        ) : null}
      </div>

      {!hideSummary ? (
        <div className={cn('rounded-xl border border-border/70 bg-muted/20 p-4', summaryClassName)}>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">ملخص</p>
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span>
                {model.assignedRoles.length > 0
                  ? `${model.assignedRoles.length} ${model.assignedRoles.length === 1 ? 'دور' : 'أدوار'}`
                  : 'لا أدوار'}
              </span>
            </p>
            <p>
              {model.rolePermissions.length > 0
                ? `${model.rolePermissions.length} صلاحية من الأدوار`
                : 'لا صلاحيات من الأدوار'}
              {model.extraAllowPermissions.length > 0 ? (
                <span className="text-success">
                  {' '}
                  + {model.extraAllowPermissions.length} إضافية
                </span>
              ) : null}
            </p>
            {deniedCount > 0 ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">{deniedCount} صلاحية محجوبة</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function RolesAssignmentEditor({
  variant = 'dropdown',
  ...props
}: Props) {
  if (variant === 'list') {
    return <RolesAssignmentList model={props.model} disabled={props.disabled ?? false} />;
  }
  return <RolesAssignmentDropdown {...props} />;
}
