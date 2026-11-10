import { apiRequest, type PaginatedResult } from '@/features/hr/lib/api/client';
import type { ShiftAssignmentResponseDto, ShiftAssignmentListQuery, CreateShiftAssignmentDto, BulkCreateShiftAssignmentDto, BulkCreateShiftAssignmentResult, UpdateShiftAssignmentDto, GroupedByTemplateEmployee, GroupedByTemplateItem, GroupedByTemplateQuery, UnassignedEmployeeResponseDto, UnassignedEmployeesListQuery } from '@/features/hr/attendance/types/api/shift-assignments';
export type { ShiftAssignmentResponseDto, ShiftAssignmentListQuery, CreateShiftAssignmentDto, BulkCreateShiftAssignmentDto, BulkCreateShiftAssignmentResult, UpdateShiftAssignmentDto, GroupedByTemplateEmployee, GroupedByTemplateItem, GroupedByTemplateQuery, UnassignedEmployeeResponseDto, UnassignedEmployeesListQuery } from '@/features/hr/attendance/types/api/shift-assignments';










/** Active company employee with no effective shift assignment on the reference date. */


export const shiftAssignmentsApi = {
  getAll(query?: ShiftAssignmentListQuery) {
    return apiRequest<PaginatedResult<ShiftAssignmentResponseDto>>('/attendance/shift-assignments', { query });
  },
  getGroupedByTemplate(query?: GroupedByTemplateQuery) {
    return apiRequest<PaginatedResult<GroupedByTemplateItem>>('/attendance/shift-assignments/grouped-by-template', { query });
  },
  getUnassignedEmployees(query: UnassignedEmployeesListQuery) {
    return apiRequest<PaginatedResult<UnassignedEmployeeResponseDto>>(
      '/attendance/shift-assignments/unassigned-employees',
      { query },
    );
  },
  getById(id: string) {
    return apiRequest<ShiftAssignmentResponseDto>(`/attendance/shift-assignments/${id}`);
  },
  create(payload: CreateShiftAssignmentDto) {
    return apiRequest<ShiftAssignmentResponseDto>('/attendance/shift-assignments', { method: 'POST', body: payload });
  },
  bulkCreate(payload: BulkCreateShiftAssignmentDto) {
    return apiRequest<BulkCreateShiftAssignmentResult>('/attendance/shift-assignments/bulk', { method: 'POST', body: payload });
  },
  update(id: string, payload: UpdateShiftAssignmentDto) {
    return apiRequest<ShiftAssignmentResponseDto>(`/attendance/shift-assignments/${id}`, { method: 'PATCH', body: payload });
  },
  remove(id: string) {
    return apiRequest<void>(`/attendance/shift-assignments/${id}`, { method: 'DELETE' });
  },
  /** «تغيير الدوام من تاريخ»: ends the running shift the day before and starts the new one. */
  changeShift(payload: ChangeShiftAssignmentDto) {
    return apiRequest<ShiftAssignmentResponseDto>('/attendance/shift-assignments/change', { method: 'POST', body: payload });
  },
  /** «تصحيح الدوام بأثر رجعي»: what would be recomputed. */
  previewTemplateCorrection(id: string) {
    return apiRequest<ShiftTemplateCorrectionPreview>(`/attendance/shift-assignments/${id}/template-correction`);
  },
  correctTemplate(id: string, payload: CorrectShiftTemplateDto) {
    return apiRequest<ShiftAssignmentResponseDto>(`/attendance/shift-assignments/${id}/template-correction`, {
      method: 'POST',
      body: payload,
    });
  },
};

export interface ShiftTemplateCorrectionPreview {
  assignmentId: string;
  from: string;
  to: string;
  affectedDays: number;
  manualOverrideDays: number;
  lockedPeriods: string[];
}

export interface CorrectShiftTemplateDto {
  shiftTemplateId: string;
  reason: string;
  expectedAffectedDays?: number;
}

export interface ChangeShiftAssignmentDto {
  companyId: string;
  employeeId: string;
  shiftTemplateId: string;
  effectiveFrom: string;
  notes?: string | null;
}

/** Today's date in Saudi time (YYYY-MM-DD): right after midnight UTC is still yesterday. */
export function ksaTodayIso(nowMs: number = Date.now()): string {
  return new Date(nowMs + 3 * 3_600_000).toISOString().slice(0, 10);
}

/** A shift has started when its first day is today or earlier: it is ended, never deleted. */
export function hasShiftStarted(effectiveFrom: string | null | undefined, today = ksaTodayIso()): boolean {
  return !!effectiveFrom && effectiveFrom.slice(0, 10) <= today;
}

export function addDaysIso(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

