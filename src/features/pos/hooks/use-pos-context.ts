'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@/features/auth/lib/auth-store';
import { useCompanyCurrency } from '@/features/auth/lib/company-currency';
import { useCan } from '@/features/auth/hooks/use-can';
import { useModuleEnablementContext } from '@/features/auth/hooks/use-system-owner';
import { companiesApi } from '@/features/hr/organization/lib/api/companies';
import { useDefaultCompanyId } from '@/features/hr/organization/lib/default-company-id';
import { POS_HISTORY_DAYS, PosRuleError, posActions, usePosData, type PosDataScopeValue } from '@/features/pos/lib/pos-store';
import type { PrintCompany } from '@/features/print-templates/domain/types';
import { toPrintCompany } from '@/features/print-templates/lib/print-company';
import { isModuleEnabledFor } from '@/shared/modules/registry';

/** Permission codes of the app (same as the backend tree `pos.*`). */
export type PosPermission =
  | 'pos.sell'
  | 'pos.sales.read'
  | 'pos.discount'
  | 'pos.price.override'
  | 'pos.return'
  | 'pos.refund'
  | 'pos.refund.other-method'
  | 'pos.exceptions.resolve'
  | 'pos.cash.move'
  | 'pos.session.open'
  | 'pos.session.close'
  | 'pos.session.close-others'
  | 'pos.devices.manage'
  | 'pos.settings.manage'
  | 'pos.reports.read'
  | 'pos.credit.collect';

type RawActions = Omit<ReturnType<typeof posActions>, 'read'>;
type Actions = {
  [K in keyof RawActions]: (
    ...args: Parameters<RawActions[K]>
  ) => Promise<Awaited<ReturnType<RawActions[K]>> | undefined>;
};

/**
 * Each action as the screens call it: what the server refuses (a rule, a
 * permission, no connection) shows its reason and does nothing; the action
 * resolves to undefined.
 */
function guarded(actions: ReturnType<typeof posActions>): Actions {
  return Object.fromEntries(
    Object.entries(actions)
      .filter(([name]) => name !== 'read')
      .map(([name, fn]) => [
        name,
        async (...args: unknown[]) => {
          try {
            return await (fn as (...a: unknown[]) => Promise<unknown>)(...args);
          } catch (error) {
            if (error instanceof PosRuleError) {
              toast.error(error.message);
              return undefined;
            }
            throw error;
          }
        },
      ]),
  ) as Actions;
}

const PosDataScopeContext = React.createContext<PosDataScopeValue>(POS_HISTORY_DAYS);

/**
 * How much history this screen reads: days (the register needs only what is
 * open, 0), or the period its filter chose, of any age.
 */
export function PosDataScope({ days, range, children }: { days?: number; range?: { from: string; to: string }; children: React.ReactNode }) {
  return React.createElement(PosDataScopeContext.Provider, { value: range ?? days ?? POS_HISTORY_DAYS }, children);
}

/** Everything a POS screen needs: company, its data, actions, the user and permissions. */
export function usePosContext() {
  // The active company: its data and its permissions (useCan reads the active
  // company too), so a user with several companies never mixes the two.
  const defaultCompanyId = useDefaultCompanyId();
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const companyId = activeCompanyId ?? defaultCompanyId;
  const user = useAuthStore((s) => s.user);
  const profileCompany = useAuthStore(
    (s) => s.accessProfile?.companies?.find((c) => c.companyId === companyId) ?? null,
  );
  const { companyId: moduleCompanyId, ...moduleContext } = useModuleEnablementContext();
  const can = useCan();
  // The company record (address, tax number…) for receipts — only for who may
  // read it; a cashier gets the header from the access profile instead.
  const mayReadCompany = can('system.organization.companies.read');
  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => companiesApi.getById(companyId!),
    enabled: Boolean(companyId && mayReadCompany),
    staleTime: 60_000,
  });
  // The company's base currency (company settings), from the access profile.
  const currency = useCompanyCurrency();
  const scope = React.useContext(PosDataScopeContext);
  const data = usePosData(companyId, scope);
  const queryClient = useQueryClient();
  const actions = React.useMemo(
    () => (companyId ? guarded(posActions(companyId, queryClient)) : null),
    [companyId, queryClient],
  );

  const printCompany: PrintCompany = React.useMemo(
    () =>
      company
        ? toPrintCompany(company)
        : {
            nameAr: profileCompany?.companyNameAr || 'اسم الشركة',
            nameEn: profileCompany?.companyNameEn ?? null,
            logoUrl: profileCompany?.companyLogoUrl ?? null,
            commercialRegistrationNo: profileCompany?.companyCommercialRegistrationNo ?? null,
            primaryColor: profileCompany?.companyPrimaryColor ?? null,
          },
    [company, profileCompany],
  );

  const userName = user?.fullNameAr || user?.fullNameEn || user?.email || 'مستخدم';
  // The company's super admin or the platform's owner: on any register.
  const isSuperAdmin = Boolean(moduleContext.isSystemOwner || profileCompany?.isCompanySuperuser);
  const enabled = isModuleEnabledFor('pos', companyId ?? moduleCompanyId, moduleContext);

  return {
    companyId,
    company: company ?? null,
    printCompany,
    currency,
    data,
    actions,
    userId: user?.id ?? 'unknown',
    userName,
    isSuperAdmin,
    enabled,
    can: (code: PosPermission) => can(code),
  };
}
