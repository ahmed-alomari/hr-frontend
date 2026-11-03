'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, ExternalLink, Pencil, Save } from 'lucide-react';
import { getStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import { storefrontPublicHomeHref } from '@/features/ecommerce/storefront/lib/store-paths';
import { getSectionDefinition } from '@/features/ecommerce/storefront/page-builder/lib/section-definition-registry';
import type { PageRecord } from '@/features/ecommerce/storefront/page-builder/domain/page-records';
import type {
  SectionRecord,
  SectionType,
} from '@/features/ecommerce/storefront/page-builder/domain/section-types';
import type { LocalizableString } from '@/features/ecommerce/storefront/domain/localizable';
import { useHomepagePageRecord } from '@/features/ecommerce/admin/cms/homepage/hooks/use-homepage-page';
import { useHomepagePageMutations } from '@/features/ecommerce/admin/cms/homepage/hooks/use-homepage-mutations';
import { reorderSections } from '@/features/ecommerce/admin/cms/homepage/lib/create-section';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { PageHeaderPrimaryButton } from '@/components/layouts/page-header-primary-button';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const STORE_SETTING_SECTION_TYPES = new Set<SectionType>([
  'category-grid',
  'product-carousel',
  'flash-sale',
]);

function getContentTitle(section: SectionRecord): LocalizableString {
  const content = section.content as { title?: LocalizableString | null };
  return content.title ?? { ar: '', en: '' };
}

function withArabicTitle(section: SectionRecord, titleAr: string): SectionRecord {
  const trimmed = titleAr.trim();
  return {
    ...section,
    content: {
      ...(section.content as Record<string, unknown>),
      title: { ar: trimmed, en: trimmed },
    },
  } as SectionRecord;
}

type SectionFormState = {
  open: boolean;
  sectionId: string;
  titleAr: string;
  typeLabel: string;
};

export function StoreSettingsPage() {
  const companyId = getStorefrontCompanyId();
  const t = useTranslations('ecommerceAdmin.storeSettings');
  const tHome = useTranslations('ecommerceAdmin.homepage');
  const tCommon = useTranslations('common');

  const { data, isLoading, isError, refetch } = useHomepagePageRecord(companyId);
  const { save } = useHomepagePageMutations(companyId);

  const [draft, setDraft] = React.useState<PageRecord | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [form, setForm] = React.useState<SectionFormState | null>(null);

  React.useEffect(() => {
    if (data) {
      setDraft(structuredClone(data));
      setDirty(false);
    }
  }, [data]);

  const sections = draft
    ? [...draft.sections]
        .filter((section) => STORE_SETTING_SECTION_TYPES.has(section.type))
        .sort((a, b) => a.order - b.order)
    : [];

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <Button type="button" variant="outline" size="sm" className="h-8" asChild>
          <Link href={storefrontPublicHomeHref()} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tHome('previewStorefront')}</span>
          </Link>
        </Button>
        <PageHeaderPrimaryButton
          icon={Save}
          label={save.isPending ? tCommon('status.saving') : tCommon('actions.save')}
          disabled={!draft || save.isPending || !dirty}
          loading={save.isPending}
          onClick={() => void persist()}
        />
      </div>
    ),
    [draft, dirty, save.isPending, tHome, tCommon],
  );

  function updateDraft(updater: (current: PageRecord) => PageRecord) {
    setDraft((current) => {
      if (!current) return current;
      setDirty(true);
      return updater(current);
    });
  }

  function patchSection(sectionId: string, patch: (section: SectionRecord) => SectionRecord) {
    updateDraft((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId ? patch(section) : section,
      ),
    }));
  }

  function openEdit(section: SectionRecord) {
    const definition = getSectionDefinition(section.type);
    setForm({
      open: true,
      sectionId: section.id,
      titleAr: getContentTitle(section).ar,
      typeLabel: definition.displayName.ar,
    });
  }

  function moveSection(sectionId: string, direction: -1 | 1) {
    updateDraft((current) => {
      const managed = [...current.sections]
        .filter((section) => STORE_SETTING_SECTION_TYPES.has(section.type))
        .sort((a, b) => a.order - b.order);
      const index = managed.findIndex((section) => section.id === sectionId);
      const swapIndex = index + direction;
      if (index < 0 || swapIndex < 0 || swapIndex >= managed.length) return current;

      const currentSection = managed[index]!;
      const swapSection = managed[swapIndex]!;
      const currentOrder = currentSection.order;
      const swapOrder = swapSection.order;

      return {
        ...current,
        sections: current.sections.map((section) => {
          if (section.id === currentSection.id) return { ...section, order: swapOrder };
          if (section.id === swapSection.id) return { ...section, order: currentOrder };
          return section;
        }),
      };
    });
  }

  function saveSectionForm() {
    if (!form) return;
    patchSection(form.sectionId, (current) => withArabicTitle(current, form.titleAr));
    setForm(null);
  }

  async function persist() {
    if (!draft) return;
    const now = new Date().toISOString();
    const nextSections = reorderSections(draft.sections).map((section) => {
      if (!STORE_SETTING_SECTION_TYPES.has(section.type)) return section;
      if (section.enabled && section.status !== 'published') {
        return { ...section, status: 'published' as const, publishedAt: section.publishedAt ?? now };
      }
      return { ...section, updatedAt: now };
    });
    const next: PageRecord = {
      ...draft,
      updatedAt: now,
      sections: nextSections,
    };
    const saved = await save.mutateAsync(next);
    setDraft(saved);
    setDirty(false);
  }

  const columns: ColumnDef<SectionRecord>[] = [
    {
      key: 'title',
      title: t('columnTitle'),
      render: (section) => {
        const titleAr = getContentTitle(section).ar.trim();
        return (
          <span
            className={`line-clamp-2 text-sm font-medium ${
              section.enabled ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            {titleAr || t('noTitle')}
          </span>
        );
      },
    },
    {
      key: 'type',
      title: t('columnType'),
      render: (section) => {
        const definition = getSectionDefinition(section.type);
        return <Badge variant="subtle">{definition.displayName.ar}</Badge>;
      },
    },
    {
      key: 'status',
      title: t('columnEnabled'),
      render: (section) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={section.enabled}
            onCheckedChange={(enabled) =>
              patchSection(section.id, (current) => ({ ...current, enabled }))
            }
            aria-label={section.enabled ? t('enabled') : t('disabled')}
          />
          <span className="text-xs text-muted-foreground">
            {section.enabled ? t('enabled') : t('disabled')}
          </span>
        </div>
      ),
    },
    {
      key: 'order',
      title: t('columnOrder'),
      render: (section) => {
        const index = sections.findIndex((item) => item.id === section.id);
        return (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              disabled={index <= 0}
              onClick={() => moveSection(section.id, -1)}
              aria-label={t('moveUp')}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <span className="w-6 text-center tabular-nums text-xs text-muted-foreground">
              {index + 1}
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              disabled={index < 0 || index >= sections.length - 1}
              onClick={() => moveSection(section.id, 1)}
              aria-label={t('moveDown')}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      },
    },
    {
      key: 'actions',
      title: '',
      isActions: true,
      render: (section) => (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={tCommon('actions.edit')}
          onClick={() => openEdit(section)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <SetPageTitle titleAr={t('title')} descriptionAr={t('description')} iconName="LayoutTemplate" />

      {dirty ? (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {tHome('unsavedHint')}
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

      <DataTable
        variant="directory"
        className="sto-table-host"
        columns={columns}
        data={sections}
        keyExtractor={(section) => section.id}
        loading={isLoading}
        emptyText={t('empty')}
      />

      <Dialog
        open={Boolean(form?.open)}
        onOpenChange={(open) => {
          if (!open) setForm(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('editSection')}</DialogTitle>
          </DialogHeader>

          {form ? (
            <div className="space-y-4 py-1">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t('columnType')}</p>
                <p className="text-sm font-medium text-foreground">{form.typeLabel}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="store-section-title">{t('titleLabel')}</Label>
                <Input
                  id="store-section-title"
                  value={form.titleAr}
                  placeholder={t('titlePlaceholder')}
                  onChange={(event) => setForm({ ...form, titleAr: event.target.value })}
                />
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setForm(null)}>
              {tCommon('actions.cancel')}
            </Button>
            <Button type="button" onClick={saveSectionForm}>
              {tCommon('actions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
