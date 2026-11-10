import { ApiError, apiRequest, type PaginatedResult } from '@/features/hr/lib/api/client';

/** The server refused a manual punch that would not count, pending HR's confirmation. */
export function isPunchWillBeExcludedError(err: unknown): err is ApiError {
  if (!(err instanceof ApiError)) return false;
  const inner = err.envelope?.error;
  return (
    !!inner &&
    typeof inner === 'object' &&
    (inner as { error?: unknown }).error === 'PunchWillBeExcluded'
  );
}
import type { ListGroupsResult } from '@/components/ui/list-group';
import { recomputeTodayDaySummaries } from '@/features/hr/attendance/lib/api/recompute-today-day-summaries';
import type { DailyBreakdownCheckInWindow, DailyBreakdownCheckOutWindow, DailyBreakdownPeriod, DailyBreakdownResponseDto, AttendanceEventType, AttendanceEventSource, AttendanceEventResponseDto, AttendanceEventListQuery, CreateAttendanceEventDto, NextEventTypeLastPunch, NextEventTypeResponseDto, NextEventTypeQuery } from '@/features/hr/attendance/types/api/attendance-events';
export type { DailyBreakdownCheckInWindow, DailyBreakdownCheckOutWindow, DailyBreakdownPeriod, DailyBreakdownResponseDto, AttendanceEventType, AttendanceEventSource, AttendanceEventResponseDto, AttendanceEventListQuery, CreateAttendanceEventDto, NextEventTypeLastPunch, NextEventTypeResponseDto, NextEventTypeQuery } from '@/features/hr/attendance/types/api/attendance-events';












export const attendanceEventsApi = {
  async getAll(query?: AttendanceEventListQuery) {
    await recomputeTodayDaySummaries(query?.companyId);
    return apiRequest<PaginatedResult<AttendanceEventResponseDto>>('/attendance/events', { query });
  },
  /** One page of a list (e.g. a group's rows) without first recomputing today's summaries. */
  getPage(query?: AttendanceEventListQuery) {
    return apiRequest<PaginatedResult<AttendanceEventResponseDto>>('/attendance/events', { query });
  },
  /** Event counts of the filtered list, per `groupBy` group and overall. */
  groups(query?: Omit<AttendanceEventListQuery, 'page' | 'limit' | 'sortBy' | 'sortDir' | 'groupValue'>) {
    return apiRequest<ListGroupsResult>('/attendance/events/groups', { query });
  },
  getById(id: string) {
    return apiRequest<AttendanceEventResponseDto>(`/attendance/events/${id}`);
  },
  getDailyBreakdown(params: { employeeId: string; workDate: string; companyId?: string; timezoneOffsetMinutes?: number }) {
    return apiRequest<DailyBreakdownResponseDto>('/attendance/events/daily-breakdown', { query: params });
  },
  getNextEventType(params: NextEventTypeQuery) {
    return apiRequest<NextEventTypeResponseDto>('/attendance/events/next-event-type', { query: params });
  },
  async create(payload: CreateAttendanceEventDto) {
    const result = await apiRequest<AttendanceEventResponseDto>('/attendance/events', { method: 'POST', body: payload });
    await recomputeTodayDaySummaries(payload.companyId);
    return result;
  },
  /**
   * Manual HR entry: a punch the day will not count (outside the employee's
   * shift) is refused by the server first. HR sees why and can still save it.
   * Returns null when HR cancels.
   */
  async createConfirmingExcluded(
    payload: CreateAttendanceEventDto,
    confirm: (messageAr: string) => boolean | Promise<boolean> = (m) =>
      typeof window !== 'undefined' && window.confirm(`${m}\n\nهل تريد حفظها رغم ذلك؟`),
  ): Promise<AttendanceEventResponseDto | null> {
    try {
      return await attendanceEventsApi.create(payload);
    } catch (err) {
      if (!isPunchWillBeExcludedError(err)) throw err;
      if (!(await confirm(err.message))) return null;
      return attendanceEventsApi.create({ ...payload, confirmExcluded: true });
    }
  },
  async void(id: string, voidReason: string) {
    const result = await apiRequest<AttendanceEventResponseDto>(`/attendance/events/${id}/void`, {
      method: 'PATCH',
      body: { voidReason },
    });
    await recomputeTodayDaySummaries();
    return result;
  },
};

