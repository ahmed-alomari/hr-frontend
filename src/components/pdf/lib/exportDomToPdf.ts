import { PDF_PRINT_FONT_FAMILY } from '@/components/pdf/lib/pdf-print-font';

export type ExportDomToPdfOptions = {
  orientation?: 'portrait' | 'landscape';
  /**
   * Page breaks: `avoid-all` (default) never splits any element — fine for
   * short blocks, but a long block jumps whole to the next page and leaves a
   * gap. `flow` lets blocks split and keeps whole only what is marked
   * `page-break-inside: avoid` (paragraphs, a title with its first lines) —
   * for long documents such as contracts, which must have no gaps.
   */
  pageBreaks?: 'avoid-all' | 'flow';
};

/**
 * html2pdf finds its page breaks on a copy laid out inside the live page — under
 * the app CSS (Tailwind preflight: no paragraph margins, line-height 1.5, the
 * app font at weight 400) — but html2canvas then draws a copy with every
 * stylesheet removed (browser defaults, Arial bold; see `onclone`). Any line
 * that differs between the two layouts moves the content against the breaks,
 * and rows or lines get cut across two pages. This pins, inline, the values
 * the drawn copy uses, so both layouts are the same.
 */
export function pinPdfLayoutDefaults(element: HTMLElement): HTMLElement {
  const copy = element.cloneNode(true) as HTMLElement;
  const root = copy.style;
  if (!root.fontFamily) root.fontFamily = PDF_PRINT_FONT_FAMILY;
  if (!root.fontWeight) root.fontWeight = '700';
  if (!root.lineHeight) root.lineHeight = 'normal';
  root.fontFeatureSettings = 'normal';
  root.fontVariantNumeric = 'normal';
  // The browser's paragraph margins (1em), which the app CSS sets to 0.
  copy.querySelectorAll<HTMLElement>('p').forEach((p) => {
    if (!p.style.marginTop) p.style.marginTop = '1em';
    if (!p.style.marginBottom) p.style.marginBottom = '1em';
  });
  return copy;
}

/**
 * html2canvas measures where to draw each line's baseline with a 1×1 image it
 * adds to the live page; the app CSS makes images `display: block`, which puts
 * that image under the text and shifts every drawn line down (text sits on the
 * cell borders). Keep that probe image inline while exporting.
 */
export const PDF_EXPORT_METRICS_CSS =
  'img[src^="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP"]{display:inline!important}';

/** What the html2pdf worker holds between its steps (`this` in `.then`). */
type Html2PdfWorkerProps = {
  prop: { canvas: HTMLCanvasElement; pageSize: { inner: { ratio: number } } };
};

/**
 * Drops every page that would hold only blank space, wherever it falls: a
 * document's bottom padding running a few pixels past a page end, or the
 * filler html2pdf inserts for a `page-break-before` (the contract's annex)
 * when the content already ends at a page edge — which printed a blank page
 * in the middle that the on-screen preview never shows. `pageRatio` is the
 * printable height / width, as html2pdf cuts the drawn canvas into pages.
 */
export function dropBlankPages(canvas: HTMLCanvasElement, pageRatio: number): HTMLCanvasElement {
  const pagePx = Math.floor(canvas.width * pageRatio);
  if (pagePx <= 0 || canvas.height <= pagePx) return canvas;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  const kept: { y: number; h: number }[] = [];
  for (let y = 0; y < canvas.height; y += pagePx) {
    const h = Math.min(pagePx, canvas.height - y);
    const { data } = ctx.getImageData(0, y, canvas.width, h);
    for (let i = 0; i < data.length; i += 4) {
      // Darker than the faint logo background and light row lines: content.
      if (data[i] + data[i + 1] + data[i + 2] < 600) {
        kept.push({ y, h });
        break;
      }
    }
  }
  if (kept.length === 0 || kept.length * pagePx >= canvas.height) return canvas;

  // Each kept page keeps its full height so the later pages stay aligned to
  // html2pdf's page cuts; only the last may be shorter.
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = (kept.length - 1) * pagePx + kept[kept.length - 1].h;
  const outCtx = out.getContext('2d');
  if (!outCtx) return canvas;
  outCtx.fillStyle = '#ffffff';
  outCtx.fillRect(0, 0, out.width, out.height);
  kept.forEach((page, i) => {
    outCtx.drawImage(canvas, 0, page.y, canvas.width, page.h, 0, i * pagePx, canvas.width, page.h);
  });
  return out;
}

/** The API through this site's own origin (rewrite in next.config.mjs). */
const API_PROXY_PREFIX = '/api-backend';

/**
 * html2canvas only draws images the page may read. An upload served from the
 * API's own host (in production `https://api.jgr.sa`) shows on screen, but
 * without CORS headers it is dropped from the PDF — the logo went missing.
 * Uploads are loaded through the same-origin proxy instead.
 */
export function proxyCrossOriginUploads(root: HTMLElement): HTMLElement {
  root.querySelectorAll('img').forEach((img) => {
    const raw = img.getAttribute('src');
    if (!raw || raw.startsWith('data:')) return;
    let url: URL;
    try {
      url = new URL(raw, window.location.href);
    } catch {
      return;
    }
    if (url.origin === window.location.origin) return;
    const at = url.pathname.indexOf('/uploads/');
    if (at < 0) return;
    img.setAttribute('src', `${API_PROXY_PREFIX}${url.pathname.slice(at)}${url.search}`);
  });
  return root;
}

/** Marks a part printed at the top of every PDF page (e.g. a letterhead). */
export const PDF_RUNNING_HEADER_ATTR = 'data-pdf-running-header';
/** Marks a part printed at the bottom of every PDF page (e.g. a gold rule). */
export const PDF_RUNNING_FOOTER_ATTR = 'data-pdf-running-footer';

/** Page margins (mm): top, left, bottom, right. */
const PAGE_MARGIN_MM: [number, number, number, number] = [8, 10, 8, 10];

/** jsPDF as html2pdf hands it over (`get('pdf')`). */
type Html2PdfJsPdf = {
  internal: { getNumberOfPages(): number; pageSize: { getWidth(): number; getHeight(): number } };
  setPage(page: number): void;
  addImage(data: string, format: string, x: number, y: number, w: number, h: number): void;
};

type RunningPart = { image: string; heightMm: number };

function html2canvasOptions() {
  return {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    onclone: (clonedDoc: Document) => {
      clonedDoc.querySelectorAll('link[rel="stylesheet"], style').forEach((n) => n.remove());
      clonedDoc.documentElement.setAttribute('style', 'color-scheme: light');
      clonedDoc.documentElement.className = '';
      clonedDoc.body.className = '';
      clonedDoc.body.setAttribute(
        'style',
        `background:#fff;margin:0;padding:0;font-family:${PDF_PRINT_FONT_FAMILY};font-weight:700;color:#000`,
      );
      const reset = clonedDoc.createElement('style');
      reset.textContent =
        '*,*::before,*::after{box-sizing:border-box}' + 'img{max-width:100%;height:auto}';
      clonedDoc.head.appendChild(reset);
    },
  };
}

/**
 * Draws one running part (letterhead / footer rule) on its own, at the width
 * it has in the document: the side paddings of its ancestors are kept, so it
 * lines up with the content on every page.
 */
async function renderRunningPart(
  html2pdf: Awaited<typeof import('html2pdf.js')>,
  root: HTMLElement,
  part: HTMLElement,
  orientation: 'portrait' | 'landscape',
): Promise<RunningPart> {
  let padLeft = 0;
  let padRight = 0;
  for (let node = part.parentElement; node && node !== root.parentElement; node = node.parentElement) {
    const cs = getComputedStyle(node);
    padLeft += parseFloat(cs.paddingLeft) || 0;
    padRight += parseFloat(cs.paddingRight) || 0;
  }
  const wrapper = document.createElement('div');
  wrapper.dir = root.dir || 'rtl';
  wrapper.style.paddingLeft = `${padLeft}px`;
  wrapper.style.paddingRight = `${padRight}px`;
  wrapper.appendChild(part.cloneNode(true));
  const [, left, , right] = PAGE_MARGIN_MM;
  const canvas: HTMLCanvasElement = await html2pdf()
    .set({
      margin: [0, left, 0, right],
      html2canvas: html2canvasOptions(),
      jsPDF: { unit: 'mm', format: 'a4', orientation },
    })
    .from(proxyCrossOriginUploads(pinPdfLayoutDefaults(wrapper)))
    .toCanvas()
    .get('canvas');
  const pageWidthMm = orientation === 'landscape' ? 297 : 210;
  const widthMm = pageWidthMm - left - right;
  return {
    image: canvas.toDataURL('image/png'),
    heightMm: canvas.width > 0 ? (canvas.height / canvas.width) * widthMm : 0,
  };
}

/**
 * Client-side A4 PDF from a live DOM node (html2canvas + jsPDF via html2pdf.js).
 * Call only in the browser. Tailwind/global CSS is stripped in the html2canvas clone — use inline styles on printable content.
 *
 * Parts marked with `PDF_RUNNING_HEADER_ATTR` / `PDF_RUNNING_FOOTER_ATTR` are
 * taken out of the flow and printed at the top / bottom of every page instead.
 */
export async function exportDomToPdf(
  element: HTMLElement,
  filename: string,
  options?: ExportDomToPdfOptions,
): Promise<void> {
  const { default: html2pdf } = await import('html2pdf.js');
  const orientation = options?.orientation ?? 'portrait';

  const metricsFix = document.createElement('style');
  metricsFix.textContent = PDF_EXPORT_METRICS_CSS;
  document.head.appendChild(metricsFix);
  try {
    const headerEl = element.querySelector<HTMLElement>(`[${PDF_RUNNING_HEADER_ATTR}]`);
    const footerEl = element.querySelector<HTMLElement>(`[${PDF_RUNNING_FOOTER_ATTR}]`);
    const header = headerEl ? await renderRunningPart(html2pdf, element, headerEl, orientation) : null;
    const footer = footerEl ? await renderRunningPart(html2pdf, element, footerEl, orientation) : null;

    const content = proxyCrossOriginUploads(pinPdfLayoutDefaults(element));
    if (header || footer) {
      content
        .querySelectorAll(`[${PDF_RUNNING_HEADER_ATTR}], [${PDF_RUNNING_FOOTER_ATTR}]`)
        .forEach((n) => n.remove());
    }

    const [top, left, bottom, right] = PAGE_MARGIN_MM;
    await html2pdf()
      .set({
        margin: [top + (header?.heightMm ?? 0), left, bottom + (footer?.heightMm ?? 0), right],
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: html2canvasOptions(),
        jsPDF: { unit: 'mm', format: 'a4', orientation },
        pagebreak:
          options?.pageBreaks === 'flow'
            ? { mode: ['css', 'legacy'] as const }
            : { mode: ['avoid-all', 'css', 'legacy'] as const },
      })
      .from(content)
      .toCanvas()
      .then(function (this: Html2PdfWorkerProps) {
        this.prop.canvas = dropBlankPages(this.prop.canvas, this.prop.pageSize.inner.ratio);
      })
      .toPdf()
      .get('pdf')
      .then((pdf: Html2PdfJsPdf) => {
        if (!header && !footer) return;
        const width = pdf.internal.pageSize.getWidth() - left - right;
        const height = pdf.internal.pageSize.getHeight();
        for (let page = 1; page <= pdf.internal.getNumberOfPages(); page += 1) {
          pdf.setPage(page);
          if (header) pdf.addImage(header.image, 'PNG', left, top, width, header.heightMm);
          if (footer) {
            pdf.addImage(footer.image, 'PNG', left, height - bottom - footer.heightMm, width, footer.heightMm);
          }
        }
      })
      .save();
  } finally {
    metricsFix.remove();
  }
}
