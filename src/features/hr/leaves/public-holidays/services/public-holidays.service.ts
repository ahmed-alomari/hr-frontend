import {
  publicHolidaysApi,
  type CreatePublicHolidayDto,
  type PublicHolidayResponseDto,
  type UpdatePublicHolidayDto,
} from '@/features/hr/leaves/public-holidays/lib/api/public-holidays';
import { resolveOrganizationScope } from '@/features/hr/organization/lib/api/organization-context';
import type { HRPublicHolidayRecord } from '@/features/hr/leaves/public-holidays/types';
import { toIso } from '@/features/hr/lib/map-dto';

export function mapPublicHolidayResponse(dto: PublicHolidayResponseDto): HRPublicHolidayRecord {
  return {
    id: dto.id,
    code: dto.code,
    nameAr: dto.nameAr,
    nameEn: dto.nameEn ?? dto.nameAr,
    date: dto.monthDay,
    recurring: dto.recurring,
    startDate: dto.startDate ?? null,
    endDate: dto.endDate ?? null,
    sortOrder: dto.sortOrder,
    isActive: dto.isActive,
    updatedAt: toIso(dto.updatedAt),
  };
}

export async function loadPublicHolidays() {
  const scope = await resolveOrganizationScope();
  const res = await publicHolidaysApi.getAll(
    scope.companyId ? { companyId: scope.companyId, limit: 200 } : { limit: 200 },
  );
  return {
    items: res.items.map(mapPublicHolidayResponse),
    companyId: scope.companyId ?? res.items[0]?.companyId ?? null,
  };
}

export async function createPublicHoliday(payload: CreatePublicHolidayDto) {
  return publicHolidaysApi.create(payload);
}

export async function updatePublicHoliday(id: string, payload: UpdatePublicHolidayDto) {
  return publicHolidaysApi.update(id, payload);
}

export async function deletePublicHoliday(id: string) {
  return publicHolidaysApi.remove(id);
}
