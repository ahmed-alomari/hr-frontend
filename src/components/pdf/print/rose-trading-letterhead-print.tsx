'use client';

import * as React from 'react';
import { PDF_PRINT_FONT_FAMILY } from '@/components/pdf/lib/pdf-print-font';
import {
  PDF_PAGE_FONT,
  PDF_SECTION_FONT,
} from '@/components/pdf/lib/official-document-typography';
import { sanitizePdfText } from '@/components/pdf/lib/sanitize-pdf-text';
import { isDefaultPdfLogoSrc } from '@/components/pdf/lib/pdf-company-info';
import { useResolvedPdfLetterhead } from '@/components/pdf/hooks/use-pdf-company-letterhead';

/** Letterhead accent — warm gold (print-safe) */
const LETTERHEAD_GOLD = '#b8933e';

export type RoseTradingLetterheadPrintProps = {
  logoSrc?: string;
  /** Defaults to active company from backend */
  companyNameAr?: string;
  /** Defaults to active company from backend */
  companyNameEn?: string;
  /** س.ت / C.R — defaults from active company */
  commercialReg?: string;
  /** Space under the gold rule (px); dense documents such as the contract use less. */
  marginBottom?: number;
};

/**
 * Print letterhead: **English (physical left)** · logo center · **Arabic (physical right)**.
 * Outer row uses `dir="ltr"` so layout stays correct inside RTL document roots.
 */
export function RoseTradingLetterheadPrint({
  logoSrc,
  companyNameAr,
  companyNameEn,
  commercialReg,
  marginBottom = 18,
}: RoseTradingLetterheadPrintProps) {
  const letterhead = useResolvedPdfLetterhead({
    companyNameAr,
    companyNameEn,
    commercialReg,
    logoSrc: logoSrc && !isDefaultPdfLogoSrc(logoSrc) ? logoSrc : undefined,
  });

  // The printing company's own data only; an empty field is not printed.
  const nameAr = sanitizePdfText(letterhead.companyNameAr);
  const nameEn = sanitizePdfText(letterhead.companyNameEn);
  const cr = letterhead.commercialReg.trim();

  return (
    <div style={{ marginBottom, paddingBottom: 14, borderBottom: `6px double ${LETTERHEAD_GOLD}` }}>
      <div
        dir="ltr"
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          minHeight: 96,
        }}
      >
        {/* Physical left — English */}
        <div
          style={{
            flex: '1 1 0',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              fontSize: PDF_SECTION_FONT,
              fontWeight: 700,
              color: LETTERHEAD_GOLD,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              textAlign: 'left',
              lineHeight: 1.3,
              fontFamily: PDF_PRINT_FONT_FAMILY,
            }}
          >
            {nameEn}
          </div>
          {cr ? (
            <div
              style={{
                fontSize: PDF_PAGE_FONT,
                fontWeight: 700,
                color: '#000000',
                marginTop: 5,
                textAlign: 'left',
                fontFamily: PDF_PRINT_FONT_FAMILY,
              }}
              dir="ltr"
            >
              {`C.R: ${cr}`}
            </div>
          ) : null}
        </div>

        {/* Center — logo */}
        <div
          style={{
            flex: '0 0 auto',
            width: 112,
            height: 96,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {letterhead.logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- html2canvas / print capture
            <img
              src={letterhead.logoSrc}
              alt=""
              width={96}
              height={96}
              style={{ objectFit: 'contain', maxWidth: '100%', maxHeight: '100%' }}
            />
          ) : null}
        </div>

        {/* Physical right — Arabic: column + dir=rtl → align stretch + textAlign right = flush to page end */}
        <div
          dir="rtl"
          lang="ar"
          style={{
            flex: '1 1 0',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
          }}
        >
          <div
            style={{
              fontSize: PDF_SECTION_FONT,
              fontWeight: 700,
              color: LETTERHEAD_GOLD,
              textAlign: 'right',
              lineHeight: 1.3,
              fontFamily: PDF_PRINT_FONT_FAMILY,
              width: '100%',
            }}
          >
            {nameAr}
          </div>
          {cr ? (
            <div
              dir="rtl"
              lang="ar"
              style={{
                marginTop: 5,
                fontSize: PDF_PAGE_FONT,
                fontWeight: 700,
                color: '#000000',
                fontFamily: PDF_PRINT_FONT_FAMILY,
                width: '100%',
                textAlign: 'right',
                lineHeight: 1.35,
              }}
            >
              <span>س.ت</span>
              {'\u00a0'}
              <span dir="ltr" style={{ unicodeBidi: 'embed' }}>
                {cr}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
