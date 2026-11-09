'use client';

import { FoldedHeaderTool } from '@/components/layouts/phone-fold';
import * as React from 'react';
import { FileDown, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PdfPreviewExportDialog } from '@/components/pdf/pdf-preview-export-dialog';
import { useEmployeesPayrollSummary } from '@/features/hr/payroll/compensation/hooks/useEmployeesPayrollSummary';
import { usePayrollPeriod } from '@/features/hr/payroll/compensation/hooks/usePayrollPeriod';
import { CompensationPrintHtml } from '@/features/hr/payroll/compensation/components/compensation-print-html';
import {
  buildCompensationExportLines,
  buildCompensationPrintPayload,
  downloadCompensationExcel,
} from '@/features/hr/payroll/lib/compensation-period-export';
import {
  mapEmployeesPayrollSummaryToPreviews,
  periodToColumnVisibility,
  resolvePayrollSummaryFooterTotals,
  DEFAULT_COMPENSATION_COLUMN_VISIBILITY,
} from '@/features/hr/payroll/lib/compensation-preview';
import type { HRPayrollPeriodRecord } from '@/features/hr/payroll/lib/payroll-periods-store';
import { cn } from '@/shared/utils';

function normalizePeriod(row: HRPayrollPeriodRecord): HRPayrollPeriodRecord {
  return {
    ...row,
    employmentLineMonthlyInputs: row.employmentLineMonthlyInputs ?? {},
    reviewStage: row.reviewStage ?? 'first_review',
    isReviewCompleted: row.isReviewCompleted ?? false,
  };
}

type Props = {
  periodId: string | null | undefined;
  /** When set, export only these employees (matches compensation report filter). */
  employeeIdsFilter?: string[] | undefined;
  /** When true, payroll summary is fetched only after the export menu opens. */
  lazyLoad?: boolean;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  /** Accessible label for the export trigger button. */
  ariaLabel?: string;
};

export function CompensationPeriodExportActions({
  periodId,
  employeeIdsFilter,
  lazyLoad = false,
  disabled = false,
  className,
  buttonClassName,
  ariaLabel = 'تصدير مسير الرواتب',
}: Props) {
  const [exportMenuOpen, setExportMenuOpen] = React.useState(false);
  const [excelExporting, setExcelExporting] = React.useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = React.useState(false);

  /** Keep summary/period queries alive while menu/preview/export are active. */
  const keepDataLoaded = exportMenuOpen || excelExporting || pdfPreviewOpen;
  const summaryEnabled = Boolean(periodId) && (!lazyLoad || keepDataLoaded);
  const { data: payrollSummary, isFetching: summaryLoading } = useEmployeesPayrollSummary(
    periodId,
    { enabled: summaryEnabled },
  );
  const { data: periodRaw } = usePayrollPeriod(summaryEnabled ? periodId : null);

  const period = React.useMemo(
    () => (periodRaw ? normalizePeriod(periodRaw) : null),
    [periodRaw],
  );

  const cols = React.useMemo(
    () => (period ? periodToColumnVisibility(period) : DEFAULT_COMPENSATION_COLUMN_VISIBILITY),
    [period],
  );

  const filterKey = employeeIdsFilter?.length ? [...employeeIdsFilter].sort().join(',') : '';

  const previews = React.useMemo(() => {
    if (!payrollSummary) return [];
    let list = mapEmployeesPayrollSummaryToPreviews(payrollSummary);
    if (filterKey) {
      const allow = new Set(filterKey.split(','));
      list = list.filter(r => allow.has(r.employeeId));
    }
    return list;
  }, [payrollSummary, filterKey]);

  const hasLines = previews.length > 0;

  const footerTotals = React.useMemo(
    () => resolvePayrollSummaryFooterTotals(payrollSummary, previews, Boolean(filterKey)),
    [payrollSummary, previews, filterKey],
  );

  const exportLines = React.useMemo(
    () => buildCompensationExportLines(previews),
    [previews],
  );

  const payrollPrintData = React.useMemo(
    () => (period && exportLines.length > 0
      ? buildCompensationPrintPayload(period, exportLines, cols, footerTotals)
      : null),
    [period, exportLines, cols, footerTotals],
  );

  const printable = React.useMemo(() => {
    if (!payrollPrintData) return null;
    return (
      <CompensationPrintHtml
        monthNameAr={payrollPrintData.monthNameAr}
        branchNameAr={payrollPrintData.branchNameAr}
        table={payrollPrintData.table}
      />
    );
  }, [payrollPrintData]);

  const pdfFileName = period ? `payroll-${period.code}.pdf` : 'payroll.pdf';
  const triggerDisabled = disabled || !periodId || excelExporting;

  const handleOpenPdfPreview = () => {
    if (!payrollPrintData || !period) {
      toast.error('لا توجد بيانات للتصدير.');
      return;
    }
    setPdfPreviewOpen(true);
  };

  const handleDownloadExcel = async () => {
    if (!period || !hasLines || exportLines.length === 0) {
      toast.error('لا توجد بيانات للتصدير.');
      return;
    }
    setExcelExporting(true);
    try {
      await downloadCompensationExcel(period, exportLines, cols, footerTotals);
      toast.success('تم تحميل ملف Excel.');
    } catch {
      toast.error('حدث خطأ أثناء إنشاء ملف Excel.');
    } finally {
      setExcelExporting(false);
    }
  };

  return (
    <FoldedHeaderTool>
      <>
        <div className={className}>
          <DropdownMenu onOpenChange={setExportMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn('h-8 w-8 shrink-0', buttonClassName)}
                disabled={triggerDisabled}
                aria-label={ariaLabel}
                title={lazyLoad && !exportMenuOpen && !pdfPreviewOpen
                  ? 'فتح القائمة لتحميل بيانات التصدير'
                  : (!hasLines && periodId ? 'لا توجد بيانات مسير لهذه الفترة' : undefined)}
              >
                {(excelExporting || summaryLoading)
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <FileDown className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                disabled={!period || !hasLines || excelExporting || summaryLoading}
                onSelect={() => handleOpenPdfPreview()}
              >
                <FileDown className="h-4 w-4" />
                PDF
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!period || !hasLines || excelExporting || summaryLoading}
                onSelect={() => void handleDownloadExcel()}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <PdfPreviewExportDialog
          open={pdfPreviewOpen}
          onOpenChange={setPdfPreviewOpen}
          title="معاينة مسير رواتب العاملين"
          fileName={pdfFileName}
          printable={printable}
          orientation="landscape"
          emptyMessage="لا توجد بيانات مسير للتصدير في هذه الفترة."
        />
      </>
    </FoldedHeaderTool>
  );
}
