import type { ApiErrorEnvelope } from '@/shared/api/types';

type NamedApp = { code: string; nameAr: string };

const quoted = (apps: NamedApp[]) => apps.map((a) => `«${a.nameAr || a.code}»`);

function readApps(value: unknown): NamedApp[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === 'object')
    .map((v) => ({ code: String(v.code ?? ''), nameAr: String(v.nameAr ?? v.code ?? '') }));
}

function readApp(value: unknown): NamedApp | null {
  return readApps([value])[0] ?? null;
}

/**
 * App dependency refusals in Arabic, with the apps' names (the backend sends
 * them in the error: `app`, `enableFirst` / `disableFirst`). Used by the API
 * client's toast and by handleApiError. Null for anything else.
 */
export function translateAppDependencyError(envelope: ApiErrorEnvelope | null | undefined): string | null {
  const error = envelope?.error;
  if (!error || typeof error !== 'object') return null;
  const e = error as Record<string, unknown>;
  const app = readApp(e.app);
  const name = app ? `«${app.nameAr || app.code}»` : 'هذا التطبيق';

  if (e.code === 'APP_DEPENDENCIES_MISSING') {
    const first = readApps(e.enableFirst);
    const fallback = Array.isArray(e.missing) ? e.missing.map((c) => ({ code: String(c), nameAr: String(c) })) : [];
    const list = quoted(first.length > 0 ? first : fallback);
    const order = list.length > 1 ? ` بهذا الترتيب: ${list.join(' ثم ')}` : `: ${list[0] ?? ''}`;
    return `لا يمكن تفعيل ${name} قبل تفعيل ما يعتمد عليه${order}. فعّلها أولاً، أو استخدم «تفعيل مع المتطلبات».`;
  }
  if (e.code === 'APP_HAS_ENABLED_DEPENDENTS') {
    const list = quoted(readApps(e.disableFirst));
    return `لا يمكن تعطيل ${name}: ${list.length > 1 ? 'هذه التطبيقات المفعّلة تعتمد عليه' : 'هذا التطبيق المفعّل يعتمد عليه'}: ${list.join('، ')}. عطّلها أولاً.`;
  }
  if (e.code === 'APP_BRIDGE_FOLLOWS_APPS') {
    const list = quoted(readApps(e.follows));
    return `${name} ربط تلقائي لا يُعطَّل وحده: يتوقف بتعطيل ${list.join(' أو ')}.`;
  }
  return null;
}
