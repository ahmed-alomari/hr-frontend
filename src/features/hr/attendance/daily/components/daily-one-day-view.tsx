'use client';

import * as React from 'react';
import {
  Plus, X, Clock, LogIn, LogOut, Coffee,
  Loader2, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, dialogFormFooterClass } from '@/components/ui/dialog';
import { useDefaultCompanyId } from '@/features/hr/organization/lib/default-company-id';
import {
  attendanceEventsApi,
  type AttendanceEventResponseDto,
  type AttendanceEventType,
  type AttendanceEventSource,
} from '@/features/hr/attendance/lib/api/attendance-events';
import { Input } from '@/components/ui/input';
import ModernTimePicker from '@/components/ui/modern-time-picker';
import { Search } from 'lucide-react';
import type { AttendanceDaySummary, AttendanceEvent } from '@/features/hr/attendance/lib/types';
import { minutesFromMidnight } from '@/features/hr/attendance/lib/utils';
import { resolveVisualKey } from '@/features/hr/attendance/daily/utils/daily-attendance-status-resolve';
import { STATUS } from '@/features/hr/attendance/daily/constants/daily-attendance-status';
import { fmtDayFull } from '@/features/hr/attendance/daily/utils/daily-attendance-format';
import { DailyAttendanceLegend } from '@/features/hr/attendance/daily/components/daily-attendance-legend';
import { DailyDayDetailDialog } from '@/features/hr/attendance/daily/components/daily-day-detail-dialog';
import { useNextEventType } from '@/features/hr/attendance/daily/hooks/useNextEventType';
import {
  RegisterEventTypePicker,
  type RegisterableEventType,
} from '@/features/hr/attendance/daily/components/register-event-type-picker';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';

// ─── constants ─────────────────────────────────────────────────────────────────

const TOTAL_MINS = 24 * 60;
/** Hour buckets 0–23 (00:00 → 23:00), displayed as 12-hour with ص / م. */
const HOUR_BUCKETS = Array.from({ length: 24 }, (_, i) => i);

function minsToPct(mins: number) {
  return `${(mins / TOTAL_MINS) * 100}%`;
}

function minsTo12HourParts(mins: number): { hour: number; period: 'ص' | 'م'; bucket: number } {
  const bucket = Math.min(23, Math.max(0, Math.floor(mins / 60)));
  const h24 = bucket;
  if (h24 === 0) return { hour: 12, period: 'ص', bucket };
  if (h24 < 12) return { hour: h24, period: 'ص', bucket };
  if (h24 === 12) return { hour: 12, period: 'م', bucket };
  return { hour: h24 - 12, period: 'م', bucket };
}

function formatHoverTime12(mins: number): string {
  const minute = mins % 60;
  const h24 = Math.floor(mins / 60) % 24;
  let h12: number;
  let period: 'ص' | 'م';
  if (h24 === 0) {
    h12 = 12;
    period = 'ص';
  } else if (h24 < 12) {
    h12 = h24;
    period = 'ص';
  } else if (h24 === 12) {
    h12 = 12;
    period = 'م';
  } else {
    h12 = h24 - 12;
    period = 'م';
  }
  return `${h12}:${String(minute).padStart(2, '0')} ${period}`;
}

function formatIsoTime12(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return formatHoverTime12(minutesFromMidnight(iso));
}

function resolvePunchTimes(
  summary: AttendanceDaySummary,
  events: AttendanceEventResponseDto[],
): { checkIn: string | null; checkOut: string | null } {
  const active = events.filter((e) => !e.isVoided);
  const checkInEvent = active.find((e) => e.eventType === 'check_in');
  const checkOutEvent = [...active].reverse().find((e) => e.eventType === 'check_out');
  const checkInIso = checkInEvent?.occurredAt ?? summary.actualCheckInAt ?? null;
  const checkOutIso = checkOutEvent?.occurredAt ?? summary.actualCheckOutAt ?? null;

  return {
    checkIn: formatIsoTime12(checkInIso),
    checkOut: formatIsoTime12(checkOutIso),
  };
}

function HourAxis({ activeBucket }: { activeBucket: number | null }) {
  return (
    <div className="relative w-full select-none overflow-visible" aria-hidden>
      <div className="relative h-6 w-full">
        {HOUR_BUCKETS.map((bucket) => {
          const isActive = activeBucket === bucket;
          const { hour, period } = minsTo12HourParts(bucket * 60);
          const mins = bucket * 60;
          return (
            <span
              key={bucket}
              className={cn(
                'absolute top-0 whitespace-nowrap font-mono text-[10px] leading-none tabular-nums sm:text-[11px]',
                isActive
                  ? 'font-bold text-primary'
                  : bucket % 6 === 0
                    ? 'text-muted-foreground/70'
                    : 'text-muted-foreground/35',
              )}
              style={{
                left: minsToPct(TOTAL_MINS - mins),
                transform: bucket === 0 ? 'translateX(50%)' : bucket === 23 ? 'translateX(-100%)' : 'translateX(-50%)',
              }}
            >
              {hour}
              <span className={cn('ms-px text-[9px] sm:text-[10px]', isActive ? 'text-primary' : 'text-muted-foreground/50')}>
                {period}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// Hex colors for event ticks (used in inline styles only — not theme tokens)
const EVENT_TICK_COLOR: Record<AttendanceEventType, string> = {
  check_in:    '#22c55e',
  check_out:   '#ef4444',
  break_start: '#f59e0b',
  break_end:   '#f97316',
};

const SOURCE_LABEL: Partial<Record<AttendanceEventSource, string>> = {
  mobile_app: 'تطبيق الجوال',
  manual_hr:  'يدوي HR',
};

function getMarkerStyle(
  eventType: 'check_in' | 'check_out',
  source: AttendanceEventSource | null | undefined,
): { badgeBg: string; lineColor: string; textColor: string } {
  const isHr = source === 'manual_hr';
  const isMobile = source === 'mobile_app';

  if (eventType === 'check_in') {
    if (isHr) return { badgeBg: '#15803d', lineColor: '#15803d', textColor: '#ffffff' };
    if (isMobile) return { badgeBg: '#bbf7d0', lineColor: '#86efac', textColor: '#14532d' };
    return { badgeBg: '#22c55e', lineColor: '#22c55e', textColor: '#ffffff' };
  }

  if (isHr) return { badgeBg: '#b91c1c', lineColor: '#b91c1c', textColor: '#ffffff' };
  if (isMobile) return { badgeBg: '#fecaca', lineColor: '#fca5a5', textColor: '#7f1d1d' };
  return { badgeBg: '#ef4444', lineColor: '#ef4444', textColor: '#ffffff' };
}

const EVENT_TYPE_META: Record<AttendanceEventType, { labelAr: string; icon: React.ElementType }> = {
  check_in:    { labelAr: 'دخول',           icon: LogIn  },
  check_out:   { labelAr: 'خروج',           icon: LogOut },
  break_start: { labelAr: 'بداية استراحة',  icon: Coffee },
  break_end:   { labelAr: 'نهاية استراحة',  icon: Coffee },
};

const REGISTER_SUCCESS_MSG: Record<RegisterableEventType, string> = {
  check_in:  'تم تسجيل الحضور بنجاح',
  check_out: 'تم تسجيل الانصراف بنجاح',
};

// Status → timeline fill class (using Tailwind design-token colors)
const STATUS_BAR_CLASS: Record<string, string> = {
  present:     'bg-success/20 border-success/40',
  partial:     'bg-warning/20 border-warning/40',
  late:        'bg-warning/20 border-warning/40',
  absent:      'bg-destructive/15 border-destructive/30',
  early_leave: 'bg-warning/20 border-warning/40',
  holiday:     'bg-purple-500/15 border-purple-500/30 dark:bg-purple-500/20',
  rest_day:    'bg-muted/60 border-border',
  unscheduled: 'bg-muted/40 border-border',
  on_leave:    'bg-blue-500/15 border-blue-500/30 dark:bg-blue-500/20',
};

function pct(mins: number) { return minsToPct(mins); }

/** Keep centered badges from overflowing the track at day start/end (RTL: end = physical left). */
const EDGE_ALIGN_MINS = 90;

function edgeCrossAlign(mins: number): 'items-start' | 'items-end' | 'items-center' {
  if (mins <= EDGE_ALIGN_MINS) return 'items-start'; // day start → physical right in RTL → hang inward
  if (mins >= TOTAL_MINS - EDGE_ALIGN_MINS) return 'items-end'; // day end → physical left → hang inward
  return 'items-center';
}

function hoverLabelPosition(hoverMins: number): React.CSSProperties {
  const leftPct = ((TOTAL_MINS - hoverMins) / TOTAL_MINS) * 100;
  const edgePct = (EDGE_ALIGN_MINS / TOTAL_MINS) * 100;
  if (leftPct <= edgePct) return { left: 0, transform: 'translateX(0)' };
  if (leftPct >= 100 - edgePct) return { left: '100%', transform: 'translateX(-100%)' };
  return { left: `${leftPct}%`, transform: 'translateX(-50%)' };
}

function isoToHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

type TimelineMarker = {
  id: string;
  mins: number;
  timeLabel: string;
  eventType: 'check_in' | 'check_out';
  source?: AttendanceEventSource | null;
  event?: AttendanceEventResponseDto;
  stackOffset?: number;
};

function EventTickMarker({
  marker,
  onClick,
}: {
  marker: TimelineMarker;
  onClick: () => void;
}) {
  const style = getMarkerStyle(marker.eventType, marker.source);
  const label = EVENT_TYPE_META[marker.eventType]?.labelAr;
  const sourceLabel = marker.source ? SOURCE_LABEL[marker.source] : undefined;
  const title = [label, marker.timeLabel, sourceLabel, '— انقر لعرض تفاصيل اليوم'].filter(Boolean).join(' ');
  const stackShift = marker.stackOffset ?? 0;

  const content = (
    <>
      <span
        className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums leading-none shadow-sm ring-1 ring-black/10"
        style={{ backgroundColor: style.badgeBg, color: style.textColor }}
      >
        {marker.timeLabel}
      </span>
      <span
        className="mt-px w-2.5 flex-1 rounded-full transition-all group-hover/tick:w-3"
        style={{ backgroundColor: style.lineColor }}
      />
    </>
  );

  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'group/tick absolute bottom-0 top-0 z-[4] flex w-0 cursor-pointer flex-col opacity-90 transition-opacity hover:opacity-100 hover:z-[6]',
        edgeCrossAlign(marker.mins),
      )}
      style={{
        insetInlineStart: pct(marker.mins),
        transform: stackShift ? `translateX(${stackShift}px)` : undefined,
      }}
    >
      {content}
    </button>
  );
}

// ─── 24h timeline bar (with hover scrubber) ───────────────────────────────────

function pointerMinsFromRtlBar(el: HTMLElement, clientX: number): number {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0) return 0;
  const fromInlineStart = rect.right - clientX;
  const ratio = Math.max(0, Math.min(1, fromInlineStart / rect.width));
  return Math.round(ratio * TOTAL_MINS);
}

function TimelineBar({
  summary,
  events,
  onOpenDayDetail,
}: {
  summary: AttendanceDaySummary;
  events: AttendanceEventResponseDto[];
  onOpenDayDetail: () => void;
}) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [hoverMins, setHoverMins] = React.useState<number | null>(null);

  const updateHover = React.useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    setHoverMins(pointerMinsFromRtlBar(el, clientX));
  }, []);

  const vk = resolveVisualKey(summary.status);
  const barClass = STATUS_BAR_CLASS[vk] ?? STATUS_BAR_CLASS.unscheduled;
  const isFullCover = vk === 'holiday' || vk === 'rest_day' || vk === 'on_leave' || vk === 'absent';

  const activeEvents = events.filter((e) => !e.isVoided);
  const sorted = [...activeEvents].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const expectedIn = summary.expectedStartAt ? minutesFromMidnight(summary.expectedStartAt) : null;
  const expectedOut = summary.expectedEndAt ? minutesFromMidnight(summary.expectedEndAt) : null;

  const markers = React.useMemo(() => {
    const result: TimelineMarker[] = sorted
      .filter((e) => e.eventType === 'check_in' || e.eventType === 'check_out')
      .map((e) => ({
        id: e.id,
        mins: minutesFromMidnight(e.occurredAt),
        timeLabel: isoToHHMM(e.occurredAt),
        eventType: e.eventType as 'check_in' | 'check_out',
        source: e.source,
        event: e,
      }));

    const hasCheckIn = result.some((m) => m.eventType === 'check_in');
    const hasCheckOut = result.some((m) => m.eventType === 'check_out');

    if (!hasCheckIn && summary.actualCheckInAt) {
      result.push({
        id: 'summary-check-in',
        mins: minutesFromMidnight(summary.actualCheckInAt),
        timeLabel: isoToHHMM(summary.actualCheckInAt),
        eventType: 'check_in',
      });
    }
    if (!hasCheckOut && summary.actualCheckOutAt) {
      result.push({
        id: 'summary-check-out',
        mins: minutesFromMidnight(summary.actualCheckOutAt),
        timeLabel: isoToHHMM(summary.actualCheckOutAt),
        eventType: 'check_out',
      });
    }

    return result.sort((a, b) => a.mins - b.mins);
  }, [sorted, summary.actualCheckInAt, summary.actualCheckOutAt]);

  const markersWithStack = React.useMemo(() => {
    const minsSeen = new Map<number, number>();
    return markers.map((m) => {
      const idx = minsSeen.get(m.mins) ?? 0;
      minsSeen.set(m.mins, idx + 1);
      return { ...m, stackOffset: idx * 14 };
    });
  }, [markers]);

  return (
    <div
      ref={trackRef}
      className="relative cursor-crosshair overflow-visible"
      onPointerMove={(e) => updateHover(e.clientX)}
      onPointerLeave={() => setHoverMins(null)}
    >
      {/* Hover time card — floats above the bar; edge-clamped so it never clips */}
      {hoverMins !== null && (
        <div
          className="pointer-events-none absolute -top-7 z-20 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-0.5 text-[11px] font-medium text-popover-foreground shadow-elevated"
          style={hoverLabelPosition(hoverMins)}
        >
          <span className="font-mono tabular-nums text-primary">{formatHoverTime12(hoverMins)}</span>
        </div>
      )}

      <div className="relative h-11 w-full overflow-visible rounded-lg border border-border/50 bg-muted/20" dir="rtl">
        {/* Hour grid — every hour boundary */}
        {Array.from({ length: 25 }, (_, h) => (
          <div
            key={h}
            className={cn(
              'absolute top-0 h-full w-px',
              h === 0 || h === 12 || h === 24
                ? 'bg-border/55'
                : h % 6 === 0
                  ? 'bg-border/45'
                  : 'bg-border/15',
            )}
            style={{ insetInlineStart: minsToPct(h * 60) }}
          />
        ))}

        {/* Hover position — dotted vertical line */}
        {hoverMins !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 h-full w-0 border-s-2 border-dotted border-primary/75"
            style={{ insetInlineStart: minsToPct(hoverMins) }}
          />
        )}

        {/* Full-cover fill (holiday / rest / leave / absent) */}
        {isFullCover && (
          <div
            className={cn('absolute inset-0 border', barClass)}
            style={vk === 'absent' ? {
              backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 5px, hsl(var(--destructive)/0.06) 5px, hsl(var(--destructive)/0.06) 6px)',
            } : undefined}
          />
        )}

        {/* Expected shift window */}
        {expectedIn !== null && expectedOut !== null && !isFullCover && (
          <div
            className="absolute top-2 h-7 rounded-md border border-border/40 bg-muted/50"
            style={{ insetInlineStart: pct(expectedIn), width: pct(Math.max(expectedOut - expectedIn, 0)) }}
          />
        )}

        {/* Check-in / check-out markers — one green line, one red line */}
        {markersWithStack.map((marker) => (
          <EventTickMarker key={marker.id} marker={marker} onClick={onOpenDayDetail} />
        ))}

        {/* Voided ticks */}
        {events.filter((e) => e.isVoided).map((e) => {
          const mins = minutesFromMidnight(e.occurredAt);
          return (
            <div
              key={e.id}
              title={`ملغى — ${EVENT_TYPE_META[e.eventType]?.labelAr}`}
              className="absolute top-0 h-full w-px bg-muted-foreground/25"
              style={{ insetInlineStart: pct(mins), transform: 'translateX(-50%)' }}
            />
          );
        })}

        {/* Live now cursor */}
        <NowCursor workDate={summary.date} />
      </div>
    </div>
  );
}

function NowCursor({ workDate }: { workDate: string }) {
  const [nowMins, setNowMins] = React.useState<number | null>(null);
  const [nowLabel, setNowLabel] = React.useState('');

  React.useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (workDate !== today) return;

    const tick = () => {
      const n = new Date();
      setNowMins(n.getHours() * 60 + n.getMinutes());
      setNowLabel(`${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`);
    };

    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [workDate]);

  if (nowMins === null) return null;

  return (
    <div
      className={cn(
        'pointer-events-none absolute bottom-0 top-0 z-[5] flex w-0 flex-col',
        edgeCrossAlign(nowMins),
      )}
      style={{ insetInlineStart: pct(nowMins) }}
    >
      <span className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums leading-none text-muted-foreground shadow-sm">
        {nowLabel}
      </span>
      <span className="mt-px w-px flex-1 bg-primary/70" />
    </div>
  );
}

// ─── employee row ──────────────────────────────────────────────────────────────

type EmployeeRowProps = {
  summary: AttendanceDaySummary;
  events: AttendanceEventResponseDto[];
  workDate: string;
  companyId: string;
  onEventsChange: (employeeId: string, newEvents: AttendanceEventResponseDto[]) => void;
  allEmployees: { id: string; name: string }[];
  onOpenDayDetail: (summary: AttendanceDaySummary) => void;
};

function EmployeeMobileCard({
  summary, events, workDate, companyId, onEventsChange, allEmployees, onOpenDayDetail,
}: EmployeeRowProps) {
  const [addOpen, setAddOpen] = React.useState(false);
  const vk = resolveVisualKey(summary.status);
  const cfg = STATUS[vk];
  const { checkIn, checkOut } = resolvePunchTimes(summary, events);
  const activeEvents = events.filter((e) => !e.isVoided);
  const expectedIn = formatIsoTime12(summary.expectedStartAt);
  const expectedOut = formatIsoTime12(summary.expectedEndAt);

  const openDetail = React.useCallback(() => {
    onOpenDayDetail(summary);
  }, [onOpenDayDetail, summary]);

  return (
    <>
      <div className="border-b border-border/50 last:border-0 lg:hidden">
        <div
          role="button"
          tabIndex={0}
          onClick={openDetail}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(); } }}
          className="flex w-full flex-col gap-2 px-4 py-2.5 text-right transition-colors hover:bg-muted/20 active:bg-muted/30 cursor-pointer"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {summary.employeeName.charAt(0)}
                <span className={cn('absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full border-2 border-card', cfg.dot)} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight">{summary.employeeName}</p>
                <span className={cn('mt-1 inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-medium', cfg.color)}>
                  {cfg.label}
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                setAddOpen(true);
              }}
              title="تسجيل حدث"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border/60 bg-muted/15 px-3 py-2">
              <p className="text-[10px] font-medium text-muted-foreground">دخول</p>
              <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground" dir="ltr">
                {checkIn ?? '—'}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/15 px-3 py-2">
              <p className="text-[10px] font-medium text-muted-foreground">خروج</p>
              <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground" dir="ltr">
                {checkOut ?? '—'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {expectedIn && expectedOut ? (
              <span dir="ltr">الوردية: {expectedIn} – {expectedOut}</span>
            ) : null}
            {activeEvents.length > 0 ? (
              <span>{activeEvents.length} {activeEvents.length === 1 ? 'حدث' : 'أحداث'}</span>
            ) : null}
            <span className="text-primary/80">انقر لعرض التفاصيل</span>
          </div>
        </div>
      </div>

      <RegisterEventComboDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        allEmployees={allEmployees}
        defaultEmployeeId={summary.employeeId}
        workDate={workDate}
        companyId={companyId}
        onCreated={(empId, evt) => onEventsChange(empId, [...events, evt])}
      />
    </>
  );
}

function EmployeeDesktopRow({
  summary, events, workDate, companyId, onEventsChange, allEmployees, onOpenDayDetail,
}: EmployeeRowProps) {
  const [addOpen, setAddOpen] = React.useState(false);

  const vk = resolveVisualKey(summary.status);
  const cfg = STATUS[vk];

  const openDetail = React.useCallback(() => {
    onOpenDayDetail(summary);
  }, [onOpenDayDetail, summary]);

  return (
    <>
      <div className="group hidden border-b border-border/50 last:border-0 transition-colors hover:bg-muted/20 lg:block">
        <div className="grid grid-cols-[11rem_minmax(0,1fr)] items-center gap-2 px-4 py-2">

          {/* Avatar + name */}
          <div className="col-start-1 flex min-w-0 items-center gap-2.5">
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {summary.employeeName.charAt(0)}
              <span className={cn('absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full border-2 border-card', cfg.dot)} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">{summary.employeeName}</p>
              <span className={cn('mt-0.5 inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[9px] font-medium', cfg.color)}>
                {cfg.label}
              </span>
            </div>
          </div>

          {/* 24h timeline — top padding leaves room for the floating hover time badge */}
          <div
            className="col-start-2 min-w-0 pt-7"
            onDoubleClick={() => setAddOpen(true)}
            title="انقر على حدث لعرض التفاصيل · انقر مرتين لتسجيل حدث"
          >
            <TimelineBar summary={summary} events={events} onOpenDayDetail={openDetail} />
          </div>
        </div>
      </div>

      <RegisterEventComboDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        allEmployees={allEmployees}
        defaultEmployeeId={summary.employeeId}
        workDate={workDate}
        companyId={companyId}
        onCreated={(empId, evt) => onEventsChange(empId, [...events, evt])}
      />
    </>
  );
}

function EmployeeRow(props: EmployeeRowProps) {
  return (
    <>
      <EmployeeMobileCard {...props} />
      <EmployeeDesktopRow {...props} />
    </>
  );
}

// ─── single register dialog (employee picker + form in one) ────────────────────

function nowTimeLocal() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function RegisterEventComboDialog({
  open, onOpenChange, allEmployees, defaultEmployeeId, workDate, companyId, onCreated, availableDates,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  allEmployees: { id: string; name: string }[];
  defaultEmployeeId?: string | null;
  workDate: string;
  companyId: string;
  onCreated: (empId: string, evt: AttendanceEventResponseDto) => void;
  availableDates?: string[];
}) {
  const [search, setSearch] = React.useState('');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [selectedDate, setSelectedDate] = React.useState(workDate);
  const [eventType, setEventType] = React.useState<RegisterableEventType>('check_in');
  const [time, setTime] = React.useState(nowTimeLocal);
  const [notes, setNotes] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const showDatePicker = availableDates && availableDates.length > 1;

  const { loading: nextTypeLoading, nextEventType, message: nextTypeMessage, data: nextEventData } = useNextEventType({
    employeeId: selectedId,
    companyId,
    workDate: selectedDate,
    enabled: open && !!selectedId,
  });

  // Reset all state whenever the dialog opens
  React.useEffect(() => {
    if (open) {
      setSearch('');
      setSelectedId(defaultEmployeeId ?? null);
      setSelectedDate(workDate);
      setTime(nowTimeLocal());
      setNotes('');
      setSaving(false);
    }
  }, [open, defaultEmployeeId, workDate]);

  React.useEffect(() => {
    if (open && selectedId && !nextTypeLoading) setEventType(nextEventType);
  }, [open, selectedId, selectedDate, nextTypeLoading, nextEventType]);

  const selectedName = allEmployees.find((e) => e.id === selectedId)?.name ?? '';
  const q = search.trim().toLowerCase();
  const filtered = q ? allEmployees.filter((e) => e.name.toLowerCase().includes(q)) : allEmployees;

  const handleSave = async () => {
    if (!selectedId || !time) return;
    setSaving(true);
    try {
      const [hh, mm] = time.split(':');
      const occurredAt = new Date(`${selectedDate}T${hh}:${mm}:00`).toISOString();
      const res = await attendanceEventsApi.createConfirmingExcluded({
        companyId, employeeId: selectedId, eventType, occurredAt, workDate: selectedDate,
        source: 'manual_hr', notes: notes.trim() || null,
      });
      if (!res) return;
      toast.success(REGISTER_SUCCESS_MSG[eventType]);
      onCreated(selectedId, res);
      onOpenChange(false);
    } catch (err) {
      handleApiError(err, 'attendance/events');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-border" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right font-display text-base">تسجيل حدث حضور</DialogTitle>
          <DialogDescription className="sr-only">تسجيل حدث حضور يدوي لموظف في تاريخ محدد</DialogDescription>
          {!showDatePicker && <p className="text-right text-xs text-muted-foreground" dir="ltr">{selectedDate}</p>}
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Employee selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">الموظف <span className="text-destructive">*</span></Label>
            {selectedId ? (
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="flex w-full items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/8 px-3 py-2 text-right text-sm font-medium text-primary transition-colors hover:bg-primary/12"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold">
                  {selectedName.charAt(0)}
                </div>
                <span className="flex-1">{selectedName}</span>
                <X className="h-3.5 w-3.5 opacity-60" />
              </button>
            ) : (
              <div className="space-y-1.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم…" className="h-9 pr-9 text-sm" dir="rtl" autoFocus />
                </div>
                <div className="max-h-44 overflow-y-auto rounded-lg border border-border bg-muted/10">
                  {filtered.length === 0
                    ? <p className="py-3 text-center text-xs text-muted-foreground">لا يوجد موظف مطابق</p>
                    : filtered.map((e) => (
                      <button key={e.id} type="button" onClick={() => { setSelectedId(e.id); setSearch(''); }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-right text-sm transition-colors hover:bg-accent first:rounded-t-lg last:rounded-b-lg"
                      >
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                          {e.name.charAt(0)}
                        </div>
                        {e.name}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Date selector — shown only for multi-day views */}
          {showDatePicker && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">التاريخ <span className="text-destructive">*</span></Label>
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                dir="ltr"
              >
                {availableDates!.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}

          {/* Event form — only shown after employee is selected */}
          {selectedId && (
            <>
              <RegisterEventTypePicker
                value={eventType}
                onChange={setEventType}
                nextEventType={nextEventType}
                loading={nextTypeLoading}
                message={nextTypeMessage}
                nextEventData={nextEventData}
              />
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">الوقت <span className="text-destructive">*</span></Label>
                <ModernTimePicker
                  value={time}
                  onChange={setTime}
                  placeholder="اختر الوقت"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">ملاحظة (اختياري)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="سبب التعديل اليدوي…" className="min-h-[56px] resize-none text-sm" />
              </div>
            </>
          )}
        </div>

        <DialogFooter className={dialogFormFooterClass}>
          <Button onClick={handleSave} disabled={saving || !selectedId || !time || nextTypeLoading} className="gap-2">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            تسجيل
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── main component ────────────────────────────────────────────────────────────

function toEventDto(e: AttendanceEvent): AttendanceEventResponseDto {
  return {
    id: e.id,
    companyId: '',
    employeeId: e.employeeId,
    employeeNameAr: e.employeeName,
    workDate: e.date,
    eventType: e.type as AttendanceEventType,
    occurredAt: e.at,
    source: (e.source as AttendanceEventResponseDto['source']) ?? 'manual_hr',
    checkInPointId: null,
    checkInPointNameAr: null,
    shiftAssignmentId: null,
    latitude: null,
    longitude: null,
    distanceMeters: null,
    withinRadius: null,
    periodSortOrder: null,
    notes: null,
    isVoided: false,
    voidReason: null,
    voidedAt: null,
    recordedBy: null,
    createdAt: e.at,
  };
}

function buildEventsMap(events: AttendanceEvent[]): Map<string, AttendanceEventResponseDto[]> {
  const m = new Map<string, AttendanceEventResponseDto[]>();
  for (const e of events) {
    if (!m.has(e.employeeId)) m.set(e.employeeId, []);
    m.get(e.employeeId)!.push(toEventDto(e));
  }
  return m;
}

export function DailyOneDayView({
  summaries,
  initialEvents,
  workDate,
  allEmployees,
  className,
}: {
  summaries: AttendanceDaySummary[];
  initialEvents: AttendanceEvent[];
  workDate: string;
  allEmployees: { id: string; name: string }[];
  className?: string;
}) {
  const companyId = useDefaultCompanyId() ?? '';

  const [eventsMap, setEventsMap] = React.useState<Map<string, AttendanceEventResponseDto[]>>(
    () => buildEventsMap(initialEvents),
  );

  React.useEffect(() => {
    setEventsMap(buildEventsMap(initialEvents));
  }, [initialEvents]);

  const handleEventsChange = React.useCallback((employeeId: string, newEvents: AttendanceEventResponseDto[]) => {
    setEventsMap((prev) => new Map(prev).set(employeeId, newEvents));
  }, []);

  const sorted = React.useMemo(
    () => [...summaries].sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'ar')),
    [summaries],
  );

  // Employees who have events on this day but no summary — build stub summaries for them
  const eventOnlyRows = React.useMemo<AttendanceDaySummary[]>(() => {
    const summaryEmpIds = new Set(sorted.map((s) => s.employeeId));
    const extra = new Map<string, string>(); // employeeId → name
    for (const [empId, evts] of eventsMap.entries()) {
      if (!summaryEmpIds.has(empId) && evts.length > 0) {
        const name = evts[0]?.employeeNameAr ?? allEmployees.find((e) => e.id === empId)?.name ?? empId;
        extra.set(empId, name);
      }
    }
    return [...extra.entries()].map(([employeeId, employeeName]) => ({
      id: `stub-${employeeId}`,
      employeeId,
      employeeName,
      date: workDate,
      templateId: null,
      status: 'unscheduled' as AttendanceDaySummary['status'],
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      workedMinutes: 0,
      actualCheckInAt: null,
      actualCheckOutAt: null,
      expectedStartAt: null,
      expectedEndAt: null,
    })).sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'ar'));
  }, [sorted, eventsMap, allEmployees, workDate]);

  const allRows = React.useMemo(() => {
    const rows = [...sorted, ...eventOnlyRows];
    const existing = new Set(rows.map((r) => r.employeeId));
    const stubs = allEmployees
      .filter((e) => !existing.has(e.id))
      .map((e) => ({
        id: `stub-${e.id}`,
        employeeId: e.id,
        employeeName: e.name,
        date: workDate,
        templateId: null,
        status: 'unscheduled' as AttendanceDaySummary['status'],
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeMinutes: 0,
        workedMinutes: 0,
        actualCheckInAt: null,
        actualCheckOutAt: null,
        expectedStartAt: null,
        expectedEndAt: null,
      }));
    return [...rows, ...stubs].sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'ar'));
  }, [sorted, eventOnlyRows, allEmployees, workDate]);

  const totalEvents = React.useMemo(
    () => [...eventsMap.values()].reduce((acc, arr) => acc + arr.filter((e) => !e.isVoided).length, 0),
    [eventsMap],
  );

  const [headerEventsExpanded, setHeaderEventsExpanded] = React.useState(false);
  const [registerDialogOpen, setRegisterDialogOpen] = React.useState(false);
  const [registerDefaultEmpId, setRegisterDefaultEmpId] = React.useState<string | null>(null);
  const [detailSummary, setDetailSummary] = React.useState<AttendanceDaySummary | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  const openDayDetail = React.useCallback((summary: AttendanceDaySummary) => {
    setDetailSummary(summary);
    setDetailOpen(true);
  }, []);

  const summaryByEmployeeId = React.useMemo(() => {
    const map = new Map<string, AttendanceDaySummary>();
    for (const row of allRows) map.set(row.employeeId, row);
    return map;
  }, [allRows]);

  const allDayEvents = React.useMemo(() => {
    const items: { event: AttendanceEventResponseDto; employeeId: string; employeeName: string }[] = [];
    for (const s of allRows) {
      for (const e of eventsMap.get(s.employeeId) ?? []) {
        if (!e.isVoided) {
          items.push({ event: e, employeeId: s.employeeId, employeeName: s.employeeName });
        }
      }
    }
    return items.sort((a, b) => a.event.occurredAt.localeCompare(b.event.occurredAt));
  }, [allRows, eventsMap]);

  const handleHeaderRegister = React.useCallback(() => {
    setRegisterDefaultEmpId(allRows.length === 1 ? allRows[0]!.employeeId : null);
    setRegisterDialogOpen(true);
  }, [allRows]);

  return (
    <div
      className={cn('flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft', className)}
      dir="rtl"
    >
      <DailyDayDetailDialog
        summary={detailSummary}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        companyId={companyId}
      />

      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-2">
        <div>
          <p className="text-sm font-semibold">{fmtDayFull(workDate)}</p>
          <p className="font-mono text-[11px] text-muted-foreground" dir="ltr">{workDate}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => totalEvents > 0 && setHeaderEventsExpanded((v) => !v)}
            disabled={totalEvents === 0}
            className={cn(
              'inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors',
              totalEvents > 0 && 'hover:text-foreground',
            )}
          >
            <span>{totalEvents} حدث</span>
            {totalEvents > 0 && (
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', headerEventsExpanded && 'rotate-180')} />
            )}
          </button>
        </div>
      </div>

      {headerEventsExpanded && allDayEvents.length > 0 && (
        <div className="shrink-0 border-b border-border/50 bg-muted/10 px-4 py-2" dir="rtl">
          {allDayEvents.map(({ event, employeeId, employeeName }, i) => {
            const meta = EVENT_TYPE_META[event.eventType];
            const Icon = meta.icon;
            const isCheckEvent = event.eventType === 'check_in' || event.eventType === 'check_out';
            const markerStyle = isCheckEvent
              ? getMarkerStyle(event.eventType as 'check_in' | 'check_out', event.source)
              : null;
            const dotColor = markerStyle?.lineColor ?? EVENT_TICK_COLOR[event.eventType];
            const sourceLabel = event.source ? SOURCE_LABEL[event.source] : undefined;
            return (
              <button
                key={event.id}
                type="button"
                onClick={() => {
                  const rowSummary = summaryByEmployeeId.get(event.employeeId);
                  if (rowSummary) openDayDetail(rowSummary);
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-3 py-2 text-xs text-right transition-colors hover:bg-muted/40',
                  i > 0 && 'border-t border-border/40',
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />
                  <span className="shrink-0 font-medium text-foreground">{employeeName}</span>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Icon className="h-3 w-3" />
                    <span>{meta.labelAr}</span>
                  </div>
                  {sourceLabel && <span className="text-[10px] text-muted-foreground/80">{sourceLabel}</span>}
                  <span className="font-mono tabular-nums" dir="ltr">{isoToHHMM(event.occurredAt)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Scrollable employee rows */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {allRows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Clock className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">لا سجلات في هذا اليوم</p>
          </div>
        ) : (
          allRows.map((s) => (
            <EmployeeRow
              key={s.id}
              summary={s}
              events={eventsMap.get(s.employeeId) ?? []}
              workDate={workDate}
              companyId={companyId}
              onEventsChange={handleEventsChange}
              allEmployees={allEmployees}
              onOpenDayDetail={openDayDetail}
            />
          ))
        )}
      </div>

      {/* Pinned time axis + legend */}
      {allRows.length > 0 && (
        <div className="shrink-0 border-t border-border/50 bg-card one-day-view-shadow">
          <div className="hidden lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:items-center lg:gap-2 lg:px-4 lg:pt-2.5 lg:pb-1.5">
            <div aria-hidden />
            <HourAxis activeBucket={null} />
          </div>
          <div className="border-t border-border/40 px-4 py-2">
            <DailyAttendanceLegend inline />
          </div>
        </div>
      )}

      <RegisterEventComboDialog
        open={registerDialogOpen}
        onOpenChange={setRegisterDialogOpen}
        allEmployees={allEmployees}
        defaultEmployeeId={registerDefaultEmpId}
        workDate={workDate}
        companyId={companyId}
        onCreated={(empId, evt) => {
          const existing = eventsMap.get(empId) ?? [];
          handleEventsChange(empId, [...existing, evt]);
        }}
      />
    </div>
  );
}
