'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileText,
  FileSpreadsheet,
  Building2,
  Wallet,
  TrendingUp,
  MoreVertical,
  Upload,
  Plus,
  ArrowUpRight,
  Settings2,
  ChevronDown,
  Clock,
  Sparkles,
  ShoppingBag,
} from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { accountingRoutes } from '@/features/accounting/constants/routes';

interface JournalDashboardCard {
  id: string;
  title: string;
  type: 'sale' | 'purchase' | 'bank' | 'cash' | 'pos';
  accountCode?: string;
  currency: string;
  primaryActionLabel: string;
  primaryActionHref: string;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
  stats: {
    unpaidCount?: number;
    unpaidAmount?: number;
    unpaidLabel?: string;
    overdueCount?: number;
    overdueAmount?: number;
    balance?: number;
    lastSynced?: string;
  };
  colorTheme: string;
}

const DASHBOARD_JOURNALS: JournalDashboardCard[] = [
  {
    id: 'customer-invoices',
    title: 'فواتير العملاء',
    type: 'sale',
    currency: 'SAR',
    primaryActionLabel: 'فاتورة جديدة',
    primaryActionHref: accountingRoutes.customerNew,
    secondaryActionLabel: 'رفع الفواتير',
    secondaryActionHref: accountingRoutes.customers,
    stats: {
      unpaidCount: 3,
      unpaidAmount: 24500.0,
      unpaidLabel: '3 فواتير صالحة للدفع',
      overdueCount: 1,
      overdueAmount: 5200.0,
    },
    colorTheme: 'from-blue-600/10 to-transparent border-t-4 border-t-blue-500',
  },
  {
    id: 'vendor-bills',
    title: 'فواتير الموردين',
    type: 'purchase',
    currency: 'SAR',
    primaryActionLabel: 'فاتورة مورد جديدة',
    primaryActionHref: accountingRoutes.vendorNew,
    secondaryActionLabel: 'تحميل ملف',
    secondaryActionHref: accountingRoutes.vendors,
    stats: {
      unpaidCount: 2,
      unpaidAmount: 18350.0,
      unpaidLabel: '2 فواتير للمراجعة والتسديد',
      overdueCount: 0,
      overdueAmount: 0,
    },
    colorTheme: 'from-amber-600/10 to-transparent border-t-4 border-t-amber-500',
  },
  {
    id: 'bank-account',
    title: 'الحساب البنكي (الراجحي)',
    type: 'bank',
    accountCode: '101401',
    currency: 'SAR',
    primaryActionLabel: 'تسوية 4 عمليات',
    primaryActionHref: accountingRoutes.ledgers,
    secondaryActionLabel: 'كشف الحساب',
    secondaryActionHref: accountingRoutes.ledgers,
    stats: {
      balance: 142850.5,
      lastSynced: 'اليom، 10:30 ص',
    },
    colorTheme: 'from-teal-600/10 to-transparent border-t-4 border-t-teal-500',
  },
  {
    id: 'cash-fund',
    title: 'الخزينة النقدية الرئيسية',
    type: 'cash',
    accountCode: '101100',
    currency: 'SAR',
    primaryActionLabel: 'تسجيل دفعة نقدية',
    primaryActionHref: accountingRoutes.ledgers,
    stats: {
      balance: 12400.0,
      lastSynced: 'أمس',
    },
    colorTheme: 'from-emerald-600/10 to-transparent border-t-4 border-t-emerald-500',
  },
  {
    id: 'point-of-sale',
    title: 'مبيعات نقاط البيع (POS)',
    type: 'pos',
    currency: 'SAR',
    primaryActionLabel: 'عرض الجلسات',
    primaryActionHref: accountingRoutes.customerInvoices,
    stats: {
      unpaidCount: 12,
      unpaidAmount: 8930.0,
      unpaidLabel: '12 طلب اليوم',
    },
    colorTheme: 'from-purple-600/10 to-transparent border-t-4 border-t-purple-500',
  },
];

export function AccountingHomeClient() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-5 pb-8" dir="rtl">
      <SetPageTitle
        titleAr="لوحة المحاسبة العامة"
        descriptionAr="نظرة شاملة على دفاتر اليومية والحسابات البنكية والفواتير"
        iconName="LayoutDashboard"
      />

      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-background p-2 border border-border/50 shadow-xs">
        {/* Right side in RTL (Title & Settings) */}
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-foreground">لوحة البيانات المحاسبية</span>
          <Settings2 className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" />
        </div>

        {/* Action Quick Links */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs font-medium"
            onClick={() => router.push(accountingRoutes.customers)}
          >
            <FileText className="h-3.5 w-3.5 text-primary" />
            العملاء
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs font-medium"
            onClick={() => router.push(accountingRoutes.vendors)}
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-amber-600" />
            الموردين
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs font-medium"
            onClick={() => router.push(accountingRoutes.journals)}
          >
            <TrendingUp className="h-3.5 w-3.5 text-teal-600" />
            دفاتر اليومية
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs font-medium"
            onClick={() => router.push(accountingRoutes.chartOfAccounts)}
          >
            شجرة الحسابات
          </Button>
        </div>
      </div>

      {/* Overview Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {DASHBOARD_JOURNALS.map((journal) => (
          <div
            key={journal.id}
            className={`flex flex-col justify-between rounded-xl border border-border/70 bg-card p-5 shadow-xs transition-all hover:shadow-md ${journal.colorTheme}`}
          >
            {/* Card Header */}
            <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/60 text-foreground shrink-0 shadow-2xs">
                  {journal.type === 'sale' && <FileText className="h-5 w-5 text-blue-600" />}
                  {journal.type === 'purchase' && <FileSpreadsheet className="h-5 w-5 text-amber-600" />}
                  {journal.type === 'bank' && <Building2 className="h-5 w-5 text-teal-600" />}
                  {journal.type === 'cash' && <Wallet className="h-5 w-5 text-emerald-600" />}
                  {journal.type === 'pos' && <ShoppingBag className="h-5 w-5 text-purple-600" />}
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-base hover:text-primary transition-colors cursor-pointer">
                    {journal.title}
                  </h3>
                  {journal.accountCode && (
                    <span className="text-xs text-muted-foreground font-mono">
                      حساب: {journal.accountCode}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="p-1 rounded text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
                  title="خيارات إضافية"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Card Body / Stats */}
            <div className="py-4 flex flex-col gap-3 min-h-[90px] justify-center">
              {journal.stats.balance !== undefined ? (
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground font-medium">الرصيد في دفتر الأستاذ العام</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-2xl font-bold font-mono tracking-tight text-foreground" dir="ltr">
                      {journal.stats.balance.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">{journal.currency}</span>
                  </div>
                  {journal.stats.lastSynced && (
                    <span className="text-[11px] text-muted-foreground/80 mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      آخر تحديث: {journal.stats.lastSynced}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {journal.stats.unpaidLabel && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground text-xs">{journal.stats.unpaidLabel}</span>
                      <span className="font-bold font-mono text-foreground" dir="ltr">
                        {journal.stats.unpaidAmount?.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} {journal.currency}
                      </span>
                    </div>
                  )}

                  {journal.stats.overdueCount !== undefined && journal.stats.overdueCount > 0 && (
                    <div className="flex items-center justify-between text-sm text-destructive">
                      <span className="text-xs font-medium">متأخرة في السداد ({journal.stats.overdueCount})</span>
                      <span className="font-bold font-mono" dir="ltr">
                        {journal.stats.overdueAmount?.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} {journal.currency}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Card Footer / Actions */}
            <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-2">
              <Button
                type="button"
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-8 px-3 font-medium shadow-xs"
                onClick={() => router.push(journal.primaryActionHref)}
              >
                {journal.primaryActionLabel}
              </Button>

              {journal.secondaryActionLabel && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground text-xs h-8 px-2.5"
                  onClick={() => router.push(journal.secondaryActionHref || '#')}
                >
                  {journal.secondaryActionLabel}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
