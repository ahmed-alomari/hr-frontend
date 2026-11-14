'use client';

import { useQuery } from '@tanstack/react-query';
import { rolesApi } from '@/features/system/permissions/lib/api/roles';
import { PERMISSIONS_KEYS } from '@/features/system/permissions/hooks/query-keys';

/**
 * Roles the signed-in user may see. With `companyId`, only that company's
 * roles: a role can be given only to a member of its own company, so a picker
 * for one user lists the roles of that user's company.
 */
export function useRoles(enabled = true, companyId?: string | null) {
  return useQuery({
    queryKey: companyId ? [...PERMISSIONS_KEYS.roles, companyId] : PERMISSIONS_KEYS.roles,
    queryFn: () => rolesApi.getAll({ limit: 200, ...(companyId ? { companyId } : {}) }),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}
