'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/shared/utils';

type PageHeaderPrimaryButtonProps = ButtonProps & {
  icon: React.ElementType;
  label: string;
  /** Saving or sending: the icon spins (the label is hidden on small screens) and the button is disabled. */
  loading?: boolean;
};

/** Primary topbar action — icon-only on small screens, icon + label from sm up. */
export function PageHeaderPrimaryButton({
  icon: Icon,
  label,
  loading = false,
  className,
  children,
  disabled,
  ...props
}: PageHeaderPrimaryButtonProps) {
  const ShownIcon = loading ? Loader2 : Icon;
  return (
    <Button
      variant="luxe"
      size="sm"
      aria-label={label}
      aria-busy={loading || undefined}
      className={cn('h-8 shrink-0 gap-1.5 px-2 sm:px-3', className)}
      disabled={disabled || loading}
      {...props}
    >
      <ShownIcon className={cn('h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4', loading && 'animate-spin')} />
      <span className="hidden sm:inline">{children ?? label}</span>
    </Button>
  );
}
