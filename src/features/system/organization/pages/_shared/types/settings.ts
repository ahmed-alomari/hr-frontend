export type LateCheckInPolicy = 'allow' | 'block_after_grace' | 'block_after_window';

/** Period with a check-in but no check-out: credited until period end, or not at all. */
export type MissingCheckOutCredit = 'until_period_end' | 'none';

export interface HrCompanySettings {
  id: string;
  companyId: string;
  notificationsEnabled: boolean;
  /** When true, app login requires `mobileSerialNumber`. Default true. */
  enforceMobileDeviceSerial?: boolean;
  /** When true (and enforceMobileDeviceSerial), a new app device needs admin approval before OTP email. */
  requireAdminApprovalForNewMobileDevice?: boolean;
  /** When true, web login requires `mobileSerialNumber` (stored as web device serial). */
  enforceWebDeviceSerial?: boolean;
  /** When true (and enforceWebDeviceSerial), a new web device needs admin approval before OTP email. */
  requireAdminApprovalForNewWebDevice?: boolean;
  notifyDisciplineViolationCreated: boolean;
  notifyDisciplineViolationApproved: boolean;
  notifyDisciplineCircularCreated: boolean;
  notifyDisciplineNoticeCreated: boolean;
  notifyDisciplineAppealCreated: boolean;
  notifyDisciplineInvestigationCreated: boolean;
  notifyDisciplineInvestigationCompleted: boolean;
  notifyDisciplineApprovalAssignmentCreated: boolean;
  notifyPayrollPeriodCreated: boolean;
  notifyPayrollPeriodClosed: boolean;
  notifyPayslipCreated: boolean;
  notifyPayslipPendingEmployeeAcceptance: boolean;
  notifyAttendanceCheckIn: boolean;
  notifyAttendanceCheckOut: boolean;
  /** Notify only for out-of-range punches (the exception toggles below). Default false. */
  notifyAttendanceExceptionsOnly?: boolean;
  notifyAttendanceLateCheckIn?: boolean;
  notifyAttendanceEarlyCheckOut?: boolean;
  notifyAttendanceOvertimeCheckOut?: boolean;
  notifyAttendanceCheckOutWithoutCheckIn?: boolean;
  notifyAttendanceNotCounted?: boolean;
  notifyShiftAssignmentLinked: boolean;
  notifyCheckInPointLinked: boolean;
  notifyLeaveBalanceCredited: boolean;
  notifyLeaveRequestApproved: boolean;
  notifyAdvanceRequestApproved: boolean;
  notifyCorrectionRequestApproved: boolean;
  notifyRequestApprovalAssignmentCreated: boolean;
  /** «طلب بانتظار موافقتك» to the approvers (leave, overtime, correction, advance). */
  notifyRequestPendingApproval: boolean;
  notifyOvertimeRequestApproved: boolean;
  /** The same request notifications also by email. */
  emailRequestPendingApproval: boolean;
  emailRequestDecided: boolean;
  /** Every in-app notification also as a push to the employee's phone. */
  pushEnabled: boolean;
  notifyContractSentForApproval: boolean;
  notifyEmployeeAssignedToCompany: boolean;
  notifyEmployeeAssignedToBranch: boolean;
  /** @deprecated Derived by the backend from the split punch-policy fields below. */
  hideEarlyCheckoutUntilShortageWindow: boolean;
  /** Backend rejects self-service punches the policy blocks. Default true. */
  enforcePunchPolicyOnServer?: boolean;
  blockEarlyCheckIn?: boolean;
  lateCheckInPolicy?: LateCheckInPolicy;
  blockEarlyCheckOut?: boolean;
  allowCheckOutWithoutCheckIn?: boolean;
  /** After midnight, close a check-in still open from the previous work day. Default true. */
  allowPreviousDayCheckOut?: boolean;
  openSessionMaxHours?: number;
  allowPunchOnUnscheduledDay?: boolean;
  /** Default true. */
  requireCheckInPointsForSelfPunch?: boolean;
  /** Minimum minutes between two punches; 0 = off. Default 1. */
  minMinutesBetweenPunches?: number;
  /** One check-in and one check-out per period. Default false. */
  singleSessionPerPeriod?: boolean;
  /** Default `until_period_end`. */
  missingCheckOutCredit?: MissingCheckOutCredit;
  /** One check-in / check-out may span several periods of the day. Default false. */
  continuousAcrossPeriods?: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export type UpdateHrCompanySettingsDto = Partial<
  Omit<HrCompanySettings, 'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>
>;

export interface OrganizationCompanySettings {
  id: string;
  companyId: string;
  emailEnabled: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUsername: string | null;
  smtpPasswordConfigured: boolean;
  smtpFromEmail: string | null;
  smtpFromName: string | null;
  notifyUserCreated: boolean;
  notifyUserAssignedToCompany: boolean;
  notifyUserAssignedToBranch: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  hrSettings?: HrCompanySettings;
}

export type UpdateOrganizationCompanySettingsDto = {
  emailEnabled?: boolean;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecure?: boolean;
  smtpUsername?: string | null;
  smtpPassword?: string | null;
  smtpFromEmail?: string | null;
  smtpFromName?: string | null;
  notifyUserCreated?: boolean;
  notifyUserAssignedToCompany?: boolean;
  notifyUserAssignedToBranch?: boolean;
};
