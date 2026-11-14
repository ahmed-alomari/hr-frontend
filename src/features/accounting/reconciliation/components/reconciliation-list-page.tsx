'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Settings2,
  ChevronDown,
  ChevronRight,
  Filter,
  X,
  Layers,
  Sparkles,
  CheckSquare,
  SlidersHorizontal,
} from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatAccountingAmount } from '@/features/accounting/_shared/lib/format-accounting-amount';
import { useReconciliationStore } from '@/features/accounting/reconciliation/lib/reconciliation-store';
import { accountingRoutes } from '@/features/accounting/constants/routes';

export function ReconciliationListPage() {
  const router = useRouter();
  const accountGroups = useReconciliationStore((state) => state.accountGroups);
  const autoReconcile = useReconciliationStore((state) => state.autoReconcile);

  const [search, setSearch] = React.useState('');
  const [hasRemainingFilter, setHasRemainingFilter] = React.useState(true);
  const [postedFilter, setPostedFilter] = React.useState(true);
  const [groupFilter, setGroupFilter] = React.useState(true);

  // Expanded tree nodes
  const [expandedAccounts, setExpandedAccounts] = React.useState<Record<string, boolean>>({
    '121000': true,
    '211000': false,
  });
  const [expandedPartners, setExpandedPartners] = React.useState<Record<string, boolean>>({
    ali: true,
    none: false,
  });

  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const toggleAccount = (accId: string) => {
    setExpandedAccounts((prev) => ({ ...prev, [accId]: !prev[accId] }));
  };

  const togglePartner = (partnerId: string) => {
    setExpandedPartners((prev) => ({ ...prev, [partnerId]: !prev[partnerId] }));
  };

  const toggleSelectAll = () => {
    // Flatten all item IDs
    const allIds = accountGroups.flatMap((ag) =>
      ag.partnerGroups.flatMap((pg) => pg.items.map((i) => i.id)),
    );
    if (selectedIds.length === allIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allIds);
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  // Grand totals calculation
  const { totalDebit, totalCredit, totalRemaining } = React.useMemo(() => {
    let d = 0;
    let c = 0;
    let r = 0;
    accountGroups.forEach((ag) => {
      d += ag.debitTotal;
      c += ag.creditTotal;
      r += ag.remainingTotal;
    });
    return { totalDebit: d, totalCredit: c, totalRemaining: r };
  }, [accountGroups]);

  return (
    <div className="flex flex-col gap-4 font-sans max-w-7xl mx-auto w-full" dir="rtl">
      <SetPageTitle
        titleAr="عناصر دفتر اليومية المُراد تسويتها"
        descriptionAr="مطابقة وتسوية الحركات المدينة والدائنة المفتوحة"
        iconName="CheckSquare"
      />

      {/* Top Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-background p-2 border border-border/40 shadow-xs">
        {/* Right side (Action Button & Title) */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            className="bg-[#714B67] hover:bg-[#5e3e56] text-white rounded px-4 h-8 text-xs font-medium shadow-xs gap-1.5"
            onClick={autoReconcile}
          >
            <Sparkles className="h-3.5 w-3.5" />
            التسوية التلقائية
          </Button>

          <div className="flex items-center gap-1.5 me-2">
            <span className="text-base font-bold text-foreground">
              عناصر دفتر اليومية المُراد تسويتها
            </span>
            <Settings2 className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" />
          </div>
        </div>

        {/* Center: Search with Badges */}
        <div className="flex items-center gap-2 flex-1 max-w-xl mx-auto">
          <div className="relative w-full flex items-center">
            <div className="relative flex-1 flex items-center">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث..."
                className="ps-8 pe-64 h-8 rounded text-xs bg-muted/20 border-border/60 focus:bg-background transition-colors"
              />
              <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />

              {/* Tag Filters inside search bar */}
              <div className="absolute end-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {hasRemainingFilter && (
                  <div className="flex items-center gap-1 bg-[#714B67]/15 text-[#714B67] dark:bg-[#714B67]/30 dark:text-purple-300 text-[11px] px-2 py-0.5 rounded border border-[#714B67]/30">
                    <Filter className="h-2.5 w-2.5 text-[#714B67]" />
                    <span>مع متبقي</span>
                    <button
                      type="button"
                      onClick={() => setHasRemainingFilter(false)}
                      className="hover:bg-black/10 rounded p-0.5"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                )}

                {postedFilter && (
                  <div className="flex items-center gap-1 bg-[#714B67]/15 text-[#714B67] dark:bg-[#714B67]/30 dark:text-purple-300 text-[11px] px-2 py-0.5 rounded border border-[#714B67]/30">
                    <Filter className="h-2.5 w-2.5 text-[#714B67]" />
                    <span>مُرحّل</span>
                    <button
                      type="button"
                      onClick={() => setPostedFilter(false)}
                      className="hover:bg-black/10 rounded p-0.5"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                )}

                {groupFilter && (
                  <div className="flex items-center gap-1 bg-teal-700/15 text-teal-800 dark:bg-teal-700/30 dark:text-teal-300 text-[11px] px-2 py-0.5 rounded border border-teal-700/30">
                    <Layers className="h-2.5 w-2.5 text-teal-800 dark:text-teal-300" />
                    <span>الحساب &gt; الشريك</span>
                    <button
                      type="button"
                      onClick={() => setGroupFilter(false)}
                      className="hover:bg-black/10 rounded p-0.5"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              className="px-2 py-1 text-muted-foreground hover:text-foreground"
              title="خيارات الفلترة"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Left Side: Pagination */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
          <span>1 / 1-1</span>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded p-0 text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Hierarchical Tree Table matching Screenshot */}
      <div className="border border-border/60 rounded-lg bg-background overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-muted-foreground font-semibold select-none">
                <th className="w-8 px-2 py-2.5 text-center">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground inline-block cursor-pointer hover:text-foreground" />
                </th>
                <th className="px-4 py-2.5 text-start font-bold text-foreground">التاريخ</th>
                <th className="px-4 py-2.5 text-start font-bold text-foreground">قيد اليومية</th>
                <th className="px-4 py-2.5 text-start font-bold text-foreground">بطاقة عنوان</th>
                <th className="px-4 py-2.5 text-end font-bold text-foreground">بالعملة</th>
                <th className="px-4 py-2.5 text-end font-bold text-foreground">المدين</th>
                <th className="px-4 py-2.5 text-end font-bold text-foreground">الدائن</th>
                <th className="px-4 py-2.5 text-center font-bold text-foreground">مطابقة</th>
                <th className="px-4 py-2.5 text-end font-bold text-foreground">المتبقي</th>
                <th className="w-10 px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-border/80 h-3.5 w-3.5 cursor-pointer accent-[#714B67]"
                  />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {accountGroups.map((accountGroup) => {
                const isAccExpanded = !!expandedAccounts[accountGroup.accountId];

                return (
                  <React.Fragment key={accountGroup.accountId}>
                    {/* Account Level Header Row */}
                    <tr
                      className="bg-muted/20 hover:bg-muted/30 cursor-pointer font-bold transition-colors select-none"
                      onClick={() => toggleAccount(accountGroup.accountId)}
                    >
                      <td className="px-2 py-2 text-center">
                        <ChevronDown
                          className={`h-4 w-4 inline-block text-muted-foreground transition-transform ${
                            isAccExpanded ? '' : '-rotate-90'
                          }`}
                        />
                      </td>
                      <td colSpan={3} className="px-4 py-2 text-start text-foreground">
                        <span className="text-[#008784] dark:text-[#2dd4bf] hover:underline">
                          {accountGroup.accountName}
                        </span>
                        <button
                          type="button"
                          className="ms-3 text-xs font-semibold text-[#008784] dark:text-[#2dd4bf] hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            autoReconcile();
                          }}
                        >
                          التسوية التلقائية
                        </button>
                      </td>
                      <td className="px-4 py-2 text-end font-mono">
                        {accountGroup.currencyTotal !== undefined
                          ? `${accountGroup.currencyTotal.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                            })} ريال`
                          : ''}
                      </td>
                      <td className="px-4 py-2 text-end font-mono">
                        {accountGroup.debitTotal.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}{' '}
                        ريال
                      </td>
                      <td className="px-4 py-2 text-end font-mono">
                        {accountGroup.creditTotal.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}{' '}
                        ريال
                      </td>
                      <td className="px-4 py-2 text-center"></td>
                      <td className="px-4 py-2 text-end font-mono font-bold">
                        {accountGroup.remainingTotal.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}{' '}
                        ريال
                      </td>
                      <td className="px-3 py-2 text-center"></td>
                    </tr>

                    {/* Partner Groups when Account is expanded */}
                    {isAccExpanded &&
                      accountGroup.partnerGroups.map((partnerGroup) => {
                        const isPartnerExpanded = !!expandedPartners[partnerGroup.partnerId];

                        return (
                          <React.Fragment key={partnerGroup.partnerId}>
                            {/* Partner Header Row */}
                            <tr
                              className="bg-muted/10 hover:bg-muted/20 cursor-pointer font-semibold transition-colors select-none"
                              onClick={() => togglePartner(partnerGroup.partnerId)}
                            >
                              <td className="px-2 py-2 text-center">
                                <ChevronDown
                                  className={`h-3.5 w-3.5 inline-block text-muted-foreground ms-2 transition-transform ${
                                    isPartnerExpanded ? '' : '-rotate-90'
                                  }`}
                                />
                              </td>
                              <td colSpan={3} className="px-4 py-2 text-start ps-8 text-foreground">
                                <span className="text-[#008784] dark:text-[#2dd4bf] hover:underline">
                                  {partnerGroup.partnerName}
                                </span>
                                <button
                                  type="button"
                                  className="ms-3 text-xs font-semibold text-[#008784] dark:text-[#2dd4bf] hover:underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    autoReconcile();
                                  }}
                                >
                                  التسوية التلقائية
                                </button>
                              </td>
                              <td className="px-4 py-2 text-end font-mono">
                                {partnerGroup.currencyTotal !== undefined
                                  ? `${partnerGroup.currencyTotal.toLocaleString('en-US', {
                                      minimumFractionDigits: 2,
                                    })} ريال`
                                  : ''}
                              </td>
                              <td className="px-4 py-2 text-end font-mono">
                                {partnerGroup.debitTotal.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                })}{' '}
                                ريال
                              </td>
                              <td className="px-4 py-2 text-end font-mono">
                                {partnerGroup.creditTotal.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                })}{' '}
                                ريال
                              </td>
                              <td className="px-4 py-2 text-center"></td>
                              <td className="px-4 py-2 text-end font-mono font-bold">
                                {partnerGroup.remainingTotal.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                })}{' '}
                                ريال
                              </td>
                              <td className="px-3 py-2 text-center"></td>
                            </tr>

                            {/* Detailed Item Rows when Partner is expanded */}
                            {isPartnerExpanded &&
                              partnerGroup.items.map((item) => {
                                const isSelected = selectedIds.includes(item.id);
                                return (
                                  <tr
                                    key={item.id}
                                    className={`hover:bg-muted/30 transition-colors ${
                                      isSelected ? 'bg-muted/40' : ''
                                    }`}
                                  >
                                    <td className="px-2 py-2 text-center"></td>

                                    {/* التاريخ */}
                                    <td className="px-4 py-2 whitespace-nowrap text-foreground ps-10">
                                      {item.date}
                                    </td>

                                    {/* قيد اليومية */}
                                    <td className="px-4 py-2 whitespace-nowrap font-mono text-xs">
                                      <span
                                        className="text-[#008784] dark:text-[#2dd4bf] hover:underline cursor-pointer"
                                        onClick={() =>
                                          router.push(accountingRoutes.journalEntries)
                                        }
                                      >
                                        {item.journalEntryName}
                                      </span>
                                    </td>

                                    {/* بطاقة عنوان */}
                                    <td className="px-4 py-2 whitespace-nowrap text-foreground">
                                      {item.label}
                                    </td>

                                    {/* بالعملة */}
                                    <td className="px-4 py-2 whitespace-nowrap text-end font-mono">
                                      {item.currencyAmount !== undefined
                                        ? `${item.currencyAmount.toLocaleString('en-US', {
                                            minimumFractionDigits: 2,
                                          })} ريال`
                                        : ''}
                                    </td>

                                    {/* المدين */}
                                    <td className="px-4 py-2 whitespace-nowrap text-end font-mono">
                                      {item.debit.toLocaleString('en-US', {
                                        minimumFractionDigits: 2,
                                      })}{' '}
                                      ريال
                                    </td>

                                    {/* الدائن */}
                                    <td className="px-4 py-2 whitespace-nowrap text-end font-mono">
                                      {item.credit.toLocaleString('en-US', {
                                        minimumFractionDigits: 2,
                                      })}{' '}
                                      ريال
                                    </td>

                                    {/* مطابقة */}
                                    <td className="px-4 py-2 text-center">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-6 text-[11px] px-2 text-[#008784] border-[#008784]/40 hover:bg-[#008784]/10"
                                      >
                                        مطابقة
                                      </Button>
                                    </td>

                                    {/* المتبقي */}
                                    <td className="px-4 py-2 whitespace-nowrap text-end font-mono font-medium">
                                      {item.remaining.toLocaleString('en-US', {
                                        minimumFractionDigits: 2,
                                      })}{' '}
                                      ريال
                                    </td>

                                    {/* Selection checkbox */}
                                    <td className="px-3 py-2 text-center">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleSelectOne(item.id)}
                                        className="rounded border-border/80 h-3.5 w-3.5 cursor-pointer accent-[#714B67]"
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                          </React.Fragment>
                        );
                      })}
                  </React.Fragment>
                );
              })}
            </tbody>

            {/* Grand Total Footer */}
            <tfoot>
              <tr className="border-t-2 border-border/80 bg-muted/20 font-bold text-foreground">
                <td colSpan={4} className="px-4 py-3 text-start">
                  المجموع العام
                </td>
                <td className="px-4 py-3 text-end font-mono">
                  {totalRemaining.toLocaleString('en-US', { minimumFractionDigits: 2 })} ...
                </td>
                <td className="px-4 py-3 text-end font-mono">
                  {totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })} ...
                </td>
                <td className="px-4 py-3 text-end font-mono">
                  {totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })} ...
                </td>
                <td className="px-4 py-3 text-center"></td>
                <td className="px-4 py-3 text-end font-mono font-bold">
                  {totalRemaining.toLocaleString('en-US', { minimumFractionDigits: 2 })} ...
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
