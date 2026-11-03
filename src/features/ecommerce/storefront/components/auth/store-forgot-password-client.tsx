'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2, MailCheck } from 'lucide-react';
import { StoreAuthShell } from '@/features/ecommerce/storefront/components/auth/store-auth-shell';
import {
  StoreEmailInput,
  storeEmailBlocker,
} from '@/features/ecommerce/storefront/components/forms/store-email-input';
import { requestPartnerPasswordReset } from '@/features/ecommerce/storefront/lib/api/partner-auth-api';
import { customerErrorText } from '@/features/ecommerce/storefront/lib/customer-error';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Link } from '@/i18n/navigation';

/**
 * Recovery by email only (2026-10-26): the store emails a link. An account
 * with a mobile only cannot be recovered here — said up front.
 */
export function StoreForgotPasswordClient() {
  const t = useTranslations('storefront');
  const [email, setEmail] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [sentMessage, setSentMessage] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    const issue = storeEmailBlocker(email);
    if (!email.trim() || issue) {
      toast.error(issue ? t(`fields.email.${issue}`) : t('forgotPassword.emailRequired'));
      return;
    }
    setSending(true);
    try {
      const result = await requestPartnerPasswordReset(email);
      setSentMessage(result.message);
    } catch (error) {
      toast.error(customerErrorText(error, t('forgotPassword.failed')));
    } finally {
      setSending(false);
    }
  }

  return (
    <StoreAuthShell
      eyebrow={t('forgotPassword.eyebrow')}
      title={t('forgotPassword.title')}
      description={t('forgotPassword.description')}
      footer={
        <Link href="/store/login" prefetch={false} className="font-medium text-primary hover:underline">
          {t('forgotPassword.backToLogin')}
        </Link>
      }
    >
      {sentMessage ? (
        <div className="rounded-2xl border border-border bg-muted/30 px-4 py-6 text-center">
          <MailCheck className="mx-auto h-8 w-8 text-primary" aria-hidden />
          <p className="mt-3 text-sm leading-relaxed text-foreground">{sentMessage}</p>
          <p className="mt-2 text-xs text-muted-foreground">{t('forgotPassword.checkSpam')}</p>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div className="space-y-1.5">
            <Label htmlFor="store-forgot-email">{t('register.email')}</Label>
            <StoreEmailInput
              id="store-forgot-email"
              value={email}
              onChange={setEmail}
              showError={submitted}
              required
            />
          </div>
          <p className="rounded-xl bg-muted/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            {t('forgotPassword.mobileOnlyNote')}
          </p>
          <Button type="submit" className="h-11 w-full" disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {sending ? t('forgotPassword.sending') : t('forgotPassword.submit')}
          </Button>
        </form>
      )}
    </StoreAuthShell>
  );
}
