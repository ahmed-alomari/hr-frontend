export type PublicHolidayResponseDto = {
  id: string;
  companyId: string;
  code: string;
  nameAr: string;
  nameEn: string | null;
  monthDay: string;
  recurring: boolean;
  startDate: string | null;
  endDate: string | null;
  sortOrder: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
};

export type CreatePublicHolidayDto = {
  companyId: string;
  code: string;
  nameAr: string;
  nameEn?: string | null;
  monthDay: string;
  recurring?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  notes?: string | null;
};

export type UpdatePublicHolidayDto = Omit<Partial<CreatePublicHolidayDto>, 'companyId'>;

export type PublicHolidayListQuery = {
  page?: number;
  limit?: number;
  companyId?: string;
};
