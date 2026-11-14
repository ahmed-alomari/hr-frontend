import type { Brand } from '@/features/ecommerce/domain/types/brand';
import type { StorefrontBrand } from '@/features/ecommerce/storefront/domain/storefront-models';
import type { StorefrontLocale } from '@/i18n/routing';
import { resolveLocalizedText, type LocalizableString } from '@/features/ecommerce/storefront/domain/localizable';
import { resolveUploadUrl } from '@/shared/resolve-upload-url';

function resolveName(brand: Brand, locale: StorefrontLocale): string {
  const localized = (brand as Brand & { name?: LocalizableString }).name;
  if (localized) return resolveLocalizedText(localized, locale);
  return locale === 'en' && brand.nameEn ? brand.nameEn : brand.nameAr;
}

function resolveDescription(brand: Brand, locale: StorefrontLocale): string {
  const localized = (brand as Brand & { description?: LocalizableString }).description;
  if (localized) return resolveLocalizedText(localized, locale);
  if (typeof brand.description === 'string') return brand.description;
  return '';
}

export function mapStorefrontBrand(brand: Brand, locale: StorefrontLocale): StorefrontBrand {
  const name = resolveName(brand, locale);
  return {
    id: brand.id,
    companyId: brand.companyId,
    slug: brand.slug,
    name,
    nameAr: brand.nameAr,
    nameEn: brand.nameEn ?? null,
    description: resolveDescription(brand, locale),
    websiteUrl: brand.websiteUrl ?? null,
    logoUrl: brand.logo?.url ? resolveUploadUrl(brand.logo.url) || null : null,
    metaTitle: brand.seo.metaTitle || name,
    metaDescription: brand.seo.metaDescription || resolveDescription(brand, locale),
  };
}

export function mapStorefrontBrands(brands: Brand[], locale: StorefrontLocale): StorefrontBrand[] {
  return brands.map((brand) => mapStorefrontBrand(brand, locale));
}
