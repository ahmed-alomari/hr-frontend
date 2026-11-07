'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Settings2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Filter,
  X,
  Plus,
  SlidersHorizontal,
  Clock,
  LayoutList,
  LayoutGrid,
} from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { accountingRoutes } from '@/features/accounting/constants/routes';
import { useJournalEntriesStore } from '@/features/accounting/journal-entries/lib/journal-entries-store';

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  if (dateStr.includes('سبتمبر')) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const day = parseInt(parts[2], 10);
    const monthsArabic: { [key: number]: string } = {
      1: 'يناير',
      2: 'فبراير',
      3: 'مارس',
      4: 'أبريل',
      5: 'مايو',
      6: 'يونيو',
      7: 'يوليو',
      8: 'أغسطس',
      9: 'سبتمبر',
      10: 'أكتوبر',
      11: 'نوفمبر',
      12: 'ديسمبر',
    };
    const month = parseInt(parts[1], 10);
    return `${day} ${monthsArabic[month] || parts[1]}`;
  }
  return dateStr;
}

export function JournalEntriesListPage() {
  const router = useRouter();
  const entries = useJournalEntriesStore((state) => state.entries);
  const [search, setSearch] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [postedFilter, setPostedFilter] = React.useState(true);

  const filtered = React.useMemo(() => {
    let list = entries;
    if (postedFilter) {
      list = list.filter((e) => e.state === 'posted');
    }
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter((item) => {
      return (
        item.name.toLowerCase().includes(term) ||
        (item.partnerName && item.partnerName.toLowerCase().includes(term)) ||
        item.journalName.toLowerCase().includes(term) ||
        (item.reference && item.reference.toLowerCase().includes(term)) ||
        (item.date && item.date.toLowerCase().includes(term))
      );
    });
  }, [entries, postedFilter, search]);

  // Calculate sum of totals
  const totalSum = React.useMemo(() => {
    return filtered.reduce((acc, curr) => acc + curr.total, 0);
  }, [filtered]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((i) => i.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleRowClick = (id: string, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('input[type="checkbox"]')) return;
    router.push(`${accountingRoutes.journalEntries}/${id}`);
  };

  return (
    <div className="flex flex-col gap-4 font-sans" dir="rtl">
      <SetPageTitle
        titleAr="قيود اليومية"
        descriptionAr="إدارة وعرض وترحيل قيود اليومية المحاسبية"
        iconName="ListOrdered"
      />

      {/* Top Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-background p-2 border border-border/40 shadow-xs">
        {/* Right side (Action & Title) */}
        <div className="flex items-center gap-2 order-1 md:order-1">
          <Button
            type="button"
            className="bg-[#714B67] hover:bg-[#5e3e56] text-white rounded px-4 h-8 text-sm font-medium shadow-xs"
            onClick={() => router.push(`${accountingRoutes.journalEntries}/new`)}
          >
            جديد
          </Button>
          <div className="flex items-center gap-1.5 me-2">
            <span className="text-base font-bold text-foreground">قيود اليومية</span>
            <Settings2 className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" />
          </div>
        </div>

        {/* Center: Search & Filter Tag Bar */}
        <div className="flex items-center gap-2 flex-1 max-w-lg mx-auto order-3 md:order-2">
          <div className="relative w-full flex items-center">
            <div className="relative flex-1 flex items-center">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث..."
                className={`ps-8 h-8 rounded text-sm bg-muted/20 border-border/60 focus:bg-background transition-colors ${
                  postedFilter ? 'pe-24' : 'pe-8'
                }`}
              />
              <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />

              {/* Tag 'مُرحّل' */}
              {postedFilter && (
                <div className="absolute end-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-[#714B67]/15 text-[#714B67] dark:bg-[#714B67]/30 dark:text-purple-300 text-xs px-2 py-0.5 rounded border border-[#714B67]/30">
                  <Filter className="h-3 w-3 text-[#714B67] dark:text-purple-300" />
                  <span className="font-semibold">مُرحّل</span>
                  <button
                    type="button"
                    onClick={() => setPostedFilter(false)}
                    className="hover:bg-black/10 rounded p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              className="px-2 py-1 text-muted-foreground hover:text-foreground"
              title="خيارات البحث والفلترة"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Left Side: Pagination & View Switcher */}
        <div className="flex items-center gap-3 order-2 md:order-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
            <span>{filtered.length} / 1-{filtered.length}</span>
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded p-0 text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded p-0 text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center border-s ps-2 gap-1 text-muted-foreground">
            <button
              type="button"
              className="p-1 rounded bg-muted/60 text-foreground"
              title="عرض القائمة"
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="p-1 rounded hover:bg-muted/40"
              title="عرض كانبان"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="p-1 rounded hover:bg-muted/40"
              title="عرض الأنشطة"
            >
              <Clock className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="border border-border/60 rounded-lg bg-background overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-start border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30 text-muted-foreground text-xs font-semibold select-none">
                <th className="w-10 px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.length === filtered.length}
                    onChange={toggleSelectAll}
                    className="rounded border-border/80 h-3.5 w-3.5 cursor-pointer accent-[#714B67]"
                  />
                </th>
                <th className="px-4 py-2.5 text-start font-bold text-foreground">التاريخ</th>
                <th className="px-4 py-2.5 text-start font-bold text-foreground">عدد</th>
                <th className="px-4 py-2.5 text-start font-bold text-foreground">الشريك</th>
                <th className="px-4 py-2.5 text-start font-bold text-foreground">الرقم المرجعي</th>
                <th className="px-4 py-2.5 text-start font-bold text-foreground">دفتر اليومية</th>
                <th className="px-4 py-2.5 text-end font-bold text-foreground">الإجمالي</th>
                <th className="px-4 py-2.5 text-center font-bold text-foreground">الحالة</th>
                <th className="w-8 px-2 py-2.5 text-center">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground inline-block cursor-pointer hover:text-foreground" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-muted-foreground text-sm">
                    لا توجد قيود يومية مطابقة للبحث
                  </td>
                </tr>
              ) : (
                filtered.map((entry) => {
                  const isSelected = selectedIds.includes(entry.id);
                  return (
                    <tr
                      key={entry.id}
                      onClick={(e) => handleRowClick(entry.id, e)}
                      className={`hover:bg-muted/30 cursor-pointer transition-colors ${
                        isSelected ? 'bg-muted/40' : ''
                      }`}
                    >
                      <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(entry.id)}
                          className="rounded border-border/80 h-3.5 w-3.5 cursor-pointer accent-[#714B67]"
                        />
                      </td>

                      {/* التاريخ */}
                      <td className="px-4 py-2.5 whitespace-nowrap text-foreground">
                        {formatDateDisplay(entry.date)}
                      </td>

                      {/* عدد / الرقم */}
                      <td className="px-4 py-2.5 whitespace-nowrap font-medium text-foreground font-mono text-xs">
                        {entry.name}
                      </td>

                      {/* الشريك */}
                      <td className="px-4 py-2.5 whitespace-nowrap text-foreground">
                        {entry.partnerName || ''}
                      </td>

                      {/* الرقم المرجعي */}
                      <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground text-xs font-mono">
                        {entry.reference || ''}
                      </td>

                      {/* دفتر اليومية */}
                      <td className="px-4 py-2.5 whitespace-nowrap text-foreground">
                        {entry.journalName}
                      </td>

                      {/* الإجمالي */}
                      <td className="px-4 py-2.5 whitespace-nowrap text-end font-semibold text-foreground">
                        {entry.total.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        <span className="text-xs font-normal text-muted-foreground">ريال</span>
                      </td>

                      {/* الحالة */}
                      <td className="px-4 py-2.5 whitespace-nowrap text-center">
                        {entry.state === 'posted' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#10b981]/15 text-[#059669] border border-[#10b981]/30">
                            مُرحّل
                          </span>
                        ) : entry.state === 'draft' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            مسودة
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30">
                            ملغى
                          </span>
                        )}
                      </td>

                      <td className="px-2 py-2.5 text-center"></td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Table Footer with Total Sum Matching Screenshot */}
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border/80 bg-muted/10 font-bold text-foreground">
                  <td colSpan={6} className="px-4 py-3 text-start">
                    المجموع
                  </td>
                  <td className="px-4 py-3 text-end font-bold text-foreground">
                    {totalSum.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    <span className="text-xs font-normal text-muted-foreground">ريال</span>
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
