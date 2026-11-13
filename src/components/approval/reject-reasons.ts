/**
 * Suggested rejection reasons, per request kind. A suggestion only fills the
 * reason box; the approver can edit it before confirming. The server requires
 * a written reason on every rejection (3 letters at least).
 */

export type RejectReasonKind = 'leave' | 'attendance' | 'overtime' | 'advance' | 'appeal';

export const REJECT_REASON_MIN_LENGTH = 3;
export const REJECT_REASON_MAX_LENGTH = 1000;

/** Joins chosen suggestions inside the reason box. */
export const REJECT_REASON_SEPARATOR = '، ';

const COMMON_REASONS = [
  'البيانات أو المرفقات غير مكتملة',
  'يُرجى مراجعة الموارد البشرية لمزيد من التفاصيل',
] as const;

export const REJECT_REASON_SUGGESTIONS: Record<RejectReasonKind, readonly string[]> = {
  leave: [
    'رصيد الإجازة غير كافٍ',
    'ضغط العمل في هذه الفترة لا يسمح',
    'يوجد موظفون آخرون في إجازة بالفترة نفسها',
    'لم يُقدَّم الطلب قبل المدة المحددة',
    'المستند الداعم غير مرفق (تقرير طبي أو غيره)',
    'التواريخ غير صحيحة، يُرجى تعديلها وإعادة التقديم',
    ...COMMON_REASONS,
  ],
  attendance: [
    'سجلات الحضور لا تؤيد الأوقات المطلوبة',
    'الأوقات المطلوبة لا تتوافق مع الدوام',
    'قُدِّم الطلب بعد المدة المسموحة للتصحيح',
    'تكرار نسيان التسجيل، يُرجى الالتزام بالبصمة',
    'يوجد طلب تصحيح آخر لليوم نفسه',
    ...COMMON_REASONS,
  ],
  overtime: [
    'لم يُعتمد العمل الإضافي مسبقاً',
    'ساعات الحضور لا تُثبت العمل الإضافي',
    'العمل المطلوب يمكن إنجازه في الدوام الرسمي',
    'تجاوز الحد المسموح للعمل الإضافي',
    'لا توجد حاجة عمل للعمل الإضافي في هذا اليوم',
    ...COMMON_REASONS,
  ],
  advance: [
    'المبلغ يتجاوز الحد المسموح للسلفة',
    'توجد سلفة قائمة لم تُسدَّد بعد',
    'مدة الخدمة لا تسمح بالسلفة حالياً',
    'القسط الشهري يتجاوز النسبة المسموحة من الراتب',
    'الميزانية لا تسمح بالسلف حالياً',
    ...COMMON_REASONS,
  ],
  appeal: [
    'المخالفة ثابتة بالسجلات والأدلة',
    'لم يُقدَّم ما يثبت خلاف المخالفة',
    'قُدِّم التظلم بعد المدة المسموحة',
    'الجزاء متوافق مع لائحة تنظيم العمل',
    ...COMMON_REASONS,
  ],
};

/** Whether a suggestion is already in the reason box. */
export function hasRejectReasonSuggestion(text: string, suggestion: string): boolean {
  return text.includes(suggestion);
}

/** Separators and spaces left at either end after a suggestion is taken out. */
const LOOSE_ENDS = /^[\s،,]+|[\s،,]+$/g;

/**
 * Adds the suggestion to the reason box, or takes it out when it is already
 * there. Whatever else is in the box, typed or chosen, stays as it is.
 */
export function toggleRejectReasonSuggestion(text: string, suggestion: string): string {
  const trimmed = text.trim();
  if (!trimmed) return suggestion;
  if (hasRejectReasonSuggestion(trimmed, suggestion)) {
    const withSeparator = [
      `${REJECT_REASON_SEPARATOR}${suggestion}`,
      `${suggestion}${REJECT_REASON_SEPARATOR}`,
      suggestion,
    ].find((part) => trimmed.includes(part)) as string;
    return trimmed.replace(withSeparator, '').replace(LOOSE_ENDS, '');
  }
  return `${trimmed}${REJECT_REASON_SEPARATOR}${suggestion}`;
}

export function isRejectReasonValid(text: string): boolean {
  return text.trim().length >= REJECT_REASON_MIN_LENGTH;
}
