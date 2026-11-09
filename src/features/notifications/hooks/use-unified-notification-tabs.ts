'use client';

import * as React from 'react';
import { useCan } from '@/features/auth/hooks/use-can';
import { useAuthStore } from '@/features/auth/lib/auth-store';
import { useCurrentEmployee } from '@/features/hr/organization/employees/hooks/useCurrentEmployee';
import { APP, useCompanyApps } from '@/shared/modules/company-apps';

export type UnifiedNotificationTabId = 'hr' | 'inventory' | 'store' | 'contacts' | 'expenses';

export type UnifiedNotificationTab = {
  id: UnifiedNotificationTabId;
  label: string;
  canUpdate: boolean;
};

export function useUnifiedNotificationTabs(): {
  tabs: UnifiedNotificationTab[];
  userId: string;
  employeeId: string;
  inventoryEnabled: boolean;
  storeEnabled: boolean;
  contactsEnabled: boolean;
  hrEnabled: boolean;
} {
  const can = useCan();
  const userId = useAuthStore((s) => s.user?.id ?? s.accessProfile?.userId ?? '');
  // The bell shows the apps the company has enabled (not the System Owner's
  // whole platform): each tab's notifications come from its app's API.
  const apps = useCompanyApps();
  const hrEnabled = apps.isEnabled(APP.hr);
  // Apps are separate: the HR employee is looked up only for the HR tab, when
  // HR is on for the company and the user may read employees.
  const { data: currentEmployee } = useCurrentEmployee(hrEnabled && can('hr.employees.read'));
  const employeeId = currentEmployee?.id ?? '';
  const inventoryEnabled = apps.isEnabled(APP.inventory);
  const storeEnabled = apps.isEnabled(APP.storeAdmin);
  const contactsEnabled = apps.isEnabled(APP.contacts);
  const expensesEnabled = apps.isEnabled(APP.expenses);

  const tabs = React.useMemo(() => {
    const result: UnifiedNotificationTab[] = [];

    if (hrEnabled && employeeId) {
      result.push({
        id: 'hr',
        label: 'الموارد البشرية',
        canUpdate: true,
      });
    }

    if (inventoryEnabled && userId && can('inv.notifications.read')) {
      result.push({
        id: 'inventory',
        label: 'المخازن',
        canUpdate: can('inv.notifications.update'),
      });
    }

    if (storeEnabled && userId && (can('sta.notifications.read') || can('hr.notifications.read'))) {
      result.push({
        id: 'store',
        label: 'المتجر',
        canUpdate: can('sta.notifications.update') || can('hr.notifications.update'),
      });
    }

    if (contactsEnabled && userId && (can('cnt.notifications.read') || can('hr.notifications.read'))) {
      result.push({
        id: 'contacts',
        label: 'جهات الاتصال',
        canUpdate: can('cnt.notifications.update') || can('hr.notifications.update'),
      });
    }

    if (expensesEnabled && userId && ['exp.expenses.create', 'exp.expenses.read', 'exp.expenses.approve', 'exp.custody.read', 'exp.settlements.read', 'exp.reports.read'].some((code) => can(code))) {
      result.push({ id: 'expenses', label: 'المصاريف', canUpdate: true });
    }

    return result;
  }, [hrEnabled, inventoryEnabled, storeEnabled, contactsEnabled, expensesEnabled, userId, employeeId, can]);

  return {
    tabs,
    userId,
    employeeId,
    inventoryEnabled,
    storeEnabled,
    contactsEnabled,
    hrEnabled,
  };
}
