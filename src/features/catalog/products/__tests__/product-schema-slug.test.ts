import { categoryFormSchema } from '@/features/catalog/categories/schemas/category-schema';
import { brandFormSchema } from '@/features/catalog/brands/schemas/brand-schema';
import { isValidSlug, SLUG_MESSAGE } from '@/features/catalog/constants/slug';
import {
  PRODUCT_FORM_DEFAULT_VALUES,
  productFormSchema,
} from '@/features/catalog/products/schemas/product-schema';

/** The slug the server made for an imported product (SYS-GENERAL-988). */
const IMPORTED_SLUG = 'صنف-عام-من-ملف-اكسل-اصدار-2';

function slugIssues(slug: string) {
  const result = productFormSchema.safeParse({
    ...PRODUCT_FORM_DEFAULT_VALUES,
    nameAr: 'صنف',
    slug,
    uomLines: [
      {
        id: 'uom-1',
        catalogUomId: '11111111-1111-4111-8111-111111111111',
        nameAr: 'حبة',
        uneceCode: 'H87',
        relativeQuantity: 1,
        isReference: true,
        packagingType: 'unit' as const,
      },
    ],
  });
  return result.success ? [] : result.error.issues.filter((issue) => issue.path[0] === 'slug');
}

describe('slug on save', () => {
  it('accepts the Arabic slug the server generated, so an imported product saves', () => {
    expect(slugIssues(IMPORTED_SLUG)).toEqual([]);
    expect(categoryFormSchema.shape.slug.safeParse('العناية-بالبشرة').success).toBe(true);
    expect(brandFormSchema.shape.slug.safeParse('لوريال-باريس').success).toBe(true);
  });

  it('accepts lowercase Latin slugs with digits', () => {
    expect(slugIssues('viora-022')).toEqual([]);
    expect(isValidSlug('sys-general-001')).toBe(true);
  });

  it('refuses spaces, symbols, capitals and loose hyphens', () => {
    for (const bad of ['صنف عام', 'a/b', 'Viora', '-a', 'a--b', 'a-']) {
      expect(isValidSlug(bad)).toBe(false);
    }
    const issues = slugIssues('صنف عام');
    expect(issues.map((issue) => issue.message)).toEqual([SLUG_MESSAGE]);
  });
});
