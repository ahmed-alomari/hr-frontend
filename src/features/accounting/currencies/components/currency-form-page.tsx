'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Settings2,
  Trash2,
  HelpCircle,
  Plus,
  SlidersHorizontal,
  Info,
  Check,
} from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { accountingRoutes } from '@/features/accounting/constants/routes';
import { useCurrenciesStore } from '@/features/accounting/currencies/lib/currencies-store';
import type {
  Currency,
  CurrencyRate,
  CurrencySymbolPosition,
} from '@/features/accounting/domain/types/currency';

interface CurrencyFormPageProps {
  currencyId?: string;
}

export function CurrencyFormPage({ currencyId }: CurrencyFormPageProps) {
  const router = useRouter();
  const isNew = !currencyId || currencyId === 'new';

  const getCurrency = useCurrenciesStore((state) => state.getCurrency);
  const saveCurrency = useCurrenciesStore((state) => state.save);
  const baseCurrencyCode = useCurrenciesStore((state) => state.baseCurrencyCode);

  const existingCurrency = React.useMemo(() => {
    if (isNew) return null;
    return getCurrency(currencyId);
  }, [isNew, currencyId, getCurrency]);

  // Form State
  const [code, setCode] = React.useState(existingCurrency?.code || '');
  const [nameAr, setNameAr] = React.useState(existingCurrency?.nameAr || '');
  const [symbol, setSymbol] = React.useState(existingCurrency?.symbol || '');
  const [currencyUnit, setCurrencyUnit] = React.useState(existingCurrency?.currencyUnit || '');
  const [currencySubunit, setCurrencySubunit] = React.useState(existingCurrency?.currencySubunit || '');
  const [symbolPosition, setSymbolPosition] = React.useState<CurrencySymbolPosition>(
    existingCurrency?.symbolPosition || 'before',
  );
  const [active, setActive] = React.useState(existingCurrency ? existingCurrency.active : true);
  const [isBaseCurrency, setIsBaseCurrency] = React.useState(
    existingCurrency ? !!existingCurrency.isBaseCurrency : false,
  );
  const [roundingFactor, setRoundingFactor] = React.useState<string>(
    existingCurrency?.roundingFactor !== undefined
      ? existingCurrency.roundingFactor.toFixed(6)
      : '0.010000',
  );
  const [decimalPlaces, setDecimalPlaces] = React.useState<string>(
    existingCurrency?.decimalPlaces !== undefined
      ? String(existingCurrency.decimalPlaces)
      : '2',
  );

  // Rates State
  const [rates, setRates] = React.useState<CurrencyRate[]>(
    existingCurrency?.rates && existingCurrency.rates.length > 0
      ? existingCurrency.rates
      : [
          {
            id: 'initial-rate-1',
            date: '1 سبتمبر',
            unitPerBase: existingCurrency?.unitPerBaseRate || 1.0,
            basePerUnit:
              existingCurrency?.unitPerBaseRate && existingCurrency.unitPerBaseRate > 0
                ? 1 / existingCurrency.unitPerBaseRate
                : 1.0,
          },
        ],
  );

  const [savedSuccess, setSavedSuccess] = React.useState(false);

  // When existing currency changes
  React.useEffect(() => {
    if (existingCurrency) {
      setCode(existingCurrency.code);
      setNameAr(existingCurrency.nameAr);
      setSymbol(existingCurrency.symbol);
      setCurrencyUnit(existingCurrency.currencyUnit || '');
      setCurrencySubunit(existingCurrency.currencySubunit || '');
      setSymbolPosition(existingCurrency.symbolPosition || 'before');
      setActive(existingCurrency.active);
      setIsBaseCurrency(!!existingCurrency.isBaseCurrency);
      setRoundingFactor(existingCurrency.roundingFactor.toFixed(6));
      setDecimalPlaces(String(existingCurrency.decimalPlaces));
      setRates(
        existingCurrency.rates.length > 0
          ? existingCurrency.rates
          : [
              {
                id: 'initial-rate-1',
                date: '1 سبتمبر',
                unitPerBase: existingCurrency.unitPerBaseRate || 1.0,
                basePerUnit:
                  existingCurrency.unitPerBaseRate && existingCurrency.unitPerBaseRate > 0
                    ? 1 / existingCurrency.unitPerBaseRate
                    : 1.0,
              },
            ],
      );
    }
  }, [existingCurrency]);

  const handleAddRate = () => {
    const todayAr = '1 سبتمبر';
    const newRate: CurrencyRate = {
      id: `rate-${Date.now()}`,
      date: todayAr,
      unitPerBase: rates.length > 0 ? rates[0].unitPerBase : 1.0,
      basePerUnit: rates.length > 0 ? rates[0].basePerUnit : 1.0,
    };
    setRates((prev) => [newRate, ...prev]);
  };

  const handleRemoveRate = (id: string) => {
    setRates((prev) => prev.filter((r) => r.id !== id));
  };

  const handleRateChange = (
    id: string,
    field: 'date' | 'unitPerBase' | 'basePerUnit',
    value: string,
  ) => {
    setRates((prev) =>
      prev.map((rate) => {
        if (rate.id !== id) return rate;

        if (field === 'date') {
          return { ...rate, date: value };
        }

        const numVal = parseFloat(value);
        if (isNaN(numVal) || numVal <= 0) {
          return {
            ...rate,
            [field]: value === '' ? 0 : numVal,
          };
        }

        if (field === 'unitPerBase') {
          return {
            ...rate,
            unitPerBase: numVal,
            basePerUnit: 1 / numVal,
          };
        } else {
          return {
            ...rate,
            basePerUnit: numVal,
            unitPerBase: 1 / numVal,
          };
        }
      }),
    );
  };

  const handleSave = () => {
    const currencyCode = code.trim().toUpperCase() || 'NEW';
    const parsedRounding = parseFloat(roundingFactor) || 0.01;
    const parsedDecimals = parseInt(decimalPlaces, 10) || 2;
    const currentRate = rates[0]?.unitPerBase || 1.0;

    const payload: Currency = {
      id: existingCurrency?.id || currencyCode,
      code: currencyCode,
      nameAr: nameAr.trim() || currencyCode,
      symbol: symbol.trim() || currencyCode,
      currencyUnit: currencyUnit.trim(),
      currencySubunit: currencySubunit.trim(),
      symbolPosition,
      active,
      isBaseCurrency,
      roundingFactor: parsedRounding,
      decimalPlaces: parsedDecimals,
      rates,
      lastUpdated: rates[0]?.date || existingCurrency?.lastUpdated || '',
      unitPerBaseRate: isBaseCurrency ? 1.0 : currentRate,
    };

    saveCurrency(payload);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);

    if (isNew) {
      router.push(accountingRoutes.currencyDetail(payload.id));
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-5xl mx-auto w-full">
      <SetPageTitle
        titleAr={isNew ? 'عملة جديدة' : `العملات / ${code || 'تعديل'}`}
        descriptionAr="تكوين وإعدادات العملة وأسعار الصرف"
        iconName="Coins"
      />

      {/* Top Header / Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/40 bg-background p-2 shadow-xs">
        {/* Breadcrumb Navigation on Right */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push(accountingRoutes.currencies)}
            className="text-primary hover:text-primary/80 font-medium px-2 h-8"
          >
            العملات
          </Button>
          <span className="text-muted-foreground/40">/</span>
          <div className="flex items-center gap-1.5 text-foreground font-semibold">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <span>{isNew ? 'جديد' : code}</span>
          </div>
        </div>

        {/* Action Buttons on Left */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-lg px-4 h-8 text-sm"
            onClick={() => router.push(accountingRoutes.currencyNew)}
          >
            جديد
          </Button>
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

      {/* Base Currency Banner Notice (Screenshot 3) */}
      {isBaseCurrency && (
        <div className="flex items-center justify-center gap-2 rounded-lg bg-sky-100 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800/60 p-3 text-sky-900 dark:text-sky-200 text-sm font-medium text-center shadow-xs">
          <span>هذه هي عملة شركتك.</span>
        </div>
      )}

      {/* Main Form Card */}
      <div className="rounded-xl border border-border/60 bg-card p-6 md:p-8 shadow-xs flex flex-col gap-8">
        {/* Two-Column Form Layout (RTL) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-12">
          {/* Right Column in RTL */}
          <div className="flex flex-col gap-4">
            {/* Currency Code */}
            <div className="grid grid-cols-12 items-center gap-2">
              <label className="col-span-4 text-sm font-medium text-foreground flex items-center gap-1">
                العملة
                <span className="text-xs text-muted-foreground font-mono" title="رمز أيزو للعملة (مثل USD أو SAR)">?</span>
              </label>
              <div className="col-span-8">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="مثال: USD"
                  className="font-mono uppercase h-9 rounded-lg"
                  disabled={isBaseCurrency}
                />
              </div>
            </div>

            {/* Currency Name */}
            <div className="grid grid-cols-12 items-center gap-2">
              <label className="col-span-4 text-sm font-medium text-foreground">
                الاسم
              </label>
              <div className="col-span-8">
                <Input
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  placeholder="مثال: United States dollar"
                  className="h-9 rounded-lg"
                />
              </div>
            </div>

            {/* Active Toggle */}
            <div className="grid grid-cols-12 items-center gap-2">
              <label className="col-span-4 text-sm font-medium text-foreground">
                نشط
              </label>
              <div className="col-span-8 flex items-center">
                <Switch
                  checked={active}
                  onCheckedChange={setActive}
                  aria-label="حالة التنشيط"
                />
              </div>
            </div>
          </div>

          {/* Left Column in RTL */}
          <div className="flex flex-col gap-4">
            {/* Symbol */}
            <div className="grid grid-cols-12 items-center gap-2">
              <label className="col-span-4 text-sm font-medium text-foreground flex items-center gap-1">
                الرمز
                <span className="text-xs text-muted-foreground font-mono" title="رمز العملة المعروض (مثل $ أو ريال)">?</span>
              </label>
              <div className="col-span-8">
                <Input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="مثال: $"
                  className="h-9 rounded-lg"
                />
              </div>
            </div>

            {/* Currency Unit */}
            <div className="grid grid-cols-12 items-center gap-2">
              <label className="col-span-4 text-sm font-medium text-foreground">
                وحدة العملة
              </label>
              <div className="col-span-8">
                <Input
                  value={currencyUnit}
                  onChange={(e) => setCurrencyUnit(e.target.value)}
                  placeholder="مثال: دولار أو Rial"
                  className="h-9 rounded-lg"
                />
              </div>
            </div>

            {/* Currency Subunit */}
            <div className="grid grid-cols-12 items-center gap-2">
              <label className="col-span-4 text-sm font-medium text-foreground">
                الوحدة الفرعية للعملة
              </label>
              <div className="col-span-8">
                <Input
                  value={currencySubunit}
                  onChange={(e) => setCurrencySubunit(e.target.value)}
                  placeholder="مثال: سنتات أو فلس"
                  className="h-9 rounded-lg"
                />
              </div>
            </div>

            {/* Symbol Position */}
            <div className="grid grid-cols-12 items-center gap-2">
              <label className="col-span-4 text-sm font-medium text-foreground flex items-center gap-1">
                موضع الرمز
                <span className="text-xs text-muted-foreground font-mono" title="مكان ظهور الرمز بالنسبة للمبلغ">?</span>
              </label>
              <div className="col-span-8">
                <Select
                  value={symbolPosition}
                  onValueChange={(val) => setSymbolPosition(val as CurrencySymbolPosition)}
                >
                  <SelectTrigger className="h-9 rounded-lg">
                    <SelectValue placeholder="اختر الموضع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="before">قبل المبلغ</SelectItem>
                    <SelectItem value="after">بعد المبلغ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Price Accuracy (دقة السعر) */}
        <div className="flex flex-col gap-4 border-t border-border/40 pt-6">
          <h3 className="text-sm font-bold text-foreground">دقة السعر</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-12">
            {/* Rounding Factor */}
            <div className="grid grid-cols-12 items-center gap-2">
              <label className="col-span-4 text-sm font-medium text-foreground flex items-center gap-1">
                عامل التقريب
                <span className="text-xs text-muted-foreground font-mono" title="أصغر وحدة نقدية يمكن احتسابها">?</span>
              </label>
              <div className="col-span-8">
                <Input
                  value={roundingFactor}
                  onChange={(e) => setRoundingFactor(e.target.value)}
                  placeholder="0.010000"
                  className="font-mono text-sm h-9 rounded-lg"
                />
              </div>
            </div>

            {/* Decimal Places */}
            <div className="grid grid-cols-12 items-center gap-2">
              <label className="col-span-4 text-sm font-medium text-foreground flex items-center gap-1">
                الخانات العشرية
                <span className="text-xs text-muted-foreground font-mono" title="عدد الخانات بعد الفاصلة">?</span>
              </label>
              <div className="col-span-8">
                <Input
                  type="number"
                  min="0"
                  max="6"
                  value={decimalPlaces}
                  onChange={(e) => setDecimalPlaces(e.target.value)}
                  placeholder="2"
                  className="font-mono text-sm h-9 rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tab / Section: Rates (الأسعار) */}
        {!isBaseCurrency && (
          <div className="flex flex-col gap-3 border-t border-border/40 pt-4">
            {/* Tab header */}
            <div className="border-b border-border/60">
              <div className="inline-block border-b-2 border-primary pb-2 px-3 font-semibold text-primary text-sm">
                الأسعار
              </div>
            </div>

            {/* Rates Sub-Table */}
            <div className="overflow-x-auto rounded-lg border border-border/60 bg-muted/10">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 bg-muted/30 text-muted-foreground select-none">
                  <tr>
                    <th className="w-8 px-2 py-2.5 text-start">
                      <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground/60" />
                    </th>
                    <th className="px-4 py-2.5 text-start font-semibold text-foreground">
                      التاريخ
                    </th>
                    <th className="px-4 py-2.5 text-start font-semibold text-foreground">
                      وحدة لكل {baseCurrencyCode}
                    </th>
                    <th className="px-4 py-2.5 text-start font-semibold text-foreground">
                      {baseCurrencyCode} لكل وحدة
                    </th>
                    <th className="w-10 px-2 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 bg-card">
                  {rates.map((rate) => (
                    <tr key={rate.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-2 py-2 text-muted-foreground/50">
                        <SlidersHorizontal className="h-3 w-3" />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          value={rate.date}
                          onChange={(e) => handleRateChange(rate.id, 'date', e.target.value)}
                          placeholder="مثال: 1 سبتمبر"
                          className="h-8 text-sm bg-transparent border-border/40 focus:bg-background"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          value={rate.unitPerBase !== 0 ? String(rate.unitPerBase) : ''}
                          onChange={(e) =>
                            handleRateChange(rate.id, 'unitPerBase', e.target.value)
                          }
                          placeholder="0.001886792453"
                          className="font-mono text-sm h-8 bg-transparent border-border/40 focus:bg-background"
                          dir="ltr"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          value={rate.basePerUnit !== 0 ? String(rate.basePerUnit) : ''}
                          onChange={(e) =>
                            handleRateChange(rate.id, 'basePerUnit', e.target.value)
                          }
                          placeholder="530.000000000001"
                          className="font-mono text-sm h-8 bg-transparent border-border/40 focus:bg-background"
                          dir="ltr"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveRate(rate.id)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {rates.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground text-xs">
                        لا توجد أسعار مضافة بعد.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Add item link button (Matching Screenshot) */}
              <div className="p-2 border-t border-border/40 bg-muted/5">
                <button
                  type="button"
                  onClick={handleAddRate}
                  className="text-primary hover:text-primary/80 text-xs font-semibold flex items-center gap-1 py-1 px-2 rounded hover:bg-primary/5 transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>إضافة بند</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
