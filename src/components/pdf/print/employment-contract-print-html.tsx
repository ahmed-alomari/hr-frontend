'use client';

import * as React from 'react';
import { PDF_PRINT_FONT_FAMILY } from '@/components/pdf/lib/pdf-print-font';
import {
  PDF_BODY_FONT,
  PDF_PAGE_FONT,
  PDF_RECIPIENTS_FONT,
  PDF_SECTION_FONT,
  PDF_TITLE_FONT,
  pdfOfficialPageStyle,
} from '@/components/pdf/lib/official-document-typography';
import { sanitizePdfText } from '@/components/pdf/lib/sanitize-pdf-text';
import {
  PDF_RUNNING_FOOTER_ATTR,
  PDF_RUNNING_HEADER_ATTR,
} from '@/components/pdf/lib/exportDomToPdf';
import { usePdfCompanyLetterhead } from '@/components/pdf/hooks/use-pdf-company-letterhead';
import { RoseTradingLetterheadPrint } from '@/components/pdf/print/rose-trading-letterhead-print';
import { getPdfLogoSrc } from '@/components/pdf/lib/pdf-logo-url';
import { RosePdfWatermark } from '@/components/pdf/rose-trading/rose-pdf-watermark';
import { RoseCompanyStamp } from '@/components/pdf/rose-trading/rose-company-stamp';
import {
  buildEmploymentContractPrintModel,
  type EmploymentContractPrintModelInput,
} from '@/components/pdf/print/build-employment-contract-print-model';
import { DEFAULT_LETTERHEAD_ACCENT } from '@/components/pdf/lib/pdf-company-info';

export type EmploymentContractPrintArticleLine = {
  code: string;
  titleAr: string;
  bodyAr?: string;
  bodySnippet?: string;
  /** Print the contract's salary and allowances under this article's body. */
  includesCompensation?: boolean;
};

export type EmploymentContractPrintAllowanceRow = {
  labelAr: string;
  amount: string;
};

export type EmploymentContractPrintHtmlProps = {
  logoSrc?: string;
  company: { nameAr: string; nameEn?: string | null };
  /** Optional — from company/settings, not a hardcoded person. */
  employerRepresentativeName?: string | null;
  employerRepresentativeTitle?: string | null;
  employeeNameAr: string;
  employeeGender?: 'male' | 'female' | null;
  nationalId?: string | null;
  nationality?: string | null;
  /** Printed by the «طرق التواصل» article and the {{phone}} / {{email}} tokens. */
  employeePhone?: string | null;
  employeeEmail?: string | null;
  jobTitleAr?: string | null;
  workCityAr?: string | null;
  branchNameAr?: string | null;
  contractNumber: string;
  natureLabelAr: string;
  arrangementLabelAr: string;
  agreementDate?: string;
  startDate: string;
  endDate: string;
  probationDaysLabel: string;
  annualLeaveDaysLabel: string;
  baseSalary: string;
  currency: string;
  allowancesNote: string;
  deductionsNote: string;
  allowanceRows: EmploymentContractPrintAllowanceRow[];
  /** Legal wording from selected catalog articles (dynamic). */
  articles: EmploymentContractPrintArticleLine[];
};

const ARTICLE_BAR_BG = '#e8e8e8';
const ARTICLE_BAR_FG = '#000000';

/** Contract text size (company setting), as a factor of the standard size. */
const FontScaleContext = React.createContext(1);

/** Text sizes and the spacing around them shrink together with the font. */
function useScaledFont(size: number): number {
  return size * React.useContext(FontScaleContext);
}

/** Gold rule — printed at the bottom of every PDF page. */
function FooterRule() {
  const { accentColor } = usePdfCompanyLetterhead();
  return (
    <div
      {...{ [PDF_RUNNING_FOOTER_ATTR]: '' }}
      style={{ paddingTop: 8 }}
    >
      <div style={{ borderTop: `6px double ${accentColor || DEFAULT_LETTERHEAD_ACCENT}` }} />
    </div>
  );
}

const PAGE_STYLE: React.CSSProperties = {
  ...pdfOfficialPageStyle,
  width: undefined,
  padding: '0 8px 8px',
};

function ArticleBlock({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  const sectionFont = useScaledFont(PDF_SECTION_FONT);
  const bodyFont = useScaledFont(PDF_BODY_FONT);
  const gap = useScaledFont(4);
  // An article is never split across pages: when it does not fit, the whole
  // article moves to the next page. Only an article taller than a page runs
  // over, and then its title stays with its first paragraph and no paragraph
  // is cut through a line.
  const paragraphs = sanitizePdfText(body)
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const paragraphStyle: React.CSSProperties = {
    padding: '0 4px',
    marginBottom: gap / 2,
    fontSize: bodyFont,
    fontWeight: 700,
    lineHeight: 1.6,
    textAlign: 'justify',
    wordBreak: 'break-word',
    pageBreakInside: 'avoid',
  };
  const titleBar = (
    <div
      style={{
        backgroundColor: ARTICLE_BAR_BG,
        color: ARTICLE_BAR_FG,
        padding: `${gap / 2}px 8px`,
        marginBottom: gap / 2,
        fontSize: sectionFont,
        fontWeight: 700,
        textAlign: 'center',
        lineHeight: 1.3,
      }}
    >
      {sanitizePdfText(title)}
    </div>
  );
  return (
    <div style={{ marginBottom: gap, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
      <div style={{ pageBreakInside: 'avoid' }}>
        {titleBar}
        {paragraphs[0] ? <div style={paragraphStyle}>{paragraphs[0]}</div> : null}
      </div>
      {paragraphs.slice(1).map((p, i) => (
        <div key={i} style={paragraphStyle}>
          {p}
        </div>
      ))}
      {children}
    </div>
  );
}

function CompensationBlock({
  baseSalary,
  currency,
  allowanceRows,
  allowancesNote,
  deductionsNote,
  inArticle = false,
}: {
  baseSalary: string;
  currency: string;
  allowanceRows: EmploymentContractPrintAllowanceRow[];
  allowancesNote: string;
  deductionsNote: string;
  /** Rendered under the salary article's text instead of as its own block. */
  inArticle?: boolean;
}) {
  const bodyFont = useScaledFont(PDF_BODY_FONT);
  const gap = useScaledFont(4);
  const cur = sanitizePdfText(currency || 'SAR');
  const rows = allowanceRows.filter((r) => r.labelAr.trim());
  const allowancesParagraph = rows.length > 0
    ? rows
      .map((row) => `${sanitizePdfText(row.labelAr)} ${sanitizePdfText(row.amount || '0')} ${cur}`)
      .join('، ')
    : '—';

  return (
    <div
      style={
        inArticle
          ? { padding: `0 4px ${gap}px` }
          : { marginTop: gap * 2, marginBottom: gap * 2, pageBreakInside: 'avoid' }
      }
    >
      <div style={{ fontSize: bodyFont, fontWeight: inArticle ? 700 : undefined, lineHeight: 1.6, textAlign: 'justify' }}>
        <p style={{ margin: `0 0 ${gap / 2}px` }}>
          <span style={{ fontWeight: 700 }}>الراتب الأساسي:</span>{' '}
          {sanitizePdfText(baseSalary || '—')} {cur}
        </p>
        <p style={{ margin: `0 0 ${gap / 2}px` }}>
          <span style={{ fontWeight: 700 }}>البدلات:</span>{' '}
          {allowancesParagraph}
        </p>
        {allowancesNote.trim() ? (
          <p style={{ margin: `0 0 ${gap / 2}px` }}>
            <span style={{ fontWeight: 700 }}>ملاحظات البدلات:</span>{' '}
            {sanitizePdfText(allowancesNote.trim())}
          </p>
        ) : null}
        {deductionsNote.trim() ? (
          <p style={{ margin: 0 }}>
            <span style={{ fontWeight: 700 }}>ملاحظات الخصومات:</span>{' '}
            {sanitizePdfText(deductionsNote.trim())}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** «طرق التواصل»: the employee's phone and email side by side. */
function ContactLines({ phone, email }: { phone: string; email: string }) {
  const bodyFont = useScaledFont(PDF_BODY_FONT);
  const cell: React.CSSProperties = { flex: 1, fontSize: bodyFont, fontWeight: 700, lineHeight: 1.6 };
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 24,
        padding: '0 4px',
        pageBreakInside: 'avoid',
      }}
    >
      <div style={{ ...cell, textAlign: 'right' }}>
        رقم الجوال: <span dir="ltr">{sanitizePdfText(phone)}</span>
      </div>
      <div style={{ ...cell, textAlign: 'left' }}>
        البريد الالكتروني: <span dir="ltr" style={{ textDecoration: 'underline' }}>{sanitizePdfText(email)}</span>
      </div>
    </div>
  );
}

function SignatureFooter({ employeeRoleNounAr }: { employeeRoleNounAr: string }) {
  const pageFont = useScaledFont(PDF_PAGE_FONT);
  const stampWidth = Math.max(70, useScaledFont(130));
  return (
    <div
      style={{
        marginTop: useScaledFont(20),
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 40,
        pageBreakInside: 'avoid',
      }}
    >
      <div style={{ flex: 1, textAlign: 'center', fontSize: pageFont, fontWeight: 700 }}>
        الطرف الأول /صاحب العمل
        <RoseCompanyStamp width={stampWidth} compact />
      </div>
      <div style={{ flex: 1, textAlign: 'center', fontSize: pageFont, fontWeight: 700 }}>
        الطرف الثاني / {sanitizePdfText(employeeRoleNounAr)}
        <div style={{ width: 160, height: 1, backgroundColor: '#000', margin: '30px auto 0' }} />
      </div>
    </div>
  );
}

/**
 * A section's blocks followed by its signatures, with the last block and the
 * signatures kept on one page so the signatures never stand alone.
 */
function BlocksWithSignatures({
  blocks,
  signatures,
}: {
  blocks: React.ReactNode[];
  signatures: React.ReactNode;
}) {
  const shown = blocks.filter(Boolean);
  const last = shown.pop();
  return (
    <>
      {shown}
      <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        {last}
        {signatures}
      </div>
    </>
  );
}

function PartiesBlock({
  lead,
  party1,
  party2,
}: {
  lead: string;
  party1: string;
  party2: string;
}) {
  const bodyFont = useScaledFont(PDF_BODY_FONT);
  const gap = useScaledFont(4);
  return (
    <div style={{ marginBottom: gap * 2 }}>
      <div style={{ fontSize: bodyFont, lineHeight: 1.6, textAlign: 'right', marginBottom: gap / 2 }}>
        {sanitizePdfText(lead)}
      </div>
      <div style={{ fontSize: bodyFont, lineHeight: 1.6, textAlign: 'justify', marginBottom: gap / 2 }}>
        {sanitizePdfText(party1)}
      </div>
      <div style={{ fontSize: bodyFont, lineHeight: 1.6, textAlign: 'justify' }}>
        {sanitizePdfText(party2)}
      </div>
    </div>
  );
}

function parseDaysFromLabel(label: string): string | null {
  const m = label.match(/(\d+)/);
  return m ? m[1] : null;
}

export const EmploymentContractPrintHtml = React.forwardRef<HTMLDivElement, EmploymentContractPrintHtmlProps>(
  function EmploymentContractPrintHtml(props, ref) {
    const {
      logoSrc: logoSrcProp,
      company,
      employerRepresentativeName,
      employerRepresentativeTitle,
      employeeNameAr,
      employeeGender,
      nationalId,
      nationality,
      employeePhone,
      employeeEmail,
      jobTitleAr,
      workCityAr,
      branchNameAr,
      contractNumber,
      natureLabelAr,
      arrangementLabelAr,
      agreementDate,
      startDate,
      endDate,
      probationDaysLabel,
      annualLeaveDaysLabel,
      baseSalary,
      currency,
      allowancesNote,
      deductionsNote,
      allowanceRows,
      articles,
    } = props;

    const letterhead = usePdfCompanyLetterhead();
    const fontScale = letterhead.contractFontScale;
    const pageFont = PDF_PAGE_FONT * fontScale;

    const [logoSrc, setLogoSrc] = React.useState<string | undefined>(logoSrcProp);
    React.useEffect(() => {
      if (logoSrcProp) setLogoSrc(logoSrcProp);
      else setLogoSrc(getPdfLogoSrc());
    }, [logoSrcProp]);

    const modelInput = React.useMemo((): EmploymentContractPrintModelInput => ({
      companyNameAr: company.nameAr || letterhead.companyNameAr,
      companyNameEn: company.nameEn || letterhead.companyNameEn,
      employerRepresentativeName:
        employerRepresentativeName?.trim() || letterhead.representativeNameAr || null,
      employerRepresentativeTitle:
        employerRepresentativeTitle?.trim() || letterhead.representativeTitleAr || null,
      employeeNameAr,
      employeeGender,
      nationalId,
      nationality,
      employeePhone,
      employeeEmail,
      jobTitleAr,
      workCityAr,
      branchNameAr,
      contractNumber,
      natureLabelAr,
      arrangementLabelAr,
      agreementDateIso: agreementDate?.trim() || startDate,
      startDate,
      endDate,
      probationDays: parseDaysFromLabel(probationDaysLabel),
      annualLeaveDays: parseDaysFromLabel(annualLeaveDaysLabel),
      baseSalary,
      currency,
      allowancesNote,
      deductionsNote,
      allowanceRows,
      articles: articles.map((a) => ({
        code: a.code,
        titleAr: a.titleAr,
        bodyAr: (a.bodyAr ?? a.bodySnippet ?? '').trim(),
        includesCompensation: a.includesCompensation === true,
      })),
    }), [
      letterhead.companyNameAr,
      letterhead.companyNameEn,
      letterhead.representativeNameAr,
      letterhead.representativeTitleAr,
      company.nameAr,
      company.nameEn,
      employerRepresentativeName,
      employerRepresentativeTitle,
      employeeNameAr,
      employeeGender,
      nationalId,
      nationality,
      employeePhone,
      employeeEmail,
      jobTitleAr,
      workCityAr,
      branchNameAr,
      contractNumber,
      natureLabelAr,
      arrangementLabelAr,
      agreementDate,
      startDate,
      endDate,
      probationDaysLabel,
      annualLeaveDaysLabel,
      baseSalary,
      currency,
      allowancesNote,
      deductionsNote,
      allowanceRows,
      articles,
    ]);

    const model = React.useMemo(
      () => buildEmploymentContractPrintModel(modelInput),
      [modelInput],
    );

    const title = `عقــد عمل رقم(${sanitizePdfText(model.contractNumber)})`;
    // Salary and allowances come from the contract, never from article text:
    // inline through the article's tokens, under the flagged salary article,
    // or after the articles when neither is used.
    const compensationInArticle =
      model.compensationInline || model.mainArticles.some((a) => a.includesCompensation);
    const renderCompensation = (inArticle: boolean) => (
      <CompensationBlock
        baseSalary={baseSalary}
        currency={currency}
        allowanceRows={allowanceRows}
        allowancesNote={allowancesNote}
        deductionsNote={deductionsNote}
        inArticle={inArticle}
      />
    );
    const contactLines = (
      <ContactLines phone={model.employeePhone} email={model.employeeEmail} />
    );
    const hasAnnex = Boolean(model.annexPreambleAr.trim() || model.annexArticles.length > 0);

    return (
      <FontScaleContext.Provider value={fontScale}>
      <div ref={ref} dir="rtl" lang="ar" style={{ width: '210mm', maxWidth: '100%', margin: '0 auto' }}>
        <div style={PAGE_STYLE}>
          <RosePdfWatermark logoSrc={logoSrc} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div {...{ [PDF_RUNNING_HEADER_ATTR]: '' }}>
              <RoseTradingLetterheadPrint
                logoSrc={logoSrc}
                companyNameAr={company.nameAr}
                companyNameEn={company.nameEn ?? undefined}
                marginBottom={6}
              />
            </div>

            <div
              style={{
                backgroundColor: ARTICLE_BAR_BG,
                fontSize: PDF_TITLE_FONT * fontScale,
                fontWeight: 700,
                textAlign: 'center',
                marginBottom: 6 * fontScale,
                padding: `${4 * fontScale}px 8px`,
                borderBottom: '1px solid #555',
              }}
            >
              {title}
            </div>

            <PartiesBlock
              lead={model.agreementLeadAr}
              party1={model.party1LineAr}
              party2={model.party2LineAr}
            />

            <BlocksWithSignatures
              blocks={[
                ...model.mainArticles.map((a, i) => (
                  <ArticleBlock
                    key={`${a.code}-${i}`}
                    title={a.titleAr.trim() || `المادة (${i + 1})`}
                    body={a.bodyAr}
                  >
                    {a.includesCompensation ? renderCompensation(true) : null}
                    {a.isContact ? contactLines : null}
                  </ArticleBlock>
                )),
                compensationInArticle ? null : (
                  <React.Fragment key="compensation">{renderCompensation(false)}</React.Fragment>
                ),
              ]}
              signatures={<SignatureFooter employeeRoleNounAr={model.employeeRoleNounAr} />}
            />
            <FooterRule />
          </div>
        </div>

        {hasAnnex ? (
          <div
            style={{
              ...PAGE_STYLE,
              breakBefore: 'page',
              pageBreakBefore: 'always',
            }}
          >
            <RosePdfWatermark logoSrc={logoSrc} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div {...{ [PDF_RUNNING_HEADER_ATTR]: '' }}>
                <RoseTradingLetterheadPrint
                  logoSrc={logoSrc}
                  companyNameAr={company.nameAr}
                  companyNameEn={company.nameEn ?? undefined}
                  marginBottom={6}
                />
              </div>

              <div
                style={{
                  backgroundColor: ARTICLE_BAR_BG,
                  fontSize: PDF_RECIPIENTS_FONT * fontScale,
                  fontWeight: 700,
                  textAlign: 'center',
                  marginBottom: 6 * fontScale,
                  padding: `${4 * fontScale}px 8px`,
                  borderBottom: '1px solid #555',
                }}
              >
                {`ملحق لعقد العمل رقم (${sanitizePdfText(model.contractNumber)})`}
              </div>

              <PartiesBlock
                lead={model.annexLeadAr}
                party1={model.annexParty1LineAr}
                party2={model.annexParty2LineAr}
              />

              <BlocksWithSignatures
                blocks={[
                  model.annexPreambleAr.trim() ? (
                    <ArticleBlock key="preamble" title="تمهيد" body={model.annexPreambleAr} />
                  ) : null,
                  ...model.annexArticles.map((a, i) => (
                    <ArticleBlock
                      key={`annex-${a.code}-${i}`}
                      title={a.titleAr.trim() || `البند (${i + 1})`}
                      body={a.bodyAr}
                    >
                      {a.isContact ? contactLines : null}
                    </ArticleBlock>
                  )),
                ]}
                signatures={
                  <div
                    style={{
                      marginTop: 20 * fontScale,
                      display: 'flex',
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      gap: 40,
                      pageBreakInside: 'avoid',
                    }}
                  >
                    <div style={{ flex: 1, textAlign: 'center', fontSize: pageFont, fontWeight: 700 }}>
                      الطرف الأول (صاحب العمل)
                      <RoseCompanyStamp width={Math.max(70, 130 * fontScale)} compact />
                    </div>
                    <div style={{ flex: 1, textAlign: 'center', fontSize: pageFont, fontWeight: 700 }}>
                      الطرف الثاني ({sanitizePdfText(model.employeeRoleNounAr)})
                    </div>
                  </div>
                }
              />
              <FooterRule />
            </div>
          </div>
        ) : null}
      </div>
      </FontScaleContext.Provider>
    );
  },
);
