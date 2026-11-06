import type { PermissionResponseDto } from '@/features/system/permissions/lib/api/permissions';
import { permissionHaystack } from '@/components/shared/permissions/permission-labels';

export type PermissionGroup = {
  id: string;
  title: string;
  /** Parent code, so screens of the same module stay together. */
  sortKey: string;
  items: PermissionResponseDto[];
};

/** Groups action permissions under their parent resource (نقاط التحضير، الموظفون، …). */
export function groupPermissionsByParent(
  actions: PermissionResponseDto[],
  catalog: PermissionResponseDto[],
): PermissionGroup[] {
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const groups = new Map<string, PermissionGroup>();

  for (const action of actions) {
    const parent = action.parentId ? byId.get(action.parentId) : undefined;
    const id = parent?.id ?? action.resource ?? 'other';
    const title = parent?.nameAr?.trim() || action.resource || 'صلاحيات أخرى';
    let group = groups.get(id);
    if (!group) {
      group = { id, title, sortKey: parent?.code ?? action.code, items: [] };
      groups.set(id, group);
    }
    group.items.push(action);
  }

  const list = [...groups.values()];
  for (const group of list) {
    group.items.sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  }
  list.sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.title.localeCompare(b.title, 'ar'));
  return list;
}

export function filterPermissionGroups(groups: PermissionGroup[], query: string): PermissionGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;

  return groups.flatMap((group) => {
    if (group.title.toLowerCase().includes(q)) return [group];
    const items = group.items.filter((item) => permissionHaystack(item, group.title).includes(q));
    if (items.length === 0) return [];
    return [{ ...group, items }];
  });
}
