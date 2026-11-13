import { apiRequest, ApiError } from '@/features/hr/lib/api/client';
import type {
  AboutPageContent,
  ContactPageContent,
  FaqItem,
  LegalPageContent,
  LegalPageSlug,
  StorefrontContentBundle,
} from '@/features/ecommerce/storefront/domain/content';
import { resolveStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import type { ListGroupsResult } from '@/components/ui/list-group';
import {
  isStoreHttpEnabled,
  publicStoreRequest,
  unwrapStoreList,
} from '@/features/ecommerce/storefront/lib/api/store-http';

export { isStoreHttpEnabled };

type AboutDto = {
  companyId: string;
  headlineAr: string;
  headlineEn: string;
  introAr: string;
  introEn: string;
  sections: Array<{
    id?: string;
    titleAr: string;
    titleEn: string;
    bodyAr: string;
    bodyEn: string;
    sortOrder?: number;
  }>;
  stats: Array<{
    id?: string;
    labelAr: string;
    labelEn: string;
    value: string;
    sortOrder?: number;
  }>;
  updatedAt?: string;
};

type ContactDto = {
  companyId: string;
  headlineAr: string;
  headlineEn: string;
  introAr: string;
  introEn: string;
  hoursAr: string;
  hoursEn: string;
  mapEmbedUrl?: string | null;
  updatedAt?: string;
};

type FaqDto = {
  id: string;
  companyId: string;
  questionAr: string;
  questionEn: string;
  answerAr: string;
  answerEn: string;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

type LegalDto = {
  id: string;
  companyId: string;
  slug: LegalPageSlug;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  seoMetaTitleAr?: string | null;
  seoMetaTitleEn?: string | null;
  seoMetaDescriptionAr?: string | null;
  seoMetaDescriptionEn?: string | null;
  updatedAt: string;
};

function contentBase(companyId: string) {
  return `/store-admin/companies/${resolveStorefrontCompanyId(companyId)}`;
}

async function getOptionalAdmin<T>(path: string): Promise<T | null> {
  try {
    return await apiRequest<T>(path, { throwOnError: true });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) return null;
    throw error;
  }
}

function mapAboutDto(dto: AboutDto): AboutPageContent {
  return {
    headline: { ar: dto.headlineAr, en: dto.headlineEn },
    intro: { ar: dto.introAr, en: dto.introEn },
    sections: (dto.sections ?? []).map((section, index) => ({
      id: section.id ?? `about-sec-${index}`,
      title: { ar: section.titleAr, en: section.titleEn },
      body: { ar: section.bodyAr, en: section.bodyEn },
    })),
    stats: (dto.stats ?? []).map((stat, index) => ({
      id: stat.id ?? `about-stat-${index}`,
      label: { ar: stat.labelAr, en: stat.labelEn },
      value: stat.value,
    })),
  };
}

function mapContactDto(dto: ContactDto): ContactPageContent {
  return {
    headline: { ar: dto.headlineAr, en: dto.headlineEn },
    intro: { ar: dto.introAr, en: dto.introEn },
    hours: { ar: dto.hoursAr, en: dto.hoursEn },
    mapEmbedUrl: dto.mapEmbedUrl ?? undefined,
  };
}

function mapFaqDto(dto: FaqDto): FaqItem {
  return {
    id: dto.id,
    question: { ar: dto.questionAr, en: dto.questionEn },
    answer: { ar: dto.answerAr, en: dto.answerEn },
  };
}

function mapLegalDto(dto: LegalDto): LegalPageContent {
  return {
    slug: dto.slug,
    title: { ar: dto.titleAr, en: dto.titleEn },
    body: { ar: dto.bodyAr, en: dto.bodyEn },
    seo: {
      metaTitle:
        dto.seoMetaTitleAr || dto.seoMetaTitleEn
          ? { ar: dto.seoMetaTitleAr ?? '', en: dto.seoMetaTitleEn ?? '' }
          : undefined,
      metaDescription:
        dto.seoMetaDescriptionAr || dto.seoMetaDescriptionEn
          ? { ar: dto.seoMetaDescriptionAr ?? '', en: dto.seoMetaDescriptionEn ?? '' }
          : undefined,
    },
    updatedAt: dto.updatedAt,
  };
}

export async function fetchAdminContentBundle(
  companyId: string,
): Promise<StorefrontContentBundle | null> {
  if (!isStoreHttpEnabled()) return null;
  const id = resolveStorefrontCompanyId(companyId);
  const base = contentBase(id);

  const [about, contact, faqPage, privacy, terms, returns] = await Promise.all([
    getOptionalAdmin<AboutDto>(`${base}/content/about`),
    getOptionalAdmin<ContactDto>(`${base}/content/contact`),
    getOptionalAdmin<unknown>(`${base}/faq`),
    getOptionalAdmin<LegalDto>(`${base}/legal/privacy`),
    getOptionalAdmin<LegalDto>(`${base}/legal/terms`),
    getOptionalAdmin<LegalDto>(`${base}/legal/returns`),
  ]);

  const faq = unwrapStoreList<FaqDto>(faqPage).items;

  const legal = [privacy, terms, returns].filter(Boolean).map((item) => mapLegalDto(item!));

  // Always return a CMS-editable shell — missing DB rows are normal before first save.
  return {
    companyId: id,
    about: about
      ? mapAboutDto(about)
      : {
          headline: { ar: '', en: '' },
          intro: { ar: '', en: '' },
          sections: [],
          stats: [],
        },
    contact: contact
      ? mapContactDto(contact)
      : {
          headline: { ar: '', en: '' },
          intro: { ar: '', en: '' },
        },
    faq: faq.map(mapFaqDto),
    legal,
  };
}

export async function saveAdminAbout(companyId: string, about: AboutPageContent) {
  const id = resolveStorefrontCompanyId(companyId);
  const dto = await apiRequest<AboutDto>(`${contentBase(id)}/content/about`, {
    method: 'PUT',
    body: {
      headlineAr: about.headline.ar,
      headlineEn: about.headline.en,
      introAr: about.intro.ar,
      introEn: about.intro.en,
      sections: about.sections.map((section, index) => ({
        titleAr: section.title.ar,
        titleEn: section.title.en,
        bodyAr: section.body.ar,
        bodyEn: section.body.en,
        sortOrder: index,
      })),
      stats: (about.stats ?? []).map((stat, index) => ({
        labelAr: stat.label.ar,
        labelEn: stat.label.en,
        value: stat.value,
        sortOrder: index,
      })),
    },
  });
  return mapAboutDto(dto);
}

export async function saveAdminContact(companyId: string, contact: ContactPageContent) {
  const id = resolveStorefrontCompanyId(companyId);
  const dto = await apiRequest<ContactDto>(`${contentBase(id)}/content/contact`, {
    method: 'PUT',
    body: {
      headlineAr: contact.headline.ar,
      headlineEn: contact.headline.en,
      introAr: contact.intro.ar,
      introEn: contact.intro.en,
      hoursAr: contact.hours?.ar ?? '',
      hoursEn: contact.hours?.en ?? '',
      mapEmbedUrl: contact.mapEmbedUrl ?? null,
    },
  });
  return mapContactDto(dto);
}

export async function saveAdminFaq(companyId: string, faq: FaqItem[]) {
  const id = resolveStorefrontCompanyId(companyId);
  const base = `${contentBase(id)}/faq`;
  const existingPage = await getOptionalAdmin<unknown>(base);
  const existing = unwrapStoreList<FaqDto>(existingPage).items;

  for (const item of existing) {
    if (!faq.some((local) => local.id === item.id)) {
      await apiRequest(`${base}/${item.id}`, { method: 'DELETE', throwOnError: true });
    }
  }

  const saved: FaqItem[] = [];
  for (const [index, item] of faq.entries()) {
    const body = {
      questionAr: item.question.ar,
      questionEn: item.question.en,
      answerAr: item.answer.ar,
      answerEn: item.answer.en,
      sortOrder: index,
      isPublished: true,
    };
    const known = existing.find((row) => row.id === item.id);
    if (known) {
      const dto = await apiRequest<FaqDto>(`${base}/${item.id}`, {
        method: 'PATCH',
        throwOnError: true,
        body,
      });
      saved.push(mapFaqDto(dto));
    } else {
      const dto = await apiRequest<FaqDto>(base, { method: 'POST', throwOnError: true, body });
      saved.push(mapFaqDto(dto));
    }
  }
  return saved;
}

export async function saveAdminLegalPage(companyId: string, page: LegalPageContent) {
  const id = resolveStorefrontCompanyId(companyId);
  const dto = await apiRequest<LegalDto>(`${contentBase(id)}/legal/${page.slug}`, {
    method: 'PUT',
    body: {
      titleAr: page.title.ar,
      titleEn: page.title.en,
      bodyAr: page.body.ar,
      bodyEn: page.body.en,
      seoMetaTitleAr: page.seo.metaTitle?.ar ?? null,
      seoMetaTitleEn: page.seo.metaTitle?.en ?? null,
      seoMetaDescriptionAr: page.seo.metaDescription?.ar ?? null,
      seoMetaDescriptionEn: page.seo.metaDescription?.en ?? null,
    },
  });
  return mapLegalDto(dto);
}

export async function fetchPublicAbout(companyId: string) {
  return publicStoreRequest<AboutDto>('/public/store/content/about', {
    query: { companyId: resolveStorefrontCompanyId(companyId) },
    nullOn404: true,
  }).then((dto) => (dto ? mapAboutDto(dto) : null));
}

export async function fetchPublicContact(companyId: string) {
  return publicStoreRequest<ContactDto>('/public/store/content/contact', {
    query: { companyId: resolveStorefrontCompanyId(companyId) },
    nullOn404: true,
  }).then((dto) => (dto ? mapContactDto(dto) : null));
}

export async function fetchPublicFaq(companyId: string) {
  const page = await publicStoreRequest<unknown>('/public/store/content/faq', {
    query: { companyId: resolveStorefrontCompanyId(companyId), page: 1, limit: 200 },
    nullOn404: true,
  });
  return unwrapStoreList<FaqDto>(page).items.map(mapFaqDto);
}

export async function fetchPublicLegal(companyId: string, slug: LegalPageSlug) {
  return publicStoreRequest<LegalDto>(`/public/store/content/legal/${slug}`, {
    query: { companyId: resolveStorefrontCompanyId(companyId) },
    nullOn404: true,
  }).then((dto) => (dto ? mapLegalDto(dto) : null));
}

export type StoreContactMessageType = 'complaint' | 'suggestion';

export async function submitPublicContactMessage(input: {
  companyId: string;
  name: string;
  email?: string;
  phone?: string;
  message: string;
  type: StoreContactMessageType;
  /** Server actions: the customer's X-Forwarded-For (API rate limits). */
  clientHeaders?: Record<string, string>;
}) {
  return publicStoreRequest('/public/store/contact-messages', {
    method: 'POST',
    headers: input.clientHeaders,
    body: {
      companyId: resolveStorefrontCompanyId(input.companyId),
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      message: input.message,
      type: input.type,
    },
  });
}

export type StoreContactMessageDto = {
  id: string;
  companyId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  message: string;
  type: StoreContactMessageType;
  createdAt: string;
  /** With `groupBy`: the message's group key. */
  groupKey?: string | null;
};

export type AdminContactMessagesQuery = {
  page?: number;
  limit?: number;
  type?: StoreContactMessageType;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  /** Server sort key: createdAt, name, type. */
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  /** Server group field: type, day, week, month; with `groupValue`, one group. */
  groupBy?: string;
  groupValue?: string;
};

function contactMessageFilterQuery(query?: AdminContactMessagesQuery) {
  return {
    type: query?.type,
    search: query?.search || undefined,
    dateFrom: query?.dateFrom || undefined,
    dateTo: query?.dateTo || undefined,
    groupBy: query?.groupBy,
  };
}

/** Admin inbox — `GET /store-admin/companies/:companyId/contact-messages` */
export async function fetchAdminContactMessages(
  companyId: string,
  query?: AdminContactMessagesQuery,
) {
  const id = resolveStorefrontCompanyId(companyId);
  return apiRequest<{
    items: StoreContactMessageDto[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>(`/store-admin/companies/${id}/contact-messages`, {
    throwOnError: true,
    query: {
      ...contactMessageFilterQuery(query),
      page: query?.page ?? 1,
      limit: query?.limit ?? 50,
      sortBy: query?.sortBy,
      sortDir: query?.sortDir,
      groupValue: query?.groupValue,
    },
  });
}

/** Message counts per group (type, day…) and overall. */
export async function fetchAdminContactMessageGroups(
  companyId: string,
  query?: AdminContactMessagesQuery,
): Promise<ListGroupsResult> {
  const id = resolveStorefrontCompanyId(companyId);
  return apiRequest<ListGroupsResult>(`/store-admin/companies/${id}/contact-messages/groups`, {
    throwOnError: true,
    query: contactMessageFilterQuery(query),
  });
}
