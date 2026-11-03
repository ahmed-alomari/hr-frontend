'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Save,
} from 'lucide-react';
import { getStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import {
  getCmsCompanyRecord,
  saveCmsCompanyRecord,
} from '@/features/ecommerce/admin/cms/shared/cms-actions';
import {
  COMPANY_SOCIAL_NETWORKS,
  normalizeAnnouncementBar,
  normalizeSocialLinks,
  type CompanyConfigRecord,
  type CompanySocialNetwork,
} from '@/features/ecommerce/storefront/domain/company-config';
import { DEFAULT_STOREFRONT_TYPOGRAPHY } from '@/features/ecommerce/storefront/lib/storefront-fonts';
import { parseStoreMobile } from '@/features/ecommerce/domain/store-mobile';
import { ImagePicker } from '@/features/ecommerce/admin/cms/homepage/components/section-entity-pickers';
import { isEmailShape } from '@/features/ecommerce/storefront/components/forms/store-email-input';
import { useStoreMobileError } from '@/features/ecommerce/storefront/components/forms/store-mobile-input';
import { suggestEmail } from '@/shared/lib/email-typos';
import { FAVICON_MAX_EDGE, STORE_LOGO_MAX_EDGE } from '@/shared/shrink-image-file';
import { FieldLinksQrCard } from '@/features/ecommerce/admin/cms/settings/components/field-links-qr-card';
import { WebsiteColorsPanel } from '@/features/ecommerce/admin/cms/settings/components/website-colors-panel';
import { DeliveryRatesPanel } from '@/features/ecommerce/admin/delivery-rates/components/delivery-rates-panel';
import { StockSyncPanel } from '@/features/ecommerce/admin/stock/components/stock-sync-panel';
import { PaymentAccountsPanel } from '@/features/ecommerce/admin/payment-accounts/components/payment-accounts-panel';
import { CashOnDeliverySetting } from '@/features/ecommerce/admin/payment-accounts/components/cash-on-delivery-setting';
import { TrustedDeviceLoginSetting } from '@/features/ecommerce/admin/cms/settings/components/trusted-device-login-setting';
import { UnpaidOrderExpirySetting } from '@/features/ecommerce/admin/payment-accounts/components/unpaid-order-expiry-setting';
import GeoLocationsPage from '@/features/system/organization/geo/components/geo-locations-page';

import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { PageHeaderPrimaryButton } from '@/components/layouts/page-header-primary-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { OrderStagesSettingsPanel } from '@/features/ecommerce/admin/orders/components/order-stages-settings-panel';
import { cn } from '@/shared/utils';
import { STOREFRONT_SOCIAL_ICONS } from '@/features/ecommerce/storefront/components/store-social-icons';
import { APP, useCompanyApps, type AppRequirement, type CompanyApps } from '@/shared/modules/company-apps';

type SettingsTabValue =
  | 'branding'
  | 'colors'
  | 'contact'
  | 'locations'
  | 'deliveryRates'
  | 'paymentAccounts'
  | 'stockSync'
  | 'orderStages';

const SETTINGS_TAB_VALUES: readonly SettingsTabValue[] = [
  'branding',
  'colors',
  'contact',
  'locations',
  'deliveryRates',
  'paymentAccounts',
  'stockSync',
  'orderStages',
];

/** Tabs that are another app's part (same requirement as their nav item). */
const SETTINGS_TAB_APPS: Partial<Record<SettingsTabValue, AppRequirement>> = {
  stockSync: { requiresApp: APP.inventory },
};

function resolveSettingsTab(raw: string | null, apps: CompanyApps): SettingsTabValue {
  if (raw === 'checkout') return 'paymentAccounts';
  if (raw === 'social') return 'contact';
  if (raw === 'seo') return 'branding';
  const value = (SETTINGS_TAB_VALUES as readonly string[]).includes(raw ?? '')
    ? (raw as SettingsTabValue)
    : 'branding';
  // A link to a hidden tab falls back quietly.
  return apps.meets(SETTINGS_TAB_APPS[value]) ? value : 'branding';
}

const SETTINGS_QUERY_KEY = ['ecommerce-cms', 'company', 'settings'] as const;

const FIELD =
  'h-11 min-h-11 w-full min-w-0 max-w-full rounded-xl border-input bg-background px-3.5 text-sm';
const COMPACT_FIELD =
  'h-10 w-full min-w-0 max-w-full rounded-lg border-input bg-background px-3 text-sm';

function isWebUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function tabForField(key: string): SettingsTabValue {
  if (key === 'name') return 'branding';
  return 'contact';
}

function fieldKeyFromServerMessage(message: string): string | null {
  if (/contactEmail|البريد الإلكتروني|هل تقصد|Did you mean/i.test(message)) return 'email';
  if (/contactPhone|جوال|رقم الهاتف/.test(message)) return 'phone';
  for (const network of COMPANY_SOCIAL_NETWORKS) {
    if (message.includes(network)) return `social.${network}`;
  }
  if (message.includes('contactAddress')) return 'address';
  if (message.includes('storeName')) return 'name';
  if (message.includes('footerCommercialRegistration')) return 'commercialRegistration';
  return null;
}

function SettingsPanel({
  children,
  className,
  bodyClassName,
}: {
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('rounded-2xl border border-border/60 bg-card shadow-sm', className)}>
      <div className={cn('px-5 py-6 sm:px-6', bodyClassName)}>{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-[11px] leading-relaxed text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function WebsiteSettingsPage() {
  const companyId = getStorefrontCompanyId();
  const searchParams = useSearchParams();
  const t = useTranslations('ecommerceAdmin.settings');
  const tHome = useTranslations('ecommerceAdmin.homepage');
  const tCommon = useTranslations('common');
  const mobileError = useStoreMobileError();
  const queryClient = useQueryClient();
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [...SETTINGS_QUERY_KEY, companyId],
    queryFn: async () => {
      const record = await getCmsCompanyRecord(companyId);
      if (!record) throw new Error('COMPANY_NOT_FOUND');
      return {
        ...record,
        social: normalizeSocialLinks(record.social),
        announcement: normalizeAnnouncementBar(record.announcement),
        typography: record.typography ?? { ...DEFAULT_STOREFRONT_TYPOGRAPHY },
        footer: {
          ...record.footer,
          tagline: record.footer.tagline ?? { ar: '', en: '' },
        },
        storePages: {
          offers: record.storePages?.offers !== false,
          wholesale: record.storePages?.wholesale !== false,
        },
        seo: {
          ...record.seo,
          keywords: record.seo.keywords ?? [],
        },
      } satisfies CompanyConfigRecord;
    },
  });

  const [draft, setDraft] = React.useState<CompanyConfigRecord | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const apps = useCompanyApps();
  const [tab, setTab] = React.useState<SettingsTabValue>(() =>
    resolveSettingsTab(searchParams.get('tab'), apps),
  );
  const [tabHeaderExtras, setTabHeaderExtras] = React.useState<React.ReactNode>(null);

  React.useEffect(() => {
    setTab(resolveSettingsTab(searchParams.get('tab'), apps));
  }, [searchParams, apps]);

  React.useEffect(() => {
    if (data) {
      setDraft(structuredClone(data));
      setDirty(false);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async (companyInput: CompanyConfigRecord) =>
      saveCmsCompanyRecord({
        ...companyInput,
        social: normalizeSocialLinks(companyInput.social),
        announcement: normalizeAnnouncementBar(companyInput.announcement),
        seo: {
          ...companyInput.seo,
          keywords: (companyInput.seo.keywords ?? []).map((keyword) => keyword.trim()).filter(Boolean),
        },
      }),
    onSuccess: (company) => {
      queryClient.setQueryData([...SETTINGS_QUERY_KEY, companyId], {
        ...company,
        social: normalizeSocialLinks(company.social),
        announcement: normalizeAnnouncementBar(company.announcement),
        seo: { ...company.seo, keywords: company.seo.keywords ?? [] },
      });
      void queryClient.invalidateQueries({ queryKey: ['ecommerce-cms', 'company'] });
      setDraft({
        ...company,
        social: normalizeSocialLinks(company.social),
        announcement: normalizeAnnouncementBar(company.announcement),
        seo: { ...company.seo, keywords: company.seo.keywords ?? [] },
      });
      setDirty(false);
      setFieldErrors({});
      toast.success(t('saveSuccess'));
    },
    onError: (error) => {
      const message =
        error instanceof Error && error.message.trim() ? error.message : t('saveError');
      const key = fieldKeyFromServerMessage(message);
      if (!key) {
        toast.error(message);
        return;
      }
      setFieldErrors({
        [key]: key.startsWith('social.') ? t('socialUrlInvalid') : message,
      });
      setTab(tabForField(key));
    },
  });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        {tabHeaderExtras}
        <PageHeaderPrimaryButton
          icon={Save}
          label={save.isPending ? tCommon('status.saving') : tCommon('actions.save')}
          disabled={!draft || save.isPending || !dirty}
          loading={save.isPending}
          onClick={() => {
            if (!draft) return;
            const errors = collectFieldErrors(draft);
            setFieldErrors(errors);
            const first = Object.keys(errors)[0];
            if (first) {
              setTab(tabForField(first));
              return;
            }
            void save.mutateAsync(draft);
          }}
        />
      </div>
    ),
    [draft, dirty, save.isPending, tCommon, tabHeaderExtras],
  );

  function updateDraft(next: CompanyConfigRecord) {
    setDraft(next);
    setDirty(true);
  }

  function dropError(key: string) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function collectFieldErrors(record: CompanyConfigRecord): Record<string, string> {
    const errors: Record<string, string> = {};
    const phone = record.contact.phone?.trim() ?? '';
    if (phone) {
      const message = mobileError(parseStoreMobile(phone, record.country), record.country);
      if (message) errors.phone = message;
    }
    const email = record.contact.email?.trim() ?? '';
    if (email.length > 255) {
      errors.email = t('tooLong', { max: 255 });
    } else if (email && !isEmailShape(email)) {
      errors.email = t('emailInvalid');
    } else if (email) {
      const suggestion = suggestEmail(email.toLowerCase());
      if (suggestion) errors.email = t('emailTypo', { suggestion });
    }
    if (record.name.ar.trim().length > 255) {
      errors.name = t('tooLong', { max: 255 });
    }
    const registration = record.footer.commercialRegistration?.trim() ?? '';
    if (registration.length > 120) {
      errors.commercialRegistration = t('tooLong', { max: 120 });
    }
    for (const network of COMPANY_SOCIAL_NETWORKS) {
      const url = record.social[network]?.url?.trim() ?? '';
      if (!url) continue;
      if (url.length > 500 || !isWebUrl(url)) errors[`social.${network}`] = t('socialUrlInvalid');
    }
    return errors;
  }

  function patchSocial(network: CompanySocialNetwork, patch: { url?: string; enabled?: boolean }) {
    if (!draft) return;
    const current = draft.social[network] ?? { url: '', enabled: false };
    const nextUrl = patch.url ?? current.url;
    const hadUrl = Boolean(current.url.trim());
    const hasUrl = Boolean(nextUrl.trim());
    const nextEnabled =
      patch.enabled !== undefined
        ? patch.enabled
        : hadUrl === hasUrl
          ? current.enabled
          : hasUrl;
    updateDraft({
      ...draft,
      social: {
        ...draft.social,
        [network]: {
          url: nextUrl,
          // Enabling without a URL is a no-op on the storefront — keep UX honest.
          enabled: nextEnabled && Boolean(nextUrl.trim()),
        },
      },
    });
  }

  const activeTabMeta: { title: string; description: string } = (() => {
    switch (tab) {
      case 'branding':
        return { title: t('tabs.branding'), description: t('brandingHint') };
      case 'colors':
        return { title: t('tabs.colors'), description: t('colorsHint') };
      case 'contact':
        return { title: t('tabs.contact'), description: t('contactHint') };
      case 'locations':
        return { title: t('tabs.locations'), description: t('locationsHint') };
      case 'deliveryRates':
        return { title: t('tabs.deliveryRates'), description: t('deliveryRatesHint') };
      case 'paymentAccounts':
        return { title: t('tabs.paymentAccounts'), description: t('paymentAccountsHint') };
      case 'stockSync':
        return { title: t('tabs.stockSync'), description: t('stockSyncHint') };
      case 'orderStages':
        return { title: t('tabs.orderStages'), description: t('orderStagesHint') };
    }
  })();

  return (
    <div className="flex flex-col gap-5">
      <SetPageTitle
        titleAr={activeTabMeta.title}
        descriptionAr={activeTabMeta.description}
        iconName="Settings"
      />

      {dirty ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-3.5 py-2.5 text-xs text-warning">
          {tHome('unsavedHint')}
        </div>
      ) : null}

      {isLoading ? (
        <div className="space-y-3">
          <div className="h-11 w-full max-w-xl animate-pulse rounded-xl bg-muted/50" />
          <div className="h-64 animate-pulse rounded-2xl bg-muted/40" />
        </div>
      ) : null}

      {isError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-4">
          <p className="text-sm text-destructive">{t('loadError')}</p>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => void refetch()}>
            {tCommon('actions.retry')}
          </Button>
        </div>
      ) : null}

      {draft ? (
        <Tabs value={tab} onValueChange={(v) => setTab(v as SettingsTabValue)} className="w-full">
          <TabsContent value="branding" className="mt-4">
            <SettingsPanel>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t('name')} error={fieldErrors.name} className="sm:col-span-2">
                  <Input
                    className={cn(FIELD, fieldErrors.name && 'border-destructive')}
                    aria-invalid={Boolean(fieldErrors.name)}
                    value={draft.name.ar}
                    onChange={(event) => {
                      const value = event.target.value;
                      dropError('name');
                      updateDraft({ ...draft, name: { ar: value, en: value } });
                    }}
                  />
                </Field>
                <Field label={t('logo')} hint={t('logoHint')}>
                  <ImagePicker
                    value={draft.logoUrl}
                    maxEdge={STORE_LOGO_MAX_EDGE}
                    onChange={(logoUrl) => updateDraft({ ...draft, logoUrl })}
                  />
                </Field>
                <Field label={t('favicon')} hint={t('faviconHint')}>
                  <ImagePicker
                    value={draft.faviconUrl}
                    maxEdge={FAVICON_MAX_EDGE}
                    onChange={(faviconUrl) => updateDraft({ ...draft, faviconUrl })}
                  />
                </Field>
              </div>
              <div className="mt-5">
                <TrustedDeviceLoginSetting companyId={companyId} />
              </div>
            </SettingsPanel>
          </TabsContent>

          <TabsContent value="colors" className="mt-4">
            <WebsiteColorsPanel
              theme={draft.theme}
              typography={draft.typography ?? { ...DEFAULT_STOREFRONT_TYPOGRAPHY }}
              onChange={({ theme, typography }) => updateDraft({ ...draft, theme, typography })}
            />
          </TabsContent>

          <TabsContent value="contact" className="mt-4">
            <SettingsPanel>
              {/* Short values in one row; only the address is long (2026-10-27). */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_14rem]">
                <Field label={t('phone')} error={fieldErrors.phone}>
                  <Input
                    dir="ltr"
                    inputMode="tel"
                    className={cn(COMPACT_FIELD, 'text-right', fieldErrors.phone && 'border-destructive')}
                    aria-invalid={Boolean(fieldErrors.phone)}
                    value={draft.contact.phone ?? ''}
                    onChange={(event) => {
                      dropError('phone');
                      updateDraft({
                        ...draft,
                        contact: { ...draft.contact, phone: event.target.value },
                      });
                    }}
                  />
                </Field>
                <Field label={t('email')} error={fieldErrors.email}>
                  <Input
                    dir="ltr"
                    type="email"
                    className={cn(COMPACT_FIELD, 'text-right', fieldErrors.email && 'border-destructive')}
                    aria-invalid={Boolean(fieldErrors.email)}
                    value={draft.contact.email ?? ''}
                    onChange={(event) => {
                      dropError('email');
                      updateDraft({
                        ...draft,
                        contact: { ...draft.contact, email: event.target.value },
                      });
                    }}
                  />
                </Field>
                <Field label={t('commercialRegistration')} error={fieldErrors.commercialRegistration}>
                  <Input
                    dir="ltr"
                    className={cn(
                      COMPACT_FIELD,
                      'text-right',
                      fieldErrors.commercialRegistration && 'border-destructive',
                    )}
                    aria-invalid={Boolean(fieldErrors.commercialRegistration)}
                    title={t('commercialRegistrationHint')}
                    value={draft.footer.commercialRegistration ?? ''}
                    onChange={(event) => {
                      dropError('commercialRegistration');
                      updateDraft({
                        ...draft,
                        footer: {
                          ...draft.footer,
                          commercialRegistration: event.target.value || undefined,
                        },
                      });
                    }}
                  />
                </Field>
                <Field label={t('address')} error={fieldErrors.address} className="sm:col-span-2 lg:col-span-3">
                  <Input
                    className={cn(COMPACT_FIELD, fieldErrors.address && 'border-destructive')}
                    aria-invalid={Boolean(fieldErrors.address)}
                    value={draft.contact.address ?? ''}
                    onChange={(event) => {
                      dropError('address');
                      updateDraft({
                        ...draft,
                        contact: { ...draft.contact, address: event.target.value },
                      });
                    }}
                  />
                </Field>
              </div>

              {/* One line per network: its icon, the link, a switch. A link shows it. */}
              <div className="mt-6 border-t border-border/60 pt-5">
                <p className="mb-3 text-sm font-medium text-foreground">{t('social')}</p>
                <div className="divide-y divide-border/60 rounded-xl border border-border/60">
                  {COMPANY_SOCIAL_NETWORKS.map((network) => {
                    const entry = draft.social[network] ?? { url: '', enabled: false };
                    const Icon = STOREFRONT_SOCIAL_ICONS[network];
                    const error = fieldErrors[`social.${network}`];
                    return (
                      <div key={network} className="px-3 py-2">
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              'flex w-28 shrink-0 items-center gap-2 text-sm',
                              entry.enabled ? 'text-foreground' : 'text-muted-foreground',
                            )}
                          >
                            {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
                            <span className="truncate">{t(network)}</span>
                          </span>
                          <Input
                            dir="ltr"
                            className={cn(
                              'h-9 min-w-0 flex-1 rounded-lg border-input bg-background px-3 text-sm',
                              error && 'border-destructive',
                            )}
                            aria-label={t(network)}
                            aria-invalid={Boolean(error)}
                            placeholder={t('socialUrlPlaceholder')}
                            value={entry.url}
                            onChange={(event) => {
                              dropError(`social.${network}`);
                              patchSocial(network, { url: event.target.value });
                            }}
                          />
                          <Switch
                            checked={entry.enabled}
                            disabled={!entry.url.trim()}
                            aria-label={entry.enabled ? t('socialEnabled') : t('socialDisabled')}
                            title={entry.enabled ? t('socialEnabled') : t('socialDisabled')}
                            onCheckedChange={(enabled) => patchSocial(network, { enabled })}
                          />
                        </div>
                        {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
              <FieldLinksQrCard />
            </SettingsPanel>
          </TabsContent>

          <TabsContent value="locations" className="mt-4">
            <SettingsPanel>
              <GeoLocationsPage
                embedded
                companyId={companyId}
                onHeaderExtrasChange={setTabHeaderExtras}
              />
            </SettingsPanel>
          </TabsContent>

          <TabsContent value="deliveryRates" className="mt-4">
            <SettingsPanel>
              <DeliveryRatesPanel
                companyId={companyId}
                currencyCode={draft.currency}
                onHeaderExtrasChange={setTabHeaderExtras}
              />
            </SettingsPanel>
          </TabsContent>

          <TabsContent value="paymentAccounts" className="mt-4">
            <SettingsPanel>
              <div className="mb-4 space-y-3">
                <CashOnDeliverySetting companyId={companyId} />
                <UnpaidOrderExpirySetting companyId={companyId} />
              </div>
              <PaymentAccountsPanel
                companyId={companyId}
                currencyCode={draft.currency}
                onHeaderExtrasChange={setTabHeaderExtras}
              />
            </SettingsPanel>
          </TabsContent>

          <TabsContent value="stockSync" className="mt-4">
            <SettingsPanel>
              <StockSyncPanel companyId={companyId} onHeaderExtrasChange={setTabHeaderExtras} />
            </SettingsPanel>
          </TabsContent>

          <TabsContent value="orderStages" className="mt-4">
            <SettingsPanel>
              <OrderStagesSettingsPanel companyId={companyId} />
            </SettingsPanel>
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}
