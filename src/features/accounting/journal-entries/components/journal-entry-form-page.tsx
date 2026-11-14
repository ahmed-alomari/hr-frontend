'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings2,
  Check,
  Plus,
  Trash2,
  ListOrdered,
  RotateCcw,
  ArrowRight,
  Printer,
} from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Button } from '@/components/ui/button';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AmountInput } from '@/features/accounting/_shared/components/amount-input';
import { formatAccountingAmount } from '@/features/accounting/_shared/lib/format-accounting-amount';
import { accountingRoutes } from '@/features/accounting/constants/routes';
import { useJournalEntriesStore } from '@/features/accounting/journal-entries/lib/journal-entries-store';
import type { JournalEntry, JournalItem } from '@/features/accounting/domain/types/journal-entry';

interface JournalEntryFormPageProps {
  entryId?: string;
}

export function JournalEntryFormPage({ entryId }: JournalEntryFormPageProps) {
  const router = useRouter();
  const isNew = !entryId || entryId === 'new';

  const getEntry = useJournalEntriesStore((state) => state.getEntry);
  const saveEntry = useJournalEntriesStore((state) => state.saveEntry);
  const postEntry = useJournalEntriesStore((state) => state.postEntry);
  const resetToDraft = useJournalEntriesStore((state) => state.resetToDraft);
  const reverseEntry = useJournalEntriesStore((state) => state.reverseEntry);

  const existingEntry = React.useMemo(() => {
    if (isNew) return null;
    return getEntry(entryId);
  }, [isNew, entryId, getEntry]);

  // Form State
  const [name, setName] = React.useState(existingEntry?.name || 'قيد مسودة');
  const [date, setDate] = React.useState(existingEntry?.date || new Date().toISOString().split('T')[0]);
  const [accountingDate, setAccountingDate] = React.useState(
    existingEntry?.accountingDate || existingEntry?.date || new Date().toISOString().split('T')[0],
  );
  const [reference, setReference] = React.useState(existingEntry?.reference || '');
  const [journalId, setJournalId] = React.useState(existingEntry?.journalId || 'misc');
  const [journalName, setJournalName] = React.useState(existingEntry?.journalName || 'عمليات متنوعة');
  const [autoPost, setAutoPost] = React.useState(existingEntry?.autoPost || false);
  const [fiscalPosition, setFiscalPosition] = React.useState(existingEntry?.fiscalPosition || '');
  const [nonModifiableEncryption, setNonModifiableEncryption] = React.useState(
    existingEntry?.nonModifiableEncryption || '',
  );
  const [internalNotes, setInternalNotes] = React.useState(existingEntry?.internalNotes || '');
  const [state, setState] = React.useState<'draft' | 'posted' | 'cancel'>(existingEntry?.state || 'draft');

  // Tabs: items | other_info
  const [activeTab, setActiveTab] = React.useState<'items' | 'other'>('items');

  // Items
  const [items, setItems] = React.useState<JournalItem[]>(
    existingEntry?.items || [
      {
        id: 'ji-1',
        accountId: '121000 حساب مدين',
        partnerName: 'علي بن علي',
        name: 'التحويل إلى 211000 حساب الدائن',
        debit: 0,
        credit: 1150,
        taxGrids: '',
      },
      {
        id: 'ji-2',
        accountId: '211000 حساب الدائن',
        partnerName: 'علي بن علي',
        name: 'التحويل من 121000 حساب مدين',
        debit: 1150,
        credit: 0,
        taxGrids: '',
      },
    ],
  );

  const [savedSuccess, setSavedSuccess] = React.useState(false);

  // Sync state if existing entry updates
  React.useEffect(() => {
    if (existingEntry) {
      setName(existingEntry.name);
      setDate(existingEntry.date);
      setAccountingDate(existingEntry.accountingDate || existingEntry.date);
      setReference(existingEntry.reference || '');
      setJournalId(existingEntry.journalId);
      setJournalName(existingEntry.journalName);
      setAutoPost(existingEntry.autoPost || false);
      setFiscalPosition(existingEntry.fiscalPosition || '');
      setNonModifiableEncryption(existingEntry.nonModifiableEncryption || '');
      setInternalNotes(existingEntry.internalNotes || '');
      setState(existingEntry.state);
      setItems(existingEntry.items);
    }
  }, [existingEntry]);

  // Totals
  const { totalDebit, totalCredit } = React.useMemo(() => {
    let debit = 0;
    let credit = 0;
    items.forEach((item) => {
      debit += Number(item.debit) || 0;
      credit += Number(item.credit) || 0;
    });
    return { totalDebit: debit, totalCredit: credit };
  }, [items]);

  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001;

  const handleAddItem = () => {
    const newItem: JournalItem = {
      id: `ji-${Date.now()}`,
      accountId: '101000 الصندوق الرئيسي',
      partnerName: '',
      name: '',
      debit: 0,
      credit: 0,
      taxGrids: '',
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleUpdateItem = (id: string, field: keyof JournalItem, value: any) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        return { ...i, [field]: value };
      }),
    );
  };

  const handleSave = () => {
    const id = isNew ? `je-${Date.now()}` : entryId!;
    const payload: JournalEntry = {
      id,
      name: isNew && (name === 'قيد مسودة' || name === '/') ? `المتف/2026/09/${Math.floor(1000 + Math.random() * 9000)}` : name,
      date,
      accountingDate,
      reference,
      journalId,
      journalName,
      partnerName: items.find((i) => i.partnerName)?.partnerName || '',
      total: Math.max(totalDebit, totalCredit),
      state,
      autoPost,
      fiscalPosition,
      nonModifiableEncryption,
      internalNotes,
      items,
    };

    saveEntry(payload);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);

    if (isNew) {
      router.push(accountingRoutes.journalEntryDetail(id));
    }
  };

  const handlePost = () => {
    if (!isNew && entryId) {
      postEntry(entryId);
      setState('posted');
    } else {
      setState('posted');
      handleSave();
    }
  };

  const handleResetDraft = () => {
    if (!isNew && entryId) {
      resetToDraft(entryId);
      setState('draft');
    } else {
      setState('draft');
    }
  };

  const handleReverse = () => {
    if (!isNew && entryId) {
      const newRevId = reverseEntry(entryId);
      if (newRevId) {
        router.push(accountingRoutes.journalEntryDetail(newRevId));
      }
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-6xl mx-auto w-full" dir="rtl">
      <SetPageTitle
        titleAr={isNew ? 'قيد يومية جديد' : `قيود اليومية / ${existingEntry?.name || 'قيد'}`}
        descriptionAr="تفاصيل وترحيل قيد اليومية"
        iconName="ListOrdered"
      />

      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/40 bg-background p-2 shadow-xs">
        {/* Breadcrumb Navigation on Right */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push(accountingRoutes.journalEntries)}
            className="text-primary hover:text-primary/80 font-medium px-2 h-8"
          >
            قيود اليومية
          </Button>
          <span className="text-muted-foreground/40">/</span>
          <div className="flex items-center gap-1.5 text-foreground font-semibold">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono">{isNew ? 'جديد' : existingEntry?.name}</span>
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
                state === 'posted' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground'
              }`}
            >
              مرحل
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
        {/* Action Buttons Bar inside Sheet */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {state === 'draft' && (
              <Button
                type="button"
                className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 text-xs font-semibold px-4 shadow-xs"
                onClick={handlePost}
              >
                ترحيل
              </Button>
            )}

            {state === 'posted' && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-8 text-xs font-medium"
                  onClick={handleReverse}
                >
                  <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                  عكس القيد
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-8 text-xs font-medium"
                  onClick={handleResetDraft}
                >
                  إعادة التعيين كمسودة
                </Button>
              </>
            )}

            <Button type="button" variant="outline" size="sm" className="gap-1.5 h-8 text-xs font-medium">
              <Printer className="h-3.5 w-3.5 text-muted-foreground" />
              طباعة القيد
            </Button>
          </div>

          {state === 'posted' && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-emerald-600 font-bold text-xs">
              ✓ قيد مرحل بالحسابات
            </div>
          )}
        </div>

        {/* Entry Title & Header Info */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold font-mono text-foreground">
              {isNew ? 'قيد مسودة' : existingEntry?.name}
            </h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 pt-2">
            {/* Right Column: تاريخ القيد، تاريخ المحاسبة */}
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-12 items-center gap-2">
                <label className="col-span-4 text-sm font-medium text-foreground">تاريخ المحاسبة</label>
                <div className="col-span-8">
                  <DatePickerInput
                    value={accountingDate}
                    onChange={setAccountingDate}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-12 items-center gap-2">
                <label className="col-span-4 text-sm font-medium text-foreground">دفتر اليومية</label>
                <div className="col-span-8">
                  <select
                    value={journalName}
                    onChange={(e) => {
                      setJournalName(e.target.value);
                      if (e.target.value === 'المبيعات') setJournalId('sales');
                      else if (e.target.value === 'تقسيم المخزون') setJournalId('stock');
                      else setJournalId('misc');
                    }}
                    className="w-full h-9 text-sm rounded-md border border-border bg-background px-3 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="عمليات متنوعة">عمليات متنوعة</option>
                    <option value="المبيعات">المبيعات</option>
                    <option value="تقسيم المخزون">تقسيم المخزون</option>
                    <option value="المشتريات">المشتريات</option>
                    <option value="البنك">البنك</option>
                    <option value="النقدية">النقدية</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Left Column: الرقم المرجعي */}
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-12 items-center gap-2">
                <label className="col-span-4 text-sm font-medium text-foreground">الرقم المرجعي</label>
                <div className="col-span-8">
                  <Input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="مثال: S00003 أو Stock Closing"
                    className="h-9 text-sm font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Section: عناصر اليومية | معلومات أخرى */}
        <div className="flex flex-col gap-4 border-t border-border/40 pt-4 mt-2">
          <div className="flex items-center gap-2 border-b border-border/60">
            <button
              type="button"
              onClick={() => setActiveTab('items')}
              className={`pb-2.5 px-4 text-sm font-semibold transition-all border-b-2 ${
                activeTab === 'items'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              عناصر اليومية
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('other')}
              className={`pb-2.5 px-4 text-sm font-semibold transition-all border-b-2 ${
                activeTab === 'other'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              معلومات أخرى
            </button>
          </div>

          {/* Tab 1: عناصر اليومية */}
          {activeTab === 'items' && (
            <div className="flex flex-col gap-4">
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-start text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/40 text-muted-foreground font-semibold">
                      <th className="p-3 text-start font-bold text-foreground">الحساب</th>
                      <th className="p-3 text-start font-bold text-foreground">الشريك</th>
                      <th className="p-3 text-start font-bold text-foreground">بطاقة عنوان / البيان</th>
                      <th className="p-3 text-end font-bold text-foreground w-36">المدين</th>
                      <th className="p-3 text-end font-bold text-foreground w-36">الدائن</th>
                      <th className="p-3 text-start font-bold text-foreground">شبكات الضرائب</th>
                      <th className="p-3 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/20 group transition-colors">
                        <td className="p-2 w-1/4">
                          <Input
                            value={item.accountId}
                            onChange={(e) => handleUpdateItem(item.id, 'accountId', e.target.value)}
                            placeholder="121000 حساب مدين"
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-2 w-1/6">
                          <Input
                            value={item.partnerName || ''}
                            onChange={(e) => handleUpdateItem(item.id, 'partnerName', e.target.value)}
                            placeholder="علي بن علي"
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={item.name}
                            onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                            placeholder="البيان..."
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <AmountInput
                            value={item.debit}
                            onChange={(val) => handleUpdateItem(item.id, 'debit', val)}
                            className="h-8 text-xs font-mono"
                          />
                        </td>
                        <td className="p-2">
                          <AmountInput
                            value={item.credit}
                            onChange={(val) => handleUpdateItem(item.id, 'credit', val)}
                            className="h-8 text-xs font-mono"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={item.taxGrids || ''}
                            onChange={(e) => handleUpdateItem(item.id, 'taxGrids', e.target.value)}
                            placeholder=""
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
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

              {/* Add line button */}
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs border-dashed"
                  onClick={handleAddItem}
                >
                  <Plus className="h-3.5 w-3.5" />
                  إضافة سطر
                </Button>
              </div>

              {/* Totals Summary Footer */}
              <div className="flex justify-end pt-2">
                <div className="flex flex-wrap items-center gap-8 rounded-lg bg-muted/20 border border-border/40 px-6 py-3 text-sm font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs font-normal">إجمالي المدين:</span>
                    <span dir="ltr" className="font-mono text-foreground font-bold">
                      {formatAccountingAmount(totalDebit, 'SAR')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs font-normal">إجمالي الدائن:</span>
                    <span dir="ltr" className="font-mono text-foreground font-bold">
                      {formatAccountingAmount(totalCredit, 'SAR')}
                    </span>
                  </div>

                  {!isBalanced && (
                    <div className="text-destructive text-xs font-semibold bg-destructive/10 px-2.5 py-1 rounded">
                      غير متوازن — الفرق {Math.abs(totalDebit - totalCredit).toFixed(2)} ريال
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: معلومات أخرى */}
          {activeTab === 'other' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-12 items-center gap-2">
                  <label className="col-span-4 text-sm font-medium text-foreground">الترحيل التلقائي</label>
                  <div className="col-span-8 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={autoPost}
                      onChange={(e) => setAutoPost(e.target.checked)}
                      className="rounded border-border h-4 w-4 accent-primary cursor-pointer"
                    />
                    <span className="text-xs text-muted-foreground">ترحيل القيد تلقائياً عند حلول التاريخ</span>
                  </div>
                </div>

                <div className="grid grid-cols-12 items-center gap-2">
                  <label className="col-span-4 text-sm font-medium text-foreground">الوضع المالي</label>
                  <div className="col-span-8">
                    <Input
                      value={fiscalPosition}
                      onChange={(e) => setFiscalPosition(e.target.value)}
                      placeholder="الوضع المالي الافتراضي"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-12 items-center gap-2">
                  <label className="col-span-4 text-sm font-medium text-foreground">تشفير عدم قابلية التعديل</label>
                  <div className="col-span-8">
                    <Input
                      value={nonModifiableEncryption}
                      onChange={(e) => setNonModifiableEncryption(e.target.value)}
                      placeholder="رمز التشفير غير القابل للتعديل"
                      className="h-9 text-sm font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground">ملاحظات داخلية</label>
                <Textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="إضافة ملاحظة داخلية..."
                  rows={4}
                  className="text-sm resize-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
