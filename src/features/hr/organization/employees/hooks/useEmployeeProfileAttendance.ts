'use client';

import * as React from 'react';
import { toast } from 'sonner';
import type { Employee } from '@/features/hr/organization/employees/types';
import { attendanceEventsApi, type AttendanceEventResponseDto } from '@/features/hr/attendance/lib/api/attendance-events';
import { shiftTemplatesApi, type ShiftTemplateResponseDto } from '@/features/hr/attendance/lib/api/shift-templates';
import {
  hasShiftStarted,
  ksaTodayIso,
  shiftAssignmentsApi,
  type ShiftAssignmentResponseDto,
} from '@/features/hr/attendance/lib/api/shift-assignments';
import { checkInPointLinksApi } from '@/features/hr/attendance/lib/api/check-in-point-links';
import { checkInPointsApi } from '@/features/hr/attendance/lib/api/check-in-points';
import { organizationActiveListStatusQuery } from '@/features/hr/organization/lib/archive-scope';
import { mapCheckInPointLinkResponse } from '@/features/hr/attendance/checkpoint-links/services/check-in-point-links.service';
import { mapCheckInPointResponse } from '@/features/hr/attendance/checkpoints/services/check-in-points.service';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import { fetchAllPaginatedItems } from '@/features/hr/lib/api/client';
import type { AttendanceCheckInPoint, AttendanceCheckInPointLink } from '@/features/hr/attendance/lib/types';
import { employeeAssignmentsApi } from '@/features/hr/organization/employees/lib/api/employee-assignments';
import {
  normalizePeriodRange,
  todayYMD,
} from '@/features/hr/discipline/lib/discipline-date-filter';
import { resolvePrimaryAssignment } from '@/features/hr/organization/employees/services/employee-assignments.service';
import { useDefaultCompanyId } from '@/features/hr/organization/lib/default-company-id';
import { randomUUID } from '@/shared/utils';

export type { AttendanceEventResponseDto, ShiftTemplateResponseDto, ShiftAssignmentResponseDto };

export function useEmployeeProfileAttendance(
  employee: Employee,
  companyIdProp: string | null | undefined,
  enabled = true,
) {
  const defaultCompanyId = useDefaultCompanyId();
  const [resolvedCompanyId, setResolvedCompanyId] = React.useState<string | null>(null);
  const [linksLoadError, setLinksLoadError] = React.useState<string | null>(null);

  const companyId = resolvedCompanyId ?? companyIdProp ?? defaultCompanyId;

  React.useEffect(() => {
    if (!employee.id || !enabled) return;
    let cancelled = false;
    void employeeAssignmentsApi
      .getAll(employee.id)
      .then((rows) => {
        if (cancelled) return;
        const list = Array.isArray(rows) ? rows : [];
        const primary = resolvePrimaryAssignment(list);
        setResolvedCompanyId(primary?.companyId ?? companyIdProp ?? defaultCompanyId);
      })
      .catch(() => {
        if (!cancelled) setResolvedCompanyId(companyIdProp ?? defaultCompanyId);
      });
    return () => { cancelled = true; };
  }, [employee.id, enabled, companyIdProp, defaultCompanyId]);

  const [shiftTemplates, setShiftTemplates] = React.useState<ShiftTemplateResponseDto[]>([]);
  const [shiftAssignments, setShiftAssignments] = React.useState<ShiftAssignmentResponseDto[]>([]);
  const [checkpoints, setCheckpoints] = React.useState<AttendanceCheckInPoint[]>([]);
  const [checkpointLinks, setCheckpointLinks] = React.useState<AttendanceCheckInPointLink[]>([]);

  const [dateBounds, setDateBounds] = React.useState(() => ({
    from: todayYMD(),
    to: todayYMD(),
  }));

  const effectiveRange = React.useMemo(
    () => ({
      from: dateBounds.from || todayYMD(),
      to: dateBounds.to || todayYMD(),
    }),
    [dateBounds.from, dateBounds.to],
  );

  const setAttendanceDateBounds = React.useCallback((range: { from: string; to: string }) => {
    const normalized = normalizePeriodRange(range);
    if (normalized) {
      setDateBounds(normalized);
      return;
    }
    setDateBounds({ from: todayYMD(), to: todayYMD() });
  }, []);

  const [attendanceEvents, setAttendanceEvents] = React.useState<AttendanceEventResponseDto[]>([]);
  const [attendanceEventsLoading, setAttendanceEventsLoading] = React.useState(false);

  const reloadAttendanceLinks = React.useCallback(async () => {
    if (!employee.id) return;
    setLinksLoadError(null);

    const scopedQuery = companyId ? { companyId } : {};

    const [assignRes, linksRes] = await Promise.all([
      shiftAssignmentsApi.getAll({ ...scopedQuery, employeeId: employee.id, limit: 50 }),
      checkInPointLinksApi.getAll({ ...scopedQuery, employeeId: employee.id, limit: 50 }),
    ]);

    const catalogCompanyId =
      companyId
      ?? assignRes.items[0]?.companyId
      ?? linksRes.items[0]?.companyId
      ?? null;

    const catalogScope = catalogCompanyId ? { companyId: catalogCompanyId } : {};

    const tmplRes = await shiftTemplatesApi.getAll({ ...catalogScope, limit: 100, ...organizationActiveListStatusQuery() });

    const linkPointIds = [...new Set(linksRes.items.map((l) => l.checkInPointId))];
    let checkpointItems: AttendanceCheckInPoint[] = [];

    if (linkPointIds.length > 0) {
      const pointsRes = catalogCompanyId
        ? await checkInPointsApi.getAll({ companyId: catalogCompanyId, limit: 200, ...organizationActiveListStatusQuery() })
        : { items: [] as Awaited<ReturnType<typeof checkInPointsApi.getAll>>['items'] };
      const byId = new Map(pointsRes.items.map((p) => [p.id, mapCheckInPointResponse(p)]));

      const resolved = await Promise.all(
        linkPointIds.map(async (id) => {
          const cached = byId.get(id);
          if (cached) return cached;
          try {
            return mapCheckInPointResponse(await checkInPointsApi.getById(id));
          } catch {
            return null;
          }
        }),
      );
      checkpointItems = resolved.filter((p): p is AttendanceCheckInPoint => p != null);
    } else if (catalogCompanyId) {
      const pointsRes = await checkInPointsApi.getAll({ companyId: catalogCompanyId, limit: 200, ...organizationActiveListStatusQuery() });
      checkpointItems = pointsRes.items.map(mapCheckInPointResponse);
    }

    setShiftTemplates(tmplRes.items);
    setShiftAssignments(assignRes.items);
    setCheckpoints(checkpointItems);
    setCheckpointLinks(linksRes.items.map(mapCheckInPointLinkResponse));
  }, [employee.id, companyId]);

  React.useEffect(() => {
    if (!employee.id || !enabled) return;
    let cancelled = false;
    setAttendanceEventsLoading(true);

    void fetchAllPaginatedItems((page, limit) =>
      attendanceEventsApi.getAll({
        employeeId: employee.id,
        page,
        limit,
        ...(companyId ? { companyId } : {}),
        workDateFrom: effectiveRange.from,
        workDateTo: effectiveRange.to,
      }),
    )
      .then((res) => {
        if (!cancelled) setAttendanceEvents(res.items);
      })
      .catch(() => {
        if (!cancelled) setAttendanceEvents([]);
      })
      .finally(() => {
        if (!cancelled) setAttendanceEventsLoading(false);
      });

    return () => { cancelled = true; };
  }, [employee.id, enabled, effectiveRange.from, effectiveRange.to, companyId]);

  React.useEffect(() => {
    if (!employee.id || !enabled) return;
    void reloadAttendanceLinks().catch((err) => {
      const { displayMessage } = handleApiError(err, 'employee-profile.attendance-links');
      setLinksLoadError(displayMessage);
      setShiftTemplates([]);
      setShiftAssignments([]);
      setCheckpoints([]);
      setCheckpointLinks([]);
    });
  }, [employee.id, enabled, reloadAttendanceLinks]);

  const employeeEvents = attendanceEvents;

  const [cpOpen, setCpOpen] = React.useState(false);
  const [cpDate, setCpDate] = React.useState(() => ksaTodayIso());
  const [cpSel, setCpSel] = React.useState<Set<string>>(new Set());
  const [cpQuery, setCpQuery] = React.useState('');
  const [cpUnlinkTarget, setCpUnlinkTarget] = React.useState<string | null>(null);

  const openCpDialog = () => {
    setCpDate(ksaTodayIso());
    setCpSel(new Set());
    setCpQuery('');
    setCpOpen(true);
  };

  const submitCpLink = async () => {
    if (!companyId) {
      toast.error('تعذر تحديد الشركة');
      return;
    }
    if (cpSel.size === 0) return;

    const pairs = [...cpSel].map((checkInPointId) => ({
      employeeId: employee.id,
      checkInPointId,
    }));

    try {
      const res = await checkInPointLinksApi.createBulk({
        companyId,
        links: pairs,
        batchId: randomUUID(),
        effectiveFrom: cpDate,
        linkActive: true,
      });
      setCheckpointLinks((prev) => [
        ...prev,
        ...res.items.map(mapCheckInPointLinkResponse),
      ]);
      toast.success('تم ربط نقاط التسجيل');
      setCpOpen(false);
      setCpSel(new Set());
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'check-in-point-links.create');
      toast.error(displayMessage);
    }
  };

  const [shiftOpen, setShiftOpen] = React.useState(false);
  const [shiftTemplateId, setShiftTemplateId] = React.useState('');
  const [shiftDate, setShiftDate] = React.useState(() => ksaTodayIso());
  const [shiftUnlinkTarget, setShiftUnlinkTarget] = React.useState<string | null>(null);
  /** Last working day when ending a started shift. */
  const [shiftEndDate, setShiftEndDate] = React.useState(() => ksaTodayIso());

  /** A shift that is still running on `date` (or later): a new one changes it from that date. */
  const runningShiftOn = React.useCallback(
    (date: string) =>
      shiftAssignments.find(
        (a) => a.isActive && (a.effectiveTo === null || a.effectiveTo.slice(0, 10) >= date),
      ) ?? null,
    [shiftAssignments],
  );
  const shiftChangeMode = !!runningShiftOn(shiftDate);

  const openShiftDialog = () => {
    const active = shiftTemplates.filter((t) => t.isActive);
    setShiftTemplateId(active[0]?.id ?? '');
    setShiftDate(ksaTodayIso());
    setShiftOpen(true);
  };

  const submitShift = async () => {
    if (!companyId) {
      toast.error('تعذر تحديد الشركة');
      return;
    }
    if (!shiftTemplateId) return;

    try {
      if (runningShiftOn(shiftDate)) {
        // Ends the running shift the day before; earlier days keep their shift.
        await shiftAssignmentsApi.changeShift({
          companyId,
          shiftTemplateId,
          employeeId: employee.id,
          effectiveFrom: shiftDate,
        });
        toast.success(`تم تغيير الدوام من ${shiftDate}`);
      } else {
        await shiftAssignmentsApi.create({
          companyId,
          shiftTemplateId,
          employeeId: employee.id,
          effectiveFrom: shiftDate,
          isActive: true,
        });
        toast.success('تم ربط الشيفت');
      }
      await reloadAttendanceLinks();
      setShiftOpen(false);
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'shift-assignments.create');
      toast.error(displayMessage);
    }
  };

  const shiftUnlinkStarted = React.useMemo(() => {
    const target = shiftAssignments.find((a) => a.id === shiftUnlinkTarget);
    return !!target && hasShiftStarted(target.effectiveFrom);
  }, [shiftAssignments, shiftUnlinkTarget]);

  React.useEffect(() => {
    if (shiftUnlinkTarget) setShiftEndDate(ksaTodayIso());
  }, [shiftUnlinkTarget]);

  /** Started shift: ended on a date (never deleted). Future shift: deleted. */
  const removeAssignment = async (id: string) => {
    const target = shiftAssignments.find((a) => a.id === id);
    try {
      if (target && hasShiftStarted(target.effectiveFrom)) {
        await shiftAssignmentsApi.update(id, { effectiveTo: shiftEndDate });
        await reloadAttendanceLinks();
        toast.success(`انتهى الدوام في ${shiftEndDate}`);
      } else {
        await shiftAssignmentsApi.remove(id);
        setShiftAssignments((prev) => prev.filter((a) => a.id !== id));
        toast.success('تم حذف الدوام المستقبلي');
      }
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'shift-assignments.delete');
      toast.error(displayMessage);
    }
  };

  const removeCheckpointLink = async (id: string) => {
    try {
      await checkInPointLinksApi.remove(id);
      setCheckpointLinks((prev) => prev.filter((l) => l.id !== id));
      toast.success('تم فك ربط النقطة');
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'check-in-point-links.delete');
      toast.error(displayMessage);
    }
  };

  return {
    dateBounds,
    setAttendanceDateBounds,
    effectiveRange,
    attendanceEventsLoading,
    shiftTemplates,
    shiftAssignments,
    checkpoints,
    checkpointLinks,
    employeeEvents,
    cpOpen,
    setCpOpen,
    cpDate,
    setCpDate,
    cpSel,
    setCpSel,
    cpQuery,
    setCpQuery,
    cpUnlinkTarget,
    setCpUnlinkTarget,
    openCpDialog,
    submitCpLink,
    shiftOpen,
    setShiftOpen,
    shiftTemplateId,
    setShiftTemplateId,
    shiftDate,
    setShiftDate,
    shiftUnlinkTarget,
    setShiftUnlinkTarget,
    shiftUnlinkStarted,
    shiftEndDate,
    setShiftEndDate,
    shiftChangeMode,
    openShiftDialog,
    submitShift,
    removeCheckpointLink,
    removeAssignment,
    linksLoadError,
    companyId,
  };
}
