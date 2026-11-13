import type { CSSProperties } from 'react';
import { PDF_PRINT_FONT_FAMILY } from '@/components/pdf/lib/pdf-print-font';

/** Typography scale for printable HTML documents. */
export const PDF_PAGE_FONT = 22;
export const PDF_BODY_FONT = 22.5;
export const PDF_SECTION_FONT = 26;
export const PDF_TITLE_FONT = 31;
export const PDF_RECIPIENTS_FONT = 28;
export const PDF_LINE_HEIGHT = 1.9;
export const PDF_PAGE_PADDING = '20px 22px 40px';

/** Dense tables/registers use the same base as contract body per product rule. */
export const PDF_TABLE_FONT = PDF_PAGE_FONT;
export const PDF_TABLE_HEADER_FONT = PDF_BODY_FONT;

export const pdfOfficialFont: CSSProperties = {
  fontFamily: PDF_PRINT_FONT_FAMILY,
  fontWeight: 700,
};

export const pdfOfficialPageStyle: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  backgroundColor: '#ffffff',
  padding: PDF_PAGE_PADDING,
  fontFamily: PDF_PRINT_FONT_FAMILY,
  fontSize: PDF_PAGE_FONT,
  fontWeight: 700,
  color: '#000000',
  boxSizing: 'border-box',
  minHeight: '279mm',
};

export const pdfOfficialBodyStyle: CSSProperties = {
  fontSize: PDF_BODY_FONT,
  lineHeight: PDF_LINE_HEIGHT,
  fontWeight: 700,
};
