'use client';

import { Bell, Fingerprint, Monitor, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import { HR_NOTIFICATION_GROUPS } from '@/features/system/organization/pages/_shared/constants/notification-groups';
import { NotificationTogglesCard } from '@/features/system/organization/pages/_shared/components/notification-toggles-card';
import {
  SettingsPageEmpty,
  SettingsPageError,
  SettingsPageLoading,
} from '@/features/system/organization/pages/_shared/components/settings-page-states';
import { MobileSerialApprovalSettingCard } from '@/features/system/organization/pages/hr/components/mobile-serial-approval-setting-card';
import { PunchPolicySettingCard } from '@/features/system/organization/pages/hr/components/punch-policy-setting-card';
import { useHrCompanySettings } from '@/features/system/organization/pages/hr/hooks/useHrSettings';
import type { HrNotificationKey } from '@/features/system/organization/pages/_shared/constants/notification-groups';
import type {
  HrCompanySettings,
  UpdateHrCompanySettingsDto,
} from '@/features/system/organization/pages/_shared/types/settings';

const TAB_TRIGGER =
  'gap-2 rounded-lg px-3 py-2.5 text-sm data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-soft';

export default function HrSettingsPage() {
  const { data: settings, isLoading, isError, error, update, companyId } =
    useHrCompanySettings();

  const handleToggle = async (key: string, value: boolean) => {
    if (!settings) return;
    try {
      await update.mutateAsync({ [key]: value });
      toast.success('تم تحديث الإعداد');
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'settings.hr.update');
      toast.error(displayMessage);
    }
  };

  const handleSettingsPatch = async (patch: UpdateHrCompanySettingsDto) => {
    if (!settings) return;
    try {
      await update.mutateAsync(patch);
      toast.success('تم تحديث الإعداد');
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'settings.hr.update');
      toast.error(displayMessage);
    }
  };

  if (!companyId) {
    return (
      <SettingsPageEmpty message="لا توجد شركة افتراضية — سجّل الدخول أو اختر شركة." />
    );
  }

  if (isLoading) {
    return <SettingsPageLoading />;
  }

  if (isError || !settings) {
    const { displayMessage } = handleApiError(error, 'settings.hr.get');
    return <SettingsPageError message={displayMessage} />;
  }

  const deviceValues = {
    enforceMobileDeviceSerial: settings.enforceMobileDeviceSerial !== false,
    requireAdminApprovalForNewMobileDevice: Boolean(
      settings.requireAdminApprovalForNewMobileDevice,
    ),
    enforceWebDeviceSerial: Boolean(settings.enforceWebDeviceSerial),
    requireAdminApprovalForNewWebDevice: Boolean(settings.requireAdminApprovalForNewWebDevice),
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <Tabs defaultValue="app" dir="rtl" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-muted/50 p-1 sm:grid-cols-4">
          <TabsTrigger value="app" className={TAB_TRIGGER}>
            <Smartphone className="h-4 w-4" />
            التطبيق
          </TabsTrigger>
          <TabsTrigger value="web" className={TAB_TRIGGER}>
            <Monitor className="h-4 w-4" />
            الموقع
          </TabsTrigger>
          <TabsTrigger value="attendance" className={TAB_TRIGGER}>
            <Fingerprint className="h-4 w-4" />
            الحضور
          </TabsTrigger>
          <TabsTrigger value="notifications" className={TAB_TRIGGER}>
            <Bell className="h-4 w-4" />
            الإشعارات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="app" className="mt-4">
          <MobileSerialApprovalSettingCard
            channel="mobile"
            hideHeader
            values={deviceValues}
            disabled={update.isPending}
            onChange={(patch) => void handleSettingsPatch(patch)}
          />
        </TabsContent>

        <TabsContent value="web" className="mt-4">
          <MobileSerialApprovalSettingCard
            channel="web"
            hideHeader
            values={deviceValues}
            disabled={update.isPending}
            onChange={(patch) => void handleSettingsPatch(patch)}
          />
        </TabsContent>

        <TabsContent value="attendance" className="mt-4">
          <PunchPolicySettingCard
            hideHeader
            values={{
              enforcePunchPolicyOnServer: settings.enforcePunchPolicyOnServer !== false,
              blockEarlyCheckIn: Boolean(settings.blockEarlyCheckIn),
              lateCheckInPolicy: settings.lateCheckInPolicy ?? 'allow',
              blockEarlyCheckOut: Boolean(settings.blockEarlyCheckOut),
              allowCheckOutWithoutCheckIn: Boolean(settings.allowCheckOutWithoutCheckIn),
              allowPreviousDayCheckOut: settings.allowPreviousDayCheckOut !== false,
              openSessionMaxHours: settings.openSessionMaxHours ?? 18,
              allowPunchOnUnscheduledDay: Boolean(settings.allowPunchOnUnscheduledDay),
              requireCheckInPointsForSelfPunch:
                settings.requireCheckInPointsForSelfPunch !== false,
              minMinutesBetweenPunches: settings.minMinutesBetweenPunches ?? 1,
              singleSessionPerPeriod: Boolean(settings.singleSessionPerPeriod),
              missingCheckOutCredit: settings.missingCheckOutCredit ?? 'until_period_end',
              continuousAcrossPeriods: Boolean(settings.continuousAcrossPeriods),
            }}
            disabled={update.isPending}
            onChange={(patch) => void handleSettingsPatch(patch)}
          />
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <NotificationTogglesCard
            hideHeader
            title="إشعارات الموارد البشرية"
            description="إشعارات أحداث الموارد البشرية. أوقف التفعيل العام لإسكات بقية الإشعارات."
            groups={HR_NOTIFICATION_GROUPS}
            values={settings as Pick<HrCompanySettings, HrNotificationKey>}
            disabled={update.isPending}
            masterDisabled={!settings.notificationsEnabled}
            onToggle={(key, value) => void handleToggle(key, value)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
