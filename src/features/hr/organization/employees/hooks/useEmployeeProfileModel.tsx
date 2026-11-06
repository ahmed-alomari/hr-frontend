'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import type { Employee } from '@/features/hr/organization/employees/types';
import { EMPLOYEE_PROFILE_SECTIONS } from '@/features/hr/organization/employees/constants/EmployeeProfileSections';
import type { EmployeeProfileSectionId } from '@/features/hr/organization/employees/constants/EmployeeProfileSections';
import { EMPLOYEE_ATTACHMENT_LIBRARY_GROUPS } from '@/features/hr/organization/employees/constants/employee-attachment-document-types';
import { useEmployeeProfileData } from '@/features/hr/organization/employees/hooks/useEmployeeProfileData';
import { useEmployeeProfileLeave } from '@/features/hr/organization/employees/hooks/useEmployeeProfileLeave';
import { useEmployeeProfilePersonal } from '@/features/hr/organization/employees/hooks/useEmployeeProfilePersonal';
import { useEmployeeProfileRosePdf } from '@/features/hr/organization/employees/hooks/useEmployeeProfileRosePdf';
import { useEmployeeProfilePermissions } from '@/features/hr/organization/employees/hooks/useEmployeeProfilePermissions';
import { useEmployeeCreateUser } from '@/features/hr/organization/employees/hooks/useEmployeeCreateUser';
import { useEmployeeLinkUser } from '@/features/hr/organization/employees/hooks/useEmployeeLinkUser';
import { useEmployeeProfileAssignments } from '@/features/hr/organization/employees/hooks/useEmployeeProfileAssignments';
import { useEmployeeProfileRequests } from '@/features/hr/organization/employees/hooks/useEmployeeProfileRequests';
import { useEmployeeProfileAuditLog } from '@/features/hr/organization/employees/hooks/useEmployeeProfileAuditLog';
import { useEmployeeProfileAttachments } from '@/features/hr/organization/employees/hooks/useEmployeeProfileAttachments';

const SECTIONS = EMPLOYEE_PROFILE_SECTIONS;

function parseProfileSection(value: string | null): EmployeeProfileSectionId | null {
  if (!value) return null;
  return SECTIONS.some((s) => s.id === value) ? (value as EmployeeProfileSectionId) : null;
}

function parseLibraryGroup(value: string | null): string | null {
  if (!value) return null;
  return EMPLOYEE_ATTACHMENT_LIBRARY_GROUPS.some((g) => g.id === value) ? value : null;
}

function employeeHasLinkedUser(employee: Employee): boolean {
  return employee.hasUser ?? !!employee.userId;
}

export function useEmployeeProfileModel(employee: Employee, onUpdated?: (updated: Employee) => void) {
  const searchParams = useSearchParams();
  const sectionFromUrl = parseProfileSection(searchParams.get('section'));
  const [activeSection, setActiveSection] = React.useState<EmployeeProfileSectionId>(
    () => sectionFromUrl ?? 'personal',
  );
  const contentRef = React.useRef<HTMLElement | null>(null);

  const hasLinkedUser = employeeHasLinkedUser(employee);

  React.useEffect(() => {
    if (sectionFromUrl) setActiveSection(sectionFromUrl);
  }, [sectionFromUrl]);

  const visibleSections = React.useMemo(
    () => (hasLinkedUser
      ? SECTIONS
      : SECTIONS.filter((s) => s.id !== 'permissions')),
    [hasLinkedUser],
  );

  React.useEffect(() => {
    if (!hasLinkedUser && activeSection === 'permissions') {
      setActiveSection('personal');
    }
  }, [activeSection, hasLinkedUser]);

  const handleUserCreated = React.useCallback(
    (userId: string) => {
      onUpdated?.({ ...employee, hasUser: true, userId });
    },
    [employee, onUpdated],
  );

  const data = useEmployeeProfileData(employee, activeSection);
  const leave = useEmployeeProfileLeave(employee, activeSection === 'leaves');
  const personal = useEmployeeProfilePersonal(employee, activeSection, onUpdated);
  const rose = useEmployeeProfileRosePdf(personal.draft);
  const permissions = useEmployeeProfilePermissions(
    employee,
    hasLinkedUser && activeSection === 'permissions',
  );
  const createUser = useEmployeeCreateUser(employee, handleUserCreated);
  const linkUser = useEmployeeLinkUser(employee, handleUserCreated);
  const assignments = useEmployeeProfileAssignments(employee, activeSection === 'employment');
  const requests = useEmployeeProfileRequests(employee, activeSection === 'requests');
  const auditLog = useEmployeeProfileAuditLog(employee, activeSection === 'activity-log');
  const attachments = useEmployeeProfileAttachments(employee, activeSection === 'attachments');

  React.useEffect(() => {
    const group = parseLibraryGroup(searchParams.get('libraryGroup'));
    if (group) attachments.setLibraryGroup(group);
    const documentType = searchParams.get('documentType');
    if (documentType && documentType !== 'all') {
      attachments.setDocumentTypeFilter(documentType);
    }
    // Apply deep-link filters once per URL change — not when setters identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: URL is the source of truth here
  }, [searchParams]);

  React.useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeSection]);

  const counts: Partial<Record<EmployeeProfileSectionId, number>> = {
    requests: requests.requestsCounts.total,
    violations: data.violationsTotal,
    contracts: data.employeeContracts.length,
    attachments: attachments.attachmentsTotal,
    'rose-forms': data.roseFormsCount,
    'activity-log': auditLog.auditCounts.total,
    salary: data.employeePayslipSeries.length,
    leaves: leave.totalLeaveRequestCount,
    employment: assignments.hrAssignments.length,
  };

  return {
    employee,
    onEmployeeUpdated: onUpdated,
    // `hasLinkedUser` comes from the `...permissions` spread below (same
    // `employee.hasUser ?? !!employee.userId` formula) — not re-listed here
    // to avoid a duplicate-key overwrite.
    SECTIONS: visibleSections,
    activeSection,
    setActiveSection,
    contentRef,
    counts,
    ...data,
    ...leave,
    ...personal,
    ...rose,
    ...permissions,
    ...createUser,
    ...linkUser,
    ...assignments,
    ...requests,
    ...auditLog,
    ...attachments,
  };
}

export type EmployeeProfileModel = ReturnType<typeof useEmployeeProfileModel>;
