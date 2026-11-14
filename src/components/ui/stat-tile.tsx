import { PhoneStatsFold } from '@/components/layouts/phone-fold';
import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/utils';

interface StatTileProps {
  icon?: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'primary' | 'gold' | 'success' | 'destructive';
  loading?: boolean;
  className?: string;
}

const TONE_CLASSES: Record<NonNullable<StatTileProps['tone']>, string> = {
  primary: 'bg-primary-100 text-primary',
  gold: 'bg-gold/15 text-gold',
  success: 'bg-success/10 text-success',
  destructive: 'bg-destructive/10 text-destructive',
};

export function StatTile({ icon: Icon, label, value, hint, tone = 'primary', loading, className }: StatTileProps) {
  return (
    <div
      className={cn(
        'group relative flex items-center gap-4 overflow-hidden rounded-xl border border-border bg-card p-5 shadow-soft transition-shadow hover:shadow-elevated',
        className,
      )}
    >
      {Icon ? (
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', TONE_CLASSES[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      ) : null}
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {loading ? (
          <div className="h-7 w-16 animate-pulse rounded-md bg-muted" />
        ) : (
          <span className="text-2xl font-semibold tabular-nums text-foreground">{value}</span>
        )}
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
    </div>
  );
}

export function StatTileGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <PhoneStatsFold>
      <div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-3', className)}>{children}</div>
    </PhoneStatsFold>
  );
}
