'use client';

import * as React from 'react';
import {
  Building2,
  Loader2,
  MapPin,
  Pencil,
  Shield,
  ShieldCheck,
  UserCircle,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { UserProfileTab } from '@/features/system/organization/contacts/components/user-profile-tab';
import { UserCompaniesPanel } from '@/features/system/organization/contacts/components/user-companies-panel';
import { UserBranchesPanel } from '@/features/system/organization/contacts/components/user-branches-panel';
import { UserPermissionsPanel } from '@/features/system/organization/contacts/components/user-permissions-panel';
import { useUserDetailModel } from '@/features/system/organization/contacts/hooks/useUserDetailModel';
import { useUserPermissionsModel } from '@/features/system/organization/contacts/hooks/useUserPermissionsModel';
import { userTypeLabelAr } from '@/features/system/organization/contacts/constants/users-directory';
import { userIsLinkedToCompany } from '@/features/system/organization/contacts/hooks/useCompanySuperusers';
import { cn, getInitials } from '@/shared/utils';
import type { UserResponseDto } from '@/features/hr/organization/lib/api/users';
import type { CompanyResponseDto } from '@/features/hr/organization/lib/api/companies';
import type { BranchResponseDto } from '@/features/hr/organization/lib/api/branches';

type DetailTab = 'profile' | 'permissions' | 'companies' | 'branches';

const TABS: { id: DetailTab; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'الملف الشخصي', icon: UserCircle },
  { id: 'permissions', label: 'الصلاحيات', icon: Shield },
  { id: 'companies', label: 'الشركات', icon: Building2 },
  { id: 'branches', label: 'الفروع', icon: MapPin },
];

type Props = {
  user: UserResponseDto | null;
  companies: CompanyResponseDto[];
  branches: BranchResponseDto[];
  onOpenChange: (open: boolean) => void;
  onEdit: (row: UserResponseDto) => void;
  onUserUpdated?: (user: UserResponseDto) => void;
  companyId?: string | null;
  isCompanySuperuser?: boolean;
  canMakeSuperuser?: boolean;
  makingSuperuser?: boolean;
  onMakeSuperuser?: (userId: string) => void;
  onRevokeSuperuser?: (userId: string) => void;
};

function SidebarSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-8">
      <div className="h-20 w-20 animate-pulse rounded-full bg-muted" />
      <div className="h-5 w-36 animate-pulse rounded bg-muted" />
      <div className="h-4 w-44 animate-pulse rounded bg-muted" />
      <div className="flex gap-2">
        <div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
        <div className="h-5 w-12 animate-pulse rounded-full bg-muted" />
      </div>
    </div>
  );
}

export function UserDetailDialog({
  user,
  companies,
  branches,
  onOpenChange,
  onEdit,
  onUserUpdated,
  companyId = null,
  isCompanySuperuser = false,
  canMakeSuperuser = false,
  makingSuperuser = false,
  onMakeSuperuser,
  onRevokeSuperuser,
}: Props) {
  const [tab, setTab] = React.useState<DetailTab>('profile');
  const detail = useUserDetailModel(user?.id ?? null, { companies, branches }, onUserUpdated);
  const displayUser = detail.user ?? user;
  const permissionsModel = useUserPermissionsModel(displayUser, tab === 'permissions' && !!displayUser);
  const displayName = displayUser?.fullNameAr ?? displayUser?.email ?? 'المستخدم';
  const companyCount = displayUser?.companies.length ?? 0;
  const branchCount = displayUser?.branches.length ?? 0;
  const showMakeSuperuser = Boolean(
    displayUser
    && canMakeSuperuser
    && onMakeSuperuser
    && companyId
    && !isCompanySuperuser
    && userIsLinkedToCompany(displayUser.companies, companyId),
  );
  const showRevokeSuperuser = Boolean(
    displayUser
    && canMakeSuperuser
    && onRevokeSuperuser
    && isCompanySuperuser,
  );

  React.useEffect(() => {
    if (user) setTab('profile');
  }, [user?.id]);

  return (
    <Dialog open={!!user} onOpenChange={(v) => !v && onOpenChange(false)}>
      <DialogContent
        dir="rtl"
        className="flex max-h-[min(92vh,900px)] flex-col overflow-visible border-border p-0 sm:max-w-6xl [&>button]:start-4 [&>button]:end-auto"
      >
        <DialogTitle className="sr-only">{displayName}</DialogTitle>
        <DialogDescription className="sr-only">تفاصيل المستخدم وصلاحياته</DialogDescription>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* ── Sidebar ── */}
          <aside className="flex shrink-0 flex-col border-b border-border bg-muted/25 lg:w-[17.5rem] lg:border-b-0 lg:border-s">
            {displayUser ? (
              <>
                <div className="flex flex-col items-center px-6 pb-4 pt-8 text-center">
                  <Avatar className="h-20 w-20 shadow-md ring-4 ring-background">
                    {displayUser.avatarUrl ? (
                      <AvatarImage src={displayUser.avatarUrl} alt={displayName} />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">
                      {getInitials(displayName)}
                    </AvatarFallback>
                  </Avatar>

                  <h2 className="mt-4 max-w-full truncate font-display text-lg font-bold leading-tight">
                    {displayName}
                  </h2>
                  {displayUser.fullNameEn ? (
                    <p className="mt-0.5 max-w-full truncate text-xs text-muted-foreground" dir="ltr">
                      {displayUser.fullNameEn}
                    </p>
                  ) : null}
                  <p className="mt-1 max-w-full truncate text-sm text-muted-foreground" dir="ltr">
                    {displayUser.email}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      {userTypeLabelAr(displayUser.userType)}
                    </Badge>
                    {displayUser.isActive ? (
                      <Badge variant="outline" className="border-success/40 bg-success/5 text-[10px] text-success">
                        نشط
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-destructive/40 text-[10px] text-destructive">
                        غير نشط
                      </Badge>
                    )}
                    {displayUser.isVerified ? (
                      <Badge variant="outline" className="gap-0.5 text-[10px]">
                        <ShieldCheck className="h-3 w-3" />
                        موثّق
                      </Badge>
                    ) : null}
                    {isCompanySuperuser ? (
                      <Badge variant="gold" className="text-[10px]">Superuser</Badge>
                    ) : null}
                  </div>
                </div>

                <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:px-4 lg:pb-0">
                  {TABS.map(({ id, label, icon: Icon }) => {
                    const count = id === 'companies' ? companyCount : id === 'branches' ? branchCount : null;
                    const active = tab === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setTab(id)}
                        className={cn(
                          'flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors lg:w-full',
                          active
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <Icon className="h-4 w-4 shrink-0" />
                          {label}
                        </span>
                        {count != null ? (
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[10px] tabular-nums',
                              active ? 'bg-primary-foreground/15' : 'bg-muted',
                            )}
                          >
                            {count}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </nav>

                <div className="mt-auto hidden border-t border-border p-4 lg:block">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-full gap-2"
                    onClick={() => {
                      onOpenChange(false);
                      onEdit(displayUser);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    تعديل المستخدم
                  </Button>
                </div>
              </>
            ) : (
              <SidebarSkeleton />
            )}
          </aside>

          {/* ── Main ── */}
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-visible">
            {displayUser ? (
              <>
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-5 py-3 lg:hidden">
                  <p className="text-sm font-medium text-muted-foreground">
                    {TABS.find((t) => t.id === tab)?.label}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => {
                      onOpenChange(false);
                      onEdit(displayUser);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                    تعديل
                  </Button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
                  {tab === 'profile' ? (
                    <UserProfileTab
                      user={displayUser}
                      onUserUpdated={(updated) => {
                        onUserUpdated?.(updated);
                        void detail.reload();
                      }}
                      isCompanySuperuser={isCompanySuperuser}
                      showMakeSuperuser={showMakeSuperuser}
                      showRevokeSuperuser={showRevokeSuperuser}
                      makingSuperuser={makingSuperuser}
                      onMakeSuperuser={() => onMakeSuperuser?.(displayUser.id)}
                      onRevokeSuperuser={() => onRevokeSuperuser?.(displayUser.id)}
                    />
                  ) : null}
                  {tab === 'permissions' ? <UserPermissionsPanel model={permissionsModel} /> : null}
                  {tab === 'companies' ? <UserCompaniesPanel model={detail} /> : null}
                  {tab === 'branches' ? <UserBranchesPanel model={detail} /> : null}
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-sm">جاري تحميل بيانات المستخدم…</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
