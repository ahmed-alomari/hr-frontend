'use client';

import * as React from 'react';
import Link from 'next/link';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { cn } from '@/shared/utils';
import type { ExpensesSettings } from '../domain/types';
import { LoadingBlock, Section, useRunCommand } from './common';
import { useExpensesData, useExpensesPermissions } from './expenses-provider';

export function SettingsPage() {
  const data = useExpensesData();
  const run = useRunCommand();
  const perms = useExpensesPermissions();
  if (!data) return <LoadingBlock />;
  const s = data.settings;
  const patch = (p: Partial<ExpensesSettings>) => {
    void run({ type: 'updateSettings', patch: p }, 'حُفظ الإعداد');
  };
  const disabled = !perms.settings;
  return (
    <div className="space-y-4">
      <SetPageTitle titleAr="الإعدادات" descriptionAr="إعدادات تطبيق المصروفات والعهد" iconName="Settings" />
      {disabled ? <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">للعرض فقط: تعديل الإعدادات يحتاج صلاحية exp.settings.update.</p> : null}

      <Section title="مستوى الواجهة" description="يغيّر الوظائف الظاهرة فقط — لا يغيّر الحسابات ولا يحذف بيانات.">
        <div className="grid gap-2 sm:grid-cols-2">
          {(['simple', 'advanced'] as const).map((mode) => (
            <button key={mode} type="button" disabled={disabled} onClick={() => patch({ mode })} className={cn('rounded-xl border p-3 text-start transition-colors', s.mode === mode ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted')}>
              <p className="text-sm font-semibold">{mode === 'simple' ? 'بسيط' : 'متقدم'}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{mode === 'simple' ? 'للأفراد والمنشآت الصغيرة: مصروفات وعهد وتقسيم وتسويات.' : 'يُظهر مراكز التكلفة وتوزيع التكلفة بالتفصيل.'}</p>
            </button>
          ))}
        </div>
      </Section>

      <Section title="الاعتماد والمرفقات والحدود" description="لكل مجموعة سياستها: من يعتمد وبأي طريقة، ومتى يلزم الإيصال، والحد الشهري. كل عملية بلا مجموعة تتبع المجموعة الافتراضية «عام».">
        <Link href="/expenses/setup?tab=groups" className="text-sm font-medium text-primary hover:underline">إدارة المجموعات وسياساتها</Link>
      </Section>
    </div>
  );
}
