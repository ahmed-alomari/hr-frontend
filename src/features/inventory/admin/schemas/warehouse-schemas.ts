import { z } from 'zod';

export const INCOMING_STEP_OPTIONS = [
  { value: 1, label: 'خطوة واحدة — استلام وتخزين معًا' },
  { value: 2, label: 'خطوتان — استلام ثم تخزين' },
  { value: 3, label: '3 خطوات — استلام، فحص جودة، ثم تخزين' },
] as const;

export const OUTGOING_STEP_OPTIONS = [
  { value: 1, label: 'خطوة واحدة — توصيل مباشر' },
  { value: 2, label: 'خطوتان — تجهيز ثم توصيل' },
  { value: 3, label: '3 خطوات — تجهيز، رزم، ثم توصيل' },
] as const;

export const LOCATION_TYPE_OPTIONS = [
  {
    value: 'supplier',
    label: 'المورد',
    hint: 'موقع افتراضي يمثل مصدر المنتجات القادمة من الموردين.',
  },
  {
    value: 'view',
    label: 'افتراضي',
    hint: 'موقع تنظيمي لبناء هيكل المستودع. لا يخزّن منتجات مباشرة.',
  },
  {
    value: 'internal',
    label: 'داخلي',
    hint: 'المواقع الفعلية داخل المستودع التي تُخزَّن فيها المنتجات.',
  },
  {
    value: 'customer',
    label: 'العميل',
    hint: 'موقع افتراضي يمثل وجهة المنتجات المرسلة للعملاء.',
  },
  {
    value: 'inventory',
    label: 'خسارة المخزون',
    hint: 'مقابل افتراضي لعمليات تصحيح المخزون (الجرد).',
  },
  {
    value: 'production',
    label: 'الإنتاج',
    hint: 'مقابل افتراضي لعمليات الإنتاج (استهلاك مكوّنات وإنتاج تام).',
  },
  {
    value: 'transit',
    label: 'العابر',
    hint: 'للنقل بين المستودعات أو الشركات.',
  },
] as const;

export const REMOVAL_STRATEGY_OPTIONS = [
  { value: 'fifo', label: 'الوارد أولاً يخرج أولاً (FIFO)' },
  { value: 'lifo', label: 'الوارد أخيراً يخرج أولاً (LIFO)' },
  { value: 'closest', label: 'أقرب موقع' },
  { value: 'fewest_packages', label: 'أقل عدد ممكن من الطرود' },
  { value: 'fefo', label: 'ما تنتهي صلاحيته أولاً يخرج أولاً (FEFO)' },
] as const;

export const warehouseFormSchema = z.object({
  code: z.string().min(1, 'الاسم المختصر مطلوب').max(32),
  nameAr: z.string().min(1, 'اسم المستودع مطلوب').max(120),
  address: z.string().max(250).optional().or(z.literal('')),
  /**
   * Optional. Empty → `branchId: null` (central warehouse when allowed).
   * Otherwise a branch UUID.
   */
  branchId: z.string().optional().or(z.literal('')),
  status: z.enum(['active', 'inactive']),
  incomingSteps: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  outgoingSteps: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  buyToResupply: z.boolean(),
});

export type WarehouseFormValues = z.infer<typeof warehouseFormSchema>;

export const WAREHOUSE_FORM_DEFAULT_VALUES: WarehouseFormValues = {
  code: '',
  nameAr: '',
  address: '',
  branchId: '',
  status: 'active',
  incomingSteps: 1,
  outgoingSteps: 1,
  buyToResupply: false,
};

export const warehouseLocationFormSchema = z.object({
  nameAr: z.string().min(1, 'اسم الموقع مطلوب').max(120),
  parentLocationId: z.string().optional().or(z.literal('')),
  locationType: z.enum(['internal', 'view', 'supplier', 'customer', 'inventory', 'production', 'transit']),
  storageCategory: z.string().max(80).optional().or(z.literal('')),
  barcode: z.string().max(64).optional().or(z.literal('')),
  replenish: z.boolean(),
  cycleCountFrequencyDays: z.number().int().min(0),
  lastCountAt: z.string().optional().or(z.literal('')),
  nextCountAt: z.string().optional().or(z.literal('')),
  removalStrategy: z.enum(['fifo', 'lifo', 'closest', 'fewest_packages', 'fefo']),
  isActive: z.boolean(),
});

export type WarehouseLocationFormValues = z.infer<typeof warehouseLocationFormSchema>;

export const WAREHOUSE_LOCATION_FORM_DEFAULT_VALUES: WarehouseLocationFormValues = {
  nameAr: '',
  parentLocationId: '',
  locationType: 'internal',
  storageCategory: '',
  barcode: '',
  replenish: false,
  cycleCountFrequencyDays: 0,
  lastCountAt: '',
  nextCountAt: '',
  removalStrategy: 'fifo',
  isActive: true,
};

export const warehouseOperationFormSchema = z.object({
  occurredAt: z.string().min(1, 'التاريخ مطلوب'),
  notes: z.string().max(500).optional().or(z.literal('')),
  /** جهة اتصال حقيقية (اختياري) — عند اختيارها تُشتق partnerName منها تلقائيًا. */
  partnerId: z.string().optional().or(z.literal('')),
  partnerName: z.string().max(160).optional().or(z.literal('')),
  sourceDocument: z.string().max(160).optional().or(z.literal('')),
  /** مطلوب عند الإنشاء من قائمة المخزون العامة (بدون مستودع محدد) */
  sourceWarehouseId: z.string().optional().or(z.literal('')),
  destinationWarehouseId: z.string().optional().or(z.literal('')),
  transferMode: z.enum(['direct', 'two_step']).optional(),
  /** إلزامي — بدون productId لا تُطبَّق الحركة على المخزون */
  productId: z.string().min(1, 'اختر منتجًا من الكتالوج'),
  productName: z.string().min(1, 'اسم المنتج مطلوب').max(160),
  sku: z.string().max(64).optional().or(z.literal('')),
  /** للجرد/التعديل: الكمية النظرية/السابقة */
  theoreticalQuantity: z.number().min(0).optional(),
  quantity: z.number({ error: 'الكمية مطلوبة' }).min(0, 'الكمية لا يمكن أن تكون سالبة'),
  fromLocationId: z.string().optional().or(z.literal('')),
  toLocationId: z.string().optional().or(z.literal('')),
});

export type WarehouseOperationFormValues = z.infer<typeof warehouseOperationFormSchema>;

export const WAREHOUSE_OPERATION_FORM_DEFAULT_VALUES: WarehouseOperationFormValues = {
  occurredAt: new Date().toISOString().slice(0, 16),
  notes: '',
  partnerId: '',
  partnerName: '',
  sourceDocument: '',
  sourceWarehouseId: '',
  destinationWarehouseId: '',
  transferMode: 'direct',
  productId: '',
  productName: '',
  sku: '',
  theoreticalQuantity: 0,
  quantity: 1,
  fromLocationId: '',
  toLocationId: '',
};
