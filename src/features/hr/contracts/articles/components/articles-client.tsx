'use client';

import * as React from 'react';
import { Plus, BookOpen, Star, Eye, Pencil, Trash2, X, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageFilters } from '@/components/layouts/filter-panel-context';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import {
  HRSettingsFormDrawer, FormField, ConfirmationModal, EmptyState, ActiveBadge,
} from '@/components/ui/shared-dialogs';
import { DirectoryPagedViews, useServerDirectoryPagination } from '@/components/ui/paged-list';
import { contractArticlesApi } from '@/features/hr/contracts/lib/contracts-api';
import { useDefaultCompanyId } from '@/features/hr/organization/lib/default-company-id';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import {
  normalizeArticleBody,
  type HRContractArticle,
} from '@/features/hr/contracts/lib/contract-articles-store';
import {
  ORGANIZATION_ARCHIVE_SCOPE_DEFAULT,
  ORGANIZATION_ARCHIVE_SCOPE_OPTIONS,
  filterRowsByArchiveScope,
  payrollListArchiveQuery,
  type OrganizationArchiveScope,
} from '@/features/hr/organization/lib/archive-scope';
import { cn } from '@/shared/utils';

type DraftForm = {
  code: string;
  title: string;
  body: string;
  isBasic: boolean;
  includesCompensation: boolean;
  isActive: boolean;
};

const EMPTY_FORM: DraftForm = {
  code: '', title: '', body: '', isBasic: false, includesCompensation: false, isActive: true,
};

/** Contract figures an article can place anywhere in its text (filled at print time). */
const COMPENSATION_TOKENS: { token: string; label: string }[] = [
  { token: '{{salary}}', label: 'الراتب الأساسي' },
  { token: '{{allowancesList}}', label: 'البدلات' },
  { token: '{{allowancesTotal}}', label: 'مجموع البدلات' },
  { token: '{{totalSalary}}', label: 'الإجمالي شامل البدلات' },
  { token: '{{currency}}', label: 'العملة' },
];
/** Employee details an article can place in its text; each contract prints its own employee's values. */
const EMPLOYEE_TOKENS: { token: string; label: string }[] = [
  { token: '{{employeeName}}', label: 'اسم الموظف' },
  { token: '{{jobTitle}}', label: 'المسمى الوظيفي' },
  { token: '{{city}}', label: 'المدينة' },
  { token: '{{branch}}', label: 'الفرع' },
  { token: '{{nationality}}', label: 'الجنسية' },
  { token: '{{nationalId}}', label: 'رقم الهوية' },
];
const COMPENSATION_TOKEN_RE =/\{\{(salary|baseSalary|allowancesList|allowancesTotal|totalSalary)\}\}/;

function makeArticleCode() {
  return `ART-${Date.now().toString(36).toUpperCase()}`;
}

export function ContractArticlesClient() {
  const companyId = useDefaultCompanyId() ?? '';

  const [archiveScope, setArchiveScope] = React.useState<OrganizationArchiveScope>(
    ORGANIZATION_ARCHIVE_SCOPE_DEFAULT,
  );

  const { values } = usePageFilters([
    {
      key: 'kind', label: 'النوع', type: 'select',
      options: [
        { value: 'basic', label: 'أساسية' },
        { value: 'optional', label: 'اختيارية' },
      ],
    },
  ]);

  const kindFilter = (values.kind as string) || 'all';

  const loadPage = React.useCallback(async (page: number, pageSize: number) => {
    if (!companyId) return { items: [] as HRContractArticle[], total: 0 };
    try {
      const res = await contractArticlesApi.list({
        companyId,
        page,
        limit: pageSize,
        ...payrollListArchiveQuery(),
        ...(kindFilter === 'basic' ? { isBasic: true } : kindFilter === 'optional' ? { isBasic: false } : {}),
      });
      const mapped = res.items.map((a) => ({
        id: a.id,
        code: a.code,
        title: a.titleAr,
        body: normalizeArticleBody(a.bodyAr ?? ''),
        isBasic: a.isBasic,
        includesCompensation: a.includesCompensation === true,
        isActive: a.isActive,
        updatedAt: a.updatedAt,
        isArchived: a.isArchived,
      }));
      const scoped = filterRowsByArchiveScope(mapped, archiveScope);
      const items = scoped.sort((a, b) => a.code.localeCompare(b.code));
      const total = archiveScope === 'active' && kindFilter === 'all'
        ? res.pagination.total
        : items.length;
      return { items, total };
    } catch (err) {
      handleApiError(err, 'contract-articles.load');
      return { items: [], total: 0 };
    }
  }, [archiveScope, companyId, kindFilter]);

  const {
    items: filtered,
    loading: listLoading,
    pagination,
    reload: reloadArticles,
  } = useServerDirectoryPagination<HRContractArticle>(loadPage, {
    enabled: !!companyId,
    resetDeps: [kindFilter, archiveScope],
  });
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<DraftForm>(EMPTY_FORM);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const [previewId, setPreviewId] = React.useState<string | null>(null);

  const total = pagination.total;
  const preview = previewId ? filtered.find(a => a.id === previewId) ?? null : null;

  const openCreate = () => {
    setEditId(null); setForm(EMPTY_FORM); setError(null); setDrawerOpen(true);
  };
  const openEdit = (a: HRContractArticle) => {
    setEditId(a.id);
    setForm({
      code: a.code,
      title: a.title,
      body: a.body,
      isBasic: a.isBasic,
      includesCompensation: a.includesCompensation,
      isActive: a.isActive,
    });
    setError(null); setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setError('العنوان مطلوب'); return; }
    if (!form.body.trim()) { setError('نص المادة مطلوب'); return; }
    try {
      const payload = { ...form, code: editId ? form.code : makeArticleCode() };
      if (editId) {
        await contractArticlesApi.update(editId, {
          code: payload.code.trim(),
          titleAr: payload.title.trim(),
          bodyAr: normalizeArticleBody(payload.body),
          isBasic: payload.isBasic,
          includesCompensation: payload.includesCompensation,
          isActive: payload.isActive,
        });
      } else {
        await contractArticlesApi.create({
          companyId,
          code: payload.code,
          titleAr: payload.title.trim(),
          bodyAr: normalizeArticleBody(payload.body),
          isBasic: payload.isBasic,
          includesCompensation: payload.includesCompensation,
          isActive: payload.isActive,
        });
      }
      setDrawerOpen(false);
      await reloadArticles();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const patch = (p: Partial<DraftForm>) => setForm(f => ({ ...f, ...p }));

  const bodyRef = React.useRef<HTMLTextAreaElement>(null);
  const insertToken = (token: string) => {
    const el = bodyRef.current;
    const start = el?.selectionStart ?? form.body.length;
    const end = el?.selectionEnd ?? form.body.length;
    patch({ body: form.body.slice(0, start) + token + form.body.slice(end) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };
  const bodyUsesCompensationTokens = COMPENSATION_TOKEN_RE.test(form.body);

  const activeFilterCount = kindFilter !== 'all' ? 1 : 0;

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton activeFilterCount={activeFilterCount} />
        <Button onClick={openCreate} size="sm" className="h-8 gap-1.5">
          <Plus className="h-4 w-4" />مادة جديدة
        </Button>
      </div>
    ),
    [archiveScope, activeFilterCount, openCreate],
  );

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showDateSection={false}
        showStatusSection={false}
        showEmployeePicker={false}
        onDateBoundsChange={() => {}}
        inlineSelects={[
          {
            id: 'archive',
            value: archiveScope,
            onChange: (v) => setArchiveScope(v as OrganizationArchiveScope),
            placeholder: 'العرض',
            options: ORGANIZATION_ARCHIVE_SCOPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
          },
        ]}
      />
    ),
    [archiveScope],
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <SetPageTitle titleAr="مواد العقود" descriptionAr="مكتبة البنود والمواد القانونية للعقود." iconName="BookOpen" />

      {/* ── Hero bar ── */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/8">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">إجمالي المواد</p>
            <p className="text-2xl font-bold tabular-nums leading-none text-foreground">{total}</p>
          </div>
        </div>
      </div>

      {!listLoading && filtered.length === 0 && pagination.total === 0 ? (
        <EmptyState icon={BookOpen} title="لا توجد مواد" description="أضف مادة جديدة لمكتبة العقود." />
      ) : (
        <DirectoryPagedViews items={filtered} serverPagination={pagination} loading={listLoading}>
          {(pageItems) => (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 animate-fade-in">
          {pageItems.map(a => (
            <Card
              key={a.id}
              className={cn(
                'luxe-card group relative overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-elevated',
                !a.isActive && 'opacity-55',
              )}
              onClick={() => setPreviewId(a.id)}
            >
              {/* Left accent bar */}
              <div className={cn(
                'absolute inset-e-0 top-0 bottom-0 w-1 rounded-e-lg',
                a.isBasic ? 'bg-primary' : 'bg-border',
              )} />

              <CardContent className="p-4 pe-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Badges row */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {a.isBasic ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/8 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          <Star className="h-2.5 w-2.5" />أساسية
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                          اختيارية
                        </span>
                      )}
                      {!a.isActive && (
                        <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                          غير نشطة
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <p className="font-semibold text-sm text-foreground leading-snug truncate">{a.title}</p>

                    {/* Body preview */}
                    <p className="text-[11.5px] text-muted-foreground   leading-relaxed">
                      {a.body.slice(0, 140)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div
                    className="flex shrink-0 flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors"
                      onClick={() => setPreviewId(a.id)}
                      title="معاينة"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:border-gold/40 hover:text-gold transition-colors"
                      onClick={() => openEdit(a)}
                      title="تعديل"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:border-destructive/40 hover:text-destructive transition-colors"
                      onClick={() => setConfirmId(a.id)}
                      title="حذف"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
          )}
        </DirectoryPagedViews>
      )}

      {/* ── Preview modal ── */}
      {preview && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setPreviewId(null)}
        >
          <div
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-luxe max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className={cn(
              'relative flex items-start justify-between gap-3 border-b border-border px-5 py-4',
              preview.isBasic
                ? 'bg-linear-to-b from-primary/8 to-card'
                : 'bg-linear-to-b from-muted/60 to-card',
            )}>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {preview.isBasic ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/8 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                      <Star className="h-3 w-3" />مادة أساسية
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                      اختيارية
                    </span>
                  )}
                  {preview.isActive && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-success/25 bg-success/8 px-2.5 py-0.5 text-[11px] font-medium text-success">
                      <CheckCircle2 className="h-3 w-3" />نشطة
                    </span>
                  )}
                </div>
                <h2 className="text-base font-bold text-foreground leading-snug">{preview.title}</h2>
              </div>
              <button
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setPreviewId(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto px-5 py-4 flex-1">
              <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-loose">{preview.body}</p>
              {preview.includesCompensation ? (
                <p className="mt-3 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  الراتب الأساسي والبدلات: تُقرأ من العقد تلقائياً عند الطباعة
                </p>
              ) : null}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <Button variant="outline" size="sm" onClick={() => { setPreviewId(null); openEdit(preview); }}>
                <Pencil className="h-3.5 w-3.5 me-1.5" />تعديل
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPreviewId(null)}>إغلاق</Button>
            </div>
          </div>
        </div>
      )}

      <HRSettingsFormDrawer
        open={drawerOpen} onOpenChange={setDrawerOpen}
        title={editId ? 'تعديل المادة' : 'مادة جديدة'}
        onSave={handleSave} error={error}
      >
        <FormField label="العنوان" required span2>
          <Input value={form.title} onChange={e => patch({ title: e.target.value })} placeholder="عنوان المادة…" />
        </FormField>
        <FormField label="نص المادة" required span2>
          <Textarea
            ref={bodyRef}
            value={form.body}
            onChange={e => patch({ body: e.target.value })}
            placeholder="نص البند القانوني…"
            rows={6}
          />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">إدراج قيمة من العقد:</span>
            {COMPENSATION_TOKENS.map(t => (
              <button
                key={t.token}
                type="button"
                onClick={() => insertToken(t.token)}
                className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[11px] text-foreground hover:border-primary/40 hover:bg-primary/8 transition-colors"
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">إدراج بيانات الموظف:</span>
            {EMPLOYEE_TOKENS.map(t => (
              <button
                key={t.token}
                type="button"
                onClick={() => insertToken(t.token)}
                className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[11px] text-foreground hover:border-primary/40 hover:bg-primary/8 transition-colors"
              >
                {t.label}
              </button>
            ))}
          </div>
          {bodyUsesCompensationTokens ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              تُستبدل القيم المُدرجة في النص عند الطباعة بأرقام كل عقد، ولا تُكرَّر تحت النص.
            </p>
          ) : form.includesCompensation ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              يُضاف تحت هذا النص عند الطباعة الراتب الأساسي والبدلات من بيانات كل عقد تلقائياً، ولا يتأثر بتعديل النص.
            </p>
          ) : null}
        </FormField>
        <FormField label="">
          <div className="flex items-center gap-2 pt-2">
            <Switch id="isBasic" checked={form.isBasic} onCheckedChange={v => patch({ isBasic: v })} />
            <Label htmlFor="isBasic">مادة أساسية</Label>
          </div>
        </FormField>
        <FormField label="">
          <div className="flex items-center gap-2 pt-2">
            <Switch
              id="includesCompensation"
              checked={form.includesCompensation}
              onCheckedChange={v => patch({ includesCompensation: v })}
            />
            <Label htmlFor="includesCompensation">تتضمن الراتب والبدلات</Label>
          </div>
        </FormField>
        <FormField label="">
          <div className="flex items-center gap-2 pt-2">
            <Switch id="isActive" checked={form.isActive} onCheckedChange={v => patch({ isActive: v })} />
            <Label htmlFor="isActive">نشطة</Label>
          </div>
        </FormField>
      </HRSettingsFormDrawer>

      <ConfirmationModal
        open={!!confirmId}
        onOpenChange={v => { if (!v) setConfirmId(null); }}
        title="حذف المادة"
        description="هل أنت متأكد من حذف هذه المادة من المكتبة؟"
        confirmLabel="حذف"
        variant="destructive"
        onConfirm={async () => {
          if (confirmId) {
            await contractArticlesApi.delete(confirmId);
            setConfirmId(null);
            await reloadArticles();
          }
        }}
      />
    </div>
  );
}
