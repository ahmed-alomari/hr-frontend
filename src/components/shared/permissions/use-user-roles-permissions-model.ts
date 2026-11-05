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

  const { data: rolesResult } = useRoles(isActive);
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

      const cached = qc.getQueryData<Awaited<ReturnType<typeof userRolesApi.list>>>(PERMISSIONS_KEYS.userRoles(userId));
      const assignments = cached?.items ?? userRoleAssignments;
      const active = assignments.filter((a) => a.isActive);
      const currentIds = new Set(active.map((a) => a.roleId));
      const nextSet = new Set(nextRoleIds);

      const toAdd = nextRoleIds.filter((id) => !currentIds.has(id));
      const toRemove = active.filter((a) => !nextSet.has(a.roleId));

      await Promise.all([
        ...toAdd.map((roleId) => userRolesApi.assign(userId, { roleId, isActive: true })),
        ...toRemove.map((a) => userRolesApi.revoke(a.id)),
      ]);
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

  const handleToggleDeny = React.useCallback(
    (permissionId: string) => {
      const existing = overlayMap.get(permissionId);
      if (existing?.effect === 'DENY') {
        removeOverlayMutation.mutate(existing.overlayId);
      } else if (existing?.effect === 'ALLOW') {
        removeOverlayMutation.mutate(existing.overlayId);
        addOverlayMutation.mutate({ permissionId, effect: 'DENY' });
      } else {
        addOverlayMutation.mutate({ permissionId, effect: 'DENY' });
      }
    },
    [overlayMap, addOverlayMutation, removeOverlayMutation],
  );

  const handleGrantExtra = React.useCallback(
    (permissionId: string) => {
      if (overlayMap.get(permissionId)) return;
      addOverlayMutation.mutate({ permissionId, effect: 'ALLOW' });
    },
    [overlayMap, addOverlayMutation],
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
    handleRemoveOverlay,
    isMutating: addOverlayMutation.isPending || removeOverlayMutation.isPending,
    hasLinkedUser,
  };
}

export type UserRolesPermissionsModel = ReturnType<typeof useUserRolesPermissionsModel>;

export type { RoleResponseDto };
