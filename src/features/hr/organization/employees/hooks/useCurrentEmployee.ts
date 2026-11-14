'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/lib/auth-store';
import { useDefaultCompanyId } from '@/features/hr/organization/lib/default-company-id';
import { ApiError } from '@/shared/api/client';
import { employeesApi } from '@/features/hr/organization/employees/lib/api/employees';

export function useCurrentEmployee(enabled = true) {
  const userId = useAuthStore((s) => s.user?.id);
  const companyId = useDefaultCompanyId();
  return useQuery({
    queryKey: ['current-employee', userId, companyId],
    queryFn: async () => {
      try {
        return (await employeesApi.mine(companyId!)) ?? null;
      } catch (err) {
        // A server without `/hr/employees/me` yet (deployed after this screen):
        // the former lookup, so the bell keeps working whatever the order.
        if (err instanceof ApiError && (err.status === 400 || err.status === 404)) {
          const result = await employeesApi.getAll({ companyId: companyId ?? undefined, limit: 500 });
          return result.items.find((e) => e.userId === userId) ?? null;
        }
        throw err;
      }
    },
    enabled: enabled && !!userId && !!companyId,
    staleTime: 10 * 60 * 1000,
  });
}
