'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Bell,
  Check,
  CheckCheck,
  Circle,
  ListX,
  Loader2,
  Settings2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/shared/utils';
import { DisplayDate } from '@/components/ui/table-cells';
import { useCan } from '@/features/auth/hooks/use-can';
import { EmployeePendingPayslipsSection } from '@/features/hr/payroll/components/employee-pending-payslips-section';
import {
  NOTIFICATION_CATEGORY_LABELS,
  NOTIFICATION_SEVERITY_LABELS,
} from '@/features/hr/notifications/admin/constants/notification-labels';
import type {
  NotificationCategory,
  NotificationSeverity,
} from '@/features/hr/notifications/lib/api/notifications';
import {
  countUnreadInbox,
  selectInboxForRecipient,
  useHRNotificationsStore,
} from '@/features/hr/notifications/lib/notifications-store';
import {
  INVENTORY_SOURCE_KIND_LABELS,
  INVENTORY_SEVERITY_DOT_CLASS,
} from '@/features/inventory/admin/notifications/constants/notification-labels';
import {
  countUnreadInventoryInbox,
  selectInventoryInbox,
  useInventoryNotificationsStore,
} from '@/features/inventory/admin/notifications/lib/inventory-notifications-store';
import { resolveInventoryNotificationLink } from '@/features/inventory/admin/notifications/lib/resolve-inventory-notification-link';
import { inventoryAdminRoutes } from '@/features/inventory/admin/constants/routes';
import {
  STORE_SOURCE_KIND_LABELS,
  STORE_SEVERITY_DOT_CLASS,
} from '@/features/ecommerce/admin/notifications/constants/notification-labels';
import {
  countUnreadStoreInbox,
  selectStoreInbox,
  useStoreNotificationsStore,
} from '@/features/ecommerce/admin/notifications/lib/store-notifications-store';
import { resolveStoreNotificationLink } from '@/features/ecommerce/admin/notifications/lib/resolve-store-notification-link';
import { ecommerceAdminRoutes } from '@/features/ecommerce/admin/constants/routes';
import {
  CONTACTS_SOURCE_KIND_LABELS,
  CONTACTS_SEVERITY_DOT_CLASS,
} from '@/features/contacts/admin/notifications/constants/notification-labels';
import {
  countUnreadContactsInbox,
  selectContactsInbox,
  useContactsNotificationsStore,
} from '@/features/contacts/admin/notifications/lib/contacts-notifications-store';
import { resolveContactsNotificationLink } from '@/features/contacts/admin/notifications/lib/resolve-contacts-notification-link';
import { contactsAdminRoutes } from '@/features/contacts/admin/constants/routes';
import { useExpensesNotificationsStore } from '@/features/expenses/data/notifications-store';
import {
  useUnifiedNotificationTabs,
  type UnifiedNotificationTabId,
} from '@/features/notifications/hooks/use-unified-notification-tabs';

function tabUnreadCount(
  tabId: UnifiedNotificationTabId,
  args: {
    userId: string;
    employeeId: string;
    hrItems: ReturnType<typeof useHRNotificationsStore.getState>['items'];
    hrUnreadApi: number;
    inventoryItems: ReturnType<typeof useInventoryNotificationsStore.getState>['items'];
    inventoryUnreadApi: number;
    storeItems: ReturnType<typeof useStoreNotificationsStore.getState>['items'];
    storeUnreadApi: number;
    contactsItems: ReturnType<typeof useContactsNotificationsStore.getState>['items'];
    contactsUnreadApi: number;
    expensesUnread: number;
  },
): number {
  switch (tabId) {
    case 'hr': {
      const local = countUnreadInbox(args.hrItems, args.employeeId);
      return args.hrUnreadApi > 0 ? args.hrUnreadApi : local;
    }
    case 'inventory': {
      const local = countUnreadInventoryInbox(args.inventoryItems, args.userId);
      return args.inventoryUnreadApi > 0 ? args.inventoryUnreadApi : local;
    }
    case 'store': {
      const local = countUnreadStoreInbox(args.storeItems, args.userId);
      return args.storeUnreadApi > 0 ? args.storeUnreadApi : local;
    }
    case 'contacts': {
      const local = countUnreadContactsInbox(args.contactsItems, args.userId);
      return args.contactsUnreadApi > 0 ? args.contactsUnreadApi : local;
    }
    case 'expenses':
      return args.expensesUnread;
    default:
      return 0;
  }
}

export function UnifiedNotificationBellPopover() {
  const can = useCan();
  const { tabs, userId, employeeId } = useUnifiedNotificationTabs();
  const [open, setOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<UnifiedNotificationTabId>('hr');

  const hrStore = useHRNotificationsStore();
  const inventoryStore = useInventoryNotificationsStore();
  const storeStore = useStoreNotificationsStore();
  const contactsStore = useContactsNotificationsStore();
  const expensesStore = useExpensesNotificationsStore();

  const unreadByTab = React.useMemo(() => {
    const args = {
      userId,
      employeeId,
      hrItems: hrStore.items,
      hrUnreadApi: hrStore.unreadTotal,
      inventoryItems: inventoryStore.items,
      inventoryUnreadApi: inventoryStore.unreadTotal,
      storeItems: storeStore.items,
      storeUnreadApi: storeStore.unreadTotal,
      contactsItems: contactsStore.items,
      contactsUnreadApi: contactsStore.unreadTotal,
      expensesUnread: expensesStore.unreadTotal,
    };
    return Object.fromEntries(
      tabs.map((tab) => [tab.id, tabUnreadCount(tab.id, args)]),
    ) as Record<UnifiedNotificationTabId, number>;
  }, [
    tabs,
    userId,
    employeeId,
    hrStore.items,
    hrStore.unreadTotal,
    inventoryStore.items,
    inventoryStore.unreadTotal,
    storeStore.items,
    storeStore.unreadTotal,
    contactsStore.items,
    contactsStore.unreadTotal,
    expensesStore.unreadTotal,
  ]);

  const totalUnread = React.useMemo(
    () => tabs.reduce((sum, tab) => sum + (unreadByTab[tab.id] ?? 0), 0),
    [tabs, unreadByTab],
  );

  const activeTabMeta = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  React.useEffect(() => {
    if (tabs.length === 0) return;
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0]!.id);
    }
  }, [tabs, activeTab]);

  const wasOpenRef = React.useRef(false);
  React.useEffect(() => {
    if (open && !wasOpenRef.current && tabs.length > 0) {
      const preferred =
        tabs.find((tab) => (unreadByTab[tab.id] ?? 0) > 0)?.id ?? tabs[0]!.id;
      setActiveTab(preferred);
    }
    wasOpenRef.current = open;
  }, [open, tabs, unreadByTab]);

  React.useEffect(() => {
    for (const tab of tabs) {
      if (tab.id === 'hr' && employeeId) void hrStore.fetch(employeeId);
      if (tab.id === 'inventory' && userId) void inventoryStore.fetch(userId);
      if (tab.id === 'store' && userId) void storeStore.fetch(userId);
      if (tab.id === 'contacts' && userId) void contactsStore.fetch(userId);
      if (tab.id === 'expenses') void expensesStore.fetch();
    }
  }, [tabs, userId, employeeId, hrStore.fetch, inventoryStore.fetch, storeStore.fetch, contactsStore.fetch, expensesStore.fetch]);

  React.useEffect(() => {
    if (!open) return;
    for (const tab of tabs) {
      if (tab.id === 'hr' && employeeId) void hrStore.fetch(employeeId);
      if (tab.id === 'inventory' && userId) void inventoryStore.fetch(userId);
      if (tab.id === 'store' && userId) void storeStore.fetch(userId);
      if (tab.id === 'contacts' && userId) void contactsStore.fetch(userId);
      if (tab.id === 'expenses') void expensesStore.fetch();
    }
  }, [open, tabs, userId, employeeId, hrStore.fetch, inventoryStore.fetch, storeStore.fetch, contactsStore.fetch, expensesStore.fetch]);

  async function handleMarkAllReadActiveTab() {
    if (!activeTabMeta) return;
    try {
      switch (activeTabMeta.id) {
        case 'hr':
          if (employeeId) await hrStore.markAllReadForRecipient(employeeId);
          break;
        case 'inventory':
          if (userId) await inventoryStore.markAllReadForUser(userId);
          break;
        case 'store':
          if (userId) await storeStore.markAllReadForUser(userId);
          break;
        case 'contacts':
          if (userId) await contactsStore.markAllReadForUser(userId);
          break;
        case 'expenses':
          await expensesStore.markAllRead();
          break;
      }
    } catch {
      toast.error('تعذر تحديد كل الإشعارات كمقروءة.');
    }
  }

  function isActiveTabFullyRead(): boolean {
    switch (activeTabMeta?.id) {
      case 'hr':
        return selectInboxForRecipient(hrStore.items, employeeId).every((n) => n.readAt);
      case 'inventory':
        return selectInventoryInbox(inventoryStore.items, userId).every((n) => n.readAt);
      case 'store':
        return selectStoreInbox(storeStore.items, userId).every((n) => n.readAt);
      case 'contacts':
        return selectContactsInbox(contactsStore.items, userId).every((n) => n.readAt);
      case 'expenses':
        return expensesStore.items.every((n) => n.readAt);
      default:
        return true;
    }
  }

  function isActiveTabLoadingEmpty(): boolean {
    switch (activeTabMeta?.id) {
      case 'inventory':
        return inventoryStore.isLoading && selectInventoryInbox(inventoryStore.items, userId).length === 0;
      case 'store':
        return storeStore.isLoading && selectStoreInbox(storeStore.items, userId).length === 0;
      default:
        return false;
    }
  }

  if (tabs.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative h-8 w-8 shrink-0 rounded-xl border-primary/25 bg-background/80 shadow-xs"
          aria-label="الإشعارات"
        >
          <Bell className="h-4 w-4" />
          {totalUnread > 0 ? (
            <span className="absolute right-1 top-1 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(100vw-2rem,440px)] overflow-hidden p-0" dir="rtl">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <p className="text-sm font-semibold text-foreground">الإشعارات</p>
          {activeTabMeta?.canUpdate ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 px-2 text-xs"
              disabled={isActiveTabFullyRead() || isActiveTabLoadingEmpty()}
              onClick={() => void handleMarkAllReadActiveTab()}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              قراءة الكل
            </Button>
          ) : null}
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as UnifiedNotificationTabId)}
          className="px-0"
        >
          {tabs.length > 1 ? (
            <TabsList className="mx-3 mt-2 h-auto w-[calc(100%-1.5rem)] flex-wrap gap-1 rounded-lg bg-muted/80 p-1">
              {tabs.map((tab) => {
                const count = unreadByTab[tab.id] ?? 0;
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="h-8 flex-1 min-w-[5.5rem] gap-1 px-2 text-xs"
                  >
                    <span className="truncate">{tab.label}</span>
                    {count > 0 ? (
                      <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        {count > 99 ? '99+' : count}
                      </span>
                    ) : null}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          ) : null}

          <TabsContent value="hr" className="mt-0">
            <HrNotificationTabPanel employeeId={employeeId} onNavigate={() => setOpen(false)} />
          </TabsContent>
          <TabsContent value="inventory" className="mt-0">
            <InventoryNotificationTabPanel
              userId={userId}
              canUpdate={can('inv.notifications.update')}
              onNavigate={() => setOpen(false)}
            />
          </TabsContent>
          <TabsContent value="store" className="mt-0">
            <StoreNotificationTabPanel
              userId={userId}
              canUpdate={can('sta.notifications.update') || can('hr.notifications.update')}
              onNavigate={() => setOpen(false)}
            />
          </TabsContent>
          <TabsContent value="contacts" className="mt-0">
            <ContactsNotificationTabPanel
              userId={userId}
              canUpdate={can('cnt.notifications.update') || can('hr.notifications.update')}
              onNavigate={() => setOpen(false)}
            />
          </TabsContent>
          <TabsContent value="expenses" className="mt-0">
            <ExpensesNotificationTabPanel onNavigate={() => setOpen(false)} />
          </TabsContent>
        </Tabs>

        {activeTabMeta?.id === 'inventory' && can('inv.settings.read') ? (
          <div className="border-t border-border px-3 py-2">
            <Link
              href={inventoryAdminRoutes.settings}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
              onClick={() => setOpen(false)}
            >
              <Settings2 className="h-3.5 w-3.5" />
              إعدادات إشعارات المخازن
            </Link>
          </div>
        ) : null}
        {activeTabMeta?.id === 'store' && (can('sta.settings.read') || can('hr.notifications.read')) ? (
          <div className="border-t border-border px-3 py-2">
            <Link
              href={ecommerceAdminRoutes.notificationSettings}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
              onClick={() => setOpen(false)}
            >
              <Settings2 className="h-3.5 w-3.5" />
              إعدادات إشعارات المتجر
            </Link>
          </div>
        ) : null}
        {activeTabMeta?.id === 'contacts' && (can('cnt.settings.read') || can('hr.notifications.read')) ? (
          <div className="border-t border-border px-3 py-2">
            <Link
              href={contactsAdminRoutes.settings}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
              onClick={() => setOpen(false)}
            >
              <Settings2 className="h-3.5 w-3.5" />
              إعدادات إشعارات جهات الاتصال
            </Link>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function HrNotificationTabPanel({
  employeeId,
  onNavigate,
}: {
  employeeId: string;
  onNavigate: () => void;
}) {
  const { items, markRead, markUnread, dismissFromInbox, dismissAllVisibleForRecipient } =
    useHRNotificationsStore();
  const inbox = React.useMemo(() => selectInboxForRecipient(items, employeeId), [items, employeeId]);

  return (
    <>
      <div className="flex items-center justify-end gap-1 border-b border-border/60 px-3 py-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
          disabled={inbox.length === 0}
          onClick={() => dismissAllVisibleForRecipient(employeeId)}
        >
          <ListX className="h-3.5 w-3.5" />
          إزالة الكل
        </Button>
      </div>
      <p className="border-b border-border/60 px-3 py-1.5 text-[10px] text-muted-foreground">
        إزالة الكل تخفي التنبيهات من القائمة فقط ولا تحذفها من النظام.
      </p>
      <EmployeePendingPayslipsSection />
      <NotificationListShell emptyMessage="لا توجد تنبيهات في صندوقك">
        {inbox.map((n) => {
          const categoryLabel =
            NOTIFICATION_CATEGORY_LABELS[n.category as NotificationCategory] ?? n.category;
          const severityLabel =
            NOTIFICATION_SEVERITY_LABELS[n.severity as NotificationSeverity] ?? n.severity;
          return (
            <li key={n.id} className="flex gap-2 px-3 py-2.5 hover:bg-muted/40">
              <button
                type="button"
                className={cn(
                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors',
                  n.readAt
                    ? 'border-success/30 bg-success/10 text-success'
                    : 'border-border bg-muted/50 text-muted-foreground hover:border-primary/40',
                )}
                title={n.readAt ? 'تحديد كغير مقروء' : 'تحديد كمقروء'}
                onClick={() => (n.readAt ? markUnread(n.id) : markRead(n.id))}
              >
                {n.readAt ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
              </button>
              <div className="min-w-0 flex-1 text-right">
                <div className="flex items-start justify-between gap-2">
                  <p className={cn('text-sm font-medium leading-snug', !n.readAt && 'text-foreground')}>
                    {n.titleAr}
                  </p>
                  <button
                    type="button"
                    className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                    title="إزالة من القائمة"
                    onClick={() => dismissFromInbox(n.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {n.bodyAr ? (
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{n.bodyAr}</p>
                ) : null}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="rounded-md bg-muted/70 px-1.5 py-0.5">{categoryLabel}</span>
                  <span className="rounded-md bg-muted/70 px-1.5 py-0.5">{severityLabel}</span>
                </div>
                {n.actionUrl ? (
                  <Link
                    href={n.actionUrl}
                    className="mt-1 inline-block text-[11px] text-primary hover:underline"
                    onClick={onNavigate}
                  >
                    {n.actionLabelAr?.trim() || 'عرض التفاصيل'}
                  </Link>
                ) : null}
                <DisplayDate value={n.createdAt} mode="datetime" className="mt-1 text-[10px]" />
              </div>
            </li>
          );
        })}
      </NotificationListShell>
    </>
  );
}

function InventoryNotificationTabPanel({
  userId,
  canUpdate,
  onNavigate,
}: {
  userId: string;
  canUpdate: boolean;
  onNavigate: () => void;
}) {
  const { items, markRead, isLoading, error } = useInventoryNotificationsStore();
  const inbox = React.useMemo(() => selectInventoryInbox(items, userId), [items, userId]);

  if (isLoading && inbox.length === 0) {
    return <LoadingState />;
  }
  if (error) {
    return <ErrorState message={error.message} />;
  }

  return (
    <NotificationListShell
      emptyMessage="لا توجد إشعارات مخازن في صندوقك"
      emptyHint={
        <>
          الإشعارات تصل فقط لمن يملك صلاحية{' '}
          <span className="font-mono text-[10px]">inv.notifications.read</span> ضمن نطاق الفرع المناسب.
        </>
      }
    >
      {inbox.map((n) => {
        const sourceLabel = (n.sourceKind && INVENTORY_SOURCE_KIND_LABELS[n.sourceKind]) ?? 'مخازن';
        const severityLabel =
          NOTIFICATION_SEVERITY_LABELS[n.severity as NotificationSeverity] ?? n.severity;
        const href = resolveInventoryNotificationLink(n);
        return (
          <NotificationRow
            key={n.id}
            title={n.titleAr}
            body={n.bodyAr}
            triggeredBy={n.triggeredByNameAr}
            readAt={n.readAt}
            canUpdate={canUpdate}
            severityDotClass={INVENTORY_SEVERITY_DOT_CLASS[n.severity] ?? 'bg-muted-foreground'}
            badges={[sourceLabel, severityLabel]}
            href={href}
            actionLabel={n.actionLabelAr}
            createdAt={n.createdAt}
            onMarkRead={() => markRead(n.id)}
            onNavigate={onNavigate}
          />
        );
      })}
    </NotificationListShell>
  );
}

function StoreNotificationTabPanel({
  userId,
  canUpdate,
  onNavigate,
}: {
  userId: string;
  canUpdate: boolean;
  onNavigate: () => void;
}) {
  const { items, markRead, isLoading, error } = useStoreNotificationsStore();
  const inbox = React.useMemo(() => selectStoreInbox(items, userId), [items, userId]);

  if (isLoading && inbox.length === 0) {
    return <LoadingState />;
  }
  if (error) {
    return <ErrorState message={error.message} />;
  }

  return (
    <NotificationListShell
      emptyMessage="لا توجد إشعارات متجر في صندوقك"
      emptyHint={
        <>
          الإشعارات تصل فقط لمن يملك صلاحية{' '}
          <span className="font-mono text-[10px]">sta.notifications.read</span> على مستوى الشركة.
        </>
      }
    >
      {inbox.map((n) => {
        const sourceLabel = (n.sourceKind && STORE_SOURCE_KIND_LABELS[n.sourceKind]) ?? 'متجر';
        const severityLabel =
          NOTIFICATION_SEVERITY_LABELS[n.severity as NotificationSeverity] ?? n.severity;
        const href = resolveStoreNotificationLink(n);
        return (
          <NotificationRow
            key={n.id}
            title={n.titleAr}
            body={n.bodyAr}
            triggeredBy={n.triggeredByNameAr}
            readAt={n.readAt}
            canUpdate={canUpdate}
            severityDotClass={STORE_SEVERITY_DOT_CLASS[n.severity] ?? 'bg-muted-foreground'}
            badges={[sourceLabel, severityLabel]}
            href={href}
            actionLabel={n.actionLabelAr}
            createdAt={n.createdAt}
            onMarkRead={() => markRead(n.id)}
            onNavigate={onNavigate}
          />
        );
      })}
    </NotificationListShell>
  );
}

function ContactsNotificationTabPanel({
  userId,
  canUpdate,
  onNavigate,
}: {
  userId: string;
  canUpdate: boolean;
  onNavigate: () => void;
}) {
  const { items, markRead } = useContactsNotificationsStore();
  const inbox = React.useMemo(() => selectContactsInbox(items, userId), [items, userId]);

  return (
    <NotificationListShell emptyMessage="لا توجد إشعارات جهات اتصال في صندوقك">
      {inbox.map((n) => {
        const sourceLabel =
          (n.sourceKind && CONTACTS_SOURCE_KIND_LABELS[n.sourceKind]) ?? 'جهات اتصال';
        const severityLabel =
          NOTIFICATION_SEVERITY_LABELS[n.severity as NotificationSeverity] ?? n.severity;
        const href = resolveContactsNotificationLink(n);
        return (
          <NotificationRow
            key={n.id}
            title={n.titleAr}
            body={n.bodyAr}
            readAt={n.readAt}
            canUpdate={canUpdate}
            severityDotClass={CONTACTS_SEVERITY_DOT_CLASS[n.severity] ?? 'bg-muted-foreground'}
            badges={[sourceLabel, severityLabel]}
            href={href}
            actionLabel={n.actionLabelAr}
            createdAt={n.createdAt}
            onMarkRead={() => markRead(n.id)}
            onNavigate={onNavigate}
          />
        );
      })}
    </NotificationListShell>
  );
}

const EXPENSES_SOURCE_LABELS: Record<string, string> = {
  expenses_approval_waiting: 'بانتظار الاعتماد',
  expenses_approval_decided: 'قرار الاعتماد',
};

function ExpensesNotificationTabPanel({ onNavigate }: { onNavigate: () => void }) {
  const { items, markRead } = useExpensesNotificationsStore();
  return (
    <NotificationListShell emptyMessage="لا توجد إشعارات مصاريف في صندوقك">
      {items.map((n) => (
        <NotificationRow
          key={n.recipientId}
          title={n.titleAr}
          body={n.bodyAr ?? undefined}
          readAt={n.readAt}
          canUpdate
          severityDotClass={CONTACTS_SEVERITY_DOT_CLASS[n.severity] ?? 'bg-muted-foreground'}
          badges={[(n.sourceKind && EXPENSES_SOURCE_LABELS[n.sourceKind]) ?? 'مصاريف', NOTIFICATION_SEVERITY_LABELS[n.severity as NotificationSeverity] ?? n.severity]}
          href={n.actionUrl ?? null}
          actionLabel={n.actionLabelAr}
          createdAt={n.createdAt}
          onMarkRead={() => markRead(n.recipientId)}
          onNavigate={onNavigate}
        />
      ))}
    </NotificationListShell>
  );
}

function NotificationListShell({
  children,
  emptyMessage,
  emptyHint,
}: {
  children: React.ReactNode;
  emptyMessage: string;
  emptyHint?: React.ReactNode;
}) {
  const items = React.Children.toArray(children);
  const isEmpty = items.length === 0;
  return (
    <div className="max-h-[min(60vh,380px)] overflow-y-auto">
      {isEmpty ? (
        <div className="space-y-2 px-4 py-10 text-center text-sm text-muted-foreground">
          <p>{emptyMessage}</p>
          {emptyHint ? <p className="text-[11px] leading-relaxed">{emptyHint}</p> : null}
        </div>
      ) : (
        <ul className="divide-y divide-border/60">{children}</ul>
      )}
    </div>
  );
}

function NotificationRow({
  title,
  body,
  triggeredBy,
  readAt,
  canUpdate,
  severityDotClass,
  badges,
  href,
  actionLabel,
  createdAt,
  onMarkRead,
  onNavigate,
}: {
  title: string;
  body?: string;
  triggeredBy?: string | null;
  readAt: string | null;
  canUpdate: boolean;
  severityDotClass: string;
  badges: string[];
  href: string | null;
  actionLabel?: string | null;
  createdAt: string;
  onMarkRead: () => void;
  onNavigate: () => void;
}) {
  return (
    <li className="flex gap-2 px-3 py-2.5 hover:bg-muted/40">
      {canUpdate ? (
        <button
          type="button"
          className={cn(
            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors',
            readAt
              ? 'border-success/30 bg-success/10 text-success'
              : 'border-border bg-muted/50 text-muted-foreground hover:border-primary/40',
          )}
          title={readAt ? 'مقروء' : 'تحديد كمقروء'}
          disabled={Boolean(readAt)}
          onClick={onMarkRead}
        >
          {readAt ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
        </button>
      ) : null}
      <div className="min-w-0 flex-1 text-right">
        <div className="flex min-w-0 items-start gap-2">
          <span
            className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', severityDotClass)}
            aria-hidden
          />
          <p className={cn('text-sm font-medium leading-snug', !readAt && 'text-foreground')}>
            {title}
          </p>
        </div>
        {body ? (
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{body}</p>
        ) : null}
        {triggeredBy ? (
          <p className="mt-0.5 text-[10px] text-muted-foreground">نفّذها: {triggeredBy}</p>
        ) : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
          {badges.map((badge) => (
            <span key={badge} className="rounded-md bg-muted/70 px-1.5 py-0.5">
              {badge}
            </span>
          ))}
        </div>
        {href ? (
          <Link
            href={href}
            className="mt-1 inline-block text-[11px] text-primary hover:underline"
            onClick={() => {
              if (!readAt) onMarkRead();
              onNavigate();
            }}
          >
            {actionLabel?.trim() || 'عرض التفاصيل'}
          </Link>
        ) : null}
        <DisplayDate value={createdAt} mode="datetime" className="mt-1 text-[10px]" />
      </div>
    </li>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      جاري التحميل…
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return <div className="px-4 py-10 text-center text-sm text-destructive">{message}</div>;
}
