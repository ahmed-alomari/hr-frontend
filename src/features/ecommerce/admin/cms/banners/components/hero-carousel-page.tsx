'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  ImageOff,
  Loader2,
  Pencil,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import { getStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import { storefrontPublicHomeHref } from '@/features/ecommerce/storefront/lib/store-paths';
import type { PageRecord } from '@/features/ecommerce/storefront/page-builder/domain/page-records';
import type {
  HeroCarouselSectionRecord,
  HeroCarouselSlideRecord,
  SectionRecord,
} from '@/features/ecommerce/storefront/page-builder/domain/section-types';
import type { StorefrontHeroSlide } from '@/features/ecommerce/storefront/domain/storefront-models';
import { HeroCarousel } from '@/features/ecommerce/storefront/components/catalog/hero-carousel';
import { resolveStorefrontImageSrc } from '@/features/ecommerce/storefront/lib/resolve-storefront-image-src';
import { useHomepagePageRecord } from '@/features/ecommerce/admin/cms/homepage/hooks/use-homepage-page';
import { useHomepagePageMutations } from '@/features/ecommerce/admin/cms/homepage/hooks/use-homepage-mutations';
import { createSectionFromDefinition } from '@/features/ecommerce/admin/cms/homepage/lib/create-section';
import { ImagePicker } from '@/features/ecommerce/admin/cms/homepage/components/section-entity-pickers';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { usePageHeaderActions } from '@/components/layouts/page-header-actions-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  HeroCarouselLayout,
  HeroSlideFit,
  HeroSlidePosition,
} from '@/features/ecommerce/storefront/page-builder/domain/layout-types';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const DEFAULT_INTERVAL_MS = 5000;
const MIN_INTERVAL_MS = 1000;
const MAX_INTERVAL_MS = 30_000;
const DEFAULT_HEIGHT_RATIO = '21/7';

/** Width/height of the carousel frame on desktop. */
const HEIGHT_RATIOS = [
  { value: '4/1', labelKey: 'ratio4x1' },
  { value: '21/7', labelKey: 'ratio3x1' },
  { value: '5/2', labelKey: 'ratio5x2' },
  { value: '2/1', labelKey: 'ratio2x1' },
  { value: '16/9', labelKey: 'ratio16x9' },
] as const;

function ChoiceSelect<T extends string>({
  id,
  value,
  options,
  disabled,
  onChange,
}: {
  id?: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <Select value={value} disabled={disabled} onValueChange={(next) => onChange(next as T)}>
      <SelectTrigger
        id={id}
        className="h-auto min-h-11 whitespace-normal py-2 [&>span]:line-clamp-none [&>span]:whitespace-normal"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function clampIntervalMs(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_INTERVAL_MS;
  return Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, Math.round(value!)));
}

function isSlideEnabled(slide: HeroCarouselSlideRecord): boolean {
  return slide.enabled !== false;
}

function findOrCreateHero(page: PageRecord): { page: PageRecord; hero: HeroCarouselSectionRecord } {
  const existing = page.sections.find(
    (section): section is HeroCarouselSectionRecord => section.type === 'hero-carousel',
  );
  if (existing) return { page, hero: existing };
  const hero = createSectionFromDefinition('hero-carousel', page.sections) as HeroCarouselSectionRecord;
  return {
    page: {
      ...page,
      sections: [hero, ...page.sections],
    },
    hero,
  };
}

function createEmptySlide(): HeroCarouselSlideRecord {
  return {
    id: crypto.randomUUID(),
    imageUrl: '',
    enabled: true,
    title: { ar: '', en: '' },
  };
}

function normalizeSlide(slide: HeroCarouselSlideRecord): HeroCarouselSlideRecord {
  const titleAr = slide.title?.ar?.trim() ?? '';
  const mobileImageUrl = slide.mobileImageUrl?.trim();
  return {
    id: slide.id,
    imageUrl: slide.imageUrl,
    enabled: isSlideEnabled(slide),
    ...(mobileImageUrl ? { mobileImageUrl } : {}),
    ...(slide.fit ? { fit: slide.fit } : {}),
    ...(slide.position ? { position: slide.position } : {}),
    ...(slide.alt ? { alt: slide.alt } : {}),
    ...(slide.href ? { href: slide.href } : {}),
    title: titleAr ? { ar: titleAr, en: slide.title?.en?.trim() || titleAr } : undefined,
  };
}

function toPreviewSlides(slides: HeroCarouselSlideRecord[]): StorefrontHeroSlide[] {
  return slides
    .filter(isSlideEnabled)
    .map((slide) => {
      const title = slide.title?.ar?.trim() ?? '';
      const imageUrl = resolveStorefrontImageSrc(slide.imageUrl) ?? '';
      const mobileImageUrl = resolveStorefrontImageSrc(slide.mobileImageUrl);
      return {
        id: slide.id,
        imageUrl,
        mobileImageUrl,
        fit: slide.fit,
        position: slide.position,
        title,
        alt: title || 'Banner',
        href: slide.href ?? null,
      };
    })
    .filter((slide) => slide.imageUrl || slide.mobileImageUrl);
}

type SlideFormState = {
  open: boolean;
  index: number | null;
  draft: HeroCarouselSlideRecord;
};

export function HeroCarouselPage() {
  const companyId = getStorefrontCompanyId();
  const t = useTranslations('ecommerceAdmin.banners');
  const tHome = useTranslations('ecommerceAdmin.homepage');
  const tCommon = useTranslations('common');

  const { data, isLoading, isError, refetch } = useHomepagePageRecord(companyId);
  const { save } = useHomepagePageMutations(companyId);

  const [draft, setDraft] = React.useState<PageRecord | null>(null);
  const [heroDraft, setHeroDraft] = React.useState<HeroCarouselSectionRecord | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [form, setForm] = React.useState<SlideFormState | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const saveSeq = React.useRef(0);
  const [toDeleteIndex, setToDeleteIndex] = React.useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  React.useEffect(() => {
    if (!data) return;
    // Never clobber in-progress edits when a background query updates.
    if (dirty) return;
    loadFrom(data);
  }, [data, dirty]);

  function loadFrom(record: PageRecord) {
    const { page, hero } = findOrCreateHero(structuredClone(record));
    setDraft(page);
    setHeroDraft({
      ...hero,
      content: {
        ...hero.content,
        slides: hero.content.slides.map(normalizeSlide),
      },
    });
  }

  const slides = heroDraft?.content.slides ?? [];
  const previewSlides = toPreviewSlides(slides);

  usePageHeaderActions(
    () => (
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={!heroDraft || previewSlides.length === 0}
          onClick={() => setPreviewOpen(true)}
        >
          <Play className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('previewAutoplay')}</span>
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8" asChild>
          <Link href={storefrontPublicHomeHref()} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tHome('previewStorefront')}</span>
          </Link>
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8"
          disabled={!heroDraft}
          onClick={() =>
            setForm({
              open: true,
              index: null,
              draft: createEmptySlide(),
            })
          }
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('addSlide')}</span>
        </Button>
      </div>
    ),
    [heroDraft, previewSlides.length, t, tHome],
  );

  /** Every change goes to the store right away: there is no separate save. */
  function commitHero(next: HeroCarouselSectionRecord) {
    setHeroDraft(next);
    setDirty(true);
    void persistWithHero(next).catch(() => undefined);
  }

  function updateSlides(nextSlides: HeroCarouselSlideRecord[]) {
    if (!heroDraft) return;
    commitHero({ ...heroDraft, content: { ...heroDraft.content, slides: nextSlides } });
  }

  function updateStyle(patch: Partial<HeroCarouselSectionRecord['style']>) {
    if (!heroDraft) return;
    commitHero({ ...heroDraft, style: { ...heroDraft.style, ...patch } });
  }

  function setSlideEnabled(index: number, enabled: boolean) {
    const next = [...slides];
    const current = next[index];
    if (!current) return;
    next[index] = { ...current, enabled };
    updateSlides(next);
  }

  function moveSlide(index: number, direction: -1 | 1) {
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= slides.length) return;
    const next = [...slides];
    const current = next[index];
    const swap = next[swapIndex];
    if (!current || !swap) return;
    next[index] = swap;
    next[swapIndex] = current;
    updateSlides(next);
  }

  async function saveSlideForm() {
    if (!form || !heroDraft || !draft) return;
    const nextSlide = normalizeSlide(form.draft);
    if (!nextSlide.imageUrl.trim()) {
      setFormError(t('imageRequired'));
      return;
    }
    const nextSlides =
      form.index === null
        ? [...slides, nextSlide]
        : slides.map((slide, index) => (index === form.index ? nextSlide : slide));
    const nextHero: HeroCarouselSectionRecord = {
      ...heroDraft,
      content: { ...heroDraft.content, slides: nextSlides },
      updatedAt: new Date().toISOString(),
    };
    setHeroDraft(nextHero);
    setDirty(true);
    setFormError(null);
    try {
      await persistWithHero(nextHero);
      setForm(null);
    } catch (error) {
      const message = error instanceof Error && error.message.trim() ? error.message : t('saveSlideError');
      setFormError(message);
    }
  }

  async function persistWithHero(nextHeroInput: HeroCarouselSectionRecord) {
    if (!draft) return;
    const seq = ++saveSeq.current;
    const now = new Date().toISOString();
    const nextHero: SectionRecord = {
      ...nextHeroInput,
      enabled: true,
      content: {
        ...nextHeroInput.content,
        slides: nextHeroInput.content.slides.map(normalizeSlide),
      },
      settings: {
        autoplay: true,
        intervalMs: clampIntervalMs(nextHeroInput.settings.intervalMs),
      },
      updatedAt: now,
      revision: nextHeroInput.revision + 1,
      status: 'published',
      publishedAt: nextHeroInput.publishedAt ?? now,
    };
    const nextPage: PageRecord = {
      ...draft,
      status: 'published',
      updatedAt: now,
      publishedAt: draft.publishedAt ?? now,
      sections: draft.sections.some((section) => section.id === nextHero.id)
        ? draft.sections.map((section) => (section.id === nextHero.id ? nextHero : section))
        : [nextHero, ...draft.sections],
    };
    try {
      const saved = await save.mutateAsync(nextPage);
      if (seq !== saveSeq.current) return;
      loadFrom(saved);
    } catch (error) {
      if (seq !== saveSeq.current) return;
      if (data) loadFrom(data);
      throw error;
    } finally {
      if (seq === saveSeq.current) setDirty(false);
    }
  }

  const columns: ColumnDef<HeroCarouselSlideRecord>[] = [
    {
      key: 'image',
      title: t('columnImage'),
      render: (slide) =>
        slide.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolveStorefrontImageSrc(slide.imageUrl) ?? ''}
            alt=""
            className={`h-12 w-20 rounded-md border border-border object-cover ${
              isSlideEnabled(slide) ? '' : 'opacity-45'
            }`}
          />
        ) : (
          <div className="flex h-12 w-20 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
            <ImageOff className="h-4 w-4" />
          </div>
        ),
    },
    {
      key: 'description',
      title: t('columnDescription'),
      render: (slide) => (
        <span
          className={`line-clamp-2 text-sm font-medium ${
            isSlideEnabled(slide) ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
          {slide.title?.ar?.trim() || t('noDescription')}
        </span>
      ),
    },
    {
      key: 'status',
      title: t('columnStatus'),
      render: (slide) => {
        const index = slides.findIndex((item) => item.id === slide.id);
        const enabled = isSlideEnabled(slide);
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={enabled}
              disabled={save.isPending}
              onCheckedChange={(next) => setSlideEnabled(index, next)}
              aria-label={enabled ? tHome('enabled') : tHome('disabled')}
            />
            <span className="text-xs text-muted-foreground">
              {enabled ? tHome('enabled') : tHome('disabled')}
            </span>
          </div>
        );
      },
    },
    {
      key: 'order',
      title: t('columnOrder'),
      render: (slide) => {
        const index = slides.findIndex((item) => item.id === slide.id);
        return (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              disabled={index <= 0 || save.isPending}
              onClick={() => moveSlide(index, -1)}
              aria-label={tHome('moveUp')}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <span className="w-6 text-center tabular-nums text-xs text-muted-foreground">{index + 1}</span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              disabled={index < 0 || index >= slides.length - 1 || save.isPending}
              onClick={() => moveSlide(index, 1)}
              aria-label={tHome('moveDown')}
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
      render: (slide) => {
        const index = slides.findIndex((item) => item.id === slide.id);
        return (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={tCommon('actions.edit')}
              onClick={() =>
                setForm({
                  open: true,
                  index,
                  draft: structuredClone(slide),
                })
              }
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={tCommon('actions.delete')}
              onClick={() => setToDeleteIndex(index)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <SetPageTitle titleAr={t('title')} descriptionAr={t('description')} iconName="Image" />

      <p className="text-xs text-muted-foreground">
        {save.isPending ? tCommon('status.saving') : t('savedHint')}
      </p>

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

      {heroDraft ? (
        <Card>
          <CardContent className="grid gap-2 py-4 sm:max-w-md">
            <Label htmlFor="hero-interval-ms">{t('intervalMs')}</Label>
            <Input
              id="hero-interval-ms"
              dir="ltr"
              type="number"
              min={MIN_INTERVAL_MS}
              max={MAX_INTERVAL_MS}
              step={500}
              className="font-mono text-sm"
              value={heroDraft.settings.intervalMs || DEFAULT_INTERVAL_MS}
              placeholder={t('intervalMsPlaceholder')}
              onChange={(event) => {
                const raw = event.target.value;
                const parsed = raw === '' ? DEFAULT_INTERVAL_MS : Number(raw);
                if (!Number.isFinite(parsed)) return;
                setHeroDraft({
                  ...heroDraft,
                  settings: {
                    ...heroDraft.settings,
                    autoplay: true,
                    intervalMs: Math.round(parsed),
                  },
                });
                setDirty(true);
              }}
              onBlur={() => {
                const intervalMs = clampIntervalMs(heroDraft.settings.intervalMs);
                const savedMs = data?.sections.find((section) => section.id === heroDraft.id)
                  ?.settings as { intervalMs?: number } | undefined;
                if (savedMs?.intervalMs === intervalMs) {
                  setHeroDraft({ ...heroDraft, settings: { ...heroDraft.settings, intervalMs } });
                  setDirty(false);
                  return;
                }
                commitHero({
                  ...heroDraft,
                  settings: { ...heroDraft.settings, autoplay: true, intervalMs },
                });
              }}
            />
            <p className="text-[11px] text-muted-foreground">{t('intervalMsHint')}</p>
          </CardContent>
        </Card>
      ) : null}

      {heroDraft ? (
        <Card>
          <CardContent className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="hero-height-ratio">{t('heightRatio')}</Label>
              <ChoiceSelect
                id="hero-height-ratio"
                value={heroDraft.style.height || DEFAULT_HEIGHT_RATIO}
                disabled={save.isPending}
                options={[
                  ...HEIGHT_RATIOS.map((ratio) => ({ value: ratio.value as string, label: t(ratio.labelKey) })),
                  // A ratio set elsewhere stays selectable instead of showing blank.
                  ...(HEIGHT_RATIOS.some((ratio) => ratio.value === (heroDraft.style.height || DEFAULT_HEIGHT_RATIO))
                    ? []
                    : [{ value: heroDraft.style.height, label: heroDraft.style.height }]),
                ]}
                onChange={(height) => updateStyle({ height })}
              />
              <p className="text-[11px] text-muted-foreground">{t('heightRatioHint')}</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="hero-layout">{t('layoutLabel')}</Label>
              <ChoiceSelect<HeroCarouselLayout>
                id="hero-layout"
                value={heroDraft.style.layout}
                disabled={save.isPending}
                options={[
                  { value: 'contained', label: t('layoutContained') },
                  { value: 'full-bleed', label: t('layoutFullBleed') },
                ]}
                onChange={(layout) => updateStyle({ layout })}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <DataTable
        variant="directory"
        className="sto-table-host"
        columns={columns}
        data={slides}
        keyExtractor={(slide) => slide.id}
        loading={isLoading}
        emptyText={t('empty')}
      />

      <Dialog
        open={Boolean(form?.open)}
        onOpenChange={(open) => {
          if (!open && !save.isPending) {
            setForm(null);
            setFormError(null);
          }
        }}
      >
        <DialogContent
          className="max-w-lg gap-0 overflow-hidden p-0"
          onFocusOutside={(event) => event.preventDefault()}
        >
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>
              {form?.index === null ? t('addSlide') : t('editSlide')}
            </DialogTitle>
          </DialogHeader>

          {form ? (
            <div className="max-h-[min(70dvh,36rem)] space-y-4 overflow-y-auto px-6 py-4">
              <div className="space-y-1.5">
                <Label>{t('columnImage')}</Label>
                <ImagePicker
                  value={form.draft.imageUrl}
                  onChange={(imageUrl) => {
                    setFormError(null);
                    setForm({
                      ...form,
                      draft: { ...form.draft, imageUrl: imageUrl ?? '' },
                    });
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('mobileImage')}</Label>
                <ImagePicker
                  value={form.draft.mobileImageUrl}
                  onChange={(mobileImageUrl) =>
                    setForm({
                      ...form,
                      draft: { ...form.draft, mobileImageUrl: mobileImageUrl ?? undefined },
                    })
                  }
                />
                <p className="text-[11px] text-muted-foreground">{t('mobileImageHint')}</p>
              </div>
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="hero-slide-fit">{t('imageFit')}</Label>
                  <ChoiceSelect<HeroSlideFit>
                    id="hero-slide-fit"
                    value={form.draft.fit ?? 'cover'}
                    options={[
                      { value: 'cover', label: t('fitCover') },
                      { value: 'contain', label: t('fitContain') },
                    ]}
                    onChange={(fit) => setForm({ ...form, draft: { ...form.draft, fit } })}
                  />
                </div>
                {(form.draft.fit ?? 'cover') === 'cover' ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="hero-slide-position">{t('imagePosition')}</Label>
                    <ChoiceSelect<HeroSlidePosition>
                      id="hero-slide-position"
                      value={form.draft.position ?? 'center'}
                      options={[
                        { value: 'top', label: t('positionTop') },
                        { value: 'center', label: t('positionCenter') },
                        { value: 'bottom', label: t('positionBottom') },
                      ]}
                      onChange={(position) => setForm({ ...form, draft: { ...form.draft, position } })}
                    />
                  </div>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hero-slide-description">{t('columnDescription')}</Label>
                <Input
                  id="hero-slide-description"
                  value={form.draft.title?.ar ?? ''}
                  placeholder={t('descriptionPlaceholder')}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      draft: {
                        ...form.draft,
                        title: {
                          ar: event.target.value,
                          en: form.draft.title?.en || event.target.value,
                        },
                      },
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                <Label htmlFor="hero-slide-enabled" className="text-sm">
                  {isSlideEnabled(form.draft) ? tHome('enabled') : tHome('disabled')}
                </Label>
                <Switch
                  id="hero-slide-enabled"
                  checked={isSlideEnabled(form.draft)}
                  onCheckedChange={(enabled) =>
                    setForm({
                      ...form,
                      draft: { ...form.draft, enabled },
                    })
                  }
                />
              </div>
              {formError ? (
                <p role="alert" className="text-xs leading-relaxed text-destructive">
                  {formError}
                </p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="border-t border-border px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setForm(null)}>
              {tCommon('actions.cancel')}
            </Button>
            <Button
              type="button"
              disabled={!form?.draft.imageUrl.trim() || save.isPending}
              onClick={saveSlideForm}
            >
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {save.isPending ? tCommon('status.saving') : tCommon('actions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('previewTitle')}</DialogTitle>
          </DialogHeader>
          {previewSlides.length > 0 ? (
            <HeroCarousel
              slides={previewSlides}
              autoplay
              intervalMs={heroDraft?.settings.intervalMs || DEFAULT_INTERVAL_MS}
              layout="contained"
              heightRatio={heroDraft?.style.height || '21/7'}
            />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('previewEmpty')}</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={toDeleteIndex !== null}
        onOpenChange={(open) => {
          if (!open) setToDeleteIndex(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('removeSlideTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('removeSlideDescription')}</p>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setToDeleteIndex(null)}>
              {tCommon('actions.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={save.isPending}
              onClick={() => {
                if (toDeleteIndex === null || !heroDraft) return;
                const nextSlides = slides.filter((_, index) => index !== toDeleteIndex);
                const nextHero: HeroCarouselSectionRecord = {
                  ...heroDraft,
                  content: { ...heroDraft.content, slides: nextSlides },
                };
                setHeroDraft(nextHero);
                setToDeleteIndex(null);
                setDirty(true);
                void persistWithHero(nextHero).catch(() => undefined);
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
