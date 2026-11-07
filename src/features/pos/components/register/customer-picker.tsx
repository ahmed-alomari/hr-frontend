'use client';

import * as React from 'react';
import { Loader2, Search, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/shared/utils';
import { usePosContext } from '@/features/pos/hooks/use-pos-context';
import { createPosCustomer, usePosCustomerSearch, type PosCustomerOption } from '@/features/pos/lib/pos-customers-api';
import { formatMoney } from '@/features/pos/lib/format';

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/** What the customer owes (عليه) or is owed (له), in the company currency. */
export function BalanceBadge({ option, currency }: { option: PosCustomerOption; currency: string }) {
  const own = option.balances.find((b) => b.currencyCode === currency) ?? option.balances[0];
  const value = Number(own?.balance ?? 0);
  if (!own || Math.abs(value) < 0.005) return null;
  return (
    <span className={cn('text-xs tabular-nums', value > 0 ? 'text-warning' : 'text-success')}>
      {value > 0 ? 'عليه' : 'له'} {formatMoney(Math.abs(value), own.currencyCode)}
    </span>
  );
}

/**
 * A customer from contacts: search by name, phone or code, or add a new one
 * with a name and a phone (it becomes a contact of the company).
 */
export function ContactCustomerPicker({
  onPick,
  selectedId,
  autoFocus = true,
}: {
  onPick: (customer: PosCustomerOption) => void;
  selectedId?: string | null;
  autoFocus?: boolean;
}) {
  const { companyId, currency, can } = usePosContext();
  const [term, setTerm] = React.useState('');
  const debounced = useDebounced(term.trim(), 250);
  const search = usePosCustomerSearch(companyId, debounced);
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState('');
  const [mobile, setMobile] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const add = async () => {
    if (!companyId || !name.trim() || saving) return;
    setSaving(true);
    try {
      const created = await createPosCustomer(companyId, { name: name.trim(), mobile: mobile.trim() || null });
      toast.success('أُضيف العميل إلى جهات الاتصال');
      setAdding(false);
      setName('');
      setMobile('');
      onPick(created);
    } catch (error) {
      const message = (error as { message?: unknown } | null)?.message;
      toast.error(typeof message === 'string' && message ? message : 'تعذّر إضافة العميل');
    } finally {
      setSaving(false);
    }
  };

  if (adding) {
    return (
      <div className="space-y-2 rounded-lg border border-border p-3">
        <div className="text-sm font-medium">عميل جديد في جهات الاتصال</div>
        <Input autoFocus placeholder="الاسم" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="الجوال" dir="ltr" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} />
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setAdding(false)}>
            رجوع
          </Button>
          <Button className="flex-1" disabled={!name.trim() || saving} onClick={add}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            إضافة واختيار
          </Button>
        </div>
      </div>
    );
  }

  const results = search.data ?? [];
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus={autoFocus}
          className="ps-9"
          placeholder="ابحث بالاسم أو الجوال أو الرمز"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>
      <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
        {search.isLoading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : search.isError ? (
          <p className="p-3 text-center text-sm text-destructive">تعذّر البحث في جهات الاتصال.</p>
        ) : results.length === 0 ? (
          <p className="p-3 text-center text-sm text-muted-foreground">لا توجد نتائج.</p>
        ) : (
          <ul className="divide-y divide-border">
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onPick(c)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-muted/60',
                    selectedId === c.id && 'bg-primary/5',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{c.name}</span>
                    {c.phone ? (
                      <span className="block text-xs text-muted-foreground" dir="ltr">
                        {c.phone}
                      </span>
                    ) : null}
                  </span>
                  <BalanceBadge option={c} currency={currency} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {can('pos.sell') ? (
        <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
          <UserPlus className="h-4 w-4" />
          عميل جديد
        </Button>
      ) : null}
    </div>
  );
}
