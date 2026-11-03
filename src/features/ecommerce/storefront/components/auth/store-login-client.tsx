'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Smartphone, UserPlus } from 'lucide-react';
import {
  useIsStorefrontAuthenticated,
  useStorefrontCustomerUi,
} from '@/features/ecommerce/storefront/hooks/use-storefront-customer-ui';
import {
  deviceLoginPartner,
  loginPartner,
} from '@/features/ecommerce/storefront/lib/api/partner-auth-api';
import {
  forgetTrustedDevice,
  readTrustedDevice,
  rememberTrustedDevice,
  trustedDeviceEmail,
} from '@/features/ecommerce/storefront/lib/store-trusted-device';
import { useStoreTrustedDeviceLogin } from '@/features/ecommerce/storefront/hooks/use-store-trusted-device-login';
import { PartnerAuthApiError } from '@/features/ecommerce/storefront/domain/partner-auth';
import { getStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import {
  resolveStoreAuthReturnTo,
  storeLoginHref,
  storeRegisterHref,
} from '@/features/ecommerce/storefront/lib/store-auth-return';
import { useStoreCountry } from '@/features/ecommerce/storefront/hooks/use-store-country';
import { StoreAuthShell } from '@/features/ecommerce/storefront/components/auth/store-auth-shell';
import {
  StoreAuthMethodToggle,
  type StoreAuthMethod,
} from '@/features/ecommerce/storefront/components/auth/store-auth-method-toggle';
import {
  StoreMobileInput,
  useStoreMobileError,
} from '@/features/ecommerce/storefront/components/forms/store-mobile-input';
import { parseStoreMobile } from '@/features/ecommerce/domain/store-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, useRouter } from '@/i18n/navigation';
import { useStorefrontAuthReady } from '@/features/ecommerce/storefront/hooks/use-storefront-auth-ready';
import { customerErrorText } from '@/features/ecommerce/storefront/lib/customer-error';

export function StoreLoginClient() {
  const t = useTranslations('storefront');
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = resolveStoreAuthReturnTo(searchParams.get('returnTo'));
  const authenticated = useIsStorefrontAuthenticated();
  const setSession = useStorefrontCustomerUi((s) => s.setSession);

  const [method, setMethod] = React.useState<StoreAuthMethod>('mobile');
  const [identifier, setIdentifier] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const hydrated = useStorefrontAuthReady();
  const country = useStoreCountry();
  const mobileError = useStoreMobileError();
  const trustedDeviceLogin = useStoreTrustedDeviceLogin();
  const [savedDevice, setSavedDevice] = React.useState<ReturnType<typeof readTrustedDevice>>(null);

  React.useEffect(() => {
    setSavedDevice(readTrustedDevice(getStorefrontCompanyId()));
  }, []);

  // The device's key works with the email or mobile of its account (store setting on).
  const deviceMatch = React.useMemo(() => {
    if (!trustedDeviceLogin || !savedDevice) return null;
    if (method === 'email') {
      const email = trustedDeviceEmail(identifier);
      return email && email === savedDevice.email ? { identifier: email, token: savedDevice.token } : null;
    }
    const typed = parseStoreMobile(identifier, country);
    return typed.ok && typed.e164 === savedDevice.mobile
      ? { identifier: typed.e164, token: savedDevice.token }
      : null;
  }, [trustedDeviceLogin, savedDevice, method, identifier, country]);

  React.useEffect(() => {
    if (hydrated && authenticated) {
      router.replace(returnTo);
    }
  }, [hydrated, authenticated, router, returnTo]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!identifier.trim() || !password) {
      toast.error(t('login.errors.required'));
      return;
    }

    let loginId = identifier.trim();
    if (method === 'mobile') {
      // One form of the number (+967…), as sign-up stored it.
      const parsed = parseStoreMobile(loginId, country);
      if (!parsed.ok) {
        toast.error(mobileError(parsed, country));
        return;
      }
      loginId = parsed.e164;
    }

    setSubmitting(true);
    try {
      const session = await loginPartner({
        identifier: loginId,
        password,
        companyId: getStorefrontCompanyId(),
      });
      setSession(session);
      rememberTrustedDevice(session);
      toast.success(session.message || t('login.success'));
      router.push(returnTo);
    } catch (error) {
      toast.error(customerErrorText(error, t('login.errors.generic')));
    } finally {
      setSubmitting(false);
    }
  }

  async function onDeviceLogin() {
    if (!deviceMatch) return;
    setSubmitting(true);
    try {
      const session = await deviceLoginPartner({
        identifier: deviceMatch.identifier,
        deviceToken: deviceMatch.token,
      });
      setSession(session);
      toast.success(t('login.success'));
      router.push(returnTo);
    } catch (error) {
      // Revoked (password reset) or no longer trusted: the password still works.
      if (error instanceof PartnerAuthApiError && error.status === 401) {
        forgetTrustedDevice(getStorefrontCompanyId());
        setSavedDevice(null);
      }
      toast.error(customerErrorText(error, t('login.errors.generic')));
    } finally {
      setSubmitting(false);
    }
  }

  const checkoutReturn = returnTo.startsWith('/store/checkout');

  return (
    <StoreAuthShell
      eyebrow={t('login.eyebrow')}
      title={t('login.formTitle')}
      description={checkoutReturn ? t('login.checkoutRequiredHint') : undefined}
      tabs={{
        active: 'login',
        loginHref: storeLoginHref(returnTo),
        registerHref: storeRegisterHref(returnTo),
        loginLabel: t('authTabs.login'),
        registerLabel: t('authTabs.register'),
        ariaLabel: t('authTabs.aria'),
      }}
      footer={
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground">{t('login.noAccount')}</p>
          <Button asChild variant="outline" className="h-11 w-full gap-2">
            <Link href={storeRegisterHref(returnTo)} prefetch={false}>
              <UserPlus className="h-4 w-4" aria-hidden />
              {t('login.createAccountCta')}
            </Link>
          </Button>
          {!checkoutReturn ? (
            <Link
              href="/store"
              prefetch={false}
              className="text-muted-foreground hover:text-foreground hover:underline"
            >
              {t('login.continueGuest')}
            </Link>
          ) : (
            <Link
              href="/store/cart"
              prefetch={false}
              className="text-muted-foreground hover:text-foreground hover:underline"
            >
              {t('login.backToCart')}
            </Link>
          )}
        </div>
      }
    >
      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <StoreAuthMethodToggle
          value={method}
          onChange={(next) => {
            setMethod(next);
            setIdentifier('');
          }}
        />
        <div className="space-y-1.5">
          <Label htmlFor="store-login-identifier">
            {method === 'email' ? t('register.email') : t('register.mobile')}
          </Label>
          {method === 'email' ? (
            <Input
              id="store-login-identifier"
              type="email"
              dir="ltr"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="email"
              placeholder="name@example.com"
              required
            />
          ) : (
            <StoreMobileInput
              id="store-login-identifier"
              value={identifier}
              onChange={setIdentifier}
              country={country}
              showError={false}
              required
            />
          )}
        </div>

        {deviceMatch ? (
          <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t('login.deviceLoginHint')}
            </p>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full gap-2"
              disabled={submitting}
              onClick={() => void onDeviceLogin()}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Smartphone className="h-4 w-4" aria-hidden />
              )}
              {submitting ? t('login.deviceLoginSubmitting') : t('login.deviceLogin')}
            </Button>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="store-login-password">{t('login.password')}</Label>
            <Link
              href="/store/forgot-password"
              prefetch={false}
              className="text-xs text-muted-foreground hover:text-primary hover:underline"
            >
              {t('login.forgotPassword')}
            </Link>
          </div>
          <div className="relative" dir="ltr">
            <Input
              id="store-login-password"
              type={showPassword ? 'text' : 'password'}
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder={t('login.passwordPlaceholder')}
              className="pe-10"
              required
              minLength={6}
            />
            <button
              type="button"
              className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {t('login.noStoreAccount')}{' '}
            <Link
              href={storeRegisterHref(returnTo)}
              prefetch={false}
              className="font-medium text-primary hover:underline"
            >
              {t('login.createAccountInline')}
            </Link>
          </p>
        </div>

        <Button type="submit" className="h-11 w-full" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {submitting ? t('login.submitting') : t('login.submit')}
        </Button>
      </form>
    </StoreAuthShell>
  );
}
