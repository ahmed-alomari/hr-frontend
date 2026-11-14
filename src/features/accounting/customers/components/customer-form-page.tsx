'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings2,
  Check,
  DollarSign,
  Edit,
  CreditCard,
  Mail,
  Phone,
  Globe,
  Plus,
  Trash2,
  User,
  Building,
  Send,
  HelpCircle,
} from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatAccountingAmount } from '@/features/accounting/_shared/lib/format-accounting-amount';
import { accountingRoutes } from '@/features/accounting/constants/routes';
import { useCustomersStore } from '@/features/accounting/customers/lib/customers-store';
import type { Customer, CustomerContact } from '@/features/accounting/domain/types/customer';
import { formatNumber } from '@/shared/utils';

interface CustomerFormPageProps {
  customerId?: string;
}

export function CustomerFormPage({ customerId }: CustomerFormPageProps) {
  const router = useRouter();
  const isNew = !customerId || customerId === 'new';

  const getCustomer = useCustomersStore((state) => state.getCustomer);
  const saveCustomer = useCustomersStore((state) => state.saveCustomer);

  const existingCustomer = React.useMemo(() => {
    if (isNew) return null;
    return getCustomer(customerId);
  }, [isNew, customerId, getCustomer]);

  // Main Customer Fields
  const [type, setType] = React.useState<'person' | 'company'>(existingCustomer?.type || 'person');
  const [name, setName] = React.useState(existingCustomer?.name || '');
  const [email, setEmail] = React.useState(existingCustomer?.email || '');
  const [phone, setPhone] = React.useState(existingCustomer?.phone || '');
  const [street, setStreet] = React.useState(existingCustomer?.street || '');
  const [street2, setStreet2] = React.useState(existingCustomer?.street2 || '');
  const [city, setCity] = React.useState(existingCustomer?.city || '');
  const [state, setState] = React.useState(existingCustomer?.state || '');
  const [zip, setZip] = React.useState(existingCustomer?.zip || '');
  const [country, setCountry] = React.useState(existingCustomer?.country || '');
  const [taxId, setTaxId] = React.useState(existingCustomer?.taxId || 'غير منطبق');
  const [website, setWebsite] = React.useState(existingCustomer?.website || '');
  const [tagsInput, setTagsInput] = React.useState(existingCustomer?.tags?.join(', ') || '');

  // Tab State
  const [activeTab, setActiveTab] = React.useState<'contacts' | 'sales_purchases' | 'accounting' | 'notes'>('contacts');

  // Contacts
  const [contacts, setContacts] = React.useState<CustomerContact[]>(existingCustomer?.contacts || []);

  // Sales & Purchase Tab State
  const [salesperson, setSalesperson] = React.useState(existingCustomer?.salesperson || '');
  const [paymentTerms, setPaymentTerms] = React.useState(existingCustomer?.paymentTerms || '');
  const [paymentMethod, setPaymentMethod] = React.useState(existingCustomer?.paymentMethod || '');
  const [pricelist, setPricelist] = React.useState(existingCustomer?.pricelist || 'افتراضي (YER)');
  const [fiscalPosition, setFiscalPosition] = React.useState(existingCustomer?.fiscalPosition || '');
  const [customerLocation, setCustomerLocation] = React.useState(existingCustomer?.customerLocation || 'Customers');
  const [vendorLocation, setVendorLocation] = React.useState(existingCustomer?.vendorLocation || 'Vendors');
  const [groupRfq, setGroupRfq] = React.useState(existingCustomer?.groupRfq || 'On Order');
  const [buyer, setBuyer] = React.useState(existingCustomer?.buyer || '');
  const [purchasePaymentTerms, setPurchasePaymentTerms] = React.useState(existingCustomer?.purchasePaymentTerms || '');
  const [purchasePaymentMethod, setPurchasePaymentMethod] = React.useState(existingCustomer?.purchasePaymentMethod || '');
  const [receiptReminder, setReceiptReminder] = React.useState(existingCustomer?.receiptReminder || false);
  const [vendorCurrency, setVendorCurrency] = React.useState(existingCustomer?.vendorCurrency || '');
  const [companyId, setCompanyId] = React.useState(existingCustomer?.companyId || '');
  const [reference, setReference] = React.useState(existingCustomer?.reference || '');
  const [industry, setIndustry] = React.useState(existingCustomer?.industry || '');

  // Accounting Tab State
  const [bankAccounts, setBankAccounts] = React.useState(existingCustomer?.bankAccounts || '');
  const [accountReceivable, setAccountReceivable] = React.useState(existingCustomer?.accountReceivable || 'Account Receivable 121000');
  const [accountPayable, setAccountPayable] = React.useState(existingCustomer?.accountPayable || 'Account Payable 211000');
  const [autoBillPosting, setAutoBillPosting] = React.useState(existingCustomer?.autoBillPosting || 'السؤال بعد 3 عمليات تصديق دون تعديلات');
  const [ignoreUnusualBillAmount, setIgnoreUnusualBillAmount] = React.useState(existingCustomer?.ignoreUnusualBillAmount || false);
  const [ignoreUnusualBillDate, setIgnoreUnusualBillDate] = React.useState(existingCustomer?.ignoreUnusualBillDate || false);
  const [invoiceSendingMethod, setInvoiceSendingMethod] = React.useState(existingCustomer?.invoiceSendingMethod || 'الفوترة الإلكترونية والبريد الإلكتروني');
  const [electronicInvoiceFormat, setElectronicInvoiceFormat] = React.useState(existingCustomer?.electronicInvoiceFormat || 'تنسيق XML');
  const [peppolId, setPeppolId] = React.useState(existingCustomer?.peppolId || 'Your endpoint');
  const [followupStatus, setFollowupStatus] = React.useState(existingCustomer?.followupStatus || 'لا حاجة لاتخاذ إجراء');
  const [followupReminderType, setFollowupReminderType] = React.useState<'auto' | 'manual'>(existingCustomer?.followupReminderType || 'auto');
  const [nextReminderDate, setNextReminderDate] = React.useState(existingCustomer?.nextReminderDate || '');
  const [responsibleUser, setResponsibleUser] = React.useState(existingCustomer?.responsibleUser || '');

  // Notes Tab State
  const [internalNotes, setInternalNotes] = React.useState(existingCustomer?.internalNotes || '');

  const [savedSuccess, setSavedSuccess] = React.useState(false);

  React.useEffect(() => {
    if (existingCustomer) {
      setType(existingCustomer.type);
      setName(existingCustomer.name);
      setEmail(existingCustomer.email || '');
      setPhone(existingCustomer.phone || '');
      setStreet(existingCustomer.street || '');
      setStreet2(existingCustomer.street2 || '');
      setCity(existingCustomer.city || '');
      setState(existingCustomer.state || '');
      setZip(existingCustomer.zip || '');
      setCountry(existingCustomer.country || '');
      setTaxId(existingCustomer.taxId || 'غير منطبق');
      setWebsite(existingCustomer.website || '');
      setTagsInput(existingCustomer.tags?.join(', ') || '');
      setContacts(existingCustomer.contacts || []);
      setSalesperson(existingCustomer.salesperson || '');
      setPaymentTerms(existingCustomer.paymentTerms || '');
      setPaymentMethod(existingCustomer.paymentMethod || '');
      setPricelist(existingCustomer.pricelist || 'افتراضي (YER)');
      setFiscalPosition(existingCustomer.fiscalPosition || '');
      setCustomerLocation(existingCustomer.customerLocation || 'Customers');
      setVendorLocation(existingCustomer.vendorLocation || 'Vendors');
      setGroupRfq(existingCustomer.groupRfq || 'On Order');
      setBuyer(existingCustomer.buyer || '');
      setPurchasePaymentTerms(existingCustomer.purchasePaymentTerms || '');
      setPurchasePaymentMethod(existingCustomer.purchasePaymentMethod || '');
      setReceiptReminder(existingCustomer.receiptReminder || false);
      setVendorCurrency(existingCustomer.vendorCurrency || '');
      setCompanyId(existingCustomer.companyId || '');
      setReference(existingCustomer.reference || '');
      setIndustry(existingCustomer.industry || '');
      setBankAccounts(existingCustomer.bankAccounts || '');
      setAccountReceivable(existingCustomer.accountReceivable || 'Account Receivable 121000');
      setAccountPayable(existingCustomer.accountPayable || 'Account Payable 211000');
      setAutoBillPosting(existingCustomer.autoBillPosting || 'السؤال بعد 3 عمليات تصديق دون تعديلات');
      setIgnoreUnusualBillAmount(existingCustomer.ignoreUnusualBillAmount || false);
      setIgnoreUnusualBillDate(existingCustomer.ignoreUnusualBillDate || false);
      setInvoiceSendingMethod(existingCustomer.invoiceSendingMethod || 'الفوترة الإلكترونية والبريد الإلكتروني');
      setElectronicInvoiceFormat(existingCustomer.electronicInvoiceFormat || 'تنسيق XML');
      setPeppolId(existingCustomer.peppolId || 'Your endpoint');
      setFollowupStatus(existingCustomer.followupStatus || 'لا حاجة لاتخاذ إجراء');
      setFollowupReminderType(existingCustomer.followupReminderType || 'auto');
      setNextReminderDate(existingCustomer.nextReminderDate || '');
      setResponsibleUser(existingCustomer.responsibleUser || '');
      setInternalNotes(existingCustomer.internalNotes || '');
    }
  }, [existingCustomer]);

  const handleAddContact = () => {
    const newContact: CustomerContact = {
      id: `contact-${Date.now()}`,
      name: 'جهة اتصال جديدة',
      email: '',
      phone: '',
      jobPosition: '',
      type: 'contact',
    };
    setContacts((prev) => [...prev, newContact]);
  };

  const handleRemoveContact = (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSave = () => {
    const custName = name.trim() || 'عميل جديد';
    const id = existingCustomer?.id || `cust-${Date.now()}`;

    const payload: Customer = {
      id,
      type,
      name: custName,
      email,
      phone,
      street,
      street2,
      city,
      state,
      zip,
      country,
      taxId,
      website,
      tags: tagsInput ? tagsInput.split(',').map((t) => t.trim()).filter(Boolean) : [],
      avatarColor: existingCustomer?.avatarColor || '#9333ea',
      salesCount: existingCustomer?.salesCount || 0,
      invoicedAmount: existingCustomer?.invoicedAmount || 0,
      purchasesCount: existingCustomer?.purchasesCount || 0,
      contacts,
      salesperson,
      paymentTerms,
      paymentMethod,
      pricelist,
      fiscalPosition,
      customerLocation,
      vendorLocation,
      groupRfq,
      buyer,
      purchasePaymentTerms,
      purchasePaymentMethod,
      receiptReminder,
      vendorCurrency,
      companyId,
      reference,
      industry,
      bankAccounts,
      accountReceivable,
      accountPayable,
      autoBillPosting,
      ignoreUnusualBillAmount,
      ignoreUnusualBillDate,
      invoiceSendingMethod,
      electronicInvoiceFormat,
      peppolId,
      followupStatus,
      followupReminderType,
      nextReminderDate,
      responsibleUser,
      internalNotes,
    };

    saveCustomer(payload);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);

    if (isNew) {
      router.push(accountingRoutes.customerDetail(id));
    }
  };

  const initialLetter = name.trim().charAt(0) || 'ع';

  return (
    <div className="flex flex-col gap-4 max-w-6xl mx-auto w-full">
      <SetPageTitle
        titleAr={isNew ? 'عميل جديد' : `العملاء / ${name || 'تعديل'}`}
        descriptionAr="بيانات العميل والفواتير والمبيعات والحسابات"
        iconName="Users"
      />

      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/40 bg-background p-2 shadow-xs">
        {/* Breadcrumb Navigation on Right */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push(accountingRoutes.customers)}
            className="text-primary hover:text-primary/80 font-medium px-2 h-8"
          >
            العملاء
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
            onClick={() => router.push(accountingRoutes.customerNew)}
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
        {/* Top Header Stat Smart Buttons (Matching Screenshot 2) */}
        <div className="flex items-center justify-start gap-2 border-b border-border/40 pb-4">
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
            <CreditCard className="h-4 w-4 text-primary" />
            <div className="flex flex-col text-start">
              <span>المشتريات</span>
              <span className="font-bold text-foreground font-mono">
                {formatNumber(existingCustomer?.purchasesCount ?? 0)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
            <Edit className="h-4 w-4 text-primary" />
            <div className="flex flex-col text-start">
              <span>مفوتر</span>
              <span className="font-bold text-foreground font-mono">
                {formatAccountingAmount(existingCustomer?.invoicedAmount ?? 0, 'ريال')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
            <DollarSign className="h-4 w-4 text-primary" />
            <div className="flex flex-col text-start">
              <span>المبيعات</span>
              <span className="font-bold text-foreground font-mono">
                {formatNumber(existingCustomer?.salesCount ?? 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Main Customer Header Info (Matching Screenshot 2) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Right Section (Name, Type, Avatar, Contact, Address) */}
          <div className="col-span-12 md:col-span-7 flex flex-col gap-4">
            {/* Avatar & Name Row */}
            <div className="flex items-start gap-4">
              <div
                className="h-20 w-20 rounded-xl flex items-center justify-center text-white font-bold text-3xl shadow-sm shrink-0"
                style={{ backgroundColor: existingCustomer?.avatarColor || '#9333ea' }}
              >
                {initialLetter}
              </div>

              <div className="flex-1 flex flex-col gap-2">
                {/* Person vs Company Radio */}
                <div className="flex items-center gap-6 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="customer_type"
                      checked={type === 'person'}
                      onChange={() => setType('person')}
                      className="text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                    />
                    <span className="font-medium text-foreground">شخص</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="customer_type"
                      checked={type === 'company'}
                      onChange={() => setType('company')}
                      className="text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                    />
                    <span className="font-medium text-foreground">الشركة</span>
                  </label>
                </div>

                {/* Name Input */}
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: علي بن علي"
                  className="text-xl font-bold h-11 rounded-lg border-border/80"
                />

                {/* Email Input */}
                <div className="relative">
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="البريد الإلكتروني"
                    className="pe-9 h-9 text-sm rounded-lg"
                    dir="ltr"
                  />
                  <Mail className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>

                {/* Phone Input */}
                <div className="relative">
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="رقم الهاتف"
                    className="pe-9 h-9 text-sm rounded-lg"
                    dir="ltr"
                  />
                  <Phone className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>

            {/* Address fields */}
            <div className="grid grid-cols-12 items-start gap-2 border-t border-border/40 pt-4">
              <label className="col-span-3 text-sm font-medium text-foreground pt-1.5">
                العنوان
              </label>
              <div className="col-span-9 flex flex-col gap-2">
                <Input
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="الشارع..."
                  className="h-8 text-sm rounded-lg"
                />
                <Input
                  value={street2}
                  onChange={(e) => setStreet2(e.target.value)}
                  placeholder="الشارع 2..."
                  className="h-8 text-sm rounded-lg"
                />
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="المدينة"
                    className="h-8 text-sm rounded-lg"
                  />
                  <Input
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="الولاية"
                    className="h-8 text-sm rounded-lg"
                  />
                  <Input
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    placeholder="الرمز البريدي"
                    className="h-8 text-sm rounded-lg"
                  />
                </div>
                <Input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="الدولة"
                  className="h-8 text-sm rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Left Section (Tax ID, Website, Tags) */}
          <div className="col-span-12 md:col-span-5 flex flex-col gap-4 border-t md:border-t-0 md:border-s border-border/40 md:ps-6 pt-4 md:pt-0">
            {/* معرّف الضريبة */}
            <div className="grid grid-cols-12 items-center gap-2">
              <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                معرّف الضريبة
                <span className="text-xs text-muted-foreground font-mono" title="الرقم الضريبي أو معرّف ضريبة القيمة المضافة">?</span>
              </label>
              <div className="col-span-7">
                <Input
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="غير منطبق"
                  className="h-9 rounded-lg text-sm"
                />
              </div>
            </div>

            {/* الموقع الإلكتروني */}
            <div className="grid grid-cols-12 items-center gap-2">
              <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                الموقع الإلكتروني
                <span className="text-xs text-muted-foreground font-mono" title="رابط الموقع الإلكتروني">?</span>
              </label>
              <div className="col-span-7">
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="مثل https://www.example.com"
                  className="h-9 rounded-lg text-sm"
                  dir="ltr"
                />
              </div>
            </div>

            {/* علامات التصنيف */}
            <div className="grid grid-cols-12 items-center gap-2">
              <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                علامات التصنيف
                <span className="text-xs text-muted-foreground font-mono" title="الوسوم والتصنيفات">?</span>
              </label>
              <div className="col-span-7">
                <Input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder='مثال: "بين الشركات"، "كبار الشخصيات"...'
                  className="h-9 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Section */}
        <div className="flex flex-col gap-4 border-t border-border/40 pt-4 mt-2">
          {/* Tab Triggers */}
          <div className="flex items-center gap-2 border-b border-border/60 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('contacts')}
              className={`pb-2.5 px-4 text-sm font-semibold transition-all border-b-2 shrink-0 ${
                activeTab === 'contacts'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              جهات الاتصال
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sales_purchases')}
              className={`pb-2.5 px-4 text-sm font-semibold transition-all border-b-2 shrink-0 ${
                activeTab === 'sales_purchases'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              المبيعات والمشتريات
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('accounting')}
              className={`pb-2.5 px-4 text-sm font-semibold transition-all border-b-2 shrink-0 ${
                activeTab === 'accounting'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              المحاسبة
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('notes')}
              className={`pb-2.5 px-4 text-sm font-semibold transition-all border-b-2 shrink-0 ${
                activeTab === 'notes'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              الملاحظات
            </button>
          </div>

          {/* Tab 1: جهات الاتصال */}
          {activeTab === 'contacts' && (
            <div className="flex flex-col gap-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-start justify-between p-3 rounded-lg border border-border/60 bg-muted/10 gap-2"
                  >
                    <div className="flex flex-col gap-1 text-sm">
                      <span className="font-semibold text-foreground">{contact.name}</span>
                      {contact.jobPosition && (
                        <span className="text-xs text-muted-foreground">{contact.jobPosition}</span>
                      )}
                      {contact.email && (
                        <span className="text-xs text-muted-foreground" dir="ltr">{contact.email}</span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveContact(contact.id)}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="border border-dashed border-border/80 rounded-xl p-8 flex flex-col items-center justify-center text-center bg-muted/5 hover:bg-muted/10 transition-colors">
                <button
                  type="button"
                  onClick={handleAddContact}
                  className="text-primary hover:text-primary/80 font-semibold text-sm flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>إضافة جهة الاتصال</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: المبيعات والمشتريات (Screenshot 3) */}
          {activeTab === 'sales_purchases' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 py-2">
              {/* Right Column: المبيعات، معلومات مالية، المخزون */}
              <div className="flex flex-col gap-6">
                {/* section: المبيعات */}
                <div className="flex flex-col gap-3">
                  <h4 className="text-sm font-bold text-foreground border-b border-border/40 pb-1">المبيعات</h4>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                      مندوب المبيعات
                      <span className="text-xs text-muted-foreground font-mono" title="المسؤول عن المبيعات">?</span>
                    </label>
                    <div className="col-span-7">
                      <Input value={salesperson} onChange={(e) => setSalesperson(e.target.value)} placeholder="" className="h-8 text-sm rounded-lg" />
                    </div>
                  </div>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                      شروط السداد
                      <span className="text-xs text-muted-foreground font-mono" title="شروط سداد الفواتير">?</span>
                    </label>
                    <div className="col-span-7">
                      <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="" className="h-8 text-sm rounded-lg" />
                    </div>
                  </div>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                      طريقة الدفع
                      <span className="text-xs text-muted-foreground font-mono" title="طريقة دفع العميل">?</span>
                    </label>
                    <div className="col-span-7">
                      <Input value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="" className="h-8 text-sm rounded-lg" />
                    </div>
                  </div>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                      قائمة الأسعار
                      <span className="text-xs text-muted-foreground font-mono" title="قائمة أسعار المنتجات المعتمدة">?</span>
                    </label>
                    <div className="col-span-7">
                      <Input value={pricelist} onChange={(e) => setPricelist(e.target.value)} placeholder="افتراضي (YER)" className="h-8 text-sm rounded-lg" />
                    </div>
                  </div>
                </div>

                {/* section: معلومات مالية */}
                <div className="flex flex-col gap-3 border-t border-border/40 pt-4">
                  <h4 className="text-sm font-bold text-foreground border-b border-border/40 pb-1">معلومات مالية</h4>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                      الوضع المالي
                      <span className="text-xs text-muted-foreground font-mono" title="الوضع المالي لتحديد الضرائب والحسابات">?</span>
                    </label>
                    <div className="col-span-7">
                      <Input value={fiscalPosition} onChange={(e) => setFiscalPosition(e.target.value)} placeholder="مثال: Domestic" className="h-8 text-sm rounded-lg" />
                    </div>
                  </div>
                </div>

                {/* section: المخزون */}
                <div className="flex flex-col gap-3 border-t border-border/40 pt-4">
                  <h4 className="text-sm font-bold text-foreground border-b border-border/40 pb-1">المخزون</h4>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                      موقع العميل
                      <span className="text-xs text-muted-foreground font-mono" title="موقع مخزون العميل">?</span>
                    </label>
                    <div className="col-span-7">
                      <Input value={customerLocation} onChange={(e) => setCustomerLocation(e.target.value)} placeholder="Customers" className="h-8 text-sm rounded-lg" />
                    </div>
                  </div>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                      موقع المورد
                      <span className="text-xs text-muted-foreground font-mono" title="موقع مخزون المورد">?</span>
                    </label>
                    <div className="col-span-7">
                      <Input value={vendorLocation} onChange={(e) => setVendorLocation(e.target.value)} placeholder="Vendors" className="h-8 text-sm rounded-lg" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Left Column: الشراء، متنوعات */}
              <div className="flex flex-col gap-6">
                {/* section: الشراء */}
                <div className="flex flex-col gap-3">
                  <h4 className="text-sm font-bold text-foreground border-b border-border/40 pb-1">الشراء</h4>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                      Group RFQ
                      <span className="text-xs text-muted-foreground font-mono" title="تجميع طلبات عروض الأسعار">?</span>
                    </label>
                    <div className="col-span-7">
                      <Input value={groupRfq} onChange={(e) => setGroupRfq(e.target.value)} placeholder="On Order" className="h-8 text-sm rounded-lg" />
                    </div>
                  </div>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                      المشتري
                      <span className="text-xs text-muted-foreground font-mono" title="المسؤول عن المشتريات">?</span>
                    </label>
                    <div className="col-span-7">
                      <Input value={buyer} onChange={(e) => setBuyer(e.target.value)} placeholder="" className="h-8 text-sm rounded-lg" />
                    </div>
                  </div>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                      شروط السداد
                      <span className="text-xs text-muted-foreground font-mono" title="شروط سداد فواتير الشراء">?</span>
                    </label>
                    <div className="col-span-7">
                      <Input value={purchasePaymentTerms} onChange={(e) => setPurchasePaymentTerms(e.target.value)} placeholder="" className="h-8 text-sm rounded-lg" />
                    </div>
                  </div>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                      طريقة الدفع
                      <span className="text-xs text-muted-foreground font-mono" title="طريقة الدفع للمشتريات">?</span>
                    </label>
                    <div className="col-span-7">
                      <Input value={purchasePaymentMethod} onChange={(e) => setPurchasePaymentMethod(e.target.value)} placeholder="" className="h-8 text-sm rounded-lg" />
                    </div>
                  </div>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                      تذكير الإيصال
                      <span className="text-xs text-muted-foreground font-mono" title="إرسال تذكير بالإيصال">?</span>
                    </label>
                    <div className="col-span-7 flex items-center">
                      <input
                        type="checkbox"
                        checked={receiptReminder}
                        onChange={(e) => setReceiptReminder(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                      عملة المورد
                      <span className="text-xs text-muted-foreground font-mono" title="العملة المعتمدة للمورد">?</span>
                    </label>
                    <div className="col-span-7">
                      <Input value={vendorCurrency} onChange={(e) => setVendorCurrency(e.target.value)} placeholder="" className="h-8 text-sm rounded-lg" />
                    </div>
                  </div>
                </div>

                {/* section: متنوعات */}
                <div className="flex flex-col gap-3 border-t border-border/40 pt-4">
                  <h4 className="text-sm font-bold text-foreground border-b border-border/40 pb-1">متنوعات</h4>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                      معرّف الشركة
                      <span className="text-xs text-muted-foreground font-mono" title="معرّف الشركة في السجل">?</span>
                    </label>
                    <div className="col-span-7">
                      <Input value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="" className="h-8 text-sm rounded-lg" />
                    </div>
                  </div>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                      الرقم المرجعي
                      <span className="text-xs text-muted-foreground font-mono" title="الرمز المرجعي الداخلي">?</span>
                    </label>
                    <div className="col-span-7">
                      <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="" className="h-8 text-sm rounded-lg" />
                    </div>
                  </div>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                      مجال العمل
                      <span className="text-xs text-muted-foreground font-mono" title="قطاع أو مجال العمل">?</span>
                    </label>
                    <div className="col-span-7">
                      <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="" className="h-8 text-sm rounded-lg" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: المحاسبة (Screenshot 4) */}
          {activeTab === 'accounting' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 py-2">
              {/* Right Column: عام، فواتير العملاء */}
              <div className="flex flex-col gap-6">
                {/* section: عام */}
                <div className="flex flex-col gap-3">
                  <h4 className="text-sm font-bold text-foreground border-b border-border/40 pb-1">عام</h4>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                      البنوك
                      <span className="text-xs text-muted-foreground font-mono" title="الحسابات البنكية">?</span>
                    </label>
                    <div className="col-span-7">
                      <Input value={bankAccounts} onChange={(e) => setBankAccounts(e.target.value)} placeholder="" className="h-8 text-sm rounded-lg" />
                    </div>
                  </div>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                      حساب مدين
                      <span className="text-xs text-muted-foreground font-mono" title="حساب العملاء / المدينون">?</span>
                    </label>
                    <div className="col-span-7">
                      <Input value={accountReceivable} onChange={(e) => setAccountReceivable(e.target.value)} placeholder="Account Receivable 121000" className="h-8 text-sm rounded-lg" />
                    </div>
                  </div>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                      حساب الدائن
                      <span className="text-xs text-muted-foreground font-mono" title="حساب الموردين / الدائنون">?</span>
                    </label>
                    <div className="col-span-7">
                      <Input value={accountPayable} onChange={(e) => setAccountPayable(e.target.value)} placeholder="Account Payable 211000" className="h-8 text-sm rounded-lg" />
                    </div>
                  </div>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                      ترحيل فواتير المورّدين تلقائياً
                      <span className="text-xs text-muted-foreground font-mono" title="قاعدة ترحيل فواتير الشراء">?</span>
                    </label>
                    <div className="col-span-7">
                      <Input value={autoBillPosting} onChange={(e) => setAutoBillPosting(e.target.value)} placeholder="السؤال بعد 3 عمليات تصديق دون تعديلات" className="h-8 text-sm rounded-lg" />
                    </div>
                  </div>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                      تجاهل مبلغ الفاتورة غير المعتاد
                      <span className="text-xs text-muted-foreground font-mono" title="عدم التنبيه عند تغير مبلغ الفاتورة">?</span>
                    </label>
                    <div className="col-span-7 flex items-center">
                      <input
                        type="checkbox"
                        checked={ignoreUnusualBillAmount}
                        onChange={(e) => setIgnoreUnusualBillAmount(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                      تجاهل تاريخ الفاتورة غير المعتاد
                      <span className="text-xs text-muted-foreground font-mono" title="عدم التنبيه عند اختلاف تاريخ الفاتورة">?</span>
                    </label>
                    <div className="col-span-7 flex items-center">
                      <input
                        type="checkbox"
                        checked={ignoreUnusualBillDate}
                        onChange={(e) => setIgnoreUnusualBillDate(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* section: فواتير العملاء */}
                <div className="flex flex-col gap-3 border-t border-border/40 pt-4">
                  <h4 className="text-sm font-bold text-foreground border-b border-border/40 pb-1">فواتير العملاء</h4>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                      جاري إرسال الفاتورة
                      <span className="text-xs text-muted-foreground font-mono" title="طريقة إرسال الفواتير للعميل">?</span>
                    </label>
                    <div className="col-span-7">
                      <Input value={invoiceSendingMethod} onChange={(e) => setInvoiceSendingMethod(e.target.value)} placeholder="الفوترة الإلكترونية والبريد الإلكتروني" className="h-8 text-sm rounded-lg" />
                    </div>
                  </div>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                      تنسيق الفاتورة الإلكترونية
                      <span className="text-xs text-muted-foreground font-mono" title="تنسيق ملف الفاتورة">?</span>
                    </label>
                    <div className="col-span-7">
                      <Input value={electronicInvoiceFormat} onChange={(e) => setElectronicInvoiceFormat(e.target.value)} placeholder="تنسيق XML" className="h-8 text-sm rounded-lg" />
                    </div>
                  </div>
                  <div className="grid grid-cols-12 items-center gap-2">
                    <label className="col-span-5 text-sm font-medium text-foreground">
                      Peppol ID
                    </label>
                    <div className="col-span-7">
                      <Input value={peppolId} onChange={(e) => setPeppolId(e.target.value)} placeholder="Your endpoint" className="h-8 text-sm rounded-lg" dir="ltr" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Left Column: المتابعة بشأن الفواتير */}
              <div className="flex flex-col gap-3">
                <h4 className="text-sm font-bold text-foreground border-b border-border/40 pb-1">المتابعة بشأن الفواتير</h4>
                <div className="grid grid-cols-12 items-center gap-2">
                  <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                    حالة المتابعة
                    <span className="text-xs text-muted-foreground font-mono" title="حالة التحصيل والمتابعة">?</span>
                  </label>
                  <div className="col-span-7">
                    <span className="inline-block rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                      {followupStatus}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-12 items-center gap-2">
                  <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                    التذكيرات
                    <span className="text-xs text-muted-foreground font-mono" title="نوع التذكير">?</span>
                  </label>
                  <div className="col-span-7 flex items-center gap-4 text-sm">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="followup_reminder"
                        checked={followupReminderType === 'auto'}
                        onChange={() => setFollowupReminderType('auto')}
                        className="text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                      />
                      <span>تلقائي</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="followup_reminder"
                        checked={followupReminderType === 'manual'}
                        onChange={() => setFollowupReminderType('manual')}
                        className="text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                      />
                      <span>يدوي</span>
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-12 items-center gap-2">
                  <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                    التذكير التالي
                    <span className="text-xs text-muted-foreground font-mono" title="تاريخ التذكير القادم">?</span>
                  </label>
                  <div className="col-span-7 flex items-center gap-2">
                    <Input value={nextReminderDate} onChange={(e) => setNextReminderDate(e.target.value)} placeholder="التاريخ..." className="h-8 text-sm rounded-lg" />
                    <Button type="button" size="sm" variant="outline" className="h-8 px-3 text-xs gap-1 text-primary">
                      <Send className="h-3 w-3" />
                      <span>إرسال</span>
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-12 items-center gap-2">
                  <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                    المسؤول
                    <span className="text-xs text-muted-foreground font-mono" title="الموظف المسؤول عن المتابعة">?</span>
                  </label>
                  <div className="col-span-7">
                    <Input value={responsibleUser} onChange={(e) => setResponsibleUser(e.target.value)} placeholder="" className="h-8 text-sm rounded-lg" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: الملاحظات (Screenshot 5) */}
          {activeTab === 'notes' && (
            <div className="py-2">
              <Textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="...ملاحظات داخلية"
                className="min-h-[180px] text-sm rounded-xl border-border/60 bg-muted/5 focus:bg-background"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
