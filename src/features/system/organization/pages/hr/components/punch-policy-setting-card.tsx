'use client';

import * as React from 'react';
import { Fingerprint } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type {
  LateCheckInPolicy,
  MissingCheckOutCredit,
} from '@/features/system/organization/pages/_shared/types/settings';
import { cn } from '@/shared/utils';

export type PunchPolicyValues = {
  enforcePunchPolicyOnServer: boolean;
  blockEarlyCheckIn: boolean;
  lateCheckInPolicy: LateCheckInPolicy;
  blockEarlyCheckOut: boolean;
  allowCheckOutWithoutCheckIn: boolean;
  allowPreviousDayCheckOut: boolean;
  openSessionMaxHours: number;
  previousDayCheckOutUntilHours: number;
  allowPunchOnUnscheduledDay: boolean;
  requireCheckInPointsForSelfPunch: boolean;
  minMinutesBetweenPunches: number;
  singleSessionPerPeriod: boolean;
  missingCheckOutCredit: MissingCheckOutCredit;
  continuousAcrossPeriods: boolean;
};

const MISSING_CHECK_OUT_OPTIONS: {
  value: MissingCheckOutCredit;
  label: string;
  hint: string;
}[] = [
  {
    value: 'until_period_end',
    label: 'تُحسب حتى نهاية الفترة',
    hint: 'من سجّل حضوراً ونسي الانصراف تُحسب له ساعات الفترة من وقت حضوره حتى نهايتها.',
  },
  {
    value: 'none',
    label: 'لا تُحسب حتى يُصحَّح الانصراف',
    hint: 'يظهر الموظف حاضراً (مع التأخير إن وُجد) لكن بلا ساعات عمل، وتظهر الفترة نقصاً حتى يُعتمد طلب تصحيح الانصراف.',
  },
];

type Props = {
  values: PunchPolicyValues;
  disabled?: boolean;
  /** Tab shell already names the section. */
  hideHeader?: boolean;
  onChange: (patch: Partial<PunchPolicyValues>) => void;
};

const LATE_POLICY_OPTIONS: { value: LateCheckInPolicy; label: string; hint: string }[] = [
  {
    value: 'allow',
    label: 'يُقبل ويُحسب تأخيراً',
    hint: 'الزر يظهر دائماً، والتأخير يُحسب في التحليل.',
  },
  {
    value: 'block_after_grace',
    label: 'يُمنع بعد فترة السماحية',
    hint: 'مسموح حتى (وقت الدخول + graceMinutes) فقط، بعدها يُمنع ويُقترح طلب تصحيح.',
  },
];

function Row({
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 bg-card px-4 py-3.5',
        disabled && 'opacity-60',
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium leading-tight">{title}</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        className="shrink-0"
        aria-label={title}
      />
    </div>
  );
}

/** Number setting with an explicit save button and a visible allowed range. */
function NumberSettingRow({
  title,
  description,
  value,
  min,
  max,
  disabled,
  onSave,
}: {
  title: string;
  description: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onSave: (value: number) => void;
}) {
  const [draft, setDraft] = React.useState(String(value));
  React.useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const trimmed = draft.trim();
  const parsed = /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
  const valid = Number.isInteger(parsed) && parsed >= min && parsed <= max;
  const dirty = trimmed !== String(value);

  const save = () => {
    if (valid && parsed !== value) onSave(parsed);
  };

  return (
    <div className={cn('space-y-2 bg-card px-4 py-3.5', disabled && 'opacity-60')}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium leading-tight">{title}</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Input
            type="number"
            min={min}
            max={max}
            inputMode="numeric"
            className="h-9 w-24 text-sm"
            value={draft}
            disabled={disabled}
            aria-invalid={dirty && !valid}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
            }}
          />
          <Button
            type="button"
            size="sm"
            className="h-9"
            disabled={disabled || !dirty || !valid}
            onClick={save}
          >
            حفظ
          </Button>
        </div>
      </div>
      <p
        className={cn(
          'text-[11px] leading-relaxed',
          dirty && !valid ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {dirty && !valid
          ? `أدخل رقماً صحيحاً من ${min} إلى ${max}`
          : `المسموح: من ${min} إلى ${max}`}
      </p>
    </div>
  );
}

function GroupTitle({ children }: { children: React.ReactNode }) {
  return <p className="px-0.5 text-sm font-semibold text-foreground">{children}</p>;
}

/** Self-service punch policy — the backend evaluates it and the app just displays it. */
export function PunchPolicySettingCard({ values, disabled, hideHeader, onChange }: Props) {
  const latePolicy =
    LATE_POLICY_OPTIONS.find((o) => o.value === values.lateCheckInPolicy) ??
    LATE_POLICY_OPTIONS[0];
  const missingCheckOut =
    MISSING_CHECK_OUT_OPTIONS.find((o) => o.value === values.missingCheckOutCredit) ??
    MISSING_CHECK_OUT_OPTIONS[0];

  return (
    <section className="rounded-2xl border border-border/70 bg-card shadow-soft">
      {hideHeader ? (
        <p className="border-b border-border/60 px-4 py-3.5 text-xs leading-relaxed text-muted-foreground sm:px-5">
          تُطبَّق على البصمة الذاتية من التطبيق. الخادم يقرر والجوال يعرض القرار، فلا يحتاج
          التغيير إلى تحديث التطبيق. التسجيل اليدوي من الموارد البشرية لا يتأثر.
        </p>
      ) : (
        <header className="flex items-start gap-3 border-b border-border/60 px-4 py-3.5 sm:px-5">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Fingerprint className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">سياسة الحضور والانصراف</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              تُطبَّق على البصمة الذاتية من التطبيق. الخادم يقرر وتطبيق الجوال يعرض القرار،
              فلا يحتاج أي تغيير هنا إلى تحديث التطبيق. التسجيل اليدوي من الموارد البشرية
              لا يتأثر بهذه الإعدادات.
            </p>
          </div>
        </header>
      )}

      <div className="space-y-5 p-4 sm:p-5">
        <div className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70">
          <Row
            title="تطبيق السياسة على الخادم"
            description={
              values.enforcePunchPolicyOnServer
                ? 'الخادم يرفض أي بصمة تمنعها السياسة، حتى من نسخ التطبيق القديمة.'
                : 'السياسة تتحكم في ظهور الأزرار فقط، والخادم يقبل كل البصمات كما كان.'
            }
            checked={values.enforcePunchPolicyOnServer}
            disabled={disabled}
            onCheckedChange={(v) => onChange({ enforcePunchPolicyOnServer: v })}
          />
        </div>

        <GroupTitle>الحضور</GroupTitle>
        <div className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70">
        <Row
          title="منع الحضور المبكر"
          description="يُمنع الحضور قبل (وقت الدخول − beforeStartMinutes). عند الإيقاف يُقبل لكن لا يُحسب."
          checked={values.blockEarlyCheckIn}
          disabled={disabled}
          onCheckedChange={(v) => onChange({ blockEarlyCheckIn: v })}
        />
        <div
          className={cn(
            'space-y-2 bg-card px-4 py-3.5',
            disabled && 'opacity-60',
          )}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium leading-tight">الحضور المتأخر</p>
            <Select
              value={values.lateCheckInPolicy}
              disabled={disabled}
              onValueChange={(v) => onChange({ lateCheckInPolicy: v as LateCheckInPolicy })}
            >
              <SelectTrigger className="h-9 w-full text-sm sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LATE_POLICY_OPTIONS.filter(
                  (o) =>
                    o.value !== 'block_after_window' ||
                    values.lateCheckInPolicy === 'block_after_window',
                ).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{latePolicy.hint}</p>
        </div>
        </div>

        <GroupTitle>الانصراف</GroupTitle>
        <div className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70">
        <Row
          title="منع الانصراف المبكر"
          description="يُمنع الانصراف قبل (وقت الخروج − allowedShortageMinutes). مثال: خروج 4:00 م وعجز 15 دقيقة → من 3:45 م."
          checked={values.blockEarlyCheckOut}
          disabled={disabled}
          onCheckedChange={(v) => onChange({ blockEarlyCheckOut: v })}
        />
        <Row
          title="السماح بالانصراف لمن نسي الحضور"
          description="كل انصراف يسبقه حضور. عند الإيقاف: من لم يسجّل حضوراً يُمنع ويُقترح عليه طلب تصحيح. عند التفعيل: يُسمح مرة واحدة لكل فترة، من منتصف الفترة حتى ساعتين بعد الخروج (وبحد أقصى «أقصى مدة للدوام» من بداية الفترة). من منتصف الفترة يرى من لم يسجّل حضوراً زرّي «حضور متأخر» و«انصراف» معاً ويختار، ويُحسب اليوم ناقصاً حتى يُعتمد طلب تصحيح."
          checked={values.allowCheckOutWithoutCheckIn}
          disabled={disabled}
          onCheckedChange={(v) => onChange({ allowCheckOutWithoutCheckIn: v })}
        />
        <Row
          title="الانصراف بعد منتصف الليل على اليوم السابق"
          description="إذا بقي حضور الأمس مفتوحاً، يظهر زر الانصراف بعد الساعة 12 مع تنبيه بأن الحضور من اليوم السابق، ويُسجَّل على يوم الحضور ثم يختفي الزر. عند الإيقاف: لا انصراف بعد منتصف الليل ويُقترح طلب تصحيح."
          checked={values.allowPreviousDayCheckOut}
          disabled={disabled}
          onCheckedChange={(v) => onChange({ allowPreviousDayCheckOut: v })}
        />
        <NumberSettingRow
          title="الانصراف بعد منتصف الليل حتى (ساعات)"
          description="إذا بقي حضور الأمس مفتوحاً يُقبل انصرافه حتى هذا العدد من الساعات بعد منتصف الليل فقط. مثال: 3 → حتى 3:00 فجراً. بعدها يُعتبر انصرافاً منسياً مع اقتراح طلب تصحيح، وتُحسب أي بصمة بعدها لليوم الجديد، فلا تقلب بصمة منسية بصمات اليوم التالي."
          value={values.previousDayCheckOutUntilHours}
          min={1}
          max={12}
          disabled={disabled || !values.allowPreviousDayCheckOut}
          onSave={(n) => onChange({ previousDayCheckOutUntilHours: n })}
        />
        <NumberSettingRow
          title="أقصى مدة للدوام المفتوح (ساعات)"
          description="تُطبَّق على الجميع، وتُحسب من أول بصمة حضور في اليوم (ومن بداية الفترة لمن نسي الحضور). بعدها لا يُسمح بالانصراف ويُعتبر منسياً مع اقتراح طلب تصحيح. مثال: 18 → أول حضور 11:00 ص يمكن الانصراف حتى 5:00 ص من اليوم التالي. ينتهي أيضاً قبل ذلك إذا بدأت نافذة الدخول لشفت اليوم التالي، أو بعد منتصف الليل عند الوقت المحدد في «الانصراف بعد منتصف الليل حتى»."
          value={values.openSessionMaxHours}
          min={1}
          max={36}
          disabled={disabled}
          onSave={(n) => onChange({ openSessionMaxHours: n })}
        />
        </div>

        <GroupTitle>ضبط تكرار البصمة</GroupTitle>
        <div className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70">
        <NumberSettingRow
          title="أقل مدة بين بصمتين (دقائق)"
          description="بعد أي بصمة لا يُقبل من الموظف بصمة أخرى قبل مرور هذه المدة، فلا تتكرر البصمة بالضغط المتتالي. 0 = بدون حد."
          value={values.minMinutesBetweenPunches}
          min={0}
          max={120}
          disabled={disabled}
          onSave={(n) => onChange({ minMinutesBetweenPunches: n })}
        />
        <Row
          title="بصمة دخول وخروج واحدة لكل فترة"
          description="عند التفعيل: لكل فترة حضور واحد وانصراف واحد، ولا يمكن الخروج ثم العودة داخل الفترة نفسها. عند الإيقاف: يُسمح بالخروج والعودة داخل الفترة."
          checked={values.singleSessionPerPeriod}
          disabled={disabled}
          onCheckedChange={(v) => onChange({ singleSessionPerPeriod: v })}
        />
        <Row
          title="الدوام المتصل بين الفترات"
          description="عند التفعيل: حضور في فترة وانصراف في فترة لاحقة من نفس اليوم يُحسب دواماً واحداً متصلاً، ويبقى الحضور مفتوحاً عبر الفترات. عند الإيقاف: لكل فترة حضورها وانصرافها، وينتهي الحضور المفتوح عند بداية نافذة الفترة التالية ويُطلب تصحيح الانصراف."
          checked={values.continuousAcrossPeriods}
          disabled={disabled}
          onCheckedChange={(v) => onChange({ continuousAcrossPeriods: v })}
        />
        </div>

        <GroupTitle>الاحتساب</GroupTitle>
        <div className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70">
        <div
          className={cn(
            'space-y-2 bg-card px-4 py-3.5',
            disabled && 'opacity-60',
          )}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium leading-tight">حضور بدون انصراف</p>
            <Select
              value={values.missingCheckOutCredit}
              disabled={disabled}
              onValueChange={(v) =>
                onChange({ missingCheckOutCredit: v as MissingCheckOutCredit })
              }
            >
              <SelectTrigger className="h-9 w-full text-sm sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MISSING_CHECK_OUT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {missingCheckOut.hint} يُطبَّق على تفاصيل اليوم وملخصات الحضور عند إعادة الاحتساب.
          </p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            الحضور يُحسب بالدقيقة: التأخير ضمن «فترة السماح» والخروج ضمن «النقص المسموح» في قالب الدوام لا يُحسبان
            ولا يُخصمان، وما زاد عنهما يُحسب كله ويُخصم. والحضور بلا انصراف أو الانصراف بلا حضور لا يُحسب حتى
            يُعتمد طلب تصحيح مهما كان هذا الخيار.
          </p>
        </div>
        </div>

        <GroupTitle>شروط عامة</GroupTitle>
        <div className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70">
        <Row
          title="اشتراط نقطة تسجيل مربوطة"
          description="لا يستطيع الموظف البصم من التطبيق إلا إذا كان مربوطاً بنقطة تسجيل فعّالة."
          checked={values.requireCheckInPointsForSelfPunch}
          disabled={disabled}
          onCheckedChange={(v) => onChange({ requireCheckInPointsForSelfPunch: v })}
        />
        <Row
          title="السماح بالبصمة في يوم الراحة"
          description="يظهر الزر في يوم الراحة أو اليوم بلا فترات. تُحفظ البصمة ولا تُحسب في الحضور."
          checked={values.allowPunchOnUnscheduledDay}
          disabled={disabled}
          onCheckedChange={(v) => onChange({ allowPunchOnUnscheduledDay: v })}
        />
        </div>
      </div>
    </section>
  );
}
