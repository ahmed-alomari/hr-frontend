'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings2,
  Check,
  TrendingUp,
  ShoppingBag,
  Package,
  Layers,
  HelpCircle,
  Upload,
} from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MinimalDropdown } from '@/components/ui/shared-dialogs';
import { AmountInput } from '@/features/accounting/_shared/components/amount-input';
import { useCustomerProductsStore } from '@/features/accounting/customer-products/lib/customer-products-store';
import type { AccountingProduct, ProductType } from '@/features/accounting/domain/types/accounting-product';
import { formatNumber } from '@/shared/utils';

const PRODUCT_TYPE_OPTIONS = [
  { value: 'product', label: 'منتج قابل للتخزين (Storable Product)' },
  { value: 'service', label: 'خدمة (Service)' },
  { value: 'consu', label: 'استهلاكي (Consumable)' },
];

const INVOICING_POLICY_OPTIONS = [
  { value: 'order', label: 'الكميات المطلوبة' },
  { value: 'delivery', label: 'الكميات المسلّمة' },
];

interface CustomerProductFormPageProps {
  productId?: string;
}

export function CustomerProductFormPage({ productId }: CustomerProductFormPageProps) {
  const router = useRouter();
  const isNew = !productId || productId === 'new';

  const getProduct = useCustomerProductsStore((state) => state.getProduct);
  const saveProduct = useCustomerProductsStore((state) => state.saveProduct);

  const existingProduct = React.useMemo(() => {
    if (isNew) return null;
    return getProduct(productId);
  }, [isNew, productId, getProduct]);

  // Main Fields
  const [name, setName] = React.useState(existingProduct?.name || '');
  const [canBeSold, setCanBeSold] = React.useState(existingProduct?.canBeSold ?? true);
  const [canBePurchased, setCanBePurchased] = React.useState(existingProduct?.canBePurchased ?? true);
  const [type, setType] = React.useState<ProductType>(existingProduct?.type || 'product');
  const [invoicingPolicy, setInvoicingPolicy] = React.useState<'order' | 'delivery'>(existingProduct?.invoicingPolicy || 'order');
  const [uom, setUom] = React.useState(existingProduct?.uom || 'وحدة');
  const [purchaseUom, setPurchaseUom] = React.useState(existingProduct?.purchaseUom || 'وحدة');
  const [salesPrice, setSalesPrice] = React.useState<number>(existingProduct?.salesPrice || 0);
  const [customerTaxes, setCustomerTaxes] = React.useState(existingProduct?.customerTaxes?.join(', ') || '15%');
  const [cost, setCost] = React.useState<number>(existingProduct?.cost || 0);
  const [category, setCategory] = React.useState(existingProduct?.category || 'All / منتجات');
  const [internalReference, setInternalReference] = React.useState(existingProduct?.internalReference || '');
  const [barcode, setBarcode] = React.useState(existingProduct?.barcode || '');

  // Accounting Tab Fields
  const [incomeAccount, setIncomeAccount] = React.useState(existingProduct?.incomeAccount || '400000 إيرادات مبيعات المنتجات');
  const [expenseAccount, setExpenseAccount] = React.useState(existingProduct?.expenseAccount || '600000 تكلفة البضاعة المباعة');
  const [priceDifferenceAccount, setPriceDifferenceAccount] = React.useState(existingProduct?.priceDifferenceAccount || '');

  // Tabs: general | purchase | accounting
  const [activeTab, setActiveTab] = React.useState<'general' | 'accounting'>('general');
  const [savedSuccess, setSavedSuccess] = React.useState(false);

  const handleSave = () => {
    const id = existingProduct?.id || `prod-${Date.now()}`;

    const payload: AccountingProduct = {
      id,
      name: name.trim() || 'منتج جديد',
      canBeSold,
      canBePurchased,
      type,
      invoicingPolicy,
      uom,
      purchaseUom,
      salesPrice: Number(salesPrice) || 0,
      customerTaxes: customerTaxes ? customerTaxes.split(',').map((t) => t.trim()).filter(Boolean) : ['15%'],
      cost: Number(cost) || 0,
      category,
      internalReference,
      barcode,
      avatarColor: existingProduct?.avatarColor || '#3b82f6',
      incomeAccount,
      expenseAccount,
      priceDifferenceAccount,
      salesCount: existingProduct?.salesCount || 0,
      purchasesCount: existingProduct?.purchasesCount || 0,
      onHandQty: existingProduct?.onHandQty || 0,
    };

    saveProduct(payload);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);

    if (isNew) {
      router.push(`/accounting/customers/products/${id}`);
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-6xl mx-auto w-full" dir="rtl">
      <SetPageTitle
        titleAr={isNew ? 'منتج جديد' : `المنتجات / ${existingProduct?.name || 'منتج'}`}
        descriptionAr="بيانات المنتج والأسعار والحسابات المحاسبية"
        iconName="Package"
      />

      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/40 bg-background p-2 shadow-xs">
        {/* Breadcrumb Navigation on Right */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push('/accounting/customers/products')}
            className="text-primary hover:text-primary/80 font-medium px-2 h-8"
          >
            المنتجات
          </Button>
          <span className="text-muted-foreground/40">/</span>
          <div className="flex items-center gap-1.5 text-foreground font-semibold">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <span>{isNew ? 'جديد' : name}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-lg px-4 h-8 text-sm"
            onClick={() => router.push('/accounting/customers/products/new')}
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

      {/* Main Sheet */}
      <div className="rounded-xl border border-border/60 bg-card p-6 md:p-8 shadow-xs flex flex-col gap-6 relative">
        {/* Smart Stat Buttons Header */}
        <div className="flex items-center justify-start gap-2 border-b border-border/40 pb-4">
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
            <TrendingUp className="h-4 w-4 text-primary" />
            <div className="flex flex-col text-start">
              <span>المبيعات</span>
              <span className="font-bold text-foreground font-mono">
                {formatNumber(existingProduct?.salesCount ?? 0)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
            <ShoppingBag className="h-4 w-4 text-amber-600" />
            <div className="flex flex-col text-start">
              <span>المشتريات</span>
              <span className="font-bold text-foreground font-mono">
                {formatNumber(existingProduct?.purchasesCount ?? 0)}
              </span>
            </div>
          </div>

          {type === 'product' && (
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
              <Package className="h-4 w-4 text-emerald-600" />
              <div className="flex flex-col text-start">
                <span>الكمية في اليد</span>
                <span className="font-bold text-foreground font-mono">
                  {formatNumber(existingProduct?.onHandQty ?? 0)} {uom}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Product Header Name & Avatar */}
        <div className="flex items-start gap-4">
          <div
            className="h-20 w-20 rounded-xl flex items-center justify-center text-white font-bold text-3xl shadow-sm shrink-0"
            style={{ backgroundColor: existingProduct?.avatarColor || '#3b82f6' }}
          >
            {name.trim().charAt(0) || 'م'}
          </div>

          <div className="flex-1 flex flex-col gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: أجهزة نقاط البيع الذكية"
              className="text-2xl font-bold h-12 rounded-lg border-border/80"
            />

            {/* Checkboxes: يمكن بيعه / يمكن شراؤه */}
            <div className="flex items-center gap-6 text-sm pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canBeSold}
                  onChange={(e) => setCanBeSold(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                />
                <span className="font-medium text-foreground">يمكن بيعه</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canBePurchased}
                  onChange={(e) => setCanBePurchased(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                />
                <span className="font-medium text-foreground">يمكن شراؤه</span>
              </label>
            </div>
          </div>
        </div>

        {/* Tabs: معلومات عامة | المحاسبة */}
        <div className="flex flex-col gap-4 border-t border-border/40 pt-4 mt-2">
          <div className="flex items-center gap-2 border-b border-border/60">
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`pb-2.5 px-4 text-sm font-semibold transition-all border-b-2 ${
                activeTab === 'general' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              معلومات عامة
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('accounting')}
              className={`pb-2.5 px-4 text-sm font-semibold transition-all border-b-2 ${
                activeTab === 'accounting' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              المحاسبة
            </button>
          </div>

          {/* TAB 1: معلومات عامة */}
          {activeTab === 'general' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-5 py-2">
              {/* Right Column: نوع المنتج، سياسة الفوترة، وحدات القياس */}
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-12 items-center gap-2">
                  <label className="col-span-4 text-sm font-medium text-foreground flex items-center gap-1">
                    نوع المنتج
                    <span className="text-xs text-muted-foreground font-mono" title="نوع الصنف في النظام">?</span>
                  </label>
                  <div className="col-span-8">
                    <MinimalDropdown
                      value={type}
                      onChange={(next) => setType(next as ProductType)}
                      options={PRODUCT_TYPE_OPTIONS}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-12 items-center gap-2">
                  <label className="col-span-4 text-sm font-medium text-foreground flex items-center gap-1">
                    سياسة الفوترة
                    <span className="text-xs text-muted-foreground font-mono" title="الفوترة بناءً على الكميات المطلوبة أو المسلّمة">?</span>
                  </label>
                  <div className="col-span-8">
                    <MinimalDropdown
                      value={invoicingPolicy}
                      onChange={(next) => setInvoicingPolicy(next as 'order' | 'delivery')}
                      options={INVOICING_POLICY_OPTIONS}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-12 items-center gap-2">
                  <label className="col-span-4 text-sm font-medium text-foreground">وحدة القياس</label>
                  <div className="col-span-8">
                    <Input value={uom} onChange={(e) => setUom(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-12 items-center gap-2">
                  <label className="col-span-4 text-sm font-medium text-foreground">وحدة قياس الشراء</label>
                  <div className="col-span-8">
                    <Input value={purchaseUom} onChange={(e) => setPurchaseUom(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* Left Column: الأسعار، التكلفة، الضرائب، الفئات */}
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-12 items-center gap-2">
                  <label className="col-span-4 text-sm font-medium text-foreground">سعر البيع</label>
                  <div className="col-span-8 flex items-center gap-2">
                    <AmountInput
                      value={salesPrice}
                      onChange={setSalesPrice}
                      className="h-9 font-bold font-mono text-start flex-1"
                    />
                    <span className="text-xs font-mono font-bold text-muted-foreground">SAR</span>
                  </div>
                </div>

                <div className="grid grid-cols-12 items-center gap-2">
                  <label className="col-span-4 text-sm font-medium text-foreground">ضرائب العملاء</label>
                  <div className="col-span-8">
                    <Input
                      value={customerTaxes}
                      onChange={(e) => setCustomerTaxes(e.target.value)}
                      placeholder="15%"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-12 items-center gap-2">
                  <label className="col-span-4 text-sm font-medium text-foreground">التكلفة</label>
                  <div className="col-span-8 flex items-center gap-2">
                    <AmountInput
                      value={cost}
                      onChange={setCost}
                      className="h-9 font-mono text-start flex-1"
                    />
                    <span className="text-xs font-mono text-muted-foreground">SAR</span>
                  </div>
                </div>

                <div className="grid grid-cols-12 items-center gap-2">
                  <label className="col-span-4 text-sm font-medium text-foreground">فئة المنتج</label>
                  <div className="col-span-8">
                    <Input value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-12 items-center gap-2">
                  <label className="col-span-4 text-sm font-medium text-foreground">المرجع الداخلي</label>
                  <div className="col-span-8">
                    <Input value={internalReference} onChange={(e) => setInternalReference(e.target.value)} className="h-9 text-sm font-mono" dir="ltr" />
                  </div>
                </div>

                <div className="grid grid-cols-12 items-center gap-2">
                  <label className="col-span-4 text-sm font-medium text-foreground">الباركود</label>
                  <div className="col-span-8">
                    <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="h-9 text-sm font-mono" dir="ltr" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: المحاسبة */}
          {activeTab === 'accounting' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-5 py-2">
              <div className="flex flex-col gap-4">
                <h4 className="text-sm font-bold text-foreground border-b border-border/40 pb-1">
                  المستحقات وحسابات الدخل
                </h4>
                <div className="grid grid-cols-12 items-center gap-2">
                  <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                    حساب الدخل
                    <span className="text-xs text-muted-foreground font-mono" title="الحساب المستخدم لتسجيل إيرادات هذا المنتج">?</span>
                  </label>
                  <div className="col-span-7">
                    <Input value={incomeAccount} onChange={(e) => setIncomeAccount(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <h4 className="text-sm font-bold text-foreground border-b border-border/40 pb-1">
                  الالتزامات وحسابات المصروف
                </h4>
                <div className="grid grid-cols-12 items-center gap-2">
                  <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                    حساب المصروفات
                    <span className="text-xs text-muted-foreground font-mono" title="الحساب المستخدم لتسجيل تكلفة ومصروفات المنتج">?</span>
                  </label>
                  <div className="col-span-7">
                    <Input value={expenseAccount} onChange={(e) => setExpenseAccount(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-12 items-center gap-2">
                  <label className="col-span-5 text-sm font-medium text-foreground flex items-center gap-1">
                    حساب فرق السعر
                    <span className="text-xs text-muted-foreground font-mono" title="لتسجيل فروقات أسعار التكلفة والمخزون">?</span>
                  </label>
                  <div className="col-span-7">
                    <Input value={priceDifferenceAccount} onChange={(e) => setPriceDifferenceAccount(e.target.value)} placeholder="" className="h-9 text-sm" />
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
