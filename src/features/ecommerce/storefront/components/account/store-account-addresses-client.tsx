'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PartnerAuthApiError } from '@/features/ecommerce/storefront/domain/partner-auth';
import { useStorefrontCustomerUi } from '@/features/ecommerce/storefront/hooks/use-storefront-customer-ui';
import {
  createPartnerAddress,
  deletePartnerAddress,
  formatPartnerAddressLine,
  listPartnerAddresses,
  setDefaultPartnerAddress,
  updatePartnerAddress,
  type PartnerAddress,
} from '@/features/ecommerce/storefront/lib/api/partner-addresses-api';
import { storeLoginHref } from '@/features/ecommerce/storefront/lib/store-auth-return';
import { StoreEmptyState } from '@/features/ecommerce/storefront/components/store-empty-state';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogFormFooterClass,
  dialogShellBodyClass,
  dialogShellContentClass,
  dialogShellHeaderClass,
} from '@/components/ui/dialog';
import { Link, useRouter } from '@/i18n/navigation';
import { cn } from '@/shared/utils';
import { useStorefrontAuthReady } from '@/features/ecommerce/storefront/hooks/use-storefront-auth-ready';
import { useStoreCountry } from '@/features/ecommerce/storefront/hooks/use-store-country';
import { customerErrorText } from '@/features/ecommerce/storefront/lib/customer-error';
import {
  EMPTY_STORE_ADDRESS_FORM,
  StoreAddressFields,
  storeAddressIncomplete,
  storeAddressPayload,
  storeAddressToForm,
  type StoreAddressFormState,
} from '@/features/ecommerce/storefront/components/account/store-address-form';

/**
 * Customer address book for `/store/account/addresses`.
 * Writes go through PartnerAddressesService (same table as Contacts).
 */
export function StoreAccountAddressesClient() {
  const t = useTranslations('storefront');
  const router = useRouter();
  const customer = useStorefrontCustomerUi((s) => s.customer);
  const accessToken = useStorefrontCustomerUi((s) => s.accessToken);
  const clearSession = useStorefrontCustomerUi((s) => s.clearSession);
  const country = useStoreCountry();

  const hydrated = useStorefrontAuthReady();
  const [loading, setLoading] = React.useState(true);
  const [addresses, setAddresses] = React.useState<PartnerAddress[]>([]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<StoreAddressFormState>(EMPTY_STORE_ADDRESS_FORM);
  const [saving, setSaving] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);


  const handleAuthError = React.useCallback(
    (err: unknown) => {
      if (err instanceof PartnerAuthApiError && (err.status === 401 || err.status === 403)) {
        clearSession();
        router.replace(storeLoginHref('/store/account/addresses'));
        return true;
      }
      return false;
    },
    [clearSession, router],
  );

  const reload = React.useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const result = await listPartnerAddresses(accessToken, {
        partnerId: customer?.partnerId,
        companyId: customer?.companyId || undefined,
        limit: 100,
      });
      setAddresses(result.items);
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(t('account.addresses.loadFailed'));
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, customer?.companyId, customer?.partnerId, handleAuthError, t]);

  React.useEffect(() => {
    if (!hydrated) return;
    if (!customer || !accessToken) {
      router.replace(storeLoginHref('/store/account/addresses'));
      return;
    }
    void reload();
  }, [hydrated, customer, accessToken, router, reload]);

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_STORE_ADDRESS_FORM, isDefault: addresses.length === 0 });
    setDialogOpen(true);
  }

  function openEdit(address: PartnerAddress) {
    setEditingId(address.id);
    setForm(storeAddressToForm(address));
    setDialogOpen(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !customer?.partnerId) return;
    if (storeAddressIncomplete(form)) {
      toast.error(t('checkout.errors.required'));
      return;
    }

    const payload = storeAddressPayload(form, country.code, t('account.addresses.defaultLabel'));

    setSaving(true);
    try {
      if (editingId) {
        await updatePartnerAddress(accessToken, editingId, payload);
      } else {
        await createPartnerAddress(accessToken, {
          ...payload,
          partnerId: customer.partnerId,
          isDefault: form.isDefault || addresses.length === 0,
        });
      }
      setDialogOpen(false);
      setEditingId(null);
      setForm(EMPTY_STORE_ADDRESS_FORM);
      toast.success(t('account.addresses.saved'));
      await reload();
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(
        customerErrorText(err, t('account.addresses.saveFailed')),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDefault(id: string) {
    if (!accessToken) return;
    setBusyId(id);
    try {
      await setDefaultPartnerAddress(accessToken, id);
      toast.success(t('account.addresses.defaultSet'));
      await reload();
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(
        customerErrorText(err, t('account.addresses.saveFailed')),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!accessToken || !deleteTargetId) return;
    const id = deleteTargetId;
    setBusyId(id);
    try {
      await deletePartnerAddress(accessToken, id);
      setDeleteTargetId(null);
      toast.success(t('account.addresses.deleted'));
      await reload();
    } catch (err) {
      if (handleAuthError(err)) return;
      toast.error(
        customerErrorText(err, t('account.addresses.deleteFailed')),
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!hydrated || !customer || !accessToken) {
    return <div className="h-64 animate-pulse rounded-2xl bg-muted/40" />;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-arabic-display text-xl font-bold text-foreground">
            {t('account.menu.addresses')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('account.addresses.hint')}</p>
        </div>
        <Button type="button" className="shrink-0 gap-1.5" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('account.addresses.add')}
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted/40" />
          ))}
        </div>
      ) : addresses.length === 0 ? (
        <StoreEmptyState
          icon={MapPin}
          title={t('account.addresses.empty')}
          description={t('account.addresses.emptyHint')}
        >
          <Button type="button" onClick={openCreate}>
            {t('account.addresses.add')}
          </Button>
        </StoreEmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {addresses.map((address) => (
            <li
              key={address.id}
              className={cn(
                'rounded-2xl border bg-card p-4 shadow-soft',
                address.isDefault ? 'border-primary/40' : 'border-border',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">
                      {address.label || t('account.addresses.defaultLabel')}
                    </p>
                    {address.isDefault ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        <Star className="h-3 w-3" />
                        {t('account.addresses.defaultBadge')}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatPartnerAddressLine(address)}
                  </p>
                  {address.notes ? (
                    <p className="mt-1 text-xs text-muted-foreground">{address.notes}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  {!address.isDefault ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busyId === address.id}
                      onClick={() => void handleDefault(address.id)}
                    >
                      {t('account.addresses.setDefault')}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={busyId === address.id}
                    onClick={() => openEdit(address)}
                    aria-label={t('account.addresses.edit')}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="text-destructive hover:bg-destructive/5"
                    disabled={busyId === address.id}
                    onClick={() => setDeleteTargetId(address.id)}
                    aria-label={t('account.addresses.delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button type="button" variant="outline" asChild className="w-fit">
        <Link href="/store/account" prefetch={false}>
          {t('common.back')}
        </Link>
      </Button>

      <Dialog
        open={deleteTargetId != null}
        onOpenChange={(open) => {
          if (!open && busyId !== deleteTargetId) setDeleteTargetId(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('account.addresses.delete')}</DialogTitle>
            <DialogDescription>{t('account.addresses.deleteConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busyId === deleteTargetId}
              onClick={() => setDeleteTargetId(null)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busyId === deleteTargetId}
              onClick={() => void confirmDelete()}
            >
              {busyId === deleteTargetId ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {busyId === deleteTargetId ? t('account.saving') : t('account.addresses.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={cn(dialogShellContentClass, 'sm:max-w-lg')}>
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => void handleSubmit(e)}>
            <DialogHeader className={dialogShellHeaderClass}>
              <DialogTitle>
                {editingId ? t('account.addresses.edit') : t('account.addresses.add')}
              </DialogTitle>
            </DialogHeader>
            <DialogBody className={cn(dialogShellBodyClass, 'space-y-3')}>
              <StoreAddressFields form={form} setForm={setForm} />
            </DialogBody>
            <DialogFooter className={dialogFormFooterClass}>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {saving ? t('account.saving') : t('account.save')}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setDialogOpen(false)}
              >
                {t('common.back')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
