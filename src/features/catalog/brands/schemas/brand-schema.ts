import { z } from 'zod';
import { isValidSlug, SLUG_MESSAGE } from '@/features/catalog/constants/slug';

export const brandFormSchema = z.object({
  nameAr: z.string().trim().min(1, 'اسم العلامة التجارية مطلوب'),
  nameEn: z.string().trim().optional().or(z.literal('')),
  /** Optional — auto-generated from English/Arabic name when empty. */
  slug: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine((value) => !value || isValidSlug(value), { message: SLUG_MESSAGE }),
  description: z.string().trim().optional().or(z.literal('')),
  websiteUrl: z.union([z.string().trim().url('رابط الموقع غير صالح'), z.literal('')]).optional(),
  logoUrl: z.union([z.string().trim().url('رابط الشعار غير صالح'), z.literal('')]).optional(),
  isActive: z.boolean(),
  metaTitle: z.string().trim().optional().or(z.literal('')),
  metaDescription: z.string().trim().optional().or(z.literal('')),
});

export type BrandFormValues = z.infer<typeof brandFormSchema>;

export const BRAND_FORM_DEFAULT_VALUES: BrandFormValues = {
  nameAr: '',
  nameEn: '',
  slug: '',
  description: '',
  websiteUrl: '',
  logoUrl: '',
  isActive: true,
  metaTitle: '',
  metaDescription: '',
};

/** Builds a storefront-safe slug; used when the field is left blank. */
export function buildBrandSlug(values: Pick<BrandFormValues, 'slug' | 'nameEn' | 'nameAr'>): string {
  const explicit = values.slug?.trim().toLowerCase();
  if (explicit) return explicit;

  const source = values.nameEn?.trim() || values.nameAr?.trim() || '';
  const fromText = source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return fromText || `brand-${Date.now().toString(36)}`;
}
