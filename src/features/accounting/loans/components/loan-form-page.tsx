'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings2,
  Check,
  Plus,
  Trash2,
  CreditCard,
  RotateCcw,
  FileText,
  SlidersHorizontal,
} from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Button } from '@/components/ui/button';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { Input } from '@/components/ui/input';
import { AmountInput } from '@/features/accounting/_shared/components/amount-input';
import { formatAccountingAmount } from '@/features/accounting/_shared/lib/format-accounting-amount';
import { accountingRoutes } from '@/features/accounting/constants/routes';
import { useLoansStore } from '@/features/accounting/loans/lib/loans-store';
import type { Loan, LoanAmortizationLine } from '@/features/accounting/domain/types/loan';

interface LoanFormPageProps {
  loanId?: string;
}

export function LoanFormPage({ loanId }: LoanFormPageProps) {
  const router = useRouter();
  const isNew = !loanId || loanId === 'new';

  const getLoan = useLoansStore((state) => state.getLoan);
  const saveLoan = useLoansStore((state) => state.saveLoan);
  const confirmLoan = useLoansStore((state) => state.confirmLoan);
  const closeLoan = useLoansStore((state) => state.closeLoan);
  const cancelLoan = useLoansStore((state) => state.cancelLoan);
  const resetLoan = useLoansStore((state) => state.resetLoan);

  const existingLoan = React.useMemo(() => {
    if (isNew) return null;
    return getLoan(loanId);
  }, [isNew, loanId, getLoan]);

  // Form State
  const [name, setName] = React.useState(existingLoan?.name || 'قرض الترميم');
  const [state, setState] = React.useState<'draft' | 'running' | 'closed'>(existingLoan?.state || 'draft');

  const [borrowedAmount, setBorrowedAmount] = React.useState(existingLoan?.borrowedAmount || 100000);
  const [interestAmount, setInterestAmount] = React.useState(existingLoan?.interestAmount || 0);
  const [dueAmount, setDueAmount] = React.useState(existingLoan?.dueAmount || 100000);

  const [loanDate, setLoanDate] = React.useState(existingLoan?.loanDate || '2026-09-01');
  const [durationMonths, setDurationMonths] = React.useState(existingLoan?.durationMonths || 12);
  const [assetModel, setAssetModel] = React.useState(existingLoan?.assetModel || 'مجموعة الأصول');

  // إعدادات القرض
  const [longTermAccount, setLongTermAccount] = React.useState(existingLoan?.longTermAccount || '221000 قروض طويلة الأجل');
  const [shortTermAccount, setShortTermAccount] = React.useState(existingLoan?.shortTermAccount || '211000 حساب الدائن');
  const [expenseAccount, setExpenseAccount] = React.useState(existingLoan?.expenseAccount || '611000 شراء المعدات');
  const [journalName, setJournalName] = React.useState(existingLoan?.journalName || 'البنك');
  const [skipTo, setSkipTo] = React.useState(existingLoan?.skipTo || '');

  // Tabs: schedule (جدول الاستهلاك) | settings (إعدادات القرض)
  const [activeTab, setActiveTab] = React.useState<'schedule' | 'settings'>('schedule');

  // Lines
  const [amortizationSchedule, setAmortizationSchedule] = React.useState<LoanAmortizationLine[]>(
    existingLoan?.amortizationSchedule || [
      { id: 'as-1', date: '30 سبتمبر', debtPrincipal: 8333.33, interest: 0.0, payments: 8333.33, dueAmount: 91666.67 },
      { id: 'as-2', date: '31 أكتوبر', debtPrincipal: 8333.33, interest: 0.0, payments: 8333.33, dueAmount: 83333.34 },
      { id: 'as-3', date: '30 نوفمبر', debtPrincipal: 8333.33, interest: 0.0, payments: 8333.33, dueAmount: 75000.01 },
      { id: 'as-4', date: '31 ديسمبر', debtPrincipal: 8333.33, interest: 0.0, payments: 8333.33, dueAmount: 66666.68 },
      { id: 'as-5', date: '31 يناير 2027', debtPrincipal: 8333.33, interest: 0.0, payments: 8333.33, dueAmount: 58333.35 },
      { id: 'as-6', date: '28 فبراير 2027', debtPrincipal: 8333.33, interest: 0.0, payments: 8333.33, dueAmount: 50000.02 },
      { id: 'as-7', date: '31 مارس 2027', debtPrincipal: 8333.33, interest: 0.0, payments: 8333.33, dueAmount: 41666.69 },
      { id: 'as-8', date: '30 أبريل 2027', debtPrincipal: 8333.33, interest: 0.0, payments: 8333.33, dueAmount: 33333.36 },
      { id: 'as-9', date: '31 مايو 2027', debtPrincipal: 8333.33, interest: 0.0, payments: 8333.33, dueAmount: 25000.03 },
      { id: 'as-10', date: '30 يونيو 2027', debtPrincipal: 8333.33, interest: 0.0, payments: 8333.33, dueAmount: 16666.70 },
      { id: 'as-11', date: '31 يوليو 2027', debtPrincipal: 8333.33, interest: 0.0, payments: 8333.33, dueAmount: 8333.37 },
      { id: 'as-12', date: '31 أغسطس 2027', debtPrincipal: 8333.33, interest: 0.0, payments: 8333.33, dueAmount: 0.04 },
    ],
  );

  const [savedSuccess, setSavedSuccess] = React.useState(false);

  // Sync state if existing updates
  React.useEffect(() => {
    if (existingLoan) {
      setName(existingLoan.name);
      setState(existingLoan.state);
      setBorrowedAmount(existingLoan.borrowedAmount);
      setInterestAmount(existingLoan.interestAmount);
      setDueAmount(existingLoan.dueAmount);
      setLoanDate(existingLoan.loanDate);
      setDurationMonths(existingLoan.durationMonths);
      setAssetModel(existingLoan.assetModel || 'مجموعة الأصول');
      setLongTermAccount(existingLoan.longTermAccount);
      setShortTermAccount(existingLoan.shortTermAccount);
      setExpenseAccount(existingLoan.expenseAccount);
      setJournalName(existingLoan.journalName);
      setSkipTo(existingLoan.skipTo || '');
      setAmortizationSchedule(existingLoan.amortizationSchedule);
    }
  }, [existingLoan]);

  // Schedule Totals
  const { totalPrincipal, totalInterest, totalPayments } = React.useMemo(() => {
    let p = 0;
    let i = 0;
    let pay = 0;
    amortizationSchedule.forEach((line) => {
      p += Number(line.debtPrincipal) || 0;
      i += Number(line.interest) || 0;
      pay += Number(line.payments) || 0;
    });
    return { totalPrincipal: p, totalInterest: i, totalPayments: pay };
  }, [amortizationSchedule]);

  const handleSave = () => {
    const id = isNew ? `loan-${Date.now()}` : loanId!;
    const payload: Loan = {
      id,
      name,
      state,
      borrowedAmount,
      interestAmount,
      dueAmount,
      loanDate,
      durationMonths,
      assetModel,
      longTermAccount,
      shortTermAccount,
      expenseAccount,
      journalName,
      skipTo,
      amortizationSchedule,
    };

    saveLoan(payload);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);

    if (isNew) {
      router.push(accountingRoutes.loanDetail(id));
    }
  };

  const handleConfirm = () => {
    if (!isNew && loanId) {
      confirmLoan(loanId);
      setState('running');
    } else {
      setState('running');
      handleSave();
    }
  };

  const handleClose = () => {
    if (!isNew && loanId) {
      closeLoan(loanId);
      setState('closed');
    } else {
      setState('closed');
    }
  };

  const handleCancel = () => {
    if (!isNew && loanId) {
      cancelLoan(loanId);
      setState('draft');
    } else {
      setState('draft');
    }
  };

  const handleReset = () => {
    if (!isNew && loanId) {
      resetLoan(loanId);
      setState('draft');
    } else {
      setState('draft');
    }
  };

  const handleRemoveLine = (id: string) => {
    setAmortizationSchedule((prev) => prev.filter((l) => l.id !== id));
  };

  const handleAddLine = () => {
    const newLine: LoanAmortizationLine = {
      id: `as-${Date.now()}`,
      date: 'تاريخ جديد',
      debtPrincipal: 0,
      interest: 0,
      payments: 0,
      dueAmount: 0,
    };
    setAmortizationSchedule((prev) => [...prev, newLine]);
  };

  return (
    <div className="flex flex-col gap-4 max-w-6xl mx-auto w-full" dir="rtl">
      <SetPageTitle
        titleAr={isNew ? 'قرض جديد' : `القروض / ${existingLoan?.name || 'قرض'}`}
        descriptionAr="تفاصيل واستهلاك القرض"
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
            onClick={() => router.push(accountingRoutes.loans)}
            className="text-primary hover:text-primary/80 font-medium px-2 h-8"
          >
            القروض
          </Button>
          <span className="text-muted-foreground/40">/</span>
          <div className="flex items-center gap-1.5 text-foreground font-semibold">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono">{isNew ? 'جديد' : `${existingLoan?.name || 'قرض'}، التزميم: 09 2026 - 08 2027`}</span>
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
                state === 'closed' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground'
              }`}
            >
              مغلق
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
        {/* Buttons Bar inside Sheet */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {state === 'draft' && (
              <>
                <Button
                  type="button"
                  className="bg-[#714B67] hover:bg-[#5e3e56] text-white h-8 text-xs font-semibold px-4 shadow-xs"
                  onClick={handleConfirm}
                >
                  تأكيد
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-medium"
                  onClick={handleReset}
                >
                  إعادة الضبط
                </Button>
              </>
            )}

            {state === 'running' && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-medium"
                  onClick={handleClose}
                >
                  إغلاق
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-medium text-destructive hover:bg-destructive/10"
                  onClick={handleCancel}
                >
                  إلغاء
                </Button>
              </>
            )}
          </div>

          {/* Smart Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push(accountingRoutes.journalEntries)}
              className="flex items-center gap-2 border border-border/80 rounded-lg px-3 py-1.5 hover:bg-muted/30 transition-colors text-xs"
            >
              <div className="flex flex-col items-start">
                <span className="text-[10px] text-muted-foreground font-medium">القيود المُرحّلة</span>
                <span className="font-bold text-foreground">0</span>
              </div>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Loan Title & Main Info Header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">الاسم</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-2xl md:text-3xl font-extrabold text-foreground border-none p-0 h-auto focus-visible:ring-0 focus-visible:border-b rounded-none shadow-none"
              placeholder="اسم القرض..."
            />
          </div>

          {/* Summary Row matching Screenshot 2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-4 pt-2 text-sm">
            <div className="space-y-3">
              <div className="grid grid-cols-12 items-center gap-2">
                <label className="col-span-4 text-xs font-medium text-foreground">المبلغ المقترض</label>
                <div className="col-span-8">
                  <AmountInput
                    value={borrowedAmount}
                    onChange={setBorrowedAmount}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-12 items-center gap-2">
                <label className="col-span-4 text-xs font-medium text-foreground">الفائدة</label>
                <div className="col-span-8">
                  <AmountInput
                    value={interestAmount}
                    onChange={setInterestAmount}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-12 items-center gap-2">
                <label className="col-span-4 text-xs font-medium text-foreground">المبلغ المستحق</label>
                <div className="col-span-8">
                  <AmountInput
                    value={dueAmount}
                    onChange={setDueAmount}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-12 items-center gap-2">
                <label className="col-span-4 text-xs font-medium text-foreground">تاريخ القرض</label>
                <div className="col-span-8">
                  <DatePickerInput
                    value={loanDate}
                    onChange={setLoanDate}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-12 items-center gap-2">
                <label className="col-span-4 text-xs font-medium text-foreground">المدة</label>
                <div className="col-span-8 flex items-center gap-2">
                  <Input
                    type="number"
                    value={durationMonths}
                    onChange={(e) => setDurationMonths(parseInt(e.target.value, 10) || 1)}
                    className="h-8 text-xs w-24"
                  />
                  <span className="text-xs text-muted-foreground">شهور</span>
                </div>
              </div>

              <div className="grid grid-cols-12 items-center gap-2">
                <label className="col-span-4 text-xs font-medium text-foreground">مجموعة الأصول</label>
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
          </div>
        </div>

        {/* Tab Navigation: جدول الاستهلاك | إعدادات القرض */}
        <div className="flex flex-col gap-4 border-t border-border/40 pt-4 mt-1">
          <div className="flex items-center gap-2 border-b border-border/60">
            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              className={`pb-2.5 px-4 text-sm font-semibold transition-all border-b-2 ${
                activeTab === 'schedule'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              جدول الاستهلاك
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`pb-2.5 px-4 text-sm font-semibold transition-all border-b-2 ${
                activeTab === 'settings'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              إعدادات القرض
            </button>
          </div>

          {/* Tab 1: جدول الاستهلاك */}
          {activeTab === 'schedule' && (
            <div className="flex flex-col gap-4">
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-start text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/40 text-muted-foreground font-semibold">
                      <th className="p-3 text-start font-bold text-foreground">التاريخ</th>
                      <th className="p-3 text-end font-bold text-foreground">أصول الديون</th>
                      <th className="p-3 text-end font-bold text-foreground">الفوائد</th>
                      <th className="p-3 text-end font-bold text-foreground">المدفوعات</th>
                      <th className="p-3 text-end font-bold text-foreground">المبلغ المستحق</th>
                      <th className="p-3 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {amortizationSchedule.map((line) => (
                      <tr key={line.id} className="hover:bg-muted/20 group transition-colors">
                        <td className="p-3 whitespace-nowrap font-medium text-foreground">
                          {line.date}
                        </td>
                        <td className="p-3 whitespace-nowrap text-end font-mono font-medium">
                          {formatAccountingAmount(line.debtPrincipal, 'SAR')}
                        </td>
                        <td className="p-3 whitespace-nowrap text-end font-mono font-medium">
                          {formatAccountingAmount(line.interest, 'SAR')}
                        </td>
                        <td className="p-3 whitespace-nowrap text-end font-mono font-medium">
                          {formatAccountingAmount(line.payments, 'SAR')}
                        </td>
                        <td className="p-3 whitespace-nowrap text-end font-mono font-medium">
                          {formatAccountingAmount(line.dueAmount, 'SAR')}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(line.id)}
                            className="text-muted-foreground hover:text-destructive opacity-60 hover:opacity-100 transition-opacity p-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Totals footer matching screenshot */}
                  <tfoot>
                    <tr className="border-t-2 border-border/80 bg-muted/20 font-bold text-foreground">
                      <td className="p-3 text-start">المجموع</td>
                      <td className="p-3 text-end font-mono">
                        {formatAccountingAmount(totalPrincipal, 'SAR')}
                      </td>
                      <td className="p-3 text-end font-mono">
                        {formatAccountingAmount(totalInterest, 'SAR')}
                      </td>
                      <td className="p-3 text-end font-mono">
                        {formatAccountingAmount(totalPayments, 'SAR')}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddLine}
                  className="text-xs text-primary font-semibold hover:bg-muted/40 gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  إضافة بند
                </Button>
              </div>
            </div>
          )}

          {/* Tab 2: إعدادات القرض (Matching screenshot 3) */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-4 pt-2 text-sm">
              <div className="space-y-4">
                <div className="grid grid-cols-12 items-center gap-2">
                  <label className="col-span-5 text-xs font-medium text-foreground">حساب طويل الأجل</label>
                  <div className="col-span-7">
                    <Input
                      value={longTermAccount}
                      onChange={(e) => setLongTermAccount(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-12 items-center gap-2">
                  <label className="col-span-5 text-xs font-medium text-foreground">حساب قصير الأجل</label>
                  <div className="col-span-7">
                    <Input
                      value={shortTermAccount}
                      onChange={(e) => setShortTermAccount(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-12 items-center gap-2">
                  <label className="col-span-5 text-xs font-medium text-foreground">حساب النفقات</label>
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

              <div className="space-y-4">
                <div className="grid grid-cols-12 items-center gap-2">
                  <div className="col-span-4 flex items-center gap-1 text-xs font-medium text-foreground">
                    <span>تخطي إلى</span>
                    <span className="text-[10px] text-muted-foreground font-mono" title="تخطي فترات">?</span>
                  </div>
                  <div className="col-span-8">
                    <Input
                      value={skipTo}
                      onChange={(e) => setSkipTo(e.target.value)}
                      placeholder=""
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
