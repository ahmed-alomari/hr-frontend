'use client';

import * as React from 'react';
import { FlaskConical, Rocket, SearchCheck, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  COMPANY_MODE_HINT,
  COMPANY_MODE_LABEL,
  COMPANY_MODES,
} from '@/features/system-owner/constants/company-status';
import { useSystemOwnerMutations } from '@/features/system-owner/hooks/use-system-owner';
import type {
  CompanyOperatingMode,
  SystemOwnerCompany,
} from '@/features/system-owner/lib/api/system-owner';
import { cn } from '@/shared/utils';

const MODE_ICON: Record<CompanyOperatingMode, LucideIcon> = {
  trial: FlaskConical,
  testing: SearchCheck,
  production: Rocket,
};

export function CompanyModeCard({ company }: { company: SystemOwnerCompany }) {
  const { setCompanyOperatingMode } = useSystemOwnerMutations();
  const [target, setTarget] = React.useState<CompanyOperatingMode | null>(null);
  const [typedCode, setTypedCode] = React.useState('');
  const current = company.operatingMode;
  const leavingProduction = current === 'production' && target !== null && target !== 'production';
  const code = company.code ?? '';
  const pending = setCompanyOperatingMode.isPending;

  const choose = (mode: CompanyOperatingMode) => {
    if (mode === current) return;
    setTypedCode('');
    setTarget(mode);
  };

  return (
    <section className="space-y-2 rounded-xl border border-border bg-card px-4 py-3">
      <div className="space-y-0.5">
        <h3 className="text-sm font-semibold">وضع الشركة</h3>
        <p className="text-xs text-muted-foreground">{COMPANY_MODE_HINT[current]}</p>
      </div>
      <div role="radiogroup" aria-label="وضع الشركة" className="grid grid-cols-3 gap-2">
        {COMPANY_MODES.map((mode) => {
          const Icon = MODE_ICON[mode];
          const selected = mode === current;
          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={pending}
              onClick={() => choose(mode)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs transition-colors',
                selected
                  ? mode === 'production'
                    ? 'border-gold bg-gold/10 font-semibold'
                    : 'border-primary bg-primary/10 font-semibold'
                  : 'border-border text-muted-foreground hover:bg-muted/40',
              )}
            >
              <Icon className="h-4 w-4" />
              {COMPANY_MODE_LABEL[mode]}
            </button>
          );
        })}
      </div>
      {company.operatingModeChangedAt ? (
        <p className="text-[11px] text-muted-foreground">
          آخر تغيير: {new Date(company.operatingModeChangedAt).toLocaleString('ar')}
          {company.operatingModeChangedBy ? ` — ${company.operatingModeChangedBy}` : ''}
        </p>
      ) : null}

      <Dialog open={target !== null} onOpenChange={(open) => (!open && !pending ? setTarget(null) : undefined)}>
        <DialogContent>
          {target ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  تغيير الوضع إلى «{COMPANY_MODE_LABEL[target]}» — {company.nameAr}
                </DialogTitle>
                <DialogDescription>
                  {target === 'production'
                    ? 'بعد الإنتاج لا تُحمَّل البيانات التجريبية ولا تُحذف، حتى لا تختلط بالبيانات الحقيقية. البيانات التأسيسية تبقى متاحة لأنها تكمل الناقص فقط.'
                    : leavingProduction
                      ? 'الشركة تعمل على بيانات حقيقية. الخروج من الإنتاج يفتح تحميل البيانات التجريبية وحذفها، وقد تختلط بالبيانات الحقيقية. اكتب رمز الشركة للتأكيد.'
                      : COMPANY_MODE_HINT[target]}
                </DialogDescription>
              </DialogHeader>
              {leavingProduction ? (
                <div className="space-y-1">
                  <Label htmlFor="mode-confirm-code">
                    رمز الشركة: <span dir="ltr">{code}</span>
                  </Label>
                  <Input
                    id="mode-confirm-code"
                    dir="ltr"
                    autoComplete="off"
                    value={typedCode}
                    onChange={(e) => setTypedCode(e.target.value)}
                  />
                </div>
              ) : null}
              <DialogFooter className="gap-2">
                <Button variant="outline" disabled={pending} onClick={() => setTarget(null)}>
                  إلغاء
                </Button>
                <Button
                  variant={leavingProduction ? 'destructive' : 'default'}
                  disabled={
                    pending ||
                    (leavingProduction && typedCode.trim().toLowerCase() !== code.toLowerCase())
                  }
                  onClick={() =>
                    setCompanyOperatingMode.mutate(
                      {
                        companyId: company.id,
                        mode: target,
                        confirmCode: leavingProduction ? typedCode.trim() : undefined,
                      },
                      { onSuccess: () => setTarget(null) },
                    )
                  }
                >
                  {pending ? 'جارٍ التغيير…' : 'تغيير الوضع'}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
