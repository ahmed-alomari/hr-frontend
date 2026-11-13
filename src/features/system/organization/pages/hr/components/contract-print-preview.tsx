'use client';

import * as React from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { countPdfPages } from '@/components/pdf/official-pdf-preview-dialog';
import { employeeContractsApi } from '@/features/hr/contracts/lib/contracts-api';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import type { CompanySettingsFormState } from '@/features/system/organization/pages/hr/constants/company-settings-form';

/** Waits for the sliders to settle before asking the server for a new sample. */
const REFRESH_DELAY_MS = 700;

function canShowPdfInline(): boolean {
  if (typeof navigator === 'undefined') return true;
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return false;
  const nav = navigator as Navigator & { pdfViewerEnabled?: boolean };
  return nav.pdfViewerEnabled !== false;
}

/**
 * Sample contract made by the server with the settings as they are in the
 * form, before save. It is the same renderer as real contracts, so the page
 * count and the sizes here are what every contract will print with.
 */
export function ContractPrintPreview({
  companyId,
  form,
}: {
  companyId: string;
  form: CompanySettingsFormState;
}) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [pages, setPages] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [inline, setInline] = React.useState(true);
  const urlRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    setInline(canShowPdfInline());
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const {
    nameAr,
    nameEn,
    commercialRegistrationNo,
    pdfWatermarkEnabled,
    pdfWatermarkOpacity,
    pdfContractFontScale,
    pdfEmployeeSignatureScale,
    pdfCompanyStampScale,
  } = form;

  React.useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const { blob } = await employeeContractsApi.samplePdf({
          companyId,
          nameAr: nameAr.trim() || undefined,
          nameEn: nameEn.trim() || undefined,
          commercialRegistrationNo: commercialRegistrationNo.trim() || undefined,
          pdfWatermarkEnabled,
          pdfWatermarkOpacity: Math.round(pdfWatermarkOpacity),
          pdfContractFontScale: Math.round(pdfContractFontScale),
          pdfEmployeeSignatureScale: Math.round(pdfEmployeeSignatureScale),
          pdfCompanyStampScale: Math.round(pdfCompanyStampScale),
        });
        if (cancelled) return;
        const file = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
        const count = await countPdfPages(file);
        if (cancelled) return;
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = URL.createObjectURL(file);
        setUrl(urlRef.current);
        setPages(count);
      } catch (err) {
        if (cancelled) return;
        setError(handleApiError(err, 'company-settings.contract-sample').displayMessage);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, REFRESH_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    companyId,
    nameAr,
    nameEn,
    commercialRegistrationNo,
    pdfWatermarkEnabled,
    pdfWatermarkOpacity,
    pdfContractFontScale,
    pdfEmployeeSignatureScale,
    pdfCompanyStampScale,
  ]);

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">
            معاينة عقد تجريبي{pages ? ` — عدد الصفحات: ${pages}` : ''}
          </p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            ملف PDF حقيقي من الخادم بمواد الشركة الأساسية وبيانات موظف تجريبية، وبالإعدادات الحالية قبل الحفظ.
            يُطبع العقد بالصفحات نفسها على أي جهاز.
          </p>
        </div>
        {loading ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" /> : null}
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {url ? (
        inline ? (
          <object
            title="معاينة عقد تجريبي"
            data={url}
            type="application/pdf"
            className="h-[78vh] min-h-[420px] w-full rounded-lg border bg-white"
          >
            <iframe title="معاينة عقد تجريبي" src={url} className="h-full min-h-[420px] w-full border-0" />
          </object>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-lg border bg-muted/30 px-4 py-6 text-center">
            <p className="text-xs leading-relaxed text-muted-foreground">
              متصفح الجوال لا يعرض PDF داخل الصفحة. افتح الملف لمعاينته.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => window.open(url, '_blank', 'noopener')}
            >
              <ExternalLink className="h-4 w-4" />
              فتح العقد التجريبي
            </Button>
          </div>
        )
      ) : !error ? (
        <div className="flex h-40 items-center justify-center gap-2 rounded-lg border bg-muted/30 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          جاري تحضير العقد التجريبي…
        </div>
      ) : null}
    </div>
  );
}
