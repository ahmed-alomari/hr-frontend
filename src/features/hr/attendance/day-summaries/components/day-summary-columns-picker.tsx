'use client';

import { FoldedHeaderTool } from '@/components/layouts/phone-fold';
import * as React from 'react';
import { Check, Columns3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DAY_SUMMARY_COLUMN_OPTIONS,
  countVisibleDaySummaryColumns,
  type DaySummaryColumnVisibility,
  type DaySummaryOptionalColumnKey,
} from '@/features/hr/attendance/day-summaries/constants/day-summary-column-config';
import { cn } from '@/shared/utils';

const GROUP_LABELS: Record<(typeof DAY_SUMMARY_COLUMN_OPTIONS)[number]['group'], string> = {
  times: 'أوقات التسجيل',
  metrics: 'مؤشرات الدوام',
  actions: 'إجراءات',
};

type DaySummaryColumnsPickerProps = {
  visibility: DaySummaryColumnVisibility;
  onToggle: (key: DaySummaryOptionalColumnKey) => void;
  onReset: () => void;
};

function ColumnIconToggle({
  label,
  shortLabel,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  shortLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-center transition-colors',
        active
          ? 'border-primary bg-primary/10 text-primary shadow-sm'
          : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-muted/30 hover:text-foreground',
      )}
    >
      <span
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-lg border',
          active ? 'border-primary/30 bg-primary/15' : 'border-border/70 bg-muted/25',
        )}
      >
        <Icon className="h-4 w-4" />
        {active ? (
          <span className="absolute -bottom-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-2.5 w-2.5" />
          </span>
        ) : null}
      </span>
      <span className="line-clamp-2 min-h-[2rem] text-[10px] font-medium leading-tight">
        {shortLabel ?? label}
      </span>
    </button>
  );
}

export function DaySummaryColumnsPicker({
  visibility,
  onToggle,
  onReset,
}: DaySummaryColumnsPickerProps) {
  const [open, setOpen] = React.useState(false);
  const visibleCount = countVisibleDaySummaryColumns(visibility);
  const groups = ['times', 'metrics', 'actions'] as const;

  return (
    <FoldedHeaderTool>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-2"
            aria-label="إظهار أعمدة كشف الحضور"
          >
            <Columns3 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">الأعمدة</span>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
              {visibleCount}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(22rem,calc(100vw-2rem))] border-border p-0"
          dir="rtl"
        >
          <div className="border-b border-border/60 px-4 py-3">
            <p className="text-sm font-semibold">أعمدة كشف الحضور</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              اختر الحقول التي تظهر في الجدول — يُحفظ اختيارك تلقائياً
            </p>
          </div>
          <div className="max-h-[min(24rem,60vh)] space-y-4 overflow-y-auto p-4">
            {groups.map((group) => {
              const options = DAY_SUMMARY_COLUMN_OPTIONS.filter((col) => col.group === group);
              return (
                <section key={group} className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    {GROUP_LABELS[group]}
                  </p>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {options.map((col) => (
                      <ColumnIconToggle
                        key={col.key}
                        label={col.label}
                        shortLabel={col.shortLabel}
                        icon={col.icon}
                        active={visibility[col.key]}
                        onClick={() => onToggle(col.key)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5">
            <span className="text-xs text-muted-foreground">{visibleCount} عمود مفعّل</span>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onReset}>
              إعادة الافتراضي
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </FoldedHeaderTool>
  );
}
