'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, BookOpen, Settings2, HelpCircle } from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { accountingRoutes } from '@/features/accounting/constants/routes';

export function JournalFormPage({ journalId }: { journalId?: string }) {
  const router = useRouter();
  const isNew = !journalId || journalId === 'new';

  // Form State
  const [nameAr, setNameAr] = React.useState(isNew ? '' : 'المبيعات');
  const [typeAr, setTypeAr] = React.useState('sales'); // النوع: المبيعات
  const [sequencePrefix, setSequencePrefix] = React.useState('الفات'); // بادئة التسلسل

  // Tab 1: قيود اليومية (Journal Entries)
  const [defaultIncomeAccount, setDefaultIncomeAccount] = React.useState('Product Sales 400000'); // حساب الدخل الافتراضي
  const [customCreditNoteSeq, setCustomCreditNoteSeq] = React.useState(true); // تسلسل الإشعارات الدائنة المخصص
  const [currency, setCurrency] = React.useState(''); // العملة

  // Tab 2: الإعدادات المتقدمة (Advanced Settings)
  const [lockPostedEntriesHash, setLockPostedEntriesHash] = React.useState(false); // قم بتأمين القيود المرحلة باستخدام التجزئة
  const [communicationType, setCommunicationType] = React.useState('invoice'); // نوع التواصل: بناءً على الفواتير
  const [communicationStandard, setCommunicationStandard] = React.useState('full_reference'); // معيار الاتصال: المرجع الكامل (INV/2024/00001)

  return (
    <div className="flex flex-col gap-4">
      <SetPageTitle
        titleAr={isNew ? 'دفتر يومية جديد' : `دفاتر اليومية / ${nameAr}`}
        descriptionAr="تفاصيل وإعدادات دفتر اليومية"
        iconName="BookOpen"
      />

      {/* Action Header & Smart Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/40 bg-background p-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push(accountingRoutes.journals)}
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="h-4 w-4" />
            دفاتر اليومية
          </Button>
          <span className="text-muted-foreground/40">/</span>
          <span className="font-semibold text-foreground me-2">
            {isNew ? 'جديد' : nameAr}
          </span>
          <Settings2 className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground" />
        </div>

        <div className="flex items-center gap-2">
          {/* Smart Button: قيود اليومية */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 bg-card border-border hover:bg-muted/50 text-foreground font-medium"
          >
            <BookOpen className="h-4 w-4 text-primary" />
            <span>قيود اليومية</span>
          </Button>

          <Button
            type="button"
            className="bg-primary text-primary-foreground hover:bg-primary/90 px-5 ms-2"
            onClick={() => router.push(accountingRoutes.journals)}
          >
            حفظ
          </Button>
        </div>
      </div>

      {/* Main Form Container (Sheet Style) */}
      <div className="rounded-xl border border-border/60 bg-card p-6 shadow-xs flex flex-col gap-6">
        {/* Header Fields Section */}
        <div className="flex flex-col gap-4 max-w-xl">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-foreground">
              اسم دفتر اليومية
            </label>
            <Input
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              placeholder="مثال: المبيعات"
              className="text-2xl font-bold h-12 border-border/60"
            />
          </div>

          <div className="grid grid-cols-3 items-center gap-2 pt-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-1">
              النوع
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
            </label>
            <div className="col-span-2">
              <Select value={typeAr} onValueChange={setTypeAr}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">المبيعات</SelectItem>
                  <SelectItem value="purchases">الشراء</SelectItem>
                  <SelectItem value="bank">البنك</SelectItem>
                  <SelectItem value="cash">النقدية</SelectItem>
                  <SelectItem value="general">متفرقات</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 items-center gap-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-1">
              بادئة التسلسل
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
            </label>
            <div className="col-span-2">
              <Input
                value={sequencePrefix}
                onChange={(e) => setSequencePrefix(e.target.value)}
                className="h-9 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Tabs: قيود اليومية | الإعدادات المتقدمة */}
        <Tabs defaultValue="entries" dir="rtl" className="w-full mt-4">
          <TabsList className="bg-transparent border-b border-border/60 w-full justify-start rounded-none h-auto p-0 gap-6">
            <TabsTrigger
              value="entries"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-2 pt-1 font-semibold text-sm"
            >
              قيود اليومية
            </TabsTrigger>
            <TabsTrigger
              value="advanced"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-2 pt-1 font-semibold text-sm"
            >
              الإعدادات المتقدمة
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: JOURNAL ENTRIES (قيود اليومية) */}
          <TabsContent value="entries" className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-12">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-3 items-center gap-2">
                  <label className="text-sm font-medium text-foreground">
                    حساب الدخل الافتراضي
                  </label>
                  <div className="col-span-2">
                    <Input
                      value={defaultIncomeAccount}
                      onChange={(e) => setDefaultIncomeAccount(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 items-center gap-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1">
                    تسلسل الإشعارات الدائنة المخصص
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
                  </label>
                  <div className="col-span-2 flex items-center">
                    <input
                      type="checkbox"
                      checked={customCreditNoteSeq}
                      onChange={(e) => setCustomCreditNoteSeq(e.target.checked)}
                      className="rounded border-border text-primary h-4 w-4 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 items-center gap-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1">
                    العملة
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
                  </label>
                  <div className="col-span-2">
                    <Input
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      placeholder="اختر العملة..."
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: ADVANCED SETTINGS (الإعدادات المتقدمة) */}
          <TabsContent value="advanced" className="pt-6 flex flex-col gap-6">
            {/* Section 1: الأتمتة */}
            <div className="flex flex-col gap-3">
              <h4 className="text-sm font-bold text-foreground border-b border-border/40 pb-1">
                الأتمتة
              </h4>
              <div className="flex items-center justify-between max-w-xl">
                <label className="text-sm font-medium text-foreground flex items-center gap-1 cursor-pointer">
                  قم بتأمين القيود المرحلة باستخدام التجزئة
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
                </label>
                <input
                  type="checkbox"
                  checked={lockPostedEntriesHash}
                  onChange={(e) => setLockPostedEntriesHash(e.target.checked)}
                  className="rounded border-border text-primary h-4 w-4 cursor-pointer"
                />
              </div>
            </div>

            {/* Section 2: التواصل بشأن الدفع */}
            <div className="flex flex-col gap-3">
              <h4 className="text-sm font-bold text-foreground border-b border-border/40 pb-1">
                التواصل بشأن الدفع
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-12">
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-3 items-center gap-2">
                    <label className="text-sm font-medium text-foreground flex items-center gap-1">
                      نوع التواصل
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
                    </label>
                    <div className="col-span-2">
                      <Input
                        value="بناءً على الفواتير"
                        readOnly
                        className="h-9 bg-muted/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 items-center gap-2">
                    <label className="text-sm font-medium text-foreground flex items-center gap-1">
                      معيار الاتصال
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
                    </label>
                    <div className="col-span-2">
                      <Input
                        value="المرجع الكامل (INV/2024/00001)"
                        readOnly
                        className="h-9 bg-muted/20"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: رسائل البريد الإلكتروني */}
                <div className="flex flex-col gap-2">
                  <h4 className="text-sm font-bold text-foreground border-b border-border/40 pb-1">
                    رسائل البريد الإلكتروني
                  </h4>
                  <button
                    type="button"
                    className="text-primary hover:underline text-sm font-medium text-start flex items-center gap-1 pt-1"
                  >
                    <span>←</span>
                    <span>تهيئة نطاق لقب البريد الإلكتروني</span>
                  </button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
