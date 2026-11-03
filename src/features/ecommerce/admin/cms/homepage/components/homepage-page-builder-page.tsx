'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  LayoutTemplate,
  Loader2,
  Pencil,
  Plus,
  Rocket,
  Save,
  Trash2,
} from 'lucide-react';
import { getStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import { storefrontPublicHomeHref } from '@/features/ecommerce/storefront/lib/store-paths';
import { getAllSectionDefinitions } from '@/features/ecommerce/storefront/page-builder/lib/section-definition-registry';
import type { PageRecord } from '@/features/ecommerce/storefront/page-builder/domain/page-records';
import type { SectionRecord } from '@/features/ecommerce/storefront/page-builder/domain/section-types';
import type { SectionType } from '@/features/ecommerce/storefront/page-builder/domain/section-types';
import { useHomepagePageRecord } from '@/features/ecommerce/admin/cms/homepage/hooks/use-homepage-page';
import { useHomepagePageMutations } from '@/features/ecommerce/admin/cms/homepage/hooks/use-homepage-mutations';
import {
  createSectionFromDefinition,
  reorderSections,
} from '@/features/ecommerce/admin/cms/homepage/lib/create-section';
import { SectionEditDialog } from '@/features/ecommerce/admin/cms/homepage/components/section-edit-dialog';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { useEntityFilterSlot } from '@/components/layouts/entity-filter-slot-context';
import { PageHeaderPrimaryButton } from '@/components/layouts/page-header-primary-button';
import { FilterToggleButton } from '@/components/layouts/filter-toggle-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ListFilterBar } from '@/components/ui/list-filter-bar';
import { EntityFilterSearchField } from '@/components/ui/entity-filter-search-field';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function sectionDisplayName(section: SectionRecord, locale: string): string {
  const definition = getAllSectionDefinitions().find((item) => item.type === section.type);
  if (!definition) return section.type;
  return locale === 'en' ? definition.displayName.en : definition.displayName.ar;
}

function sectionStatusBadgeVariant(status: SectionRecord['status']): 'secondary' | 'success' | 'subtle' {
  if (status === 'published') return 'success';
  if (status === 'draft') return 'secondary';
  return 'subtle';
}

export function HomepagePageBuilderPage() {
  const companyId = getStorefrontCompanyId();
  const t = useTranslations('ecommerceAdmin.homepage');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const { data, isLoading, isError, refetch } = useHomepagePageRecord(companyId);
  const { save } = useHomepagePageMutations(companyId);

  const [draft, setDraft] = React.useState<PageRecord | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [editingSection, setEditingSection] = React.useState<SectionRecord | null>(null);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [sectionToRemove, setSectionToRemove] = React.useState<SectionRecord | null>(null);
  const [search, setSearch] = React.useState('');
  const [enabledFilter, setEnabledFilter] = React.useState('all');

  React.useEffect(() => {
    if (data) {
      setDraft(structuredClone(data));
      setDirty(false);
    }
  }, [data]);

  const definitions = getAllSectionDefinitions();
  const sections = draft ? [...draft.sections].sort((a, b) => a.order - b.order) : [];

  const normalizedSearch = search.trim().toLowerCase();
  const filteredSections = sections.filter((section) => {
    const matchesSearch =
      !normalizedSearch || sectionDisplayName(section, locale).toLowerCase().includes(normalizedSearch) ||
      section.type.toLowerCase().includes(normalizedSearch);
    const matchesEnabled =
      enabledFilter === 'all' ||
      (enabledFilter === 'enabled' ? section.enabled : !section.enabled);
    return matchesSearch && matchesEnabled;
  });

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <FilterToggleButton />
        <Button type="button" variant="outline" size="sm" className="h-8" asChild>
          <Link href={storefrontPublicHomeHref()} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('previewStorefront')}</span>
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={!draft || save.isPending}
          onClick={() => void persist()}
        >
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{t('saveDraft')}</span>
        </Button>
        <PageHeaderPrimaryButton
          icon={Rocket}
          label={save.isPending ? tCommon('status.saving') : t('publish')}
          disabled={!draft || save.isPending}
          loading={save.isPending}
          onClick={() => void persist('published')}
        />
        <Button type="button" size="sm" className="h-8" disabled={!draft} onClick={() => setPaletteOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('addSection')}</span>
        </Button>
      </div>
    ),
    [draft, save.isPending, t, tCommon],
  );

  useEntityFilterSlot(
    () => (
      <ListFilterBar
        showDateSection={false}
        showStatusSection={false}
        showEmployeePicker={false}
        leadingFilters={
          <EntityFilterSearchField value={search} onChange={setSearch} placeholder={tCommon('actions.search')} />
        }
        inlineSelects={[
          {
            id: 'enabled',
            value: enabledFilter,
            onChange: setEnabledFilter,
            placeholder: tCommon('actions.filter'),
            options: [
              { value: 'all', label: tCommon('actions.filter') },
              { value: 'enabled', label: t('enabled') },
              { value: 'disabled', label: t('disabled') },
            ],
          },
        ]}
      />
    ),
    [search, enabledFilter, t, tCommon],
  );

  function updateDraft(updater: (current: PageRecord) => PageRecord) {
    setDraft((current) => {
      if (!current) return current;
      setDirty(true);
      return updater(current);
    });
  }

  async function persist(status?: PageRecord['status']) {
    if (!draft) return;
    const now = new Date().toISOString();
    // Keep current status on Save; only Publish switches the live store page.
    const nextStatus = status ?? draft.status;
    const sections = reorderSections(draft.sections).map((section) => {
      if (nextStatus === 'published' && section.enabled && section.status !== 'published') {
        return { ...section, status: 'published' as const, publishedAt: section.publishedAt ?? now };
      }
      return section;
    });
    const next: PageRecord = {
      ...draft,
      status: nextStatus,
      publishedAt: nextStatus === 'published' ? (draft.publishedAt ?? now) : draft.publishedAt,
      sections,
    };
    const saved = await save.mutateAsync(next);
    setDraft(saved);
    setDirty(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <SetPageTitle titleAr={t('title')} descriptionAr={t('description')} iconName="LayoutTemplate" />

      {dirty ? (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {t('unsavedHint')}
        </div>
      ) : null}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/50" />
          ))}
        </div>
      ) : null}
      {isError ? (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 py-6">
            <p className="text-sm text-destructive">{t('loadError')}</p>
            <Button type="button" variant="outline" onClick={() => void refetch()}>
              {tCommon('actions.retry')}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {draft ? (
        <>
          <h2 className="text-sm font-semibold text-foreground">{t('sectionPalette')}</h2>

          {sections.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20 py-16 text-center">
              <LayoutTemplate className="mb-3 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">{t('empty')}</p>
            </div>
          ) : filteredSections.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20 py-16 text-center">
              <LayoutTemplate className="mb-3 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">{t('empty')}</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {filteredSections.map((section) => {
                const index = sections.findIndex((item) => item.id === section.id);
                return (
                <li key={section.id}>
                  <Card className="rounded-2xl transition-shadow hover:shadow-elevated">
                    <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary">
                          <LayoutTemplate className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 space-y-1.5">
                          <p className="truncate font-medium text-foreground">
                            {sectionDisplayName(section, locale)}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <Badge variant="outline">{section.type}</Badge>
                            <span>{t('order')}: {section.order}</span>
                            <Badge variant={section.enabled ? 'success' : 'subtle'}>
                              {section.enabled ? t('enabled') : t('disabled')}
                            </Badge>
                            <Badge variant={sectionStatusBadgeVariant(section.status)}>
                              {t(`statuses.${section.status}`)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2 rounded-lg border border-border px-2 py-1">
                          <Switch
                            checked={section.enabled}
                            onCheckedChange={(enabled) =>
                              updateDraft((current) => ({
                                ...current,
                                sections: current.sections.map((item) =>
                                  item.id === section.id ? { ...item, enabled } : item,
                                ),
                              }))
                            }
                          />
                          <span className="text-xs text-muted-foreground">{t('enabled')}</span>
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          disabled={index === 0}
                          onClick={() =>
                            updateDraft((current) => {
                              const ordered = [...current.sections].sort((a, b) => a.order - b.order);
                              if (index === 0) return current;
                              const swap = ordered[index - 1];
                              ordered[index - 1] = ordered[index];
                              ordered[index] = swap;
                              return { ...current, sections: reorderSections(ordered) };
                            })
                          }
                          aria-label={t('moveUp')}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          disabled={index === sections.length - 1}
                          onClick={() =>
                            updateDraft((current) => {
                              const ordered = [...current.sections].sort((a, b) => a.order - b.order);
                              if (index >= ordered.length - 1) return current;
                              const swap = ordered[index + 1];
                              ordered[index + 1] = ordered[index];
                              ordered[index] = swap;
                              return { ...current, sections: reorderSections(ordered) };
                            })
                          }
                          aria-label={t('moveDown')}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setEditingSection(section)}>
                          <Pencil className="h-4 w-4" />
                          {t('editSection')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setSectionToRemove(section)}
                        >
                          <Trash2 className="h-4 w-4" />
                          {t('removeSection')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </li>
                );
              })}
            </ul>
          )}
        </>
      ) : null}

      <Dialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('sectionPalette')}</DialogTitle>
          </DialogHeader>
          <ul className="space-y-2">
            {definitions.map((definition) => (
              <li key={definition.type}>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto w-full justify-start px-3 py-3 text-start"
                  onClick={() => {
                    updateDraft((current) => ({
                      ...current,
                      sections: [
                        ...current.sections,
                        createSectionFromDefinition(definition.type as SectionType, current.sections),
                      ],
                    }));
                    setPaletteOpen(false);
                  }}
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium">
                      {locale === 'en' ? definition.displayName.en : definition.displayName.ar}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {locale === 'en' ? definition.description.en : definition.description.ar}
                    </span>
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <SectionEditDialog
        open={Boolean(editingSection)}
        section={editingSection}
        onOpenChange={(open) => {
          if (!open) setEditingSection(null);
        }}
        onSave={(nextSection) => {
          updateDraft((current) => ({
            ...current,
            sections: current.sections.map((item) => (item.id === nextSection.id ? nextSection : item)),
          }));
          setEditingSection(null);
        }}
      />

      <Dialog open={Boolean(sectionToRemove)} onOpenChange={(open) => !open && setSectionToRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('removeConfirmTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('removeConfirmDescription', {
              name: sectionToRemove ? sectionDisplayName(sectionToRemove, locale) : '',
            })}
          </p>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setSectionToRemove(null)}>
              {tCommon('actions.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!sectionToRemove) return;
                updateDraft((current) => ({
                  ...current,
                  sections: reorderSections(current.sections.filter((item) => item.id !== sectionToRemove.id)),
                }));
                setSectionToRemove(null);
              }}
            >
              {tCommon('actions.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
