'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import {
  useIsStorefrontAuthenticated,
  useStorefrontCustomerUi,
} from '@/features/ecommerce/storefront/hooks/use-storefront-customer-ui';
import { registerPartner } from '@/features/ecommerce/storefront/lib/api/partner-auth-api';
import { rememberTrustedDevice } from '@/features/ecommerce/storefront/lib/store-trusted-device';
import { PartnerAuthApiError } from '@/features/ecommerce/storefront/domain/partner-auth';
import { getStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import {
  resolveStoreAuthReturnTo,
  storeLoginHref,
  storeRegisterHref,
} from '@/features/ecommerce/storefront/lib/store-auth-return';
import { useStoreCountry } from '@/features/ecommerce/storefront/hooks/use-store-country';
import { parseStoreMobile } from '@/features/ecommerce/domain/store-mobile';
import {
  StoreMobileInput,
  useStoreMobileError,
} from '@/features/ecommerce/storefront/components/forms/store-mobile-input';
import {
  StoreEmailInput,
  storeEmailBlocker,
} from '@/features/ecommerce/storefront/components/forms/store-email-input';
import { StoreAuthShell } from '@/features/ecommerce/storefront/components/auth/store-auth-shell';
import {
  StoreAuthMethodToggle,
  type StoreAuthMethod,
} from '@/features/ecommerce/storefront/components/auth/store-auth-method-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, useRouter } from '@/i18n/navigation';
import { useStorefrontAuthReady } from '@/features/ecommerce/storefront/hooks/use-storefront-auth-ready';
import { customerErrorText } from '@/features/ecommerce/storefront/lib/customer-error';

export function StoreRegisterClient() {
  const t = useTranslations('storefront');
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = resolveStoreAuthReturnTo(searchParams.get('returnTo'));
  const authenticated = useIsStorefrontAuthenticated();
  const setSession = useStorefrontCustomerUi((s) => s.setSession);

  const [method, setMethod] = React.useState<StoreAuthMethod>('mobile');
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [mobile, setMobile] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const hydrated = useStorefrontAuthReady();
  const country = useStoreCountry();
  const mobileError = useStoreMobileError();

  React.useEffect(() => {
    if (hydrated && authenticated) {
      router.replace(returnTo);
    }
  }, [hydrated, authenticated, router, returnTo]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);

    if (name.trim().length < 2) {
      toast.error(t('register.errors.nameMin'));
      return;
    }
    let mobileE164: string | null = null;
    if (method === 'email') {
      if (!email.trim()) {
        toast.error(t('register.errors.emailRequired'));
        return;
      }
      const emailIssue = storeEmailBlocker(email);
      if (emailIssue) {
        toast.error(t(`fields.email.${emailIssue}`));
        return;
      }
    } else {
      const parsedMobile = parseStoreMobile(mobile, country);
      if (!parsedMobile.ok) {
        toast.error(mobileError(parsedMobile, country));
        return;
      }
      mobileE164 = parsedMobile.e164;
    }
    if (password.length < 6) {
      toast.error(t('register.errors.passwordMin'));
      return;
    }

    setSubmitting(true);
    try {
      const session = await registerPartner({
        companyId: getStorefrontCompanyId(),
        name: name.trim(),
        email: method === 'email' ? email.trim().toLowerCase() : null,
        mobile: method === 'mobile' ? mobileE164 : null,
        password,
        accountKind: 'customer',
      });
      setSession(session);
      rememberTrustedDevice(session);
      toast.success(session.message || t('register.success'));
      router.push(returnTo);
    } catch (error) {
      toast.error(customerErrorText(error, t('register.errors.generic')));
    } finally {
      setSubmitting(false);
    }
  }

  const checkoutReturn = returnTo.startsWith('/store/checkout');

  return (
    <StoreAuthShell
      eyebrow={t('register.eyebrow')}
      title={t('register.formTitle')}
      description={checkoutReturn ? t('register.checkoutRequiredHint') : undefined}
      tabs={{
        active: 'register',
        loginHref: storeLoginHref(returnTo),
        registerHref: storeRegisterHref(returnTo),
        loginLabel: t('authTabs.login'),
        registerLabel: t('authTabs.register'),
        ariaLabel: t('authTabs.aria'),
      }}
      footer={
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground">{t('register.hasAccount')}</p>
          <Button asChild variant="outline" className="h-11 w-full gap-2">
            <Link href={storeLoginHref(returnTo)} prefetch={false}>
              <LogIn className="h-4 w-4" aria-hidden />
              {t('register.signInCta')}
            </Link>
          </Button>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <div className="space-y-1.5">
          <Label htmlFor="store-register-name">{t('register.name')}</Label>
          <Input
            id="store-register-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
            minLength={2}
          />
        </div>
        <StoreAuthMethodToggle value={method} onChange={setMethod} />
        {method === 'email' ? (
          <div className="space-y-1.5">
            <Label htmlFor="store-register-email">{t('register.email')}</Label>
            <StoreEmailInput
              id="store-register-email"
              value={email}
              onChange={setEmail}
              showError={submitted}
              required
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="store-register-mobile">{t('register.mobile')}</Label>
            <StoreMobileInput
              id="store-register-mobile"
              value={mobile}
              onChange={setMobile}
              country={country}
              showError={submitted}
              required
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {t('register.mobileOnlyHint')}
            </p>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="store-register-password">{t('register.passwordNew')}</Label>
          <div className="relative" dir="ltr">
            <Input
              id="store-register-password"
              type={showPassword ? 'text' : 'password'}
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder={t('register.passwordPlaceholder')}
              className="pe-10"
              required
              minLength={6}
            />
            <button
              type="button"
              className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t('register.hidePassword') : t('register.showPassword')}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {t('register.passwordHint')}
          </p>
        </div>

        <Button type="submit" className="h-11 w-full" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {submitting ? t('register.submitting') : t('register.submit')}
        </Button>
      </form>
    </StoreAuthShell>
  );
}
