'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Settings2, Check, HelpCircle } from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { accountingRoutes } from '@/features/accounting/constants/routes';
import { useTaxGroupsStore } from '@/features/accounting/tax-groups/lib/tax-groups-store';

interface TaxGroupFormPageProps {
  taxGroupId?: string;
}

export function TaxGroupFormPage({ taxGroupId }: TaxGroupFormPageProps) {
  const router = useRouter();
  const isNew = !taxGroupId || taxGroupId === 'new';

  const getTaxGroup = useTaxGroupsStore((state) => state.getTaxGroup);
  const saveTaxGroup = useTaxGroupsStore((state) => state.save);

  const existingTaxGroup = React.useMemo(() => {
    if (isNew) return null;
    return getTaxGroup(taxGroupId);
  }, [isNew, taxGroupId, getTaxGroup]);

  // Form Fields matching screenshot 2
  const [name, setName] = React.useState(existingTaxGroup?.name || '');
  const [country, setCountry] = React.useState(existingTaxGroup?.country || 'الولايات المتحدة');
  const [sequence, setSequence] = React.useState<string>(
    existingTaxGroup?.sequence !== undefined ? String(existingTaxGroup.sequence) : '10',
  );
  const [posReceiptTitle, setPosReceiptTitle] = React.useState(existingTaxGroup?.posReceiptTitle || '');
  const [taxPayableAccount, setTaxPayableAccount] = React.useState(
    existingTaxGroup?.taxPayableAccount || '252000 الضريبة مستحقة الدفع',
  );
  const [taxReceivableAccount, setTaxReceivableAccount] = React.useState(
    existingTaxGroup?.taxReceivableAccount || '132000 الضريبة مستحقة القبض',
  );
  const [advanceTaxAccount, setAdvanceTaxAccount] = React.useState(existingTaxGroup?.advanceTaxAccount || '');
  const [precedingSubtotal, setPrecedingSubtotal] = React.useState(existingTaxGroup?.precedingSubtotal || '');

  const [savedSuccess, setSavedSuccess] = React.useState(false);

  React.useEffect(() => {
    if (existingTaxGroup) {
      setName(existingTaxGroup.name);
      setCountry(existingTaxGroup.country || 'الولايات المتحدة');
      setSequence(existingTaxGroup.sequence !== undefined ? String(existingTaxGroup.sequence) : '10');
      setPosReceiptTitle(existingTaxGroup.posReceiptTitle || '');
      setTaxPayableAccount(existingTaxGroup.taxPayableAccount || '');
      setTaxReceivableAccount(existingTaxGroup.taxReceivableAccount || '');
      setAdvanceTaxAccount(existingTaxGroup.advanceTaxAccount || '');
      setPrecedingSubtotal(existingTaxGroup.precedingSubtotal || '');
    }
  }, [existingTaxGroup]);

  const handleSave = () => {
    const finalId = isNew ? `tg-${Date.now()}` : existingTaxGroup?.id || taxGroupId;
    saveTaxGroup({
      id: finalId,
      name: name || 'مجموعة ضريبية جديدة',
      country,
      sequence: sequence ? parseInt(sequence, 10) : 10,
      posReceiptTitle,
      taxPayableAccount,
      taxReceivableAccount,
      advanceTaxAccount,
      precedingSubtotal,
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);

    if (isNew) {
      router.push(accountingRoutes.taxGroupDetail(finalId));
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-5xl mx-auto w-full">
      <SetPageTitle
        titleAr={isNew ? 'مجموعة ضرائب جديدة' : `مجموعات الضرائب / ${name || 'تعديل'}`}
        descriptionAr="تكوين وإعدادات مجموعة الضرائب"
        iconName="Layers"
      />

      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/40 bg-background p-2 shadow-xs">
        {/* Breadcrumb Navigation on Right in RTL */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push(accountingRoutes.taxGroups)}
            className="text-[#008784] hover:text-[#00706d] hover:bg-teal-50/50 dark:hover:bg-teal-950/20 font-medium px-2 h-8"
          >
            مجموعات الضرائب
          </Button>
          <span className="text-muted-foreground/40">/</span>
          <div className="flex items-center gap-1.5 text-foreground font-semibold">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <span>{isNew ? 'جديد' : name}</span>
          </div>
        </div>

        {/* Action Buttons on Left in RTL */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded px-4 h-8 text-sm"
            onClick={() => router.push(accountingRoutes.taxGroupNew)}
          >
            جديد
          </Button>
          <Button
            type="button"
            className="bg-[#714B67] hover:bg-[#5e3e56] text-white rounded px-5 h-8 text-sm font-medium shadow-xs gap-1.5"
            onClick={handleSave}
          >
            {savedSuccess ? (
              <>
                <Check className="h-4 w-4 text-emerald-300" />
                تم الحفظ
              </>
            ) : (
              'حفظ'
            )}
          </Button>
        </div>
      </div>

      {/* Main Form Card */}
      <div className="rounded-xl border border-border/60 bg-card p-6 md:p-8 shadow-xs flex flex-col gap-6">
        {/* 2-Column Grid matching reference image 2 exactly */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
          {/* Right Column (RTL): Basic Information */}
          <div className="flex flex-col gap-4">
            {/* الاسم */}
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm font-medium text-foreground w-40 shrink-0">
                الاسم
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: ضريبة 15%"
                className="h-8.5 rounded text-sm bg-background border-border/80 focus-visible:ring-1"
              />
            </div>

            {/* الدولة */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1 text-sm font-medium text-foreground w-40 shrink-0">
                <span>الدولة</span>
                <span className="text-xs text-muted-foreground font-mono" title="الدولة المعنية بهذه المجموعة الضريبية">
                  ?
                </span>
              </div>
              <Input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="مثال: الولايات المتحدة"
                className="h-8.5 rounded text-sm bg-background border-border/80 focus-visible:ring-1"
              />
            </div>

            {/* تسلسل */}
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm font-medium text-foreground w-40 shrink-0">
                تسلسل
              </label>
              <Input
                type="number"
                value={sequence}
                onChange={(e) => setSequence(e.target.value)}
                placeholder="10"
                className="h-8.5 rounded text-sm bg-background border-border/80 focus-visible:ring-1"
              />
            </div>

            {/* العناوين على إيصالات نقطة البيع */}
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm font-medium text-foreground w-40 shrink-0">
                العناوين على إيصالات نقطة البيع
              </label>
              <Input
                value={posReceiptTitle}
                onChange={(e) => setPosReceiptTitle(e.target.value)}
                placeholder="العنوان على إيصالات POS"
                className="h-8.5 rounded text-sm bg-background border-border/80 focus-visible:ring-1"
              />
            </div>
          </div>

          {/* Left Column (RTL): Accounting Accounts Configuration */}
          <div className="flex flex-col gap-4">
            {/* حساب الضريبة المستحقة */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1 text-sm font-medium text-foreground w-44 shrink-0">
                <span>حساب الضريبة المستحقة</span>
                <span className="text-xs text-muted-foreground font-mono" title="الحساب المستخدم لتقييد الضريبة المستحقة">
                  ?
                </span>
              </div>
              <Input
                value={taxPayableAccount}
                onChange={(e) => setTaxPayableAccount(e.target.value)}
                placeholder="252000 الضريبة مستحقة الدفع"
                className="h-8.5 rounded text-sm bg-background border-border/80 focus-visible:ring-1 font-mono text-xs"
              />
            </div>

            {/* حساب الضريبة مستحقة القبض */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1 text-sm font-medium text-foreground w-44 shrink-0">
                <span>حساب الضريبة مستحقة القبض</span>
                <span className="text-xs text-muted-foreground font-mono" title="الحساب المستخدم لتقييد الضريبة المستحقة القبض">
                  ?
                </span>
              </div>
              <Input
                value={taxReceivableAccount}
                onChange={(e) => setTaxReceivableAccount(e.target.value)}
                placeholder="132000 الضريبة مستحقة القبض"
                className="h-8.5 rounded text-sm bg-background border-border/80 focus-visible:ring-1 font-mono text-xs"
              />
            </div>

            {/* حساب الضريبة المسبقة */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1 text-sm font-medium text-foreground w-44 shrink-0">
                <span>حساب الضريبة المسبقة</span>
                <span className="text-xs text-muted-foreground font-mono" title="حساب الضريبة المدفوعة مسبقاً">
                  ?
                </span>
              </div>
              <Input
                value={advanceTaxAccount}
                onChange={(e) => setAdvanceTaxAccount(e.target.value)}
                placeholder="حساب الضريبة المسبقة"
                className="h-8.5 rounded text-sm bg-background border-border/80 focus-visible:ring-1 font-mono text-xs"
              />
            </div>

            {/* الناتج الفرعي السابق */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1 text-sm font-medium text-foreground w-44 shrink-0">
                <span>الناتج الفرعي السابق</span>
                <span className="text-xs text-muted-foreground font-mono" title="المجموع أو الناتج الفرعي السابق لحساب الضريبة">
                  ?
                </span>
              </div>
              <Input
                value={precedingSubtotal}
                onChange={(e) => setPrecedingSubtotal(e.target.value)}
                placeholder="الناتج الفرعي السابق"
                className="h-8.5 rounded text-sm bg-background border-border/80 focus-visible:ring-1"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
