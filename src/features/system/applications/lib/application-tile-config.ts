import type { LucideIcon } from 'lucide-react';
import {
  Calculator,
  ContactRound,
  Crown,
  LayoutGrid,
  Package,
  PackageMinus,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Store,
  Users,
  Wallet,
} from 'lucide-react';
import type { ApplicationResponseDto } from '@/features/system/applications/lib/api/applications';
import { isShopSalesApplicationCode } from '@/features/inventory/admin/constants/shop-sales-app';

const ICON_BY_KEY: Record<string, LucideIcon> = {
  users: Users,
  calculator: Calculator,
  settings: Settings,
  'layout-grid': LayoutGrid,
  'shopping-cart': ShoppingCart,
  'store-admin': Store,
  storefront: ShoppingBag,
  store: Store,
  package: Package,
  contact: ContactRound,
  contacts: ContactRound,
  warehouse: Package,
  'package-minus': PackageMinus,
  'store-stock-sync': PackageMinus,
  pos: ShoppingCart,
  'point-of-sale': ShoppingCart,
  cashier: PackageMinus,
  crown: Crown,
  'system-owner': Crown,
  'company-apps': LayoutGrid,
};

/** Design-token icon surfaces — no hardcoded palette colors. */
const TILE_BY_CODE: Record<string, { tileClass: string }> = {
  hr: { tileClass: 'bg-primary text-primary-foreground' },
  accounting: { tileClass: 'bg-primary-700 text-primary-foreground' },
  system: { tileClass: 'bg-gold text-gold-foreground' },
  'store-admin': { tileClass: 'bg-gold text-gold-foreground' },
  ecommerce: { tileClass: 'bg-gold text-gold-foreground' },
  storefront: { tileClass: 'bg-success text-success-foreground' },
  store: { tileClass: 'bg-success text-success-foreground' },
  catalog: { tileClass: 'bg-primary-700 text-primary-foreground' },
  inventory: { tileClass: 'bg-accent text-accent-foreground' },
  contacts: { tileClass: 'bg-primary text-primary-foreground' },
  'store-stock-sync': { tileClass: 'bg-success text-success-foreground' },
  pos: { tileClass: 'bg-success text-success-foreground' },
  cashier: { tileClass: 'bg-success text-success-foreground' },
  'system-owner': { tileClass: 'bg-primary-700 text-primary-foreground' },
  'company-apps': { tileClass: 'bg-gold text-gold-foreground' },
};

const FALLBACK_TILES = [
  'bg-primary text-primary-foreground',
  'bg-gold text-gold-foreground',
  'bg-success text-success-foreground',
  'bg-accent text-accent-foreground',
  'bg-primary-700 text-primary-foreground',
];

/** Card gradient accents aligned with global tokens. */
export const TILE_SURFACE_ACCENT = [
  'from-primary/12 via-card to-card group-hover:border-primary/30',
  'from-gold/12 via-card to-card group-hover:border-gold/40',
  'from-accent via-card to-card group-hover:border-primary/20',
] as const;

export function resolveApplicationIcon(
  app: Pick<ApplicationResponseDto, 'code'> & { icon?: string | null },
): LucideIcon {
  const key = app.icon?.trim().toLowerCase();
  if (key && ICON_BY_KEY[key]) return ICON_BY_KEY[key]!;
  if (app.code === 'store-admin' || app.code === 'ecommerce') return Store;
  if (app.code === 'storefront' || app.code === 'store') return ShoppingBag;
  if (app.code === 'catalog' || app.code === 'inventory') return Package;
  if (isShopSalesApplicationCode(app.code)) return PackageMinus;
  if (app.code === 'contacts') return ContactRound;
  if (app.code === 'hr') return Users;
  if (app.code === 'accounting') return Calculator;
  if (app.code === 'expenses') return Wallet;
  if (app.code === 'system') return Settings;
  if (app.code === 'system-owner') return Crown;
  if (app.code === 'company-apps') return LayoutGrid;
  return LayoutGrid;
}

export function resolveApplicationTileClass(
  app: Pick<ApplicationResponseDto, 'code'>,
  index: number,
): string {
  const preset = TILE_BY_CODE[app.code];
  if (preset) return preset.tileClass;
  return FALLBACK_TILES[index % FALLBACK_TILES.length]!;
}

export function resolveIndexedTileClass(index: number): string {
  return FALLBACK_TILES[index % FALLBACK_TILES.length]!;
}

export function resolveApplicationSurfaceAccent(index: number): string {
  return TILE_SURFACE_ACCENT[index % TILE_SURFACE_ACCENT.length]!;
}
