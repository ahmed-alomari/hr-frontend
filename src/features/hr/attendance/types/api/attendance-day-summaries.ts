export type AttendanceDayStatus =
  | 'present'
  | 'partial'
  | 'late'
  /** Per-minute accounting: left before a period ended, not late. */
  | 'early_leave'
  | 'absent'
  | 'rest_day'
  | 'unscheduled'
  | 'holiday'
  | 'on_leave'
  /** No period has started yet. */
  | 'upcoming'
  /** A period is running with no punch yet — absence is decided when it ends. */
  | 'pending';

export type DaySummaryDailyTotals = {
  minutes: {
    expected: number;
    total: number;
    insidePeriods?: number;
    outsidePeriods?: number;
    late: number;
    earlyLeave: number;
    earlyArrival?: number;
    overtime: number;
    payrollOvertime?: number;
    shortage: number;
  };
  display: {
    expected: string;
    total: string;
    insidePeriods?: string;
    outsidePeriods?: string;
    late: string;
    earlyLeave: string;
    earlyArrival?: string;
    overtime: string;
    payrollOvertime?: string;
    shortage: string;
  };
};

export type DaySummaryResponseDto = {
  id: string;
  companyId: string;
  employeeId: string;
  employeeNameAr: string;
  workDate: string;
  status: AttendanceDayStatus;
  shiftAssignmentId: string | null;
  expectedStartAt: string | null;
  expectedEndAt: string | null;
  actualCheckInAt: string | null;
  actualCheckOutAt: string | null;
  correctedTimes?: unknown | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workedMinutes: number;
  workedMinutesInsidePeriods?: number;
  workedMinutesOutsidePeriods?: number;
  earlyArrivalMinutes?: number;
  overtimeMinutes: number;
  overtimePayrollAllowed?: boolean;
  overtimePayrollAllowedAt?: string | null;
  payrollOvertimeMinutes?: number;
  canAllowOvertimeForPayroll?: boolean;
  expectedMinutes?: number;
  shortageMinutes?: number;
  dailyTotals?: DaySummaryDailyTotals | null;
  isSettled?: boolean;
  settledAt?: string | null;
  settledMinutes?: number;
  canSettle?: boolean;
  isManualOverride: boolean;
  isFinalized: boolean;
  notes: string | null;
  computedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  /** With `groupBy`: the key of the row's group (as in `/groups`). */
  groupKey?: string | null;
};

export type DaySummaryListQuery = {
  page?: number;
  limit?: number;
  companyId?: string;
  employeeId?: string;
  employeeIds?: string[];
  status?: AttendanceDayStatus;
  from?: string;
  to?: string;
  isManualOverride?: boolean;
  /** The employee's status: active (empty counts as active), suspended, ended. */
  employeeStatus?: string;
  /** Employee's primary assignment branch / department. */
  branchId?: string;
  departmentId?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  /** Group field (`/groups`), or with `groupValue` the rows of one group. */
  groupBy?: string;
  groupValue?: string;
};

export type DaySummaryByPeriodQuery = {
  employeeId: string;
  companyId: string;
  startDate: string;
  endDate: string;
};

export type DaySummaryByPeriodResult = {
  companyId: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  items: DaySummaryResponseDto[];
};

export type UpdateDaySummaryDto = {
  status?: AttendanceDayStatus;
  lateMinutes?: number;
  earlyLeaveMinutes?: number;
  workedMinutes?: number;
  overtimeMinutes?: number;
  isFinalized?: boolean;
  notes?: string | null;
  updatedBy?: string | null;
};

export type RecomputeDto = {
  companyId: string;
  from: string;
  to: string;
  employeeIds?: string[];
  timezoneOffsetMinutes?: number;
  overwriteManualOverrides?: boolean;
  computedBy?: string | null;
};

export type RecomputeResult = {
  created: number;
  updated: number;
  skipped: number;
  totalDays: number;
  employees: number;
};

export type PushToPayrollDto = {
  payrollPeriodId: string;
  employeeIds?: string[];
  replaceExisting?: boolean;
  applyOvertime?: boolean;
  absenceDailyRateOverride?: number;
  lateMinuteRateOverride?: number;
  overtimeMultiplier?: number;
  createdBy?: string | null;
};

export type PushToPayrollResult = {
  inputsCreated: number;
  inputsDeleted: number;
  employeesProcessed: number;
};

export type SettleDaySummaryDto = {
  updatedBy?: string | null;
  notes?: string | null;
};

export type SetOvertimePayrollAllowedDto = {
  allowed: boolean;
  updatedBy?: string | null;
  notes?: string | null;
};
