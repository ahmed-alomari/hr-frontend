'use client';

import * as React from 'react';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { formatPrice as formatMoney } from '@/features/ecommerce/shared/utils/format-price';
import { useLocale, useTranslations } from 'next-intl';
import {
  AlertCircle,
  Banknote,
  Building2,
  Check,
  ChevronLeft,
  CreditCard,
  FileText,
  Loader2,
  MapPin,
  MoreHorizontal,
  PackageSearch,
  Paperclip,
  Plus,
  QrCode,
  Share2,
  ShieldCheck,
  Truck,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  CheckoutAddressInput,
  CheckoutPaymentMethod,
} from '@/features/ecommerce/storefront/domain/checkout';
import { paymentMethodRequiresAccount } from '@/features/ecommerce/storefront/domain/checkout';
import { ALL_CHECKOUT_PAYMENT_METHODS } from '@/features/ecommerce/storefront/domain/company-config';
import { fetchPublicShippingQuote } from '@/features/ecommerce/admin/delivery-rates/lib/api/public-shipping-quote-api';
import {
  fetchPublicPaymentAccounts,
  type PublicPaymentAccount,
} from '@/features/ecommerce/admin/payment-accounts/lib/api/public-payment-accounts-api';
import type { PaymentAccountType } from '@/features/ecommerce/admin/payment-accounts/lib/api/payment-accounts-api';
import { placeStorefrontOrder } from '@/features/ecommerce/storefront/lib/checkout-actions';
import { checkoutAttemptKey } from '@/features/ecommerce/storefront/lib/checkout-attempt-key';
import { PartnerAuthApiError } from '@/features/ecommerce/storefront/domain/partner-auth';
import {
  createPartnerAddress,
  formatPartnerAddressLine,
  listPartnerAddresses,
  type PartnerAddress,
} from '@/features/ecommerce/storefront/lib/api/partner-addresses-api';
import { useStorefrontCartProducts } from '@/features/ecommerce/storefront/hooks/use-storefront-cart-products';
import { useStorefrontCartUi } from '@/features/ecommerce/storefront/hooks/use-storefront-cart-ui';
import { useStorefrontCustomerUi } from '@/features/ecommerce/storefront/hooks/use-storefront-customer-ui';
import { buildProductDisplay, resolveDiscountPercent, resolveLineCompareAtPrice, resolveLineUnitPrice } from '@/features/ecommerce/storefront/lib/product-display';
import { ProductGridSkeleton } from '@/features/ecommerce/storefront/components/catalog/loading-skeleton';
import { StoreErrorState } from '@/features/ecommerce/storefront/components/catalog/store-error-state';
import { StoreEmptyState } from '@/features/ecommerce/storefront/components/store-empty-state';
import {
  MAX_PAYMENT_PROOF_BYTES,
  MAX_PAYMENT_PROOF_FILES,
} from '@/features/ecommerce/domain/lib/payment-proofs';
import {
  MAX_ORDER_ATTACHMENTS,
  MAX_ORDER_ATTACHMENT_BYTES,
  ORDER_ATTACHMENT_ACCEPT,
  OrderAttachmentError,
  fileToOrderAttachment,
  isImageMime,
  uploadStoreOrderFile,
} from '@/features/ecommerce/domain/lib/order-attachments';
import type { CreateStoreOrderAttachmentInput } from '@/features/ecommerce/domain/types/order';
import { Button } from '@/components/ui/button';
import type { StoreCountry } from '@/features/ecommerce/domain/constants/store-country';
import { parseStoreMobile } from '@/features/ecommerce/domain/store-mobile';
import {
  StoreMobileInput,
  useStoreMobileError,
} from '@/features/ecommerce/storefront/components/forms/store-mobile-input';
import {
  readCheckoutGuest,
  writeCheckoutGuest,
} from '@/features/ecommerce/storefront/lib/checkout-guest';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { storeLoginHref, storeRegisterHref } from '@/features/ecommerce/storefront/lib/store-auth-return';
import { useStorefrontCompanyId } from '@/features/ecommerce/storefront/components/storefront-company-provider';
import { STORE_CURRENCY_MISMATCH_ERROR } from '@/features/ecommerce/domain/constants/store-currency';
import {
  STORE_COUNTRY_UNAVAILABLE_ERROR,
  STORE_INVENTORY_UNAVAILABLE_ERROR,
  STORE_STOCK_SHORT_ERROR,
} from '@/features/ecommerce/domain/constants/store-checkout-errors';
import { usePublicGeoCountries } from '@/features/system/organization/geo/hooks/use-geo';
import { Link, useRouter } from '@/i18n/navigation';
import { cn } from '@/shared/utils';
import type { StorefrontLocale } from '@/i18n/routing';
import { customerErrorText } from '@/features/ecommerce/storefront/lib/customer-error';
import {
  checkPublicStoreOrder,
  type StoreOrderCheckIssue,
} from '@/features/ecommerce/shared/lib/api/store-orders-api';
import { useStoreCartCheck } from '@/features/ecommerce/storefront/hooks/use-store-cart-check';
import {
  EMPTY_STORE_ADDRESS_FORM,
  StoreAddressFields,
  storeAddressIncomplete,
  storeAddressPayload,
  type StoreAddressFormState,
} from '@/features/ecommerce/storefront/components/account/store-address-form';

type StepId = 'address' | 'payment' | 'review';

const STEPS: { id: StepId; icon: typeof MapPin }[] = [
  { id: 'address', icon: MapPin },
  { id: 'payment', icon: Wallet },
  { id: 'review', icon: ShieldCheck },
];

const PAYMENT_METHOD_ICONS: Record<CheckoutPaymentMethod, LucideIcon> = {
  cash_on_delivery: Truck,
  cash: Banknote,
  bank: Building2,
  network: Share2,
  wallet: Wallet,
  card: CreditCard,
  other: MoreHorizontal,
};

function paymentAccountDisplayName(
  account: PublicPaymentAccount,
  locale: StorefrontLocale,
): string {
  return locale === 'en' && account.nameEn ? account.nameEn : account.nameAr;
}

function paymentAccountDetailsLine(account: PublicPaymentAccount): string {
  const number =
    account.accountNumber?.trim() || account.iban?.trim() || account.mobile?.trim() || '';
  return [account.providerName, account.accountHolderName, number].filter(Boolean).join(' · ');
}

type CheckoutClientProps = {
  currency: string;
  /**
   * The company's base country: the store delivers there only (the country is
   * shown, not chosen), and its mobile rule checks the phone.
   */
  country: StoreCountry;
};

export function StoreCheckoutClient({ currency: storeCurrency, country }: CheckoutClientProps) {
  const t = useTranslations('storefront');
  const countryCode = country.code;
  const mobileError = useStoreMobileError();
  const locale = useLocale() as StorefrontLocale;
  const router = useRouter();
  const lines = useStorefrontCartUi((s) => s.lines);
  const clearCart = useStorefrontCartUi((s) => s.clear);
  const accessToken = useStorefrontCustomerUi((s) => s.accessToken);
  const customer = useStorefrontCustomerUi((s) => s.customer);
  const clearSession = useStorefrontCustomerUi((s) => s.clearSession);
  const { data: products, isLoading, isError, refetch } = useStorefrontCartProducts();
  const [authReady, setAuthReady] = React.useState(false);

  React.useEffect(() => {
    const finish = () => setAuthReady(true);
    const unsub = useStorefrontCustomerUi.persist.onFinishHydration(finish);
    if (useStorefrontCustomerUi.persist.hasHydrated()) finish();
    return unsub;
  }, []);

  const companyId = useStorefrontCompanyId();
  const { data: geoCountries = [], isFetched: geoCountriesFetched } = usePublicGeoCountries(
    companyId,
    Boolean(companyId),
  );

  const allPaymentAccountsQuery = useQuery({
    queryKey: ['public', 'store', 'payment-accounts', companyId, 'all'],
    queryFn: () => fetchPublicPaymentAccounts({ companyId }),
    enabled: Boolean(companyId),
  });

  // Payment method options come solely from published payment accounts.
  const paymentMethods = React.useMemo(() => {
    const enabled = new Set<CheckoutPaymentMethod>();
    for (const account of allPaymentAccountsQuery.data ?? []) {
      enabled.add(account.type as CheckoutPaymentMethod);
    }
    return ALL_CHECKOUT_PAYMENT_METHODS.filter((method) => enabled.has(method));
  }, [allPaymentAccountsQuery.data]);

  const [step, setStep] = React.useState<StepId>('address');
  // «عابر سبيل» (2026-10-26): one order without an account, by mobile; the
  // store reaches the customer on that number. This tab only.
  const [guest, setGuestState] = React.useState(() => readCheckoutGuest());
  const setGuest = (value: boolean) => {
    writeCheckoutGuest(value);
    setGuestState(value);
  };
  const [address, setAddress] = React.useState<CheckoutAddressInput>(() => ({
    fullName: '',
    phone: '',
    countryId: null,
    cityId: null,
    districtId: null,
    city: '',
    district: '',
    street: '',
    notes: '',
  }));

  // Keep countryId inside the store's public geo list (showInStore). Saved addresses
  // often carry a catalog country the order API then rejects.
  React.useEffect(() => {
    if (!geoCountriesFetched) return;
    const allowed = new Set(geoCountries.map((row) => row.id));
    // The store's country; the first published one when its code is not set up.
    const fallback =
      geoCountries.find((row) => row.code?.toUpperCase() === countryCode.toUpperCase())?.id ??
      geoCountries[0]?.id ??
      null;
    setAddress((prev) => {
      if (prev.countryId && allowed.has(prev.countryId)) return prev;
      if (prev.countryId === fallback) return prev;
      return {
        ...prev,
        countryId: fallback,
        cityId: prev.countryId && !allowed.has(prev.countryId) ? null : prev.cityId,
        districtId: prev.countryId && !allowed.has(prev.countryId) ? null : prev.districtId,
      };
    });
  }, [geoCountriesFetched, geoCountries, countryCode]);
  const [customerNote, setCustomerNote] = React.useState('');
  const [paymentMethod, setPaymentMethod] = React.useState<CheckoutPaymentMethod>('cash');
  const [paymentAccountId, setPaymentAccountId] = React.useState<string | null>(null);
  const [paymentProofs, setPaymentProofs] = React.useState<Array<{ url: string; name: string }>>(
    [],
  );

  const accountTypeFilter = paymentMethod as PaymentAccountType;

  const paymentAccounts = React.useMemo(() => {
    const items = allPaymentAccountsQuery.data ?? [];
    return items.filter((row) => row.type === accountTypeFilter);
  }, [allPaymentAccountsQuery.data, accountTypeFilter]);

  React.useEffect(() => {
    if (paymentMethods.length === 0) return;
    if (!paymentMethods.includes(paymentMethod)) {
      setPaymentMethod(paymentMethods[0]!);
    }
  }, [paymentMethods, paymentMethod]);

  const selectedPaymentAccount =
    paymentAccounts.find((row) => row.id === paymentAccountId) ?? null;
  const selectedAccountName = selectedPaymentAccount
    ? paymentAccountDisplayName(selectedPaymentAccount, locale)
    : null;
  const selectedAccountDetails = selectedPaymentAccount
    ? paymentAccountDetailsLine(selectedPaymentAccount)
    : '';
  const cashLikePayment =
    paymentMethod === 'cash_on_delivery' || paymentMethod === 'cash';
  const showPaymentAccounts = !cashLikePayment || paymentAccounts.length > 1;
  const showPaymentProof = !cashLikePayment;

  React.useEffect(() => {
    if (paymentAccounts.length === 0) {
      setPaymentAccountId(null);
      return;
    }
    setPaymentAccountId((current) => {
      if (current && paymentAccounts.some((row) => row.id === current)) return current;
      return paymentAccounts.length === 1 ? paymentAccounts[0]!.id : null;
    });
  }, [paymentMethod, paymentAccounts]);
  const [orderAttachments, setOrderAttachments] = React.useState<CreateStoreOrderAttachmentInput[]>(
    [],
  );
  const [attachmentsBusy, setAttachmentsBusy] = React.useState(false);
  /** A receipt is uploading: the order waits for it (A3). */
  const [proofsBusy, setProofsBusy] = React.useState(false);
  const filesUploading = attachmentsBusy || proofsBusy;
  const [submitting, setSubmitting] = React.useState(false);
  const [addressErrors, setAddressErrors] = React.useState<
    Partial<Record<keyof CheckoutAddressInput, string>>
  >({});
  const [savedAddresses, setSavedAddresses] = React.useState<PartnerAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = React.useState(false);
  const [addressesError, setAddressesError] = React.useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = React.useState<string | null>(null);
  // The address book form, opened by «+» (same form as the account page).
  const [addingAddress, setAddingAddress] = React.useState(false);
  const [newAddress, setNewAddress] = React.useState<StoreAddressFormState>(
    EMPTY_STORE_ADDRESS_FORM,
  );
  const [savingAddress, setSavingAddress] = React.useState(false);
  // Problems found by the server (cart lines from the start; the whole
  // order before payment and before the review).
  const cartCheck = useStoreCartCheck();
  const [orderIssues, setOrderIssues] = React.useState<StoreOrderCheckIssue[]>([]);
  const [verifying, setVerifying] = React.useState(false);
  const appliedDefaultAddressRef = React.useRef(false);

  React.useEffect(() => {
    if (!authReady) return;
    if (accessToken || guest) return;
    router.replace(storeLoginHref('/store/checkout'));
  }, [authReady, accessToken, guest, router]);

  React.useEffect(() => {
    if (!customer) return;
    setAddress((prev) => ({
      ...prev,
      fullName: customer.name?.trim() || prev.fullName,
      phone: customer.phone?.trim() || prev.phone,
    }));
  }, [customer]);

  const loadSavedAddresses = React.useCallback(async () => {
    if (!accessToken) return;
    setAddressesLoading(true);
    setAddressesError(null);
    try {
      const result = await listPartnerAddresses(accessToken, {
        partnerId: customer?.partnerId,
        companyId: customer?.companyId || undefined,
        limit: 100,
      });
      const sorted = [...result.items].sort((a, b) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        const rank = (type: string) => (type === 'shipping' ? 0 : type === 'main' ? 1 : 2);
        return rank(a.addressType) - rank(b.addressType);
      });
      setSavedAddresses(sorted);
      if (!appliedDefaultAddressRef.current && sorted.length > 0) {
        const preferred = sorted.find((item) => item.isDefault) ?? sorted[0]!;
        appliedDefaultAddressRef.current = true;
        setSelectedAddressId(preferred.id);
        setAddress((prev) => ({
          ...prev,
          fullName: customer?.name?.trim() || prev.fullName,
          phone: customer?.phone?.trim() || prev.phone,
          countryId: preferred.countryId ?? null,
          cityId: preferred.cityId ?? null,
          districtId: preferred.districtId ?? null,
          city: preferred.city?.trim() || prev.city,
          district: preferred.district?.trim() || '',
          street: [preferred.street?.trim(), preferred.building?.trim()]
            .filter(Boolean)
            .join('، '),
          notes: preferred.notes?.trim() || '',
          lat: preferred.latitude != null ? Number(preferred.latitude) : undefined,
          lng: preferred.longitude != null ? Number(preferred.longitude) : undefined,
        }));
      }
    } catch (err) {
      if (err instanceof PartnerAuthApiError && (err.status === 401 || err.status === 403)) {
        clearSession();
        router.replace(storeLoginHref('/store/checkout'));
        return;
      }
      setSavedAddresses([]);
      setAddressesError(t('checkout.addressesLoadFailed'));
    } finally {
      setAddressesLoading(false);
    }
  }, [accessToken, clearSession, customer, router, t]);

  React.useEffect(() => {
    if (!authReady || !accessToken) return;
    void loadSavedAddresses();
  }, [authReady, accessToken, loadSavedAddresses]);

  function rowToAddress(row: PartnerAddress, prev: CheckoutAddressInput): CheckoutAddressInput {
    return {
      ...prev,
      fullName: customer?.name?.trim() || prev.fullName,
      phone: customer?.phone?.trim() || prev.phone,
      countryId: row.countryId ?? null,
      cityId: row.cityId ?? null,
      districtId: row.districtId ?? null,
      city: row.city?.trim() || prev.city,
      district: row.district?.trim() || '',
      street: [row.street?.trim(), row.building?.trim()].filter(Boolean).join('، '),
      notes: row.notes?.trim() || '',
      lat: row.latitude != null ? Number(row.latitude) : undefined,
      lng: row.longitude != null ? Number(row.longitude) : undefined,
      mapAddress: undefined,
    };
  }

  /** A typed (not saved) address: the guest's. */
  function formToAddress(
    form: StoreAddressFormState,
    prev: CheckoutAddressInput,
  ): CheckoutAddressInput {
    return {
      ...prev,
      countryId: form.countryId,
      cityId: form.cityId,
      districtId: form.districtId,
      city: form.city.trim(),
      district: form.district.trim(),
      street: [form.street.trim(), form.building.trim()].filter(Boolean).join('، '),
      notes: form.notes.trim(),
      lat: form.latitude ?? undefined,
      lng: form.longitude ?? undefined,
      mapAddress: form.mapAddress || undefined,
    };
  }

  function applySavedAddress(row: PartnerAddress) {
    setSelectedAddressId(row.id);
    setAddressErrors({});
    setAddress((prev) => rowToAddress(row, prev));
  }

  /** The address as the order sends it (profile name, one form of the phone). */
  function orderAddressOf(base: CheckoutAddressInput): CheckoutAddressInput {
    const raw = (customer?.phone?.trim() || base.phone).trim();
    const parsed = parseStoreMobile(raw, country);
    return {
      ...base,
      fullName: (customer?.name?.trim() || base.fullName).trim(),
      phone: parsed.ok ? parsed.e164 : raw,
    };
  }

  /**
   * Tries the whole order on the server before the next step (nothing is
   * written): with the address before payment, with the payment account
   * before the review. The last step then does not fail.
   */
  async function verifyOrder(
    stage: 'address' | 'payment',
    base: CheckoutAddressInput,
  ): Promise<boolean> {
    setVerifying(true);
    try {
      const result = await checkPublicStoreOrder({
        lines: lines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId ?? null,
          quantity: line.quantity,
        })),
        address: orderAddressOf(base),
        paymentMethod: stage === 'payment' ? paymentMethod : null,
        paymentAccountId: stage === 'payment' ? paymentAccountId : null,
      });
      setOrderIssues(result.issues);
      if (!result.ok) {
        toast.error(result.issues[0]?.message ?? t('checkout.placeError'));
        return false;
      }
      return true;
    } catch (error) {
      toast.error(customerErrorText(error, t('checkout.checkFailed')));
      return false;
    } finally {
      setVerifying(false);
    }
  }

  function startNewAddress() {
    setNewAddress({ ...EMPTY_STORE_ADDRESS_FORM, isDefault: savedAddresses.length === 0 });
    setAddingAddress(true);
  }

  const selectedSaved = selectedAddressId
    ? savedAddresses.find((row) => row.id === selectedAddressId)
    : undefined;

  /** Saves the open form to the address book and delivers to it. */
  async function saveNewAddress(): Promise<PartnerAddress | null> {
    if (!accessToken || !customer?.partnerId) return null;
    if (storeAddressIncomplete(newAddress)) {
      toast.error(t('checkout.errors.addressIncomplete'));
      return null;
    }
    setSavingAddress(true);
    try {
      const created = await createPartnerAddress(accessToken, {
        ...storeAddressPayload(newAddress, countryCode, t('account.addresses.defaultLabel')),
        partnerId: customer.partnerId,
        isDefault: newAddress.isDefault || savedAddresses.length === 0,
      });
      setSavedAddresses((prev) => [created, ...prev]);
      applySavedAddress(created);
      setAddingAddress(false);
      toast.success(t('account.addresses.saved'));
      return created;
    } catch (err) {
      toast.error(customerErrorText(err, t('account.addresses.saveFailed')));
      return null;
    } finally {
      setSavingAddress(false);
    }
  }

  const productById = new Map((products ?? []).map((product) => [product.id, product]));
  const cartLines = lines
    .map((line) => {
      const product = productById.get(line.productId);
      if (!product) return null;
      const variant = line.variantId
        ? product.variants.find((item) => item.id === line.variantId)
        : undefined;
      const unitPrice = resolveLineUnitPrice(product, variant);
      const compareAt = resolveLineCompareAtPrice(product, unitPrice);
      const discountPercent = resolveDiscountPercent(unitPrice, compareAt);
      const lineName = variant ? variant.nameAr : product.name;
      return { line, product, variant, unitPrice, compareAt, discountPercent, lineName };
    })
    .filter(Boolean) as Array<{
    line: (typeof lines)[number];
    product: NonNullable<ReturnType<typeof productById.get>>;
    variant: NonNullable<ReturnType<typeof productById.get>>['variants'][number] | undefined;
    unitPrice: NonNullable<ReturnType<typeof productById.get>>['price'];
    compareAt: NonNullable<ReturnType<typeof productById.get>>['compareAtPrice'];
    discountPercent: number | null;
    lineName: string;
  }>;

  const currency = cartLines[0]?.unitPrice.currency ?? storeCurrency ?? 'YER';
  const subtotal = cartLines.reduce((sum, item) => sum + item.unitPrice.amount * item.line.quantity, 0);

  const shippingQuoteQuery = useQuery({
    queryKey: ['storefront', 'shipping-quote', companyId, address.cityId, address.districtId, subtotal],
    queryFn: () =>
      fetchPublicShippingQuote({
        companyId,
        cityId: address.cityId,
        districtId: address.districtId,
        subtotal,
      }),
    placeholderData: (previous) => previous,
    enabled: Boolean(companyId && address.cityId),
  });

  const shippingKnown = Boolean(address.cityId) && !shippingQuoteQuery.isLoading;
  // No matching city or district rate. A rate of 0 is real free delivery.
  const shippingUnset = shippingKnown && shippingQuoteQuery.data?.rateId == null;
  const shipping = {
    amount: shippingKnown && !shippingUnset ? Number(shippingQuoteQuery.data?.amount ?? 0) : 0,
    currency: shippingQuoteQuery.data?.currencyCode ?? currency,
  };
  const total = subtotal + shipping.amount;
  const feeText = (amount: number) =>
    amount === 0 ? t('checkout.freeShipping') : formatPrice(amount);
  const shippingPlaceLabel = (place: string) => {
    const name = place.trim();
    return name ? t('checkout.shippingForPlace', { place: name }) : t('checkout.shipping');
  };
  const quotedCity = shippingQuoteQuery.data?.cityAmount;
  const quotedDistrict = shippingQuoteQuery.data?.districtAmount;
  const cityFee = quotedCity != null && quotedCity !== '' ? Number(quotedCity) : null;
  const districtFee = quotedDistrict != null && quotedDistrict !== '' ? Number(quotedDistrict) : null;
  // One line. A district rate replaces the city rate; it is not shown beside it.
  const chargedFee = address.districtId && districtFee != null ? districtFee : cityFee;
  const chargedPlace = address.districtId && districtFee != null ? address.district : address.city;
  const shippingRows: Array<{ key: string; label: string; value: string; prompt?: boolean }> =
    !address.cityId
      ? [{ key: 'pending', label: t('checkout.shipping'), value: t('checkout.shippingPending'), prompt: true }]
      : shippingQuoteQuery.isLoading
        ? [{ key: 'loading', label: t('checkout.shipping'), value: t('common.loading') }]
        : shippingUnset || chargedFee == null
          ? [{ key: 'unset', label: t('checkout.shipping'), value: t('checkout.shippingUnset'), prompt: true }]
          : [{ key: 'fee', label: shippingPlaceLabel(chargedPlace), value: feeText(chargedFee) }];
  const shownShippingRows =
    shippingRows.length > 0
      ? shippingRows
      : [{ key: 'unset', label: t('checkout.shipping'), value: t('checkout.shippingUnset'), prompt: true }];
  const shippingLabel = shownShippingRows
    .map((row) => (row.prompt ? row.value : `${row.label}: ${row.value}`))
    .join(' · ');
  // Free delivery from an items amount: say so, or how much is missing.
  const freeAbove = Number(shippingQuoteQuery.data?.freeAboveAmount ?? NaN);
  const freeDeliveryNote = !shippingKnown || !Number.isFinite(freeAbove)
    ? null
    : shippingQuoteQuery.data?.freeApplied
      ? t('checkout.freeDeliveryReached', { amount: formatPrice(freeAbove) })
      : t('checkout.freeDeliveryMissing', { amount: formatPrice(Math.max(0, freeAbove - subtotal)) });
  const itemCount = cartLines.reduce((sum, item) => sum + item.line.quantity, 0);

  function formatPrice(amount: number) {
    return formatMoney({ amount, currency });
  }

  async function addOrderAttachments(files: File[]) {
    const remaining = MAX_ORDER_ATTACHMENTS - orderAttachments.length;
    if (remaining <= 0) {
      toast.error(t('checkout.errors.attachmentsMax', { max: MAX_ORDER_ATTACHMENTS }));
      return;
    }
    const selected = files.slice(0, remaining);
    if (files.length > remaining) {
      toast.error(t('checkout.errors.attachmentsMax', { max: MAX_ORDER_ATTACHMENTS }));
    }
    setAttachmentsBusy(true);
    try {
      for (const file of selected) {
        if (file.size > MAX_ORDER_ATTACHMENT_BYTES) {
          toast.error(t('checkout.errors.attachmentSize'));
          continue;
        }
        try {
          const input = await fileToOrderAttachment(companyId, file);
          setOrderAttachments((prev) =>
            prev.length >= MAX_ORDER_ATTACHMENTS ? prev : [...prev, input],
          );
        } catch (error) {
          toast.error(
            error instanceof OrderAttachmentError
              ? customerErrorText(error, t('checkout.errors.attachmentType'))
              : t('checkout.errors.attachmentType'),
          );
        }
      }
    } finally {
      setAttachmentsBusy(false);
    }
  }

  function validateAddress(base: CheckoutAddressInput = address): boolean {
    const errors: Partial<Record<keyof CheckoutAddressInput, string>> = {};
    const fullName = (customer?.name?.trim() || base.fullName).trim();
    const rawPhone = (customer?.phone?.trim() || base.phone).trim();
    if (!fullName) errors.fullName = t('checkout.errors.required');
    // One form of the number (+967…), the same rule as sign-up and the API.
    const parsedPhone = parseStoreMobile(rawPhone, country);
    const phone = parsedPhone.ok ? parsedPhone.e164 : rawPhone;
    if (!parsedPhone.ok) {
      errors.phone = mobileError(parsedPhone, country) ?? t('checkout.errors.phone');
    }
    if (!base.countryId || !base.cityId || !base.city.trim()) {
      errors.city =
        geoCountriesFetched && geoCountries.length === 0
          ? t('checkout.errors.geoUnavailable')
          : t('checkout.errors.cityRequired');
    }
    if (!base.districtId || !base.district.trim()) {
      errors.district = t('checkout.errors.required');
    }
    if (!base.street.trim()) errors.street = t('checkout.errors.required');
    // Keep payload in sync with the logged-in profile (fields are hidden in the UI).
    if (fullName !== base.fullName || phone !== base.phone) {
      setAddress((prev) => ({ ...prev, fullName, phone }));
    }
    setAddressErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function goNext() {
    if (step === 'address') {
      if (cartCheck.blocked) {
        toast.error(cartCheck.issues[0]?.message ?? t('cart.fixLinesFirst'));
        return;
      }
      if (!accessToken && guest) {
        const typed = formToAddress(newAddress, address);
        setAddress(typed);
        if (!validateAddress(typed)) return;
        if (shippingUnset) {
          toast.error(t('checkout.shippingUnset'));
          return;
        }
        void verifyOrder('address', typed).then((ok) => {
          if (ok) setStep('payment');
        });
        return;
      }
      if (addingAddress) {
        void (async () => {
          const created = await saveNewAddress();
          if (created && (await verifyOrder('address', rowToAddress(created, address)))) {
            setStep('payment');
          }
        })();
        return;
      }
      if (!selectedSaved) {
        startNewAddress();
        toast.error(t('checkout.errors.addressRequired'));
        return;
      }
      if (!validateAddress()) return;
      if (shippingUnset) {
        toast.error(t('checkout.shippingUnset'));
        return;
      }
      void verifyOrder('address', address).then((ok) => {
        if (ok) setStep('payment');
      });
      return;
    }
    if (step === 'payment') {
      if (allPaymentAccountsQuery.isLoading) {
        toast.error(t('checkout.paymentAccountLoading'));
        return;
      }
      if (paymentMethods.length === 0 || !paymentAccountId) {
        toast.error(t('checkout.errors.paymentAccountRequired'));
        return;
      }
      void verifyOrder('payment', address).then((ok) => {
        if (ok) setStep('review');
      });
    }
  }

  function goBack() {
    if (step === 'payment') setStep('address');
    if (step === 'review') setStep('payment');
  }

  async function submitOrder() {
    if (!accessToken && !guest) {
      toast.error(t('checkout.loginRequiredToast'));
      router.replace(storeLoginHref('/store/checkout'));
      return;
    }
    if (!validateAddress()) {
      setStep('address');
      return;
    }
    if (shippingUnset) {
      toast.error(t('checkout.shippingUnset'));
      setStep('address');
      return;
    }
    setSubmitting(true);
    try {
      if (!paymentAccountId) {
        toast.error(t('checkout.errors.paymentAccountRequired'));
        setStep('payment');
        return;
      }
      const orderAddress = orderAddressOf(address);
      // Same cart, address and payment → same key: a resend after a lost
      // answer (or from another tab) returns the order already placed.
      const attempt = checkoutAttemptKey({
        lines: cartLines.map(({ line }) => [line.productId, line.variantId ?? null, line.quantity]),
        address: orderAddress,
        payment: [paymentMethod, paymentAccountId || null],
      });
      const result = await placeStorefrontOrder({
        idempotencyKey: attempt.key,
        locale,
        address: orderAddress,
        paymentMethod,
        paymentAccountId: paymentAccountId || null,
        customerNote: customerNote.trim() || null,
        accessToken,
        paymentProofUrls:
          paymentMethod !== 'cash_on_delivery' && paymentMethod !== 'cash'
            ? paymentProofs.map((item) => item.url)
            : [],
        attachments: [
          ...(paymentMethod !== 'cash_on_delivery' && paymentMethod !== 'cash'
            ? paymentProofs.slice(1).map((proof, index) => ({
                fileName: proof.name || `receipt-${index + 2}.jpg`,
                fileUrl: proof.url,
                mimeType: 'image/jpeg',
                label: 'إيصال تحويل',
              }))
            : []),
          ...orderAttachments,
        ].slice(0, MAX_ORDER_ATTACHMENTS),
        lines: cartLines.map(({ line, product, unitPrice, lineName, variant }) => {
          const display = buildProductDisplay(product);
          return {
            productId: product.id,
            variantId: line.variantId,
            productName: lineName,
            productSlug: product.slug,
            quantity: line.quantity,
            unitPrice,
            imageUrl: variant?.imageUrl ?? variant?.images?.[0]?.url ?? display.imageUrl,
          };
        }),
      });
      if (!result.ok) {
        toast.error(
          result.error === STORE_CURRENCY_MISMATCH_ERROR
            ? t('checkout.errors.currencyMismatch')
            : result.error === STORE_COUNTRY_UNAVAILABLE_ERROR
              ? t('checkout.errors.countryUnavailable')
              : result.error === STORE_STOCK_SHORT_ERROR
                ? t('checkout.errors.outOfStock')
                : result.error === STORE_INVENTORY_UNAVAILABLE_ERROR
                  ? t('checkout.errors.inventoryUnavailable')
                  : customerErrorText(result.error, t('checkout.placeError')),
        );
        return;
      }
      const order = result.order;
      attempt.done();
      clearCart();
      if (guest) setGuest(false);
      toast.custom(
        () => (
          <div
            role="status"
            className="pointer-events-auto inline-flex max-w-[min(100vw-2rem,22rem)] items-center gap-2.5 rounded-full border border-border bg-card px-4 py-2.5 text-sm text-foreground shadow-soft"
          >
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="whitespace-nowrap font-medium">{t('checkout.placeSuccess')}</span>
          </div>
        ),
        { duration: 2800, unstyled: true, className: '!w-auto !max-w-none !border-0 !bg-transparent !p-0 !shadow-none' },
      );
      router.push(
        `/store/orders/${order.orderNumber}?phone=${encodeURIComponent(address.phone.trim())}`,
      );
    } catch {
      toast.error(t('checkout.placeError'));
    } finally {
      setSubmitting(false);
    }
  }

  if (!authReady || (!accessToken && !guest)) {
    return (
      <StoreEmptyState
        icon={ShieldCheck}
        title={t('checkout.loginRequiredTitle')}
        description={t('checkout.loginRequiredDescription')}
      >
        <div className="flex flex-col items-center gap-3">
        <div className="flex flex-col items-center gap-2 sm:flex-row">
          <Button asChild>
            <Link href={storeLoginHref('/store/checkout')} prefetch={false}>
              {t('checkout.loginRequiredAction')}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={storeRegisterHref('/store/checkout')} prefetch={false}>
              {t('checkout.registerRequiredAction')}
            </Link>
          </Button>
        </div>
        <div className="max-w-sm space-y-2 rounded-xl border border-dashed border-border px-4 py-3 text-center">
          <Button type="button" variant="ghost" className="h-auto px-2 py-1 text-sm font-medium" onClick={() => setGuest(true)}>
            {t('checkout.guest.action')}
          </Button>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('checkout.guest.warning')}</p>
        </div>
        </div>
      </StoreEmptyState>
    );
  }

  if (lines.length === 0) {
    return (
      <StoreEmptyState icon={PackageSearch} title={t('cart.empty')} description={t('checkout.emptyCartHint')}>
        <Link
          href="/store/products"
          prefetch={false}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground"
        >
          {t('cart.continueShopping')}
        </Link>
      </StoreEmptyState>
    );
  }

  if (isLoading) {
    return <ProductGridSkeleton count={3} columns={{ mobile: 1, tablet: 1, desktop: 1 }} />;
  }

  if (isError) {
    return <StoreErrorState onRetry={() => refetch()} />;
  }

  const stepIndex = STEPS.findIndex((item) => item.id === step);

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="min-w-0 max-w-full space-y-5">
        {/* Progress */}
        <nav aria-label={t('checkout.title')} className="rounded-2xl border border-border bg-card px-3 py-4 sm:px-5">
          <ol className="relative grid grid-cols-3 gap-2">
            <div
              className="pointer-events-none absolute start-[16.66%] end-[16.66%] top-4 h-0.5 bg-border"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute start-[16.66%] top-4 h-0.5 origin-left bg-primary transition-transform duration-300 rtl:origin-right"
              style={{
                width: '66.68%',
                transform: `scaleX(${stepIndex / (STEPS.length - 1)})`,
              }}
              aria-hidden
            />
            {STEPS.map(({ id, icon: Icon }, index) => {
              const active = index === stepIndex;
              const done = index < stepIndex;
              return (
                <li key={id} className="relative z-[1] flex flex-col items-center gap-2 text-center">
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors',
                      done && 'border-primary bg-primary text-primary-foreground',
                      active && 'border-primary bg-primary/10 text-primary',
                      !active && !done && 'border-border bg-background text-muted-foreground',
                    )}
                  >
                    {done ? <Check className="h-4 w-4" aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}
                  </span>
                  <span
                    className={cn(
                      'text-[11px] font-medium sm:text-xs',
                      active || done ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {t(`checkout.steps.${id}`)}
                  </span>
                </li>
              );
            })}
          </ol>
        </nav>

        {cartCheck.issues.length > 0 || orderIssues.length > 0 ? (
          <section
            role="alert"
            className="space-y-2 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
          >
            <p className="flex items-center gap-2 font-semibold">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
              {t('checkout.fixBeforePaying')}
            </p>
            <ul className="space-y-1.5 ps-6">
              {[...cartCheck.issues, ...orderIssues]
                .filter(
                  (issue, index, all) =>
                    all.findIndex(
                      (other) =>
                        other.code === issue.code &&
                        other.productId === issue.productId &&
                        other.message === issue.message,
                    ) === index,
                )
                .map((issue, index) => {
                  const slug = issue.productId ? productById.get(issue.productId)?.slug : undefined;
                  return (
                    <li key={`${issue.code}-${issue.productId ?? index}`} className="list-disc leading-relaxed">
                      {issue.message}{' '}
                      {slug ? (
                        <Link
                          href={`/store/products/${slug}`}
                          prefetch={false}
                          className="font-semibold underline underline-offset-2"
                        >
                          {t('cart.openProduct')}
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
            </ul>
            {cartCheck.blocked ? (
              <Link
                href="/store/cart"
                prefetch={false}
                className="inline-block text-xs font-semibold underline underline-offset-2"
              >
                {t('checkout.backToCart')}
              </Link>
            ) : null}
          </section>
        ) : null}

        {/* Address */}
        {step === 'address' ? (
          <section className="min-w-0 rounded-2xl border border-border bg-card">
            <header className="flex items-center gap-3 border-b border-border/80 px-5 py-3.5 sm:px-6">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MapPin className="h-4 w-4" aria-hidden />
              </span>
              <h2 className="min-w-0 flex-1 font-arabic-display text-base font-semibold leading-snug text-foreground sm:text-lg">
                {t('checkout.chooseAddressTitle')}
              </h2>
              {!addingAddress ? (
                <Button
                  type="button"
                  size="icon"
                  onClick={startNewAddress}
                  className="h-10 w-10 shrink-0 rounded-full shadow-soft"
                  aria-label={t('checkout.useNewAddress')}
                  title={t('checkout.useNewAddress')}
                >
                  <Plus className="h-5 w-5" aria-hidden />
                </Button>
              ) : null}
            </header>
            <div className="grid min-w-0 gap-4 p-4 sm:grid-cols-2 sm:gap-x-4 sm:p-6">
              {!accessToken && guest ? (
                <div className="space-y-4 sm:col-span-2">
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                    <p className="font-semibold">{t('checkout.guest.bannerTitle')}</p>
                    <p className="mt-0.5">{t('checkout.guest.warning')}</p>
                    <button
                      type="button"
                      className="mt-1 font-medium underline underline-offset-2"
                      onClick={() => setGuest(false)}
                    >
                      {t('checkout.guest.signInInstead')}
                    </button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t('checkout.guest.name')}>
                      <Input
                        value={address.fullName}
                        onChange={(e) => setAddress((prev) => ({ ...prev, fullName: e.target.value }))}
                        autoComplete="name"
                        className="h-11 rounded-xl"
                      />
                    </Field>
                    <Field label={t('checkout.guest.mobile')}>
                      <StoreMobileInput
                        id="checkout-guest-mobile"
                        value={address.phone}
                        onChange={(value) => setAddress((prev) => ({ ...prev, phone: value }))}
                        country={country}
                        showError={Boolean(addressErrors.phone)}
                        required
                      />
                    </Field>
                  </div>
                  <StoreAddressFields
                    form={newAddress}
                    setForm={setNewAddress}
                    idPrefix="checkout-guest-addr"
                    showDefault={false}
                  />
                </div>
              ) : addressesLoading ? (
                <div className="h-14 animate-pulse rounded-xl bg-muted/50 sm:col-span-2" />
              ) : addressesError ? (
                <button
                  type="button"
                  className="text-start text-xs text-destructive underline sm:col-span-2"
                  onClick={() => void loadSavedAddresses()}
                >
                  {addressesError} {t('checkout.retryAddresses')}
                </button>
              ) : savedAddresses.length > 0 ? (
                <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
                  {savedAddresses.map((row) => {
                    const active = selectedAddressId === row.id && !addingAddress;
                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => {
                          setAddingAddress(false);
                          applySavedAddress(row);
                        }}
                        className={cn(
                          'flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-start transition-colors',
                          active
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                            : 'border-border hover:border-primary/40',
                        )}
                      >
                        <span
                          className={cn(
                            'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                            active ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                          )}
                          aria-hidden
                        >
                          {active ? (
                            <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                          ) : null}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-foreground">
                            {row.label || t('account.addresses.defaultLabel')}
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                            {formatPartnerAddressLine(row) || t('checkout.incompleteAddress')}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : !addingAddress ? (
                <button
                  type="button"
                  onClick={startNewAddress}
                  className="flex items-center gap-2 rounded-xl border border-dashed border-primary/50 px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5 sm:col-span-2"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  {t('checkout.addFirstAddress')}
                </button>
              ) : null}

              {!addingAddress &&
              selectedSaved &&
              (addressErrors.district || addressErrors.street || addressErrors.city) ? (
                <p className="text-xs text-destructive sm:col-span-2">
                  {t('checkout.savedAddressIncomplete')}
                </p>
              ) : null}
              {addressErrors.fullName || addressErrors.phone ? (
                <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive sm:col-span-2">
                  {addressErrors.fullName || addressErrors.phone}
                </p>
              ) : null}

              {addingAddress ? (
                <div className="animate-in fade-in slide-in-from-top-2 space-y-4 rounded-2xl border border-primary/30 bg-primary/[0.03] p-4 duration-200 sm:col-span-2">
                  <p className="text-sm font-semibold text-foreground">
                    {t('checkout.useNewAddress')}
                  </p>
                  <StoreAddressFields
                    form={newAddress}
                    setForm={setNewAddress}
                    idPrefix="checkout-addr"
                    showDefault={savedAddresses.length > 0}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      className="flex-1"
                      disabled={savingAddress}
                      onClick={() => void saveNewAddress()}
                    >
                      {savingAddress ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                      {savingAddress ? t('account.saving') : t('checkout.saveAddress')}
                    </Button>
                    {savedAddresses.length > 0 ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={savingAddress}
                        onClick={() => setAddingAddress(false)}
                      >
                        {t('common.cancel')}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <Field label={t('checkout.customerNote')} className="sm:col-span-2">
                <Textarea
                  rows={2}
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  placeholder={t('checkout.customerNotePlaceholder')}
                  className="min-h-[4.5rem] w-full min-w-0 max-w-full rounded-xl border-input px-3.5 py-3 text-base leading-relaxed sm:text-sm"
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t('checkout.customerNoteHint')}
                </p>
              </Field>
            </div>
          </section>
        ) : null}

        {/* Payment */}
        {step === 'payment' ? (
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <header className="flex items-center gap-3 border-b border-border px-5 py-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Wallet className="h-4 w-4" aria-hidden />
              </span>
              <h2 className="font-arabic-display text-base font-semibold text-foreground sm:text-lg">
                {t('checkout.paymentTitle')}
              </h2>
            </header>
            <div className="grid gap-3 p-5">
              {allPaymentAccountsQuery.isLoading ? (
                <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  {t('checkout.paymentAccountLoading')}
                </p>
              ) : paymentMethods.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-amber-500/40 bg-amber-500/5 px-4 py-8 text-center text-sm text-amber-800 dark:text-amber-300">
                  {t('checkout.errors.paymentAccountUnavailable')}
                </p>
              ) : (
                <>
                <div className="grid grid-cols-2 gap-2">
                {paymentMethods.map((id) => {
                const Icon = PAYMENT_METHOD_ICONS[id] ?? Wallet;
                const selected = paymentMethod === id;

                return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(id);
                        if (id === 'cash_on_delivery' || id === 'cash') {
                          setPaymentProofs([]);
                        }
                      }}
                      aria-pressed={selected}
                      className={cn(
                        'flex items-center gap-2.5 rounded-2xl border px-3 py-3 text-start transition-colors',
                        selected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                          : 'border-border bg-card hover:border-primary/30',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                          selected
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-primary',
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground">
                        {t(`checkout.paymentMethods.${id}.label`)}
                      </span>
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                          selected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background',
                        )}
                        aria-hidden
                      >
                        {selected ? <Check className="h-3 w-3" /> : null}
                      </span>
                    </button>
                );
              })}
                </div>

                {showPaymentAccounts || showPaymentProof ? (
                      <div className="space-y-4 rounded-2xl border border-border bg-muted/20 p-4">
                        {paymentAccounts.length > 1 ? (
                          <p className="text-sm font-medium text-foreground">
                            {t('checkout.paymentAccountTitle')}
                            {paymentMethodRequiresAccount(paymentMethod) ? (
                              <span className="text-destructive"> *</span>
                            ) : null}
                          </p>
                        ) : null}

                        {allPaymentAccountsQuery.isLoading ? (
                          <p className="text-xs text-muted-foreground">
                            {t('checkout.paymentAccountLoading')}
                          </p>
                        ) : paymentAccounts.length === 0 ? (
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            {paymentMethodRequiresAccount(paymentMethod)
                              ? t('checkout.errors.paymentAccountUnavailable')
                              : t('checkout.paymentAccountOptionalEmpty')}
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {paymentAccounts.map((account) => {
                              const accountSelected = paymentAccountId === account.id;
                              const name = paymentAccountDisplayName(account, locale);
                              const details = paymentAccountDetailsLine(account);
                              return (
                                <li key={account.id}>
                                  <button
                                    type="button"
                                    onClick={() => setPaymentAccountId(account.id)}
                                    className={cn(
                                      'flex w-full items-start gap-3 rounded-xl border p-3 text-start transition-colors',
                                      accountSelected
                                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                        : 'border-border bg-card hover:border-primary/30',
                                    )}
                                  >
                                    {account.logoUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element -- arbitrary store CDN host
                                      <img
                                        src={account.logoUrl}
                                        alt=""
                                        width={40}
                                        height={40}
                                        className="h-10 w-10 rounded-lg object-contain"
                                      />
                                    ) : (
                                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-primary">
                                        <Wallet className="h-4 w-4" />
                                      </span>
                                    )}
                                    <span className="min-w-0 flex-1">
                                      <span className="block text-sm font-semibold text-foreground">
                                        {name}
                                      </span>
                                      {details ? (
                                        <span
                                          className="mt-0.5 block text-xs text-muted-foreground"
                                          dir="ltr"
                                        >
                                          {details}
                                        </span>
                                      ) : null}
                                    </span>
                                    <span
                                      className={cn(
                                        'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                                        accountSelected
                                          ? 'border-primary bg-primary text-primary-foreground'
                                          : 'border-border bg-background',
                                      )}
                                    >
                                      {accountSelected ? <Check className="h-3 w-3" /> : null}
                                    </span>
                                  </button>

                                  {accountSelected && account.qrImageUrl ? (
                                    <div className="mt-2 rounded-xl border border-dashed border-border bg-card p-4">
                                      <div className="mb-3 flex items-center justify-center gap-2 text-sm font-medium text-foreground">
                                        <QrCode
                                          className="h-4 w-4 text-primary"
                                          aria-hidden
                                        />
                                        {t('checkout.paymentQrTitle')}
                                      </div>
                                      <div className="flex justify-center">
                                        {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary store CDN host */}
                                        <img
                                          src={account.qrImageUrl}
                                          alt={t('checkout.paymentQrAlt', { name })}
                                          width={176}
                                          height={176}
                                          className="h-44 w-44 rounded-lg bg-white object-contain p-2"
                                        />
                                      </div>
                                    </div>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        )}

                        {showPaymentProof ? (
                          <div className="space-y-3 border-t border-border/70 pt-4">
                            <div>
                              <Label
                                htmlFor="payment-proof"
                                className="text-sm font-medium"
                              >
                                {t('checkout.paymentProofLabel')}
                              </Label>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {t('checkout.paymentProofLimit', {
                                  max: MAX_PAYMENT_PROOF_FILES,
                                  count: paymentProofs.length,
                                })}
                              </p>
                              <Input
                                id="payment-proof"
                                type="file"
                                accept="image/*"
                                multiple
                                disabled={proofsBusy || paymentProofs.length >= MAX_PAYMENT_PROOF_FILES}
                                className="mt-2 h-11 cursor-pointer rounded-xl file:me-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary"
                                onChange={(e) => {
                                  const files = Array.from(e.target.files ?? []);
                                  e.target.value = '';
                                  if (files.length === 0) return;

                                  void (async () => {
                                    const remaining =
                                      MAX_PAYMENT_PROOF_FILES - paymentProofs.length;
                                    if (remaining <= 0) {
                                      toast.error(
                                        t('checkout.errors.paymentProofMax', {
                                          max: MAX_PAYMENT_PROOF_FILES,
                                        }),
                                      );
                                      return;
                                    }

                                    const picked = files.slice(0, remaining);
                                    if (files.length > remaining) {
                                      toast.error(
                                        t('checkout.errors.paymentProofMax', {
                                          max: MAX_PAYMENT_PROOF_FILES,
                                        }),
                                      );
                                    }

                                    setProofsBusy(true);
                                    try {
                                      for (const file of picked) {
                                        if (!file.type.startsWith('image/')) {
                                          toast.error(t('checkout.errors.paymentProofType'));
                                          continue;
                                        }
                                        if (file.size > MAX_PAYMENT_PROOF_BYTES) {
                                          toast.error(t('checkout.errors.paymentProofSize'));
                                          continue;
                                        }
                                        try {
                                          // Uploaded first; the order keeps only its link (A3).
                                          const uploaded = await uploadStoreOrderFile(
                                            companyId,
                                            file,
                                          );
                                          setPaymentProofs((prev) => {
                                            if (prev.length >= MAX_PAYMENT_PROOF_FILES) {
                                              return prev;
                                            }
                                            return [
                                              ...prev,
                                              { url: uploaded.url, name: uploaded.fileName },
                                            ];
                                          });
                                        } catch (error) {
                                          toast.error(
                                            error instanceof OrderAttachmentError
                                              ? error.message
                                              : t('checkout.errors.paymentProofType'),
                                          );
                                        }
                                      }
                                    } finally {
                                      setProofsBusy(false);
                                    }
                                  })();
                                }}
                              />
                              {paymentProofs.length > 0 ? (
                                <ul className="mt-3 space-y-2">
                                  {paymentProofs.map((proof, index) => (
                                    <li
                                      key={`${proof.name}-${index}`}
                                      className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-2.5 py-2"
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={proof.url}
                                        alt=""
                                        className="h-14 w-14 shrink-0 rounded-lg border border-border object-cover"
                                      />
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-xs font-medium text-foreground">
                                          {proof.name || t('checkout.paymentProofAttached')}
                                        </p>
                                        <button
                                          type="button"
                                          className="mt-1 text-xs text-destructive hover:underline"
                                          onClick={() =>
                                            setPaymentProofs((prev) =>
                                              prev.filter((_, i) => i !== index),
                                            )
                                          }
                                        >
                                          {t('checkout.paymentProofRemove')}
                                        </button>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                ) : null}
                </>
              )}

              <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
                <div className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-primary" />
                  <Label htmlFor="order-attachments" className="text-sm font-medium">
                    {t('checkout.attachmentsLabel')}
                  </Label>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t('checkout.attachmentsHint', {
                    max: MAX_ORDER_ATTACHMENTS,
                    count: orderAttachments.length,
                  })}
                </p>
                <Input
                  id="order-attachments"
                  type="file"
                  multiple
                  accept={ORDER_ATTACHMENT_ACCEPT}
                  disabled={attachmentsBusy || orderAttachments.length >= MAX_ORDER_ATTACHMENTS}
                  className="h-11 cursor-pointer rounded-xl file:me-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = '';
                    if (files.length === 0) return;
                    void addOrderAttachments(files);
                  }}
                />
                {orderAttachments.length > 0 ? (
                  <ul className="space-y-2">
                    {orderAttachments.map((attachment, index) => (
                      <li
                        key={`${attachment.fileName}-${index}`}
                        className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-2.5 py-2"
                      >
                        {isImageMime(attachment.mimeType) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={attachment.fileUrl}
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover"
                          />
                        ) : (
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                            <FileText className="h-5 w-5" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-foreground" dir="auto">
                            {attachment.fileName}
                          </p>
                          <button
                            type="button"
                            className="mt-1 text-xs text-destructive hover:underline"
                            onClick={() =>
                              setOrderAttachments((prev) => prev.filter((_, i) => i !== index))
                            }
                          >
                            {t('checkout.attachmentsRemove')}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {/* Review */}
        {step === 'review' ? (
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <header className="flex items-center gap-3 border-b border-border px-5 py-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheck className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <h2 className="font-arabic-display text-base font-semibold text-foreground sm:text-lg">
                  {t('checkout.reviewTitle')}
                </h2>
                <p className="text-xs text-muted-foreground">{t('checkout.reviewHint')}</p>
              </div>
            </header>
            <div className="space-y-4 p-5">
              <dl className="space-y-2 rounded-2xl border border-border bg-muted/20 p-4 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">
                    {t('checkout.itemsAmount', { count: itemCount })}
                  </dt>
                  <dd className="font-medium tabular-nums text-foreground">{formatPrice(subtotal)}</dd>
                </div>
                {shownShippingRows.map((row) =>
                  row.prompt ? (
                    <p key={row.key} className="text-xs leading-relaxed text-muted-foreground">
                      {row.value}
                    </p>
                  ) : (
                    <div key={row.key} className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{row.label}</dt>
                      <dd className="font-medium tabular-nums text-foreground">{row.value}</dd>
                    </div>
                  ),
                )}
                {freeDeliveryNote ? <FreeDeliveryNotice text={freeDeliveryNote} /> : null}
                <div className="flex justify-between gap-3 border-t border-border pt-2">
                  <dt className="font-semibold text-foreground">{t('cart.total')}</dt>
                  <dd className="text-base font-bold tabular-nums text-foreground">{formatPrice(total)}</dd>
                </div>
              </dl>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-muted/30 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">{t('checkout.steps.address')}</p>
                    <button
                      type="button"
                      className="text-xs font-medium text-primary hover:underline"
                      onClick={() => setStep('address')}
                    >
                      {t('checkout.edit')}
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{address.fullName}</p>
                  <p className="mt-1 text-sm text-muted-foreground" dir="ltr">
                    {address.phone}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {address.city} · {address.district}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{address.street}</p>
                  {address.mapAddress ? (
                    <p className="mt-1 truncate text-xs text-muted-foreground" dir="auto">
                      📍 {address.mapAddress}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-2xl bg-muted/30 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">{t('checkout.steps.payment')}</p>
                    <button
                      type="button"
                      className="text-xs font-medium text-primary hover:underline"
                      onClick={() => setStep('payment')}
                    >
                      {t('checkout.edit')}
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {t(`checkout.paymentMethods.${paymentMethod}.label`)}
                  </p>
                  {selectedPaymentAccount &&
                  selectedAccountName &&
                  paymentMethod !== 'cash' &&
                  paymentMethod !== 'cash_on_delivery' ? (
                    <div className="mt-3 space-y-2 rounded-xl border border-border bg-card p-3">
                      <p className="text-xs font-medium text-foreground">
                        {t('checkout.paymentAccountSelected', { name: selectedAccountName })}
                      </p>
                      {selectedAccountDetails ? (
                        <p className="text-xs text-muted-foreground" dir="ltr">
                          {selectedAccountDetails}
                        </p>
                      ) : null}
                      {selectedPaymentAccount.qrImageUrl ? (
                        <div className="pt-1">
                          <div className="mb-2 flex items-center justify-center gap-1.5 text-xs font-medium text-foreground">
                            <QrCode className="h-3.5 w-3.5 text-primary" aria-hidden />
                            {t('checkout.paymentQrTitle')}
                          </div>
                          <div className="flex justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary store CDN host */}
                            <img
                              src={selectedPaymentAccount.qrImageUrl}
                              alt={t('checkout.paymentQrAlt', { name: selectedAccountName })}
                              width={144}
                              height={144}
                              className="h-36 w-36 rounded-lg bg-white object-contain p-2"
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {paymentMethod !== 'cash_on_delivery' &&
                  paymentMethod !== 'cash' &&
                  paymentProofs.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {paymentProofs.map((proof, index) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={`${proof.name}-${index}`}
                            src={proof.url}
                            alt=""
                            className="h-10 w-10 rounded-md border border-border object-cover"
                          />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t('checkout.paymentProofAttachedCount', { count: paymentProofs.length })}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {/* Actions: physical [back | continue] so in RTL “متابعة” sits on the start (right). */}
        <div dir="ltr" className="hidden items-center justify-between gap-3 sm:flex">
          {step !== 'address' ? (
            <Button type="button" variant="outline" className="rounded-xl" onClick={goBack} disabled={submitting}>
              <ChevronLeft className="me-1 h-4 w-4" aria-hidden />
              {t('checkout.back')}
            </Button>
          ) : (
            <Button type="button" variant="outline" className="rounded-xl" asChild>
              <Link href="/store/cart" prefetch={false}>
                {t('checkout.backToCart')}
              </Link>
            </Button>
          )}
          {step !== 'review' ? (
            <Button
              type="button"
              className="min-w-36 rounded-xl"
              onClick={goNext}
              disabled={(step === 'address' && (addressesLoading || shippingUnset)) || verifying || cartCheck.blocked}
            >
              {t('checkout.continue')}
            </Button>
          ) : (
            <Button
              type="button"
              className="min-w-44 rounded-xl"
              onClick={() => void submitOrder()}
              disabled={submitting || filesUploading}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {submitting ? t('checkout.placing') : t('checkout.placeOrder')}
            </Button>
          )}
        </div>
      </div>

      {/* Summary */}
      <aside className="space-y-4 lg:sticky lg:top-24">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-arabic-display text-base font-semibold text-foreground">
              {t('checkout.summary')}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('checkout.itemsInCart', { count: itemCount })}
            </p>
          </div>

          <ul className="max-h-52 space-y-3 overflow-y-auto px-5 py-4">
            {cartLines.map(({ line, product, unitPrice, compareAt, discountPercent, lineName, variant }) => {
              const display = buildProductDisplay(product);
              const rowImageUrl = variant?.imageUrl ?? variant?.images?.[0]?.url ?? display.imageUrl;
              const key = line.variantId ? `${product.id}::${line.variantId}` : product.id;
              return (
                <li key={key} className="flex items-center gap-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {rowImageUrl ? (
                      <Image
                        src={rowImageUrl}
                        alt={lineName}
                        fill
                        unoptimized
                        className="object-contain p-1"
                      />
                    ) : null}
                    <span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {line.quantity}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">{lineName}</p>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums">
                      <span className="font-medium text-foreground">{formatPrice(unitPrice.amount)}</span>
                      {compareAt ? (
                        <span className="text-muted-foreground line-through">
                          {formatPrice(compareAt.amount)}
                        </span>
                      ) : null}
                      {discountPercent ? (
                        <span className="font-semibold text-secondary">
                          {t('components.discount', { percent: discountPercent })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="space-y-3 border-t border-border px-5 py-4">
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t('cart.subtotal')}</dt>
                <dd className="font-medium tabular-nums text-foreground">{formatPrice(subtotal)}</dd>
              </div>
              {shownShippingRows.map((row) =>
                row.prompt ? (
                  <p key={row.key} className="text-xs leading-relaxed text-muted-foreground">
                    {row.value}
                  </p>
                ) : (
                  <div key={row.key} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="font-medium tabular-nums text-foreground">{row.value}</dd>
                  </div>
                ),
              )}
              {freeDeliveryNote ? <FreeDeliveryNotice text={freeDeliveryNote} /> : null}
              <div className="flex justify-between gap-3 border-t border-border pt-3">
                <dt className="font-semibold text-foreground">{t('cart.total')}</dt>
                <dd className="text-base font-bold tabular-nums text-foreground">{formatPrice(total)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </aside>

      {/* Mobile sticky actions */}
      <div
        className="store-drawer-safe-pb fixed inset-x-0 bottom-14 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-md sm:hidden"
      >
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">
            {t('cart.total')}
            <span className="block text-[11px]">
              {t('checkout.shipping')}: {shippingLabel}
            </span>
          </span>
          <span className="font-bold tabular-nums text-foreground">{formatPrice(total)}</span>
        </div>
        <div dir="ltr" className="flex gap-2">
          {step !== 'address' ? (
            <Button type="button" variant="outline" className="rounded-xl" onClick={goBack} disabled={submitting}>
              {t('checkout.back')}
            </Button>
          ) : (
            <Button type="button" variant="outline" className="rounded-xl" asChild>
              <Link href="/store/cart" prefetch={false}>
                {t('checkout.backToCart')}
              </Link>
            </Button>
          )}
          {step !== 'review' ? (
            <Button
              type="button"
              className="flex-1 rounded-xl"
              onClick={goNext}
              disabled={(step === 'address' && (addressesLoading || shippingUnset)) || verifying || cartCheck.blocked}
            >
              {t('checkout.continue')}
            </Button>
          ) : (
            <Button
              type="button"
              className="flex-1 rounded-xl"
              onClick={() => void submitOrder()}
              disabled={submitting || filesUploading}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {submitting ? t('checkout.placing') : t('checkout.placeOrder')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function FreeDeliveryNotice({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium leading-relaxed text-emerald-800 dark:text-emerald-200">
      {text}
    </p>
  );
}

function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0 max-w-full space-y-2', className)}>
      <Label className="block text-sm font-medium leading-snug text-foreground">{label}</Label>
      {children}
      {error ? <p className="text-xs leading-relaxed text-destructive">{error}</p> : null}
    </div>
  );
}
