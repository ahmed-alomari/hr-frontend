import { z } from 'zod';

export {
  ATTRIBUTE_DISPLAY_OPTIONS,
  VARIANT_CREATION_OPTIONS,
  attributeDisplayTypeHintAr,
  attributeDisplayTypeLabelAr,
  normalizeVariantCreationMode,
  type AttributeDisplayTypeValue,
} from '@/features/catalog/attributes/constants/attribute-options';

const hexColor = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'لون غير صالح — استخدم #RGB أو #RRGGBB')
  .optional()
  .or(z.literal(''));

const valueSchema = z.object({
  id: z.string(),
  nameAr: z.string().trim().min(1, 'القيمة مطلوبة'),
  freeText: z.string().trim().optional().or(z.literal('')),
  defaultExtraPrice: z.coerce.number().min(0).optional(),
  colorHex: hexColor,
  imageUrl: z
    .union([z.string().trim().url('رابط الصورة غير صالح'), z.literal('')])
    .optional(),
});

export const catalogAttributeFormSchema = z
  .object({
    nameAr: z.string().trim().min(1, 'اسم الخاصية مطلوب'),
    displayType: z.enum(['radio', 'pills', 'select', 'color', 'image', 'multi']),
    createVariant: z.enum(['always', 'never']),
    isActive: z.boolean(),
    values: z.array(valueSchema).min(1, 'أضف قيمة واحدة على الأقل'),
  })
  .superRefine((data, ctx) => {
    data.values.forEach((value, index) => {
      if (data.displayType === 'color' && !value.colorHex?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'لون القيمة مطلوب',
          path: ['values', index, 'colorHex'],
        });
      }
      if (data.displayType === 'image' && !value.imageUrl?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'صورة القيمة مطلوبة',
          path: ['values', index, 'imageUrl'],
        });
      }
    });
  });

export type CatalogAttributeFormValues = z.infer<typeof catalogAttributeFormSchema>;
export type CatalogAttributeFormInput = z.input<typeof catalogAttributeFormSchema>;

export function createEmptyAttributeValue() {
  return {
    id: `val-${Math.random().toString(36).slice(2, 9)}`,
    nameAr: '',
    freeText: '',
    defaultExtraPrice: 0,
    colorHex: '',
    imageUrl: '',
  };
}

export const CATALOG_ATTRIBUTE_FORM_DEFAULTS: CatalogAttributeFormInput = {
  nameAr: '',
  displayType: 'radio',
  createVariant: 'always',
  isActive: true,
  values: [createEmptyAttributeValue()],
};
