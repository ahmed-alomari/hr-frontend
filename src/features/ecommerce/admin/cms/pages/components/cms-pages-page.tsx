'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleHelp,
  FileText,
  Loader2,
  Mail,
  Pencil,
  Percent,
  Scale,
  Save,
  Shield,
  ShoppingBag,
  Users,
} from 'lucide-react';
import { getStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import {
  getCmsCompanyRecord,
  getCmsContentBundle,
  saveCmsAbout,
  saveCmsCompanyRecord,
  saveCmsContact,
  saveCmsLegalPage,
} from '@/features/ecommerce/admin/cms/shared/cms-actions';
import {
  normalizeStorePagesVisibility,
  type CompanyConfigRecord,
  type CompanyStorePagesVisibility,
} from '@/features/ecommerce/storefront/domain/company-config';
import type {
  AboutPageContent,
  ContactPageContent,
  LegalPageContent,
  LegalPageSlug,
  StorefrontContentBundle,
} from '@/features/ecommerce/storefront/domain/content';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { CmsAboutTab } from '@/features/ecommerce/admin/cms/pages/components/cms-about-tab';
import { CmsContactTab } from '@/features/ecommerce/admin/cms/pages/components/cms-contact-tab';
import {
  CmsLegalPageForm,
  emptyLegalPage,
  ensureLegalPages,
  LEGAL_SLUGS,
} from '@/features/ecommerce/admin/cms/pages/components/cms-legal-tab';
import { FaqCmsPage } from '@/features/ecommerce/admin/cms/faq/components/faq-cms-page';
import { cn } from '@/shared/utils';

const CMS_PAGES_QUERY_KEY = ['ecommerce-cms', 'content', 'pages'] as const;
const CMS_COMPANY_QUERY_KEY = ['ecommerce-cms', 'company', 'pages-visibility'] as const;

export type CmsPagesPanel = 'list' | 'faq';

type PageRowKind = 'about' | 'contact' | 'legal' | 'faq' | 'catalog';

type PageRow = {
  id: string;
  kind: PageRowKind;
  slug?: LegalPageSlug;
  catalogKey?: keyof CompanyStorePagesVisibility;
  titleKey: 'about' | 'contact' | 'faq' | 'offers' | 'wholesale' | LegalPageSlug;
};

type EditFormState =
  | { kind: 'about'; draft: AboutPageContent }
  | { kind: 'contact'; draft: ContactPageContent }
  | { kind: 'legal'; slug: LegalPageSlug; draft: LegalPageContent };

type PageGroupId = 'store' | 'legal' | 'content' | 'catalog';

function buildPageRows(): PageRow[] {
  return [
    { id: 'about', kind: 'about', titleKey: 'about' },
    { id: 'contact', kind: 'contact', titleKey: 'contact' },
    ...LEGAL_SLUGS.map((slug) => ({
      id: `legal-${slug}`,
      kind: 'legal' as const,
      slug,
      titleKey: slug,
    })),
    { id: 'faq', kind: 'faq', titleKey: 'faq' },
    { id: 'offers', kind: 'catalog', catalogKey: 'offers', titleKey: 'offers' },
    { id: 'wholesale', kind: 'catalog', catalogKey: 'wholesale', titleKey: 'wholesale' },
  ];
}

function groupForRow(row: PageRow): PageGroupId {
  if (row.kind === 'legal') return 'legal';
  if (row.kind === 'faq') return 'content';
  if (row.kind === 'catalog') return 'catalog';
  return 'store';
}

function rowIcon(row: PageRow) {
  if (row.kind === 'about') return Users;
  if (row.kind === 'contact') return Mail;
  if (row.kind === 'faq') return CircleHelp;
  if (row.kind === 'catalog') {
    return row.catalogKey === 'offers' ? Percent : ShoppingBag;
  }
  if (row.slug === 'privacy') return Shield;
  if (row.slug === 'terms') return Scale;
  return FileText;
}

type Props = {
  embedded?: boolean;
  initialPanel?: CmsPagesPanel;
};

export function CmsPagesPage({ embedded = false, initialPanel = 'list' }: Props) {
  const companyId = getStorefrontCompanyId();
  const t = useTranslations('ecommerceAdmin.cmsPages');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();

  const [panel, setPanel] = React.useState<CmsPagesPanel>(initialPanel);
  const [form, setForm] = React.useState<EditFormState | null>(null);

  React.useEffect(() => {
    setPanel(initialPanel);
  }, [initialPanel]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [...CMS_PAGES_QUERY_KEY, companyId],
    queryFn: async () => {
      const bundle = await getCmsContentBundle(companyId);
      const resolved =
        bundle ??
        ({
          companyId,
          about: {
            headline: { ar: '', en: '' },
            intro: { ar: '', en: '' },
            sections: [],
            stats: [],
          },
          contact: {
            headline: { ar: '', en: '' },
            intro: { ar: '', en: '' },
          },
          faq: [],
          legal: [],
        } satisfies StorefrontContentBundle);
      return {
        ...resolved,
        legal: ensureLegalPages(resolved.legal),
      } satisfies StorefrontContentBundle;
    },
  });

  const {
    data: company,
    isLoading: companyLoading,
    isError: companyError,
    refetch: refetchCompany,
  } = useQuery({
    queryKey: [...CMS_COMPANY_QUERY_KEY, companyId],
    queryFn: async () => {
      const record = await getCmsCompanyRecord(companyId);
      if (!record) throw new Error('COMPANY_NOT_FOUND');
      return {
        ...record,
        storePages: normalizeStorePagesVisibility(record.storePages),
      } satisfies CompanyConfigRecord;
    },
  });

  const [draft, setDraft] = React.useState<StorefrontContentBundle | null>(null);
  const [storePages, setStorePages] = React.useState<CompanyStorePagesVisibility | null>(null);

  React.useEffect(() => {
    if (data) {
      setDraft(structuredClone(data));
    }
  }, [data]);

  React.useEffect(() => {
    if (company) {
      setStorePages(normalizeStorePagesVisibility(company.storePages));
    }
  }, [company]);

  const save = useMutation({
    mutationFn: async (bundle: StorefrontContentBundle) => {
      const about = await saveCmsAbout(companyId, bundle.about);
      const contact = await saveCmsContact(companyId, bundle.contact);
      const legal: LegalPageContent[] = [];
      for (const page of ensureLegalPages(bundle.legal)) {
        legal.push(
          await saveCmsLegalPage(companyId, {
            ...page,
            updatedAt: new Date().toISOString(),
          }),
        );
      }
      return {
        ...bundle,
        about,
        contact,
        legal: ensureLegalPages(legal),
      } satisfies StorefrontContentBundle;
    },
    onSuccess: (saved) => {
      queryClient.setQueryData([...CMS_PAGES_QUERY_KEY, companyId], saved);
      setDraft(saved);
      toast.success(t('saveSuccess'));
    },
    onError: () => toast.error(t('saveError')),
  });

  const saveVisibility = useMutation({
    mutationFn: async (next: CompanyStorePagesVisibility) => {
      if (!company) throw new Error('COMPANY_NOT_FOUND');
      return saveCmsCompanyRecord({
        ...company,
        storePages: normalizeStorePagesVisibility(next),
      });
    },
    onSuccess: (saved) => {
      queryClient.setQueryData([...CMS_COMPANY_QUERY_KEY, companyId], saved);
      setStorePages(normalizeStorePagesVisibility(saved.storePages));
      toast.success(t('visibilitySaveSuccess'));
    },
    onError: () => toast.error(t('visibilitySaveError')),
  });

  function pagePreview(row: PageRow): string {
    if (row.kind === 'catalog') {
      return t('catalogHint');
    }
    if (!draft) return '';
    if (row.kind === 'about') {
      return draft.about.headline.ar.trim() || draft.about.intro.ar.trim();
    }
    if (row.kind === 'contact') {
      return draft.contact.headline.ar.trim() || draft.contact.intro.ar.trim();
    }
    if (row.kind === 'faq') {
      return t('faqPreview', { count: draft.faq.length });
    }
    const page = draft.legal.find((item) => item.slug === row.slug);
    return page?.title.ar.trim() || page?.body.ar.replace(/<[^>]+>/g, '').trim() || '';
  }

  function hasContent(row: PageRow): boolean {
    if (row.kind === 'catalog') return Boolean(row.catalogKey && storePages?.[row.catalogKey]);
    if (row.kind === 'faq') return (draft?.faq.length ?? 0) > 0;
    return Boolean(pagePreview(row).trim());
  }

  function groupLabel(groupId: PageGroupId): string {
    if (groupId === 'store') return t('groupStore');
    if (groupId === 'legal') return t('groupLegal');
    if (groupId === 'content') return t('groupContent');
    return t('groupCatalog');
  }

  function openEdit(row: PageRow) {
    if (row.kind === 'catalog') return;
    if (row.kind === 'faq') {
      setForm(null);
      setPanel('faq');
      return;
    }
    if (!draft) return;
    if (row.kind === 'about') {
      setForm({ kind: 'about', draft: structuredClone(draft.about) });
      return;
    }
    if (row.kind === 'contact') {
      setForm({ kind: 'contact', draft: structuredClone(draft.contact) });
      return;
    }
    const page = draft.legal.find((item) => item.slug === row.slug) ?? emptyLegalPage(row.slug!);
    setForm({
      kind: 'legal',
      slug: row.slug!,
      draft: structuredClone(page),
    });
  }

  function bundleFromForm(current: StorefrontContentBundle, currentForm: EditFormState): StorefrontContentBundle {
    if (currentForm.kind === 'about') {
      return { ...current, about: currentForm.draft };
    }
    if (currentForm.kind === 'contact') {
      return { ...current, contact: currentForm.draft };
    }
    return {
      ...current,
      legal: ensureLegalPages(
        current.legal.map((page) => (page.slug === currentForm.slug ? currentForm.draft : page)),
      ),
    };
  }

  async function saveForm() {
    if (!form || !draft || save.isPending) return;
    const next = bundleFromForm(draft, form);
    const saved = await save.mutateAsync(next);
    // Keep editor open; sync local form buffer with saved server values.
    if (form.kind === 'about') {
      setForm({ kind: 'about', draft: structuredClone(saved.about) });
    } else if (form.kind === 'contact') {
      setForm({ kind: 'contact', draft: structuredClone(saved.contact) });
    } else {
      const page =
        saved.legal.find((item) => item.slug === form.slug) ?? emptyLegalPage(form.slug);
      setForm({ kind: 'legal', slug: form.slug, draft: structuredClone(page) });
    }
  }

  function toggleCatalogPage(key: keyof CompanyStorePagesVisibility, enabled: boolean) {
    if (!storePages || saveVisibility.isPending) return;
    const next = { ...storePages, [key]: enabled };
    setStorePages(next);
    void saveVisibility.mutateAsync(next);
  }

  const rows = buildPageRows();

  function rowStatusBadge(row: PageRow) {
    const isCatalog = row.kind === 'catalog';
    return (
      <Badge variant="subtle" className="shrink-0 rounded-md">
        {hasContent(row) ? (
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-primary" />
            {isCatalog ? t('visibilityOn') : t('contentReady')}
          </span>
        ) : (
          t(isCatalog ? 'visibilityOff' : 'contentEmpty')
        )}
      </Badge>
    );
  }

  function rowAction(row: PageRow) {
    if (row.kind === 'catalog' && row.catalogKey) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{t('columnVisibility')}</span>
          <Switch
            checked={storePages?.[row.catalogKey] ?? true}
            disabled={!storePages || saveVisibility.isPending}
            onCheckedChange={(enabled) => toggleCatalogPage(row.catalogKey!, enabled)}
            aria-label={t('columnVisibility')}
          />
        </div>
      );
    }
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-xl"
        disabled={!draft}
        onClick={() => openEdit(row)}
      >
        <Pencil className="me-1.5 h-3.5 w-3.5" />
        {t('editPage')}
      </Button>
    );
  }

  const editorTitle =
    form?.kind === 'about'
      ? t('about')
      : form?.kind === 'contact'
        ? t('contact')
        : form?.kind === 'legal'
          ? t(form.slug)
          : '';

  const loading = isLoading || companyLoading;
  const loadFailed = isError || companyError;

  if (panel === 'faq') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setPanel('list')}>
            <ArrowRight className="me-1.5 h-4 w-4" />
            {t('backToPages')}
          </Button>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{t('faq')}</h2>
            <p className="text-xs text-muted-foreground">{t('editContentHint')}</p>
          </div>
        </div>
        <FaqCmsPage embedded />
      </div>
    );
  }

  if (form) {
    return (
      <div className="flex flex-col gap-4">
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              disabled={save.isPending}
              onClick={() => setForm(null)}
            >
              <ArrowRight className="me-1.5 h-4 w-4" />
              {t('backToPages')}
            </Button>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">{editorTitle}</h2>
              <p className="text-xs text-muted-foreground">{t('studioEditorHint')}</p>
            </div>
          </div>
          <Button
            type="button"
            className="rounded-xl"
            disabled={save.isPending}
            onClick={() => void saveForm()}
          >
            {save.isPending ? <Loader2 className="me-1.5 h-4 w-4 animate-spin" /> : <Save className="me-1.5 h-4 w-4" />}
            {save.isPending ? tCommon('status.saving') : tCommon('actions.save')}
          </Button>
        </section>

        <section className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4 sm:px-6">
            <h3 className="text-base font-semibold text-foreground">{editorTitle}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{t('editDialogHint')}</p>
          </div>
          <div className="px-5 py-5 sm:px-6">
            {form.kind === 'about' ? (
              <CmsAboutTab about={form.draft} onChange={(about) => setForm({ kind: 'about', draft: about })} />
            ) : null}
            {form.kind === 'contact' ? (
              <CmsContactTab
                contact={form.draft}
                onChange={(contact) => setForm({ kind: 'contact', draft: contact })}
              />
            ) : null}
            {form.kind === 'legal' ? (
              <CmsLegalPageForm
                page={form.draft}
                onChange={(page) => setForm({ kind: 'legal', slug: form.slug, draft: page })}
              />
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {!embedded ? (
        <SetPageTitle titleAr={t('title')} descriptionAr={t('description')} iconName="BookOpen" />
      ) : null}

      {loadFailed ? (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 py-6">
            <p className="text-sm text-destructive">{t('loadError')}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void refetch();
                void refetchCompany();
              }}
            >
              {tCommon('actions.retry')}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="space-y-0">
            {Array.from({ length: 7 }).map((_, index) => (
              <div
                key={index}
                className="h-14 animate-pulse border-b border-border bg-muted/30 last:border-0"
              />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Phones: one card per page, same status and actions. */}
          <div className="space-y-2.5 md:hidden">
            {rows.map((row) => {
              const Icon = rowIcon(row);
              const preview = pagePreview(row);
              return (
                <article key={row.id} className="rounded-xl border border-border bg-card p-3 shadow-soft">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-foreground">{t(row.titleKey)}</p>
                        {rowStatusBadge(row)}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{groupLabel(groupForRow(row))}</p>
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {preview || t('noPreview')}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end border-t border-border pt-2.5">{rowAction(row)}</div>
                </article>
              );
            })}
          </div>
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
            <table className="w-full min-w-190 text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                  <th className="px-4 py-3 text-start font-medium">{t('columnPage')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('columnGroup')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('columnPreview')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('columnStatus')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('columnActions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const Icon = rowIcon(row);
                  const preview = pagePreview(row);
                  const isCatalog = row.kind === 'catalog';
                  return (
                    <tr
                      key={row.id}
                      className={cn('border-b border-border last:border-0', !isCatalog && 'hover:bg-muted/20')}
                    >
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-4 w-4" aria-hidden />
                          </span>
                          <span className="font-medium text-foreground">{t(row.titleKey)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle text-muted-foreground">{groupLabel(groupForRow(row))}</td>
                      <td className="max-w-xs px-4 py-3 align-middle">
                        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {preview || t('noPreview')}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-middle">{rowStatusBadge(row)}</td>
                      <td className="px-4 py-3 align-middle">{rowAction(row)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
