'use client';

import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, ChevronDown, Inbox, Search, X } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  dialogMobileFullScreenClass,
  dialogShellBodyClass,
  dialogShellContentClass,
  dialogShellHeaderClass,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/shared/utils';
import type { ExpensesCommand } from '../data/commands';
import { useExpensesStore } from '../data/store';
import { toMinor, type Minor } from '../domain/money';
import { STATUS_LABELS_AR } from '../domain/policy';
import { ORG } from '../domain/types';
import type { PartyId, TxnStatus } from '../domain/types';
import { useCurrency, useDirectory, useExpensesData } from './expenses-provider';

const STATUS_VARIANT: Record<TxnStatus, BadgeProps['variant']> = {
  draft: 'subtle',
  submitted: 'warning',
  approved: 'success',
  rejected: 'destructive',
  void: 'outline',
};

export function StatusBadge({ status }: { status: TxnStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className={cn('shrink-0', status === 'void' && 'line-through')}>
      {STATUS_LABELS_AR[status]}
    </Badge>
  );
}

export function Money({ value, className, signed }: { value: Minor; className?: string; signed?: boolean }) {
  const { format } = useCurrency();
  return (
    <span className={cn('tabular-nums', className)} dir="ltr">
      {signed && value > 0 ? '+' : ''}
      {format(value)}
    </span>
  );
}

export function PartyName({ id, link = true }: { id: PartyId | null | undefined; link?: boolean }) {
  const directory = useDirectory();
  const name = directory.nameOf(id);
  if (!id || id === ORG || !link || !directory.get(id)) return <span>{name}</span>;
  return (
    <Link href={`/expenses/people/${encodeURIComponent(id)}`} className="text-primary hover:underline">
      {name}
    </Link>
  );
}

export function SourceBadge({ id }: { id: PartyId }) {
  const directory = useDirectory();
  const p = directory.get(id);
  if (!p) return null;
  if (p.source === 'demo') return <Badge variant="gold" className="text-[10px]">تجريبي</Badge>;
  if (p.kind === 'contact') return <Badge variant="subtle" className="text-[10px]">جهة اتصال بلا حساب</Badge>;
  return null;
}

/** One participant (optionally the organization). */
export function PartySelect({
  value,
  onChange,
  includeOrg,
  placeholder = 'اختر الشخص',
  exclude = [],
  id,
}: {
  value: PartyId | null;
  onChange: (id: PartyId) => void;
  includeOrg?: boolean;
  placeholder?: string;
  exclude?: PartyId[];
  id?: string;
}) {
  const directory = useDirectory();
  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger id={id} className="h-10">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {includeOrg && !exclude.includes(ORG) ? <SelectItem value={ORG}>المنشأة</SelectItem> : null}
        {directory.choices
          .filter((p) => !exclude.includes(p.id))
          .map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
              {p.source === 'demo' ? ' · تجريبي' : p.kind === 'contact' ? ' · بلا حساب' : ''}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}

/** Several participants (checkbox chips), optionally the organization. */
export function PartyChecklist({
  value,
  onChange,
  includeOrg,
  limitTo,
}: {
  value: PartyId[];
  onChange: (ids: PartyId[]) => void;
  includeOrg?: boolean;
  limitTo?: PartyId[] | null;
}) {
  const directory = useDirectory();
  const options: Array<{ id: PartyId; name: string }> = [
    ...(includeOrg ? [{ id: ORG as PartyId, name: 'المنشأة' }] : []),
    ...directory.choices.filter((p) => !limitTo || limitTo.includes(p.id)).map((p) => ({ id: p.id, name: p.name })),
  ];
  const toggle = (id: PartyId) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => toggle(o.id)}
            aria-pressed={on}
            className={cn(
              'min-h-9 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-muted',
            )}
          >
            {o.name}
          </button>
        );
      })}
    </div>
  );
}

/** Pick from a searchable list; each pick drops below it as a row and leaves the list. */
export function PickList({
  options,
  value,
  onChange,
  placeholder,
  renderName,
  ordered,
  disabled,
}: {
  options: Array<{ id: string; name: string }>;
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
  /** A picked row's name; defaults to its option's name. */
  renderName?: (id: string) => React.ReactNode;
  /** The order means something: rows are numbered and can be moved. */
  ordered?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const free = options.filter((o) => !value.includes(o.id));
  const needle = query.trim().toLowerCase();
  const shown = needle ? free.filter((o) => o.name.toLowerCase().includes(needle)) : free;
  const move = (index: number, to: number) => {
    const next = [...value];
    const [id] = next.splice(index, 1);
    next.splice(to, 0, id!);
    onChange(next);
  };
  return (
    <div className="space-y-1.5">
      {disabled ? null : (
        <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(''); }} modal={false}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" disabled={free.length === 0} aria-expanded={open} className="h-10 w-full justify-between font-normal">
              <span className="truncate text-muted-foreground">{free.length === 0 ? 'اختير الجميع' : placeholder}</span>
              <ChevronDown className={cn('h-4 w-4 shrink-0 opacity-60 transition-transform', open && 'rotate-180')} />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" side="bottom" collisionPadding={16} className="popover-match-trigger overflow-hidden p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
            <div className="border-b border-border p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث في القائمة…" className="h-9 pr-9 text-sm" />
              </div>
            </div>
            <div role="listbox" className="max-h-56 touch-pan-y overflow-y-auto overscroll-contain p-1">
              {shown.length === 0 ? <p className="px-3 py-4 text-center text-sm text-muted-foreground">لا توجد نتائج</p> : shown.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="flex min-h-9 w-full items-center rounded-md px-2 py-1.5 text-start text-sm hover:bg-accent/70"
                  // A second click while the list closes must not pick the row now under it.
                  onClick={() => { if (!open) return; onChange([...value, o.id]); setOpen(false); setQuery(''); }}
                >
                  <span className="truncate">{o.name}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
      {value.map((id, i) => (
        <div key={id} className="flex items-center gap-2 rounded-lg bg-muted/50 px-2 py-1">
          {ordered ? <span className="w-4 text-center text-xs text-muted-foreground">{i + 1}</span> : null}
          <span className="min-w-0 flex-1 truncate text-sm">{renderName ? renderName(id) : (options.find((o) => o.id === id)?.name ?? id)}</span>
          {disabled ? null : (
            <>
              {ordered ? (
                <>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="أعلى" disabled={i === 0} onClick={() => move(i, i - 1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="أسفل" disabled={i === value.length - 1} onClick={() => move(i, i + 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                </>
              ) : null}
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="إزالة" onClick={() => onChange(value.filter((v) => v !== id))}><X className="h-3.5 w-3.5" /></Button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/** Amount typed in major units; reports minor units of the app currency. */
export function AmountInput({
  value,
  onChange,
  id,
  placeholder = '0',
  autoFocus,
}: {
  value: string;
  onChange: (text: string, minor: Minor) => void;
  id?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const { decimals, code } = useCurrency();
  return (
    <div dir="rtl" className="flex items-stretch">
      <Input
        id={id}
        inputMode="decimal"
        dir="ltr"
        autoFocus={autoFocus}
        className="h-11 min-w-0 flex-1 rounded-l-none text-start text-base tabular-nums"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          const text = e.target.value.replace(/[^\d.,]/g, '');
          onChange(text, toMinor(text || '0', decimals));
        }}
      />
      <span className="flex shrink-0 items-center rounded-l-md border border-r-0 border-input bg-muted/50 px-3 text-xs font-medium text-muted-foreground">{code}</span>
    </div>
  );
}

export function Field({ label, htmlFor, hint, children, className }: { label: string; htmlFor?: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor} className="text-xs font-medium">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5', className)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-1.5">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center">
      <Inbox className="h-6 w-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}

/** Dialog that fills the phone screen, with a scrollable body and a footer. */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogShellContentClass, dialogMobileFullScreenClass, wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <DialogHeader className={dialogShellHeaderClass}>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
        </DialogHeader>
        <div className={cn(dialogShellBodyClass, 'space-y-4 px-4 py-4 sm:px-6')}>{children}</div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border px-4 py-3 sm:px-6">{footer}</div>
      </DialogContent>
    </Dialog>
  );
}

/** Asks for a reason (void / reject). */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  confirmLabel,
  destructive,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = React.useState('');
  React.useEffect(() => {
    if (open) setReason('');
  }, [open]);
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            تراجع
          </Button>
          <Button variant={destructive ? 'destructive' : 'default'} disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Field label="السبب" htmlFor="reason">
        <Input id="reason" className="h-10" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
      </Field>
    </FormDialog>
  );
}

/** Responsive list: cards on phones, a table from md up. */
export function ResponsiveTable<T>({
  rows,
  rowKey,
  columns,
  card,
  onRowClick,
}: {
  rows: readonly T[];
  rowKey: (row: T) => string;
  columns: Array<{ header: string; cell: (row: T) => React.ReactNode; className?: string }>;
  card: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
}) {
  return (
    <>
      <div className="space-y-2 md:hidden">
        {rows.map((row) => (
          <div
            key={rowKey(row)}
            role={onRowClick ? 'button' : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            onKeyDown={onRowClick ? (e) => (e.key === 'Enter' ? onRowClick(row) : undefined) : undefined}
            className={cn('rounded-xl border border-border bg-card p-3', onRowClick && 'cursor-pointer active:bg-muted/50')}
          >
            {card(row)}
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              {columns.map((c) => (
                <th key={c.header} className={cn('px-3 py-2.5 text-start font-medium', c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn('border-t border-border/70', onRowClick && 'cursor-pointer hover:bg-muted/30')}
              >
                {columns.map((c) => (
                  <td key={c.header} className={cn('px-3 py-2.5 align-middle', c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function KeyValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-2 text-sm last:border-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-end">{children}</span>
    </div>
  );
}

export function LoadingBlock() {
  return <div className="h-40 animate-pulse rounded-2xl bg-muted/40" />;
}

/** Shown only when the company data could not be read (with a retry). */
export function ExpensesStatusBar() {
  const loadError = useExpensesStore((s) => s.loadError);
  const reload = useExpensesStore((s) => s.reload);
  if (!loadError) return null;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
      <p className="font-medium text-destructive">تعذر تحميل بيانات المصاريف: {loadError}</p>
      <Button size="sm" variant="outline" className="h-8" onClick={() => void reload()}>
        إعادة المحاولة
      </Button>
    </div>
  );
}

/** Runs a command on the server with a toast; true when it went through. */
export function useRunCommand() {
  const exec = useExpensesStore((s) => s.exec);
  return React.useCallback(
    async (command: ExpensesCommand, ok?: string): Promise<boolean> => {
      try {
        await exec(command);
        if (ok) toast.success(ok);
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'تعذر التنفيذ');
        return false;
      }
    },
    [exec],
  );
}

/** Picks a branch from what the server allows ('' = the company, or every branch for setup rows). */
export function BranchSelect({
  value,
  onChange,
  options,
  id = 'branch',
  label = 'الفرع',
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  id?: string;
  label?: string;
  disabled?: boolean;
}) {
  // Radix Select reserves '': map it to a token of its own.
  const NONE = '__company__';
  return (
    <Field label={label} htmlFor={id}>
      <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? '' : v)} disabled={disabled}>
        <SelectTrigger id={id} className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value || NONE} value={o.value || NONE}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
