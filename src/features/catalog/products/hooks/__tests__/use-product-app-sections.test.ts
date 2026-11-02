import {
  PRODUCT_INVENTORY_DOCS,
  productAppSectionsFrom,
  productsSellLocallyFrom,
  visibleRelatedDocs,
} from '@/features/catalog/products/hooks/use-product-app-sections';
import { companyAppsFrom } from '@/shared/modules/company-apps';
import { isModuleEnabledFor } from '@/shared/modules/registry';

const sections = (codes: string[] | null) => productAppSectionsFrom(companyAppsFrom(codes));
const DOCS = [{ key: 'variants' }, ...PRODUCT_INVENTORY_DOCS];
const docs = (codes: string[] | null) =>
  visibleRelatedDocs(DOCS, companyAppsFrom(codes)).map((d) => d.key);

describe('product app sections (phase 2.5)', () => {
  it('follows the apps the company itself has enabled', () => {
    expect(sections(['catalog', 'inventory'])).toEqual({ inventory: true, store: false, pos: false });
    expect(sections(['catalog', 'store-admin'])).toEqual({ inventory: false, store: true, pos: false });
    expect(sections(['catalog'])).toEqual({ inventory: false, store: false, pos: false });
    expect(sections(['catalog', 'pos']).pos).toBe(true);
  });

  // 2026-10-25: inventory parts showed on a product of a company without
  // inventory (System Owner bypass) and every one of them answered 403.
  it('shows no other app’s section until the company’s apps are known', () => {
    expect(sections(null)).toEqual({ inventory: false, store: false, pos: false });
  });

  it('hides stock shortcuts without inventory', () => {
    // Putaway rules are hidden until something applies them (putaway-feature).
    expect(docs(['catalog', 'inventory'])).toEqual(
      DOCS.map((d) => d.key).filter((k) => k !== 'putaway'),
    );
    expect(docs(['catalog', 'store-admin'])).toEqual(['variants']);
    expect(docs(null)).toEqual(['variants']);
  });

  it('registers the catalog app', () => {
    expect(isModuleEnabledFor('catalog', 'c1', { enabledApplicationCodes: ['catalog'] })).toBe(true);
    expect(isModuleEnabledFor('catalog', 'c1', { enabledApplicationCodes: ['hr'] })).toBe(false);
  });
});

describe('a channel sells from the product quantity (§21)', () => {
  it('when the store or the point of sale is enabled without its inventory bridge', () => {
    const local = (codes: string[] | null) => productsSellLocallyFrom(companyAppsFrom(codes));
    expect(local(['catalog', 'store-admin'])).toBe(true);
    expect(local(['catalog', 'store-admin', 'inventory'])).toBe(true);
    expect(local(['catalog', 'store-admin', 'inventory', 'store-stock-sync'])).toBe(false);
    expect(local(['catalog', 'inventory'])).toBe(false);
    // The point of sale alone, with or without its bridge.
    expect(local(['catalog', 'pos'])).toBe(true);
    expect(local(['catalog', 'pos', 'inventory', 'pos-stock-sync'])).toBe(false);
    // Both linked: nothing sells from the product quantity.
    expect(
      local(['catalog', 'store-admin', 'pos', 'inventory', 'store-stock-sync', 'pos-stock-sync']),
    ).toBe(false);
    // One channel still unlinked is enough.
    expect(local(['catalog', 'store-admin', 'pos', 'inventory', 'store-stock-sync'])).toBe(true);
    // Not known yet: neither way is shown.
    expect(local(null)).toBe(false);
  });
});
