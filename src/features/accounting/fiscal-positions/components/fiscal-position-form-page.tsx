'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings2,
  Trash2,
  Plus,
  SlidersHorizontal,
  Check,
  AlignJustify,
  Percent,
} from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { accountingRoutes } from '@/features/accounting/constants/routes';
import { useFiscalPositionsStore } from '@/features/accounting/fiscal-positions/lib/fiscal-positions-store';
import type {
  FiscalPosition,
  AccountMapping,
  TaxMapping,
} from '@/features/accounting/domain/types/fiscal-position';

interface FiscalPositionFormPageProps {
  positionId?: string;
}

export function FiscalPositionFormPage({ positionId }: FiscalPositionFormPageProps) {
  const router = useRouter();
  const isNew = !positionId || positionId === 'new';

  const getPosition = useFiscalPositionsStore((state) => state.getPosition);
  const savePosition = useFiscalPositionsStore((state) => state.save);

  const existingPosition = React.useMemo(() => {
    if (isNew) return null;
    return getPosition(positionId);
  }, [isNew, positionId, getPosition]);

  // Form Fields
  const [name, setName] = React.useState(existingPosition?.name || '');
  const [autoDetect, setAutoDetect] = React.useState(
    existingPosition !== null && existingPosition !== undefined ? existingPosition.autoDetect : true,
  );
  const [vatRequired, setVatRequired] = React.useState(
    existingPosition ? existingPosition.vatRequired : false,
  );
  const [foreignTaxId, setForeignTaxId] = React.useState(existingPosition?.foreignTaxId || '');
  const [countryGroups, setCountryGroups] = React.useState(existingPosition?.countryGroups || '');
  const [country, setCountry] = React.useState(existingPosition?.country || '');
  const [federalStates, setFederalStates] = React.useState(existingPosition?.federalStates || '');
  const [zipFrom, setZipFrom] = React.useState(existingPosition?.zipFrom || '');
  const [zipTo, setZipTo] = React.useState(existingPosition?.zipTo || '');

  // Active Tab
  const [activeTab, setActiveTab] = React.useState<'accounts' | 'taxes'>('accounts');

  // Mappings
  const [accountMappings, setAccountMappings] = React.useState<AccountMapping[]>(
    existingPosition?.accountMappings || [
      {
        id: 'am-init',
        originalAccount: '101402 الحساب البنكي المعلق',
        replacementAccount: '101404 المدفوعات المستحقة',
      },
    ],
  );

  const [taxMappings, setTaxMappings] = React.useState<TaxMapping[]>(
    existingPosition?.taxMappings || [
      {
        id: 'tm-init',
        originalTax: '15%',
        replacementTax: 'Exports 0%',
      },
    ],
  );

  const [savedSuccess, setSavedSuccess] = React.useState(false);

  React.useEffect(() => {
    if (existingPosition) {
      setName(existingPosition.name);
      setAutoDetect(existingPosition.autoDetect);
      setVatRequired(existingPosition.vatRequired);
      setForeignTaxId(existingPosition.foreignTaxId || '');
      setCountryGroups(existingPosition.countryGroups || '');
      setCountry(existingPosition.country || '');
      setFederalStates(existingPosition.federalStates || '');
      setZipFrom(existingPosition.zipFrom || '');
      setZipTo(existingPosition.zipTo || '');
      setAccountMappings(existingPosition.accountMappings || []);
      setTaxMappings(existingPosition.taxMappings || []);
    }
  }, [existingPosition]);

  const handleAddAccountMapping = () => {
    setAccountMappings((prev) => [
      ...prev,
      {
        id: `am-${Date.now()}`,
        originalAccount: '',
        replacementAccount: '',
      },
    ]);
  };

  const handleRemoveAccountMapping = (id: string) => {
    setAccountMappings((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAccountMappingChange = (
    id: string,
    field: 'originalAccount' | 'replacementAccount',
    value: string,
  ) => {
    setAccountMappings((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const handleAddTaxMapping = () => {
    setTaxMappings((prev) => [
      ...prev,
      {
        id: `tm-${Date.now()}`,
        originalTax: '',
        replacementTax: '',
      },
    ]);
  };

  const handleRemoveTaxMapping = (id: string) => {
    setTaxMappings((prev) => prev.filter((item) => item.id !== id));
  };

  const handleTaxMappingChange = (
    id: string,
    field: 'originalTax' | 'replacementTax',
    value: string,
  ) => {
    setTaxMappings((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const handleSave = () => {
    const posName = name.trim() || 'وضع مالي جديد';
    const id = existingPosition?.id || posName.toLowerCase().replace(/\s+/g, '-');

    const payload: FiscalPosition = {
      id,
      name: posName,
      autoDetect,
      vatRequired,
      foreignTaxId,
      countryGroups,
      country,
      federalStates,
      zipFrom,
      zipTo,
      accountMappings,
      taxMappings,
    };

    savePosition(payload);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);

    if (isNew) {
      router.push(accountingRoutes.fiscalPositionDetail(id));
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-5xl mx-auto w-full">
      <SetPageTitle
        titleAr={isNew ? 'وضع مالي جديد' : `الأوضاع المالية / ${name || 'تعديل'}`}
        descriptionAr="تكوين وإعدادات الوضع المالي وقواعد التخطيط"
        iconName="CalendarRange"
      />

      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/40 bg-background p-2 shadow-xs">
        {/* Breadcrumb Navigation on Right */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push(accountingRoutes.fiscalPositions)}
            className="text-primary hover:text-primary/80 font-medium px-2 h-8"
          >
            الأوضاع المالية
          </Button>
          <span className="text-muted-foreground/40">/</span>
          <div className="flex items-center gap-1.5 text-foreground font-semibold">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <span>{isNew ? 'جديد' : name}</span>
          </div>
        </div>

        {/* Action Buttons on Left */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-lg px-4 h-8 text-sm"
            onClick={() => router.push(accountingRoutes.fiscalPositionNew)}
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

      {/* Main Form Card */}
      <div className="rounded-xl border border-border/60 bg-card p-6 md:p-8 shadow-xs flex flex-col gap-6 relative">
        {/* Top Stat Button (الضرائب) */}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push(accountingRoutes.taxes)}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground border-border/60"
          >
            <AlignJustify className="h-3.5 w-3.5" />
            <span>الضرائب</span>
          </Button>
        </div>

        {/* Two Column Form Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-12">
          {/* Right Column (RTL): الوضع المالي */}
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-12 items-center gap-2">
              <label className="col-span-4 text-sm font-medium text-foreground">
                الوضع المالي
              </label>
              <div className="col-span-8">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: Domestic أو Foreign Trade"
                  className="h-9 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Left Column (RTL): الكشف تلقائيا، الضرائب والدول */}
          <div className="flex flex-col gap-3.5">
            {/* الكشف تلقائياً */}
            <div className="grid grid-cols-12 items-center gap-2">
              <label className="col-span-6 text-sm font-medium text-foreground flex items-center gap-1">
                الكشف تلقائياً
                <span className="text-xs text-muted-foreground font-mono" title="كشف وتطبيق الوضع المالي تلقائياً بناءً على عنوان العميل">?</span>
              </label>
              <div className="col-span-6 flex items-center">
                <input
                  type="checkbox"
                  checked={autoDetect}
                  onChange={(e) => setAutoDetect(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                />
              </div>
            </div>

            {/* مطلوب ضريبة القيمة المضافة */}
            <div className="grid grid-cols-12 items-center gap-2">
              <label className="col-span-6 text-sm font-medium text-foreground flex items-center gap-1">
                مطلوب ضريبة القيمة المضافة
                <span className="text-xs text-muted-foreground font-mono" title="التحقق من إدخال الرقم الضريبي للعميل">?</span>
              </label>
              <div className="col-span-6 flex items-center">
                <input
                  type="checkbox"
                  checked={vatRequired}
                  onChange={(e) => setVatRequired(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                />
              </div>
            </div>

            {/* معرّف الضريبة الأجنبية */}
            <div className="grid grid-cols-12 items-center gap-2">
              <label className="col-span-6 text-sm font-medium text-foreground flex items-center gap-1">
                معرّف الضريبة الأجنبية
                <span className="text-xs text-muted-foreground font-mono" title="المعرّف الضريبي الأجنبي المعتمد">?</span>
              </label>
              <div className="col-span-6">
                <Input
                  value={foreignTaxId}
                  onChange={(e) => setForeignTaxId(e.target.value)}
                  placeholder=""
                  className="h-8 rounded-lg text-sm"
                />
              </div>
            </div>

            {/* مجموعات الدول */}
            <div className="grid grid-cols-12 items-center gap-2">
              <label className="col-span-6 text-sm font-medium text-foreground flex items-center gap-1">
                مجموعات الدول
                <span className="text-xs text-muted-foreground font-mono" title="مجموعة الدول التي ينطبق عليها هذا الوضع">?</span>
              </label>
              <div className="col-span-6">
                <Input
                  value={countryGroups}
                  onChange={(e) => setCountryGroups(e.target.value)}
                  placeholder=""
                  className="h-8 rounded-lg text-sm"
                />
              </div>
            </div>

            {/* الدولة */}
            <div className="grid grid-cols-12 items-center gap-2">
              <label className="col-span-6 text-sm font-medium text-foreground flex items-center gap-1">
                الدولة
                <span className="text-xs text-muted-foreground font-mono" title="الدولة المحددة">?</span>
              </label>
              <div className="col-span-6">
                <Input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="مثال: الولايات المتحدة"
                  className="h-8 rounded-lg text-sm"
                />
              </div>
            </div>

            {/* الولايات الاتحادية */}
            <div className="grid grid-cols-12 items-center gap-2">
              <label className="col-span-6 text-sm font-medium text-foreground">
                الولايات الاتحادية
              </label>
              <div className="col-span-6">
                <Input
                  value={federalStates}
                  onChange={(e) => setFederalStates(e.target.value)}
                  placeholder=""
                  className="h-8 rounded-lg text-sm"
                />
              </div>
            </div>

            {/* نطاق الرمز البريدي */}
            <div className="grid grid-cols-12 items-center gap-2">
              <label className="col-span-6 text-sm font-medium text-foreground">
                نطاق الرمز البريدي
              </label>
              <div className="col-span-6 flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-6">من</span>
                  <Input
                    value={zipFrom}
                    onChange={(e) => setZipFrom(e.target.value)}
                    placeholder=""
                    className="h-8 rounded-lg text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-6">إلى</span>
                  <Input
                    value={zipTo}
                    onChange={(e) => setZipTo(e.target.value)}
                    placeholder=""
                    className="h-8 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Section: تخطيط الحسابات & تخطيط الضرائب */}
        <div className="flex flex-col gap-3 border-t border-border/40 pt-4 mt-2">
          {/* Tab Headers */}
          <div className="flex items-center gap-4 border-b border-border/60">
            <button
              type="button"
              onClick={() => setActiveTab('accounts')}
              className={`pb-2 px-3 text-sm font-semibold transition-all border-b-2 ${
                activeTab === 'accounts'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              تخطيط الحسابات
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('taxes')}
              className={`pb-2 px-3 text-sm font-semibold transition-all border-b-2 ${
                activeTab === 'taxes'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              تخطيط الضرائب
            </button>
          </div>

          {/* Tab Content: تخطيط الحسابات */}
          {activeTab === 'accounts' ? (
            <div className="overflow-x-auto rounded-lg border border-border/60 bg-muted/10">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 bg-muted/30 text-muted-foreground select-none">
                  <tr>
                    <th className="px-4 py-2.5 text-start font-semibold text-foreground">
                      الحساب المعين للمنتج
                    </th>
                    <th className="px-4 py-2.5 text-start font-semibold text-foreground">
                      الحساب البديل
                    </th>
                    <th className="w-10 px-2 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 bg-card">
                  {accountMappings.map((mapping) => (
                    <tr key={mapping.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2">
                        <Input
                          value={mapping.originalAccount}
                          onChange={(e) =>
                            handleAccountMappingChange(
                              mapping.id,
                              'originalAccount',
                              e.target.value,
                            )
                          }
                          placeholder="مثال: 101402 الحساب البنكي المعلق"
                          className="h-8 text-sm bg-transparent border-border/40 focus:bg-background"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          value={mapping.replacementAccount}
                          onChange={(e) =>
                            handleAccountMappingChange(
                              mapping.id,
                              'replacementAccount',
                              e.target.value,
                            )
                          }
                          placeholder="مثال: 101404 المدفوعات المستحقة"
                          className="h-8 text-sm bg-transparent border-border/40 focus:bg-background"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveAccountMapping(mapping.id)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {accountMappings.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground text-xs">
                        لا توجد قواعد تخطيط حسابات مضافة.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Add link button */}
              <div className="p-2 border-t border-border/40 bg-muted/5">
                <button
                  type="button"
                  onClick={handleAddAccountMapping}
                  className="text-primary hover:text-primary/80 text-xs font-semibold flex items-center gap-1 py-1 px-2 rounded hover:bg-primary/5 transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>إضافة بند</span>
                </button>
              </div>
            </div>
          ) : (
            /* Tab Content: تخطيط الضرائب */
            <div className="overflow-x-auto rounded-lg border border-border/60 bg-muted/10">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 bg-muted/30 text-muted-foreground select-none">
                  <tr>
                    <th className="px-4 py-2.5 text-start font-semibold text-foreground">
                      ضريبة المنتج
                    </th>
                    <th className="px-4 py-2.5 text-start font-semibold text-foreground">
                      ضريبة الاستبدال
                    </th>
                    <th className="w-10 px-2 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 bg-card">
                  {taxMappings.map((mapping) => (
                    <tr key={mapping.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2">
                        <Input
                          value={mapping.originalTax}
                          onChange={(e) =>
                            handleTaxMappingChange(
                              mapping.id,
                              'originalTax',
                              e.target.value,
                            )
                          }
                          placeholder="مثال: 15%"
                          className="h-8 text-sm bg-transparent border-border/40 focus:bg-background"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          value={mapping.replacementTax}
                          onChange={(e) =>
                            handleTaxMappingChange(
                              mapping.id,
                              'replacementTax',
                              e.target.value,
                            )
                          }
                          placeholder="مثال: Exports 0%"
                          className="h-8 text-sm bg-transparent border-border/40 focus:bg-background"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveTaxMapping(mapping.id)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {taxMappings.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground text-xs">
                        لا توجد قواعد تخطيط ضرائب مضافة.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Add link button */}
              <div className="p-2 border-t border-border/40 bg-muted/5">
                <button
                  type="button"
                  onClick={handleAddTaxMapping}
                  className="text-primary hover:text-primary/80 text-xs font-semibold flex items-center gap-1 py-1 px-2 rounded hover:bg-primary/5 transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>إضافة بند</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
