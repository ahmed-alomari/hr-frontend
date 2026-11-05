import { z } from 'zod';
import { isValidSlug, SLUG_MESSAGE } from '@/features/catalog/constants/slug';

export const categoryFormSchema = z.object({
  nameAr: z.string().trim().min(1, 'اسم التصنيف مطلوب'),
  nameEn: z.string().trim().optional(),
  slug: z
    .string()
    .trim()
    .refine((value) => value === '' || isValidSlug(value), SLUG_MESSAGE),
  description: z.string().trim().optional(),
  parentId: z.string().nullable(),
  imageUrl: z.union([z.string().trim().url('رابط الصورة غير صالح'), z.literal('')]).optional(),
  displayOrder: z.number().int().min(0),
  isActive: z.boolean(),
  featuredBrandIds: z.array(z.string()),
  metaTitle: z.string().trim().optional(),
  metaDescription: z.string().trim().optional(),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export const CATEGORY_FORM_DEFAULT_VALUES: CategoryFormValues = {
  nameAr: '',
  nameEn: '',
  slug: '',
  description: '',
  parentId: null,
  imageUrl: '',
  displayOrder: 0,
  isActive: true,
  featuredBrandIds: [],
  metaTitle: '',
  metaDescription: '',
};
