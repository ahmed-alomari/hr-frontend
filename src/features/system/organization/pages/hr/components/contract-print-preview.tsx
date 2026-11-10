'use client';

import { COMPANY_STAMP_PUBLIC_PATH } from '@/components/pdf/lib/company-stamp';
import { resolveUploadUrl } from '@/shared/resolve-upload-url';
import type { CompanySettingsFormState } from '@/features/system/organization/pages/hr/constants/company-settings-form';

const PAGE_1 = [
  {
    title: 'المادة (1): موضوع العقد',
    body: 'اتفق الطرفان على أن يعمل الطرف الثاني لدى الطرف الأول في الوظيفة المبينة في هذا العقد، وفق أنظمة العمل والتعليمات المعتمدة في المنشأة.',
  },
  {
    title: 'المادة (2): مدة العقد',
    body: 'مدة هذا العقد سنة، تتجدد تلقائيًا لمدة مماثلة ما لم يُخطر أحد الطرفين الآخر برغبته في عدم التجديد قبل نهاية المدة بثلاثين يومًا.',
  },
  {
    title: 'المادة (3): الأجر',
    body: 'يستحق الطرف الثاني أجرًا شهريًا شاملًا للبدلات المتفق عليها، يُصرف في نهاية كل شهر ميلادي عبر الحساب البنكي المعتمد.',
  },
  {
    title: 'المادة (4): ساعات العمل',
    body: 'ساعات العمل ثماني ساعات يوميًا، وخمس أيام في الأسبوع، مع مراعاة العطل الرسمية. وأي عمل إضافي يكون بموافقة الطرفين ووفق النظام.',
  },
] as const;

const PAGE_2 = [
  {
    title: 'المادة (5): الإجازات',
    body: 'يستحق الطرف الثاني إجازة سنوية مدفوعة وفق نظام العمل، ولا تُجدول إلا بعد موافقة الإدارة، مع بقاء حقوقه النظامية كاملة.',
  },
  {
    title: 'المادة (6): الالتزامات',
    body: 'يلتزم الطرف الثاني بالمحافظة على أسرار العمل وأدواته، وبتنفيذ التعليمات المهنية، وبعدم العمل لدى جهة منافسة طوال مدة العقد.',
  },
  {
    title: 'المادة (7): إنهاء العقد',
    body: 'ينتهي العقد بانتهاء مدته أو باتفاق الطرفين أو وفق الحالات التي يجيزها النظام. وتُسوّى الحقوق خلال المهلة النظامية.',
  },
  {
    title: 'المادة (8): أحكام عامة',
    body: 'ما لم يرد فيه نص يخضع لنظام العمل ولائحته. حُرر هذا العقد من نسختين، بيد كل طرف نسخة للعمل بموجبها. هذه معاينة تجريبية ولا تُحفظ مع الإعدادات.',
  },
] as const;

function SampleSignature({ scale }: { scale: number }) {
  const height = 16 * scale;
  const width = 42 * scale;
  return (
    <svg
      viewBox="0 0 220 70"
      aria-hidden
      style={{ width: `${width}mm`, height: `${height}mm` }}
    >
      <path
        d="M8 48 C 28 8, 46 62, 70 34 S 104 6, 128 40 S 168 66, 210 18"
        fill="none"
        stroke="#1c1917"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PreviewPage({
  form,
  page,
  articles,
}: {
  form: CompanySettingsFormState;
  page: 1 | 2;
  articles: ReadonlyArray<{ title: string; body: string }>;
}) {
  const font = form.pdfContractFontScale / 100;
  const signature = form.pdfEmployeeSignatureScale / 100;
  const stamp = form.pdfCompanyStampScale / 100;
  const logo = form.logoUrl.trim() ? resolveUploadUrl(form.logoUrl) : '';
  const name = form.nameAr.trim() || 'اسم المنشأة';

  return (
    <article
      className="relative mx-auto box-border h-[297mm] w-[210mm] overflow-hidden bg-white text-black shadow-md"
      dir="rtl"
      style={{ padding: '14mm 14mm 28mm' }}
    >
      {form.pdfWatermarkEnabled && logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt=""
          className="pointer-events-none absolute left-1/2 top-1/2 w-[55%] -translate-x-1/2 -translate-y-1/2 object-contain"
          style={{ opacity: form.pdfWatermarkOpacity / 100 }}
        />
      ) : null}

      <header className="relative flex items-center justify-between gap-4 border-b border-neutral-800 pb-3">
        <div className="text-right">
          <p className="text-[15px] font-bold">{name}</p>
          {form.commercialRegistrationNo.trim() ? (
            <p className="text-[11px]">س.ت {form.commercialRegistrationNo.trim()}</p>
          ) : null}
        </div>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="h-12 w-12 object-contain" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center border border-dashed text-[10px] text-neutral-500">
            الشعار
          </div>
        )}
      </header>

      <h2
        className="relative mt-4 text-center font-bold"
        style={{ fontSize: `${18 * font}px` }}
      >
        عقد عمل تجريبي — صفحة {page} من 2
      </h2>
      <p className="relative mt-2 text-center" style={{ fontSize: `${12 * font}px` }}>
        الطرف الأول: {name} — الطرف الثاني: موظف تجريبي
      </p>

      <div className="relative mt-4 space-y-3">
        {articles.map((article) => (
          <section key={article.title}>
            <h3
              className="bg-neutral-200 px-2 py-1 text-center font-bold"
              style={{ fontSize: `${14 * font}px` }}
            >
              {article.title}
            </h3>
            <p className="mt-1 text-justify leading-relaxed" style={{ fontSize: `${12.5 * font}px` }}>
              {article.body}
            </p>
          </section>
        ))}
      </div>

      <footer className="absolute inset-x-[14mm] bottom-[10mm] flex flex-wrap items-end justify-between gap-4">
        <div className="text-center">
          <p className="mb-1 text-[12px] font-bold">ختم المنشأة</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={COMPANY_STAMP_PUBLIC_PATH}
            alt="ختم المنشأة"
            style={{
              width: `${34 * stamp}mm`,
              maxHeight: `${40 * stamp}mm`,
              objectFit: 'contain',
            }}
          />
        </div>
        <div className="text-center">
          <p className="mb-1 text-[12px] font-bold">توقيع الموظف</p>
          <SampleSignature scale={signature} />
        </div>
      </footer>
    </article>
  );
}

/** Two-page sample contract. Uses the form as it is now, before save. */
export function ContractPrintPreview({ form }: { form: CompanySettingsFormState }) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-semibold text-muted-foreground">معاينة عقد من صفحتين</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          بيانات تجريبية فقط. تتغير المعاينة مع حجم الخط والتوقيع والختم والشعار قبل الضغط على حفظ.
        </p>
      </div>
      <div className="max-h-[78vh] overflow-auto rounded-lg border bg-muted/40 p-4">
        <div className="mx-auto flex w-[118mm] flex-col gap-4" dir="ltr">
          <div className="h-[167mm] overflow-hidden">
            <div className="origin-top-left scale-[0.56]">
              <PreviewPage form={form} page={1} articles={PAGE_1} />
            </div>
          </div>
          <div className="h-[167mm] overflow-hidden">
            <div className="origin-top-left scale-[0.56]">
              <PreviewPage form={form} page={2} articles={PAGE_2} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
