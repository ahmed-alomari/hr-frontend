import type { HrCompanySettings } from '@/features/system/organization/pages/_shared/types/settings';

export type HrNotificationKey = Exclude<
  keyof HrCompanySettings,
  | 'id'
  | 'companyId'
  | 'createdAt'
  | 'updatedAt'
  | 'createdBy'
  | 'updatedBy'
  | 'lateCheckInPolicy'
  | 'openSessionMaxHours'
  | 'minMinutesBetweenPunches'
  | 'missingCheckOutCredit'
>;

export type NotificationToggleItem = {
  key: HrNotificationKey;
  label: string;
  description?: string;
};

export type NotificationToggleGroup = {
  label: string;
  items: NotificationToggleItem[];
};

export const HR_NOTIFICATION_GROUPS: NotificationToggleGroup[] = [
  {
    label: 'عام',
    items: [
      {
        key: 'notificationsEnabled',
        label: 'تفعيل إشعارات الموارد البشرية',
        description: 'عند الإيقاف تُعطّل بقية إشعارات HR لهذه الشركة',
      },
    ],
  },
  {
    label: 'الانضباط الوظيفي',
    items: [
      { key: 'notifyDisciplineViolationCreated', label: 'إنشاء مخالفة' },
      { key: 'notifyDisciplineViolationApproved', label: 'اعتماد مخالفة' },
      { key: 'notifyDisciplineCircularCreated', label: 'تعميم جديد' },
      { key: 'notifyDisciplineNoticeCreated', label: 'إشعار انضباطي' },
      { key: 'notifyDisciplineAppealCreated', label: 'طلب تظلّم' },
      { key: 'notifyDisciplineInvestigationCreated', label: 'فتح تحقيق' },
      { key: 'notifyDisciplineInvestigationCompleted', label: 'إكمال تحقيق' },
      { key: 'notifyDisciplineApprovalAssignmentCreated', label: 'إسناد موافقة انضباط' },
    ],
  },
  {
    label: 'الرواتب',
    items: [
      { key: 'notifyPayrollPeriodCreated', label: 'فتح فترة رواتب' },
      { key: 'notifyPayrollPeriodClosed', label: 'إغلاق فترة رواتب' },
      { key: 'notifyPayslipCreated', label: 'إنشاء مسير راتب' },
      { key: 'notifyPayslipPendingEmployeeAcceptance', label: 'مسير بانتظار قبول الموظف' },
    ],
  },
  {
    label: 'الحضور',
    items: [
      { key: 'notifyAttendanceCheckIn', label: 'تسجيل حضور' },
      { key: 'notifyAttendanceCheckOut', label: 'تسجيل انصراف' },
      {
        key: 'notifyAttendanceExceptionsOnly',
        label: 'إشعار الحضور والانصراف عند المخالفة فقط',
        description:
          'عند التفعيل: البصمة ضمن النطاق الطبيعي لا يصلها إشعار، ويُرسل الإشعار فقط للحالات المفعّلة أدناه. عند الإيقاف: إشعار لكل بصمة.',
      },
      {
        key: 'notifyAttendanceLateCheckIn',
        label: '↳ حضور متأخر',
        description: 'حضور بعد (وقت الدخول + السماحية).',
      },
      {
        key: 'notifyAttendanceEarlyCheckOut',
        label: '↳ انصراف مبكر',
        description: 'انصراف قبل (وقت الخروج − النقص المسموح).',
      },
      {
        key: 'notifyAttendanceOvertimeCheckOut',
        label: '↳ انصراف بعد نافذة الخروج',
        description: 'انصراف بعد وقت الخروج بأكثر من ساعتين (نافذة الخروج).',
      },
      {
        key: 'notifyAttendanceCheckOutWithoutCheckIn',
        label: '↳ انصراف بدون حضور',
      },
      {
        key: 'notifyAttendanceNotCounted',
        label: '↳ بصمة لا تُحسب',
        description: 'مثل الحضور قبل نافذة الدخول، أو البصم في يوم راحة أو بدون دوام.',
      },
      { key: 'notifyShiftAssignmentLinked', label: 'ربط شيفت بموظف' },
      { key: 'notifyCheckInPointLinked', label: 'ربط نقطة تسجيل بموظف' },
    ],
  },
  {
    label: 'الإجازات والطلبات',
    items: [
      { key: 'notifyLeaveBalanceCredited', label: 'إضافة رصيد إجازة' },
      { key: 'notifyLeaveRequestApproved', label: 'اعتماد طلب إجازة' },
      { key: 'notifyAdvanceRequestApproved', label: 'اعتماد طلب سلفة' },
      { key: 'notifyCorrectionRequestApproved', label: 'اعتماد تصحيح حضور' },
      { key: 'notifyOvertimeRequestApproved', label: 'اعتماد طلب عمل إضافي' },
      { key: 'notifyRequestPendingApproval', label: 'طلب بانتظار الموافقة (للموافقين)' },
      { key: 'notifyRequestApprovalAssignmentCreated', label: 'إسناد موافقة طلب' },
    ],
  },
  {
    label: 'إشعارات الجوال',
    items: [
      {
        key: 'pushEnabled',
        label: 'إرسال الإشعارات إلى جوال الموظف',
        description:
          'يصل الإشعار نفسه إلى جوال الموظف من تطبيق الموظفين. عند الإيقاف يبقى الإشعار داخل التطبيق كما هو.',
      },
    ],
  },
  {
    label: 'إشعارات الطلبات بالبريد',
    items: [
      { key: 'emailRequestPendingApproval', label: 'نفس إشعار الموافقين بالبريد' },
      { key: 'emailRequestDecided', label: 'نفس إشعار صاحب الطلب بالبريد (اعتماد أو رفض)' },
    ],
  },
  {
    label: 'العقود والموظفين',
    items: [
      { key: 'notifyContractSentForApproval', label: 'إرسال عقد للموافقة' },
      { key: 'notifyEmployeeAssignedToCompany', label: 'إسناد موظف لشركة' },
      { key: 'notifyEmployeeAssignedToBranch', label: 'إسناد موظف لفرع' },
    ],
  },
];

export const ORGANIZATION_USER_NOTIFICATION_ITEMS: {
  key: 'notifyUserCreated' | 'notifyUserAssignedToCompany' | 'notifyUserAssignedToBranch';
  label: string;
}[] = [
  { key: 'notifyUserCreated', label: 'إنشاء مستخدم جديد' },
  { key: 'notifyUserAssignedToCompany', label: 'إسناد مستخدم لشركة' },
  { key: 'notifyUserAssignedToBranch', label: 'إسناد مستخدم لفرع' },
];
