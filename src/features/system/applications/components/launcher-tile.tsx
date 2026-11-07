'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/utils';

export function OdooAppTile({
  icon: Icon,
  label,
  caption,
  tileClass,
  href,
  external,
  hardNavigation,
  onClick,
  muted,
  overlay,
}: {
  icon: LucideIcon;
  label: string;
  caption?: string;
  tileClass: string;
  href?: string;
  external?: boolean;
  /** Full document navigation — required when leaving the ERP shell for `[locale]/store`. */
  hardNavigation?: boolean;
  onClick?: () => void;
  muted?: boolean;
  overlay?: ReactNode;
}) {
  const inner = (
    <>
      <span className="relative">
        <span
          className={cn(
            'odoo-app-square flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-[0.85rem] sm:h-20 sm:w-20',
            tileClass,
            muted && 'odoo-app-square-muted grayscale opacity-55',
          )}
        >
          <Icon className="odoo-app-icon h-[1.85rem] w-[1.85rem]" strokeWidth={2} />
        </span>
        {overlay}
      </span>
      <span className="odoo-app-label line-clamp-2 min-h-10 text-[0.8125rem] font-semibold leading-snug text-foreground">
        {label}
      </span>
      {caption ? <span className="text-xs text-muted-foreground">{caption}</span> : null}
    </>
  );

  const className =
    'group odoo-app-tile flex w-[6.5rem] flex-col items-center gap-2 text-center outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-[7.25rem]';

  if (href && (external || hardNavigation)) {
    return (
      <a
        href={href}
        className={className}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : undefined)}
      >
        {inner}
      </a>
    );
  }

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {inner}
      </button>
    );
  }

  return <div className={className}>{inner}</div>;
}
