'use client';

import { FoldedHeaderTool } from '@/components/layouts/phone-fold';
import * as React from 'react';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { PeriodRange } from '@/components/ui/list-filter-bar';
import { cn } from '@/shared/utils';

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function last30Days(today: string): PeriodRange {
  return { from: addDays(today, -29), to: today };
}

export function ReportSummaryCard({ label, value, hint, valueClassName }: { label: string; value: React.ReactNode; hint?: React.ReactNode; valueClassName?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card px-4 py-3 shadow-soft max-sm:px-3 max-sm:py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className={cn('mt-1 text-xl font-semibold tabular-nums', valueClassName)}>{value}</div>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Share of the largest row, as a bar with its percentage of the total. */
export function ShareBar({ value, max, total }: { value: number; max: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex min-w-[7rem] items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
      </div>
      <span className="w-9 shrink-0 text-end text-xs tabular-nums text-muted-foreground" dir="ltr">{pct}%</span>
    </div>
  );
}

export function ReportExportMenu({ onExcel, onCsv, label = 'تصدير التقرير' }: { onExcel?: () => void; onCsv?: () => void; label?: string }) {
  return (
    <FoldedHeaderTool>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-8 w-8 shrink-0" aria-label={label}>
            <FileDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {onExcel ? (
            <DropdownMenuItem onSelect={onExcel}>
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </DropdownMenuItem>
          ) : null}
          {onCsv ? (
            <DropdownMenuItem onSelect={onCsv}>
              <FileDown className="h-4 w-4" />
              CSV (العمليات)
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </FoldedHeaderTool>
  );
}
