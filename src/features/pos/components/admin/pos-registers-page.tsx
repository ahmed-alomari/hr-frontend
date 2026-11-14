'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link2, Link2Off, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { branchesApi } from '@/features/hr/organization/lib/api/branches';
import { resolvePosInvoiceStyle, type PosInvoiceStyle, type PosRegister } from '@/features/pos/domain/types';
import { MultiSelect } from '@/components/ui/multi-select';
import { PosDataScope, usePosContext } from '@/features/pos/hooks/use-pos-context';
import { fetchPosUserChoices } from '@/features/pos/lib/pos-store';
import { usePosStockLink } from '@/features/pos/lib/pos-stock-link-api';
import { readPairedDevice, writePairedDevice } from '@/features/pos/lib/pos-store';
import { formatDateTime } from '@/features/pos/lib/format';
import { EmptyState, PosGate } from '@/features/pos/components/shared/pos-shared';

type Draft = {
  id?: string;
  name: string;
  code: string;
  branchId: string | null;
  warehouseId: string | null;
  isActive: boolean;
  invoiceStyle: PosInvoiceStyle | 'company';
  assignedUserIds: string[];
};

const NO_BRANCH = '__none__';
const NO_WAREHOUSE = '__none__';

function RegisterDialog({
  draft,
  onClose,
}: {
  draft: Draft | null;
  onClose: () => void;
}) {
  const { companyId, data, actions } = usePosContext();
  const [form, setForm] = React.useState<Draft | null>(draft);
  React.useEffect(() => setForm(draft), [draft]);

  const branches = useQuery({
    queryKey: ['pos', 'branches', companyId],
    queryFn: () => branchesApi.getAll({ companyId: companyId!, limit: 200 }),
    enabled: !!companyId && !!draft,
  });
  const link = usePosStockLink(companyId, !!draft);
  const users = useQuery({
    queryKey: ['pos', 'user-choices', companyId],
    queryFn: () => fetchPosUserChoices(companyId!),
    enabled: !!companyId && !!draft,
    staleTime: 60_000,
  });

  if (!form) return null;
  // Receipts already carry this code and its sales this branch (server rule).
  const numbered = (data.registers.find((r) => r.id === form.id)?.nextSequence ?? 1) > 1;
  const codeTaken = data.registers.some(
    (r) => r.id !== form.id && r.code.trim().toUpperCase() === form.code.trim().toUpperCase(),
  );
  const valid = form.name.trim() && form.code.trim() && !codeTaken;
  const warehouses = (link.data?.warehouses ?? []).filter(
    (w) => !form.branchId || w.branchId === form.branchId,
  );
  const openLinkedShift = data.sessions.find(
    (s) => s.registerId === form.id && s.status === 'open' && s.stockMode === 'inventory',
  );

  const save = async () => {
    if (!actions || !valid) return;
    const branch = branches.data?.items?.find((b) => b.id === form.branchId);
    const saved = await actions.saveRegister({
      id: form.id,
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      branchId: form.branchId,
      branchName: branch?.nameAr ?? (form.branchId ? data.registers.find((r) => r.id === form.id)?.branchName ?? null : null),
      // The server checks the warehouse and sets its name.
      ...(link.data?.installed ? { warehouseId: form.warehouseId } : {}),
      warehouseName: data.registers.find((r) => r.id === form.id)?.warehouseName ?? null,
      isActive: form.isActive,
      invoiceStyle: form.invoiceStyle === 'company' ? null : form.invoiceStyle,
      // The server checks each is the company's and sets the names.
      assignedUsers: form.assignedUserIds.map((id) => ({ id, name: '' })),
    });
    if (!saved) return;
    toast.success('حُفظت نقطة البيع');
    onClose();
  };

  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{form.id ? 'تعديل نقطة بيع' : 'نقطة بيع جديدة'}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60dvh] space-y-3 overflow-y-auto px-0.5">
          <div className="space-y-1.5">
            <Label>الاسم</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="الكاشير 1" />
          </div>
          <div className="space-y-1.5">
            <Label>رمز الترقيم</Label>
            <Input
              dir="ltr"
              value={form.code}
              disabled={numbered}
              onChange={(e) => setForm({ ...form, code: e.target.value.replace(/\s/g, '') })}
              placeholder="POS1"
            />
            <p className="text-xs text-muted-foreground">
              {numbered
                ? 'مقفل: صدرت إيصالات بهذا الرمز. لرمز آخر أنشئ نقطة جديدة.'
                : codeTaken
                  ? 'الرمز مستخدم في نقطة بيع أخرى.'
                  : 'بداية رقم الإيصال الظاهر، مثل POS1-000001. فريد في الشركة، ويُقفل بعد أول إيصال.'}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>الفرع</Label>
            <Select
              value={form.branchId ?? NO_BRANCH}
              disabled={numbered}
              onValueChange={(v) => setForm({ ...form, branchId: v === NO_BRANCH ? null : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر فرعًا" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_BRANCH}>بدون فرع</SelectItem>
                {(branches.data?.items ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.nameAr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {link.data?.installed ? (
            <div className="space-y-1.5">
              <Label>مستودع البيع</Label>
              <Select
                value={form.warehouseId ?? NO_WAREHOUSE}
                disabled={!!openLinkedShift}
                onValueChange={(v) => setForm({ ...form, warehouseId: v === NO_WAREHOUSE ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر مستودعًا" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_WAREHOUSE}>غير محدد</SelectItem>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {openLinkedShift
                  ? 'مقفل: في النقطة وردية مفتوحة مربوطة بالمخازن.'
                  : link.data.enabled
                    ? 'تصرف النقطة منه عند إتمام كل بيع. من مستودعات فرع النقطة فقط.'
                    : 'يُستخدم عند تفعيل تطبيق «ربط نقاط البيع بالمخازن». إن كان لفرع النقطة مستودع واحد يُختار تلقائيًا عند التفعيل.'}
              </p>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label>طريقة الفاتورة</Label>
            <Select
              value={form.invoiceStyle}
              onValueChange={(value) => setForm({ ...form, invoiceStyle: value as Draft['invoiceStyle'] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="company">حسب إعداد نقاط البيع</SelectItem>
                <SelectItem value="thermal">إيصال حراري</SelectItem>
                <SelectItem value="standard">فاتورة عادية A4</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              العادية تستخدم هوية الشركة، وتناسب نقطة تبيع بعرض سعر أو فاتورة بدل الإيصال الحراري.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>الموظفون المسندون إليها</Label>
            <MultiSelect
              options={(users.data ?? []).map((u) => ({ value: u.id, label: u.name }))}
              value={form.assignedUserIds}
              onChange={(assignedUserIds) => setForm({ ...form, assignedUserIds })}
              placeholder={users.isError ? 'تعذّر تحميل الموظفين' : 'اختر الموظفين'}
              disabled={users.isError}
              emptyMessage="لا موظفين"
            />
            <p className="text-xs text-muted-foreground">
              {form.assignedUserIds.length > 0
                ? 'لا يدخلها غيرهم، إلا صاحب الشركة. المشرف يبقى قادرًا على إغلاق ورديتها ومعالجة استثناءاتها إن كان يملك الصلاحية.'
                : 'لم يُسند أحد: لا يدخلها إلا صاحب الشركة.'}
            </p>
          </div>
          <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
            نشطة
            <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={save} disabled={!valid}>
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Registers() {
  const { companyId, data, actions, userName, can } = usePosContext();
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [pairedId, setPairedId] = React.useState<string | null>(null);
  const canManage = can('pos.devices.manage');

  React.useEffect(() => {
    if (companyId) setPairedId(readPairedDevice(companyId));
  }, [companyId]);

  const openSessionFor = (registerId: string) =>
    data.sessions.find((s) => s.registerId === registerId && s.status === 'open');

  const edit = (r: PosRegister) =>
    setDraft({
      id: r.id,
      name: r.name,
      code: r.code,
      branchId: r.branchId,
      warehouseId: r.warehouseId ?? null,
      isActive: r.isActive,
      assignedUserIds: (r.assignedUsers ?? []).map((u) => u.id),
      invoiceStyle: r.invoiceStyle ?? 'company',
    });

  const pairHere = async (registerId: string, registerName: string) => {
    if (!companyId || !actions) return;
    const current = pairedId && data.devices.find((d) => d.id === pairedId && !d.revokedAt);
    if (current) await actions.revokeDevice(current.id, userName);
    const id = await actions.pairDevice(registerId, `متصفح — ${registerName}`, userName);
    if (!id) return;
    writePairedDevice(companyId, id);
    setPairedId(id);
    toast.success('اقترن هذا المتصفح بنقطة البيع');
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <SetPageTitle titleAr="نقاط البيع والأجهزة" iconName="Settings" />
      <div className="flex justify-end">
        {canManage ? (
          <Button
            size="sm"
            onClick={() =>
              setDraft({
                assignedUserIds: [],
                name: '',
                code: `POS${data.registers.length + 1}`,
                branchId: null,
                warehouseId: null,
                isActive: true,
                invoiceStyle: 'company',
              })
            }
          >
            <Plus className="h-4 w-4" />
            نقطة بيع جديدة
          </Button>
        ) : null}
      </div>

      {data.registers.length === 0 ? (
        <EmptyState title="لا توجد نقاط بيع" description="أضف نقطة بيع لكل كاشير أو جهاز في الفرع." />
      ) : (
        <div className="space-y-3">
          {data.registers.map((r) => {
            const devices = data.devices.filter((d) => d.registerId === r.id && !d.revokedAt);
            const session = openSessionFor(r.id);
            return (
              <div key={r.id} className="rounded-xl border border-border bg-card p-4 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 font-semibold">
                      {r.name}
                      {r.isActive ? <Badge variant="success">نشطة</Badge> : <Badge variant="subtle">موقوفة</Badge>}
                      {session ? <Badge variant="warning">وردية مفتوحة</Badge> : null}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      الرمز {r.code} · {r.branchName ?? 'بدون فرع'} · آخر رقم {r.nextSequence - 1}
                      {' · '}
                      {resolvePosInvoiceStyle(r, data.settings) === 'standard' ? 'فاتورة عادية' : 'إيصال حراري'}
                      {' · '}
                      {r.assignedUsers?.length ? `مسندة إلى: ${r.assignedUsers.map((u) => u.name).join('، ')}` : 'غير مسندة: لصاحب الشركة فقط'}
                      {data.settings.stockMode === 'inventory' ? ` · المستودع: ${r.warehouseName ?? 'غير محدد'}` : ''}
                    </div>
                  </div>
                  {canManage ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => pairHere(r.id, r.name)}>
                        <Link2 className="h-4 w-4" />
                        إقران هذا المتصفح
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => edit(r)}>
                        <Pencil className="h-4 w-4" />
                        تعديل
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="mt-3 border-t border-border pt-3">
                  <div className="mb-1 text-xs font-semibold text-muted-foreground">الأجهزة المقترنة</div>
                  {devices.length === 0 ? (
                    <p className="text-xs text-muted-foreground">لا أجهزة مقترنة: تفتح من أي متصفح لموظف مسند. عند إقران جهاز لا تعمل إلا من أجهزتها المقترنة.</p>
                  ) : (
                    <ul className="space-y-1">
                      {devices.map((d) => (
                        <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                          <span>
                            {d.label}
                            {d.id === pairedId ? <Badge variant="outline" className="ms-2">هذا المتصفح</Badge> : null}
                            <span className="ms-2 text-xs text-muted-foreground">{formatDateTime(d.pairedAt)}</span>
                          </span>
                          {canManage ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                actions?.revokeDevice(d.id, userName);
                                if (d.id === pairedId && companyId) {
                                  writePairedDevice(companyId, null);
                                  setPairedId(null);
                                }
                              }}
                            >
                              <Link2Off className="h-4 w-4" />
                              إلغاء الاقتران
                            </Button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <RegisterDialog draft={draft} onClose={() => setDraft(null)} />
    </div>
  );
}

export function PosRegistersPage() {
  return (
    <PosDataScope days={0}>
      <PosGate permission="pos.devices.manage">
        <Registers />
      </PosGate>
    </PosDataScope>
  );
}
