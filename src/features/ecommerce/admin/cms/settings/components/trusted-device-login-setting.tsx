'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { useCan } from '@/features/auth/hooks/use-can';
import { resolveStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import { apiRequest } from '@/features/hr/lib/api/client';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';

const settingsPath = (companyId: string) =>
  `/store-admin/companies/${resolveStorefrontCompanyId(companyId)}/settings`;

const queryKey = (companyId: string) => ['store-admin', 'trusted-device-login', companyId] as const;

/**
 * Trusted-device sign-in (off by default): a customer signs in with the
 * mobile alone from the device they signed up or last signed in on with the
 * password. Off stops it and keeps the saved devices.
 */
export function TrustedDeviceLoginSetting({ companyId }: { companyId: string }) {
  const can = useCan();
  const canUpdate = can('sta.settings.update');
  const queryClient = useQueryClient();

  const setting = useQuery({
    queryKey: queryKey(companyId),
    queryFn: async () => {
      const settings = await apiRequest<{ trustedDeviceLoginEnabled?: boolean }>(
        settingsPath(companyId),
        { throwOnError: true },
      );
      return settings?.trustedDeviceLoginEnabled === true;
    },
    enabled: Boolean(companyId),
  });

  const update = useMutation({
    mutationFn: (enabled: boolean) =>
      apiRequest(settingsPath(companyId), {
        method: 'PATCH',
        throwOnError: true,
        body: { trustedDeviceLoginEnabled: enabled },
      }),
    onSuccess: (_data, enabled) => {
      queryClient.setQueryData(queryKey(companyId), enabled);
      toast.success(
        enabled ? 'تم تفعيل الدخول من الجهاز الموثوق' : 'تم إيقاف الدخول من الجهاز الموثوق',
      );
    },
    onError: (error) => handleApiError(error, 'ecommerce.settings.trustedDeviceLogin'),
  });

  return (
    <div className="space-y-2 rounded-xl border border-border/60 bg-muted/15 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">الدخول من الجهاز الموثوق</p>
          <p className="text-xs text-muted-foreground">
            يدخل العميل برقم جواله دون كلمة المرور من الجهاز الذي أنشأ منه حسابه أو دخل منه بكلمة
            المرور. تعيين كلمة مرور جديدة يلغي الأجهزة الموثوقة.
          </p>
        </div>
        <Switch
          checked={setting.data === true}
          disabled={!canUpdate || setting.isLoading || update.isPending}
          onCheckedChange={(next) => update.mutate(next)}
          aria-label="الدخول من الجهاز الموثوق"
        />
      </div>
      {setting.isError ? (
        <p className="text-xs text-destructive">تعذّر تحميل الإعداد. أعد تحميل الصفحة.</p>
      ) : null}
    </div>
  );
}
