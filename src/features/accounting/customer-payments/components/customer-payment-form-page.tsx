'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings2,
  Check,
  CreditCard,
  Building2,
  FileText,
  DollarSign,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Button } from '@/components/ui/button';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AmountInput } from '@/features/accounting/_shared/components/amount-input';
import { accountingRoutes } from '@/features/accounting/constants/routes';
import { useCustomerPaymentsStore } from '@/features/accounting/customer-payments/lib/customer-payments-store';
import type { CustomerPayment } from '@/features/accounting/domain/types/customer-payment';

interface CustomerPaymentFormPageProps {
  paymentId?: string;
}

export function CustomerPaymentFormPage({ paymentId }: CustomerPaymentFormPageProps) {
  const router = useRouter();
  const isNew = !paymentId || paymentId === 'new';

  const getPayment = useCustomerPaymentsStore((state) => state.getPayment);
  const savePayment = useCustomerPaymentsStore((state) => state.savePayment);
  const postPayment = useCustomerPaymentsStore((state) => state.postPayment);

  const existingPayment = React.useMemo(() => {
    if (isNew) return null;
    return getPayment(paymentId);
  }, [isNew, paymentId, getPayment]);

  // Form State
  const [partnerName, setPartnerName] = React.useState(existingPayment?.partnerName || '');
  const [amount, setAmount] = React.useState<number>(existingPayment?.amount || 0);
  const [currency, setCurrency] = React.useState(existingPayment?.currency || 'SAR');
  const [paymentDate, setPaymentDate] = React.useState(existingPayment?.paymentDate || '2024-05-11');
  const [memo, setMemo] = React.useState(existingPayment?.memo || '');
  const [journalName, setJournalName] = React.useState(existingPayment?.journalName || 'البنك (الراجحي)');
  const [paymentMethodLine, setPaymentMethodLine] = React.useState(existingPayment?.paymentMethodLine || 'تحويل بنكي مباشر');

  const [savedSuccess, setSavedSuccess] = React.useState(false);

  const handleSave = () => {
    const id = existingPayment?.id || `pay-${Date.now()}`;
    const name = existingPayment?.name || `CUST.IN/2024/${id.slice(-5)}`;

    const payload: CustomerPayment = {
      id,
      name,
      paymentType: 'inbound',
      partnerType: 'customer',
      partnerId: existingPayment?.partnerId || 'cust-1',
      partnerName: partnerName.trim() || 'عميل',
      amount: Number(amount) || 0,
      currency,
      paymentDate,
      memo,
      journalId: existingPayment?.journalId || 'j-3',
      journalName,
      paymentMethodLine,
      state: existingPayment?.state || 'posted',
      matchedInvoicesCount: existingPayment?.matchedInvoicesCount || 0,
    };

    savePayment(payload);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);

    if (isNew) {
      router.push(`/accounting/customers/payments/${id}`);
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-5xl mx-auto w-full" dir="rtl">
      <SetPageTitle
        titleAr={isNew ? 'دفعة عميل جديدة' : `المدفوعات / ${existingPayment?.name || 'دفعة'}`}
        descriptionAr="تفاصيل وإيصال دفعة العميل"
        iconName="CreditCard"
      />

      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/40 bg-background p-2 shadow-xs">
        {/* Breadcrumb Navigation on Right */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push('/accounting/customers/payments')}
            className="text-primary hover:text-primary/80 font-medium px-2 h-8"
          >
            المدفوعات
          </Button>
          <span className="text-muted-foreground/40">/</span>
          <div className="flex items-center gap-1.5 text-foreground font-semibold">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono">{isNew ? 'جديد' : existingPayment?.name}</span>
          </div>
        </div>

        {/* State Pipeline Badges */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border/60 bg-muted/20 p-1 text-xs">
            <span
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                existingPayment?.state === 'draft' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground'
              }`}
            >
              مسودة
            </span>
            <span
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                existingPayment?.state === 'posted' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground'
              }`}
            >
              مرحل
            </span>
            <span
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                existingPayment?.state === 'cancel' ? 'bg-destructive text-destructive-foreground' : 'text-muted-foreground'
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

      {/* Main Form Card */}
      <div className="rounded-xl border border-border/60 bg-card p-6 md:p-8 shadow-xs flex flex-col gap-6 relative">
        {/* Header Smart Buttons */}
        <div className="flex items-center justify-start gap-2 border-b border-border/40 pb-4">
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
            <FileText className="h-4 w-4 text-primary" />
            <div className="flex flex-col text-start">
              <span>الفواتير المطابقة</span>
              <span className="font-bold text-foreground font-mono">
                {existingPayment?.matchedInvoicesCount || 1}
              </span>
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground font-semibold">تحصيل دفعة عميل</span>
          <h1 className="text-2xl font-bold font-mono text-foreground">
            {isNew ? 'دفعة جديدة' : existingPayment?.name}
          </h1>
        </div>

        {/* Payment Fields (Matching Screenshot 1 for Customer Payment) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-5 pt-2">
          {/* Right Column: نوع الدفعة، الشريك، المبلغ */}
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-12 items-center gap-2">
              <label className="col-span-4 text-sm font-medium text-foreground">نوع الدفعة</label>
              <div className="col-span-8 flex items-center gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" checked readOnly className="text-primary" />
                  <span className="font-medium text-foreground">استلام أموال (تحصيل)</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-12 items-center gap-2">
              <label className="col-span-4 text-sm font-medium text-foreground">العميل</label>
              <div className="col-span-8">
                <Input
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  placeholder="اختر اسم العميل..."
                  className="h-9 text-sm font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-12 items-center gap-2">
              <label className="col-span-4 text-sm font-medium text-foreground">المبلغ</label>
              <div className="col-span-8 flex items-center gap-2">
                <AmountInput
                  value={amount}
                  onChange={setAmount}
                  className="h-9 text-base font-bold font-mono text-start flex-1"
                />
                <span className="font-bold text-sm text-muted-foreground font-mono">{currency}</span>
              </div>
            </div>

            <div className="grid grid-cols-12 items-center gap-2">
              <label className="col-span-4 text-sm font-medium text-foreground">تاريخ الدفعة</label>
              <div className="col-span-8">
                <DatePickerInput
                  value={paymentDate}
                  onChange={setPaymentDate}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Left Column: دفتر اليومية، طريقة الدفع، البيان */}
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-12 items-center gap-2">
              <label className="col-span-4 text-sm font-medium text-foreground">دفتر اليومية</label>
              <div className="col-span-8">
                <Input
                  value={journalName}
                  onChange={(e) => setJournalName(e.target.value)}
                  className="h-9 text-sm bg-muted/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-12 items-center gap-2">
              <label className="col-span-4 text-sm font-medium text-foreground">طريقة الدفع</label>
              <div className="col-span-8">
                <Input
                  value={paymentMethodLine}
                  onChange={(e) => setPaymentMethodLine(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-12 items-start gap-2">
              <label className="col-span-4 text-sm font-medium text-foreground pt-2">البيان / الملاحظة</label>
              <div className="col-span-8">
                <Textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="اكتب بيان وسند الدفعة..."
                  rows={2}
                  className="text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
