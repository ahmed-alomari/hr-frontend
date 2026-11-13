import { apiDownloadRequest, apiDownloadToDevice, apiRequest, type PaginatedResult } from '@/features/hr/lib/api/client';
import type { OrganizationArchiveScope } from '@/features/hr/organization/lib/archive-scope';
import type {
  ContractNature,
  WorkArrangement,
} from '@/features/hr/contracts/contract-templates/types/contract-template';
import type { EmployeeContractsListQuery } from '@/features/hr/contracts/lib/employee-contracts-list-query';
import {
  CONTRACT_NATURE,
  CONTRACT_STATUS,
  WORK_ARRANGEMENT,
  type ContractStatus,
} from '@/features/hr/contracts/lib/employee-contracts-list-query';

export type { ContractNature, WorkArrangement, ContractStatus };
export { CONTRACT_NATURE, CONTRACT_STATUS, WORK_ARRANGEMENT };
export type { EmployeeContractsListQuery };
// ─── Contract Templates (re-export from page capsule) ─────────────────────────

export { contractTemplatesApi } from '@/features/hr/contracts/contract-templates/lib/api/contract-templates';

export type {
  ContractTemplateDto as ApiContractTemplate,
  ContractTemplateAllowanceLine as ApiTemplateAllowanceLine,
  ContractTemplateArticleRef,
  CreateContractTemplateDto,
  UpdateContractTemplateDto,
} from '@/features/hr/contracts/contract-templates/types/contract-template';

// ─── Contract Articles ────────────────────────────────────────────────────────

export type ApiContractArticle = {
  id: string;
  companyId: string;
  code: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  isBasic: boolean;
  /** Prints the contract's salary and allowances under this article. */
  includesCompensation?: boolean;
  sortOrder: number;
  isActive: boolean;
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

export type CreateContractArticleDto = {
  companyId: string;
  code: string;
  titleAr: string;
  titleEn?: string;
  bodyAr?: string;
  bodyEn?: string;
  isBasic?: boolean;
  includesCompensation?: boolean;
  sortOrder?: number;
  isActive?: boolean;
  createdBy?: string;
};

export type UpdateContractArticleDto = Partial<Omit<CreateContractArticleDto, 'companyId' | 'createdBy'>> & {
  updatedBy?: string;
};

export const contractArticlesApi = {
  list: (params?: {
    companyId?: string;
    isBasic?: boolean;
    isActive?: boolean;
    page?: number;
    limit?: number;
    archiveScope?: OrganizationArchiveScope;
  }) =>
    apiRequest<PaginatedResult<ApiContractArticle>>('/payroll/contract-articles', {
      query: params as Record<string, string | number | boolean | null | undefined>,
    }),

  get: (id: string) =>
    apiRequest<ApiContractArticle>(`/payroll/contract-articles/${id}`),

  create: (body: CreateContractArticleDto) =>
    apiRequest<ApiContractArticle>('/payroll/contract-articles', { method: 'POST', body }),

  update: (id: string, body: UpdateContractArticleDto) =>
    apiRequest<ApiContractArticle>(`/payroll/contract-articles/${id}`, { method: 'PATCH', body }),

  delete: (id: string) =>
    apiRequest<void>(`/payroll/contract-articles/${id}`, { method: 'DELETE' }),

  /** The company's default order; saved templates and contracts keep theirs. */
  reorder: (body: { companyId: string; articleIds: string[] }) =>
    apiRequest<ApiContractArticle[]>('/payroll/contract-articles/reorder', {
      method: 'POST',
      body,
    }),
};

// ─── Employee Contracts ───────────────────────────────────────────────────────

export type ApiContractAllowanceLine = {
  id: string;
  allowanceTypeId: string;
  allowanceTypeCode: string;
  allowanceTypeNameAr: string;
  amount: string;
  sortOrder: number;
};

export type ApiContractArticleRef = {
  id: string;
  contractArticleId: string;
  articleCode: string;
  titleAr: string;
  bodyAr?: string | null;
  isBasic?: boolean;
  includesCompensation?: boolean;
  sortOrder: number;
};

/** أعلام الواجهة من API — ابنِ الأزرار عليها وليس بتخمين الحالة فقط. */
export type EmployeeContractActionsDto = {
  canEditTerms: boolean;
  canSendToEmployee: boolean;
  canEmployeeDecide: boolean;
  canActivate: boolean;
  canCancel: boolean;
  canClose: boolean;
};

export type ApiEmployeeContract = {
  id: string;
  companyId: string;
  branchId: string | null;
  branchNameAr: string;
  employeeId: string;
  employeeNameAr: string;
  contractNumber: string;
  contractTemplateId: string | null;
  contractTemplateCode: string;
  contractNature: ContractNature;
  workArrangement: WorkArrangement;
  startDate: string;
  endDate: string;
  probationDays: number;
  annualLeaveDays: number;
  baseSalary: string;
  currency: string;
  status: ContractStatus;
  allowancesNote: string | null;
  deductionsNote: string | null;
  amendsContractId: string | null;
  supersededByContractId: string | null;
  earlyTerminationReason: string | null;
  signedAt: string | null;
  terminatedAt: string | null;
  employeeSigned: boolean;
  rejectionReason: string | null;
  signatureNoticeSent?: boolean;
  signatureMethod?: string | null;
  signedAttachmentId?: string | null;
  signatureImageUrl?: string | null;
  actions?: EmployeeContractActionsDto;
  allowanceLines: ApiContractAllowanceLine[];
  articles: ApiContractArticleRef[];
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
};

export type CreateEmployeeContractDto = {
  companyId: string;
  employeeId: string;
  branchId?: string;
  contractTemplateId?: string;
  applyTemplateDefaults?: boolean;
  includeBasicArticles?: boolean;
  contractNumber?: string;
  contractNature?: ContractNature;
  workArrangement?: WorkArrangement;
  startDate: string;
  endDate?: string;
  probationDays?: number;
  annualLeaveDays?: number;
  baseSalary: number;
  currency?: string;
  status?: ContractStatus;
  allowancesNote?: string;
  deductionsNote?: string;
  amendsContractId?: string;
  articleIds?: string[];
  allowanceLines?: { allowanceTypeId: string; amount: number; sortOrder?: number }[];
  createdBy?: string;
};

export type PreviewEmployeeContractPdfDto = {
  companyId: string;
  employeeId: string;
  branchId?: string;
  contractNumber?: string;
  contractNature?: ContractNature;
  workArrangement?: WorkArrangement;
  startDate: string;
  endDate?: string;
  probationDays?: number;
  annualLeaveDays?: number;
  baseSalary?: number;
  currency?: string;
  allowancesNote?: string;
  deductionsNote?: string;
  articleIds?: string[];
  /** A new contract also gets the basic articles on save. */
  includeBasicArticles?: boolean;
  allowanceLines?: { allowanceTypeId: string; amount: number; sortOrder?: number }[];
};

export type ContractSamplePdfDto = {
  companyId: string;
  nameAr?: string;
  nameEn?: string;
  commercialRegistrationNo?: string;
  pdfWatermarkEnabled?: boolean;
  pdfWatermarkOpacity?: number;
  pdfContractFontScale?: number;
  pdfEmployeeSignatureScale?: number;
  pdfCompanyStampScale?: number;
};

export type UpdateEmployeeContractDto = {
  branchId?: string | null;
  contractNature?: ContractNature;
  workArrangement?: WorkArrangement;
  startDate?: string;
  endDate?: string;
  probationDays?: number;
  annualLeaveDays?: number;
  baseSalary?: number;
  currency?: string;
  status?: ContractStatus;
  allowancesNote?: string | null;
  deductionsNote?: string | null;
  earlyTerminationReason?: string | null;
  articleIds?: string[];
  allowanceLines?: { allowanceTypeId: string; amount: number; sortOrder?: number }[];
  updatedBy?: string;
};

export type SendEmployeeContractDto = {
  updatedBy?: string;
};

export type ActivateEmployeeContractDto = {
  /** مطلوب إذا annualLeaveDays > 0 ولم يُضف الرصيد من قبل */
  leaveTypeId?: string;
  updatedBy?: string;
};

export type EmployeeContractDecisionDto = {
  decision: 'accept' | 'reject';
  rejectionReason?: string | null;
  decidedBy?: string | null;
};

export const employeeContractsApi = {
  list: (params?: EmployeeContractsListQuery) =>
    apiRequest<PaginatedResult<ApiEmployeeContract>>('/payroll/contracts', {
      query: params as Record<string, string | number | boolean | null | undefined | string[]>,
    }),

  get: (id: string) =>
    apiRequest<ApiEmployeeContract>(`/payroll/contracts/${id}`),

  create: (body: CreateEmployeeContractDto) =>
    apiRequest<ApiEmployeeContract>('/payroll/contracts', { method: 'POST', body }),

  update: (id: string, body: UpdateEmployeeContractDto) =>
    apiRequest<ApiEmployeeContract>(`/payroll/contracts/${id}`, { method: 'PATCH', body }),

  delete: (id: string) =>
    apiRequest<void>(`/payroll/contracts/${id}`, { method: 'DELETE' }),

  send: (id: string, body?: SendEmployeeContractDto) =>
    apiRequest<ApiEmployeeContract>(`/payroll/contracts/${id}/send`, {
      method: 'POST',
      body: body ?? {},
    }),

  activate: (id: string, body?: ActivateEmployeeContractDto) =>
    apiRequest<ApiEmployeeContract>(`/payroll/contracts/${id}/activate`, {
      method: 'POST',
      body: body ?? {},
    }),

  employeeDecision: (id: string, body: EmployeeContractDecisionDto) =>
    apiRequest<ApiEmployeeContract>(`/payroll/contracts/${id}/employee-decision`, {
      method: 'POST',
      body,
    }),

  downloadPdf: (id: string, fileName?: string) =>
    apiDownloadToDevice(`/payroll/contracts/${id}/pdf`, {
      defaultFileName: fileName ?? `employment-contract-${id}.pdf`,
    }),

  getPdf: (id: string, fileName?: string) =>
    apiDownloadRequest(`/payroll/contracts/${id}/pdf`, {
      defaultFileName: fileName ?? `employment-contract-${id}.pdf`,
    }),

  /** Official contract PDF from form values before save (server renderer, writes nothing). */
  previewPdf: (body: PreviewEmployeeContractPdfDto, fileName?: string) =>
    apiDownloadRequest('/payroll/contracts/preview-pdf', {
      method: 'POST',
      body,
      defaultFileName: fileName ?? 'employment-contract-preview.pdf',
    }),

  /** Sample contract with the company document settings before save (writes nothing). */
  samplePdf: (body: ContractSamplePdfDto) =>
    apiDownloadRequest('/payroll/contracts/sample-pdf', {
      method: 'POST',
      body,
      defaultFileName: 'employment-contract-sample.pdf',
    }),
};
