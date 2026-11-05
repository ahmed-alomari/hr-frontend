import type { PermissionResponseDto } from '@/features/system/permissions/lib/api/permissions';
import { permissionLabel } from '@/components/shared/permissions/permission-labels';
import { filterPermissionGroups, groupPermissionsByParent } from '@/components/shared/permissions/permission-groups';

function perm(partial: Partial<PermissionResponseDto> & Pick<PermissionResponseDto, 'id' | 'code' | 'nameAr'>): PermissionResponseDto {
  return {
    applicationId: 'app',
    nameEn: null,
    nodeType: 'ACTION',
    action: 'read',
    resource: 'check-in-points',
    parentId: null,
    sortOrder: 1,
    isSystem: true,
    status: 'active',
    ...partial,
  };
}

const catalog: PermissionResponseDto[] = [
  perm({
    id: 'g-points',
    code: 'hr.attendance.check-in-points',
    nameAr: 'نقاط التحضير',
    nodeType: 'GROUP',
    action: null,
    sortOrder: 3,
  }),
  perm({
    id: 'a-read',
    code: 'hr.attendance.check-in-points.read',
    nameAr: 'عرض نقاط التحضير',
    parentId: 'g-points',
    action: 'read',
    sortOrder: 1,
  }),
  perm({
    id: 'a-create',
    code: 'hr.attendance.check-in-points.create',
    nameAr: 'إضافة نقاط التحضير',
    parentId: 'g-points',
    action: 'create',
    sortOrder: 2,
  }),
  perm({
    id: 'g-leaves',
    code: 'hr.leaves.public-holidays',
    nameAr: 'العطل الرسمية',
    nodeType: 'GROUP',
    action: null,
    resource: 'public-holidays',
    sortOrder: 1,
  }),
  perm({
    id: 'a-holiday',
    code: 'hr.leaves.public-holidays.read',
    nameAr: 'عرض العطل الرسمية',
    parentId: 'g-leaves',
    resource: 'public-holidays',
    sortOrder: 1,
  }),
];

describe('permission labels and grouping', () => {
  it('uses the Arabic name instead of the resource code', () => {
    expect(permissionLabel(catalog[1])).toBe('عرض نقاط التحضير');
  });

  it('groups actions under the parent Arabic title', () => {
    const actions = catalog.filter((p) => p.nodeType === 'ACTION');
    const groups = groupPermissionsByParent(actions, catalog);
    expect(groups.map((g) => g.title)).toEqual(['نقاط التحضير', 'العطل الرسمية']);
    expect(groups[0].items.map((p) => p.nameAr)).toEqual(['عرض نقاط التحضير', 'إضافة نقاط التحضير']);
  });

  it('finds a permission by Arabic words or by its code', () => {
    const actions = catalog.filter((p) => p.nodeType === 'ACTION');
    const groups = groupPermissionsByParent(actions, catalog);

    const byArabic = filterPermissionGroups(groups, 'تحضير');
    expect(byArabic).toHaveLength(1);
    expect(byArabic[0].items).toHaveLength(2);

    const byCode = filterPermissionGroups(groups, 'public-holidays.read');
    expect(byCode.map((g) => g.title)).toEqual(['العطل الرسمية']);
    expect(byCode[0].items.map((p) => p.id)).toEqual(['a-holiday']);
  });
});
