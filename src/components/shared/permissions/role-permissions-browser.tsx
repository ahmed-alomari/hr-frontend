'use client';

import * as React from 'react';
import { Ban, Check, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { permissionLabel } from '@/components/shared/permissions/permission-labels';
import {
  filterPermissionGroups,
  groupPermissionsByParent,
} from '@/components/shared/permissions/permission-groups';
import type { PermissionResponseDto } from '@/features/system/permissions/lib/api/permissions';
import { cn } from '@/shared/utils';

type Overlay = { effect: string };

type Props = {
  permissions: PermissionResponseDto[];
  catalog: PermissionResponseDto[];
  overlayMap: Map<string, Overlay>;
  disabled?: boolean;
  onToggleDeny: (permissionId: string) => void;
  emptyMessage: string;
};

export function RolePermissionsBrowser({
  permissions,
  catalog,
  overlayMap,
  disabled = false,
  onToggleDeny,
  emptyMessage,
}: Props) {
  const [query, setQuery] = React.useState('');

  const groups = React.useMemo(
    () => groupPermissionsByParent(permissions, catalog),
    [permissions, catalog],
  );
  const visible = React.useMemo(
    () => filterPermissionGroups(groups, query),
    [groups, query],
  );
  const visibleCount = visible.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="بحث بالاسم العربي أو الرمز… مثال: نقاط التحضير"
          className="h-9 rounded-lg ps-9 text-sm"
          disabled={permissions.length === 0}
        />
      </div>

      {permissions.length > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          {query.trim()
            ? `${visibleCount} من ${permissions.length} صلاحية`
            : `${permissions.length} صلاحية، مجمّعة حسب الشاشة`}
        </p>
      ) : null}

      {permissions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-3 py-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : visibleCount === 0 ? (
        <p className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-3 py-6 text-center text-sm text-muted-foreground">
          لا توجد صلاحيات مطابقة للبحث.
        </p>
      ) : (
        <ul className="max-h-[min(52vh,460px)] space-y-3 overflow-y-auto overscroll-contain pe-1">
          {visible.map((group) => (
            <li key={group.id}>
              <p className="sticky top-0 z-10 bg-card/95 px-1 py-1 text-xs font-semibold text-foreground backdrop-blur-sm">
                {group.title}
                <span className="ms-1.5 font-normal text-muted-foreground">{group.items.length}</span>
              </p>
              <ul className="mt-1 space-y-1.5">
                {group.items.map((permission) => {
                  const isDenied = overlayMap.get(permission.id)?.effect === 'DENY';
                  return (
                    <li
                      key={permission.id}
                      className={cn(
                        'flex items-center justify-between gap-2 rounded-xl border px-3 py-2',
                        isDenied ? 'border-destructive/30 bg-destructive/5' : 'border-border/60 bg-muted/10',
                      )}
                    >
                      <div className="flex min-w-0 items-start gap-2">
                        {isDenied ? (
                          <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                        ) : (
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                        )}
                        <div className="min-w-0">
                          <p
                            className={cn(
                              'text-sm leading-snug',
                              isDenied ? 'text-muted-foreground line-through' : 'text-foreground',
                            )}
                          >
                            {permissionLabel(permission)}
                          </p>
                          <code className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground" dir="ltr">
                            {permission.code}
                          </code>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant={isDenied ? 'outline' : 'ghost'}
                        size="sm"
                        className={cn(
                          'h-7 shrink-0 gap-1 px-2 text-xs',
                          isDenied
                            ? 'border-success/30 text-success hover:bg-success/10'
                            : 'text-destructive hover:bg-destructive/10',
                        )}
                        disabled={disabled}
                        onClick={() => onToggleDeny(permission.id)}
                      >
                        {isDenied ? (
                          <>
                            <Check className="h-3 w-3" /> استعادة
                          </>
                        ) : (
                          <>
                            <Ban className="h-3 w-3" /> حجب
                          </>
                        )}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
