'use client';

import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/shared/utils';

type Props = {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  hint?: boolean;
  className?: string;
};

/** Label/value row used by the entity forms (products, warehouses, …). */
export function EntityFormRow({ label, htmlFor, children, hint, className }: Props) {
  return (
    <div
      className={cn(
        'sto-form-row',
        className,
      )}
    >
      <Label htmlFor={htmlFor} className="text-sm text-muted-foreground">
        {label}
        {hint ? <span className="ms-1 text-xs text-muted-foreground/80">(?)</span> : null}
      </Label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
