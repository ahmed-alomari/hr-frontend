'use client';

import { use, useEffect, useState } from 'react';
import { employeesApi, type EmployeeResponseDto } from '@/features/hr/organization/employees/lib/api/employees';
import { EmployeeProfileBody } from '@/features/hr/organization/employees/components/employee-profile-body';
import type { Employee } from '@/features/hr/organization/employees/types';

function dtoToEmployee(dto: EmployeeResponseDto): Employee {
  return {
    id: dto.id,
    employeeCode: dto.employeeCode,
    name: dto.nameAr,
    nameEn: dto.nameEn ?? '',
    email: dto.email ?? '',
    phone: dto.phone ?? '',
    nationalId: dto.nationalId ?? '',
    nationality: dto.nationality ?? '',
    avatar: dto.avatar ?? '',
    position: dto.position ?? '',
    departmentId: dto.departmentId ?? '',
    branchId: dto.branchId ?? '',
    branchNameAr: dto.branchNameAr ?? undefined,
    departmentNameAr: dto.departmentNameAr ?? undefined,
    managerId: dto.managerId ?? null,
    contractType: (dto.contractType ?? 'permanent') as Employee['contractType'],
    contractStatus: (dto.contractStatus ?? 'active') as Employee['contractStatus'],
    startDate: dto.startDate ?? '',
    endDate: dto.endDate ?? undefined,
    baseSalary: parseFloat(dto.baseSalary ?? '0') || 0,
    housingAllowance: parseFloat(dto.housingAllowance ?? '0') || 0,
    transportAllowance: parseFloat(dto.transportAllowance ?? '0') || 0,
    otherAllowances: parseFloat(dto.otherAllowances ?? '0') || 0,
    gosi: parseFloat(dto.gosi ?? '0') || 0,
    bankAccount: dto.bankAccount ?? '',
    iban: dto.iban ?? '',
    address: dto.address ?? '',
    city: dto.city ?? '',
    emergencyContact: '',
    gender: (dto.gender === 'female' ? 'female' : 'male') as Employee['gender'],
    birthDate: dto.birthDate ?? '',
    maritalStatus: (dto.maritalStatus === 'married' ? 'married' : 'single') as Employee['maritalStatus'],
    role: dto.role ?? 'employee',
    assignedRoleId: dto.assignedRoleId ?? null,
    userId: dto.userId ?? dto.user?.id ?? null,
    hasUser: dto.hasUser ?? !!(dto.userId ?? dto.user?.id),
  };
}

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const dto = await employeesApi.getById(id);
        setEmployee(dtoToEmployee(dto));
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status;
        if (status === 404) {
          setNotFound(true);
        } else {
          setNotFound(true);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (notFound || !employee) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-semibold">الموظف غير موجود</p>
        <p className="mt-1 text-sm text-muted-foreground">تحقق من الرابط أو عد إلى قائمة الموظفين.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <EmployeeProfileBody employee={employee} onUpdated={setEmployee} />
    </div>
  );
}
