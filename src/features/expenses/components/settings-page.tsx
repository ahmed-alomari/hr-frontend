'use client';

import * as React from 'react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { cn } from '@/shared/utils';
import type { ExpensesSettings } from '../domain/types';
import { LoadingBlock, PickList, Section, useRunCommand } from './common';
import { useDirectory, useExpensesData, useExpensesPermissions } from './expenses-provider';

export function SettingsPage() {
  const data = useExpensesData();
  const run = useRunCommand();
  const perms = useExpensesPermissions();
  const directory = useDirectory();
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

      <Section title="من يرى مصروفات الآخرين" description="يسري فوراً، ولا يغيّر الأرصدة ولا الحسابات.">
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            { value: 'own', title: 'كل موظف يرى عملياته فقط', hint: 'ما سجّله أو دفعه أو يتحمله أو ينتظر اعتماده، وعهده وسلفه.' },
            { value: 'all', title: 'الجميع يرون كل العمليات', hint: 'لمنشأة صغيرة لا تحتاج إلى خصوصية بين موظفيها.' },
          ] as const).map((o) => (
            <button key={o.value} type="button" disabled={disabled} onClick={() => patch({ visibility: o.value })} className={cn('rounded-xl border p-3 text-start transition-colors', s.visibility === o.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50', disabled && 'cursor-not-allowed opacity-70')}>
              <p className="text-sm font-semibold">{o.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{o.hint}</p>
            </button>
          ))}
        </div>
        {s.visibility === 'own' ? (
          <div className="mt-3 space-y-1.5">
            <p className="text-xs font-medium">موظفون يرون كل العمليات</p>
            <PickList
              options={directory.choices.filter((p) => p.userId).map((p) => ({ id: p.id, name: p.name }))}
              value={s.fullViewerIds}
              onChange={(fullViewerIds) => patch({ fullViewerIds })}
              placeholder="أضف موظفاً"
              disabled={disabled}
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">مدير النظام ومن يملك صلاحية التقارير (أمين الصندوق، والمعتمد، والمحاسب، والمراجع) يرون الكل دائماً.</p>
          </div>
        ) : null}
      </Section>
    </div>
  );
}
