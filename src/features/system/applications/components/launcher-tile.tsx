'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/utils';

export function LauncherTile({
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
  imageSrc,
}: {
  icon: LucideIcon;
  /** Shown instead of the icon (a company logo), on a plain surface. */
  imageSrc?: string | null;
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
            'launcher-square flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-[0.85rem] sm:h-20 sm:w-20',
            imageSrc ? 'border border-border bg-card p-2' : tileClass,
            muted && 'launcher-square-muted grayscale opacity-55',
          )}
        >
          {imageSrc ? (
            <img src={imageSrc} alt="" className="h-full w-full object-contain" />
          ) : (
            <Icon className="launcher-icon h-[1.85rem] w-[1.85rem]" strokeWidth={2} />
          )}
        </span>
        {overlay}
      </span>
      <span className="launcher-label line-clamp-2 min-h-10 text-[0.8125rem] font-semibold leading-snug text-foreground">
        {label}
      </span>
      {caption ? <span className="text-xs text-muted-foreground">{caption}</span> : null}
    </>
  );

  const className =
    'group launcher-tile flex w-[6.5rem] flex-col items-center gap-2 text-center outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-[7.25rem]';

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
