'use client';

import * as React from 'react';
import {
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useOrderAttachmentMutations } from '@/features/ecommerce/admin/orders/hooks/use-orders';
import { useCan } from '@/features/auth/hooks/use-can';
import {
  MAX_ORDER_ATTACHMENTS,
  MAX_ORDER_ATTACHMENT_BYTES,
  ORDER_ATTACHMENT_ACCEPT,
  OrderAttachmentError,
  fileToOrderAttachment,
  formatAttachmentSize,
  isImageMime,
} from '@/features/ecommerce/domain/lib/order-attachments';
import type { Order } from '@/features/ecommerce/domain/types/order';
import { cn, formatDisplayDateTime } from '@/shared/utils';
import { resolveUploadUrl } from '@/shared/resolve-upload-url';

const ORDERS_UPDATE_PERMISSION = 'sta.orders.update';

type VisibilityFilter = 'all' | 'visible' | 'hidden';

function formatDateTime(iso: string) {
  return formatDisplayDateTime(iso);
}

export function OrderAttachmentsPanel({
  order,
  companyId,
}: {
  order: Order;
  companyId: string;
}) {
  const can = useCan();
  const canManage = can(ORDERS_UPDATE_PERMISSION);
  const { add, update, remove } = useOrderAttachmentMutations(companyId);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [addAsInternal, setAddAsInternal] = React.useState(false);
  const [filter, setFilter] = React.useState<VisibilityFilter>('all');

  const attachments = order.attachments ?? [];
  const hiddenCount = attachments.filter((item) => !item.visibleToCustomer).length;
  const busy = add.isPending || update.isPending || remove.isPending;
  const atLimit = attachments.length >= MAX_ORDER_ATTACHMENTS;

  const filtered = attachments.filter((item) => {
    if (filter === 'visible') return item.visibleToCustomer;
    if (filter === 'hidden') return !item.visibleToCustomer;
    return true;
  });

  async function handlePick(files: File[]) {
    const remaining = MAX_ORDER_ATTACHMENTS - attachments.length;
    if (remaining <= 0) {
      toast.error(`الحد الأقصى ${MAX_ORDER_ATTACHMENTS} مرفقات لكل طلب`);
      return;
    }
    const selected = files.slice(0, remaining);
    if (files.length > remaining) {
      toast.error(`تم تجاوز الحد — سيُرفع ${remaining} فقط`);
    }
    for (const file of selected) {
      if (file.size > MAX_ORDER_ATTACHMENT_BYTES) {
        toast.error(`${file.name}: حجم الملف كبير جداً`);
        continue;
      }
      try {
        const input = await fileToOrderAttachment(order.companyId, file);
        await add.mutateAsync({
          orderId: order.id,
          input: { ...input, visibleToCustomer: !addAsInternal },
        });
      } catch (error) {
        toast.error(
          error instanceof OrderAttachmentError ? error.message : `تعذر رفع ${file.name}`,
        );
      }
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">مرفقات الطلب</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
            {attachments.length}
          </span>
          {hiddenCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
              <EyeOff className="h-3 w-3" />
              {hiddenCount} داخلي
            </span>
          ) : null}
        </div>
        {canManage ? (
          <div className="flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={addAsInternal}
                onChange={(event) => setAddAsInternal(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-border accent-primary"
              />
              رفع كمرفق داخلي
            </label>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ORDER_ATTACHMENT_ACCEPT}
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = '';
                if (files.length === 0) return;
                void handlePick(files);
              }}
            />
            <button
              type="button"
              disabled={busy || atLimit}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {add.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              إضافة مرفق
            </button>
          </div>
        ) : null}
      </div>

      {hiddenCount > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {(
            [
              { value: 'all', label: 'الكل' },
              { value: 'visible', label: 'المرئية للعميل' },
              { value: 'hidden', label: 'الداخلية' },
            ] as const
          ).map((pill) => (
            <button
              key={pill.value}
              type="button"
              onClick={() => setFilter(pill.value)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                filter === pill.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground',
              )}
            >
              {pill.label}
            </button>
          ))}
        </div>
      ) : null}

      {atLimit ? (
        <p className="mb-2 text-[11px] text-amber-600 dark:text-amber-400">
          تم بلوغ الحد الأقصى ({MAX_ORDER_ATTACHMENTS}) للمرفقات.
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {attachments.length === 0 ? 'لا توجد مرفقات على هذا الطلب.' : 'لا توجد مرفقات مطابقة.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((attachment) => {
            const size = formatAttachmentSize(attachment.sizeBytes);
            const isImage = isImageMime(attachment.mimeType);
            const isStaff = attachment.uploadedBy && attachment.uploadedBy !== 'storefront';
            const isHidden = !attachment.visibleToCustomer;
            return (
              <li
                key={attachment.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-2.5 py-2',
                  isHidden ? 'border-amber-500/30 bg-amber-500/[0.04]' : 'border-border/70 bg-card',
                )}
              >
                <a
                  href={resolveUploadUrl(attachment.fileUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0"
                  title="فتح المرفق"
                >
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- data URLs + arbitrary hosts
                    <img
                      src={resolveUploadUrl(attachment.fileUrl)}
                      alt=""
                      className="h-12 w-12 rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                      <FileText className="h-5 w-5" />
                    </span>
                  )}
                </a>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground" dir="auto">
                    {attachment.label || attachment.fileName}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 font-medium',
                        isStaff
                          ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300'
                          : 'bg-teal-500/10 text-teal-700 dark:text-teal-300',
                      )}
                    >
                      {isStaff ? 'الموظف' : 'العميل'}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium',
                        isHidden
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                      )}
                    >
                      {isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {isHidden ? 'داخلي' : 'مرئي للعميل'}
                    </span>
                    {size ? <span className="tabular-nums">{size}</span> : null}
                    <span className="tabular-nums">{formatDateTime(attachment.createdAt)}</span>
                  </p>
                </div>
                {canManage ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void update.mutateAsync({
                        orderId: order.id,
                        attachmentId: attachment.id,
                        input: { visibleToCustomer: isHidden },
                      })
                    }
                    className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                    title={isHidden ? 'إظهار للعميل' : 'إخفاء عن العميل'}
                  >
                    {isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                ) : null}
                <a
                  href={resolveUploadUrl(attachment.fileUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="فتح بحجم كامل"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                {canManage ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm('حذف هذا المرفق نهائياً؟')) return;
                      void remove.mutateAsync({
                        orderId: order.id,
                        attachmentId: attachment.id,
                      });
                    }}
                    className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    title="حذف المرفق"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
