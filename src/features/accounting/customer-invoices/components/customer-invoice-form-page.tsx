'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings2,
  Check,
  CreditCard,
  Send,
  Plus,
  Trash2,
  HelpCircle,
  FileText,
  Printer,
  Ban,
  ArrowRight,
} from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Button } from '@/components/ui/button';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AmountInput } from '@/features/accounting/_shared/components/amount-input';
import { formatAccountingAmount } from '@/features/accounting/_shared/lib/format-accounting-amount';
import { accountingRoutes } from '@/features/accounting/constants/routes';
import { useCustomerInvoicesStore } from '@/features/accounting/customer-invoices/lib/customer-invoices-store';
import type { CustomerInvoice, InvoiceLine } from '@/features/accounting/domain/types/customer-invoice';

interface CustomerInvoiceFormPageProps {
  invoiceId?: string;
}

export function CustomerInvoiceFormPage({ invoiceId }: CustomerInvoiceFormPageProps) {
  const router = useRouter();
  const isNew = !invoiceId || invoiceId === 'new';

  const getInvoice = useCustomerInvoicesStore((state) => state.getInvoice);
  const saveInvoice = useCustomerInvoicesStore((state) => state.saveInvoice);
  const postInvoice = useCustomerInvoicesStore((state) => state.postInvoice);
  const registerPayment = useCustomerInvoicesStore((state) => state.registerPayment);

  const existingInvoice = React.useMemo(() => {
    if (isNew) return null;
    return getInvoice(invoiceId);
  }, [isNew, invoiceId, getInvoice]);

  // Form State
  const [customerName, setCustomerName] = React.useState(existingInvoice?.customerName || '');
  const [invoiceDate, setInvoiceDate] = React.useState(existingInvoice?.invoiceDate || '2024-05-12');
  const [dueDate, setDueDate] = React.useState(existingInvoice?.dueDate || '2024-05-26');
  const [deliveryDate, setDeliveryDate] = React.useState(existingInvoice?.deliveryDate || '2024-05-12');
  const [paymentReference, setPaymentReference] = React.useState(existingInvoice?.paymentReference || '');
  const [journalName, setJournalName] = React.useState(existingInvoice?.journalName || 'المبيعات');
  const [currency, setCurrency] = React.useState(existingInvoice?.currency || 'SAR');
  const [salesperson, setSalesperson] = React.useState(existingInvoice?.salesperson || 'أحمد سعيد');
  const [fiscalPosition, setFiscalPosition] = React.useState(existingInvoice?.fiscalPosition || 'الوضع الافتراضي');
  const [terms, setTerms] = React.useState(existingInvoice?.terms || 'يرجى سداد الفاتورة خلال المدة المحددة.');

  // Tabs: invoice_lines | journal_items | other_info
  const [activeTab, setActiveTab] = React.useState<'lines' | 'journal_items' | 'other'>('lines');

  // Lines
  const [lines, setLines] = React.useState<InvoiceLine[]>(
    existingInvoice?.lines || [
      {
        id: 'l-1',
        name: 'خدمات استشارية محاسبية وتدقيق',
        accountId: 'Product Sales 400000',
        quantity: 1,
        uom: 'وحدة',
        priceUnit: 1000,
        taxes: ['15%'],
        priceSubtotal: 1000,
      },
    ],
  );

  const [savedSuccess, setSavedSuccess] = React.useState(false);

  // Recalculate Totals
  const { amountUntaxed, amountTax, amountTotal } = React.useMemo(() => {
    let untaxed = 0;
    lines.forEach((l) => {
      untaxed += l.quantity * l.priceUnit;
    });
    const tax = untaxed * 0.15; // 15% standard VAT
    return {
      amountUntaxed: untaxed,
      amountTax: tax,
      amountTotal: untaxed + tax,
    };
  }, [lines]);

  const handleAddLine = () => {
    const newLine: InvoiceLine = {
      id: `line-${Date.now()}`,
      name: '',
      accountId: 'Product Sales 400000',
      quantity: 1,
      uom: 'وحدة',
      priceUnit: 0,
      taxes: ['15%'],
      priceSubtotal: 0,
    };
    setLines((prev) => [...prev, newLine]);
  };

  const handleRemoveLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleUpdateLine = (id: string, field: keyof InvoiceLine, value: any) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, [field]: value };
        if (field === 'quantity' || field === 'priceUnit') {
          updated.priceSubtotal = (Number(updated.quantity) || 0) * (Number(updated.priceUnit) || 0);
        }
        return updated;
      }),
    );
  };

  const handleSave = () => {
    const id = existingInvoice?.id || `inv-${Date.now()}`;
    const name = existingInvoice?.name || `INV/2024/${id.slice(-5)}`;

    const payload: CustomerInvoice = {
      id,
      name,
      customerId: existingInvoice?.customerId || 'cust-1',
      customerName: customerName.trim() || 'عميل نقدي',
      invoiceDate,
      dueDate,
      deliveryDate,
      paymentReference: paymentReference || name,
      journalId: existingInvoice?.journalId || 'j-1',
      journalName,
      currency,
      state: existingInvoice?.state || 'posted',
      paymentState: existingInvoice?.paymentState || 'not_paid',
      lines,
      amountUntaxed,
      amountTax,
      amountTotal,
      amountDue: existingInvoice ? existingInvoice.amountDue : amountTotal,
      terms,
      salesperson,
      fiscalPosition,
    };

    saveInvoice(payload);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);

    if (isNew) {
      router.push(`/accounting/customers/invoices/${id}`);
    }
  };

  const handleRegisterPayment = () => {
    if (existingInvoice) {
      registerPayment(existingInvoice.id, existingInvoice.amountDue);
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-6xl mx-auto w-full" dir="rtl">
      <SetPageTitle
        titleAr={isNew ? 'فاتورة عميل جديدة' : `فواتير العملاء / ${existingInvoice?.name || 'فاتورة'}`}
        descriptionAr="تفاصيل وإصدار فاتورة المبيعات"
        iconName="FileText"
      />

      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/40 bg-background p-2 shadow-xs">
        {/* Breadcrumb Navigation on Right */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push('/accounting/customers/invoices')}
            className="text-primary hover:text-primary/80 font-medium px-2 h-8"
          >
            فواتير العملاء
          </Button>
          <span className="text-muted-foreground/40">/</span>
          <div className="flex items-center gap-1.5 text-foreground font-semibold">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono">{isNew ? 'جديد' : existingInvoice?.name}</span>
          </div>
        </div>

        {/* State Pipeline Badges (status bar) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border/60 bg-muted/20 p-1 text-xs">
            <span
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                existingInvoice?.state === 'draft' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground'
              }`}
            >
              مسودة
            </span>
            <span
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                existingInvoice?.state === 'posted' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground'
              }`}
            >
              مرحل
            </span>
            <span
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                existingInvoice?.state === 'cancel' ? 'bg-destructive text-destructive-foreground' : 'text-muted-foreground'
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

      {/* Main Sheet */}
      <div className="rounded-xl border border-border/60 bg-card p-6 md:p-8 shadow-xs flex flex-col gap-6 relative">
        {/* Buttons Bar inside Sheet (Confirm, Register Payment, Print, Cancel) */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {existingInvoice?.state === 'posted' && existingInvoice.paymentState !== 'paid' && (
              <Button
                type="button"
                className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 text-xs font-semibold px-4 shadow-xs"
                onClick={handleRegisterPayment}
              >
                تسجيل دفعة
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" className="gap-1.5 h-8 text-xs font-medium">
              <Send className="h-3.5 w-3.5 text-muted-foreground" />
              إرسال وطباعة
            </Button>
            <Button type="button" variant="outline" size="sm" className="gap-1.5 h-8 text-xs font-medium">
              إشعار دائن
            </Button>
          </div>

          {/* Payment Ribbon / Badge */}
          {existingInvoice?.paymentState === 'paid' && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-emerald-600 font-bold text-xs">
              ✓ مدفوعة بالكامل
            </div>
          )}
        </div>

        {/* Invoice Title & Header Info */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold font-mono text-foreground">
              {isNew ? 'فاتورة مسودة' : existingInvoice?.name}
            </h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 pt-2">
            {/* Right Column: العميل، العنوان */}
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-12 items-center gap-2">
                <label className="col-span-4 text-sm font-medium text-foreground">العميل</label>
                <div className="col-span-8">
                  <Input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="اختر أو اكتب اسم العميل..."
                    className="h-9 text-sm font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-12 items-center gap-2">
                <label className="col-span-4 text-sm font-medium text-foreground">مرجع الدفع</label>
                <div className="col-span-8">
                  <Input
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="المرجع على إشعار السداد"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Left Column: التواريخ، دفتر اليومية */}
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-12 items-center gap-2">
                <label className="col-span-4 text-sm font-medium text-foreground">تاريخ الفاتورة</label>
                <div className="col-span-8">
                  <DatePickerInput
                    value={invoiceDate}
                    onChange={setInvoiceDate}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-12 items-center gap-2">
                <label className="col-span-4 text-sm font-medium text-foreground">تاريخ الاستحقاق</label>
                <div className="col-span-8">
                  <DatePickerInput
                    value={dueDate}
                    onChange={setDueDate}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-12 items-center gap-2">
                <label className="col-span-4 text-sm font-medium text-foreground">دفتر اليومية</label>
                <div className="col-span-8">
                  <Input
                    value={journalName}
                    onChange={(e) => setJournalName(e.target.value)}
                    className="h-9 text-sm bg-muted/20"
                    readOnly
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Section: بنود الفاتورة | عناصر اليومية | معلومات أخرى */}
        <div className="flex flex-col gap-4 border-t border-border/40 pt-4 mt-2">
          <div className="flex items-center gap-2 border-b border-border/60">
            <button
              type="button"
              onClick={() => setActiveTab('lines')}
              className={`pb-2.5 px-4 text-sm font-semibold transition-all border-b-2 ${
                activeTab === 'lines' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              بنود الفاتورة
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('journal_items')}
              className={`pb-2.5 px-4 text-sm font-semibold transition-all border-b-2 ${
                activeTab === 'journal_items' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              عناصر اليومية
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('other')}
              className={`pb-2.5 px-4 text-sm font-semibold transition-all border-b-2 ${
                activeTab === 'other' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              معلومات أخرى
            </button>
          </div>

          {/* Tab 1: بنود الفاتورة Table */}
          {activeTab === 'lines' && (
            <div className="flex flex-col gap-4">
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 border-b border-border/60 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5 text-start font-semibold">المنتج / الوصف</th>
                      <th className="px-3 py-2.5 text-start font-semibold">الحساب</th>
                      <th className="px-3 py-2.5 text-start font-semibold w-24">الكمية</th>
                      <th className="px-3 py-2.5 text-start font-semibold w-24">الوحدة</th>
                      <th className="px-3 py-2.5 text-start font-semibold w-28">السعر</th>
                      <th className="px-3 py-2.5 text-start font-semibold w-24">الضرائب</th>
                      <th className="px-3 py-2.5 text-start font-semibold w-32">المجموع الفرعي</th>
                      <th className="w-10 px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {lines.map((line) => (
                      <tr key={line.id} className="hover:bg-muted/20">
                        <td className="p-2">
                          <Input
                            value={line.name}
                            onChange={(e) => handleUpdateLine(line.id, 'name', e.target.value)}
                            placeholder="وصف البند أو الخدمة..."
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={line.accountId}
                            onChange={(e) => handleUpdateLine(line.id, 'accountId', e.target.value)}
                            className="h-8 text-xs font-mono bg-muted/10"
                          />
                        </td>
                        <td className="p-2">
                          <AmountInput
                            value={line.quantity}
                            onChange={(next) => handleUpdateLine(line.id, 'quantity', next)}
                            className="h-8 text-sm font-mono text-center"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={line.uom || 'وحدة'}
                            onChange={(e) => handleUpdateLine(line.id, 'uom', e.target.value)}
                            className="h-8 text-sm text-center"
                          />
                        </td>
                        <td className="p-2">
                          <AmountInput
                            value={line.priceUnit}
                            onChange={(next) => handleUpdateLine(line.id, 'priceUnit', next)}
                            className="h-8 text-sm font-mono text-start"
                          />
                        </td>
                        <td className="p-2">
                          <span className="inline-flex items-center rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                            15%
                          </span>
                        </td>
                        <td className="p-2 font-mono font-bold text-foreground text-start" dir="ltr">
                          {formatAccountingAmount(line.priceSubtotal, currency)}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(line.id)}
                            className="text-muted-foreground/60 hover:text-destructive p-1 rounded transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddLine}
                  className="gap-1.5 text-primary border-dashed border-primary/40 hover:bg-primary/5"
                >
                  <Plus className="h-4 w-4" />
                  إضافة سطر
                </Button>
              </div>

              {/* Bottom Totals Summary Section */}
              <div className="flex flex-col md:flex-row items-start justify-between gap-6 border-t border-border/40 pt-4 mt-2">
                <div className="flex-1 w-full max-w-md">
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                    الشروط والأحكام
                  </label>
                  <Textarea
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    rows={3}
                    className="text-xs"
                    placeholder="أدخل الشروط والأحكام ومعلومات السداد البنكي..."
                  />
                </div>

                <div className="w-full md:w-72 flex flex-col gap-2 rounded-lg bg-muted/20 p-4 border border-border/40">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">المبلغ غير شامل الضريبة:</span>
                    <span className="font-mono font-semibold text-foreground" dir="ltr">
                      {formatAccountingAmount(amountUntaxed, currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">الضريبة (15%):</span>
                    <span className="font-mono font-semibold text-foreground" dir="ltr">
                      {formatAccountingAmount(amountTax, currency)}
                    </span>
                  </div>
                  <div className="border-t border-border/60 pt-2 flex items-center justify-between text-base font-bold">
                    <span className="text-foreground">الإجمالي:</span>
                    <span className="font-mono text-primary text-lg" dir="ltr">
                      {formatAccountingAmount(amountTotal, currency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: عناصر اليومية */}
          {activeTab === 'journal_items' && (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b border-border/60 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-start font-semibold">الحساب</th>
                    <th className="px-4 py-2.5 text-start font-semibold">الشريك</th>
                    <th className="px-4 py-2.5 text-start font-semibold">التسمية</th>
                    <th className="px-4 py-2.5 text-start font-semibold">مدين</th>
                    <th className="px-4 py-2.5 text-start font-semibold">دائن</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono text-xs">
                  <tr>
                    <td className="px-4 py-2.5 font-medium text-foreground">121000 حساب المدينون</td>
                    <td className="px-4 py-2.5">{customerName || 'عميل'}</td>
                    <td className="px-4 py-2.5">{existingInvoice?.name || 'فاتورة مبيعات'}</td>
                    <td className="px-4 py-2.5 font-bold text-foreground" dir="ltr">{formatAccountingAmount(amountTotal, currency)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground" dir="ltr">{formatAccountingAmount(0, currency)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-medium text-foreground">400000 إيرادات مبيعات المنتجات</td>
                    <td className="px-4 py-2.5">{customerName || 'عميل'}</td>
                    <td className="px-4 py-2.5">{existingInvoice?.name || 'فاتورة مبيعات'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground" dir="ltr">{formatAccountingAmount(0, currency)}</td>
                    <td className="px-4 py-2.5 font-bold text-foreground" dir="ltr">{formatAccountingAmount(amountUntaxed, currency)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-medium text-foreground">220000 ضريبة القيمة المضافة المحصلة</td>
                    <td className="px-4 py-2.5">{customerName || 'عميل'}</td>
                    <td className="px-4 py-2.5">ضريبة 15%</td>
                    <td className="px-4 py-2.5 text-muted-foreground" dir="ltr">{formatAccountingAmount(0, currency)}</td>
                    <td className="px-4 py-2.5 font-bold text-foreground" dir="ltr">{formatAccountingAmount(amountTax, currency)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 3: معلومات أخرى */}
          {activeTab === 'other' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 py-2">
              <div className="flex flex-col gap-3">
                <h4 className="text-sm font-bold text-foreground border-b border-border/40 pb-1">معلومات الفاتورة</h4>
                <div className="grid grid-cols-12 items-center gap-2">
                  <label className="col-span-5 text-sm font-medium text-foreground">مندوب المبيعات</label>
                  <div className="col-span-7">
                    <Input value={salesperson} onChange={(e) => setSalesperson(e.target.value)} className="h-8 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-12 items-center gap-2">
                  <label className="col-span-5 text-sm font-medium text-foreground">الوضع المالي</label>
                  <div className="col-span-7">
                    <Input value={fiscalPosition} onChange={(e) => setFiscalPosition(e.target.value)} className="h-8 text-sm" />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <h4 className="text-sm font-bold text-foreground border-b border-border/40 pb-1">الفوترة الإلكترونية (ZATCA / Peppol)</h4>
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-muted-foreground">حالة الفاتورة الإلكترونية:</span>
                  <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-600 border border-emerald-500/20">
                    موقعة ومطابقة (Signed & Compliant)
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
