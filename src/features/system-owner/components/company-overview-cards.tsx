'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AppWindow,
  Building2,
  Crown,
  Globe,
  Mail,
  MapPin,
  Phone,
  type LucideIcon,
} from 'lucide-react';
import { COMPANY_MODE_LABEL, COMPANY_STATUS_LABEL } from '@/features/system-owner/constants/company-status';
import {
  useSystemOwnerCompanyApplications,
  useSystemOwnerSuperusers,
} from '@/features/system-owner/hooks/use-system-owner';
import { systemOwnerQueryKeys } from '@/features/system-owner/hooks/query-keys';
import { companyDomainsApi } from '@/features/system-owner/lib/api/company-domains';
import type { SystemOwnerCompany } from '@/features/system-owner/lib/api/system-owner';
import {
  resolveApplicationIcon,
  resolveApplicationTileClass,
} from '@/features/system/applications/lib/application-tile-config';
import { cn } from '@/shared/utils';

type Section = 'apps' | 'people' | 'domains' | 'mode';

/**
 * The company at a glance (owner 2026-11-14): its data, its apps, its
 * authorized owner and its store's address. Each card opens its section.
 */
export function CompanyOverviewCards({
  company,
  onOpen,
}: {
  company: SystemOwnerCompany;
  onOpen: (section: Section) => void;
}) {
  const apps = useSystemOwnerCompanyApplications(company.id);
  const owners = useSystemOwnerSuperusers(company.id);
  const domains = useQuery({
    queryKey: systemOwnerQueryKeys.companyDomains(company.id),
    queryFn: () => companyDomainsApi.list(company.id),
  });

  const appRows = apps.data ?? [];
  const enabled = appRows.filter((app) => app.isEnabled || app.isAlwaysEnabled);
  // The apps a customer chose (the system ones are always on).
  const chosen = enabled.filter((app) => !app.isAlwaysEnabled);
  const activeOwners = (owners.data ?? []).filter((row) => row.isActive);
  const storeDomain = (domains.data ?? []).find(
    (d) => d.kind === 'store' && d.status === 'active' && d.isPrimary,
  );

  const facts: Array<{ icon: LucideIcon; label: string; value: string; ltr?: boolean }> = [
    { icon: Building2, label: 'السجل التجاري', value: company.commercialRegistrationNo ?? '', ltr: true },
    { icon: Building2, label: 'الرقم الضريبي', value: company.taxNumber ?? '', ltr: true },
    { icon: Phone, label: 'الهاتف', value: company.mobile || company.phone || '', ltr: true },
    { icon: Mail, label: 'البريد', value: company.email ?? '', ltr: true },
    { icon: MapPin, label: 'المدينة', value: company.city ?? '' },
  ].filter((fact) => fact.value.trim());

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <OverviewCard title="بيانات الشركة" icon={Building2} onClick={() => onOpen('mode')}>
        <p className="text-xs text-muted-foreground">
          {COMPANY_STATUS_LABEL[company.status]} · وضع {COMPANY_MODE_LABEL[company.operatingMode]}
        </p>
        {facts.length ? (
          <dl className="mt-2 space-y-1">
            {facts.slice(0, 4).map((fact) => (
              <div key={fact.label} className="flex items-center gap-1.5 text-xs">
                <fact.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <dt className="sr-only">{fact.label}</dt>
                <dd className="truncate" dir={fact.ltr ? 'ltr' : undefined}>
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">لا توجد بيانات تواصل. أضفها من «تعديل البيانات».</p>
        )}
      </OverviewCard>

      <OverviewCard title="التطبيقات" icon={AppWindow} onClick={() => onOpen('apps')}>
        {apps.isLoading ? (
          <Skeleton />
        ) : (
          <>
            <p className="text-2xl font-semibold tabular-nums">
              {chosen.length}
              <span className="ms-1 text-xs font-normal text-muted-foreground">
                مفعّل من {appRows.filter((a) => !a.isAlwaysEnabled).length}
              </span>
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {chosen.slice(0, 8).map((app, index) => {
                const Icon = resolveApplicationIcon(app);
                return (
                  <span
                    key={app.id}
                    title={app.nameAr}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-lg',
                      resolveApplicationTileClass(app, index),
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    <span className="sr-only">{app.nameAr}</span>
                  </span>
                );
              })}
              {chosen.length === 0 ? (
                <span className="text-xs text-muted-foreground">لم يُفعَّل أي تطبيق بعد.</span>
              ) : null}
            </div>
          </>
        )}
      </OverviewCard>

      <OverviewCard title="صاحب الشركة المخوّل" icon={Crown} onClick={() => onOpen('people')}>
        {owners.isLoading ? (
          <Skeleton />
        ) : activeOwners.length ? (
          <ul className="space-y-1.5">
            {activeOwners.slice(0, 2).map((row) => (
              <li key={row.userId} className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {row.fullNameAr || row.email || row.userId.slice(0, 8)}
                </p>
                <p className="truncate text-xs text-muted-foreground" dir="ltr">
                  {row.email}
                </p>
              </li>
            ))}
            {activeOwners.length > 2 ? (
              <li className="text-xs text-muted-foreground">و{activeOwners.length - 2} آخرون</li>
            ) : null}
          </ul>
        ) : (
          <p className="text-xs text-warning">لم يُعيَّن صاحب للشركة. أضفه من «المستخدمون والملاك».</p>
        )}
      </OverviewCard>

      <OverviewCard title="المتجر" icon={Globe} onClick={() => onOpen('domains')}>
        {domains.isLoading ? (
          <Skeleton />
        ) : storeDomain ? (
          <a
            href={storeDomain.url}
            target="_blank"
            rel="noreferrer"
            dir="ltr"
            onClick={(event) => event.stopPropagation()}
            className="block truncate font-mono text-sm text-primary hover:underline"
          >
            {storeDomain.hostname}
          </a>
        ) : (
          <p className="text-xs text-muted-foreground">لا نطاق للمتجر. أضفه من «النطاقات».</p>
        )}
      </OverviewCard>
    </div>
  );
}

function OverviewCard({
  title,
  icon: Icon,
  onClick,
  children,
}: {
  title: string;
  icon: LucideIcon;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <section
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      className="min-w-0 cursor-pointer rounded-xl border border-border bg-card px-4 py-3 text-start shadow-soft transition-shadow hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Skeleton() {
  return <div className="h-10 animate-pulse rounded-lg bg-muted" />;
}
