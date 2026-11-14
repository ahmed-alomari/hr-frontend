import * as React from 'react';
import { Pencil, Shield, Trash2 } from 'lucide-react';
import { cn } from '@/shared/utils';
import { Button } from '@/components/ui/button';
import {
  permissionRoleIconClasses,
  coercePermissionRoleColorToken,
} from '@/features/system/permissions/constants/role-colors';
import type { RoleResponseDto } from '@/features/system/permissions/lib/api/roles';

type Props = {
  role: RoleResponseDto;
  grantedCount: number;
  onEdit: (role: RoleResponseDto) => void;
  onDelete: (role: RoleResponseDto) => void;
};

export function RoleCard({ role, grantedCount, onEdit, onDelete }: Props) {
  const colorToken = coercePermissionRoleColorToken('primary');
  const iconClasses = permissionRoleIconClasses(colorToken);
  const displayName = role.nameAr ?? role.name ?? '—';

  return (
    <div className="group relative flex flex-col rounded-lg border border-border bg-card shadow-soft transition-all hover:border-primary/25 hover:shadow-md">
      <div className="flex items-center gap-3 p-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors group-hover:scale-[1.02]',
            iconClasses.bg,
            iconClasses.text,
          )}
        >
          <Shield className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-sm font-semibold">{displayName}</h3>
            {role.isSystem ? (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                نظامي
              </span>
            ) : role.isDefault ? (
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                جاهز
              </span>
            ) : null}
          </div>
          {role.description ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
              {role.description}
            </p>
          ) : null}
          {grantedCount > 0 ? (
            <p className={cn('mt-1 text-[10px] font-medium', iconClasses.text)}>
              {grantedCount} صلاحية مفعّلة
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-1.5 border-t border-border/70 px-3 py-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 flex-1 gap-1.5 text-xs"
          onClick={() => onEdit(role)}
        >
          <Pencil className="h-3.5 w-3.5" />
          تعديل
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 flex-1 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onDelete(role)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          حذف
        </Button>
      </div>
    </div>
  );
}
