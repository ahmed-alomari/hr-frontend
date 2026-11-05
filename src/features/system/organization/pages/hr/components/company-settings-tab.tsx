'use client';

import * as React from 'react';
import { Building2, Check, ImagePlus, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { resolveUploadUrl, uploadResponseToStoredPath } from '@/shared/resolve-upload-url';
import { cn } from '@/shared/utils';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import { uploadsApi } from '@/features/hr/lib/api/uploads';
import {
  companyToSettingsForm,
  isValidHexColor,
  PDF_CONTRACT_FONT_SCALE,
  PDF_EMPLOYEE_SIGNATURE_SCALE,
  PDF_WATERMARK_LEVELS,
  settingsFormToUpdateDto,
  type CompanySettingsFormState,
} from '@/features/system/organization/pages/hr/constants/company-settings-form';
import { useCompanyProfileSettings } from '@/features/system/organization/pages/hr/hooks/useCompanyProfileSettings';
import {
  SettingsPageError,
  SettingsPageLoading,
} from '@/features/system/organization/pages/_shared/components/settings-page-states';

function FormField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function PercentScaleControl({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const [draft, setDraft] = React.useState(String(value));
  React.useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = (raw: string) => {
    const parsed = Number(raw);
    const next = Number.isFinite(parsed)
      ? Math.min(max, Math.max(min, Math.round(parsed)))
      : value;
    onChange(next);
    setDraft(String(next));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">{label}</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            step={1}
            dir="ltr"
            value={draft}
            aria-label={label}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit(draft)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit(draft);
              }
            }}
            className="h-9 w-20 text-center"
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        dir="ltr"
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-primary"
      />
      <div className="flex justify-between text-[11px] text-muted-foreground" dir="ltr">
        <span>{min}%</span>
        <span>{max}%</span>
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  defaultHex,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Fallback swatch when the field is empty (system default preview). */
  defaultHex: string;
}) {
  const pickerValue = isValidHexColor(value) ? value.trim() : defaultHex;

  return (
    <FormField label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={pickerValue}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
          aria-label={label}
        />
        <Input
          dir="ltr"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 font-mono"
          placeholder={defaultHex}
        />
      </div>
    </FormField>
  );
}

export function CompanySettingsTab() {
  const { company, isLoading, isError, error, update } = useCompanyProfileSettings();
  const [form, setForm] = React.useState<CompanySettingsFormState | null>(null);
  const [uploadingLogo, setUploadingLogo] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (company) setForm(companyToSettingsForm(company));
  }, [company]);

  const patch = (partial: Partial<CompanySettingsFormState>) => {
    setForm((prev) => (prev ? { ...prev, ...partial } : prev));
  };

  const handleLogoPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة');
      return;
    }

    setUploadingLogo(true);
    try {
      const uploaded = await uploadsApi.upload('image', file);
      patch({ logoUrl: uploadResponseToStoredPath(uploaded) });
      toast.success('تم رفع الشعار');
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'uploads.image');
      toast.error(displayMessage);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    if (!form) return;
    if (!form.nameAr.trim()) {
      toast.error('اسم الشركة بالعربية مطلوب');
      return;
    }
    if (form.primaryColor.trim() && !isValidHexColor(form.primaryColor)) {
      toast.error('اللون الأساسي يجب أن يكون بصيغة #RRGGBB');
      return;
    }
    if (form.secondaryColor.trim() && !isValidHexColor(form.secondaryColor)) {
      toast.error('اللون الثانوي يجب أن يكون بصيغة #RRGGBB');
      return;
    }

    try {
      await update.mutateAsync(settingsFormToUpdateDto(form));
      toast.success('تم حفظ بيانات الشركة');
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'companies.update');
      toast.error(displayMessage);
    }
  };

  if (isLoading || !form) {
    return <SettingsPageLoading />;
  }

  if (isError || !company) {
    const { displayMessage } = handleApiError(error, 'companies.get');
    return <SettingsPageError message={displayMessage} />;
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
      <div className="border-b border-border/80 px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold sm:text-base">إعدادات الشركة</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              عدّل بيانات الشركة الأساسية، التواصل، العنوان، والشعار.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-4 sm:p-5">
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground">الشعار</p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/20">
              {form.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveUploadUrl(form.logoUrl)} alt="شعار الشركة" className="h-full w-full object-contain" />
              ) : (
                <Building2 className="h-8 w-8 text-muted-foreground/40" />
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handleLogoPick(e)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={uploadingLogo}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingLogo ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="h-3.5 w-3.5" />
                )}
                {uploadingLogo ? 'جاري الرفع…' : 'رفع شعار'}
              </Button>
              {form.logoUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground"
                  onClick={() => patch({ logoUrl: '' })}
                >
                  إزالة الشعار
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted-foreground">ألوان الهوية</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={!form.primaryColor.trim() && !form.secondaryColor.trim()}
              onClick={() => {
                patch({ primaryColor: '', secondaryColor: '' });
                toast.message('تم استعادة الألوان الافتراضية للنظام — احفظ لتطبيق التغيير');
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              استعادة الألوان الافتراضية
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            عند التفريغ تُستخدم ألوان النظام العامة (بما في ذلك الوضع الداكن). عدّل الألوان ثم احفظ لتخصيص هوية الشركة.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <ColorField
              label="اللون الأساسي"
              value={form.primaryColor}
              onChange={(primaryColor) => patch({ primaryColor })}
              defaultHex="#154f4a"
            />
            <ColorField
              label="اللون الثانوي"
              value={form.secondaryColor}
              onChange={(secondaryColor) => patch({ secondaryColor })}
              defaultHex="#f2ede6"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">خلفية الشعار في المستندات المطبوعة</p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                شعار الشركة خلفيةً باهتة في كل صفحة من التقارير والمستندات المطبوعة.
              </p>
            </div>
            <Switch
              checked={form.pdfWatermarkEnabled}
              onCheckedChange={(pdfWatermarkEnabled) => patch({ pdfWatermarkEnabled })}
              aria-label="إظهار الشعار خلفية في المستندات"
            />
          </div>
          {form.pdfWatermarkEnabled ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="درجة ظهور الخلفية">
                {PDF_WATERMARK_LEVELS.map((level) => {
                  const active = form.pdfWatermarkOpacity === level.value;
                  return (
                    <button
                      key={level.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => patch({ pdfWatermarkOpacity: level.value })}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-xs transition',
                        active
                          ? 'border-primary bg-primary/10 font-semibold text-primary'
                          : 'border-border hover:border-primary/40',
                      )}
                    >
                      {level.label}
                    </button>
                  );
                })}
              </div>
              {/* What a printed page will look like at this level. */}
              <div className="relative flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white shadow-sm">
                {form.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolveUploadUrl(form.logoUrl)}
                    alt=""
                    className="w-3/4 object-contain"
                    style={{ opacity: form.pdfWatermarkOpacity / 100 }}
                  />
                ) : (
                  <span className="px-1 text-center text-[10px] text-muted-foreground">ارفع الشعار أولًا</span>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <PercentScaleControl
          label="حجم خط عقد العمل"
          hint="حجم نص بنود العقد في ملف PDF. أي رقم بين 30 و 100؛ الخط الأصغر يجمع بنودًا أكثر في الصفحة الواحدة."
          value={form.pdfContractFontScale}
          min={PDF_CONTRACT_FONT_SCALE.min}
          max={PDF_CONTRACT_FONT_SCALE.max}
          onChange={(pdfContractFontScale) => patch({ pdfContractFontScale })}
        />

        <PercentScaleControl
          label="حجم توقيع الموظف"
          hint="أي رقم بين 30 و 200. يُطبع توقيع الموظف بهذا الحجم في كل صفحة من العقد والخطاب وأي ملف PDF يتطلّب توقيعه."
          value={form.pdfEmployeeSignatureScale}
          min={PDF_EMPLOYEE_SIGNATURE_SCALE.min}
          max={PDF_EMPLOYEE_SIGNATURE_SCALE.max}
          onChange={(pdfEmployeeSignatureScale) => patch({ pdfEmployeeSignatureScale })}
        />

        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground">البيانات الأساسية</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="الاسم (عربي) *">
              <Input value={form.nameAr} onChange={(e) => patch({ nameAr: e.target.value })} className="h-9" />
            </FormField>
            <FormField label="الاسم (إنجليزي)">
              <Input dir="ltr" value={form.nameEn} onChange={(e) => patch({ nameEn: e.target.value })} className="h-9" />
            </FormField>
            <FormField label="السجل التجاري">
              <Input
                dir="ltr"
                value={form.commercialRegistrationNo}
                onChange={(e) => patch({ commercialRegistrationNo: e.target.value })}
                className="h-9"
              />
            </FormField>
            <FormField label="الرقم الضريبي">
              <Input dir="ltr" value={form.taxNumber} onChange={(e) => patch({ taxNumber: e.target.value })} className="h-9" />
            </FormField>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground">التواصل</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="البريد الإلكتروني">
              <Input dir="ltr" type="email" value={form.email} onChange={(e) => patch({ email: e.target.value })} className="h-9" />
            </FormField>
            <FormField label="الموقع الإلكتروني">
              <Input dir="ltr" value={form.website} onChange={(e) => patch({ website: e.target.value })} className="h-9" />
            </FormField>
            <FormField label="الهاتف">
              <Input dir="ltr" value={form.phone} onChange={(e) => patch({ phone: e.target.value })} className="h-9" />
            </FormField>
            <FormField label="الجوال">
              <Input dir="ltr" value={form.mobile} onChange={(e) => patch({ mobile: e.target.value })} className="h-9" />
            </FormField>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground">العنوان</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="الدولة">
              <Input dir="ltr" value={form.country} onChange={(e) => patch({ country: e.target.value })} className="h-9" placeholder="SA" />
            </FormField>
            <FormField label="المدينة">
              <Input value={form.city} onChange={(e) => patch({ city: e.target.value })} className="h-9" />
            </FormField>
            <FormField label="الحي">
              <Input value={form.district} onChange={(e) => patch({ district: e.target.value })} className="h-9" />
            </FormField>
            <FormField label="الرمز البريدي">
              <Input dir="ltr" value={form.postalCode} onChange={(e) => patch({ postalCode: e.target.value })} className="h-9" />
            </FormField>
            <FormField label="العنوان" className="sm:col-span-2">
              <Input value={form.address} onChange={(e) => patch({ address: e.target.value })} className="h-9" />
            </FormField>
          </div>
        </div>
      </div>

      <div className="flex justify-start border-t border-border/80 bg-muted/10 px-4 py-3 sm:px-5">
        <Button
          variant="luxe"
          className="gap-2"
          onClick={() => void handleSave()}
          disabled={update.isPending || uploadingLogo}
        >
          {update.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري الحفظ…
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              حفظ بيانات الشركة
            </>
          )}
        </Button>
      </div>
    </section>
  );
}
