'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRoles } from '@/features/system/permissions/hooks/useRoles';
import { usePermissions } from '@/features/system/permissions/hooks/usePermissions';
import { rolesApi } from '@/features/system/permissions/lib/api/roles';
import { userRolesApi } from '@/features/system/permissions/lib/api/user-roles';
import { userPermissionsApi, type UserPermissionEffect } from '@/features/system/permissions/lib/api/user-permissions';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import type { PermissionResponseDto } from '@/features/system/permissions/lib/api/permissions';
import type { RoleResponseDto } from '@/features/system/permissions/lib/api/roles';
import { PERMISSIONS_KEYS } from '@/features/system/permissions/hooks/query-keys';

export type PermissionOverlay = {
  overlayId: string;
  permissionId: string;
  effect: UserPermissionEffect;
  reason: string | null;
};

export type UserAssignedRole = {
  assignmentId: string;
  roleId: string;
  nameAr: string;
  description: string | null;
  isActive: boolean;
};

type UseUserRolesPermissionsModelOptions = {
  userId: string | null;
  enabled?: boolean;
  hasLinkedUser?: boolean;
  resolveCompanyId: () => Promise<string>;
  assignErrorContext?: string;
};

export function useUserRolesPermissionsModel({
  userId,
  enabled = true,
  hasLinkedUser = Boolean(userId),
  resolveCompanyId,
  assignErrorContext = 'userRole.assign',
}: UseUserRolesPermissionsModelOptions) {
  const qc = useQueryClient();
  const isActive = enabled && !!userId;

  // The edited user's company: a role of another company cannot be given to them.
  const [companyId, setCompanyId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    resolveCompanyId()
      .then((id) => !cancelled && setCompanyId(id))
      .catch(() => !cancelled && setCompanyId(null));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolved once per edited user
  }, [isActive, userId]);
  const { data: rolesResult } = useRoles(isActive && !!companyId, companyId);
  const { data: permissionsResult } = usePermissions(undefined, isActive);
  const allRoles = rolesResult?.items ?? [];
  const allPermissions: PermissionResponseDto[] = permissionsResult?.items ?? [];

  const { data: userRolesResult, isLoading: rolesAssignLoading } = useQuery({
    queryKey: PERMISSIONS_KEYS.userRoles(userId),
    queryFn: () => userRolesApi.list(userId!),
    enabled: isActive,
    staleTime: 2 * 60 * 1000,
  });

  const userRoleAssignments = userRolesResult?.items ?? [];
  const activeAssignments = React.useMemo(
    () => userRoleAssignments.filter((a) => a.isActive),
    [userRoleAssignments],
  );
  const activeRoleIds = React.useMemo(
    () => activeAssignments.map((a) => a.roleId),
    [activeAssignments],
  );

  const assignedRoles: UserAssignedRole[] = React.useMemo(
    () =>
      activeAssignments.map((assignment) => {
        const role = allRoles.find((r) => r.id === assignment.roleId);
        return {
          assignmentId: assignment.id,
          roleId: assignment.roleId,
          nameAr: role?.nameAr ?? assignment.roleId,
          description: role?.description ?? null,
          isActive: assignment.isActive,
        };
      }),
    [activeAssignments, allRoles],
  );


  const assignedRoleIds = activeRoleIds;

  const syncRolesMutation = useMutation({
    mutationFn: async (nextRoleIds: string[]) => {
      if (!userId) throw new Error('لا يوجد حساب مستخدم');
      await userRolesApi.sync(userId, nextRoleIds);
    },
    onSuccess: () => {
      toast.success('تم تحديث الأدوار');
      void qc.invalidateQueries({ queryKey: PERMISSIONS_KEYS.userRoles(userId) });
    },
    onError: (err) => handleApiError(err, assignErrorContext),
  });

  const handleAssignedRolesChange = React.useCallback(
    (nextRoleIds: string[]) => {
      syncRolesMutation.mutate(nextRoleIds);
    },
    [syncRolesMutation],
  );

  const rolePermQueries = useQueries({
    queries: activeRoleIds.map((roleId) => ({
      queryKey: PERMISSIONS_KEYS.rolePermissions(roleId),
      queryFn: () => rolesApi.getPermissions(roleId),
      enabled: isActive && !!roleId,
      staleTime: 5 * 60 * 1000,
    })),
  });

  const rolePermissionIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const query of rolePermQueries) {
      for (const row of query.data?.items ?? []) {
        ids.add(row.permissionId);
      }
    }
    return ids;
  }, [rolePermQueries]);

  const rolePermissions = React.useMemo(
    () => allPermissions.filter((p) => rolePermissionIds.has(p.id) && p.nodeType === 'ACTION'),
    [allPermissions, rolePermissionIds],
  );

  const rolesPermissionsLoading = rolePermQueries.some((q) => q.isLoading);

  const { data: overlaysResult } = useQuery({
    queryKey: PERMISSIONS_KEYS.userPermissions(userId),
    queryFn: () => userPermissionsApi.list(userId!),
    enabled: isActive,
    staleTime: 2 * 60 * 1000,
  });

  const overlays: PermissionOverlay[] = React.useMemo(
    () =>
      (overlaysResult?.items ?? [])
        .filter((o) => o.isActive)
        .map((o) => ({
          overlayId: o.id,
          permissionId: o.permissionId,
          effect: o.effect,
          reason: o.reason,
        })),
    [overlaysResult],
  );

  const overlayMap = React.useMemo(
    () => new Map(overlays.map((o) => [o.permissionId, o])),
    [overlays],
  );

  const extraAllowPermissions = React.useMemo(
    () =>
      overlays
        .filter((o) => o.effect === 'ALLOW' && !rolePermissionIds.has(o.permissionId))
        .map((o) => allPermissions.find((p) => p.id === o.permissionId))
        .filter(Boolean) as PermissionResponseDto[],
    [overlays, rolePermissionIds, allPermissions],
  );

  const addOverlayMutation = useMutation({
    mutationFn: async (args: { permissionId: string; effect: UserPermissionEffect; reason?: string }) => {
      if (!userId) throw new Error('لا يوجد حساب مستخدم');
      const companyId = await resolveCompanyId();
      return userPermissionsApi.assign(userId, {
        permissionId: args.permissionId,
        companyId,
        effect: args.effect,
        reason: args.reason ?? null,
      });
    },
    onSuccess: (_, args) => {
      const label = args.effect === 'DENY' ? 'تم حجب الصلاحية' : 'تم منح الصلاحية';
      toast.success(label);
      void qc.invalidateQueries({ queryKey: PERMISSIONS_KEYS.userPermissions(userId) });
    },
    onError: (err) => {
      const { displayMessage } = handleApiError(err, 'userPermission.assign');
      toast.error(displayMessage);
    },
  });

  const removeOverlayMutation = useMutation({
    mutationFn: (overlayId: string) => userPermissionsApi.remove(overlayId),
    onSuccess: () => {
      toast.success('تمت إزالة التخصيص');
      void qc.invalidateQueries({ queryKey: PERMISSIONS_KEYS.userPermissions(userId) });
    },
    onError: (err) => handleApiError(err, 'userPermission.remove'),
  });

  const updateOverlayMutation = useMutation({
    mutationFn: async (args: { overlayId: string; effect: UserPermissionEffect }) => {
      if (!userId) throw new Error('لا يوجد حساب مستخدم');
      return userPermissionsApi.update(userId, args.overlayId, { effect: args.effect });
    },
    onSuccess: (_, args) => {
      toast.success(args.effect === 'DENY' ? 'تم حجب الصلاحية' : 'تم تحديث الصلاحية');
      void qc.invalidateQueries({ queryKey: PERMISSIONS_KEYS.userPermissions(userId) });
    },
    onError: (err) => handleApiError(err, 'userPermission.update'),
  });

  const bulkGrantOverlayMutation = useMutation({
    mutationFn: async (permissionIds: string[]) => {
      if (!userId) throw new Error('لا يوجد حساب مستخدم');
      if (permissionIds.length === 0) return;
      const companyId = await resolveCompanyId();
      await userPermissionsApi.bulkAssign(
        userId,
        permissionIds.map((permissionId) => ({
          permissionId,
          companyId,
          effect: 'ALLOW' as const,
        })),
      );
    },
    onSuccess: (_, permissionIds) => {
      toast.success(
        permissionIds.length === 1 ? 'تم منح الصلاحية' : `تم منح ${permissionIds.length} صلاحيات`,
      );
      void qc.invalidateQueries({ queryKey: PERMISSIONS_KEYS.userPermissions(userId) });
    },
    onError: (err) => handleApiError(err, 'userPermission.assign'),
  });

  const handleToggleDeny = React.useCallback(
    (permissionId: string) => {
      const existing = overlayMap.get(permissionId);
      if (existing?.effect === 'DENY') {
        removeOverlayMutation.mutate(existing.overlayId);
      } else if (existing?.effect === 'ALLOW') {
        updateOverlayMutation.mutate({ overlayId: existing.overlayId, effect: 'DENY' });
      } else {
        addOverlayMutation.mutate({ permissionId, effect: 'DENY' });
      }
    },
    [overlayMap, addOverlayMutation, removeOverlayMutation, updateOverlayMutation],
  );

  const handleGrantExtra = React.useCallback(
    (permissionId: string) => {
      if (overlayMap.get(permissionId)) return;
      bulkGrantOverlayMutation.mutate([permissionId]);
    },
    [overlayMap, bulkGrantOverlayMutation],
  );

  const handleGrantExtraBulk = React.useCallback(
    (permissionIds: string[]) => {
      const ids = permissionIds.filter((id) => id && !overlayMap.has(id));
      if (ids.length === 0) return;
      bulkGrantOverlayMutation.mutate(ids);
    },
    [overlayMap, bulkGrantOverlayMutation],
  );

  const bulkDenyOverlayMutation = useMutation({
    mutationFn: async (permissionIds: string[]) => {
      if (!userId) throw new Error('لا يوجد حساب مستخدم');
      if (permissionIds.length === 0) return;
      const companyId = await resolveCompanyId();
      await userPermissionsApi.denyBulk(userId, companyId, permissionIds);
    },
    onSuccess: (_, permissionIds) => {
      toast.success(
        permissionIds.length === 1
          ? 'تم حجب الصلاحية'
          : `تم حجب ${permissionIds.length} صلاحيات`,
      );
      void qc.invalidateQueries({ queryKey: PERMISSIONS_KEYS.userPermissions(userId) });
    },
    onError: (err) => handleApiError(err, 'userPermission.assign'),
  });

  const handleDenyRolePermissionsBulk = React.useCallback(
    (permissionIds: string[]) => {
      const ids = permissionIds.filter((id) => {
        const existing = overlayMap.get(id);
        return !existing || existing.effect !== 'DENY';
      });
      if (ids.length === 0) return;
      bulkDenyOverlayMutation.mutate(ids);
    },
    [overlayMap, bulkDenyOverlayMutation],
  );

  const handleRemoveOverlay = React.useCallback(
    (overlayId: string) => {
      removeOverlayMutation.mutate(overlayId);
    },
    [removeOverlayMutation],
  );

  return {
    allRoles,
    assignedRoles,
    assignedRoleIds,
    rolesAssignLoading,
    rolesPermissionsLoading,
    isSyncingRoles: syncRolesMutation.isPending,
    handleAssignedRolesChange,
    rolePermissions,
    overlays,
    overlayMap,
    extraAllowPermissions,
    allPermissions,
    allActionPermissions: allPermissions.filter((p) => p.nodeType === 'ACTION'),
    handleToggleDeny,
    handleGrantExtra,
    handleGrantExtraBulk,
    handleDenyRolePermissionsBulk,
    handleRemoveOverlay,
    isMutating:
      addOverlayMutation.isPending ||
      removeOverlayMutation.isPending ||
      updateOverlayMutation.isPending ||
      bulkGrantOverlayMutation.isPending ||
      bulkDenyOverlayMutation.isPending,
    hasLinkedUser,
  };
}

export type UserRolesPermissionsModel = ReturnType<typeof useUserRolesPermissionsModel>;

export type { RoleResponseDto };
