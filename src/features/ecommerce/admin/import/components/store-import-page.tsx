'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Undo2,
  Upload,
  Wand2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCan } from '@/features/auth/hooks/use-can';
import { useProductsBasePath } from '@/features/catalog/products/lib/products-navigation';
import { getStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import { cn } from '@/shared/utils';
import {
  previewFromError,
  storeImportApi,
  type StoreImportCorrection,
  type StoreImportIssue,
  type StoreImportIssueAction,
  type StoreImportOptions,
  type StoreImportRowRef,
  type StoreImportPreview,
  type StoreImportSheet,
  type StoreImportSheetKey,
  type StoreImportUnknownValue,
  type StoreImportValueField,
} from '../lib/store-import-api';

const SKIP = '__skip__';
const CREATE = '__create__';
const UNSET = '__unset__';
/** A «خاصية: اللون» column of the variants sheet (the server's field key). */
const ATTRIBUTE_FIELD = 'attribute:';
const VALUE_FIELD_LABEL: Record<StoreImportValueField, string> = {
  category: 'التصنيف',
  brand: 'العلامة التجارية',
  uom: 'وحدة القياس',
  attribute: 'الخاصية',
  attributeValue: 'قيمة الخاصية',
};
const sameCorrection = (a: StoreImportCorrection, b: { field: string; attribute?: string | null; from: string }) =>
  a.field === b.field && (a.attribute ?? null) === (b.attribute ?? null) && a.from === b.from;
const SHEET_LABEL: Record<StoreImportSheetKey, string> = {
  products: 'المنتجات',
  variants: 'المتغيرات',
};
const MAX_SHOWN_ISSUES = 200;

/** The review's one-click fixes, sent with the preview and the commit. */
type Fixes = {
  skipRows: StoreImportRowRef[];
  keepCells: Array<StoreImportRowRef & { field: string }>;
};
const NO_FIXES: Fixes = { skipRows: [], keepCells: [] };
const ACTION_LABEL: Record<StoreImportIssueAction['type'], string> = {
  skipRow: 'تجاهل السطر',
  keepStored: 'أبقِ ما في النظام',
};

/** The fixes with these issues' actions added (each row and cell once). */
function withFixes(current: Fixes, issues: StoreImportIssue[]): Fixes {
  const skipRows = [...current.skipRows];
  const keepCells = [...current.keepCells];
  for (const issue of issues) {
    if (!issue.action || !issue.row) continue;
    const ref = { sheet: issue.sheet, row: issue.row };
    if (issue.action.type === 'skipRow') {
      if (!skipRows.some((r) => r.sheet === ref.sheet && r.row === ref.row)) skipRows.push(ref);
    } else {
      const field = issue.action.field;
      if (!keepCells.some((c) => c.sheet === ref.sheet && c.row === ref.row && c.field === field)) {
        keepCells.push({ ...ref, field });
      }
    }
  }
  return { skipRows, keepCells };
}

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
  // Categories and brands the system lacks: created and linked, or refused.
  const [createMissing, setCreateMissing] = React.useState(true);
  const createMissingRef = React.useRef(createMissing);
  createMissingRef.current = createMissing;
  // Answers for values the system lacks: replace in every row, or create.
  const [corrections, setCorrections] = React.useState<StoreImportCorrection[]>([]);
  const correctionsRef = React.useRef(corrections);
  correctionsRef.current = corrections;
  // One-click fixes (2026-11-05): rows left out, cells read as the system has them.
  const [fixes, setFixes] = React.useState<Fixes>(NO_FIXES);
  const fixesRef = React.useRef(fixes);
  fixesRef.current = fixes;
  const [exporting, setExporting] = React.useState(false);
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
      corrections?: StoreImportCorrection[];
      fixes?: Fixes;
    }) => {
      setBusy('preview');
      setDone(null);
      try {
        const result = await storeImportApi.preview(companyId, next.file, {
          mapping: next.mapping,
          sheet: /\.csv$/i.test(next.file.name) ? (next.sheet ?? undefined) : undefined,
          createMissing: next.createMissing ?? createMissingRef.current,
          corrections: next.corrections ?? correctionsRef.current,
          ...(next.fixes ?? fixesRef.current),
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
    setCorrections([]);
    setFixes(NO_FIXES);
    if (picked) void runPreview({ file: picked, corrections: [], fixes: NO_FIXES });
  }

  /** Applies the issues' one-click fixes (one, or every clear one) and checks again. */
  function applyFixes(list: StoreImportIssue[]) {
    if (!file) return;
    const next = withFixes(fixes, list);
    setFixes(next);
    void runPreview({ file, mapping, sheet: csvSheet, fixes: next });
  }

  function undoFixes() {
    if (!file) return;
    setFixes(NO_FIXES);
    void runPreview({ file, mapping, sheet: csvSheet, fixes: NO_FIXES });
  }

  /** The user's answer for one unknown value: a replacement, create (null), or none. */
  function answer(value: StoreImportUnknownValue, to: string | null | undefined) {
    if (!file) return;
    const key = {
      field: value.field,
      attribute: value.attribute,
      from: value.value,
    };
    const next = corrections.filter((c) => !sameCorrection(c, key));
    if (to !== undefined) next.push({ ...key, to });
    setCorrections(next);
    void runPreview({ file, mapping, sheet: csvSheet, corrections: next });
  }

  async function exportForEditing() {
    setExporting(true);
    try {
      await storeImportApi.downloadForEditing(companyId);
    } finally {
      setExporting(false);
    }
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
        // Imported products are active and shown in the store (owner 2026-11-14).
        publish: true,
        createMissing,
        corrections,
        ...fixes,
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
  const fixable = React.useMemo(() => (preview?.issues ?? []).filter((i) => i.action && i.row), [preview]);
  const fixesApplied = fixes.skipRows.length + fixes.keepCells.length;

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
            لتعديل منتجاتك: صدّرها، وعدّل الملف، ثم ارفعه كما هو فيُحدَّث كل سطر برمزه دون أخطاء. وفي الملف قوائم منسدلة
            للتصنيفات والعلامات والوحدات والخصائص. أو حمّل القالب واملأه، أو ارفع ملفك كما هو وطابق أعمدته في الخطوة
            التالية. المنتج الذي رمزه موجود يُحدَّث. الصور تُوضع داخل ملف Excel نفسه في خلية «الصور» (إدراج ← صور ← وضع
            في الخلية)، أو تُكتب روابطها. ملف CSV لا يحمل صوراً، فيقبل الروابط فقط. نوع الملف يُعرف تلقائياً.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={exporting} onClick={() => void exportForEditing()}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              تصدير المنتجات للتعديل
            </Button>
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
            {file ? (
              <FileSpreadsheet className="h-7 w-7 text-primary" />
            ) : (
              <Upload className="h-7 w-7 text-muted-foreground" />
            )}
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

          {preview.values?.length || corrections.length ? (
            <ValueCorrections
              values={preview.values ?? []}
              corrections={corrections}
              disabled={busy !== null}
              onAnswer={answer}
              onUndo={(c) => {
                if (!file) return;
                const next = corrections.filter((x) => !sameCorrection(x, c));
                setCorrections(next);
                void runPreview({
                  file,
                  mapping,
                  sheet: csvSheet,
                  corrections: next,
                });
              }}
            />
          ) : null}

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
              {preview.counts.productsUnchanged || preview.counts.variantsUnchanged ? (
                <p className="text-sm text-muted-foreground">
                  بلا تغيير: {preview.counts.productsUnchanged ?? 0} منتج و{preview.counts.variantsUnchanged ?? 0} متغير
                  كما هي في النظام، فلا يُكتب عليها شيء.
                </p>
              ) : null}
              <label className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm">
                <Checkbox
                  className="mt-0.5"
                  checked={createMissing}
                  disabled={busy !== null}
                  onCheckedChange={(v) => {
                    const next = v === true;
                    setCreateMissing(next);
                    if (file)
                      void runPreview({
                        file,
                        mapping,
                        sheet: csvSheet,
                        createMissing: next,
                      });
                  }}
                />
                <span>
                  إنشاء ما لا يوجد وربطه
                  <span className="block text-xs text-muted-foreground">
                    التصنيفات والعلامات التجارية المكتوبة في الملف وغير الموجودة في النظام تُنشأ وتُربط بالمنتجات. إن
                    ألغيته صارت أخطاء تُصحَّح في الملف، ولا يُنشأ شيء جديد.
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
                  تُضبط كمية المنتج لـ {preview.counts.quantitiesSet} منتجاً أو متغيراً (الكمية في الملف هي الكمية
                  الجديدة).
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

              {fixable.length || fixesApplied ? (
                <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm sm:flex-row sm:items-center">
                  <p className="flex-1">
                    {fixable.length
                      ? `${fixable.length} ملاحظة لها إصلاح واضح يُطبَّق بضغطة، دون تعديل الملف.`
                      : 'طُبّقت الإصلاحات، والملف نفسه لم يتغير.'}
                    {fixesApplied ? (
                      <span className="block text-xs text-muted-foreground">
                        مطبّق: {fixes.skipRows.length} سطر متجاهل، و{fixes.keepCells.length} خلية تُقرأ كما في النظام.
                      </span>
                    ) : null}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {fixable.length ? (
                      <Button size="sm" disabled={busy !== null} onClick={() => applyFixes(fixable)}>
                        <Wand2 className="h-4 w-4" />
                        طبّق الإصلاحات ({fixable.length})
                      </Button>
                    ) : null}
                    {fixesApplied ? (
                      <Button size="sm" variant="outline" disabled={busy !== null} onClick={undoFixes}>
                        <Undo2 className="h-4 w-4" />
                        تراجع عنها
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {issues.length ? (
                <IssuesList
                  issues={issues}
                  sheets={preview.sheets}
                  disabled={busy !== null}
                  onFix={(issue) => applyFixes([issue])}
                />
              ) : null}
              {preview.issues.length > issues.length && !onlyErrors ? (
                <p className="text-xs text-muted-foreground">تُعرض أول {MAX_SHOWN_ISSUES} ملاحظة.</p>
              ) : null}
            </CardContent>
          </Card>

          {/* 4 — import */}
          <Card>
            <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                المنتجات المستوردة تُنشر مفعّلة وتظهر في المتجر مباشرة.
              </p>
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
                {!preview.errors
                  ? 'لا توجد أسطر للاستيراد.'
                  : fixable.length
                    ? 'طبّق الإصلاحات الواضحة أعلاه، وصحّح الباقي في الملف ثم ارفعه مرة أخرى.'
                    : 'صحّح الأخطاء في الملف ثم ارفعه مرة أخرى.'}
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
  // «خاصية: …» columns carry the attributes instead of «الخصائص».
  const hasAttributeColumns = sheet.columns.some((c) => c.field?.startsWith(ATTRIBUTE_FIELD));
  const missing = sheet.fields.filter(
    (f) => f.required && !used.has(f.key) && !(f.key === 'attributes' && hasAttributeColumns),
  );
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
              {column.field?.startsWith(ATTRIBUTE_FIELD) ? (
                // A «خاصية: …» column: read as that attribute's values.
                <Badge variant="subtle" className="self-start sm:self-center">
                  قيم الخاصية «{column.field.slice(ATTRIBUTE_FIELD.length)}»
                </Badge>
              ) : (
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
              )}
            </div>
          ))}
      </div>
      {missing.length ? (
        <p className="text-xs text-destructive">حقول إلزامية بلا عمود: {missing.map((f) => f.labelAr).join('، ')}</p>
      ) : null}
    </div>
  );
}

const STATUS_BADGE: Record<
  StoreImportUnknownValue['status'],
  { label: string; variant: 'destructive' | 'warning' | 'subtle' }
> = {
  needsChoice: { label: 'اختر', variant: 'warning' },
  error: { label: 'غير موجودة', variant: 'destructive' },
  create: { label: 'ستُنشأ', variant: 'subtle' },
};

/**
 * Values of the file the system lacks, each once with its rows count: the
 * user replaces it with a system value (in every row) or creates it as
 * written. A value close to a system value waits here instead of being
 * created (2026-11-04).
 */
function ValueCorrections({
  values,
  corrections,
  disabled,
  onAnswer,
  onUndo,
}: {
  values: StoreImportUnknownValue[];
  corrections: StoreImportCorrection[];
  disabled: boolean;
  onAnswer: (value: StoreImportUnknownValue, to: string | null | undefined) => void;
  onUndo: (correction: StoreImportCorrection) => void;
}) {
  // Replacements already applied: those values left the list, kept here to undo.
  const replaced = corrections.filter((c) => c.to !== null);
  // Waiting for the user's choice: likely typos only (a value that cannot be
  // created and has no suggestion is fixed in the file).
  const pending = values.filter((v) => v.status === 'needsChoice').length;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">تصحيح القيم</CardTitle>
        <CardDescription>
          قيم في الملف غير موجودة في النظام. القيمة القريبة من قيمة موجودة لا تُنشأ حتى تختار: استبدلها بالقيمة الموجودة
          في كل الأسطر، أو أنشئها كما هي. لا حاجة لتعديل الملف.
          {pending ? ` بانتظار اختيارك: ${pending}.` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {values.length ? (
          <div className="divide-y divide-border/60 rounded-xl border border-border/60">
            {values.map((value) => {
              const chosen = corrections.find((c) =>
                sameCorrection(c, {
                  field: value.field,
                  attribute: value.attribute,
                  from: value.value,
                }),
              );
              const current = chosen ? (chosen.to === null ? CREATE : chosen.to) : UNSET;
              const badge = STATUS_BADGE[value.status];
              return (
                <div
                  key={`${value.field}|${value.attribute ?? ''}|${value.value}`}
                  className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">
                      {VALUE_FIELD_LABEL[value.field]}
                      {value.attribute ? ` «${value.attribute}»` : ''} · {value.rows} سطر
                    </p>
                    <p className="flex items-center gap-2 text-sm font-medium" dir="auto">
                      {value.value}
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </p>
                  </div>
                  {value.status === 'error' && !value.suggestions.length ? (
                    <p className="text-xs text-muted-foreground sm:w-64">
                      {value.field === 'attribute'
                        ? 'ليست من خصائص المنتج: امسحها من السطر، أو أضفها للمنتج من صفحته أولاً.'
                        : 'غير موجودة في النظام: صحّحها في الملف، أو أضفها من إعداداتها أولاً.'}
                    </p>
                  ) : (
                    <Select
                      value={current}
                      disabled={disabled}
                      onValueChange={(next) =>
                        onAnswer(value, next === UNSET ? undefined : next === CREATE ? null : next)
                      }
                    >
                      <SelectTrigger className="h-9 w-full sm:w-64">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNSET}>
                          {value.status === 'create' ? 'تُنشأ كما هي' : 'لم تختر بعد'}
                        </SelectItem>
                        {value.suggestions.map((s) => (
                          <SelectItem key={s} value={s}>
                            استبدل بـ «{s}»
                          </SelectItem>
                        ))}
                        {value.canCreate && value.status !== 'create' ? (
                          <SelectItem value={CREATE}>أنشئها كما هي</SelectItem>
                        ) : null}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
        {replaced.length ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">استبدالات مطبّقة:</span>
            {replaced.map((c) => (
              <button
                key={`${c.field}|${c.attribute ?? ''}|${c.from}`}
                type="button"
                disabled={disabled}
                onClick={() => onUndo(c)}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 hover:bg-muted"
                title="تراجع"
              >
                «{c.from}» ← «{c.to}»
                <XCircle className="h-3 w-3" />
              </button>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function IssuesList({
  issues,
  sheets,
  disabled,
  onFix,
}: {
  issues: StoreImportIssue[];
  sheets: StoreImportSheet[];
  disabled: boolean;
  onFix: (issue: StoreImportIssue) => void;
}) {
  const label = (issue: StoreImportIssue) =>
    sheets.find((s) => s.key === issue.sheet)?.fields.find((f) => f.key === issue.field)?.labelAr ?? null;
  return (
    <ul className="flex max-h-[28rem] flex-col divide-y divide-border/60 overflow-y-auto rounded-xl border border-border/60">
      {issues.map((issue, i) => (
        <li key={i} className="flex flex-wrap gap-x-3 gap-y-2 px-3 py-2 text-sm sm:flex-nowrap">
          {issue.level === 'error' ? (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          )}
          <div className="min-w-0 flex-1 basis-[calc(100%-1.75rem)] sm:basis-auto">
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
          {issue.action && issue.row ? (
            <Button
              size="sm"
              variant="outline"
              className="ms-7 h-8 shrink-0 self-start sm:ms-0"
              disabled={disabled}
              onClick={() => onFix(issue)}
            >
              <Wand2 className="h-3.5 w-3.5" />
              {ACTION_LABEL[issue.action.type]}
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ImportDone({ result }: { result: StoreImportPreview }) {
  const c = result.counts;
  const productsBasePath = useProductsBasePath();
  return (
    <Card className="border-success/30">
      <CardContent className="flex flex-col gap-2 pt-6">
        <p className="flex items-center gap-2 font-medium text-success">
          <CheckCircle2 className="h-5 w-5" />
          تم الاستيراد
        </p>
        <p className="text-sm text-muted-foreground">
          {c.productsCreated} منتج جديد، {c.productsUpdated} محدَّث، {c.variantsCreated} متغير جديد، {c.variantsUpdated}{' '}
          متغير محدَّث
          {c.productsUnchanged || c.variantsUnchanged
            ? `، و${(c.productsUnchanged ?? 0) + (c.variantsUnchanged ?? 0)} سطراً بلا تغيير`
            : ''}
          {c.rowsSkipped ? `، و${c.rowsSkipped} سطراً متجاهلاً` : ''}
          {c.categoriesCreated.length ? `، ${c.categoriesCreated.length} تصنيف جديد` : ''}
          {c.brandsCreated?.length ? `، ${c.brandsCreated.length} علامة تجارية جديدة` : ''}.
        </p>
        <Link href={productsBasePath} className="text-sm text-primary underline-offset-4 hover:underline">
          الذهاب إلى المنتجات
        </Link>
      </CardContent>
    </Card>
  );
}
