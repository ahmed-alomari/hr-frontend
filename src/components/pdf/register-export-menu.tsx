'use client';

import { FoldedHeaderTool } from '@/components/layouts/phone-fold';
import * as React from 'react';
import { Check, FileDown, FileSpreadsheet, ListFilter, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PdfPreviewExportDialog } from '@/components/pdf/pdf-preview-export-dialog';
import {
  RegisterDocument,
  type RegisterColumn,
  type RegisterRow,
} from '@/components/pdf/print/register-document';
import { downloadXlsxFromAoA } from '@/shared/export/download-xlsx';
import { cn } from '@/shared/utils';

function readHiddenFields(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((v): v is string => typeof v === 'string'))
      : new Set();
  } catch {
    return new Set();
  }
}

function writeHiddenFields(key: string, hidden: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify([...hidden]));
  } catch {
    // ignore quota / private mode errors
  }
}

/**
 * Lets the user drop some of the printed register's optional columns before
 * downloading the PDF — fewer columns means more width for the ones left, so
 * long values (dates, names…) stop overlapping or getting clipped on a
 * crowded page. Pinned columns (e.g. the row's own identity) are not listed.
 */
function PrintFieldsPicker({
  columns,
  hidden,
  onToggle,
  onReset,
}: {
  columns: RegisterColumn[];
  hidden: Set<string>;
  onToggle: (label: string) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const visibleCount = columns.filter((c) => !hidden.has(c.label)).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-2">
          <ListFilter className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">الحقول</span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
            {visibleCount}/{columns.length}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0" dir="rtl">
        <div className="border-b border-border/60 px-3 py-2.5">
          <p className="text-sm font-semibold">حقول الطباعة</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            أزل الحقول غير الضرورية لتجنّب تداخل البيانات في صفحة PDF
          </p>
        </div>
        <div className="max-h-72 space-y-0.5 overflow-y-auto p-2">
          {columns.map((c) => {
            const isHidden = hidden.has(c.label);
            return (
              <button
                key={c.label}
                type="button"
                onClick={() => onToggle(c.label)}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-start text-sm transition-colors',
                  isHidden
                    ? 'text-muted-foreground hover:bg-muted/50'
                    : 'bg-primary/5 text-foreground hover:bg-primary/10',
                )}
              >
                <span>{c.label}</span>
                {!isHidden ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" /> : null}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t border-border/60 px-3 py-2">
          <span className="text-xs text-muted-foreground">{visibleCount} من {columns.length}</span>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onReset}>
            إظهار الكل
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export type RegisterExportMenuProps = {
  /** Title of the printed register and the Excel sheet (e.g. «سجل السلف»). */
  title: string;
  /** File name without extension (e.g. `employee-advances`). */
  fileName: string;
  columns: RegisterColumn[];
  /**
   * The rows to export, one string per column — every record matching the
   * current filters, not only the visible page. May fetch (all pages). A
   * grouped list also returns its group headings, subtotals and grand total
   * (see `registerExportRows`).
   */
  getRows: () => RegisterRow[] | Promise<RegisterRow[]>;
  /** Lines under the title in the PDF (period, filters…). */
  subtitleLines?: string[];
  landscape?: boolean;
  emptyMessage?: string;
  /**
   * How many of the leading `columns` identify the row (e.g. name, or
   * name + date) and so always print — the fields picker only offers the
   * rest. Defaults to 1 (the first column). Excel always exports every
   * column regardless of this picker; it has no page-width limit.
   */
  pinnedColumnCount?: number;
};

/**
 * The one export button of a list: PDF (the shared register layout, with
 * preview) and Excel, both from the same columns and rows.
 */
export function RegisterExportMenu({
  title,
  fileName,
  columns,
  getRows,
  subtitleLines,
  landscape,
  emptyMessage = 'لا توجد بيانات للتصدير ضمن الفلاتر الحالية.',
  pinnedColumnCount = 1,
}: RegisterExportMenuProps) {
  const [busy, setBusy] = React.useState(false);
  const [pdfRows, setPdfRows] = React.useState<RegisterRow[] | null>(null);

  // Persisted per register title, so the user's choice of fields survives
  // reopening the export dialog (and reloading the page).
  const storageKey = `pdf-export-hidden-fields:${title}`;
  const [hiddenLabels, setHiddenLabels] = React.useState<Set<string>>(() => readHiddenFields(storageKey));

  const toggleField = React.useCallback(
    (label: string) => {
      setHiddenLabels((prev) => {
        const next = new Set(prev);
        if (next.has(label)) next.delete(label);
        else next.add(label);
        writeHiddenFields(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const resetFields = React.useCallback(() => {
    setHiddenLabels(new Set());
    writeHiddenFields(storageKey, new Set());
  }, [storageKey]);

  const pinned = Math.min(pinnedColumnCount, columns.length);
  const removableColumns = React.useMemo(() => columns.slice(pinned), [columns, pinned]);

  // The indices of `columns` that print: the pinned ones, plus whichever
  // removable ones the user has not hidden.
  const pdfColumnIndexes = React.useMemo(
    () => columns.map((_, i) => i).filter((i) => i < pinned || !hiddenLabels.has(columns[i].label)),
    [columns, hiddenLabels, pinned],
  );
  const pdfColumns = React.useMemo(
    () => pdfColumnIndexes.map((i) => columns[i]),
    [columns, pdfColumnIndexes],
  );

  const loadRows = React.useCallback(async (): Promise<RegisterRow[] | null> => {
    setBusy(true);
    try {
      const rows = await getRows();
      if (rows.length === 0) {
        toast.error(emptyMessage);
        return null;
      }
      return rows;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذر تجهيز بيانات التصدير');
      return null;
    } finally {
      setBusy(false);
    }
  }, [getRows, emptyMessage]);

  const exportPdf = React.useCallback(async () => {
    const rows = await loadRows();
    if (rows) setPdfRows(rows);
  }, [loadRows]);

  const exportExcel = React.useCallback(async () => {
    const rows = await loadRows();
    if (!rows) return;
    await downloadXlsxFromAoA(`${fileName}.xlsx`, title, [
      columns.map((c) => c.label),
      ...rows.map((row) => (Array.isArray(row) ? row : row.kind === 'group' ? [row.title] : row.cells)),
    ]);
    toast.success('تم تنزيل ملف Excel.');
  }, [loadRows, fileName, title, columns]);

  const printable = React.useMemo(
    () =>
      pdfRows ? (
        <RegisterDocument
          titleAr={title}
          subtitleLines={subtitleLines}
          columns={pdfColumns}
          rows={pdfRows.map((row): RegisterRow => {
            if (Array.isArray(row)) return pdfColumnIndexes.map((i) => row[i]);
            if (row.kind === 'group') return row;
            return { kind: row.kind, cells: pdfColumnIndexes.map((i) => row.cells[i]) };
          })}
          landscape={landscape}
        />
      ) : null,
    [pdfRows, title, subtitleLines, pdfColumns, pdfColumnIndexes, landscape],
  );

  return (
    <FoldedHeaderTool>
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 shrink-0"
              aria-label={`تصدير ${title}`}
              disabled={busy}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={() => void exportPdf()}>
              <FileDown className="h-4 w-4" />
              PDF
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void exportExcel()}>
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <PdfPreviewExportDialog
          open={pdfRows !== null}
          onOpenChange={(open) => {
            if (!open) setPdfRows(null);
          }}
          title={`معاينة تصدير ${title}`}
          fileName={`${fileName}.pdf`}
          printable={printable}
          orientation={landscape ? 'landscape' : 'portrait'}
          headerExtra={
            removableColumns.length > 0 ? (
              <PrintFieldsPicker
                columns={removableColumns}
                hidden={hiddenLabels}
                onToggle={toggleField}
                onReset={resetFields}
              />
            ) : null
          }
        />
      </>
    </FoldedHeaderTool>
  );
}
