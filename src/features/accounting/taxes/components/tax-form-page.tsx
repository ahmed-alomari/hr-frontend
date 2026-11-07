'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Trash2, HelpCircle, GripVertical, Plus } from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { accountingRoutes } from '@/features/accounting/constants/routes';

type DistributionRow = {
  id: string;
  percent: number;
  basedOn: string;
  account: string;
  taxGrids?: string;
};

export function TaxFormPage({ taxId }: { taxId?: string }) {
  const router = useRouter();
  const isNew = !taxId || taxId === 'new';

  // Form State
  const [nameAr, setNameAr] = React.useState(isNew ? '' : '15%');
  const [taxCalculation, setTaxCalculation] = React.useState('percentage'); // حساب الضريبة: النسبة
  const [taxType, setTaxType] = React.useState<'sales' | 'purchases'>('sales'); // نوع الضريبة: المبيعات
  const [taxScope, setTaxScope] = React.useState('goods'); // نطاق الضريبة: البضائع
  const [amount, setAmount] = React.useState('15.0000'); // مبلغ
  const [fiscalPosition, setFiscalPosition] = React.useState('Domestic'); // الوضع المالي
  const [replaceTax, setReplaceTax] = React.useState(false); // يستبدل
  const [active, setActive] = React.useState(true); // نشط

  // Tab 2: Advanced Options state
  const [invoiceLabel, setInvoiceLabel] = React.useState(''); // بطاقة العنوان على الفواتير
  const [description, setDescription] = React.useState(''); // الوصف
  const [taxGroup, setTaxGroup] = React.useState('Tax 15%'); // مجموعة الضريبة
  const [country, setCountry] = React.useState('الولايات المتحدة'); // الدولة
  const [taxCategoryCode, setTaxCategoryCode] = React.useState(''); // رمز فئة الضريبة
  const [legalNotes, setLegalNotes] = React.useState(''); // ملاحظات قانونية
  const [includedInPrice, setIncludedInPrice] = React.useState(false); // مشمول في السعر
  const [affectsBaseSubsequent, setAffectsBaseSubsequent] = React.useState(false); // تؤثر على المبلغ الأساسي للضرائب اللاحقة

  // Tables State
  const [invoiceDistribution, setInvoiceDistribution] = React.useState<DistributionRow[]>([
    { id: '1', percent: 0, basedOn: 'قاعدة', account: '' },
    { id: '2', percent: 100.0, basedOn: 'من الضريبة', account: '...ceived 251000' },
  ]);

  const [refundDistribution, setRefundDistribution] = React.useState<DistributionRow[]>([
    { id: '1', percent: 0, basedOn: 'قاعدة', account: '' },
    { id: '2', percent: 100.0, basedOn: 'من الضريبة', account: '...ceived 251000' },
  ]);

  const addInvoiceRow = () => {
    setInvoiceDistribution((prev) => [
      ...prev,
      { id: String(Date.now()), percent: 100, basedOn: 'من الضريبة', account: '' },
    ]);
  };

  const removeInvoiceRow = (id: string) => {
    setInvoiceDistribution((prev) => prev.filter((r) => r.id !== id));
  };

  const addRefundRow = () => {
    setRefundDistribution((prev) => [
      ...prev,
      { id: String(Date.now()), percent: 100, basedOn: 'من الضريبة', account: '' },
    ]);
  };

  const removeRefundRow = (id: string) => {
    setRefundDistribution((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="flex flex-col gap-4">
      <SetPageTitle
        titleAr={isNew ? 'ضريبة جديدة' : `الضرائب / ${nameAr}`}
        descriptionAr="تفاصيل وتكوين الضريبة"
        iconName="Percent"
      />

      {/* Top Bar with Back action */}
      <div className="flex items-center justify-between rounded-lg border border-border/40 bg-background p-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push(accountingRoutes.taxes)}
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="h-4 w-4" />
            الضرائب
          </Button>
          <span className="text-muted-foreground/40">/</span>
          <span className="font-semibold text-foreground">
            {isNew ? 'جديد' : nameAr}
          </span>
        </div>
        <Button
          type="button"
          className="bg-primary text-primary-foreground hover:bg-primary/90 px-5"
          onClick={() => router.push(accountingRoutes.taxes)}
        >
          حفظ
        </Button>
      </div>

      {/* Main Form Container */}
      <div className="rounded-xl border border-border/60 bg-card p-6 shadow-xs flex flex-col gap-6">
        {/* Form Fields Header Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-12">
          {/* Column 1 (RTL Right Column) */}
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 items-center gap-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1">
                اسم الضريبة
              </label>
              <div className="col-span-2">
                <Input
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  placeholder="مثال: 15%"
                  className="h-9 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 items-center gap-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1">
                حساب الضريبة
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
              </label>
              <div className="col-span-2">
                <Select value={taxCalculation} onValueChange={setTaxCalculation}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="اختر حساب الضريبة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">النسبة</SelectItem>
                    <SelectItem value="fixed">مبلغ ثابت</SelectItem>
                    <SelectItem value="group">مجموعة ضرائب</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 items-center gap-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1">
                نشط
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
              </label>
              <div className="col-span-2">
                <Switch checked={active} onCheckedChange={setActive} />
              </div>
            </div>
          </div>

          {/* Column 2 (RTL Left Column) */}
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 items-center gap-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1">
                نوع الضريبة
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
              </label>
              <div className="col-span-2">
                <Select
                  value={taxType}
                  onValueChange={(val) => setTaxType(val as 'sales' | 'purchases')}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales">المبيعات</SelectItem>
                    <SelectItem value="purchases">المشتريات</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 items-center gap-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1">
                نطاق الضريبة
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
              </label>
              <div className="col-span-2">
                <Select value={taxScope} onValueChange={setTaxScope}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="goods">البضائع</SelectItem>
                    <SelectItem value="services">الخدمات</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 items-center gap-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1">
                مبلغ
              </label>
              <div className="col-span-2 flex items-center gap-2">
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-9 text-start tabular-nums"
                />
                <span className="text-sm font-semibold text-muted-foreground">%</span>
              </div>
            </div>

            <div className="grid grid-cols-3 items-center gap-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1">
                الوضع المالي
              </label>
              <div className="col-span-2 flex items-center gap-2">
                <div className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2.5 py-1 text-xs font-medium text-foreground border border-border/50">
                  <span className="text-muted-foreground/70">✕</span>
                  <span>{fiscalPosition}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 items-center gap-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1">
                يستبدل
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
              </label>
              <div className="col-span-2">
                <Switch checked={replaceTax} onCheckedChange={setReplaceTax} />
              </div>
            </div>
          </div>
        </div>

        {/* Form Tabs (تعريف | خيارات متقدمة) */}
        <Tabs defaultValue="definition" dir="rtl" className="w-full mt-4">
          <TabsList className="bg-transparent border-b border-border/60 w-full justify-start rounded-none h-auto p-0 gap-6">
            <TabsTrigger
              value="definition"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-2 pt-1 font-semibold text-sm"
            >
              تعريف
            </TabsTrigger>
            <TabsTrigger
              value="advanced"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-2 pt-1 font-semibold text-sm"
            >
              خيارات متقدمة
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: DEFINITION (تعريف) */}
          <TabsContent value="definition" className="pt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Table 1: التوزيع للفواتير */}
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-bold text-foreground text-center">
                  التوزيع للفواتير
                </h4>
                <div className="overflow-x-auto rounded-md border border-border/60">
                  <table className="w-full text-xs">
                    <thead className="border-b border-border/60 bg-muted/30 text-muted-foreground">
                      <tr>
                        <th className="w-8 px-2 py-2">
                          <GripVertical className="h-3.5 w-3.5 opacity-50" />
                        </th>
                        <th className="px-2 py-2 text-start font-medium">%</th>
                        <th className="px-2 py-2 text-start font-medium">بناءً على</th>
                        <th className="px-2 py-2 text-start font-medium">الحساب</th>
                        <th className="w-8 px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceDistribution.map((row) => (
                        <tr key={row.id} className="border-b border-border/40 last:border-0">
                          <td className="px-2 py-2 text-muted-foreground/40">
                            <GripVertical className="h-3.5 w-3.5" />
                          </td>
                          <td className="px-2 py-2 font-medium tabular-nums">
                            {row.percent > 0 ? `${row.percent.toFixed(2)}` : ''}
                          </td>
                          <td className="px-2 py-2">{row.basedOn}</td>
                          <td className="px-2 py-2 text-muted-foreground truncate max-w-[150px]">
                            {row.account || '—'}
                          </td>
                          <td className="px-2 py-2">
                            {row.basedOn !== 'قاعدة' && (
                              <button
                                type="button"
                                onClick={() => removeInvoiceRow(row.id)}
                                className="text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-2 border-t border-border/40">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={addInvoiceRow}
                      className="text-primary text-xs h-7 gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      إضافة بند
                    </Button>
                  </div>
                </div>
              </div>

              {/* Table 2: توزيع المبالغ المستردة */}
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-bold text-foreground text-center">
                  توزيع المبالغ المستردة
                </h4>
                <div className="overflow-x-auto rounded-md border border-border/60">
                  <table className="w-full text-xs">
                    <thead className="border-b border-border/60 bg-muted/30 text-muted-foreground">
                      <tr>
                        <th className="w-8 px-2 py-2">
                          <GripVertical className="h-3.5 w-3.5 opacity-50" />
                        </th>
                        <th className="px-2 py-2 text-start font-medium">%</th>
                        <th className="px-2 py-2 text-start font-medium">بناءً على</th>
                        <th className="px-2 py-2 text-start font-medium">الحساب</th>
                        <th className="w-8 px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {refundDistribution.map((row) => (
                        <tr key={row.id} className="border-b border-border/40 last:border-0">
                          <td className="px-2 py-2 text-muted-foreground/40">
                            <GripVertical className="h-3.5 w-3.5" />
                          </td>
                          <td className="px-2 py-2 font-medium tabular-nums">
                            {row.percent > 0 ? `${row.percent.toFixed(2)}` : ''}
                          </td>
                          <td className="px-2 py-2">{row.basedOn}</td>
                          <td className="px-2 py-2 text-muted-foreground truncate max-w-[150px]">
                            {row.account || '—'}
                          </td>
                          <td className="px-2 py-2">
                            {row.basedOn !== 'قاعدة' && (
                              <button
                                type="button"
                                onClick={() => removeRefundRow(row.id)}
                                className="text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-2 border-t border-border/40">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={addRefundRow}
                      className="text-primary text-xs h-7 gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      إضافة بند
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: ADVANCED OPTIONS (خيارات متقدمة) */}
          <TabsContent value="advanced" className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-12">
              {/* Right Column */}
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-3 items-center gap-2">
                  <label className="text-sm font-medium text-foreground">
                    بطاقة العنوان على الفواتير
                  </label>
                  <div className="col-span-2">
                    <Input
                      value={invoiceLabel}
                      onChange={(e) => setInvoiceLabel(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 items-center gap-2">
                  <label className="text-sm font-medium text-foreground">
                    الوصف
                  </label>
                  <div className="col-span-2">
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 items-center gap-2">
                  <label className="text-sm font-medium text-foreground">
                    مجموعة الضريبة
                  </label>
                  <div className="col-span-2">
                    <Input
                      value={taxGroup}
                      onChange={(e) => setTaxGroup(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 items-center gap-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1">
                    الدولة
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
                  </label>
                  <div className="col-span-2">
                    <Input
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 items-center gap-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1">
                    رمز فئة الضريبة
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
                  </label>
                  <div className="col-span-2">
                    <Input
                      value={taxCategoryCode}
                      onChange={(e) => setTaxCategoryCode(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 items-center gap-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1">
                    ملاحظات قانونية
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
                  </label>
                  <div className="col-span-2">
                    <Input
                      value={legalNotes}
                      onChange={(e) => setLegalNotes(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>

              {/* Left Column */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">افتراضي</span>
                  <label className="text-sm font-medium text-foreground flex items-center gap-1 cursor-pointer">
                    مشمول في السعر
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
                  </label>
                  <input
                    type="checkbox"
                    checked={includedInPrice}
                    onChange={(e) => setIncludedInPrice(e.target.checked)}
                    className="rounded border-border text-primary h-4 w-4 cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1 cursor-pointer">
                    تؤثر على المبلغ الأساسي للضرائب اللاحقة
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
                  </label>
                  <input
                    type="checkbox"
                    checked={affectsBaseSubsequent}
                    onChange={(e) => setAffectsBaseSubsequent(e.target.checked)}
                    className="rounded border-border text-primary h-4 w-4 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
