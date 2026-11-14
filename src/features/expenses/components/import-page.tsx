'use client';

import { FoldedHeaderTool } from '@/components/layouts/phone-fold';
import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ApiError, apiDownloadToDevice, apiFormRequest } from '@/shared/api/client';
import { expensesRoutes } from '../constants/routes';
import { useExpensesStore } from '../data/store';
import { EmptyState, Money, ResponsiveTable, Section, BranchSelect } from './common';
import { useExpensesPermissions, useBranches } from './expenses-provider';

/** Mirrors `expenses-import.service.ts` in the backend. */
type SheetKey = 'expenses' | 'custodies' | 'advances';
type ImportIssue = { sheet: SheetKey; sheetLabel: string; row: number; field: string | null; message: string };
type ImportSheet = { key: SheetKey; labelAr: string; found: boolean; rows: number; ready: number; already: number; total: number };
type ImportPreview = { fileName: string; currency: string; sheets: ImportSheet[]; issues: ImportIssue[]; canCommit: boolean };
type ImportResult = ImportPreview & { created: Record<SheetKey, number> };

/** «استيراد» in a list's header (AGENTS.md §6), for who may import. */
export function ImportLinkButton() {
  const perms = useExpensesPermissions();
  if (!perms.create || !perms.approve) return null;
  return (
    <FoldedHeaderTool>
      <Button asChild type="button" variant="outline" size="sm" className="h-8 w-8 shrink-0 p-0" title="استيراد من Excel" aria-label="استيراد من Excel">
        <Link href={expensesRoutes.import}><Upload className="h-4 w-4" /></Link>
      </Button>
    </FoldedHeaderTool>
  );
}

function previewOf(error: unknown): ImportPreview | null {
  if (!(error instanceof ApiError)) return null;
  const payload = error.payload as { error?: { preview?: ImportPreview }; preview?: ImportPreview } | null;
  return payload?.error?.preview ?? payload?.preview ?? null;
}

export function ImportPage() {
  const companyId = useExpensesStore((s) => s.companyId);
  const reload = useExpensesStore((s) => s.reload);
  const perms = useExpensesPermissions();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const [busy, setBusy] = React.useState(false);
  const branches = useBranches();
  /** Every row lands here; '' is the company itself (decisions.md §29). */
  const [branchId, setBranchId] = React.useState(branches.defaultValue);
  React.useEffect(() => setBranchId(branches.defaultValue), [branches.defaultValue]);
  const allowed = perms.create && perms.approve;

  const send = async (step: 'preview' | 'commit', chosen: File) => {
    const form = new FormData();
    form.append('file', chosen);
    const branchQuery = branchId ? `&branchId=${encodeURIComponent(branchId)}` : '';
    return apiFormRequest<ImportPreview | ImportResult>(`/expenses/import/${step}?companyId=${encodeURIComponent(companyId ?? '')}${branchQuery}`, form);
  };

  const check = async (chosen: File) => {
    setFile(chosen);
    setResult(null);
    setPreview(null);
    setBusy(true);
    try {
      setPreview((await send('preview', chosen)) as ImportPreview);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذرت قراءة الملف');
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const done = (await send('commit', file)) as ImportResult;
      setResult(done);
      setPreview(null);
      await reload();
      toast.success('اكتمل الاستيراد');
    } catch (err) {
      const again = previewOf(err);
      if (again) setPreview(again);
      toast.error(err instanceof Error ? err.message : 'تعذر الاستيراد');
    } finally {
      setBusy(false);
    }
  };

  const ready = preview?.sheets.reduce((s, x) => s + x.ready, 0) ?? 0;
  const already = preview?.sheets.reduce((s, x) => s + x.already, 0) ?? 0;

  return (
    <div className="space-y-4">
      <SetPageTitle titleAr="استيراد من Excel" descriptionAr="مصروفات سابقة وأرصدة العهد والسلف الافتتاحية" iconName="FileSpreadsheet" />
      {!allowed ? (
        <p className="rounded-xl border border-border bg-muted px-3 py-2 text-sm">الاستيراد يسجّل الصفوف معتمدة، فيحتاج صلاحيتي تسجيل المصروفات واعتمادها.</p>
      ) : null}
      <Section title="1. نزّل النموذج واملأه" description="ورقة للمصروفات، وورقة للعهد الافتتاحية، وورقة للسلف الافتتاحية، وورقة «تعليمات» تشرح كل عمود. الأعمدة الصفراء إلزامية.">
        <Button variant="outline" onClick={() => void apiDownloadToDevice('/expenses/import/template', { query: { companyId: companyId ?? '' }, defaultFileName: 'نموذج-استيراد-المصروفات.xlsx' }).catch((err: unknown) => toast.error(err instanceof Error ? err.message : 'تعذر التنزيل'))}>
          <Download className="me-1.5 h-4 w-4" />
          تنزيل النموذج
        </Button>
        <ul className="mt-3 list-disc space-y-1 ps-5 text-xs text-muted-foreground">
          <li>المبالغ بعملة الشركة وبلا رمز عملة. التواريخ بصيغة 2026-10-15.</li>
          <li>الأشخاص بأسمائهم في النظام أو ببريدهم. الفئة والمجموعة بأسمائها في التهيئة.</li>
          <li>كل الصفوف تُسجَّل معتمدة باسمك. لا يُقبل تاريخ بعد اليوم ولا داخل فترة مقفلة.</li>
          <li>رفع الملف نفسه مرة ثانية لا يكرر شيئاً.</li>
        </ul>
      </Section>
      <Section title="2. ارفع الملف وراجع الفحص" description="الفحص لا يحفظ شيئاً. إن وُجد خطأ واحد لا يُسجَّل شيء.">
        {branches.show ? (
          <div className="mb-3 max-w-xs">
            <BranchSelect id="imp-branch" label="فرع الصفوف المستوردة" value={branchId} onChange={(v) => { setBranchId(v); setPreview(null); setResult(null); }} options={branches.options} />
          </div>
        ) : null}
        <input ref={inputRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void check(f); }} />
        <Button disabled={!allowed || busy} onClick={() => inputRef.current?.click()}>
          <Upload className="me-1.5 h-4 w-4" />
          {file ? 'اختيار ملف آخر' : 'اختيار ملف'}
        </Button>
        {file ? <p className="mt-2 text-xs text-muted-foreground"><FileSpreadsheet className="me-1 inline h-3.5 w-3.5" />{file.name}</p> : null}
      </Section>

      {preview ? (
        <Section title="نتيجة الفحص" actions={<Button disabled={!preview.canCommit || busy || !allowed} onClick={() => void commit()}>استيراد {ready} صف</Button>}>
          <ResponsiveTable
            rows={preview.sheets.filter((s) => s.found)}
            rowKey={(s) => s.key}
            card={(s) => (
              <div className="flex items-start justify-between gap-2 text-sm">
                <div><p className="font-medium">{s.labelAr}</p><p className="text-xs text-muted-foreground">{s.rows} صف · جاهز {s.ready} · سبق استيراده {s.already}</p></div>
                <Money value={s.total} className="font-semibold" />
              </div>
            )}
            columns={[
              { header: 'الورقة', cell: (s) => s.labelAr },
              { header: 'الصفوف', cell: (s) => s.rows },
              { header: 'جاهز للتسجيل', cell: (s) => s.ready },
              { header: 'سبق استيراده', cell: (s) => s.already },
              { header: 'الإجمالي', cell: (s) => <Money value={s.total} className="font-semibold" /> },
            ]}
          />
          {preview.sheets.every((s) => !s.found) ? <EmptyState text="لم تُعرف أي ورقة في الملف: استخدم النموذج." /> : null}
          {already > 0 && ready === 0 && preview.issues.length === 0 ? <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs">كل صفوف هذا الملف استُوردت من قبل.</p> : null}
          {preview.issues.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold text-destructive">{preview.issues.length} خطأ: صحّحها في الملف وارفعه من جديد</p>
              <ResponsiveTable
                rows={preview.issues}
                rowKey={(i) => `${i.sheet}:${i.row}:${i.field ?? ''}:${i.message}`}
                card={(i) => (
                  <div className="space-y-1 text-sm">
                    <div className="flex flex-wrap gap-1.5"><Badge variant="subtle">{i.sheetLabel}</Badge><Badge variant="subtle">صف {i.row}</Badge>{i.field ? <Badge variant="subtle">{i.field}</Badge> : null}</div>
                    <p>{i.message}</p>
                  </div>
                )}
                columns={[
                  { header: 'الورقة', cell: (i) => i.sheetLabel },
                  { header: 'الصف', cell: (i) => i.row },
                  { header: 'العمود', cell: (i) => i.field ?? '—' },
                  { header: 'الخطأ', cell: (i) => i.message },
                ]}
              />
            </div>
          ) : null}
        </Section>
      ) : null}

      {result ? (
        <Section title="تم الاستيراد">
          <p className="text-sm">سُجّل {result.created.expenses} مصروف، و{result.created.custodies} عهدة، و{result.created.advances} سلفة، كلها معتمدة.</p>
        </Section>
      ) : null}
    </div>
  );
}
