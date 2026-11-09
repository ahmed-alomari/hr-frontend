'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/shared/utils';

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  /** Only the width it needs, for the filter bar's single row. Off: fills its container. */
  compact?: boolean;
};

/** Search field sized for `ListFilterBar` `leadingFilters`. */
export function EntityFilterSearchField({
  value,
  onChange,
  placeholder = 'بحث…',
  className,
  inputClassName,
  compact = true,
}: Props) {
  return (
    <div className={cn('relative min-w-0', compact ? 'w-44 flex-none sm:w-56' : 'flex-1 max-sm:basis-full sm:max-w-xs', className)}>
      <Search className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn('h-8 pr-8 text-xs max-sm:text-sm', compact ? 'max-sm:h-9' : 'max-sm:h-10', inputClassName)}
      />
    </div>
  );
}
