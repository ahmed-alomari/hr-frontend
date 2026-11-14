'use client';

import { PhoneStatsFold } from '@/components/layouts/phone-fold';
import { Clock3, TrendingUp, Users, Timer } from 'lucide-react';
import { cn } from '@/shared/utils';
import { DEFAULT_ABSENT_DAY_HOURS } from '@/features/hr/attendance/daily/constants/daily-attendance-status';
import { fmtDecimalHours } from '@/features/hr/attendance/daily/utils/daily-attendance-format';

export type DailyAttendanceStats = {
  workHours: number;
  lateHours: number;
  absentHours: number;
  avgWorkHours: number;
};

export function DailyAttendanceStatsStrip({ stats }: { stats: DailyAttendanceStats }) {
  const items = [
    {
      label: 'إجمالي ساعات العمل',
      value: `${fmtDecimalHours(stats.workHours)} س`,
      cls: 'text-success',
      bg: 'bg-success/10',
      Icon: Users,
    },
    {
      label: 'إجمالي ساعات التأخير',
      value: `${fmtDecimalHours(stats.lateHours)} س`,
      cls: 'text-warning',
      bg: 'bg-warning/10',
      Icon: Clock3,
    },
    {
      label: `ساعات الغياب (${DEFAULT_ABSENT_DAY_HOURS}س/يوم)`,
      value: `${fmtDecimalHours(stats.absentHours)} س`,
      cls: 'text-destructive',
      bg: 'bg-destructive/10',
      Icon: TrendingUp,
    },
    {
      label: 'متوسط ساعات العمل / سجل',
      value: `${fmtDecimalHours(stats.avgWorkHours)} س`,
      cls: 'text-primary',
      bg: 'bg-primary/10',
      Icon: Timer,
    },
  ] as const;

  return (
    <PhoneStatsFold summary={<>التأخير {fmtDecimalHours(stats.lateHours)} س</>}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-soft">
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', s.bg)}>
              <s.Icon className={cn('h-4 w-4', s.cls)} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] text-muted-foreground">{s.label}</p>
              <p className={cn('font-display text-xl font-bold tabular-nums', s.cls)}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>
    </PhoneStatsFold>
  );
}
