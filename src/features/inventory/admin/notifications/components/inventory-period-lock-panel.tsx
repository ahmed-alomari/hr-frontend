'use client';

import * as React from 'react';
import { Lock, LockOpen } from 'lucide-react';
import { toast } from 'sonner';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import type {
  InventoryCompanySettings,
  UpdateInventoryCompanySettingsDto,
} from '@/features/inventory/admin/notifications/lib/api/inventory-settings';
import { formatDateTime, formatDisplayDate } from '@/shared/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function yesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

type Pending = { kind: 'lock'; date: string } | { kind: 'open' };

export function InventoryPeriodLockPanel({
  settings,
  disabled,
  save,
}: {
  settings: InventoryCompanySettings;
  disabled: boolean;
  save: (patch: UpdateInventoryCompanySettingsDto) => Promise<unknown>;
}) {
  const lockDate = settings.periodLockDate ?? null;
  const [date, setDate] = React.useState(lockDate ?? '');
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [busy, setBusy] = React.useState(false);
  const maxDate = yesterdayIso();

  React.useEffect(() => {
    setDate(lockDate ?? '');
  }, [lockDate]);

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await save({ periodLockDate: pending.kind === 'lock' ? pending.date : null });
      toast.success(pending.kind === 'lock' ? `أُقفلت الفترة حتى ${formatDisplayDate(pending.date)}` : 'فُتحت الفترة');
      setPending(null);
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'settings.inventory.update');
      toast.error(displayMessage);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {lockDate ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 p-3 text-sm">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="space-y-0.5">
            <p className="font-medium">الفترة مقفلة حتى {formatDisplayDate(lockDate)} (شاملًا)</p>
            {settings.periodLockSetAt ? (
              <p className="text-xs text-muted-foreground">
                {settings.periodLockSetByName ? `بواسطة ${settings.periodLockSetByName} · ` : ''}
                {formatDateTime(settings.periodLockSetAt)}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 p-3 text-sm">
          <LockOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="font-medium">لا توجد فترة مقفلة: يُقبل أي تاريخ للمستندات.</p>
        </div>
      )}

      <ul className="list-disc space-y-0.5 ps-4 text-xs text-muted-foreground sm:text-sm">
        <li>لا يُرحَّل ولا يُنشأ مستند مخزون بتاريخ في الفترة المقفلة أو قبلها؛ تبقى أرقام تقاريرها ثابتة.</li>
        <li>البيع، واستلام التحويل، والتراجع عن مستند تُسجَّل بتاريخ اليوم، فلا تتأثر بالإقفال ولا تغيّر الفترة المقفلة.</li>
        <li>تاريخ الإقفال يكون قبل اليوم (بتوقيت الشركة). فتح الفترة يرجع كل شيء كما كان.</li>
      </ul>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="inventory-period-lock-date">إقفال حتى تاريخ</Label>
          <Input
            id="inventory-period-lock-date"
            type="date"
            className="w-44"
            max={maxDate}
            value={date}
            disabled={disabled}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <Button
          disabled={disabled || !date || date === lockDate || date > maxDate}
          onClick={() => setPending({ kind: 'lock', date })}
        >
          <Lock className="me-1.5 h-4 w-4" />
          إقفال
        </Button>
        {lockDate ? (
          <Button variant="outline" disabled={disabled} onClick={() => setPending({ kind: 'open' })}>
            <LockOpen className="me-1.5 h-4 w-4" />
            فتح الفترة
          </Button>
        ) : null}
      </div>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && !busy && setPending(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pending?.kind === 'open' ? 'فتح الفترة المقفلة' : 'إقفال فترة المخازن'}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {pending?.kind === 'lock' ? (
              <>
                لن يُقبل أي مستند مخزون بتاريخ <b className="text-foreground">{formatDisplayDate(pending.date)}</b> أو قبله،
                حتى يفتح المسؤول الفترة.
              </>
            ) : (
              <>ستُقبل المستندات بتواريخ قديمة مرة أخرى، وقد تتغير أرقام الفترات السابقة إن رُحّل فيها شيء.</>
            )}
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setPending(null)}>
              إلغاء
            </Button>
            <Button disabled={busy} onClick={() => void confirm()}>
              {pending?.kind === 'open' ? 'فتح الفترة' : 'تأكيد الإقفال'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
