'use client';

import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { fetchAllPaginatedItems } from '@/shared/api/client';
import { ListToolsTable, useListTools } from '@/components/ui/list-tools';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { PageHeaderPrimaryButton } from '@/components/layouts/page-header-primary-button';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail, RefreshCw, RotateCw, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Pagination } from '@/components/ui/shared-dialogs';
import { ForbiddenState } from '@/components/shared/forbidden-state';
import { useCan } from '@/features/auth/hooks/use-can';
import { useDefaultCompanyId } from '@/features/hr/organization/lib/default-company-id';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import { emailMessagesApi, type EmailMessageResponseDto, type EmailMessageStatus } from '@/features/system/email/lib/api/email-messages';
import { EMAIL_STATUS_FILTER_OPTIONS, EMAIL_STATUS_LABELS, EMAIL_STATUS_TONE, emailSkipReasonLabel } from '@/features/system/email/constants/status-labels';
import { SendEmailDrawer } from '@/features/system/email/components/send-email-drawer';
import { cn } from '@/shared/utils';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ar-SA-u-nu-latn', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function StatusCell({ row }: { row: EmailMessageResponseDto }) {
  const detail =
    row.status === 'failed'
      ? row.errorMessage
      : row.status === 'skipped'
        ? emailSkipReasonLabel(row.skipReason)
        : null;
  return (
    <div className="min-w-0 space-y-0.5">
      <Badge variant={EMAIL_STATUS_TONE[row.status]}>{EMAIL_STATUS_LABELS[row.status]}</Badge>
      {detail ? <p className="truncate text-[11px] text-muted-foreground" title={detail}>{detail}</p> : null}
    </div>
  );
}

export function EmailMessagesPage() {
  const companyId = useDefaultCompanyId();
  const can = useCan();
  const canRead = can('system.email-messages.read');
  const canSend = can('system.email-messages.create');

  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(20);
  const [status, setStatus] = React.useState<EmailMessageStatus | ''>('');
  const [search, setSearch] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [composeOpen, setComposeOpen] = React.useState(false);
  const debouncedSearch = useDebounced(search, 350);

  React.useEffect(() => {
    setPage(1);
  }, [status, debouncedSearch, dateFrom, dateTo]);

  const queryClient = useQueryClient();
  const queryKey = [
    'system-email',
    'messages',
    companyId,
    page,
    perPage,
    status,
    debouncedSearch,
    dateFrom,
    dateTo,
  ] as const;

  const listQuery = useQuery({
    queryKey,
    queryFn: () =>
      emailMessagesApi.list({
        companyId: companyId!,
        page,
        limit: perPage,
        status: status || undefined,
        q: debouncedSearch || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    enabled: !!companyId && canRead,
    placeholderData: (prev) => prev,
  });

  const resend = useMutation({
    mutationFn: (id: string) => emailMessagesApi.resend(id),
    onSuccess: (row) => {
      void queryClient.invalidateQueries({ queryKey: ['system-email', 'messages'] });
      if (row.status === 'sent') toast.success('أُعيد إرسال الرسالة بنجاح');
      else toast.error(`لم تُرسل: ${row.errorMessage ?? 'سبب غير معروف'}`);
    },
    onError: (err) => {
      // apiRequest already toasted this failure — just route it through the shared handler.
      handleApiError(err, 'system-email.resend');
    },
  });

  const activeFilterCount = (status ? 1 : 0) + (search.trim() ? 1 : 0) + (dateFrom || dateTo ? 1 : 0);

  useEntityFilterSlot(
    () => (
      canRead ? <ListFilterBar
        optionalDateRange
        showStatusSection={false}
        showEmployeePicker={false}
        periodValue={{ from: dateFrom, to: dateTo }}
        onPeriodChange={(p) => {
          setDateFrom(p.from);
          setDateTo(p.to);
        }}
        periodFilterActive={activeFilterCount > 0}
        onClearAll={() => {
          setSearch('');
          setStatus('');
          setDateFrom('');
          setDateTo('');
        }}
        leadingFilters={<EntityFilterSearchField value={search} onChange={setSearch} placeholder="ابحث بالبريد أو الموضوع…" />}
        inlineSelects={[
          {
            id: 'status',
            value: status || 'all',
            onChange: (v) => setStatus(v === 'all' ? '' : (v as EmailMessageStatus)),
            placeholder: EMAIL_STATUS_FILTER_OPTIONS[0]?.label,
            options: EMAIL_STATUS_FILTER_OPTIONS,
          },
        ]}
      /> : null
    ),
    [canRead, search, status, dateFrom, dateTo, activeFilterCount],
  );

  const items = listQuery.data?.items ?? [];
  const serverTotal = listQuery.data?.pagination?.total ?? 0;
  const senderOf = (row: EmailMessageResponseDto) =>
    row.triggeredByName ?? (row.sourceKind === 'manual_broadcast' ? '—' : 'النظام');
  const statusOf = (row: EmailMessageResponseDto) => EMAIL_STATUS_LABELS[row.status] ?? row.status;
  const columns: ColumnDef<EmailMessageResponseDto>[] = [
    {
      key: 'date',
      title: 'التاريخ',
      render: (row) => <span className="whitespace-nowrap tabular-nums text-muted-foreground" dir="ltr">{formatDateTime(row.createdAt)}</span>,
    },
    { key: 'to', title: 'المستلم', render: (row) => <span dir="ltr">{row.toEmail}</span> },
    {
      key: 'subject',
      title: 'الموضوع',
      render: (row) => <span className="block max-w-[18rem] truncate" title={row.subject}>{row.subject}</span>,
    },
    { key: 'status', title: 'الحالة', render: (row) => <StatusCell row={row} /> },
    { key: 'sender', title: 'المرسل', render: (row) => <span className="text-muted-foreground">{senderOf(row)}</span> },
    {
      key: 'actions',
      title: 'إجراء',
      isActions: true,
      render: (row) =>
        canSend && (row.status === 'failed' || row.status === 'pending') ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => resend.mutate(row.id)}
            disabled={resend.isPending}
          >
            <RotateCw className="h-3 w-3" />
            إعادة إرسال
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
  ];
  const tools = useListTools<EmailMessageResponseDto>({
    section: 'system',
    page: 'email-messages',
    columns,
    rows: items,
    fetchAll: async () =>
      (await fetchAllPaginatedItems((p, limit) =>
        emailMessagesApi.list({
          companyId: companyId!,
          page: p,
          limit,
          status: status || undefined,
          q: debouncedSearch || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        }),
      )).items,
    resetKey: JSON.stringify([companyId, status, debouncedSearch, dateFrom, dateTo]),
    fields: {
      date: { kind: 'date', text: (row) => formatDateTime(row.createdAt), sort: (row) => row.createdAt, group: (row) => row.createdAt.slice(0, 7) },
      to: { kind: 'code', text: (row) => row.toEmail, group: (row) => row.toEmail },
      subject: { text: (row) => row.subject },
      status: { kind: 'status', text: statusOf, group: statusOf },
      sender: { text: senderOf, group: senderOf },
    },
  });
  const paged = tools.pagination({
    page,
    pageSize: perPage,
    total: serverTotal,
    totalPages: Math.max(1, Math.ceil(serverTotal / perPage)),
    setPage,
    setPageSize: setPerPage,
  });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        {tools.buttons}
        {tools.exportMenu('سجل رسائل البريد', 'email-messages')}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-3 text-xs"
          aria-label="تحديث"
          onClick={() => void listQuery.refetch()}
          disabled={listQuery.isFetching}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', listQuery.isFetching && 'animate-spin')} />
          تحديث
        </Button>
        {canSend ? (
          <PageHeaderPrimaryButton icon={Send} label="إرسال رسالة جديدة" onClick={() => setComposeOpen(true)} />
        ) : null}
      </div>
    ),
    [activeFilterCount, listQuery.isFetching, canSend, tools.depsKey],
  );

  if (!canRead) {
    return <ForbiddenState title="لا تملك صلاحية الوصول إلى رسائل البريد" />;
  }

  const hasFilters = !!status || !!debouncedSearch || !!dateFrom || !!dateTo;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <SetPageTitle titleAr="رسائل البريد" descriptionAr="سجل كل بريد خرج من هذه الشركة — إلى من، متى، وهل وصل." iconName="Inbox" />

      {listQuery.isLoading ? (
        <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
          جاري التحميل…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Mail}
          title={hasFilters ? 'لا نتائج مطابقة لعوامل البحث' : 'لا توجد رسائل بعد'}
          description={hasFilters ? 'جرّب تغيير الفلاتر.' : 'ستظهر هنا كل رسالة تُرسل من هذه الشركة.'}
        />
      ) : (
        <ListToolsTable tools={tools} keyExtractor={(row) => row.id}>
          <DataTable
            variant="directory"
            alwaysShowTable
            tableClassName="min-w-[860px]"
            columns={tools.columns}
            {...tools.tableSort}
            data={tools.rows}
            keyExtractor={(row) => row.id}
            loading={tools.loading}
          />
        </ListToolsTable>
      )}

      {paged.total > 0 && !tools.group.groupBy ? (
        <Pagination
          page={paged.page}
          perPage={paged.pageSize}
          total={paged.total}
          onPage={paged.setPage}
          onPerPage={paged.setPageSize}
        />
      ) : null}

      <SendEmailDrawer
        open={composeOpen}
        onOpenChange={setComposeOpen}
        companyId={companyId}
        onSent={() => void listQuery.refetch()}
      />
    </div>
  );
}
