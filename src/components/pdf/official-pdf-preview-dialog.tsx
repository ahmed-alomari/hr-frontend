'use client';

import * as React from 'react';
import { Download, ExternalLink, FileText, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogFormFooterClass,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { triggerBrowserDownload } from '@/shared/export/download-blob';

/**
 * Pages of a PDF file. Chromium (the server renderer) writes one
 * `/Type /Page` object per page, uncompressed.
 */
export async function countPdfPages(blob: Blob): Promise<number | null> {
  try {
    const text = new TextDecoder('latin1').decode(await blob.arrayBuffer());
    const count = (text.match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
    return count > 0 ? count : null;
  } catch {
    return null;
  }
}

/**
 * Phone browsers do not show a PDF inside the page (Android shows nothing,
 * iOS only the first page), so there the file is opened on its own instead.
 */
function canShowPdfInline(): boolean {
  if (typeof navigator === 'undefined') return true;
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return false;
  const nav = navigator as Navigator & { pdfViewerEnabled?: boolean };
  return nav.pdfViewerEnabled !== false;
}

type OfficialPdfPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  previewUrl: string | null;
  mimeType?: string | null;
  pageCount?: number | null;
  loading?: boolean;
  downloading?: boolean;
  onDownload?: () => void;
  downloadLabel?: string;
};

/**
 * Shows an official PDF made by the server (`…/pdf`, `…/preview-pdf`). The
 * file shown is the file downloaded, so it has the same pages on every device.
 */
export function OfficialPdfPreviewDialog({
  open,
  onOpenChange,
  title,
  previewUrl,
  mimeType,
  pageCount,
  loading = false,
  downloading = false,
  onDownload,
  downloadLabel = 'تحميل PDF',
}: OfficialPdfPreviewDialogProps) {
  const [inline, setInline] = React.useState(true);
  React.useEffect(() => {
    setInline(canShowPdfInline());
  }, []);

  const isImage = Boolean(mimeType?.startsWith('image/'));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl gap-3 sm:max-w-5xl" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {pageCount
              ? `عدد الصفحات: ${pageCount} — الملف نفسه يُحمَّل ويُطبع على أي جهاز.`
              : 'الملف نفسه يُحمَّل ويُطبع على أي جهاز.'}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            جاري تحضير الملف…
          </div>
        ) : !previewUrl ? (
          <p className="py-10 text-center text-sm text-muted-foreground">تعذر تحميل المعاينة</p>
        ) : isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={title}
            className="mx-auto max-h-[70vh] w-auto rounded-lg border border-border bg-white object-contain"
          />
        ) : inline ? (
          <object
            title={title}
            data={previewUrl}
            type="application/pdf"
            className="h-[70vh] min-h-[420px] w-full rounded-lg border border-border bg-white"
          >
            <iframe title={title} src={previewUrl} className="h-full min-h-[420px] w-full border-0" />
          </object>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/30 px-6 py-10 text-center">
            <FileText className="h-12 w-12 text-primary/70" />
            <p className="text-sm font-semibold">الملف جاهز{pageCount ? ` — عدد الصفحات: ${pageCount}` : ''}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              متصفح الجوال لا يعرض PDF داخل الصفحة. افتح الملف لمعاينته؛ هو نفسه الذي يُحمَّل ويُطبع.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => window.open(previewUrl, '_blank', 'noopener')}
            >
              <ExternalLink className="h-4 w-4" />
              فتح الملف
            </Button>
          </div>
        )}
        <DialogFooter className={dialogFormFooterClass}>
          {onDownload ? (
            <Button
              type="button"
              variant="luxe"
              size="sm"
              className="h-9 gap-1.5 text-xs"
              disabled={!previewUrl || downloading}
              onClick={onDownload}
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 shrink-0" />
              )}
              {downloading ? 'جاري التحميل…' : downloadLabel}
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type OpenOfficialPdfPreviewArgs = {
  title: string;
  fileName: string;
  loadBlob: () => Promise<{ blob: Blob; fileName?: string }>;
};

/**
 * Loads a server PDF once and keeps it: the preview and the download use the
 * same bytes, so what is seen is exactly what is saved.
 */
export function useOfficialPdfPreview() {
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [mimeType, setMimeType] = React.useState<string | null>(null);
  const [pageCount, setPageCount] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const fileRef = React.useRef<{ blob: Blob; fileName: string } | null>(null);
  const previewUrlRef = React.useRef<string | null>(null);
  const requestRef = React.useRef(0);

  const revokePreviewUrl = React.useCallback(() => {
    const current = previewUrlRef.current;
    if (current?.startsWith('blob:')) URL.revokeObjectURL(current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
  }, []);

  const close = React.useCallback(() => {
    requestRef.current += 1;
    setOpen(false);
    setLoading(false);
    revokePreviewUrl();
    fileRef.current = null;
    setMimeType(null);
    setPageCount(null);
  }, [revokePreviewUrl]);

  React.useEffect(() => () => revokePreviewUrl(), [revokePreviewUrl]);

  const openPreview = React.useCallback(async (args: OpenOfficialPdfPreviewArgs) => {
    const request = ++requestRef.current;
    setOpen(true);
    setTitle(args.title);
    setLoading(true);
    setPageCount(null);
    setMimeType(null);
    revokePreviewUrl();
    fileRef.current = null;
    try {
      const { blob, fileName } = await args.loadBlob();
      if (request !== requestRef.current) return;
      const type = blob.type && blob.type !== 'application/octet-stream' ? blob.type : 'application/pdf';
      const file = blob.type === type ? blob : new Blob([blob], { type });
      const pages = type === 'application/pdf' ? await countPdfPages(file) : null;
      if (request !== requestRef.current) return;
      const url = URL.createObjectURL(file);
      previewUrlRef.current = url;
      fileRef.current = { blob: file, fileName: fileName || args.fileName };
      setPreviewUrl(url);
      setMimeType(type);
      setPageCount(pages);
    } catch (err) {
      if (request === requestRef.current) close();
      throw err;
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [close, revokePreviewUrl]);

  const download = React.useCallback(() => {
    const file = fileRef.current;
    if (!file) return;
    setDownloading(true);
    try {
      triggerBrowserDownload(file.blob, file.fileName);
    } finally {
      setDownloading(false);
    }
  }, []);

  return {
    open,
    setOpen: (next: boolean) => {
      if (!next) close();
      else setOpen(true);
    },
    title,
    previewUrl,
    mimeType,
    pageCount,
    loading,
    downloading,
    openPreview,
    download,
    close,
  };
}
