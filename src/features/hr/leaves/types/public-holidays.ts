export interface HRPublicHolidayRecord {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  date: string;
  recurring: boolean;
  /** Dated holiday (Eid…): first and last day, YYYY-MM-DD. */
  startDate: string | null;
  endDate: string | null;
  sortOrder: number;
  isActive: boolean;
  updatedAt: string;
}
