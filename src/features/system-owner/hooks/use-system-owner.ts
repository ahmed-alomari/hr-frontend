'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import { systemOwnerQueryKeys } from '@/features/system-owner/hooks/query-keys';
import {
  COMPANY_MODE_LABEL,
  COMPANY_STATUS_ACTION_DONE,
} from '@/features/system-owner/constants/company-status';
import {
  systemOwnerApi,
  type CompanyOperatingMode,
  type CompanyStatusAction,
  type CreateSystemOwnerCompanyDto,
  type CreateSystemOwnerCompanyUserDto,
  type PatchCompanyApplicationDto,
} from '@/features/system-owner/lib/api/system-owner';

export function useSystemOwnerCompanies() {
  return useQuery({
    queryKey: systemOwnerQueryKeys.companies(),
    queryFn: () => systemOwnerApi.listCompanies({ page: 1, limit: 200 }),
  });
}

export function useSystemOwnerCompany(companyId: string) {
  return useQuery({
    queryKey: systemOwnerQueryKeys.company(companyId),
    queryFn: () => systemOwnerApi.getCompany(companyId),
    enabled: Boolean(companyId),
  });
}

export function useSystemOwnerCompanyUsers(companyId: string) {
  return useQuery({
    queryKey: systemOwnerQueryKeys.companyUsers(companyId),
    queryFn: () => systemOwnerApi.listCompanyUsers(companyId),
    enabled: Boolean(companyId),
  });
}

export function useSystemOwnerCompanyApplications(companyId: string) {
  return useQuery({
    queryKey: systemOwnerQueryKeys.companyApplications(companyId),
    queryFn: () => systemOwnerApi.listCompanyApplications(companyId),
    enabled: Boolean(companyId),
  });
}

export function useSystemOwnerSuperusers(companyId: string) {
  return useQuery({
    queryKey: systemOwnerQueryKeys.superusers(companyId),
    queryFn: () => systemOwnerApi.listSuperusers(companyId),
    enabled: Boolean(companyId),
  });
}

export function useSystemOwnerActivationRequests(status?: string) {
  return useQuery({
    queryKey: systemOwnerQueryKeys.activationRequests(status),
    queryFn: () => systemOwnerApi.listActivationRequests(status ? { status } : undefined),
  });
}

export function useSystemOwnerMutations() {
  const queryClient = useQueryClient();

  function invalidateCompany(companyId?: string) {
    void queryClient.invalidateQueries({ queryKey: ['system-owner'] });
    if (companyId) {
      void queryClient.invalidateQueries({ queryKey: systemOwnerQueryKeys.company(companyId) });
      void queryClient.invalidateQueries({ queryKey: systemOwnerQueryKeys.companyUsers(companyId) });
      void queryClient.invalidateQueries({ queryKey: systemOwnerQueryKeys.companyApplications(companyId) });
      void queryClient.invalidateQueries({ queryKey: systemOwnerQueryKeys.superusers(companyId) });
      void queryClient.invalidateQueries({ queryKey: systemOwnerQueryKeys.companyAppsCatalog(companyId) });
    }
  }

  const createCompany = useMutation({
    mutationFn: (payload: CreateSystemOwnerCompanyDto) => systemOwnerApi.createCompany(payload),
    onSuccess: () => {
      invalidateCompany();
      toast.success('تم إنشاء الشركة — تطبيق النظام مفعّل افتراضياً');
    },
    onError: (err) => {
      toast.error(handleApiError(err, 'system-owner.companies.create').displayMessage);
    },
  });

  const updateCompany = useMutation({
    mutationFn: ({
      companyId,
      payload,
    }: {
      companyId: string;
      payload: Partial<CreateSystemOwnerCompanyDto>;
    }) => systemOwnerApi.updateCompany(companyId, payload),
    onSuccess: (_data, vars) => {
      invalidateCompany(vars.companyId);
      toast.success('تم تحديث الشركة');
    },
    onError: (err) => {
      toast.error(handleApiError(err, 'system-owner.companies.update').displayMessage);
    },
  });

  const changeCompanyStatus = useMutation({
    mutationFn: (vars: { companyId: string; action: CompanyStatusAction }) =>
      systemOwnerApi.changeCompanyStatus(vars.companyId, vars.action),
    onSuccess: (_data, vars) => {
      invalidateCompany(vars.companyId);
      toast.success(COMPANY_STATUS_ACTION_DONE[vars.action]);
    },
    onError: (err) => {
      toast.error(handleApiError(err, 'system-owner.companies.status').displayMessage);
    },
  });

  const setCompanyOperatingMode = useMutation({
    mutationFn: (vars: { companyId: string; mode: CompanyOperatingMode; confirmCode?: string }) =>
      systemOwnerApi.setCompanyOperatingMode(vars.companyId, vars.mode, vars.confirmCode),
    onSuccess: (_data, vars) => {
      invalidateCompany(vars.companyId);
      toast.success(`وضع الشركة الآن: ${COMPANY_MODE_LABEL[vars.mode]}`);
    },
    onError: (err) => {
      toast.error(handleApiError(err, 'system-owner.companies.mode').displayMessage);
    },
  });

  const patchCompanyApplication = useMutation({
    mutationFn: (vars: {
      companyId: string;
      applicationId: string;
      payload: PatchCompanyApplicationDto;
    }) =>
      systemOwnerApi.patchCompanyApplication(vars.companyId, vars.applicationId, vars.payload),
    onSuccess: (_data, vars) => {
      invalidateCompany(vars.companyId);
      if (vars.payload.isEnabled !== undefined) {
        toast.success(vars.payload.isEnabled ? 'تم تفعيل التطبيق' : 'تم تعطيل التطبيق');
      } else if (vars.payload.isVisible !== undefined) {
        toast.success(vars.payload.isVisible ? 'سيظهر التطبيق في المشغّل' : 'تم إخفاء التطبيق من المشغّل');
      } else {
        toast.success('تم تحديث التطبيق');
      }
    },
    onError: (err) => {
      toast.error(handleApiError(err, 'system-owner.applications.patch').displayMessage);
    },
  });

  const createCompanyUser = useMutation({
    mutationFn: (vars: { companyId: string; payload: CreateSystemOwnerCompanyUserDto }) =>
      systemOwnerApi.createCompanyUser(vars.companyId, vars.payload),
    onSuccess: (data, vars) => {
      invalidateCompany(vars.companyId);
      toast.success(
        data.isCompanySuperuser
          ? 'تم إنشاء صاحب الشركة المخوّل مع أدوار superadmin للتطبيقات المفعّلة. يدخل بإيميله ويدير الشركة.'
          : 'تم إنشاء المستخدم وربطه بالشركة.',
      );
    },
    onError: (err) => {
      toast.error(handleApiError(err, 'system-owner.users.create').displayMessage);
    },
  });

  const assignSuperuser = useMutation({
    mutationFn: (vars: { companyId: string; userId: string; notes?: string }) =>
      systemOwnerApi.assignSuperuser(vars.companyId, { userId: vars.userId, notes: vars.notes }),
    onSuccess: (_data, vars) => {
      invalidateCompany(vars.companyId);
      toast.success('تم تعيين Superuser');
    },
    onError: (err) => {
      toast.error(handleApiError(err, 'system-owner.superusers.assign').displayMessage);
    },
  });

  const setSuperuserActive = useMutation({
    mutationFn: (vars: { companyId: string; userId: string; isActive: boolean }) =>
      systemOwnerApi.setSuperuserActive(vars.companyId, vars.userId, vars.isActive),
    onSuccess: (_data, vars) => {
      invalidateCompany(vars.companyId);
      toast.success(vars.isActive ? 'تم تفعيل Superuser' : 'تم إيقاف Superuser');
    },
    onError: (err) => {
      toast.error(handleApiError(err, 'system-owner.superusers.patch').displayMessage);
    },
  });

  const approveRequest = useMutation({
    mutationFn: (vars: { id: string; decisionNote?: string }) =>
      systemOwnerApi.approveActivationRequest(vars.id, vars.decisionNote),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['system-owner'] });
      toast.success('تمت الموافقة وتفعيل التطبيق');
    },
    onError: (err) => {
      toast.error(handleApiError(err, 'system-owner.requests.approve').displayMessage);
    },
  });

  const rejectRequest = useMutation({
    mutationFn: (vars: { id: string; decisionNote?: string }) =>
      systemOwnerApi.rejectActivationRequest(vars.id, vars.decisionNote),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['system-owner'] });
      toast.success('تم رفض الطلب');
    },
    onError: (err) => {
      toast.error(handleApiError(err, 'system-owner.requests.reject').displayMessage);
    },
  });

  return {
    createCompany,
    updateCompany,
    changeCompanyStatus,
    setCompanyOperatingMode,
    createCompanyUser,
    patchCompanyApplication,
    assignSuperuser,
    setSuperuserActive,
    approveRequest,
    rejectRequest,
  };
}
