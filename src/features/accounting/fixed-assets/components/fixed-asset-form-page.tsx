'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings2,
  Check,
  Plus,
  Trash2,
  Layers,
  ArrowRight,
  Printer,
  FileText,
  HelpCircle,
} from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Button } from '@/components/ui/button';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { Input } from '@/components/ui/input';
import { AmountInput } from '@/features/accounting/_shared/components/amount-input';
import { formatAccountingAmount } from '@/features/accounting/_shared/lib/format-accounting-amount';
import { accountingRoutes } from '@/features/accounting/constants/routes';
import { useFixedAssetsStore } from '@/features/accounting/fixed-assets/lib/fixed-assets-store';
import type { FixedAsset, DepreciationLine, FixedAssetInvoiceLine } from '@/features/accounting/domain/types/fixed-asset';

interface FixedAssetFormPageProps {
  assetId?: string;
}

export function FixedAssetFormPage({ assetId }: FixedAssetFormPageProps) {
  const router = useRouter();
  const isNew = !assetId || assetId === 'new';

  const getAsset = useFixedAssetsStore((state) => state.getAsset);
  const saveAsset = useFixedAssetsStore((state) => state.saveAsset);
  const confirmAsset = useFixedAssetsStore((state) => state.confirmAsset);
  const cancelAsset = useFixedAssetsStore((state) => state.cancelAsset);

  const existingAsset = React.useMemo(() => {
    if (isNew) return null;
    return getAsset(assetId);
  }, [isNew, assetId, getAsset]);

  // Form State
  const [name, setName] = React.useState(existingAsset?.name || 'كمبيوتر محمول');
  const [state, setState] = React.useState<'draft' | 'running' | 'cancel'>(existingAsset?.state || 'running');

  // قيم الأصول
  const [originalValue, setOriginalValue] = React.useState(existingAsset?.originalValue || 250000);
  const [acquisitionDate, setAcquisitionDate] = React.useState(existingAsset?.acquisitionDate || '2024-01-01');
  const [assetModel, setAssetModel] = React.useState(existingAsset?.assetModel || 'مجموعة الأصول');

  // القيم الحالية
  const [nonDepreciableValue, setNonDepreciableValue] = React.useState(existingAsset?.nonDepreciableValue || 60000);
  const [bookValue, setBookValue] = React.useState(existingAsset?.bookValue || 174000);
  const [depreciableValue, setDepreciableValue] = React.useState(existingAsset?.depreciableValue || 114000);

  // طريقة الإهلاك
  const [method, setMethod] = React.useState(existingAsset?.method || 'خط مستقيم');
  const [durationYears, setDurationYears] = React.useState(existingAsset?.durationYears || 5);
  const [calculationMethod, setCalculationMethod] = React.useState(existingAsset?.calculationMethod || 'فترات ثابتة');
  const [prorataDate, setProrataDate] = React.useState(existingAsset?.prorataDate || '2024-01-01');

  // المحاسبة
  const [fixedAssetAccount, setFixedAssetAccount] = React.useState(existingAsset?.fixedAssetAccount || '151000 الأصول الثابتة');
  const [depreciationAccount, setDepreciationAccount] = React.useState(existingAsset?.depreciationAccount || '151000 الأصول الثابتة');
  const [expenseAccount, setExpenseAccount] = React.useState(existingAsset?.expenseAccount || '600000 النفقات');
  const [journalName, setJournalName] = React.useState(existingAsset?.journalName || 'عمليات متنوعة');

  // القيمة عند الاسترداد
  const [salvageValue, setSalvageValue] = React.useState(existingAsset?.salvageValue || 0);

  // Tabs: asset (أصل) | depreciation (اللائحة الاستهلاكية) | invoices (الفواتير)
  const [activeTab, setActiveTab] = React.useState<'asset' | 'depreciation' | 'invoices'>('asset');

  // Lines
  const [depreciationLines, setDepreciationLines] = React.useState<DepreciationLine[]>(
    existingAsset?.depreciationLines || [
      {
        id: 'dl-1',
        date: '2024-12-31',
        reference: 'كمبيوتر محمول: الإهلاك',
        depreciation: 38000,
        cumulativeDepreciation: 38000,
        depreciableValue: 152000,
        journalEntryName: 'المتف/2024/12/0001',
      },
      {
        id: 'dl-2',
        date: '2025-12-31',
        reference: 'كمبيوتر محمول: الإهلاك',
        depreciation: 38000,
        cumulativeDepreciation: 76000,
        depreciableValue: 114000,
        journalEntryName: 'المتف/2025/12/0001',
      },
      {
        id: 'dl-3',
        date: '2026-12-31',
        reference: 'كمبيوتر محمول: الإهلاك',
        depreciation: 38000,
        cumulativeDepreciation: 114000,
        depreciableValue: 76000,
        journalEntryName: '/',
      },
      {
        id: 'dl-4',
        date: '2027-12-31',
        reference: 'كمبيوتر محمول: الإهلاك',
        depreciation: 38000,
        cumulativeDepreciation: 152000,
        depreciableValue: 38000,
        journalEntryName: '/',
      },
      {
        id: 'dl-5',
        date: '2028-12-31',
        reference: 'كمبيوتر محمول: الإهلاك',
        depreciation: 38000,
        cumulativeDepreciation: 190000,
        depreciableValue: 0,
        journalEntryName: '/',
      },
    ],
  );

  const [invoices, setInvoices] = React.useState<FixedAssetInvoiceLine[]>(existingAsset?.invoices || []);
  const [savedSuccess, setSavedSuccess] = React.useState(false);

  // Sync state if existingAsset updates
  React.useEffect(() => {
    if (existingAsset) {
      setName(existingAsset.name);
      setState(existingAsset.state);
      setOriginalValue(existingAsset.originalValue);
      setAcquisitionDate(existingAsset.acquisitionDate);
      setAssetModel(existingAsset.assetModel || 'مجموعة الأصول');
      setNonDepreciableValue(existingAsset.nonDepreciableValue);
      setBookValue(existingAsset.bookValue);
      setDepreciableValue(existingAsset.depreciableValue);
      setMethod(existingAsset.method);
      setDurationYears(existingAsset.durationYears);
      setCalculationMethod(existingAsset.calculationMethod);
      setProrataDate(existingAsset.prorataDate || existingAsset.acquisitionDate);
      setFixedAssetAccount(existingAsset.fixedAssetAccount);
      setDepreciationAccount(existingAsset.depreciationAccount);
      setExpenseAccount(existingAsset.expenseAccount);
      setJournalName(existingAsset.journalName);
      setSalvageValue(existingAsset.salvageValue);
      setDepreciationLines(existingAsset.depreciationLines);
      setInvoices(existingAsset.invoices || []);
    }
  }, [existingAsset]);

  const handleSave = () => {
    const id = isNew ? `fa-${Date.now()}` : assetId!;
    const payload: FixedAsset = {
      id,
      name,
      state,
      originalValue,
      acquisitionDate,
      assetModel,
      nonDepreciableValue,
      bookValue,
      depreciableValue,
      method,
      durationYears,
      calculationMethod,
      prorataDate,
      fixedAssetAccount,
      depreciationAccount,
      expenseAccount,
      journalName,
      salvageValue,
      depreciationLines,
      invoices,
    };

    saveAsset(payload);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);

    if (isNew) {
      router.push(accountingRoutes.fixedAssetDetail(id));
    }
  };

  const handleConfirm = () => {
    if (!isNew && assetId) {
      confirmAsset(assetId);
      setState('running');
    } else {
      setState('running');
      handleSave();
    }
  };

  const handleCancel = () => {
    if (!isNew && assetId) {
      cancelAsset(assetId);
      setState('cancel');
    } else {
      setState('cancel');
    }
  };

  const handleRemoveDepreciationLine = (id: string) => {
    setDepreciationLines((prev) => prev.filter((l) => l.id !== id));
  };

  const postedEntriesCount = depreciationLines.filter(
    (l) => l.journalEntryName && l.journalEntryName !== '/',
  ).length;

  return (
    <div className="flex flex-col gap-4 max-w-6xl mx-auto w-full" dir="rtl">
      <SetPageTitle
        titleAr={isNew ? 'أصل جديد' : `الأصول الثابتة / ${existingAsset?.name || 'أصل'}`}
        descriptionAr="تفاصيل واستهلاك الأصل الثابت"
        iconName="Layers"
      />

      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/40 bg-background p-2 shadow-xs">
        {/* Breadcrumb Navigation on Right */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push(accountingRoutes.fixedAssets)}
            className="text-primary hover:text-primary/80 font-medium px-2 h-8"
          >
            أصول
          </Button>
          <span className="text-muted-foreground/40">/</span>
          <div className="flex items-center gap-1.5 text-foreground font-semibold">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono">{isNew ? 'جديد' : existingAsset?.name}</span>
          </div>
        </div>

        {/* State Pipeline Badges (status bar) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border/60 bg-muted/20 p-1 text-xs">
            <span
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                state === 'draft' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground'
              }`}
            >
              مسودة
            </span>
            <span
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                state === 'running' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground'
              }`}
            >
              جاري
            </span>
            <span
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                state === 'cancel' ? 'bg-destructive text-destructive-foreground' : 'text-muted-foreground'
              }`}
            >
              ملغى
            </span>
          </div>

          <Button
            type="button"
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-5 h-8 text-sm font-medium shadow-xs gap-1.5"
            onClick={handleSave}
          >
            {savedSuccess ? (
              <>
                <Check className="h-4 w-4 text-green-300" />
                تم الحفظ
              </>
            ) : (
              'حفظ'
            )}
          </Button>
        </div>
      </div>

      {/* Main Sheet Card */}
      <div className="rounded-xl border border-border/60 bg-card p-6 md:p-8 shadow-xs flex flex-col gap-6 relative">
        {/* Top Buttons Bar & Smart Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              className="bg-[#714B67] hover:bg-[#5e3e56] text-white h-8 text-xs font-semibold px-4 shadow-xs"
            >
              تعديل الإهلاكات
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs font-medium">
              حفظ كنموذج
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs font-medium text-destructive hover:bg-destructive/10"
              onClick={handleCancel}
            >
              إلغاء الأصل
            </Button>
          </div>

          {/* Smart Button on Left */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push(accountingRoutes.journalEntries)}
              className="flex items-center gap-2 border border-border/80 rounded-lg px-3 py-1.5 hover:bg-muted/30 transition-colors text-xs"
            >
              <div className="flex flex-col items-start">
                <span className="text-[10px] text-muted-foreground font-medium">القيود المُرحّلة</span>
                <span className="font-bold text-foreground">{postedEntriesCount}</span>
              </div>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Asset Name Header */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">اسم الأصل</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-2xl md:text-3xl font-extrabold text-foreground border-none p-0 h-auto focus-visible:ring-0 focus-visible:border-b rounded-none shadow-none"
            placeholder="اسم الأصل..."
          />
        </div>

        {/* Tab Navigation: أصل | اللائحة الاستهلاكية | الفواتير */}
        <div className="flex flex-col gap-4 border-t border-border/40 pt-4 mt-1">
          <div className="flex items-center gap-2 border-b border-border/60">
            <button
              type="button"
              onClick={() => setActiveTab('asset')}
              className={`pb-2.5 px-4 text-sm font-semibold transition-all border-b-2 ${
                activeTab === 'asset'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              أصل
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('depreciation')}
              className={`pb-2.5 px-4 text-sm font-semibold transition-all border-b-2 ${
                activeTab === 'depreciation'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              اللائحة الاستهلاكية
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('invoices')}
              className={`pb-2.5 px-4 text-sm font-semibold transition-all border-b-2 ${
                activeTab === 'invoices'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              الفواتير
            </button>
          </div>

          {/* Tab 1: أصل (Matching screenshot 2) */}
          {activeTab === 'asset' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-6 pt-2 text-sm">
              {/* Right Column: قيم الأصول وطريقة الإهلاك */}
              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="font-bold text-sm text-foreground border-b border-border/40 pb-1.5">
                    قيم الأصول
                  </h3>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-4 text-xs font-medium text-foreground">القيمة الأصلية</label>
                    <div className="col-span-8">
                      <AmountInput
                        value={originalValue}
                        onChange={setOriginalValue}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-4 text-xs font-medium text-foreground">تاريخ الاستحواذ</label>
                    <div className="col-span-8">
                      <DatePickerInput
                        value={acquisitionDate}
                        onChange={setAcquisitionDate}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-4 text-xs font-medium text-foreground">نموذج الأصل</label>
                    <div className="col-span-8">
                      <Input
                        value={assetModel}
                        onChange={(e) => setAssetModel(e.target.value)}
                        placeholder="مجموعة الأصول"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-bold text-sm text-foreground border-b border-border/40 pb-1.5">
                    طريقة الإهلاك
                  </h3>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <div className="col-span-4 flex items-center gap-1 text-xs font-medium text-foreground">
                      <span>الطريقة</span>
                      <span className="text-[10px] text-muted-foreground font-mono" title="طريقة حساب الإهلاك">?</span>
                    </div>
                    <div className="col-span-8">
                      <select
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                        className="w-full h-8 text-xs rounded-md border border-border bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="خط مستقيم">خط مستقيم</option>
                        <option value="متناقص">متناقص</option>
                        <option value="معجل">معجل</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-center gap-2">
                    <div className="col-span-4 flex items-center gap-1 text-xs font-medium text-foreground">
                      <span>المدة</span>
                      <span className="text-[10px] text-muted-foreground font-mono" title="المدة بالسنوات">?</span>
                    </div>
                    <div className="col-span-8 flex items-center gap-2">
                      <Input
                        type="number"
                        value={durationYears}
                        onChange={(e) => setDurationYears(parseInt(e.target.value, 10) || 1)}
                        className="h-8 text-xs w-24"
                      />
                      <span className="text-xs text-muted-foreground">سنوات</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-4 text-xs font-medium text-foreground">احتساب</label>
                    <div className="col-span-8">
                      <Input
                        value={calculationMethod}
                        onChange={(e) => setCalculationMethod(e.target.value)}
                        placeholder="فترات ثابتة"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-center gap-2">
                    <div className="col-span-4 flex items-center gap-1 text-xs font-medium text-foreground">
                      <span>التاريخ النسبي</span>
                      <span className="text-[10px] text-muted-foreground font-mono" title="تاريخ بدء حساب الإهلاك النسبي">?</span>
                    </div>
                    <div className="col-span-8">
                      <DatePickerInput
                        value={prorataDate}
                        onChange={setProrataDate}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-bold text-sm text-foreground border-b border-border/40 pb-1.5">
                    القيمة عند الاسترداد
                  </h3>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <div className="col-span-4 flex items-center gap-1 text-xs font-medium text-foreground">
                      <span>المبلغ المُهلك</span>
                      <span className="text-[10px] text-muted-foreground font-mono" title="قيمة الخردة أو المبلغ المتبقي">?</span>
                    </div>
                    <div className="col-span-8">
                      <AmountInput
                        value={salvageValue}
                        onChange={setSalvageValue}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Left Column: القيم الحالية والمحاسبة */}
              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="font-bold text-sm text-foreground border-b border-border/40 pb-1.5">
                    القيم الحالية
                  </h3>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <div className="col-span-5 flex items-center gap-1 text-xs font-medium text-foreground">
                      <span>ليست قيمة قابلة للإهلاك</span>
                      <span className="text-[10px] text-muted-foreground font-mono" title="القيمة غير القابلة للإهلاك">?</span>
                    </div>
                    <div className="col-span-7">
                      <AmountInput
                        value={nonDepreciableValue}
                        onChange={setNonDepreciableValue}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-center gap-2">
                    <div className="col-span-5 flex items-center gap-1 text-xs font-medium text-foreground">
                      <span>القيمة الدفترية</span>
                      <span className="text-[10px] text-muted-foreground font-mono" title="القيمة الدفترية الحالية">?</span>
                    </div>
                    <div className="col-span-7">
                      <AmountInput
                        value={bookValue}
                        onChange={setBookValue}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-5 text-xs font-medium text-foreground">قابل للإهلاك</label>
                    <div className="col-span-7">
                      <AmountInput
                        value={depreciableValue}
                        onChange={setDepreciableValue}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-bold text-sm text-foreground border-b border-border/40 pb-1.5">
                    المحاسبة
                  </h3>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <div className="col-span-5 flex items-center gap-1 text-xs font-medium text-foreground">
                      <span>حساب الأصل الثابت</span>
                      <span className="text-[10px] text-muted-foreground font-mono" title="حساب الأصول الثابتة في شجرة الحسابات">?</span>
                    </div>
                    <div className="col-span-7">
                      <Input
                        value={fixedAssetAccount}
                        onChange={(e) => setFixedAssetAccount(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-center gap-2">
                    <div className="col-span-5 flex items-center gap-1 text-xs font-medium text-foreground">
                      <span>حساب الإهلاك</span>
                      <span className="text-[10px] text-muted-foreground font-mono" title="حساب مجمع الإهلاك">?</span>
                    </div>
                    <div className="col-span-7">
                      <Input
                        value={depreciationAccount}
                        onChange={(e) => setDepreciationAccount(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-center gap-2">
                    <div className="col-span-5 flex items-center gap-1 text-xs font-medium text-foreground">
                      <span>حساب النفقات</span>
                      <span className="text-[10px] text-muted-foreground font-mono" title="حساب مصروف الإهلاك">?</span>
                    </div>
                    <div className="col-span-7">
                      <Input
                        value={expenseAccount}
                        onChange={(e) => setExpenseAccount(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-5 text-xs font-medium text-foreground">دفتر اليومية</label>
                    <div className="col-span-7">
                      <Input
                        value={journalName}
                        onChange={(e) => setJournalName(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: اللائحة الاستهلاكية (Matching screenshot 3) */}
          {activeTab === 'depreciation' && (
            <div className="flex flex-col gap-4">
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-start text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/40 text-muted-foreground font-semibold">
                      <th className="p-3 text-start font-bold text-foreground">تاريخ الإهلاك</th>
                      <th className="p-3 text-start font-bold text-foreground">الرقم المرجعي</th>
                      <th className="p-3 text-end font-bold text-foreground">إهلاك</th>
                      <th className="p-3 text-end font-bold text-foreground">الإهلاك التراكمي</th>
                      <th className="p-3 text-end font-bold text-foreground">القيمة القابلة للإهلاك</th>
                      <th className="p-3 text-start font-bold text-foreground">قيد اليومية</th>
                      <th className="p-3 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {depreciationLines.map((line) => (
                      <tr key={line.id} className="hover:bg-muted/20 group transition-colors">
                        <td className="p-3 whitespace-nowrap font-medium text-foreground">
                          {line.date}
                        </td>
                        <td className="p-3 whitespace-nowrap text-foreground">
                          {line.reference}
                        </td>
                        <td className="p-3 whitespace-nowrap text-end font-mono font-medium">
                          {formatAccountingAmount(line.depreciation, 'SAR')}
                        </td>
                        <td className="p-3 whitespace-nowrap text-end font-mono font-medium">
                          {formatAccountingAmount(line.cumulativeDepreciation, 'SAR')}
                        </td>
                        <td className="p-3 whitespace-nowrap text-end font-mono font-medium">
                          {formatAccountingAmount(line.depreciableValue, 'SAR')}
                        </td>
                        <td className="p-3 whitespace-nowrap font-mono text-xs">
                          {line.journalEntryName && line.journalEntryName !== '/' ? (
                            <span className="text-primary font-semibold hover:underline cursor-pointer">
                              {line.journalEntryName}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">/</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveDepreciationLine(line.id)}
                            className="text-muted-foreground hover:text-destructive opacity-60 hover:opacity-100 transition-opacity p-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: الفواتير (Matching screenshot 4) */}
          {activeTab === 'invoices' && (
            <div className="flex flex-col gap-4">
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-start text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/40 text-muted-foreground font-semibold">
                      <th className="p-3 text-start font-bold text-foreground">التاريخ</th>
                      <th className="p-3 text-start font-bold text-foreground">قيد اليومية</th>
                      <th className="p-3 text-start font-bold text-foreground">الحساب</th>
                      <th className="p-3 text-start font-bold text-foreground">بطاقة عنوان</th>
                      <th className="p-3 text-end font-bold text-foreground">المدين</th>
                      <th className="p-3 text-end font-bold text-foreground">الدائن</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {invoices.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                          لا توجد فواتير مرتبطة بهذا الأصل حالياً
                        </td>
                      </tr>
                    ) : (
                      invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-muted/20">
                          <td className="p-3">{inv.date}</td>
                          <td className="p-3 font-mono">{inv.journalEntryName}</td>
                          <td className="p-3">{inv.accountId}</td>
                          <td className="p-3">{inv.name}</td>
                          <td className="p-3 text-end font-mono">{inv.debit}</td>
                          <td className="p-3 text-end font-mono">{inv.credit}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-primary font-semibold hover:bg-muted/40 gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  إضافة بند
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
