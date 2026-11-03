'use client';

import * as React from 'react';
import { AlertTriangle, ChevronLeft, Info, Loader2, Plus, Search, Shuffle, Trash2, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmationModal } from '@/components/ui/shared-dialogs';
import { SlidePanel, SlidePanelContent } from '@/components/ui/slide-panel';
import { Switch } from '@/components/ui/switch';
import {
  useOrderStageCandidates,
  useOrderStagesSettings,
  useSaveOrderStagesSettings,
} from '@/features/ecommerce/admin/orders/hooks/use-order-stages';
import {
  ORDER_STAGES,
  ORDER_STAGE_ACTION_LABELS,
  ORDER_STAGE_RECEIVE_LABELS,
  ORDER_STAGE_SCOPE_LABELS,
  type OrderStage,
  type OrderStageAccess,
  type OrderStageAction,
  type OrderStageCandidate,
  type OrderStageReceive,
  type OrderStageScope,
  type OrderStagesSettings,
  type SaveOrderStagesSettingsInput,
} from '@/features/ecommerce/admin/orders/lib/api/order-stages';
import { ORDER_STAGE_LABELS_AR } from '@/features/ecommerce/admin/orders/lib/order-stage-access';
import { cn } from '@/shared/utils';

const ACTIONS: OrderStageAction[] = ['cancel', 'refund', 'rollback', 'assign'];
const RECEIVES: OrderStageReceive[] = ['none', 'fixed', 'auto'];
const SCOPES: OrderStageScope[] = ['queue', 'assigned', 'all'];
const PAGE_SIZE = 25;
const PICKER_PAGE_SIZE = 30;

type Grant = { access: OrderStageAccess; scope: OrderStageScope; receive: OrderStageReceive };
type UserRow = {
  userId: string;
  nameAr: string;
  canOpenOrders: boolean;
  grants: Partial<Record<OrderStage, Grant>>;
  /** Null for a user added now: shown after saving. */
  actions: Record<OrderStageAction, boolean> | null;
};
type AccessFilter = 'all' | 'with' | 'without';

function rowsFrom(data: OrderStagesSettings): UserRow[] {
  const byId = new Map<string, UserRow>();
  for (const user of data.users) {
    byId.set(user.userId, {
      userId: user.userId,
      nameAr: user.nameAr ?? user.userId,
      canOpenOrders: user.canOpenOrders,
      grants: {},
      actions: { ...user.actions },
    });
  }
  for (const stage of data.stages) {
    for (const m of stage.members) {
      const row =
        byId.get(m.userId) ??
        ({ userId: m.userId, nameAr: m.nameAr ?? m.userId, canOpenOrders: m.canOpenOrders, grants: {}, actions: null } as UserRow);
      row.grants[stage.stage] = { access: m.access, scope: m.scope, receive: m.access === 'work' ? m.receive : 'none' };
      byId.set(m.userId, row);
    }
  }
  return [...byId.values()].sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar'));
}

/** What is saved of a row (grants per stage, actions) — compared to find unsaved changes. */
function rowSignature(row: UserRow): string {
  return JSON.stringify([
    ORDER_STAGES.map((s) => {
      const g = row.grants[s];
      return g ? [g.access, g.access === 'work' ? g.scope : '', g.receive] : null;
    }),
    row.actions ? ACTIONS.map((a) => row.actions![a]) : null,
  ]);
}

const hasGrants = (row: UserRow) => ORDER_STAGES.some((s) => row.grants[s]);

/** Why a stage's receiving is invalid (one «مستخدم محدد», not with a rotation). */
function receivingProblem(rows: UserRow[], stage: OrderStage): string | null {
  const work = rows.map((r) => r.grants[stage]).filter((g): g is Grant => g?.access === 'work');
  const fixed = work.filter((g) => g.receive === 'fixed').length;
  if (fixed > 1) return `«${ORDER_STAGE_LABELS_AR[stage]}»: «مستخدم محدد» واحد فقط`;
  if (fixed === 1 && work.some((g) => g.receive === 'auto')) {
    return `«${ORDER_STAGE_LABELS_AR[stage]}»: مستخدم محدد أو توزيع تلقائي، لا الاثنان`;
  }
  return null;
}

/**
 * Order stage permissions: a list of users (search, filters, paging) and a
 * side sheet per user with their access to each stage («عمل» / «عرض فقط»),
 * how they receive its new orders, and the order actions. One page save.
 */
export function OrderStagesSettingsPanel({ companyId }: { companyId: string }) {
  const query = useOrderStagesSettings(companyId);
  const save = useSaveOrderStagesSettings(companyId);
  const candidates = useOrderStageCandidates(companyId);
  const [enabled, setEnabled] = React.useState(false);
  const [assigneeOnly, setAssigneeOnly] = React.useState(true);
  const [rows, setRows] = React.useState<UserRow[]>([]);
  const [search, setSearch] = React.useState('');
  const [stageFilter, setStageFilter] = React.useState<OrderStage | null>(null);
  const [accessFilter, setAccessFilter] = React.useState<AccessFilter>('all');
  const [limit, setLimit] = React.useState(PAGE_SIZE);
  const [openUserId, setOpenUserId] = React.useState<string | null>(null);
  const [confirmRelease, setConfirmRelease] = React.useState<string | null>(null);

  const reset = React.useCallback((data: OrderStagesSettings) => {
    setEnabled(data.enabled);
    setAssigneeOnly(data.assigneeOnly);
    setRows(rowsFrom(data));
  }, []);

  React.useEffect(() => {
    if (query.data) reset(query.data);
  }, [query.data, reset]);

  const saved = query.data;
  const savedSignatures = React.useMemo(
    () => new Map(saved ? rowsFrom(saved).map((r) => [r.userId, rowSignature(r)]) : []),
    [saved],
  );
  const openOrdersByUser = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const stage of saved?.stages ?? []) {
      for (const m of stage.members) counts.set(m.userId, (counts.get(m.userId) ?? 0) + m.openOrders);
    }
    return counts;
  }, [saved]);
  const emailById = React.useMemo(
    () => new Map((candidates.data ?? []).map((c) => [c.id, c.email])),
    [candidates.data],
  );

  if (query.isLoading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">جاري التحميل…</p>;
  }
  if (!saved) {
    return (
      <div className="space-y-2 py-8 text-center text-sm text-muted-foreground">
        <p>تعذّر تحميل الإعدادات.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  const updateRow = (userId: string, patch: (row: UserRow) => UserRow) =>
    setRows((current) => current.map((r) => (r.userId === userId ? patch(r) : r)));

  function setGrant(userId: string, stage: OrderStage, grant: Grant | null) {
    setRows((current) =>
      current.map((r) => {
        const grants = { ...r.grants };
        if (r.userId === userId) {
          if (grant) grants[stage] = grant;
          else delete grants[stage];
          return { ...r, grants };
        }
        // One «مستخدم محدد» per stage, never with a rotation: the others give way.
        const other = grants[stage];
        if (grant?.receive === 'fixed' && other && other.receive !== 'none') {
          grants[stage] = { ...other, receive: 'none' };
          return { ...r, grants };
        }
        if (grant?.receive === 'auto' && other?.receive === 'fixed') {
          grants[stage] = { ...other, receive: 'none' };
          return { ...r, grants };
        }
        return r;
      }),
    );
  }

  const problems = ORDER_STAGES.map((s) => receivingProblem(rows, s)).filter((p): p is string => Boolean(p));
  const workersOf = (stage: OrderStage) => rows.filter((r) => r.grants[stage]?.access === 'work');
  const emptyStages = ORDER_STAGES.filter((s) => workersOf(s).length === 0);

  // Unsaved changes: users changed, added or removed, and the switches.
  const isDirty = (row: UserRow) => savedSignatures.get(row.userId) !== rowSignature(row);
  const dirtyUsers = rows.filter(isDirty).length;
  const removedUsers = [...savedSignatures.keys()].filter((id) => !rows.some((r) => r.userId === id)).length;
  const switchesChanged = enabled !== saved.enabled || assigneeOnly !== saved.assigneeOnly;
  const changes = dirtyUsers + removedUsers + (switchesChanged ? 1 : 0);

  // §2.3: who loses the work grant on a stage gives back the orders they hold there.
  const releases = saved.stages.flatMap((stage) =>
    stage.members
      .filter((m) => m.access === 'work' && m.openOrders > 0)
      .filter((m) => rows.find((r) => r.userId === m.userId)?.grants[stage.stage]?.access !== 'work')
      .map((m) => `${m.nameAr ?? 'مستخدم'}: ${m.openOrders} في «${stage.labelAr}»`),
  );

  function submit() {
    if (!saved) return;
    const initial = new Map(saved.users.map((u) => [u.userId, u.actions]));
    const input: SaveOrderStagesSettingsInput = {
      enabled,
      assigneeOnly,
      stages: ORDER_STAGES.map((stage) => ({
        stage,
        members: rows.flatMap((r) => {
          const g = r.grants[stage];
          if (!g) return [];
          return [
            g.access === 'work'
              ? { userId: r.userId, access: 'work' as const, scope: g.scope, receive: g.receive }
              : { userId: r.userId, access: 'view' as const, receive: 'none' as const },
          ];
        }),
      })),
      users: rows
        .filter((r) => r.actions && initial.has(r.userId))
        .map((r) => {
          const before = initial.get(r.userId)!;
          const changed = Object.fromEntries(
            ACTIONS.filter((a) => before[a] !== r.actions![a]).map((a) => [a, r.actions![a]]),
          ) as Partial<Record<OrderStageAction, boolean>>;
          return { userId: r.userId, actions: changed };
        })
        .filter((u) => Object.keys(u.actions).length > 0),
    };
    void save.mutateAsync(input).catch(() => undefined);
  }

  const needle = search.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (needle) {
      const email = emailById.get(r.userId)?.toLowerCase() ?? '';
      if (!r.nameAr.toLowerCase().includes(needle) && !email.includes(needle)) return false;
    }
    if (stageFilter && !r.grants[stageFilter]) return false;
    if (accessFilter === 'with' && !hasGrants(r)) return false;
    if (accessFilter === 'without' && hasGrants(r)) return false;
    return true;
  });
  const shown = filtered.slice(0, limit);
  const available = (candidates.data ?? []).filter((c) => !rows.some((r) => r.userId === c.id));
  const openRow = openUserId ? (rows.find((r) => r.userId === openUserId) ?? null) : null;

  const filterBy = (apply: () => void) => {
    apply();
    setLimit(PAGE_SIZE);
  };

  return (
    <div className="space-y-4">
      <section className="space-y-2 rounded-xl border border-border/70 bg-background p-3">
        <ToggleLine
          title="تفعيل صلاحيات المراحل"
          hint="عند الإيقاف تكفي صلاحية «تعديل الطلبات»."
          checked={enabled}
          onChange={setEnabled}
        />
        <ToggleLine
          title="الطلب المسند يعمل عليه صاحبه فقط"
          hint="أو من يملك «إسناد لأي مستخدم»."
          checked={assigneeOnly}
          onChange={setAssigneeOnly}
          disabled={!enabled}
        />
        <p className="flex items-start gap-2 border-t border-border/60 pt-2 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {saved.cashOnDeliveryEnabled
            ? 'الدفع عند الاستلام مفعّل: يُدفع عند التسليم، وغيره لا يُؤكَّد قبل الدفع.'
            : 'الدفع عند الاستلام غير مفعّل: لا يُؤكَّد طلب قبل الدفع.'}{' '}
          يُغيَّر من «حسابات الدفع».
        </p>
      </section>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {ORDER_STAGES.map((stage) => (
          <StageSummary
            key={stage}
            stage={stage}
            rows={rows}
            warn={enabled && workersOf(stage).length === 0}
            active={stageFilter === stage}
            onClick={() => filterBy(() => setStageFilter((s) => (s === stage ? null : stage)))}
          />
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => filterBy(() => setSearch(e.target.value))}
              placeholder="بحث بالاسم أو البريد…"
              className="ps-9"
              aria-label="بحث عن مستخدم"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex">
            <Select
              value={stageFilter ?? 'all'}
              onValueChange={(v) => filterBy(() => setStageFilter(v === 'all' ? null : (v as OrderStage)))}
            >
              <SelectTrigger className="md:w-36" aria-label="المرحلة">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المراحل</SelectItem>
                {ORDER_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {ORDER_STAGE_LABELS_AR[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={accessFilter} onValueChange={(v) => filterBy(() => setAccessFilter(v as AccessFilter))}>
              <SelectTrigger className="md:w-36" aria-label="الصلاحية">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="with">لديه صلاحية</SelectItem>
                <SelectItem value="without">بدون صلاحية</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AddUserPicker
            candidates={available}
            loading={candidates.isLoading}
            failed={candidates.isError}
            onPick={(user) => {
              setRows((current) => [
                ...current,
                { userId: user.id, nameAr: user.nameAr, canOpenOrders: user.canOpenOrders ?? true, grants: {}, actions: null },
              ]);
              setOpenUserId(user.id);
            }}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {filtered.length === rows.length ? `${rows.length} مستخدم` : `${filtered.length} من ${rows.length} مستخدم`}
        </p>

        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            {rows.length === 0 ? 'لا أحد بعد — أضف مستخدماً.' : 'لا نتائج.'}
          </p>
        ) : (
          <>
            {/* Desktop: a table. */}
            <div className="hidden overflow-hidden rounded-xl border border-border md:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-start font-medium">المستخدم</th>
                    <th className="px-3 py-2 text-start font-medium">المراحل</th>
                    <th className="w-28 px-3 py-2 text-center font-medium">طلبات مفتوحة</th>
                    <th className="w-10" aria-hidden />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => (
                    <tr
                      key={row.userId}
                      tabIndex={0}
                      onClick={() => setOpenUserId(row.userId)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setOpenUserId(row.userId);
                        }
                      }}
                      className="cursor-pointer border-t border-border/70 outline-none transition-colors hover:bg-muted/30 focus-visible:bg-muted/40"
                    >
                      <td className="px-3 py-2.5 align-top">
                        <UserName row={row} email={emailById.get(row.userId) ?? null} dirty={isDirty(row)} />
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <GrantChips row={row} />
                      </td>
                      <td className="px-3 py-2.5 text-center align-top tabular-nums">
                        {openOrdersByUser.get(row.userId) ?? 0}
                      </td>
                      <td className="px-2 py-2.5 align-top text-muted-foreground">
                        <ChevronLeft className="h-4 w-4" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phones: rows. */}
            <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border md:hidden">
              {shown.map((row) => (
                <li key={row.userId}>
                  <button
                    type="button"
                    onClick={() => setOpenUserId(row.userId)}
                    className="flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-start active:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <UserName row={row} email={emailById.get(row.userId) ?? null} dirty={isDirty(row)} />
                      <GrantChips row={row} />
                    </div>
                    {(openOrdersByUser.get(row.userId) ?? 0) > 0 ? (
                      <Badge variant="subtle" className="shrink-0 tabular-nums" title="طلبات مفتوحة مسندة إليه">
                        {openOrdersByUser.get(row.userId)}
                      </Badge>
                    ) : null}
                    <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>

            {filtered.length > shown.length ? (
              <Button
                type="button"
                variant="ghost"
                className="h-10 w-full text-xs text-muted-foreground"
                onClick={() => setLimit((n) => n + PAGE_SIZE)}
              >
                عرض المزيد ({filtered.length - shown.length} متبقٍ)
              </Button>
            ) : null}
          </>
        )}
      </section>

      {enabled && emptyStages.length > 0 ? (
        <p className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          لا أحد يعمل في {emptyStages.map((s) => `«${ORDER_STAGE_LABELS_AR[s]}»`).join('، ')}.
        </p>
      ) : null}
      {problems.length > 0 ? <p className="text-sm text-destructive">{problems.join(' · ')}</p> : null}

      <div
        className={cn(
          'sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background/95 p-2.5 backdrop-blur',
          changes > 0 ? 'border-primary/40' : 'border-border/70',
        )}
      >
        <span className={cn('text-xs', changes > 0 ? 'font-medium text-foreground' : 'text-muted-foreground')}>
          {changes > 0 ? `تغييرات غير محفوظة (${changes})` : 'لا تغييرات'}
        </span>
        <div className="flex gap-2">
          {changes > 0 ? (
            <Button type="button" variant="ghost" size="sm" className="max-sm:h-10" onClick={() => reset(saved)}>
              تراجع
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="max-sm:h-10"
            disabled={save.isPending || problems.length > 0 || changes === 0}
            onClick={() => (releases.length > 0 ? setConfirmRelease(releases.join('، ')) : submit())}
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            حفظ الصلاحيات
          </Button>
        </div>
      </div>

      <SlidePanel open={openRow !== null} onOpenChange={(open) => (!open ? setOpenUserId(null) : undefined)}>
        {openRow ? (
          <SlidePanelContent
            size="lg"
            title={openRow.nameAr}
            description={emailById.get(openRow.userId) ?? 'صلاحيات مراحل الطلبات'}
            bodyClassName="space-y-4 px-4 py-4 sm:px-6"
            footer={
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="gap-1.5 text-destructive hover:text-destructive max-sm:h-11"
                  disabled={!hasGrants(openRow)}
                  onClick={() =>
                    updateRow(openRow.userId, (r) => ({ ...r, grants: {} }))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                  إزالة من كل المراحل
                </Button>
                <Button type="button" className="max-sm:h-11" onClick={() => setOpenUserId(null)}>
                  تم
                </Button>
              </div>
            }
          >
            <UserDetail
              row={openRow}
              dirty={isDirty(openRow)}
              openOrders={openOrdersByUser.get(openRow.userId) ?? 0}
              problems={ORDER_STAGES.map((s) =>
                openRow.grants[s] ? receivingProblem(rows, s) : null,
              ).filter((p): p is string => Boolean(p))}
              onGrant={(stage, grant) => setGrant(openRow.userId, stage, grant)}
              onAction={(action, on) =>
                updateRow(openRow.userId, (r) => ({ ...r, actions: r.actions ? { ...r.actions, [action]: on } : r.actions }))
              }
            />
          </SlidePanelContent>
        ) : null}
      </SlidePanel>

      <ConfirmationModal
        open={confirmRelease !== null}
        onOpenChange={(open) => (!open ? setConfirmRelease(null) : undefined)}
        title="طلبات ستعود إلى قائمة المرحلة"
        description={`سحب «عمل» يعيد الطلبات المفتوحة إلى قائمة المرحلة غير المسندة: ${confirmRelease ?? ''}.`}
        confirmLabel="حفظ"
        variant="default"
        onConfirm={submit}
      />
    </div>
  );
}

function ToggleLine({
  title,
  hint,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={cn('flex items-center justify-between gap-3', disabled && 'opacity-60')}>
      <span className="min-w-0">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="ms-2 text-xs text-muted-foreground">{hint}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={title} />
    </label>
  );
}

function StageSummary({
  stage,
  rows,
  warn,
  active,
  onClick,
}: {
  stage: OrderStage;
  rows: UserRow[];
  warn: boolean;
  active: boolean;
  onClick: () => void;
}) {
  const grants = rows.map((r) => ({ r, g: r.grants[stage] })).filter((x) => x.g);
  const work = grants.filter((x) => x.g!.access === 'work');
  const views = grants.length - work.length;
  const fixed = work.find((x) => x.g!.receive === 'fixed');
  const auto = work.filter((x) => x.g!.receive === 'auto').length;
  const receiving = fixed ? `يستلم: ${fixed.r.nameAr}` : auto > 0 ? `توزيع تلقائي بين ${auto}` : 'بدون إسناد';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={active ? 'إلغاء التصفية' : 'تصفية القائمة بهذه المرحلة'}
      className={cn(
        'rounded-xl border p-2.5 text-start transition-colors',
        warn ? 'border-amber-500/50 bg-amber-500/10' : 'border-border/70 bg-muted/20 hover:bg-muted/40',
        active && 'border-primary ring-2 ring-primary/25',
      )}
    >
      <p className="text-sm font-semibold text-foreground">{ORDER_STAGE_LABELS_AR[stage]}</p>
      <p className="text-xs text-muted-foreground">
        {work.length} عمل · {views} عرض
      </p>
      <p className="truncate text-xs text-muted-foreground" title={receiving}>
        {receiving}
      </p>
    </button>
  );
}

function UserName({ row, email, dirty }: { row: UserRow; email: string | null; dirty: boolean }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 truncate font-medium text-foreground">
        <span className="truncate">{row.nameAr}</span>
        {dirty ? (
          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" title="تغييرات غير محفوظة" aria-label="غير محفوظ" />
        ) : null}
      </p>
      {email ? (
        <p className="truncate text-xs text-muted-foreground" dir="ltr">
          {email}
        </p>
      ) : null}
    </div>
  );
}

const RECEIVE_ICONS = { fixed: UserCheck, auto: Shuffle } as const;

function GrantChips({ row }: { row: UserRow }) {
  const granted = ORDER_STAGES.filter((s) => row.grants[s]);
  if (granted.length === 0) return <span className="text-xs text-muted-foreground">بلا مراحل</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {granted.map((stage) => {
        const g = row.grants[stage]!;
        const work = g.access === 'work';
        const Icon = work && g.receive !== 'none' ? RECEIVE_ICONS[g.receive] : null;
        return (
          <span
            key={stage}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
              work ? 'border-primary/30 bg-primary/10 text-foreground' : 'border-border text-muted-foreground',
            )}
            title={Icon ? `يستلم: ${ORDER_STAGE_RECEIVE_LABELS[g.receive]}` : undefined}
          >
            {ORDER_STAGE_LABELS_AR[stage]} · {work ? 'عمل' : 'عرض'}
            {Icon ? <Icon className="h-3 w-3 text-primary" aria-label={ORDER_STAGE_RECEIVE_LABELS[g.receive]} /> : null}
          </span>
        );
      })}
    </div>
  );
}

/** «إضافة مستخدم»: company users not listed yet, searched and shown a page at a time. */
function AddUserPicker({
  candidates,
  loading,
  failed,
  onPick,
}: {
  candidates: OrderStageCandidate[];
  loading: boolean;
  failed: boolean;
  onPick: (user: OrderStageCandidate) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [limit, setLimit] = React.useState(PICKER_PAGE_SIZE);
  const needle = q.trim().toLowerCase();
  const matches = needle
    ? candidates.filter(
        (c) => c.nameAr.toLowerCase().includes(needle) || (c.email?.toLowerCase().includes(needle) ?? false),
      )
    : candidates;
  const shown = matches.slice(0, limit);

  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) {
          setQ('');
          setLimit(PICKER_PAGE_SIZE);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="gap-1.5 max-md:w-full"
          disabled={loading || failed || candidates.length === 0}
          title={failed ? 'تعذّر تحميل المستخدمين' : candidates.length === 0 && !loading ? 'لا مستخدمين آخرين' : undefined}
        >
          <Plus className="h-4 w-4" />
          إضافة مستخدم
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0">
        <div className="border-b border-border p-2">
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PICKER_PAGE_SIZE);
            }}
            placeholder="بحث بالاسم أو البريد…"
            className="h-9"
            autoFocus
            aria-label="بحث عن مستخدم للإضافة"
          />
        </div>
        <div className="max-h-72 overflow-y-auto overscroll-contain">
          {shown.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onPick(c);
                setOpen(false);
                setQ('');
                setLimit(PICKER_PAGE_SIZE);
              }}
              className="flex w-full flex-col items-start px-3 py-2 text-start text-sm hover:bg-muted/60"
            >
              <span className="font-medium text-foreground">{c.nameAr}</span>
              {c.email ? (
                <span className="text-xs text-muted-foreground" dir="ltr">
                  {c.email}
                </span>
              ) : null}
            </button>
          ))}
          {matches.length === 0 ? <p className="p-3 text-center text-xs text-muted-foreground">لا نتائج.</p> : null}
          {matches.length > shown.length ? (
            <button
              type="button"
              onClick={() => setLimit((n) => n + PICKER_PAGE_SIZE)}
              className="w-full border-t border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted/60"
            >
              عرض المزيد ({matches.length - shown.length})
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const ACCESS_CHOICES: Array<{ value: 'none' | OrderStageAccess; label: string }> = [
  { value: 'none', label: '—' },
  { value: 'work', label: 'عمل' },
  { value: 'view', label: 'عرض فقط' },
];

function UserDetail({
  row,
  dirty,
  openOrders,
  problems,
  onGrant,
  onAction,
}: {
  row: UserRow;
  dirty: boolean;
  openOrders: number;
  problems: string[];
  onGrant: (stage: OrderStage, grant: Grant | null) => void;
  onAction: (action: OrderStageAction, on: boolean) => void;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="subtle" className="tabular-nums">
          طلبات مفتوحة: {openOrders}
        </Badge>
        {dirty ? <Badge variant="outline">غير محفوظ</Badge> : null}
        {!row.canOpenOrders ? (
          <Badge variant="warning">تُمنح صلاحية «العمل على مراحل الطلبات» عند الحفظ</Badge>
        ) : null}
      </div>

      <ul className="divide-y divide-border/70 rounded-xl border border-border">
        {ORDER_STAGES.map((stage) => (
          <StageRow
            key={stage}
            stage={stage}
            name={row.nameAr}
            grant={row.grants[stage] ?? null}
            onChange={(g) => onGrant(stage, g)}
          />
        ))}
      </ul>
      {problems.length > 0 ? <p className="text-sm text-destructive">{problems.join(' · ')}</p> : null}

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">صلاحيات إضافية</p>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`صلاحيات ${row.nameAr} على الطلبات`}>
          {row.actions ? (
            ACTIONS.map((action) => {
              const on = row.actions![action];
              return (
                <button
                  key={action}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onAction(action, !on)}
                  className={cn(
                    'min-h-9 rounded-full border px-3 text-xs',
                    on ? 'border-primary bg-primary/10 font-semibold text-foreground' : 'border-border text-muted-foreground',
                  )}
                >
                  {ORDER_STAGE_ACTION_LABELS[action]}
                </button>
              );
            })
          ) : (
            <span className="text-xs text-muted-foreground">تظهر بعد الحفظ.</span>
          )}
        </div>
      </div>
    </>
  );
}

function StageRow({
  stage,
  name,
  grant,
  onChange,
}: {
  stage: OrderStage;
  name: string;
  grant: Grant | null;
  onChange: (grant: Grant | null) => void;
}) {
  const label = ORDER_STAGE_LABELS_AR[stage];
  const access = grant?.access ?? 'none';
  return (
    <li className="space-y-2 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <div
          className="grid w-48 shrink-0 grid-cols-3 gap-1 rounded-lg bg-muted/50 p-0.5"
          role="radiogroup"
          aria-label={`صلاحية ${name} في ${label}`}
        >
          {ACCESS_CHOICES.map((choice) => (
            <button
              key={choice.value}
              type="button"
              role="radio"
              aria-checked={access === choice.value}
              onClick={() =>
                onChange(
                  choice.value === 'none'
                    ? null
                    : {
                        access: choice.value,
                        scope: grant?.scope && grant.access === 'work' ? grant.scope : 'queue',
                        receive: choice.value === 'work' ? (grant?.receive ?? 'none') : 'none',
                      },
                )
              }
              className={cn(
                'min-h-9 rounded-md px-1 text-xs transition-colors',
                access === choice.value
                  ? 'bg-card font-semibold text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>
      {grant?.access === 'work' ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Select value={grant.receive} onValueChange={(v) => onChange({ ...grant, receive: v as OrderStageReceive })}>
            <SelectTrigger className="h-9 text-xs" aria-label={`استلام ${name} في ${label}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RECEIVES.map((r) => (
                <SelectItem key={r} value={r}>
                  يستلم: {ORDER_STAGE_RECEIVE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={grant.scope} onValueChange={(v) => onChange({ ...grant, scope: v as OrderStageScope })}>
            <SelectTrigger className="h-9 text-xs" aria-label={`ما يراه ${name} في ${label}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCOPES.map((s) => (
                <SelectItem key={s} value={s}>
                  يرى: {ORDER_STAGE_SCOPE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </li>
  );
}
