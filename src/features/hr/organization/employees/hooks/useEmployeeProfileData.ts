'use client';

import * as React from 'react';
import { useEmployeeProfileAttendance } from '@/features/hr/organization/employees/hooks/useEmployeeProfileAttendance';
import { useServerDirectoryPagination } from '@/components/ui/paged-list';
import { fetchAllPaginatedItems } from '@/features/hr/lib/api/client';
import { violationRecordsApi, type ViolationRecordResponseDto } from '@/features/hr/discipline/lib/api/violation-records';
import { employeeContractsApi } from '@/features/hr/contracts/lib/contracts-api';
import { mapEmployeeContractFromApi, type HRContractRecord } from '@/features/hr/contracts/lib/contracts-store';
import { useDefaultCompanyId } from '@/features/hr/organization/lib/default-company-id';
import type { Employee } from '@/features/hr/organization/employees/types';
import type { EmployeeProfileSectionId } from '@/features/hr/organization/employees/constants/EmployeeProfileSections';
import { payslipsApi } from '@/features/hr/payroll/lib/api/payslips';
import type { Payslip } from '@/features/hr/payroll/types';
import { employeePayslipsApi } from '@/features/hr/organization/employees/lib/api/employee-payslips';
import {
  mapEmployeePayslipHistoryItem,
  mapPayslipListItem,
} from '@/features/hr/organization/employees/services/employee-payslips.service';
import {
  employeeAttachmentsApi,
  type EmployeeAttachmentDto,
} from '@/features/hr/organization/employees/lib/api/employee-attachments';
import { SALARY_ATTACHMENT_DOCUMENT_TYPES } from '@/features/hr/organization/employees/constants/employee-attachment-document-types';
import { organizationListArchiveQuery } from '@/features/hr/organization/lib/archive-scope';

export type EmployeePayslipCounts = {
  totalPayslips: number;
  draft: number;
  approved: number;
  paid: number;
};

export type { ViolationRecordResponseDto };

function mapViolationRecord(v: ViolationRecordResponseDto) {
  const vt = v.violationType;
  const normKind = (k: string | null | undefined): 'amount' | 'hours' | 'day' =>
    k === 'amount' ? 'amount' : k === 'days' || k === 'day' ? 'day' : 'hours';
  return {
    id: v.id,
    employeeId: v.employeeId,
    recordNumber: v.recordNumber,
    typeNameAr: vt?.nameAr || v.description || 'مخالفة',
    typeCode: vt?.code ?? '',
    date: v.violationDate,
    description: v.description,
    status: v.status ?? 'pending',
    notes: v.notes ?? '',
    attachmentsNote: v.attachmentsNote ?? '',
    typeHasDeduction: vt?.hasDeduction ?? false,
    typeDeductionValue: vt?.deductionValue ? Number(vt.deductionValue) : 0,
    typeDeductionKind: normKind(vt?.deductionKind),
    needsInvestigation: vt?.needsInvestigation ?? v.violationTypeNeedsInvestigation ?? false,
    investigations: (v.investigations ?? []).map((inv) => ({
      id: inv.id,
      investigationDate: inv.investigationDate,
      employeeStatement: inv.employeeStatement ?? '',
      witnessStatement: inv.witnessStatement ?? '',
      result: inv.result,
      recommendation: inv.recommendation,
      deductionKind: normKind(inv.deductionType),
      deductionValue: inv.deductionValue ? Number(inv.deductionValue) : 0,
    })),
  };
}

export function useEmployeeProfileData(
  employee: Employee,
  activeSection: EmployeeProfileSectionId,
) {
  const companyId = useDefaultCompanyId();
  const [employeeContracts, setEmployeeContracts] = React.useState<HRContractRecord[]>([]);
  const [employeePayslipSeries, setEmployeePayslipSeries] = React.useState<Payslip[]>([]);
  const [payslipCounts, setPayslipCounts] = React.useState<EmployeePayslipCounts | null>(null);
  const [salaryAttachments, setSalaryAttachments] = React.useState<EmployeeAttachmentDto[]>([]);
  const [salaryAttachmentsLoading, setSalaryAttachmentsLoading] = React.useState(false);
  const [roseFormsCount] = React.useState(0);

  const attendance = useEmployeeProfileAttendance(
    employee,
    companyId,
    activeSection === 'attendance',
  );

  const loadViolationsPage = React.useCallback(async (page: number, pageSize: number) => {
    const res = await violationRecordsApi.getAll({
      employeeId: employee.id,
      companyId: companyId ?? undefined,
      page,
      limit: pageSize,
    });
    return {
      items: res.items,
      total: res.pagination?.total ?? res.items.length,
    };
  }, [employee.id, companyId]);

  /** Every violation record of this employee (export). */
  const fetchAllViolations = React.useCallback(async () => {
    const { items } = await fetchAllPaginatedItems((page, limit) =>
      violationRecordsApi.getAll({
        employeeId: employee.id,
        companyId: companyId ?? undefined,
        page,
        limit,
      }),
    );
    return (items as ViolationRecordResponseDto[]).map(mapViolationRecord);
  }, [employee.id, companyId]);

  const {
    items: violationRecords,
    loading: violationsLoading,
    pagination: violationsPagination,
    total: violationsTotal,
  } = useServerDirectoryPagination<ViolationRecordResponseDto>(loadViolationsPage, {
    enabled: activeSection === 'violations' && !!employee.id,
    resetDeps: [employee.id, companyId],
  });

  React.useEffect(() => {
    if (!employee.id || activeSection !== 'contracts' || !companyId) return;
    let cancelled = false;
    void employeeContractsApi
      .list({ companyId, employeeId: employee.id, limit: 100 })
      .then((res) => {
        if (!cancelled) {
          setEmployeeContracts(res.items.map(mapEmployeeContractFromApi));
        }
      })
      .catch(() => {
        if (!cancelled) setEmployeeContracts([]);
      });
    return () => { cancelled = true; };
  }, [employee.id, activeSection, companyId]);

  React.useEffect(() => {
    if (!employee.id || activeSection !== 'salary' || !companyId) return;
    let cancelled = false;

    void (async () => {
      // Preferred path for salaries: GET /payroll/payslips?employeeId=
      try {
        const psRes = await payslipsApi.list({
          companyId,
          employeeId: employee.id,
          page: 1,
          limit: 200,
        });
        if (cancelled) return;
        const items = psRes.items.map(mapPayslipListItem);
        setEmployeePayslipSeries(items);
        setPayslipCounts({
          totalPayslips: psRes.pagination.total || items.length,
          draft: items.filter((p) => p.status === 'draft').length,
          approved: items.filter((p) => p.status === 'approved').length,
          paid: items.filter((p) => p.status === 'paid').length,
        });
      } catch {
        if (cancelled) return;
        try {
          const history = await employeePayslipsApi.getHistory(employee.id, { companyId });
          if (cancelled) return;
          setEmployeePayslipSeries(
            history.payslipsHistory.map((item) => mapEmployeePayslipHistoryItem(item, employee.id)),
          );
          setPayslipCounts(history.counts);
        } catch {
          if (!cancelled) {
            setEmployeePayslipSeries([]);
            setPayslipCounts(null);
          }
        }
      }
    })();

    return () => { cancelled = true; };
  }, [employee.id, activeSection, companyId]);

  React.useEffect(() => {
    if (!employee.id || activeSection !== 'salary' || !companyId) {
      setSalaryAttachments([]);
      return;
    }
    let cancelled = false;
    setSalaryAttachmentsLoading(true);

    void employeeAttachmentsApi
      .getAll({
        companyId,
        employeeId: employee.id,
        page: 1,
        limit: 200,
        ...organizationListArchiveQuery('active'),
      })
      .then((res) => {
        if (cancelled) return;
        const salaryTypes = new Set<string>(SALARY_ATTACHMENT_DOCUMENT_TYPES);
        setSalaryAttachments(
          res.items.filter((item) => item.documentType && salaryTypes.has(item.documentType)),
        );
      })
      .catch(() => {
        if (!cancelled) setSalaryAttachments([]);
      })
      .finally(() => {
        if (!cancelled) setSalaryAttachmentsLoading(false);
      });

    return () => { cancelled = true; };
  }, [employee.id, activeSection, companyId]);

  const employeeAssignments = React.useMemo(
    () =>
      attendance.shiftAssignments.map((a) => ({
        id: a.id,
        templateId: a.shiftTemplateId,
        templateNameAr: a.shiftTemplateNameAr,
        templateColorHex: a.shiftTemplateColorHex,
        openShiftHours: a.openShiftHours ?? undefined,
        targetType: 'employee' as const,
        targetId: a.employeeId,
        targetLabel: employee.name,
        effectiveFrom: a.effectiveFrom,
        effectiveTo: a.effectiveTo,
        isActive: a.isActive,
        batchId: a.batchId ?? undefined,
      })),
    [attendance.shiftAssignments, employee.name],
  );

  const shiftTemplates = React.useMemo(
    () =>
      attendance.shiftTemplates.map((t) => ({
        id: t.id,
        nameAr: t.nameAr,
        nameEn: t.nameEn ?? '',
        colorHex: t.colorHex,
        effectiveFrom: t.effectiveFrom,
        isActive: t.isActive,
        weekDays: t.weekDays,
      })),
    [attendance.shiftTemplates],
  );

  const allEmployeeEvents = attendance.employeeEvents;

  const employeeViolations = React.useMemo(
    () => violationRecords.map(mapViolationRecord),
    [violationRecords],
  );

  return {
    branch: null as { id: string; name: string } | null,
    department: null as { id: string; name: string } | null,
    manager: null as { id: string; name: string } | null,
    ...attendance,
    allEmployeeEvents,
    employeeAssignments,
    shiftTemplates,
    employeeEvents: allEmployeeEvents,
    employeeCheckpoints: attendance.checkpointLinks,
    checkpoints: attendance.checkpoints,
    linksLoadError: attendance.linksLoadError,
    violationsLoading,
    violationsPagination,
    violationsTotal,
    employeeViolations,
    fetchAllViolations,
    employeeContracts,
    employeePayslipSeries,
    payslipCounts,
    salaryAttachments,
    salaryAttachmentsLoading,
    roseFormsCount,
  };
}
