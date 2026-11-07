'use client';

import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowRight, Paperclip, Pencil } from 'lucide-react';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Button } from '@/components/ui/button';
import { useExpensesStore } from '../data/store';
import { attachmentHref } from '../data/attachments';
import { expenseEffects } from '../domain/ledger';
import { ORG } from '../domain/types';
import type { AttachmentMeta, Expense } from '../domain/types';
import { expensesRoutes } from '../constants/routes';
import { EmptyState, KeyValue, LoadingBlock, Money, PartyName, Section, StatusBadge } from './common';
import { ExpenseFormDialog } from './expense-form-dialog';
import { useDirectory, useExpensesData, useExpensesPermissions } from './expenses-provider';
import { ApprovalTimeline } from './group-policy';
import { TxnActions } from './txn-actions';

function AttachmentLink({ meta }: { meta: AttachmentMeta }) {
  const open = () => {
    const href = attachmentHref(meta);
    if (!href) {
      toast.message('لا ملف لهذا المرفق (مثال في البيانات التجريبية)');
      return;
    }
    window.open(href, '_blank', 'noopener');
  };
  return (
    <button type="button" onClick={open} className="flex w-full items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-start text-xs hover:bg-muted">
      <Paperclip className="h-4 w-4 shrink-0" />
      <span className="truncate">{meta.name}</span>
      <span className="ms-auto shrink-0 text-muted-foreground">{Math.round(meta.size / 1024)} ك.ب</span>
    </button>
  );
}

export function ExpenseDetailPage({ id }: { id: string }) {
  const data = useExpensesData();
  const directory = useDirectory();
  const actorId = useExpensesStore((s) => s.actorId);
  const perms = useExpensesPermissions();
  const [editing, setEditing] = React.useState(false);
  if (!data) return <LoadingBlock />;
  const expense = data.expenses.find((e) => e.id === id) as Expense | undefined;
  if (!expense) return <EmptyState text="المصروف غير موجود" action={<Button asChild size="sm"><Link href={expensesRoutes.expenses}>المصروفات</Link></Button>} />;

  const category = data.categories.find((c) => c.id === expense.categoryId);
  const group = expense.groupId ? data.groups.find((g) => g.id === expense.groupId) : undefined;
  const center = (cid: string | null) => (cid ? data.costCenters.find((c) => c.id === cid) : undefined);
  const effects = expenseEffects(expense);
  const editable = (expense.status === 'draft' || expense.status === 'rejected') && expense.createdBy === actorId && perms.create;

  return (
    <div className="space-y-4">
      <SetPageTitle titleAr={expense.description} descriptionAr="تفاصيل المصروف وأثره" iconName="Receipt" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild><Link href={expensesRoutes.expenses}><ArrowRight className="me-1 h-4 w-4" />المصروفات</Link></Button>
        <div className="flex flex-wrap gap-1.5">
          {editable ? <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="me-1.5 h-4 w-4" />تعديل</Button> : null}
          <TxnActions txn={expense} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="البيانات" className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Money value={expense.amount} className="text-2xl font-bold" />
            <StatusBadge status={expense.status} />
          </div>
          <KeyValue label="التاريخ">{expense.date}</KeyValue>
          <KeyValue label="الفئة"><span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category?.color }} />{category?.name ?? '—'}</span></KeyValue>
          {group ? <KeyValue label="المجموعة">{group.name}</KeyValue> : null}
          <KeyValue label="سجّله"><PartyName id={expense.createdBy} /></KeyValue>
          {expense.note ? <KeyValue label="ملاحظة">{expense.note}</KeyValue> : null}
          {expense.decidedBy ? <KeyValue label={expense.status === 'rejected' ? 'رفضه' : 'اعتمده'}><PartyName id={expense.decidedBy} link={false} />{expense.decisionNote ? ` — ${expense.decisionNote}` : ''}</KeyValue> : null}
          {expense.status === 'void' ? <KeyValue label="أُلغي">{directory.nameOf(expense.voidedBy)} — {expense.voidReason}</KeyValue> : null}
          {expense.approval ? <div className="mt-3 border-t border-border pt-3"><ApprovalTimeline txn={expense} /></div> : null}
        </Section>

        <Section title="المرفقات">
          {expense.attachments.length === 0 ? <EmptyState text="لا مرفقات" /> : <div className="space-y-1.5">{expense.attachments.map((a) => <AttachmentLink key={a.id} meta={a} />)}</div>}
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="من دفع">
          {expense.payments.map((p, i) => (
            <KeyValue key={i} label={p.source === 'org' ? 'صندوق المنشأة' : p.source === 'custody' ? `عهدة ${directory.nameOf(p.payerId)}` : `من مال ${directory.nameOf(p.payerId)}`}>
              <Money value={p.amount} className="font-medium" />
            </KeyValue>
          ))}
        </Section>
        <Section title="على من التكلفة (التحميل)" description={expense.bearing.method === 'org' ? 'على المنشأة' : expense.bearing.method === 'equal' ? 'بالتساوي' : expense.bearing.method === 'percent' ? 'بالنسب' : 'بمبالغ'}>
          {expense.bearing.shares.map((s) => (
            <KeyValue key={s.partyId} label={s.partyId === ORG ? 'المنشأة' : directory.nameOf(s.partyId)}>
              <Money value={s.amount} className="font-medium" />{s.percent != null ? <span className="ms-1 text-xs text-muted-foreground">({s.percent}%)</span> : null}
            </KeyValue>
          ))}
        </Section>
        <Section title="توزيع التكلفة (تحليلي)" description="للتقارير فقط — لا ينشئ ديوناً">
          {expense.allocation.map((a, i) => (
            <KeyValue key={i} label={center(a.costCenterId) ? `${center(a.costCenterId)!.code} — ${center(a.costCenterId)!.name}` : 'بلا مركز تكلفة'}>
              <Money value={a.amount} className="font-medium" />
            </KeyValue>
          ))}
        </Section>
      </div>

      <Section title="الأثر على الأرصدة" description={expense.status === 'approved' ? 'مطبَّق' : expense.status === 'submitted' ? 'معلق: لا يؤثر إلا بعد الاعتماد (عدا الرصيد المتوقع للعهدة)' : 'غير مطبَّق'}>
        <ul className="space-y-1.5 text-sm">
          {effects.map((e, i) => (
            <li key={i}>
              {e.type === 'debt' ? (
                <><PartyName id={e.debtor} /> مدين لـ <PartyName id={e.creditor} />: <Money value={e.amount} className="font-semibold" /></>
              ) : e.type === 'custody' ? (
                <>رصيد العهدة: <Money value={e.amount} signed className="font-semibold" /></>
              ) : (
                <>صندوق المنشأة: <Money value={e.amount} signed className="font-semibold" /></>
              )}
            </li>
          ))}
          {effects.every((e) => e.type !== 'debt') ? <li className="text-muted-foreground">لا ينشئ ديوناً على أحد.</li> : null}
        </ul>
      </Section>

      <ExpenseFormDialog open={editing} onOpenChange={setEditing} editing={expense} />
    </div>
  );
}
