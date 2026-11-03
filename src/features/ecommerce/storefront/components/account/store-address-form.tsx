'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { MapPin } from 'lucide-react';
import type { PartnerAddress } from '@/features/ecommerce/storefront/lib/api/partner-addresses-api';
import { getStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import { useStoreCountry } from '@/features/ecommerce/storefront/hooks/use-store-country';
import {
  GeoCascadeSelect,
  type GeoCascadeValue,
} from '@/features/system/organization/geo/components/geo-cascade-select';
import { usePublicGeoCountries } from '@/features/system/organization/geo/hooks/use-geo';
import {
  GoogleLocationPicker,
  type GoogleLocationValue,
} from '@/components/ui/google-location-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/**
 * The customer's address form, the same in the address book and at checkout
 * (approved 2026-10-09): the store's country (shown, not chosen), city and
 * district, street, map pin and driver notes. No name to type —
 * an address is named after its district and city. No building field
 * (2026-11-03); `building` stays in the state so an old address keeps its
 * value when edited.
 */
export type StoreAddressFormState = {
  label: string;
  countryId: string | null;
  cityId: string | null;
  districtId: string | null;
  city: string;
  district: string;
  street: string;
  building: string;
  notes: string;
  isDefault: boolean;
  latitude: number | null;
  longitude: number | null;
  mapAddress: string;
};

export const EMPTY_STORE_ADDRESS_FORM: StoreAddressFormState = {
  label: '',
  countryId: null,
  cityId: null,
  districtId: null,
  city: '',
  district: '',
  street: '',
  building: '',
  notes: '',
  isDefault: false,
  latitude: null,
  longitude: null,
  mapAddress: '',
};

function parseCoord(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function storeAddressToForm(address?: PartnerAddress | null): StoreAddressFormState {
  if (!address) return EMPTY_STORE_ADDRESS_FORM;
  return {
    label: address.label ?? '',
    countryId: address.countryId ?? null,
    cityId: address.cityId ?? null,
    districtId: address.districtId ?? null,
    city: address.city ?? '',
    district: address.district ?? '',
    street: address.street ?? '',
    building: address.building ?? '',
    notes: address.notes ?? '',
    isDefault: address.isDefault,
    latitude: parseCoord(address.latitude),
    longitude: parseCoord(address.longitude),
    mapAddress: '',
  };
}

/** Whether a required part (city, district, street) is missing. */
export function storeAddressIncomplete(form: StoreAddressFormState): boolean {
  if (form.countryId && (!form.cityId || !form.districtId)) return true;
  return !form.city.trim() || !form.district.trim() || !form.street.trim();
}

/** What the address book API takes. */
export function storeAddressPayload(
  form: StoreAddressFormState,
  countryCode: string,
  defaultLabel: string,
) {
  return {
    addressType: 'shipping' as const,
    label:
      form.label.trim() ||
      [form.district.trim(), form.city.trim()].filter(Boolean).join('، ') ||
      defaultLabel,
    countryId: form.countryId,
    cityId: form.cityId,
    districtId: form.districtId,
    city: form.city,
    district: form.district,
    street: form.street,
    building: form.building || null,
    notes: form.notes || null,
    isDefault: form.isDefault,
    countryCode: form.countryId ? null : countryCode,
    latitude: form.latitude,
    longitude: form.longitude,
  };
}

type Props = {
  form: StoreAddressFormState;
  setForm: React.Dispatch<React.SetStateAction<StoreAddressFormState>>;
  /** Prefix for field ids (two forms on one page). */
  idPrefix?: string;
  /** Show «اجعله العنوان الافتراضي». */
  showDefault?: boolean;
  mapHeight?: number;
};

export function StoreAddressFields({
  form,
  setForm,
  idPrefix = 'addr',
  showDefault = true,
  mapHeight = 260,
}: Props) {
  const t = useTranslations('storefront');
  const locale = useLocale();
  const companyId = getStorefrontCompanyId();
  const country = useStoreCountry();
  const { data: geoCountries = [] } = usePublicGeoCountries(companyId, Boolean(companyId));
  const useGeoCascade = geoCountries.length > 0;
  // The store delivers in its own country: shown, not chosen.
  const storeGeoCountry =
    geoCountries.find((row) => row.code?.toUpperCase() === country.code.toUpperCase()) ??
    geoCountries[0] ??
    null;

  React.useEffect(() => {
    if (!storeGeoCountry) return;
    setForm((prev) =>
      prev.countryId === storeGeoCountry.id
        ? prev
        : {
            ...prev,
            countryId: storeGeoCountry.id,
            cityId: null,
            districtId: null,
            city: '',
            district: '',
          },
    );
  }, [storeGeoCountry, setForm]);

  const countryName =
    locale === 'en'
      ? (storeGeoCountry?.nameEn ?? country.nameEn)
      : (storeGeoCountry?.nameAr ?? country.nameAr);

  return (
    <div className="space-y-3">
      {useGeoCascade ? (
        <>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {t('checkout.countryLocked', { country: countryName })}
          </p>
          <GeoCascadeSelect
            companyId={companyId}
            mode="public"
            showCountry={false}
            autoSelectSingle
            value={{
              countryId: form.countryId,
              cityId: form.cityId,
              districtId: form.districtId,
              countryCode: null,
              city: form.city,
              district: form.district,
            }}
            onChange={(geo: GeoCascadeValue) =>
              setForm((prev) => ({
                ...prev,
                countryId: geo.countryId,
                cityId: geo.cityId,
                districtId: geo.districtId,
                city: geo.city,
                district: geo.district,
              }))
            }
            labels={{
              country: t('checkout.country'),
              city: t('checkout.city'),
              district: t('checkout.district'),
            }}
            className="sm:grid-cols-2"
          />
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-city`}>{t('checkout.city')}</Label>
            <Input
              id={`${idPrefix}-city`}
              value={form.city}
              onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-district`}>{t('checkout.district')}</Label>
            <Input
              id={`${idPrefix}-district`}
              value={form.district}
              onChange={(e) => setForm((prev) => ({ ...prev, district: e.target.value }))}
              required
            />
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-street`}>{t('checkout.street')}</Label>
        <Input
          id={`${idPrefix}-street`}
          value={form.street}
          onChange={(e) => setForm((prev) => ({ ...prev, street: e.target.value }))}
          required
        />
      </div>
      <div className="space-y-2">
        <div className="space-y-1">
          <Label>{t('checkout.mapLocation')}</Label>
          <p className="text-xs text-muted-foreground">{t('checkout.mapLocationHint')}</p>
        </div>
        <GoogleLocationPicker
          value={
            form.latitude != null && form.longitude != null
              ? { lat: form.latitude, lng: form.longitude, address: form.mapAddress }
              : null
          }
          onLocationChange={(location: GoogleLocationValue) =>
            setForm((prev) => ({
              ...prev,
              latitude: location.lat,
              longitude: location.lng,
              mapAddress: location.address,
              street: prev.street.trim() ? prev.street : location.address,
            }))
          }
          height={mapHeight}
          region={country.mapRegion}
          className="min-w-0 max-w-full"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-notes`}>{t('checkout.notes')}</Label>
        <Textarea
          id={`${idPrefix}-notes`}
          value={form.notes}
          onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          placeholder={t('checkout.notesPlaceholder')}
          rows={2}
        />
      </div>
      {showDefault ? (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
          />
          {t('account.addresses.setDefault')}
        </label>
      ) : null}
    </div>
  );
}
