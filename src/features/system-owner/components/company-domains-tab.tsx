'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Copy, ExternalLink, Plus, RotateCcw, ShieldCheck, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import { systemOwnerQueryKeys } from '@/features/system-owner/hooks/query-keys';
import {
  companyDomainsApi,
  type CompanyDomain,
  type CompanyDomainKind,
} from '@/features/system-owner/lib/api/company-domains';

const KIND_LABEL: Record<CompanyDomainKind, string> = {
  store: 'المتجر',
  admin: 'لوحة الإدارة',
};

const STATUS_BADGE: Record<
  CompanyDomain['status'],
  { label: string; variant: 'success' | 'warning' | 'subtle' }
> = {
  active: { label: 'مفعّل', variant: 'success' },
  pending: { label: 'بانتظار التحقق', variant: 'warning' },
  disabled: { label: 'مؤرشف', variant: 'subtle' },
};

/**
 * Company domains (2026-11-13): the hostnames that open this company's
 * store or the console. A sub-domain of the platform works at once; a
 * custom domain needs its DNS records, then «تحقق الآن».
 */
export function CompanyDomainsTab({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  const listKey = systemOwnerQueryKeys.companyDomains(companyId);
  const domainsQuery = useQuery({
    queryKey: listKey,
    queryFn: () => companyDomainsApi.list(companyId),
  });
  const settingsQuery = useQuery({
    queryKey: systemOwnerQueryKeys.domainSettings(),
    queryFn: () => companyDomainsApi.settings(),
    staleTime: 10 * 60_000,
  });
  const [open, setOpen] = React.useState(false);
  const [showArchived, setShowArchived] = React.useState(false);

  const onChanged = (row: CompanyDomain) => {
    queryClient.setQueryData<CompanyDomain[]>(listKey, (rows) =>
      rows ? rows.map((r) => (r.id === row.id ? row : r)) : rows,
    );
    void queryClient.invalidateQueries({ queryKey: listKey });
  };
  const onError = (context: string) => (err: unknown) => {
    toast.error(handleApiError(err, context).displayMessage);
  };

  const verify = useMutation({
    mutationFn: (id: string) => companyDomainsApi.verify(companyId, id),
    onSuccess: (row) => {
      onChanged(row);
      toast.success(`تم تفعيل ${row.hostname}`);
    },
    onError: (err) => {
      void queryClient.invalidateQueries({ queryKey: listKey });
      onError('system-owner.domains.verify')(err);
    },
  });
  const setPrimary = useMutation({
    mutationFn: (id: string) => companyDomainsApi.setPrimary(companyId, id),
    onSuccess: (row) => {
      onChanged(row);
      toast.success(`${row.hostname} هو النطاق الأساسي الآن`);
    },
    onError: onError('system-owner.domains.primary'),
  });
  const disable = useMutation({
    mutationFn: (id: string) => companyDomainsApi.disable(companyId, id),
    onSuccess: (row) => {
      onChanged(row);
      toast.success(`أُرشف ${row.hostname}`);
    },
    onError: onError('system-owner.domains.disable'),
  });
  const restore = useMutation({
    mutationFn: (id: string) => companyDomainsApi.restore(companyId, id),
    onSuccess: (row) => {
      onChanged(row);
      toast.success(`استُعيد ${row.hostname}`);
    },
    onError: onError('system-owner.domains.restore'),
  });
  const busyId =
    (verify.isPending && verify.variables) ||
    (setPrimary.isPending && setPrimary.variables) ||
    (disable.isPending && disable.variables) ||
    (restore.isPending && restore.variables) ||
    null;

  const rows = domainsQuery.data ?? [];
  const live = rows.filter((r) => r.status !== 'disabled');
  const archived = rows.filter((r) => r.status === 'disabled');
  const root = settingsQuery.data?.platformRootDomain ?? null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
          النطاق يفتح متجر هذه الشركة أو لوحة الإدارة.
          {root ? (
            <>
              {' '}
              النطاق الفرعي من المنصة (مثل <span dir="ltr">name.{root}</span>) يعمل فوراً، والنطاق
              الخاص بالعميل يحتاج إضافة سجلات DNS عند مزوّده ثم التحقق.
            </>
          ) : (
            ' يحتاج النطاق إضافة سجلات DNS عند مزوّده ثم التحقق.'
          )}
        </p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          إضافة نطاق
        </Button>
      </div>

      {domainsQuery.isLoading ? <p className="text-sm text-muted-foreground">جاري التحميل…</p> : null}
      {domainsQuery.isError ? (
        <div className="flex items-center gap-2 text-sm text-destructive">
          تعذر تحميل النطاقات.
          <Button size="sm" variant="outline" onClick={() => void domainsQuery.refetch()}>
            إعادة المحاولة
          </Button>
        </div>
      ) : null}

      {live.map((row) => (
        <DomainCard
          key={row.id}
          row={row}
          busy={busyId === row.id}
          onVerify={() => verify.mutate(row.id)}
          onPrimary={() => setPrimary.mutate(row.id)}
          onDisable={() => disable.mutate(row.id)}
        />
      ))}
      {!domainsQuery.isLoading && !domainsQuery.isError && live.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          لا توجد نطاقات. المتجر يعمل على نطاق النسخة الافتراضي فقط.
        </p>
      ) : null}

      {archived.length > 0 ? (
        <div className="space-y-2">
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? 'إخفاء المؤرشفة' : `المؤرشفة (${archived.length})`}
          </button>
          {showArchived
            ? archived.map((row) => (
                <DomainCard
                  key={row.id}
                  row={row}
                  busy={busyId === row.id}
                  onRestore={() => restore.mutate(row.id)}
                />
              ))
            : null}
        </div>
      ) : null}

      <AddDomainDialog
        companyId={companyId}
        open={open}
        onOpenChange={setOpen}
        platformRoot={root}
        reserved={settingsQuery.data?.reservedLabels ?? []}
        onCreated={(row) => {
          queryClient.setQueryData<CompanyDomain[]>(listKey, (rows) => [...(rows ?? []), row]);
          void queryClient.invalidateQueries({ queryKey: listKey });
        }}
      />
    </div>
  );
}

function DomainCard({
  row,
  busy,
  onVerify,
  onPrimary,
  onDisable,
  onRestore,
}: {
  row: CompanyDomain;
  busy: boolean;
  onVerify?: () => void;
  onPrimary?: () => void;
  onDisable?: () => void;
  onRestore?: () => void;
}) {
  const status = STATUS_BADGE[row.status];
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {row.status === 'active' ? (
              <a
                href={row.url}
                target="_blank"
                rel="noreferrer"
                dir="ltr"
                className="inline-flex items-center gap-1 break-all font-mono text-sm font-medium hover:underline"
              >
                {row.hostname}
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            ) : (
              <span dir="ltr" className="break-all font-mono text-sm font-medium">
                {row.hostname}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{KIND_LABEL[row.kind]}</Badge>
            <Badge variant={status.variant}>{status.label}</Badge>
            {row.isPrimary ? <Badge variant="gold">أساسي</Badge> : null}
            {row.isPlatformSubdomain ? <Badge variant="secondary">نطاق المنصة</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {row.status === 'pending' && onVerify ? (
            <Button size="sm" onClick={onVerify} disabled={busy}>
              <ShieldCheck className="h-4 w-4" />
              تحقق الآن
            </Button>
          ) : null}
          {row.status === 'active' && !row.isPrimary && onPrimary ? (
            <Button size="sm" variant="outline" onClick={onPrimary} disabled={busy}>
              <Star className="h-4 w-4" />
              اجعله أساسياً
            </Button>
          ) : null}
          {row.status !== 'disabled' && onDisable ? (
            <Button size="sm" variant="ghost" onClick={onDisable} disabled={busy}>
              <Archive className="h-4 w-4" />
              أرشفة
            </Button>
          ) : null}
          {row.status === 'disabled' && onRestore ? (
            <Button size="sm" variant="outline" onClick={onRestore} disabled={busy}>
              <RotateCcw className="h-4 w-4" />
              استعادة
            </Button>
          ) : null}
        </div>
      </div>

      {row.status === 'pending' ? (
        <div className="space-y-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            أضف هذه السجلات عند مزوّد النطاق، ثم اضغط «تحقق الآن». قد يتأخر ظهورها حتى ساعة.
          </p>
          {row.dnsRecords.map((record) => (
            <DnsRecordRow key={`${record.type}-${record.name}`} record={record} />
          ))}
          {row.lastCheckError ? (
            <p className="text-xs text-destructive">{row.lastCheckError}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function DnsRecordRow({ record }: { record: CompanyDomain['dnsRecords'][number] }) {
  return (
    <div className="space-y-1 rounded-md bg-card px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono">
          {record.type}
        </Badge>
        <span className="text-muted-foreground">{record.purposeAr}</span>
      </div>
      <CopyLine label="الاسم" value={record.name} />
      <CopyLine label="القيمة" value={record.value} />
    </div>
  );
}

function CopyLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-muted-foreground">{label}</span>
      <code dir="ltr" className="min-w-0 flex-1 break-all rounded bg-muted px-2 py-1 font-mono">
        {value}
      </code>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7 shrink-0"
        aria-label={`نسخ ${label}`}
        onClick={() => {
          void navigator.clipboard
            ?.writeText(value)
            .then(() => toast.success('نُسخ'))
            .catch(() => toast.error('تعذّر النسخ'));
        }}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function AddDomainDialog({
  companyId,
  open,
  onOpenChange,
  platformRoot,
  reserved,
  onCreated,
}: {
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platformRoot: string | null;
  reserved: string[];
  onCreated: (row: CompanyDomain) => void;
}) {
  const [kind, setKind] = React.useState<CompanyDomainKind>('store');
  const [usePlatform, setUsePlatform] = React.useState(true);
  const [label, setLabel] = React.useState('');
  const [hostname, setHostname] = React.useState('');

  const platform = Boolean(platformRoot) && usePlatform;
  const cleanLabel = label.trim().toLowerCase();
  const fullHost = platform ? (cleanLabel ? `${cleanLabel}.${platformRoot}` : '') : hostname.trim();
  const reservedHit = platform && reserved.includes(cleanLabel);

  const create = useMutation({
    mutationFn: () => companyDomainsApi.create(companyId, { hostname: fullHost, kind }),
    onSuccess: (row) => {
      onCreated(row);
      toast.success(
        row.status === 'active'
          ? `${row.hostname} يعمل الآن`
          : `أُضيف ${row.hostname}. أضف سجلات DNS ثم تحقق منه.`,
      );
      reset();
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(handleApiError(err, 'system-owner.domains.create').displayMessage);
    },
  });

  function reset() {
    setKind('store');
    setUsePlatform(true);
    setLabel('');
    setHostname('');
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إضافة نطاق للشركة</DialogTitle>
          <DialogDescription>
            نطاق المتجر يفتح متجر الشركة. نطاق لوحة الإدارة يفتح لوحة الموظفين المشتركة.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>النوع</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as CompanyDomainKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="store">{KIND_LABEL.store}</SelectItem>
                <SelectItem value="admin">{KIND_LABEL.admin}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {platformRoot ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <div>
                <p className="text-sm">نطاق فرعي من المنصة</p>
                <p className="text-xs text-muted-foreground">يعمل فوراً دون إعداد DNS.</p>
              </div>
              <Switch checked={usePlatform} onCheckedChange={setUsePlatform} />
            </div>
          ) : null}

          {platform ? (
            <div className="space-y-1.5">
              <Label htmlFor="domain-label">الاسم</Label>
              <div className="flex items-center gap-1" dir="ltr">
                <Input
                  id="domain-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''))}
                  placeholder="amar"
                  className="font-mono"
                  maxLength={63}
                />
                <span className="shrink-0 font-mono text-sm text-muted-foreground">.{platformRoot}</span>
              </div>
              {reservedHit ? (
                <p className="text-xs text-destructive">هذا الاسم محجوز للمنصة.</p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="domain-host">النطاق</Label>
              <Input
                id="domain-host"
                dir="ltr"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                placeholder="amarstore.com"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                دون http ودون مسار. يبقى بانتظار التحقق حتى تُضاف سجلات DNS.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={() => create.mutate()} disabled={!fullHost || reservedHit || create.isPending}>
            إضافة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
