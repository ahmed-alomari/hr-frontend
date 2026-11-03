'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, RefreshCw, Upload, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCan } from '@/features/auth/hooks/use-can';
import { ecommerceAdminRoutes } from '@/features/ecommerce/admin/constants/routes';
import { getStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import { cn } from '@/shared/utils';
import {
  previewFromError,
  storeImportApi,
  type StoreImportIssue,
  type StoreImportOptions,
  type StoreImportPreview,
  type StoreImportSheet,
  type StoreImportSheetKey,
} from '../lib/store-import-api';

const SKIP = '__skip__';
const SHEET_LABEL: Record<StoreImportSheetKey, string> = { products: 'المنتجات', variants: 'المتغيرات' };
const MAX_SHOWN_ISSUES = 200;

/** The mapping the server applied, as the user can edit it (header → field). */
function mappingOf(sheet: StoreImportSheet): Record<string, string> {
  return Object.fromEntries(sheet.columns.filter((c) => c.header).map((c) => [c.header, c.field ?? '']));
}

/**
 * Store products import (2026-10-27): template → file → columns → review →
 * import. Every check is the server's: the page shows what the preview
 * answers and sends the file again on commit (the server checks it again).
 */
export function StoreImportPage() {
  const companyId = getStorefrontCompanyId();
  const can = useCan();
  const allowed = can('catalog.products.create') && can('catalog.products.update');

  const [file, setFile] = React.useState<File | null>(null);
  // A CSV holds one kind of record: the server tells it by its columns,
  // unless the user picks it here.
  const [csvSheet, setCsvSheet] = React.useState<StoreImportSheetKey | null>(null);
  const [mapping, setMapping] = React.useState<StoreImportOptions['mapping']>({});
  const [publish, setPublish] = React.useState(false);
  // Categories and brands the system lacks: created and linked, or refused.
  const [createMissing, setCreateMissing] = React.useState(true);
  const createMissingRef = React.useRef(createMissing);
  createMissingRef.current = createMissing;
  const [preview, setPreview] = React.useState<StoreImportPreview | null>(null);
  const [busy, setBusy] = React.useState<'preview' | 'commit' | null>(null);
  const [done, setDone] = React.useState<StoreImportPreview | null>(null);
  const [onlyErrors, setOnlyErrors] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const isCsv = Boolean(file && /\.csv$/i.test(file.name));

  const runPreview = React.useCallback(
    async (next: {
      file: File;
      mapping?: StoreImportOptions['mapping'];
      sheet?: StoreImportSheetKey | null;
      createMissing?: boolean;
    }) => {
      setBusy('preview');
      setDone(null);
      try {
        const result = await storeImportApi.preview(companyId, next.file, {
          mapping: next.mapping,
          sheet: /\.csv$/i.test(next.file.name) ? (next.sheet ?? undefined) : undefined,
          createMissing: next.createMissing ?? createMissingRef.current,
        });
        setPreview(result);
        setMapping(Object.fromEntries(result.sheets.map((s) => [s.key, mappingOf(s)])));
      } catch {
        // The API client already showed why (unreadable file, size, …).
        setPreview(null);
      } finally {
        setBusy(null);
      }
    },
    [companyId],
  );

  function pickFile(picked: File | null) {
    setFile(picked);
    setPreview(null);
    setMapping({});
    setDone(null);
    setCsvSheet(null);
    if (picked) void runPreview({ file: picked });
  }

  function changeColumn(sheet: StoreImportSheetKey, header: string, field: string) {
    if (!file) return;
    const value = field === SKIP ? '' : field;
    const current = { ...(mapping?.[sheet] ?? {}) };
    // A field fills one column: the column that had it lets it go.
    for (const [h, f] of Object.entries(current)) if (f === value && value) current[h] = '';
    current[header] = value;
    const next = { ...mapping, [sheet]: current };
    setMapping(next);
    void runPreview({ file, mapping: next, sheet: csvSheet });
  }

  async function commit() {
    if (!file || !preview?.canCommit) return;
    setBusy('commit');
    try {
      const result = await storeImportApi.commit(companyId, file, {
        mapping,
        publish,
        createMissing,
        // The kind the preview read, so the commit reads the file the same way.
        sheet: isCsv ? (csvSheet ?? preview.sheets[0]?.key) : undefined,
      });
      setDone(result);
      setPreview(null);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      toast.success('تم الاستيراد');
    } catch (error) {
      // Checked again on the server: show what changed.
      const refreshed = previewFromError(error);
      if (refreshed) setPreview(refreshed);
    } finally {
      setBusy(null);
    }
  }

  const issues = React.useMemo(() => {
    const all = preview?.issues ?? [];
    return (onlyErrors ? all.filter((i) => i.level === 'error') : all).slice(0, MAX_SHOWN_ISSUES);
  }, [preview, onlyErrors]);

  if (!allowed) {
    return (
      <>
        <SetPageTitle titleAr="استيراد المنتجات" iconName="FileSpreadsheet" />
        <p className="text-sm text-muted-foreground">ليست لديك صلاحية إضافة المنتجات وتعديلها.</p>
      </>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <SetPageTitle
        titleAr="استيراد المنتجات"
        descriptionAr="من ملف Excel (بصوره) أو CSV: منتجات جديدة، وتحديث الموجود برمزه."
        iconName="FileSpreadsheet"
      />

      {/* 1 — template and file */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">١. القالب والملف</CardTitle>
          <CardDescription>
            حمّل القالب واملأه، أو ارفع ملفك كما هو وطابق أعمدته في الخطوة التالية. المنتج الذي رمزه موجود يُحدَّث.
            الصور تُوضع داخل ملف Excel نفسه في خلية «الصور» (إدراج ← صور ← وضع في الخلية)، أو تُكتب روابطها. ملف CSV
            لا يحمل صوراً، فيقبل الروابط فقط. نوع الملف يُعرف تلقائياً.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void storeImportApi.downloadTemplate(companyId, 'xlsx')}>
              <Download className="h-4 w-4" />
              قالب Excel (منتجات ومتغيرات)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void storeImportApi.downloadTemplate(companyId, 'csv', 'products')}
            >
              <Download className="h-4 w-4" />
              CSV المنتجات
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void storeImportApi.downloadTemplate(companyId, 'csv', 'variants')}
            >
              <Download className="h-4 w-4" />
              CSV المتغيرات
            </Button>
          </div>

          <label
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-6 text-center transition-colors hover:bg-muted/40',
              file && 'border-primary/50 bg-primary/5',
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pickFile(e.dataTransfer.files?.[0] ?? null);
            }}
          >
            {file ? <FileSpreadsheet className="h-7 w-7 text-primary" /> : <Upload className="h-7 w-7 text-muted-foreground" />}
            <span className="text-sm font-medium">{file ? file.name : 'اختر ملف Excel أو CSV أو اسحبه هنا'}</span>
            <span className="text-xs text-muted-foreground">
              Excel أو CSV، حتى 50 ميغابايت (مع الصور) و5000 سطر في الورقة
            </span>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
          </label>

          {isCsv ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                {csvSheet ? 'ملف CSV يحمل نوعاً واحداً:' : 'ملف CSV يحمل نوعاً واحداً، عرفناه من أعمدته:'}
              </span>
              <Select
                value={csvSheet ?? preview?.sheets[0]?.key ?? 'products'}
                onValueChange={(value) => {
                  const sheet = value as StoreImportSheetKey;
                  setCsvSheet(sheet);
                  if (file) void runPreview({ file, sheet });
                }}
              >
                <SelectTrigger className="h-9 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="products">منتجات</SelectItem>
                  <SelectItem value="variants">متغيرات</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {busy === 'preview' ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              جارٍ قراءة الملف وفحصه (لا يُحفظ شيء)…
            </p>
          ) : null}
        </CardContent>
      </Card>

      {done ? <ImportDone result={done} /> : null}

      {preview ? (
        <>
          {/* 2 — columns */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">٢. مطابقة الأعمدة</CardTitle>
              <CardDescription>
                لكل عمود في ملفك اختر الحقل الذي يقابله في النظام، أو «لا يُستورد». الحقول المعلَّمة * إلزامية.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {preview.sheets.map((sheet) => (
                <SheetColumns
                  key={sheet.key}
                  sheet={sheet}
                  disabled={busy !== null}
                  onChange={(header, field) => changeColumn(sheet.key, header, field)}
                />
              ))}
            </CardContent>
          </Card>

          {/* 3 — review */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">٣. المراجعة</CardTitle>
              <CardDescription>ما سيحدث عند الاستيراد. لا يُحفظ شيء قبل الضغط على «استيراد».</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {preview.linkedToInventory ? (
                <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
                  المتجر مربوط بالمخازن: تُستورد المنتجات بياناتٍ وأسعار بيع فقط، والتكلفة والكمية تأتيان من المخزون.
                </p>
              ) : null}

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Count label="منتجات جديدة" value={preview.counts.productsCreated} />
                <Count label="منتجات تُحدَّث" value={preview.counts.productsUpdated} />
                <Count label="متغيرات جديدة" value={preview.counts.variantsCreated} />
                <Count label="متغيرات تُحدَّث" value={preview.counts.variantsUpdated} />
              </div>
              <label className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm">
                <Checkbox
                  className="mt-0.5"
                  checked={createMissing}
                  disabled={busy !== null}
                  onCheckedChange={(v) => {
                    const next = v === true;
                    setCreateMissing(next);
                    if (file) void runPreview({ file, mapping, sheet: csvSheet, createMissing: next });
                  }}
                />
                <span>
                  إنشاء ما لا يوجد وربطه
                  <span className="block text-xs text-muted-foreground">
                    التصنيفات والعلامات التجارية المكتوبة في الملف وغير الموجودة في النظام تُنشأ وتُربط بالمنتجات.
                    إن ألغيته صارت أخطاء تُصحَّح في الملف، ولا يُنشأ شيء جديد.
                  </span>
                </span>
              </label>
              {preview.counts.categoriesCreated.length ? (
                <p className="text-sm text-muted-foreground">
                  تصنيفات ستُنشأ: {preview.counts.categoriesCreated.join('، ')}
                </p>
              ) : null}
              {preview.counts.brandsCreated?.length ? (
                <p className="text-sm text-muted-foreground">
                  علامات تجارية ستُنشأ: {preview.counts.brandsCreated.join('، ')}
                </p>
              ) : null}
              {preview.counts.imagesInFile ? (
                <p className="text-sm text-muted-foreground">
                  صور من داخل الملف: {preview.counts.imagesInFile}، تُحفظ مع المنتجات عند الاستيراد.
                </p>
              ) : null}
              {preview.counts.quantitiesSet ? (
                <p className="text-sm text-muted-foreground">
                  تُضبط كمية المنتج لـ {preview.counts.quantitiesSet} منتجاً أو متغيراً (الكمية في الملف هي الكمية الجديدة).
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={preview.errors ? 'destructive' : 'success'}>{preview.errors} خطأ</Badge>
                <Badge variant={preview.warnings ? 'warning' : 'subtle'}>{preview.warnings} تنبيه</Badge>
                {preview.issues.length ? (
                  <label className="ms-auto flex items-center gap-2 text-sm">
                    <Checkbox checked={onlyErrors} onCheckedChange={(v) => setOnlyErrors(v === true)} />
                    الأخطاء فقط
                  </label>
                ) : null}
              </div>

              {issues.length ? <IssuesList issues={issues} sheets={preview.sheets} /> : null}
              {preview.issues.length > issues.length && !onlyErrors ? (
                <p className="text-xs text-muted-foreground">تُعرض أول {MAX_SHOWN_ISSUES} ملاحظة.</p>
              ) : null}
            </CardContent>
          </Card>

          {/* 4 — import */}
          <Card>
            <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={publish} onCheckedChange={(v) => setPublish(v === true)} />
                انشر المنتجات الجديدة مباشرة (وإلا تُحفظ مسودة لمراجعتها)
              </label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={!file || busy !== null}
                  onClick={() => file && void runPreview({ file, mapping, sheet: csvSheet })}
                >
                  <RefreshCw className="h-4 w-4" />
                  إعادة الفحص
                </Button>
                <Button disabled={!preview.canCommit || busy !== null} onClick={() => void commit()}>
                  {busy === 'commit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  استيراد
                </Button>
              </div>
            </CardContent>
            {!preview.canCommit ? (
              <p className="px-6 pb-4 text-xs text-muted-foreground">
                {preview.errors ? 'صحّح الأخطاء في الملف ثم ارفعه مرة أخرى.' : 'لا توجد أسطر للاستيراد.'}
              </p>
            ) : null}
          </Card>
        </>
      ) : null}
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function SheetColumns({
  sheet,
  disabled,
  onChange,
}: {
  sheet: StoreImportSheet;
  disabled: boolean;
  onChange: (header: string, field: string) => void;
}) {
  const used = new Set(sheet.columns.map((c) => c.field).filter(Boolean));
  const missing = sheet.fields.filter((f) => f.required && !used.has(f.key));
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">
        {SHEET_LABEL[sheet.key]}
        <span className="ms-2 text-xs font-normal text-muted-foreground">
          ورقة «{sheet.sheetName}» — {sheet.rows} سطر، العناوين في السطر {sheet.headerRow}
        </span>
      </p>
      <div className="divide-y divide-border/60 rounded-xl border border-border/60">
        {sheet.columns
          .filter((c) => c.header)
          .map((column) => (
            <div key={column.index} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{column.header}</p>
                <p className="truncate text-xs text-muted-foreground" dir="auto">
                  {column.samples.join(' · ') || '—'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {column.field && column.confidence < 1 ? (
                  <Badge variant="warning" title="اسم مشابه: تأكد من المطابقة">
                    تخمين
                  </Badge>
                ) : null}
                <Select
                  value={column.field ?? SKIP}
                  disabled={disabled}
                  onValueChange={(value) => onChange(column.header, value)}
                >
                  <SelectTrigger className={cn('h-9 w-full sm:w-52', !column.field && 'text-muted-foreground')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SKIP}>لا يُستورد</SelectItem>
                    {sheet.fields.map((field) => (
                      <SelectItem key={field.key} value={field.key}>
                        {field.labelAr}
                        {field.required ? ' *' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
      </div>
      {missing.length ? (
        <p className="text-xs text-destructive">
          حقول إلزامية بلا عمود: {missing.map((f) => f.labelAr).join('، ')}
        </p>
      ) : null}
    </div>
  );
}

function IssuesList({ issues, sheets }: { issues: StoreImportIssue[]; sheets: StoreImportSheet[] }) {
  const label = (issue: StoreImportIssue) =>
    sheets.find((s) => s.key === issue.sheet)?.fields.find((f) => f.key === issue.field)?.labelAr ?? null;
  return (
    <ul className="flex max-h-[28rem] flex-col divide-y divide-border/60 overflow-y-auto rounded-xl border border-border/60">
      {issues.map((issue, i) => (
        <li key={i} className="flex gap-3 px-3 py-2 text-sm">
          {issue.level === 'error' ? (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">
              {SHEET_LABEL[issue.sheet]}
              {issue.row ? ` · السطر ${issue.row}` : ''}
              {label(issue) ? ` · ${label(issue)}` : ''}
            </p>
            <p>{issue.message}</p>
            {issue.fix ? <p className="text-xs text-muted-foreground">{issue.fix}</p> : null}
            {issue.suggestions?.length ? (
              <p className="text-xs">
                هل تقصد: <span className="font-medium">{issue.suggestions.join('، ')}</span>
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ImportDone({ result }: { result: StoreImportPreview }) {
  const c = result.counts;
  return (
    <Card className="border-success/30">
      <CardContent className="flex flex-col gap-2 pt-6">
        <p className="flex items-center gap-2 font-medium text-success">
          <CheckCircle2 className="h-5 w-5" />
          تم الاستيراد
        </p>
        <p className="text-sm text-muted-foreground">
          {c.productsCreated} منتج جديد، {c.productsUpdated} محدَّث، {c.variantsCreated} متغير جديد، {c.variantsUpdated}{' '}
          متغير محدَّث{c.categoriesCreated.length ? `، ${c.categoriesCreated.length} تصنيف جديد` : ''}{c.brandsCreated?.length ? `، ${c.brandsCreated.length} علامة تجارية جديدة` : ''}.
        </p>
        <Link href={ecommerceAdminRoutes.products} className="text-sm text-primary underline-offset-4 hover:underline">
          الذهاب إلى المنتجات
        </Link>
      </CardContent>
    </Card>
  );
}
