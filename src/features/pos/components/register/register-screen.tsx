'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRightLeft,
  ChevronRight,
  Clock,
  FileText,
  HandCoins,
  LayoutGrid,
  Lock,
  MonitorSmartphone,
  MoreVertical,
  PauseCircle,
  PlayCircle,
  Receipt,
  ShieldAlert,
  ShoppingCart,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/shared/utils';
import { resolvePosInvoiceStyle, type PosDiscount, type PosRegister, type PosSale, type PosSaleLine } from '@/features/pos/domain/types';
import { posRoutes } from '@/features/pos/constants/routes';
import { PosDataScope, usePosContext } from '@/features/pos/hooks/use-pos-context';
import { discountPercentOf, highestDiscountPercent, paidAmount, priceLines, round2 } from '@/features/pos/lib/calc';
import { formatDateTime, formatMoney, parseAmount } from '@/features/pos/lib/format';
import { newId, readPairedDevice, type PosDiscountApproval } from '@/features/pos/lib/pos-store';
import { variantHeadline } from '@/features/pos/lib/variant-label';
import { saleToPrintable, sessionToPrintable } from '@/features/pos/lib/receipt';
import { summarizeSession } from '@/features/pos/lib/session-summary';
import { CloseSessionDialog } from '@/features/pos/components/shared/close-session-dialog';
import { PosGate, PrintPreviewDialog } from '@/features/pos/components/shared/pos-shared';
import {
  ApprovalDialog,
  type ApprovalRequest,
  CartPanel,
  CustomerDialog,
  LineEditDialog,
  OrderDiscountDialog,
  type CartState,
} from '@/features/pos/components/register/cart-panel';
import { PaymentDialog } from '@/features/pos/components/register/payment-dialog';
import { CollectCreditDialog } from '@/features/pos/components/register/collect-credit-dialog';
import { ProductPanel, type PickedItem } from '@/features/pos/components/register/product-panel';

const EMPTY_CART: CartState = { lines: [], orderDiscount: null, customer: { kind: 'walk_in' } };
const REGISTER_KEY = 'pos.register.current';

/** The server's approval lasts ten minutes: this screen stops trusting it a little earlier. */
const approvalUntil = () => Date.now() + 9 * 60_000;
const approvalCovers = (approval: { until: number; maxPercent: number } | null, percent: number) =>
  !!approval && approval.until > Date.now() && approval.maxPercent + 1e-6 >= percent;

/** Its assigned users, and the company's super admin. The server decides; this only guides. */
const mayWorkRegister = (register: PosRegister, userId: string, isSuperAdmin: boolean) =>
  isSuperAdmin || (register.assignedUsers ?? []).some((u) => u.id === userId);

function describeLines(lines: Array<{ name: string; variantName: string | null; quantity: number }>): string {
  return lines
    .map((line) => {
      const option = line.variantName ? variantHeadline(line.name, line.variantName) : '';
      const label = option && option !== line.name ? `${line.name} — ${option}` : line.name;
      return `${line.quantity}× ${label}`;
    })
    .join('، ');
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: the cart just does not survive a reload.
  }
}

/* ── Register choice and shift opening ───────────────────────────────── */

function ExitLinks() {
  return (
    <div className="flex items-center justify-center gap-2 border-t border-border/60 pt-3">
      <Button asChild variant="outline" size="sm">
        <Link href={posRoutes.overview}>
          <ChevronRight className="h-4 w-4" />
          نقاط البيع
        </Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href="/">
          <LayoutGrid className="h-4 w-4" />
          التطبيقات
        </Link>
      </Button>
    </div>
  );
}

function RegisterPicker({ onPick }: { onPick: (id: string) => void }) {
  const { data } = usePosContext();
  const { userId, isSuperAdmin } = usePosContext();
  const active = data.registers.filter((r) => r.isActive && mayWorkRegister(r, userId, isSuperAdmin));
  return (
    <div className="m-auto flex w-full max-w-lg flex-col gap-3 p-6">
      <h1 className="text-lg font-bold">اختر نقطة البيع</h1>
      {active.length === 0 && data.registers.some((r) => r.isActive) ? (
        <p className="text-sm text-muted-foreground">
          لا توجد نقطة بيع مسندة إليك. يسندك صاحب الشركة إليها من «نقاط البيع والأجهزة».
        </p>
      ) : active.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          لا نقاط بيع نشطة. <Link className="text-primary underline" href={posRoutes.registers}>أنشئ نقطة بيع</Link>.
        </p>
      ) : (
        active.map((r) => {
          const open = data.sessions.find((s) => s.registerId === r.id && s.status === 'open');
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onPick(r.id)}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4 text-start shadow-soft hover:border-primary/50"
            >
              <span>
                <span className="block font-semibold">{r.name}</span>
                <span className="text-xs text-muted-foreground">{r.code} · {r.branchName ?? 'بدون فرع'}</span>
              </span>
              {open ? <Badge variant="success">{open.cashierName}</Badge> : <Badge variant="outline">مغلقة</Badge>}
            </button>
          );
        })
      )}
      <ExitLinks />
    </div>
  );
}

function OpenShift({ registerId, onBack }: { registerId: string; onBack: () => void }) {
  const { data, actions, userId, userName, can, currency } = usePosContext();
  const register = data.registers.find((r) => r.id === registerId);
  const [float, setFloat] = React.useState('');
  const allowed = can('pos.session.open');
  const draining = Boolean(data.settings.stockModeChange);

  return (
    <div className="m-auto flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div>
        <h1 className="text-lg font-bold">فتح وردية — {register?.name}</h1>
        <p className="text-sm text-muted-foreground">عُدّ النقد في الدرج وأدخله عهدةً للوردية.</p>
      </div>
      <div className="space-y-1.5">
        <Label>العهدة النقدية</Label>
        <Input autoFocus dir="ltr" inputMode="decimal" className="h-12 text-xl" placeholder="0.00" value={float} onChange={(e) => setFloat(e.target.value)} />
      </div>
      <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
        وضع المخزون لهذه الوردية: <b>{data.settings.stockMode === 'inventory' ? 'مربوط بالمخازن' : 'دون تتبع'}</b>. يبقى ثابتًا حتى الإغلاق.
      </div>
      {draining ? (
        <p className="rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
          تبديل وضع المخزون قيد التنفيذ: لا تُفتح ورديات جديدة حتى يكتمل من إعدادات نقاط البيع.
        </p>
      ) : null}
      <Button
        className="h-12"
        disabled={!allowed || !actions || draining}
        onClick={async () => {
          const id = await actions?.openSession(registerId, userId, userName, round2(parseAmount(float)), data.settings.stockMode);
          if (id) toast.success(`فُتحت الوردية بعهدة ${formatMoney(parseAmount(float), currency)}`);
        }}
      >
        <PlayCircle className="h-5 w-5" />
        فتح الوردية
      </Button>
      {!allowed ? <p className="text-xs text-destructive">ليس لديك صلاحية فتح وردية.</p> : null}
      <Button variant="ghost" onClick={onBack}>نقطة بيع أخرى</Button>
      <ExitLinks />
    </div>
  );
}

/* ── Small dialogs of the screen ─────────────────────────────────────── */

function CashMoveDialog({ open, sessionId, onClose }: { open: boolean; sessionId: string; onClose: () => void }) {
  const { actions, userName } = usePosContext();
  const [type, setType] = React.useState<'in' | 'out'>('out');
  const [amount, setAmount] = React.useState('');
  const [reason, setReason] = React.useState('');
  React.useEffect(() => {
    setAmount('');
    setReason('');
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>حركة نقدية</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {(['in', 'out'] as const).map((t) => (
            <Button key={t} variant={type === t ? 'default' : 'outline'} onClick={() => setType(t)}>
              {t === 'in' ? 'قبض (إيداع في الدرج)' : 'صرف (من الدرج)'}
            </Button>
          ))}
        </div>
        <Input dir="ltr" inputMode="decimal" placeholder="المبلغ" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input placeholder="السبب" value={reason} onChange={(e) => setReason(e.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button
            disabled={parseAmount(amount) <= 0 || !reason.trim()}
            onClick={() => {
              actions?.addCashMovement(sessionId, type, round2(parseAmount(amount)), reason.trim(), userName);
              toast.success('سُجّلت الحركة');
              onClose();
            }}
          >
            تسجيل
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ListsDialog({
  open,
  registerId,
  cartEmpty,
  onClose,
  onResumeSale,
  onResumeCart,
}: {
  open: boolean;
  registerId: string;
  cartEmpty: boolean;
  onClose: () => void;
  onResumeSale: (sale: PosSale) => void;
  onResumeCart: (cartId: string) => void;
}) {
  const { data, currency } = usePosContext();
  const openSales = data.sales.filter((s) => s.registerId === registerId && s.status === 'awaiting_payment');
  const held = data.heldCarts.filter((c) => c.registerId === registerId);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>مبيعات مفتوحة وسلال معلّقة</DialogTitle>
        </DialogHeader>
        {!cartEmpty ? <p className="text-xs text-warning">علّق السلة الحالية أو أفرغها قبل الاستئناف.</p> : null}
        <div className="space-y-4 text-sm">
          <div>
            <div className="mb-1 text-xs font-semibold text-muted-foreground">بانتظار الدفع ({openSales.length})</div>
            {openSales.length === 0 ? <p className="text-xs text-muted-foreground">لا شيء.</p> : null}
            {openSales.map((s) => {
              const pending = s.payments.some((p) => p.status === 'pending' || p.status === 'unknown');
              return (
                <div key={s.id} className="flex items-start justify-between gap-2 border-t border-border py-2">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(s.createdAt)} · {formatMoney(s.totals.total, currency)}
                      {pending ? <Badge variant="warning" className="ms-2">محاولة بطاقة معلّقة</Badge> : null}
                      {paidAmount(s.payments) > 0 ? <Badge variant="outline" className="ms-2">مدفوع جزئيًا</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-sm leading-snug">{describeLines(s.lines)}</p>
                  </div>
                  <Button size="sm" disabled={!cartEmpty} onClick={() => onResumeSale(s)}>استئناف</Button>
                </div>
              );
            })}
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-muted-foreground">سلال معلّقة ({held.length})</div>
            {held.length === 0 ? <p className="text-xs text-muted-foreground">لا شيء.</p> : null}
            {held.map((c) => (
              <div key={c.id} className="flex items-start justify-between gap-2 border-t border-border py-2">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">
                    {c.label} · {formatDateTime(c.createdAt)}
                  </div>
                  <p className="mt-0.5 text-sm leading-snug">{describeLines(c.lines)}</p>
                </div>
                <Button size="sm" disabled={!cartEmpty} onClick={() => onResumeCart(c.id)}>استئناف</Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── The register ────────────────────────────────────────────────────── */

function Register() {
  const router = useRouter();
  const params = useSearchParams();
  const ctx = usePosContext();
  const { companyId, data, actions, userId, userName, currency, can } = ctx;
  const settings = data.settings;

  const [registerId, setRegisterId] = React.useState<string | null>(null);
  React.useEffect(() => {
    setRegisterId(params.get('register') ?? readJson<string | null>(REGISTER_KEY, null));
  }, [params]);

  const register = data.registers.find((r) => r.id === registerId && r.isActive) ?? null;
  const invoiceStyle = resolvePosInvoiceStyle(register ?? undefined, settings);
  const session = register ? data.sessions.find((s) => s.registerId === register.id && s.status === 'open') ?? null : null;

  const cartKey = `pos.cart.${companyId}.${registerId}`;
  const [cart, setCartState] = React.useState<CartState>(EMPTY_CART);
  const [saleId, setSaleId] = React.useState<string | null>(null);
  // A second tap on «الدفع» while the server answers would commit the cart twice.
  const committing = React.useRef(false);
  React.useEffect(() => {
    if (!registerId) return;
    setCartState(readJson(cartKey, EMPTY_CART));
    setSaleId(params.get('sale'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerId]);
  const setCart = (next: CartState) => {
    setCartState(next);
    writeJson(cartKey, next);
  };

  const [editing, setEditing] = React.useState<PosSaleLine | null>(null);
  const [customerOpen, setCustomerOpen] = React.useState(false);
  const [discountOpen, setDiscountOpen] = React.useState(false);
  const [payOpen, setPayOpen] = React.useState(false);
  const [listsOpen, setListsOpen] = React.useState(false);
  const [cashOpen, setCashOpen] = React.useState(false);
  const [closeOpen, setCloseOpen] = React.useState(false);
  const [xOpen, setXOpen] = React.useState(false);
  const [collectOpen, setCollectOpen] = React.useState(false);
  const [receiptSaleId, setReceiptSaleId] = React.useState<string | null>(null);
  const [approval, setApproval] = React.useState<ApprovalRequest | null>(null);
  // The supervisor's approval of this cart's discount, until it is committed.
  const [cartApproval, setCartApproval] = React.useState<(PosDiscountApproval & { until: number }) | null>(null);
  const [zSessionId, setZSessionId] = React.useState<string | null>(null);
  // Phones show the products or the cart, one at a time (side by side from md).
  const [phoneView, setPhoneView] = React.useState<'products' | 'cart'>('products');
  const zSession = zSessionId ? data.sessions.find((s) => s.id === zSessionId) ?? null : null;

  const pickRegister = (id: string) => {
    writeJson(REGISTER_KEY, id);
    setRegisterId(id);
    router.replace(`${posRoutes.register}?register=${id}`);
  };

  if (!register) return <RegisterPicker onPick={pickRegister} />;
  // Who opened a shift can finish it, even if taken off the register since.
  if (
    !mayWorkRegister(register, userId, ctx.isSuperAdmin) &&
    session?.cashierId !== userId &&
    !(session && can('pos.session.close-others'))
  ) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-3 p-6 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-warning" />
        <p className="text-sm">
          لست مسندًا إلى نقطة البيع <b>{register.name}</b>. يسندك إليها صاحب الشركة من «نقاط البيع والأجهزة».
        </p>
        <Button variant="ghost" onClick={() => setRegisterId(null)}>نقطة بيع أخرى</Button>
        <ExitLinks />
      </div>
    );
  }
  // A register with paired devices opens and sells only from them (the server decides).
  const pairedDevices = data.devices.filter((d) => d.registerId === register.id && !d.revokedAt);
  if (
    !ctx.isSuperAdmin &&
    pairedDevices.length > 0 &&
    !pairedDevices.some((d) => d.id === readPairedDevice(companyId ?? '')) &&
    session?.cashierId !== userId
  ) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-3 p-6 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-warning" />
        <p className="text-sm">
          نقطة البيع <b>{register.name}</b> تعمل من أجهزتها المقترنة فقط، وهذا المتصفح ليس منها. يقرنه المدير من «نقاط البيع والأجهزة».
        </p>
        <Button variant="ghost" onClick={() => setRegisterId(null)}>نقطة بيع أخرى</Button>
        <ExitLinks />
      </div>
    );
  }
  if (!session) {
    return (
      <>
        <OpenShift registerId={register.id} onBack={() => setRegisterId(null)} />
        <PrintPreviewDialog
          open={!!zSession}
          onOpenChange={(o) => !o && setZSessionId(null)}
          title="تقرير إغلاق الوردية (Z)"
          invoiceStyle={invoiceStyle}
          document={zSession ? sessionToPrintable(zSession, register, summarizeSession(data, zSession)) : null}
        />
      </>
    );
  }
  if (session.cashierId !== userId) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-3 p-6 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-warning" />
        <p className="text-sm">
          الوردية مفتوحة على هذه النقطة باسم <b>{session.cashierName}</b> منذ {formatDateTime(session.openedAt)}. لا يبيع أحد على وردية غيره.
        </p>
        {can('pos.session.close-others') ? (
          <Button variant="outline" onClick={() => setCloseOpen(true)}>إغلاق ورديته (مشرف)</Button>
        ) : null}
        <Button variant="ghost" onClick={() => setRegisterId(null)}>نقطة بيع أخرى</Button>
        <ExitLinks />
        <CloseSessionDialog session={closeOpen ? session : null} onOpenChange={setCloseOpen} />
      </div>
    );
  }

  const openSale = saleId ? data.sales.find((s) => s.id === saleId) ?? null : null;
  const locked = !!openSale && openSale.status === 'awaiting_payment';
  const priced = locked
    ? { lines: openSale!.lines, totals: openSale!.totals }
    : priceLines(cart.lines, cart.orderDiscount, settings.tax);
  const shownCart: CartState = locked
    ? { lines: openSale!.lines, orderDiscount: openSale!.orderDiscount, customer: openSale!.customer }
    : { ...cart, lines: priced.lines };

  const itemCount = shownCart.lines.reduce((sum, l) => sum + l.quantity, 0);
  const sessionSummary = summarizeSession(data, session);
  const waiting = data.sales.filter((s) => s.registerId === register.id && s.status === 'awaiting_payment').length;
  const heldCount = data.heldCarts.filter((c) => c.registerId === register.id).length;
  // Owed invoices stay collectable after credit is turned off.
  const canCollect =
    can('pos.credit.collect') &&
    (settings.paymentMethods.credit || data.sales.some((s) => s.status === 'completed' && (s.credit?.due ?? 0) > 0));

  /* cart operations */

  const addItem = ({ product, variant }: PickedItem) => {
    if (locked) return;
    const same = cart.lines.find(
      (l) => l.productId === product.id && l.variantId === (variant?.id ?? null) && l.unitPrice === l.sourcePrice && !l.discount,
    );
    if (same) {
      setCart({ ...cart, lines: cart.lines.map((l) => (l.id === same.id ? { ...l, quantity: l.quantity + 1 } : l)) });
      return;
    }
    const price = variant?.price ?? product.price;
    const line: PosSaleLine = {
      id: newId(),
      productId: product.id,
      variantId: variant?.id ?? null,
      name: product.name,
      variantName: variant?.name ?? null,
      sku: variant?.sku ?? product.sku,
      quantity: 1,
      sourcePrice: price,
      unitPrice: price,
      discount: null,
      discountAmount: 0,
      taxRate: 0,
      taxAmount: 0,
      total: price,
      returnedQuantity: 0,
    };
    setCart({ ...cart, lines: [...cart.lines, line] });
  };

  /** A discount within the cashier limit applies; above it needs a supervisor (or is refused). */
  const withDiscountCheck = (base: number, discount: PosDiscount | null, label: string, apply: () => void) => {
    const percent = discountPercentOf(base, discount);
    if (percent <= settings.discounts.cashierMaxPercent) return apply();
    if (!settings.discounts.supervisorApprovalAbove) {
      toast.error(`أعلى خصم مسموح ${settings.discounts.cashierMaxPercent}%`);
      return;
    }
    askApproval(percent, `${label}: ${percent.toFixed(1)}%`, apply);
  };

  /** Runs `then` once the cart's approval covers `percent`, asking the supervisor if it does not. */
  const askApproval = (percent: number, label: string, then: (approval: PosDiscountApproval) => void) => {
    if (approvalCovers(cartApproval, percent)) {
      then(cartApproval!);
      return;
    }
    // One approval covers the whole cart: it asks for its highest discount so far.
    const covering = Math.max(percent, approvalCovers(cartApproval, 0) ? cartApproval!.maxPercent : 0);
    setApproval({
      title: 'موافقة مشرف على الخصم',
      detail: `${label} يتجاوز حد الكاشير ${settings.discounts.cashierMaxPercent}%.`,
      percent: covering,
      onApproved: (given) => {
        setCartApproval({ ...given, until: approvalUntil() });
        then(given);
      },
    });
  };

  const saveLine = (patch: { quantity: number; discount: PosDiscount | null; unitPrice: number }) => {
    if (!editing) return;
    const apply = () => {
      setCart({ ...cart, lines: cart.lines.map((l) => (l.id === editing.id ? { ...l, ...patch } : l)) });
      setEditing(null);
    };
    withDiscountCheck(patch.unitPrice * patch.quantity, patch.discount, editing.name, apply);
  };

  const pay = async () => {
    if (!actions || committing.current) return;
    if (locked) {
      setPayOpen(true);
      return;
    }
    if (cart.lines.length === 0) return;
    // A discount above the limit (this cart, or one resumed or reloaded) needs its approval first.
    const highest = highestDiscountPercent(priced.lines, cart.orderDiscount);
    if (highest > settings.discounts.cashierMaxPercent + 1e-9 && settings.discounts.supervisorApprovalAbove) {
      if (!approvalCovers(cartApproval, highest)) {
        askApproval(highest, `الخصم ${highest.toFixed(1)}%`, (given) => void commit(given.token));
        return;
      }
    }
    await commit(highest > settings.discounts.cashierMaxPercent + 1e-9 ? (cartApproval?.token ?? null) : null);
  };

  const commit = async (discountApproval: string | null) => {
    if (!actions || committing.current) return;
    // Commit: prices and snapshot fixed in the "server"; stock reserved there when linked.
    committing.current = true;
    const id = await actions.commitSale({
      discountApproval,
      registerId: register.id,
      sessionId: session.id,
      cashierName: userName,
      stockSource: session.stockMode,
      customer: cart.customer,
      lines: priced.lines,
      orderDiscount: cart.orderDiscount,
      totals: priced.totals,
    }).finally(() => {
      committing.current = false;
    });
    if (!id) return;
    setCart(EMPTY_CART);
    setCartApproval(null);
    setSaleId(id);
    setPayOpen(true);
  };

  const cancelOpenSale = async () => {
    if (!openSale || !actions) return;
    const pending = openSale.payments.some((p) => p.kind === 'payment' && (p.status === 'pending' || p.status === 'unknown'));
    if (pending) {
      toast.error('احسم محاولة البطاقة المعلّقة أولًا (تمت / رُفضت / لم يُخصم).');
      return;
    }
    if (paidAmount(openSale.payments) > 0) {
      if (!(await actions.markException(openSale.id, 'أُلغي بعد تحصيل مبلغ: يحتاج رد المال أو معالجة من المشرف.'))) return;
      toast.warning('حُوّل البيع إلى «استثناء دفع» لمعالجة المبلغ المحصّل.');
    } else {
      if (!(await actions.cancelSale(openSale.id, 'إلغاء قبل الدفع', userName))) return;
      toast.success('أُلغي البيع وحُرّر الحجز');
    }
    setSaleId(null);
  };

  const receiptSale = receiptSaleId ? data.sales.find((s) => s.id === receiptSaleId) ?? null : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-border bg-card px-2 py-2 md:flex-wrap md:px-3">
        <Button asChild size="sm" variant="ghost" className="max-md:h-9 max-md:w-9 max-md:px-0">
          <Link href={posRoutes.overview} aria-label="نقاط البيع">
            <ChevronRight className="h-4 w-4" />
            <span className="max-md:hidden">نقاط البيع</span>
          </Link>
        </Button>
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <MonitorSmartphone className="h-4 w-4 shrink-0 text-muted-foreground max-md:hidden" />
          <b className="truncate">{register.name}</b>
          <span className="truncate text-muted-foreground max-md:hidden">· {userName}</span>
          <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
            <Clock className="h-3 w-3" />
            {formatDateTime(session.openedAt)}
          </span>
          <Badge className="shrink-0 max-md:hidden" variant={session.stockMode === 'inventory' ? 'default' : 'outline'}>
            {session.stockMode === 'inventory' ? 'مربوط بالمخازن' : 'دون تتبع'}
          </Badge>
        </div>
        {/* Phone: the waiting list, and the rest in one menu. */}
        <div className="ms-auto flex shrink-0 gap-1 md:hidden">
          <Button size="sm" variant="outline" className="h-9" onClick={() => setListsOpen(true)}>
            <PauseCircle className="h-4 w-4" />
            {waiting + heldCount > 0 ? waiting + heldCount : null}
            <span className="sr-only">المعلّقة</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-9 w-9 px-0" aria-label="إجراءات الوردية">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              {can('pos.cash.move') ? (
                <DropdownMenuItem onSelect={() => setCashOpen(true)}>
                  <ArrowRightLeft className="h-4 w-4" />
                  حركة نقدية
                </DropdownMenuItem>
              ) : null}
              {canCollect ? (
                <DropdownMenuItem onSelect={() => setCollectOpen(true)}>
                  <HandCoins className="h-4 w-4" />
                  تحصيل آجل
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={() => setXOpen(true)}>
                <FileText className="h-4 w-4" />
                تقرير X
              </DropdownMenuItem>
              {can('pos.return') ? (
                <DropdownMenuItem asChild>
                  <Link href={posRoutes.returns}>
                    <Receipt className="h-4 w-4" />
                    مرتجع
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {can('pos.session.close') ? (
                <DropdownMenuItem onSelect={() => setCloseOpen(true)}>
                  <Lock className="h-4 w-4" />
                  إغلاق الوردية
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="ms-auto hidden flex-wrap gap-1 md:flex">
          <Button size="sm" variant="outline" onClick={() => setListsOpen(true)}>
            <PauseCircle className="h-4 w-4" />
            المعلّقة {waiting + heldCount > 0 ? `(${waiting + heldCount})` : ''}
          </Button>
          {can('pos.cash.move') ? (
            <Button size="sm" variant="outline" onClick={() => setCashOpen(true)}>
              <ArrowRightLeft className="h-4 w-4" />
              حركة نقدية
            </Button>
          ) : null}
          {canCollect ? (
            <Button size="sm" variant="outline" onClick={() => setCollectOpen(true)}>
              <HandCoins className="h-4 w-4" />
              تحصيل آجل
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => setXOpen(true)}>
            <FileText className="h-4 w-4" />
            تقرير X
          </Button>
          {can('pos.return') ? (
            <Button asChild size="sm" variant="outline">
              <Link href={posRoutes.returns}>
                <Receipt className="h-4 w-4" />
                مرتجع
              </Link>
            </Button>
          ) : null}
          {can('pos.session.close') ? (
            <Button size="sm" variant="outline" onClick={() => setCloseOpen(true)}>
              <Lock className="h-4 w-4" />
              إغلاق الوردية
            </Button>
          ) : null}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 p-2 md:grid-cols-[minmax(0,1fr)_340px] md:p-3 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div
          className={cn(
            'flex min-h-0 flex-col',
            locked && 'pointer-events-none opacity-60',
            phoneView === 'cart' && 'max-md:hidden',
          )}
        >
          {companyId ? (
            <ProductPanel
              companyId={companyId}
              onlyPosAvailable={settings.onlyPosAvailableProducts}
              disabled={locked}
              onPick={addItem}
            />
          ) : null}
        </div>
        <CartPanel
          className={cn(phoneView === 'products' && 'max-md:hidden')}
          header={
            <button
              type="button"
              className="flex items-center gap-1 border-b border-border px-3 py-2.5 text-sm font-medium text-primary md:hidden"
              onClick={() => setPhoneView('products')}
            >
              <ChevronRight className="h-4 w-4" />
              {locked ? 'المنتجات' : 'إضافة منتجات'}
            </button>
          }
          cart={shownCart}
          totals={priced.totals}
          currency={currency}
          locked={locked}
          lockedLabel={
            locked ? (
              <div className="flex items-center justify-between gap-2">
                <span>
                  بيع مثبّت بانتظار الدفع{openSale?.stockReserved ? '، والكمية محجوزة في المستودع' : ''}. المدفوع{' '}
                  {formatMoney(paidAmount(openSale!.payments), currency)}.
                </span>
                <Button size="sm" variant="ghost" className="h-7" onClick={cancelOpenSale}>
                  إلغاء البيع
                </Button>
              </div>
            ) : undefined
          }
          canDiscount={can('pos.discount')}
          onQuantity={(lineId, delta) =>
            setCart({
              ...cart,
              lines: cart.lines.map((l) => (l.id === lineId ? { ...l, quantity: Math.max(1, l.quantity + delta) } : l)),
            })
          }
          onEditLine={(line) => setEditing(cart.lines.find((l) => l.id === line.id) ?? null)}
          onRemoveLine={(lineId) => setCart({ ...cart, lines: cart.lines.filter((l) => l.id !== lineId) })}
          onCustomer={() => setCustomerOpen(true)}
          onOrderDiscount={() => setDiscountOpen(true)}
          onHold={async () => {
            // The cart is cleared once the server kept it.
            const held = await actions?.holdCart({
              registerId: register.id,
              label: cart.customer.kind !== 'walk_in' ? cart.customer.name : `سلة ${heldCount + 1}`,
              lines: cart.lines,
              customer: cart.customer,
              orderDiscount: cart.orderDiscount,
            });
            if (!held) return;
            setCart(EMPTY_CART);
            setPhoneView('products');
            toast.success('عُلّقت السلة');
          }}
          onVoid={() => {
            void actions?.voidCart(userName, cart.lines.length, priced.totals.total);
            setCart(EMPTY_CART);
            setPhoneView('products');
          }}
          onPay={pay}
        />
      </div>

      {/* Phone: the cart in one tap from the products. */}
      {phoneView === 'products' ? (
        <div className="border-t border-border bg-card p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden">
          <Button
            className="h-12 w-full justify-between text-base"
            variant={itemCount > 0 || locked ? 'default' : 'outline'}
            onClick={() => setPhoneView('cart')}
          >
            <span className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              {locked ? 'متابعة الدفع' : 'السلة'}
              {itemCount > 0 ? (
                <span className="rounded-full bg-primary-foreground/20 px-2 text-sm tabular-nums">{itemCount}</span>
              ) : null}
            </span>
            <span className="font-bold tabular-nums">{formatMoney(priced.totals.total, currency)}</span>
          </Button>
        </div>
      ) : null}

      <LineEditDialog
        line={editing}
        canDiscount={can('pos.discount')}
        canOverridePrice={settings.discounts.allowPriceOverride && can('pos.price.override')}
        onClose={() => setEditing(null)}
        onSave={saveLine}
      />
      <OrderDiscountDialog
        open={discountOpen}
        value={cart.orderDiscount}
        onClose={() => setDiscountOpen(false)}
        onSave={(d) =>
          withDiscountCheck(priced.totals.subtotal, d, 'خصم الفاتورة', () => {
            setCart({ ...cart, orderDiscount: d });
            setDiscountOpen(false);
          })
        }
      />
      <CustomerDialog
        open={customerOpen}
        value={cart.customer}
        onClose={() => setCustomerOpen(false)}
        onSave={(c) => {
          setCart({ ...cart, customer: c });
          setCustomerOpen(false);
        }}
      />
      <ApprovalDialog request={approval} onClose={() => setApproval(null)} />
      {payOpen && saleId ? (
        <PaymentDialog
          saleId={saleId}
          sessionId={session.id}
          onClose={() => setPayOpen(false)}
          onCompleted={(number) => {
            setPayOpen(false);
            setReceiptSaleId(saleId);
            setSaleId(null);
            setPhoneView('products');
            toast.success(`اكتمل البيع ${number}`);
          }}
        />
      ) : null}
      <ListsDialog
        open={listsOpen}
        registerId={register.id}
        cartEmpty={cart.lines.length === 0 && !locked}
        onClose={() => setListsOpen(false)}
        onResumeSale={(s) => {
          setSaleId(s.id);
          setListsOpen(false);
          setPayOpen(true);
        }}
        onResumeCart={(id) => {
          const held = data.heldCarts.find((c) => c.id === id);
          if (!held) return;
          setCart({ lines: held.lines, orderDiscount: held.orderDiscount, customer: held.customer });
          actions?.dropHeldCart(id);
          setListsOpen(false);
        }}
      />
      <CashMoveDialog open={cashOpen} sessionId={session.id} onClose={() => setCashOpen(false)} />
      <CollectCreditDialog open={collectOpen} sessionId={session.id} onClose={() => setCollectOpen(false)} />
      <CloseSessionDialog
        session={closeOpen ? session : null}
        onOpenChange={setCloseOpen}
        onClosed={() => setZSessionId(session.id)}
      />
      <PrintPreviewDialog
        open={xOpen}
        onOpenChange={setXOpen}
        title="تقرير الوردية (X)"
        invoiceStyle={invoiceStyle}
        document={sessionToPrintable(session, register, sessionSummary)}
      />
      <PrintPreviewDialog
        open={!!receiptSale}
        onOpenChange={(o) => !o && setReceiptSaleId(null)}
        title={`${invoiceStyle === 'standard' ? 'الفاتورة' : 'الإيصال'} ${receiptSale?.number ?? ''}`}
        invoiceStyle={invoiceStyle}
        document={receiptSale ? saleToPrintable(receiptSale, register, { invoiceStyle }) : null}
        footer={
          <Button variant="outline" onClick={() => setReceiptSaleId(null)}>
            بيع جديد
          </Button>
        }
      />
    </div>
  );
}

export function PosRegisterScreen() {
  return (
    <PosDataScope days={0}>
    <PosGate permission="pos.sell">
      <Register />
    </PosGate>
    </PosDataScope>
  );
}
