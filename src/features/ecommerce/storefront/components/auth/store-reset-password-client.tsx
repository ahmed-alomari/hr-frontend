'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { StoreAuthShell } from '@/features/ecommerce/storefront/components/auth/store-auth-shell';
import { resetPartnerPassword } from '@/features/ecommerce/storefront/lib/api/partner-auth-api';
import { customerErrorText } from '@/features/ecommerce/storefront/lib/customer-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, useRouter } from '@/i18n/navigation';

/** The page the recovery email links to: a new password, once per link. */
export function StoreResetPasswordClient() {
  const t = useTranslations('storefront');
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [show, setShow] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 6) {
      toast.error(t('register.errors.passwordMin'));
      return;
    }
    if (password !== confirm) {
      toast.error(t('resetPassword.mismatch'));
      return;
    }
    setSaving(true);
    try {
      const result = await resetPartnerPassword(token, password);
      toast.success(result.message);
      router.replace('/store/login');
    } catch (error) {
      toast.error(customerErrorText(error, t('resetPassword.failed')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <StoreAuthShell
      eyebrow={t('forgotPassword.eyebrow')}
      title={t('resetPassword.title')}
      description={t('resetPassword.description')}
      footer={
        <Link href="/store/forgot-password" prefetch={false} className="font-medium text-primary hover:underline">
          {t('resetPassword.newLink')}
        </Link>
      }
    >
      {token.length !== 64 ? (
        <p className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          {t('resetPassword.invalidLink')}
        </p>
      ) : (
        <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div className="space-y-1.5">
            <Label htmlFor="store-reset-password">{t('register.passwordNew')}</Label>
            <div className="relative" dir="ltr">
              <Input
                id="store-reset-password"
                type={show ? 'text' : 'password'}
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="pe-10"
                required
                minLength={6}
              />
              <button
                type="button"
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? t('register.hidePassword') : t('register.showPassword')}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="store-reset-confirm">{t('resetPassword.confirm')}</Label>
            <Input
              id="store-reset-confirm"
              type={show ? 'text' : 'password'}
              dir="ltr"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="h-11 w-full" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {saving ? t('resetPassword.saving') : t('resetPassword.submit')}
          </Button>
        </form>
      )}
    </StoreAuthShell>
  );
}
