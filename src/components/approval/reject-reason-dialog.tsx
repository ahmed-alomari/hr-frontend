'use client';

import * as React from 'react';
import { Loader2, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/shared/utils';
import {
  REJECT_REASON_MAX_LENGTH,
  REJECT_REASON_MIN_LENGTH,
  REJECT_REASON_SUGGESTIONS,
  hasRejectReasonSuggestion,
  isRejectReasonValid,
  toggleRejectReasonSuggestion,
  type RejectReasonKind,
} from './reject-reasons';

/** Clickable suggested reasons; a click adds the reason to the box or takes it out. */
export function RejectReasonSuggestions({
  kind,
  value,
  onChange,
  disabled,
}: {
  kind: RejectReasonKind;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">أسباب مقترحة (اضغط للإضافة)</p>
      <div className="flex flex-wrap gap-1.5">
        {REJECT_REASON_SUGGESTIONS[kind].map((suggestion) => {
          const active = hasRejectReasonSuggestion(value, suggestion);
          return (
            <button
              key={suggestion}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onChange(toggleRejectReasonSuggestion(value, suggestion))}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50',
                active
                  ? 'border-destructive/50 bg-destructive/10 text-destructive'
                  : 'border-border bg-background text-foreground hover:bg-muted',
              )}
            >
              {suggestion}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type RejectReasonDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: RejectReasonKind;
  /** e.g. «رفض طلب الإجازة» */
  title: string;
  /** Who and what is being rejected, shown under the title. */
  description?: React.ReactNode;
  /** Receives the trimmed reason. Throw to keep the dialog open. */
  onConfirm: (reason: string) => Promise<void>;
};

/**
 * Asks for the rejection reason before any request is rejected. The reason is
 * required (the server refuses a rejection without one) and goes to the
 * employee in the rejection notification.
 */
export function RejectReasonDialog({
  open,
  onOpenChange,
  kind,
  title,
  description,
  onConfirm,
}: RejectReasonDialogProps) {
  const [reason, setReason] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setReason('');
      setTouched(false);
      setSubmitting(false);
    }
  }, [open]);

  const valid = isRejectReasonValid(reason);
  const showError = touched && !valid;

  const submit = async () => {
    setTouched(true);
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
      onOpenChange(false);
    } catch {
      // The caller already showed the error; keep the reason for another try.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next); }}>
      <DialogContent dir="rtl" className="max-w-lg text-right">
        <DialogHeader className="text-right">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={description ? undefined : 'sr-only'}>
            {description ?? 'اكتب سبب الرفض'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <RejectReasonSuggestions kind={kind} value={reason} onChange={setReason} disabled={submitting} />

          <div className="space-y-1.5">
            <label htmlFor="reject-reason" className="text-xs font-medium text-foreground">
              سبب الرفض <span className="text-destructive">*</span>
            </label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setTouched(true)}
              rows={3}
              maxLength={REJECT_REASON_MAX_LENGTH}
              disabled={submitting}
              placeholder="اكتب السبب أو اختر من الأسباب المقترحة…"
              className={cn(showError && 'border-destructive')}
            />
            {showError ? (
              <p className="text-xs text-destructive">
                سبب الرفض مطلوب ({REJECT_REASON_MIN_LENGTH} أحرف على الأقل).
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">يصل السبب للموظف مع إشعار الرفض.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="h-9 gap-1.5"
            disabled={!valid || submitting}
            onClick={() => void submit()}
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
            {submitting ? 'جاري الرفض…' : 'تأكيد الرفض'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
