'use client';

import { Plus, Pencil, Trash2, RefreshCw, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { MonthDayPickerInput } from '@/features/hr/leaves/public-holidays/components/month-day-picker-input';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { HRSettingsFormDrawer, FormField } from '@/components/ui/shared-dialogs';
import {
  usePublicHolidaysPanelModel,
  type PublicHolidayDraft,
} from '@/features/hr/leaves/public-holidays/hooks/usePublicHolidaysPanelModel';
import { ForbiddenState } from '@/components/shared/forbidden-state';
import { DirectoryPagedViews } from '@/components/ui/paged-list';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { cn, formatDisplayDate } from '@/shared/utils';
import { RegisterExportMenu } from '@/components/pdf/register-export-menu';
import type { RegisterColumn } from '@/components/pdf/print/register-document';
import { useLatestCallback } from '@/shared/hooks/use-latest-callback';

function formatMonthDay(mmdd: string): string {
  const m = /^(\d{2})-(\d{2})$/.exec(mmdd.trim());
  if (!m) return formatDisplayDate(mmdd);
  return `${m[1]}/${m[2]}`;
}

const HOLIDAY_EXPORT_COLUMNS: RegisterColumn[] = [
  { label: 'الاسم', kind: 'text', weight: 1.6 },
  { label: 'التاريخ', kind: 'date' },
  { label: 'التكرار', kind: 'status' },
  { label: 'الحالة', kind: 'status' },
];

export function PublicHolidaysPanel() {
  const m = usePublicHolidaysPanelModel();

  const getExportRows = useLatestCallback(async (): Promise<string[][]> => {
    const items = await m.loadAllForExport();
    return items.map((item) => {
      const [mm, dd] = item.date.split('-');
      return [
        item.nameAr || '—',
        mm && dd ? `${mm}/${dd}` : formatMonthDay(item.date),
        item.recurring ? 'يتكرر سنوياً' : 'مرة واحدة',
        item.isActive ? 'نشط' : 'موقوف',
      ];
    });
  });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <RegisterExportMenu
          title="العطل الرسمية"
          fileName="public-holidays"
          columns={HOLIDAY_EXPORT_COLUMNS}
          getRows={getExportRows}
        />
        <Button variant="luxe" size="sm" className="h-8 gap-1.5 px-3 text-xs" onClick={m.openCreate} disabled={m.loading}>
          <Plus className="h-3.5 w-3.5" />
          إضافة عطلة رسمية
        </Button>
      </div>
    ),
    [m.openCreate, m.loading],
  );

  if (m.accessDenied) {
    return <ForbiddenState title="لا تملك صلاحية الوصول للعطل الرسمية" />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {m.listError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive whitespace-pre-wrap">{m.listError}</p>
      ) : null}

      {m.loading && m.sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">جاري التحميل...</p>
      ) : m.sorted.length === 0 && !m.loading ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 py-16 text-center">
          <CalendarIcon className="mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">لا توجد عطل رسمية. ابدأ بإضافة عطلة جديدة.</p>
        </div>
      ) : (
        <DirectoryPagedViews items={m.sorted} serverPagination={m.pagination} loading={m.loading}>
          {(pageItems) => (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pageItems.map((item) => {
              const [mm, dd] = item.date.split('-');
              const dateLabel = mm && dd ? `${mm}/${dd}` : formatMonthDay(item.date);
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => m.openEdit(item)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); m.openEdit(item); } }}
                  className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary opacity-0 blur-2xl transition-opacity group-hover:opacity-10" />
                  <div className="relative p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className={cn(
                        'flex h-12 w-12 flex-col items-center justify-center rounded-xl',
                        item.isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground/60',
                      )}>
                        <span className="font-display text-sm font-bold leading-none font-mono tabular-nums" dir="ltr">{dateLabel}</span>
                      </div>
                      {!item.recurring && item.startDate && (
                        <span className="mx-2 min-w-0 flex-1 truncate text-[11px] text-muted-foreground" dir="ltr">
                          {item.startDate}
                          {item.endDate && item.endDate !== item.startDate ? ` → ${item.endDate}` : ''}
                        </span>
                      )}
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                        item.isActive
                          ? 'border-success/30 bg-success/10 text-success'
                          : 'border-border bg-muted text-muted-foreground',
                      )}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', item.isActive ? 'bg-success' : 'bg-muted-foreground')} />
                        {item.isActive ? 'نشط' : 'موقوف'}
                      </span>
                    </div>
                    <h3 className="font-display text-base font-bold leading-snug mb-3 group-hover:text-primary transition-colors truncate">
                      {item?.nameAr ?? '—'}
                    </h3>
                    <div className="mb-4">
                      {item.recurring ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          <RefreshCw className="h-2.5 w-2.5" />
                          يتكرر سنوياً
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          مرة واحدة
                        </span>
                      )}
                    </div>
                    <div
                      className="flex items-center gap-1 border-t border-border/60 pt-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button variant="ghost" size="sm" type="button" className="h-7 gap-1 px-2 text-xs" onClick={() => m.openEdit(item)}>
                        <Pencil className="h-3 w-3" /> تعديل
                      </Button>
                      <Button variant="ghost" size="sm" type="button" className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive" onClick={() => m.setConfirmId(item.id)}>
                        <Trash2 className="h-3 w-3" /> حذف
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </DirectoryPagedViews>
      )}

      <HRSettingsFormDrawer
        open={m.open}
        onOpenChange={m.setOpen}
        title={m.editId ? 'تعديل العطلة الرسمية' : 'إضافة عطلة رسمية'}
        description="العطلة الثابتة (مثل اليوم الوطني) تتكرر كل سنة. الأعياد تتغير كل سنة فتُدخل بتاريخ من وإلى. لا يُحسب غياب في العطلة، ومن يعمل فيها يُسجَّل له عمل إضافي."
        size="lg"
        onSave={() => void m.save()}
        saveLabel={m.editId ? 'حفظ التعديلات' : 'إضافة العطلة'}
        error={m.error}
      >
        {m.draft.recurring ? (
          <FormField label="الشهر واليوم (كل سنة)" required>
            <MonthDayPickerInput
              value={m.draft.date}
              onChange={(mmdd) => m.patch('date', mmdd)}
            />
          </FormField>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="من" required>
              <DatePickerInput
                value={m.draft.startDate ?? ''}
                onChange={(ymd) => m.patch('startDate', ymd || null)}
              />
            </FormField>
            <FormField label="إلى">
              <DatePickerInput
                value={m.draft.endDate ?? ''}
                onChange={(ymd) => m.patch('endDate', ymd || null)}
                minDate={m.draft.startDate ?? undefined}
              />
            </FormField>
          </div>
        )}
        <FormField label="الاسم" required>
          <Input value={m.draft.nameAr} onChange={(e) => m.patch('nameAr', e.target.value)} />
        </FormField>
        <Separator />
        <div className="space-y-3">
          {([
            ['recurring', 'تتكرر سنوياً (نفس الشهر واليوم) — ألغِ التحديد للأعياد'],
            ['isActive', 'نشط'],
          ] as [keyof PublicHolidayDraft, string][]).map(([key, label]) => (
            <label key={key} className={cn(
              'flex cursor-pointer items-center justify-between rounded-xl border-2 px-4 py-3 transition-all',
              m.draft[key]
                ? 'border-primary/30 bg-primary/5'
                : 'border-border bg-muted/10 hover:border-border hover:bg-muted/20',
            )}>
              <span className="text-sm font-medium">{label}</span>
              <Checkbox checked={m.draft[key] as boolean} onCheckedChange={(v) => m.patch(key, v === true)} />
            </label>
          ))}
        </div>
      </HRSettingsFormDrawer>

      <Dialog open={!!m.confirmId} onOpenChange={(o) => !o && m.setConfirmId(null)}>
        <DialogContent className="border-border sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>حذف العطلة الرسمية</DialogTitle>
            <DialogDescription>هل أنت متأكد من حذف هذه العطلة؟ لا يمكن التراجع عن هذا الإجراء.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" onClick={() => void m.remove()}>حذف</Button>
            <Button variant="outline" onClick={() => m.setConfirmId(null)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
