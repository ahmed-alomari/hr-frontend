/**
 * Sample data for the prototype: one small company over the last six weeks.
 * Everything is linked (custodies → expenses → balances → reports), and dates
 * are relative to `today`, so the dashboard always shows recent activity.
 * Amounts are written in Yemeni-rial magnitudes and scaled for other
 * currencies, then stored in minor units of `currency`.
 */
import { buildBearing, custodyPayments, singleAllocation } from '../../domain/expense-builder';
import { currencySpec, toMinor, type Minor } from '../../domain/money';
import { approvalPlan, OPEN_POLICY } from '../../domain/policy';
import { ORG } from '../../domain/types';
import type {
  GroupPolicy,
  Advance,
  Category,
  CostCenter,
  Custody,
  CustodyMove,
  Expense,
  ExpenseGroup,
  ExpensesData,
  ExpensesSettings,
  Participant,
  PaymentPart,
  Settlement,
  TxnStatus,
} from '../../domain/types';

export const DEMO = {
  ahmed: 'demo:ahmed',
  sara: 'demo:sara',
  khaled: 'demo:khaled',
  mona: 'demo:mona',
  fahd: 'demo:fahd',
} as const;

const demoParticipants: Participant[] = [
  { id: DEMO.ahmed, name: 'أحمد السقاف (المدير المالي)', email: 'ahmed@demo.local', kind: 'user', source: 'demo', active: true },
  { id: DEMO.sara, name: 'سارة الحكيمي (المشتريات)', email: 'sara@demo.local', kind: 'user', source: 'demo', active: true },
  { id: DEMO.khaled, name: 'خالد باوزير (مندوب ميداني)', email: 'khaled@demo.local', kind: 'user_contact', source: 'demo', active: true },
  { id: DEMO.mona, name: 'منى العريقي (الموارد)', email: 'mona@demo.local', kind: 'user', source: 'demo', active: true },
  { id: DEMO.fahd, name: 'فهد القاضي (سائق — بلا حساب)', email: null, kind: 'contact', source: 'demo', active: true },
];

const categories: Category[] = [
  { id: 'cat:transport', name: 'نقل ومواصلات', color: '#0ea5e9' },
  { id: 'cat:fuel', name: 'وقود', color: '#f97316', maxAmount: null },
  { id: 'cat:hospitality', name: 'ضيافة', color: '#a855f7' },
  { id: 'cat:office', name: 'مستلزمات مكتبية', color: '#14b8a6' },
  { id: 'cat:maintenance', name: 'صيانة', color: '#ef4444' },
  { id: 'cat:telecom', name: 'اتصالات وإنترنت', color: '#6366f1' },
  { id: 'cat:travel', name: 'سفر وإقامة', color: '#eab308' },
  { id: 'cat:petty', name: 'نثريات', color: '#64748b' },
];

const costCenters: CostCenter[] = [
  { id: 'cc:admin', code: 'CC-100', name: 'الإدارة العامة' },
  { id: 'cc:sales', code: 'CC-200', name: 'المبيعات' },
  { id: 'cc:ops', code: 'CC-300', name: 'العمليات والفرع' },
];

const groups: ExpenseGroup[] = [
  {
    id: 'grp:aden',
    name: 'رحلة عمل — عدن',
    description: 'زيارة عملاء عدن (3 أيام)',
    memberIds: [DEMO.ahmed, DEMO.khaled, DEMO.sara],
    costCenterId: 'cc:sales',
    policy: OPEN_POLICY,
  },
  {
    id: 'grp:branch',
    name: 'صيانة الفرع الرئيسي',
    description: 'أعمال صيانة وتجهيز',
    memberIds: [DEMO.khaled, DEMO.fahd],
    costCenterId: 'cc:ops',
    policy: OPEN_POLICY,
  },
  {
    id: 'grp:housing',
    name: 'سكن المندوبين المشترك',
    description: 'مصاريف مشتركة يتقاسمها الساكنون',
    memberIds: [DEMO.khaled, DEMO.fahd, DEMO.mona],
    policy: OPEN_POLICY,
  },
];

/** The company's default group «عام» with this policy. */
export function homeGroup(policy: Partial<GroupPolicy> = {}): ExpenseGroup {
  return { id: 'grp:home', name: 'عام', memberIds: [], isDefault: true, policy: { ...OPEN_POLICY, ...policy } };
}

export const DEFAULT_SETTINGS: ExpensesSettings = {
  mode: 'simple',
  fallbackCurrency: 'YER',
  visibility: 'own',
  fullViewerIds: [],
};

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Yemeni-rial magnitudes → this currency (rough, for sample data only). */
function scaleFor(code: string): number {
  if (code === 'YER') return 1;
  if (['KWD', 'BHD', 'OMR', 'JOD'].includes(code)) return 0.0012;
  return 0.015;
}

/** An empty company (no sample records), used by "start empty". */
export function emptyData(currency: string): ExpensesData {
  return {
    version: 1,
    demoParticipants: [],
    categories: categories.map((c) => ({ ...c })),
    costCenters: [],
    groups: [homeGroup()],
    custodies: [],
    expenses: [],
    custodyMoves: [],
    advances: [],
    settlements: [],
    settings: { ...DEFAULT_SETTINGS, fallbackCurrency: currency },
  };
}

export function buildDemoData(currencyCode: string, today: string): ExpensesData {
  const currency = currencySpec(currencyCode);
  const scale = scaleFor(currency.code);
  const m = (yer: number): Minor => toMinor(Math.round(yer * scale * 100) / 100, currency.decimals);
  const day = (offset: number) => addDays(today, offset);
  const stamp = (offset: number, hour = 9) => `${day(offset)}T${String(hour).padStart(2, '0')}:00:00.000Z`;

  let seq = 0;
  const base = (offset: number, createdBy: string, status: TxnStatus = 'approved') => {
    seq += 1;
    return {
      currency: currency.code,
      date: day(offset),
      status,
      createdBy,
      createdAt: stamp(offset, 8 + (seq % 9)),
      submittedAt: status === 'draft' ? null : stamp(offset, 10),
      decidedBy: status === 'approved' || status === 'rejected' ? DEMO.ahmed : null,
      decidedAt: status === 'approved' || status === 'rejected' ? stamp(offset, 12) : null,
      approval: status === 'submitted' ? approvalPlan({ ...OPEN_POLICY, approval: 'always', approverIds: [DEMO.ahmed], approvalMode: 'any_one' }, 1, createdBy).approval : null,
    };
  };

  const custodies: Custody[] = [
    {
      id: 'cus:khaled',
      holderId: DEMO.khaled,
      purpose: 'عهدة تشغيلية — مصاريف الفرع والزيارات',
      currency: currency.code,
      limit: m(400_000),
      status: 'open',
      openedAt: day(-40),
      createdBy: DEMO.ahmed,
    },
    {
      id: 'cus:sara',
      holderId: DEMO.sara,
      purpose: 'عهدة مشتريات صغيرة',
      currency: currency.code,
      limit: m(150_000),
      status: 'closed',
      openedAt: day(-38),
      closedAt: day(-6),
      createdBy: DEMO.ahmed,
    },
  ];

  const custodyMoves: CustodyMove[] = [
    { id: 'mv:1', kind: 'custody_move', custodyId: 'cus:khaled', type: 'issue', amount: m(150_000), ...base(-40, DEMO.ahmed) },
    { id: 'mv:2', kind: 'custody_move', custodyId: 'cus:sara', type: 'issue', amount: m(120_000), ...base(-38, DEMO.ahmed) },
    { id: 'mv:3', kind: 'custody_move', custodyId: 'cus:khaled', type: 'topup', amount: m(60_000), ...base(-18, DEMO.ahmed) },
    { id: 'mv:4', kind: 'custody_move', custodyId: 'cus:sara', type: 'return', amount: m(10_500), ...base(-6, DEMO.sara) },
    { id: 'mv:5', kind: 'custody_move', custodyId: 'cus:khaled', type: 'topup', amount: m(80_000), ...base(-6, DEMO.ahmed) },
  ];

  const expense = (
    id: string,
    offset: number,
    createdBy: string,
    description: string,
    categoryId: string,
    yer: number,
    opts: {
      status?: TxnStatus;
      payments?: (amount: Minor) => PaymentPart[];
      bearing?: { method: 'org' | 'equal' | 'amounts' | 'percent'; parties?: string[]; entered?: Record<string, number> };
      costCenterId?: string;
      groupId?: string;
      attachments?: number;
      note?: string;
    } = {},
  ): Expense => {
    const amount = m(yer);
    const group = opts.groupId ? groups.find((g) => g.id === opts.groupId) : undefined;
    const costCenterId = opts.costCenterId ?? group?.costCenterId ?? null;
    const bearing = buildBearing(opts.bearing?.method ?? 'org', amount, opts.bearing?.parties ?? [], opts.bearing?.entered);
    return {
      id,
      kind: 'expense',
      description,
      amount,
      categoryId,
      groupId: opts.groupId ?? null,
      costCenterId,
      payments: opts.payments ? opts.payments(amount) : [{ source: 'org', amount }],
      bearing,
      allocation: singleAllocation(amount, costCenterId, opts.groupId),
      attachments: Array.from({ length: opts.attachments ?? 0 }, (_, i) => ({
        id: `att:${id}:${i}`,
        name: `إيصال-${id.slice(4)}.jpg`,
        type: 'image/jpeg',
        size: 180_000,
      })),
      note: opts.note ?? null,
      ...base(offset, createdBy, opts.status),
    };
  };

  const fromKhaled = (amount: Minor): PaymentPart[] => [{ source: 'custody', custodyId: 'cus:khaled', payerId: DEMO.khaled, amount }];
  const fromSara = (amount: Minor): PaymentPart[] => [{ source: 'custody', custodyId: 'cus:sara', payerId: DEMO.sara, amount }];
  const personal = (payerId: string) => (amount: Minor): PaymentPart[] => [{ source: 'personal', payerId, amount }];

  const expenses: Expense[] = [
    expense('exp:01', -39, DEMO.khaled, 'وقود سيارة التوزيع', 'cat:fuel', 18_000, { payments: fromKhaled, costCenterId: 'cc:ops', attachments: 1 }),
    expense('exp:02', -37, DEMO.sara, 'أوراق طباعة وأحبار', 'cat:office', 42_500, { payments: fromSara, costCenterId: 'cc:admin', attachments: 1 }),
    expense('exp:03', -35, DEMO.khaled, 'أجرة نقل بضاعة للعميل', 'cat:transport', 25_000, { payments: fromKhaled, costCenterId: 'cc:sales', attachments: 1 }),
    expense('exp:04', -33, DEMO.mona, 'باقة إنترنت المكتب', 'cat:telecom', 30_000, { costCenterId: 'cc:admin' }),
    expense('exp:05', -30, DEMO.sara, 'قرطاسية وملفات', 'cat:office', 51_000, { payments: fromSara, costCenterId: 'cc:admin', attachments: 2 }),
    expense('exp:06', -28, DEMO.ahmed, 'تذاكر وإقامة — رحلة عدن', 'cat:travel', 180_000, {
      groupId: 'grp:aden',
      payments: personal(DEMO.ahmed),
      attachments: 2,
      note: 'دفعها أحمد من ماله وتتحملها المنشأة',
    }),
    expense('exp:07', -27, DEMO.ahmed, 'عشاء فريق الرحلة (شخصي، يتقاسمونه)', 'cat:hospitality', 27_000, {
      groupId: 'grp:aden',
      payments: personal(DEMO.ahmed),
      bearing: { method: 'equal', parties: [DEMO.ahmed, DEMO.khaled, DEMO.sara] },
      note: 'ليس على المنشأة: كل واحد يتحمل حصته، الفرق يذهب لأولهم',
    }),
    expense('exp:08', -26, DEMO.khaled, 'وقود — رحلة عدن', 'cat:fuel', 22_000, { groupId: 'grp:aden', payments: fromKhaled, attachments: 1 }),
    expense('exp:09', -22, DEMO.khaled, 'قطع غيار مكيف الفرع', 'cat:maintenance', 64_000, { groupId: 'grp:branch', payments: fromKhaled, attachments: 1 }),
    expense('exp:10', -20, DEMO.khaled, 'أجرة فني تركيب', 'cat:maintenance', 35_000, { groupId: 'grp:branch', payments: fromKhaled }),
    expense('exp:11', -17, DEMO.sara, 'ضيافة اجتماع العملاء', 'cat:hospitality', 16_000, { payments: fromSara, costCenterId: 'cc:sales' }),
    expense('exp:12', -15, DEMO.khaled, 'وقود سيارة التوزيع', 'cat:fuel', 20_000, { payments: fromKhaled, costCenterId: 'cc:ops', attachments: 1 }),
    expense('exp:13', -14, DEMO.mona, 'غداء ضيوف (جزء شخصي لمنى)', 'cat:hospitality', 24_000, {
      costCenterId: 'cc:admin',
      bearing: { method: 'amounts', parties: [ORG, DEMO.mona], entered: { [ORG]: m(18_000), [DEMO.mona]: m(6_000) } },
      note: 'دفعتها المنشأة، وحصة منى الشخصية عليها',
    }),
    expense('exp:14', -12, DEMO.khaled, 'فاتورة كهرباء السكن المشترك', 'cat:petty', 30_000, {
      groupId: 'grp:housing',
      payments: personal(DEMO.khaled),
      bearing: { method: 'percent', parties: [DEMO.khaled, DEMO.fahd, DEMO.mona], entered: { [DEMO.khaled]: 40, [DEMO.fahd]: 40, [DEMO.mona]: 20 } },
    }),
    expense('exp:15', -9, DEMO.khaled, 'صيانة إطارات (تجاوز العهدة)', 'cat:maintenance', 48_000, {
      groupId: 'grp:branch',
      payments: (amount) => custodyPayments(amount, 'cus:khaled', DEMO.khaled, m(26_000)),
      attachments: 1,
      note: 'نفدت العهدة: 26 ألفاً منها والباقي من مال خالد — مستحق له على المنشأة',
    }),
    expense('exp:16', -7, DEMO.mona, 'اشتراك برنامج تصميم', 'cat:telecom', 45_000, { costCenterId: 'cc:admin', status: 'rejected', note: 'رُفض: يوجد اشتراك سارٍ' }),
    expense('exp:17', -5, DEMO.khaled, 'وقود سيارة التوزيع', 'cat:fuel', 21_000, { payments: fromKhaled, costCenterId: 'cc:ops', attachments: 1 }),
    expense('exp:18', -4, DEMO.sara, 'طابعة مكتب صغيرة', 'cat:office', 95_000, { costCenterId: 'cc:admin', status: 'void', note: 'أُلغي: سُجّل مرتين' }),
    expense('exp:19', -2, DEMO.khaled, 'أجرة نقل عينات', 'cat:transport', 15_000, { payments: fromKhaled, costCenterId: 'cc:sales', status: 'submitted', attachments: 1 }),
    expense('exp:20', -1, DEMO.sara, 'ضيافة زوار المعرض', 'cat:hospitality', 38_000, { costCenterId: 'cc:sales', status: 'submitted' }),
    expense('exp:21', 0, DEMO.khaled, 'وقود — زيارة عملاء', 'cat:fuel', 19_000, { payments: fromKhaled, costCenterId: 'cc:sales', status: 'submitted', attachments: 1 }),
  ];
  const voided = expenses.find((e) => e.id === 'exp:18')!;
  voided.voidedBy = DEMO.ahmed;
  voided.voidedAt = stamp(-3);
  voided.voidReason = 'سُجّل مرتين';

  const advances: Advance[] = [
    { id: 'adv:1', kind: 'advance', personId: DEMO.mona, amount: m(50_000), purpose: 'سلفة شخصية', ...base(-25, DEMO.ahmed) },
  ];

  const settlements: Settlement[] = [
    { id: 'set:1', kind: 'settlement', fromId: ORG, toId: DEMO.ahmed, amount: m(180_000), method: 'transfer', note: 'تعويض تذاكر رحلة عدن', ...base(-21, DEMO.ahmed) },
    { id: 'set:2', kind: 'settlement', fromId: DEMO.mona, toId: ORG, amount: m(20_000), method: 'payroll', note: 'قسط من السلفة', ...base(-10, DEMO.mona) },
    { id: 'set:3', kind: 'settlement', fromId: DEMO.khaled, toId: DEMO.ahmed, amount: m(9_000), method: 'cash', note: 'حصة عشاء الرحلة', ...base(-8, DEMO.khaled) },
  ];

  return {
    version: 1,
    demoParticipants: demoParticipants.map((p) => ({ ...p })),
    categories: categories.map((c) => (c.id === 'cat:hospitality' ? { ...c, maxAmount: m(40_000) } : { ...c })),
    costCenters: costCenters.map((c) => ({ ...c })),
    groups: [
      homeGroup({
        approval: 'above',
        approvalAbove: m(5_000),
        attachment: 'above',
        attachmentAbove: m(50_000),
        monthlyLimitPerPerson: m(300_000),
        approverIds: [DEMO.ahmed],
        approvalMode: 'any_one',
      }),
      ...groups.map((g) => ({ ...g, memberIds: [...g.memberIds] })),
    ],
    custodies,
    expenses,
    custodyMoves,
    advances,
    settlements,
    settings: { visibility: 'all', fullViewerIds: [], mode: 'advanced', fallbackCurrency: currency.code },
  };
}
