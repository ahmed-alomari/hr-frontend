/** Packaging types of a unit of measure: a plain constant, no zod. */
export const PACKAGING_TYPE_OPTIONS = [
  { value: 'unit', labelAr: 'وحدة' },
  { value: 'pack', labelAr: 'علبة' },
  { value: 'box', labelAr: 'صندوق' },
  { value: 'pallet', labelAr: 'منصة' },
  { value: 'other', labelAr: 'أخرى' },
] as const;
