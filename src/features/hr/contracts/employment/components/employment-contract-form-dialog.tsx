'use client';

import * as React from 'react';
import {
  Bell, Briefcase, Coins, Copy, FileDown, FileSignature,
  Layers, Plus, ScrollText, Trash2, User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  dialogFormFooterClass,
} from '@/components/ui/dialog';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { MinimalDropdown, SearchableDropdown } from '@/components/ui/shared-dialogs';
import {
  CONTRACT_NATURE_DROPDOWN_OPTIONS,
  WORK_ARRANGEMENT_DROPDOWN_OPTIONS,
} from '@/features/hr/contracts/contract-templates/constants/contract-template-options';
import type {
  ContractNature,
  WorkArrangement,
} from '@/features/hr/contracts/contract-templates/types/contract-template';
import {
  type AllowanceLine,
  type EmploymentContractFormValues,
} from '@/features/hr/contracts/employment/utils/employment-contract-form';
import { cn } from '@/shared/utils';
import { ArticleOrderList, orderedArticles } from '@/components/contracts/article-order-list';

type ArticleItem = {
  id: string;
  code: string;
  title: string;
  body: string;
  isBasic: boolean;
};

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/15">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-sm text-foreground">{title}</p>
        {description ? (
          <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
  span2,
  hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  span2?: boolean;
  hint?: string;
}) {
  return (
    <div className={cn('space-y-1.5', span2 && 'sm:col-span-2')}>
      <Label className="text-xs font-medium text-muted-foreground">
        {label}{required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-[10px] leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-border/70 bg-card/60 p-4 shadow-xs sm:p-5', className)}>
      {children}
    </div>
  );
}

export type EmploymentContractFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  form: EmploymentContractFormValues;
  error: string | null;
  applyingTemplate: boolean;
  templateOptions: { value: string; label: string }[];
  empOptions: { value: string; label: string }[];
  allowanceOptions: { value: string; label: string }[];
  activeArticles: ArticleItem[];
  essentialArticleIds: string[];
  copyFromEmployeeId: string;
  copyFromContractId: string;
  copySourceEmpOptions: { value: string; label: string }[];
  copySourceContractOptions: { value: string; label: string }[];
  getEmpName: (id: string) => string;
  onSave: () => void;
  onPreviewPdf: () => void;
  onPatch: (patch: Partial<EmploymentContractFormValues>) => void;
  onApplyTemplate: (templateId: string) => void;
  onCopyFromEmployeeChange: (id: string) => void;
  onCopyFromContractChange: (id: string) => void;
  onApplyCopyFromContract: () => void;
  onToggleArticle: (id: string) => void;
  onUpdateAllowanceLine: (idx: number, patch: Partial<AllowanceLine>) => void;
  onAddAllowanceLine: () => void;
  onRemoveAllowanceLine: (idx: number) => void;
};

export function EmploymentContractFormDialog({
  open,
  onOpenChange,
  mode,
  form,
  error,
  applyingTemplate,
  templateOptions,
  empOptions,
  allowanceOptions,
  activeArticles,
  essentialArticleIds,
  copyFromEmployeeId,
  copyFromContractId,
  copySourceEmpOptions,
  copySourceContractOptions,
  getEmpName,
  onSave,
  onPreviewPdf,
  onPatch,
  onApplyTemplate,
  onCopyFromEmployeeChange,
  onCopyFromContractChange,
  onApplyCopyFromContract,
  onToggleArticle,
  onUpdateAllowanceLine,
  onAddAllowanceLine,
  onRemoveAllowanceLine,
}: EmploymentContractFormDialogProps) {
  const isCreate = mode === 'create';
  const selectedEmp = form.employeeId ? getEmpName(form.employeeId) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-visible border-border p-0"
        dir="rtl"
      >
        <div className="shrink-0 border-b border-border/60 bg-linear-to-b from-primary/8 via-primary/3 to-transparent px-6 pb-5 pt-6">
          <DialogHeader className="space-y-3 text-right">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <FileSignature className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="font-display text-xl leading-tight">
                  {isCreate ? 'عقد عمل جديد' : 'تعديل عقد العمل'}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs leading-relaxed">
                  {isCreate
                    ? 'عبّئ بيانات العقد على مراحل — يُنشأ كمسودة ثم يُرسل للموظف للموافقة قبل التفعيل.'
                    : 'عدّل البنود طالما الحالة مسودة أو بانتظار موافقة الموظف (قبل القبول).'}
                </DialogDescription>
              </div>
            </div>
            {(form.contractNumber || selectedEmp) ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {form.contractNumber ? (
                  <span className="inline-flex items-center rounded-full border border-border/70 bg-background/80 px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
                    {form.contractNumber}
                  </span>
                ) : null}
                {selectedEmp ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/8 px-2.5 py-1 text-[10px] font-medium text-primary">
                    <User className="h-3 w-3" />
                    {selectedEmp}
                  </span>
                ) : null}
              </div>
            ) : null}
          </DialogHeader>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {/* Template & shortcuts */}
          <section className="space-y-3">
            <SectionHeader
              icon={Layers}
              title="البداية السريعة"
              description="اختر قالباً أو انسخ من عقد سابق لتسريع الإدخال"
            />
            <SectionCard>
              <div className="space-y-4">
                <Field label="قالب العقد" span2 hint="يُعبّئ الراتب والبدلات ومواد العقد تلقائياً عند الاختيار.">
                  <MinimalDropdown
                    value={form.templateId}
                    onChange={(id) => { void onApplyTemplate(id); }}
                    options={templateOptions}
                    placeholder={applyingTemplate ? 'جاري تحميل القالب…' : 'اختر قالباً…'}
                  />
                </Field>

                {isCreate ? (
                  <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-3.5">
                    <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
                      انسخ بيانات عقد موظف آخر مع الإبقاء على الموظف المستهدف وتوليد رقم عقد جديد.
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                      <div className="min-w-0 flex-1 basis-[12rem]">
                        <SearchableDropdown
                          value={copyFromEmployeeId}
                          onChange={(id) => onCopyFromEmployeeChange(id)}
                          options={copySourceEmpOptions}
                          placeholder={copySourceEmpOptions.length ? 'موظف المصدر…' : 'لا يوجد موظف لديه عقد'}
                        />
                      </div>
                      <div className="min-w-0 flex-1 basis-[12rem]">
                        <MinimalDropdown
                          value={copyFromContractId}
                          onChange={onCopyFromContractChange}
                          options={[
                            { value: '', label: '— اختر العقد —' },
                            ...copySourceContractOptions,
                          ]}
                          placeholder="عقد المصدر"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-9 shrink-0 gap-1.5"
                        disabled={!copyFromContractId}
                        onClick={onApplyCopyFromContract}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        تطبيق النسخ
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </SectionCard>
          </section>

          {/* Employee */}
          <section className="space-y-3">
            <SectionHeader icon={User} title="الموظف" description="ربط العقد بالموظف المعني" />
            <SectionCard>
              <Field label="الموظف" required span2>
                <SearchableDropdown
                  value={form.employeeId}
                  onChange={(v) => onPatch({ employeeId: v })}
                  options={empOptions}
                  placeholder="اختر الموظف…"
                />
              </Field>

              {isCreate ? (
                <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-primary/15 bg-primary/5 px-3.5 py-3">
                  <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
                    <p className="font-medium text-foreground">إشعار تلقائي بعد الحفظ</p>
                    <p>
                      {selectedEmp
                        ? `سيُرسل إشعار إلى ${selectedEmp} لمراجعة العقد والموافقة عليه.`
                        : 'بعد اختيار الموظف وحفظ العقد سيُرسل له إشعار للمراجعة والموافقة.'}
                    </p>
                  </div>
                </div>
              ) : null}
            </SectionCard>
          </section>

          {/* Terms */}
          <section className="space-y-3">
            <SectionHeader icon={Briefcase} title="شروط العقد" description="نوع العقد، الدوام، والتواريخ" />
            <SectionCard>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="نوع العقد">
                  <MinimalDropdown
                    value={form.contractType}
                    onChange={(v) => {
                      const contractType = v as ContractNature;
                      onPatch({
                        contractType,
                        ...(contractType !== 'fixed_term' ? { endDate: '' } : {}),
                      });
                    }}
                    options={CONTRACT_NATURE_DROPDOWN_OPTIONS}
                  />
                </Field>
                <Field label="نوع الدوام">
                  <MinimalDropdown
                    value={form.workArrangement}
                    onChange={(v) => onPatch({ workArrangement: v as WorkArrangement })}
                    options={WORK_ARRANGEMENT_DROPDOWN_OPTIONS}
                  />
                </Field>
                <Field label="تاريخ البداية" required>
                  <DatePickerInput
                    value={form.startDate}
                    onChange={(next) => onPatch({ startDate: next })}
                    placeholder="اختر تاريخ البداية"
                    maxDate={form.contractType === 'fixed_term' ? form.endDate || undefined : undefined}
                  />
                </Field>
                {form.contractType === 'fixed_term' ? (
                  <Field label="تاريخ الانتهاء" required>
                    <DatePickerInput
                      value={form.endDate}
                      onChange={(next) => onPatch({ endDate: next })}
                      placeholder="اختر تاريخ الانتهاء"
                      minDate={form.startDate || undefined}
                    />
                  </Field>
                ) : null}
                <Field label="أيام التجربة">
                  <Input
                    type="number"
                    min="0"
                    value={form.probationDays}
                    onChange={(e) => onPatch({ probationDays: e.target.value })}
                    placeholder="90"
                  />
                </Field>
                <Field label="الإجازات السنوية" required hint="إجمالي أيام الإجازة المعتمدة في العقد لكل سنة.">
                  <Input
                    type="number"
                    min="0"
                    max="366"
                    step="1"
                    value={form.annualLeaveDays}
                    onChange={(e) => onPatch({ annualLeaveDays: e.target.value })}
                    placeholder="21"
                  />
                </Field>
              </div>
            </SectionCard>
          </section>

          {/* Compensation */}
          <section className="space-y-3">
            <SectionHeader icon={Coins} title="التعويضات" description="الراتب الأساسي والبدلات" />
            <SectionCard>
              <Field label="الراتب الأساسي" required span2>
                <Input
                  type="number"
                  min="0"
                  value={form.baseSalary}
                  onChange={(e) => onPatch({ baseSalary: e.target.value })}
                  placeholder="0"
                />
              </Field>

              <Separator className="my-4" />

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">البدلات من الدليل</p>
                {allowanceOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">لا توجد بدلات في الدليل.</p>
                ) : null}
                {form.allowanceLines.map((line, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/15 p-2"
                  >
                    <div className="min-w-0 flex-1">
                      <MinimalDropdown
                        value={line.allowanceTypeId}
                        onChange={(v) => onUpdateAllowanceLine(idx, { allowanceTypeId: v })}
                        options={[{ value: '', label: 'اختر البدل…' }, ...allowanceOptions]}
                      />
                    </div>
                    <Input
                      type="number"
                      min="0"
                      className="w-28 shrink-0 text-xs"
                      value={line.amount}
                      placeholder="0"
                      onChange={(e) => onUpdateAllowanceLine(idx, { amount: e.target.value })}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemoveAllowanceLine(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={onAddAllowanceLine}>
                  <Plus className="h-3 w-3" />
                  إضافة بدل
                </Button>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="ملاحظات البدلات">
                  <Input
                    value={form.allowancesNote}
                    onChange={(e) => onPatch({ allowancesNote: e.target.value })}
                    placeholder="اختياري…"
                  />
                </Field>
                <Field label="ملاحظات الخصومات">
                  <Input
                    value={form.deductionsNote}
                    onChange={(e) => onPatch({ deductionsNote: e.target.value })}
                    placeholder="اختياري…"
                  />
                </Field>
              </div>
            </SectionCard>
          </section>

          {/* Articles */}
          <section className="space-y-3">
            <SectionHeader
              icon={ScrollText}
              title={`مواد العقد${form.articleIds.length > 0 ? ` · ${form.articleIds.length} محدّدة` : ''}`}
              description="المواد الأساسية مُلزمة ولا يمكن إزالتها"
            />
            <SectionCard className="p-0 overflow-hidden">
              {activeArticles.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground">لا توجد مواد فعّالة.</p>
              ) : (
                <div className="max-h-60 divide-y divide-border/60 overflow-y-auto">
                  {activeArticles.map((a) => {
                    const isEssential = a.isBasic && essentialArticleIds.includes(a.id);
                    const isChecked = isEssential || form.articleIds.includes(a.id);
                    return (
                      <label
                        key={a.id}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/25',
                          isEssential && 'cursor-default bg-primary/5 hover:bg-primary/5',
                          isChecked && !isEssential && 'bg-primary/5',
                        )}
                      >
                        <input
                          type="checkbox"
                          className={cn(
                            'mt-0.5 h-4 w-4 rounded border-border accent-primary',
                            isEssential && 'cursor-not-allowed opacity-70',
                          )}
                          checked={isChecked}
                          disabled={isEssential}
                          onChange={() => onToggleArticle(a.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[10px] text-muted-foreground">{a.code}</span>
                            {a.isBasic ? (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary">
                                أساسية · مُلزمة
                              </span>
                            ) : null}
                          </div>
                          <p className="text-sm font-medium leading-snug">{a.title}</p>
                          <p className="mt-0.5   text-[11px] text-muted-foreground">{a.body.slice(0, 120)}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </SectionCard>
            {form.articleIds.length > 1 ? (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">ترتيب المواد في العقد</Label>
                <ArticleOrderList
                  items={orderedArticles(form.articleIds, activeArticles)}
                  onChange={(articleIds) => onPatch({ articleIds })}
                />
              </div>
            ) : null}
          </section>

          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </div>

        <DialogFooter className={cn(dialogFormFooterClass, 'gap-2')}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 gap-1.5 text-xs"
            onClick={onPreviewPdf}
            disabled={!form.employeeId}
          >
            <FileDown className="h-3.5 w-3.5 shrink-0" />
            معاينة PDF
          </Button>
          <Button variant="luxe" type="button" className="h-9" onClick={onSave}>
            {isCreate ? 'إنشاء العقد' : 'حفظ التعديلات'}
          </Button>
          <Button variant="outline" type="button" className="h-9" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
