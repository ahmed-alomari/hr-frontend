'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Ban, Check, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ExpensesCommand } from '../data/commands';
import { useExpensesStore } from '../data/store';
import { canDecide, canVoid, currentDeciders } from '../domain/policy';
import type { AnyTxn } from '../domain/types';
import { ReasonDialog } from './common';
import { useDirectory, useExpensesData, useExpensesPermissions } from './expenses-provider';

/**
 * Whether the signed-in user decides this record now: its author never; a
 * manager or approver named on its path in their turn (no permission
 * needed); otherwise, with no one named, whoever holds exp.expenses.approve.
 */
export function mayDecideNow(actorId: string, txn: AnyTxn, canApprove: boolean): boolean {
  if (!canDecide(actorId, txn)) return false;
  return currentDeciders(txn) !== null || canApprove;
}

/**
 * Submit / approve / reject / void for any record. The buttons follow the
 * signed-in user's exp.* permissions and the approval rules; the server
 * checks both again on the operation.
 */
export function TxnActions({ txn, compact }: { txn: AnyTxn; compact?: boolean }) {
  const data = useExpensesData();
  const actorId = useExpensesStore((s) => s.actorId);
  const exec = useExpensesStore((s) => s.exec);
  const busy = useExpensesStore((s) => s.busy);
  const perms = useExpensesPermissions();
  const directory = useDirectory();
  const [dialog, setDialog] = React.useState<'reject' | 'void' | null>(null);
  if (!data || !actorId) return null;

  const attempt = async (command: ExpensesCommand, ok: string) => {
    try {
      await exec(command);
      toast.success(ok);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذر التنفيذ');
    }
  };
  const mayDecide = mayDecideNow(actorId, txn, perms.approve);
  const deciders = txn.status === 'submitted' ? currentDeciders(txn) : null;
  const size = compact ? 'sm' : 'default';
  const waitingFor =
    txn.createdBy === actorId
      ? 'لا تعتمد عملية سجّلتها'
      : deciders
        ? `بانتظار ${deciders.map((id) => directory.nameOf(id)).join(' أو ')}`
        : !perms.approve
          ? 'لا تملك صلاحية الاعتماد (exp.expenses.approve)'
          : 'بانتظار معتمِد آخر';

  return (
    <div className="flex flex-wrap gap-1.5">
      {(txn.status === 'draft' || txn.status === 'rejected') && txn.createdBy === actorId ? (
        <Button size={size} disabled={busy} onClick={() => void attempt({ type: 'submit', kind: txn.kind, id: txn.id }, 'أُرسلت')}>
          <Send className="me-1.5 h-4 w-4" />
          إرسال
        </Button>
      ) : null}
      {txn.status === 'submitted' ? (
        mayDecide ? (
          <>
            <Button
              size={size}
              disabled={busy}
              onClick={() => void attempt({ type: 'decide', kind: txn.kind, id: txn.id, decision: 'approved' }, 'اعتُمدت')}
            >
              <Check className="me-1.5 h-4 w-4" />
              اعتماد
            </Button>
            <Button size={size} variant="outline" disabled={busy} onClick={() => setDialog('reject')}>
              <X className="me-1.5 h-4 w-4" />
              رفض
            </Button>
          </>
        ) : (
          <span className="self-center text-xs text-muted-foreground">{waitingFor}</span>
        )
      ) : null}
      {canVoid(txn) && perms.void && txn.status === 'approved' ? (
        <Button size={size} variant="ghost" disabled={busy} className="text-destructive hover:text-destructive" onClick={() => setDialog('void')}>
          <Ban className="me-1.5 h-4 w-4" />
          إلغاء
        </Button>
      ) : null}
      <ReasonDialog
        open={dialog === 'reject'}
        onOpenChange={(o) => setDialog(o ? 'reject' : null)}
        title="رفض العملية"
        confirmLabel="رفض"
        destructive
        onConfirm={(reason) => {
          void attempt({ type: 'decide', kind: txn.kind, id: txn.id, decision: 'rejected', note: reason }, 'رُفضت');
          setDialog(null);
        }}
      />
      <ReasonDialog
        open={dialog === 'void'}
        onOpenChange={(o) => setDialog(o ? 'void' : null)}
        title="إلغاء العملية (تبقى في السجل وتخرج من الأرصدة)"
        confirmLabel="إلغاء العملية"
        destructive
        onConfirm={(reason) => {
          void attempt({ type: 'void', kind: txn.kind, id: txn.id, reason }, 'أُلغيت');
          setDialog(null);
        }}
      />
    </div>
  );
}
