'use client';

import { useQuery } from '@tanstack/react-query';
import { SetPageTitle } from '@/components/layouts/set-page-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { systemOwnerQueryKeys } from '@/features/system-owner/hooks/query-keys';
import {
  rateLimitsApi,
  type RateLimitRuleView,
} from '@/features/system-owner/lib/api/rate-limits';

function windowAr(seconds: number): string {
  if (seconds % 3600 === 0) {
    const h = seconds / 3600;
    return h === 1 ? 'ساعة' : h === 2 ? 'ساعتين' : `${h} ساعات`;
  }
  const m = Math.round(seconds / 60);
  if (m === 1) return 'دقيقة';
  if (m === 2) return 'دقيقتين';
  return m <= 10 ? `${m} دقائق` : `${m} دقيقة`;
}

/** Arabic count of requests: طلب، طلبان، 3–10 طلبات، 11–99 طلباً، 100+ طلب. */
function requestsAr(n: number): string {
  if (n === 1) return 'طلب واحد';
  if (n === 2) return 'طلبان';
  if (n <= 10) return `${n} طلبات`;
  if (n % 100 >= 11 && n % 100 <= 99) return `${n} طلباً`;
  return `${n} طلب`;
}

function ruleAr(rule: RateLimitRuleView): string {
  const who = rule.per === 'account' ? 'لكل عنوان وحساب' : 'لكل عنوان';
  return `حتى ${requestsAr(rule.limit)} كل ${windowAr(rule.windowSeconds)} ${who}`;
}

/**
 * Read-only: the request limits in force on the platform, for whoever looks
 * for them. They change in the server code or `.env`, never from here.
 */
export function SystemOwnerSecurityPage() {
  const query = useQuery({
    queryKey: systemOwnerQueryKeys.rateLimits(),
    queryFn: () => rateLimitsApi.view(),
  });
  const view = query.data;

  return (
    <div className="flex flex-col gap-4">
      <SetPageTitle
        titleAr="حماية المنصة"
        descriptionAr="حدود عدد الطلبات المطبّقة على كل الشركات (للقراءة فقط)"
        iconName="ShieldCheck"
      />

      <section className="rounded-xl border border-border bg-card p-4 text-sm leading-7">
        <h2 className="mb-2 text-base font-semibold">كيف تعمل</h2>
        <ul className="list-disc space-y-1 ps-5 text-muted-foreground">
          <li>
            يعدّ الخادم الطلبات القادمة من كل عنوان إنترنت (IP). إذا تجاوز العنوان الحد،
            يُرفض الطلب برسالة «محاولات كثيرة. حاول مرة أخرى بعد …» حتى تنتهي المدة.
          </li>
          <li>
            حدود الدخول والبريد تُحسب لكل عنوان وحساب معاً: موظفو مكتب واحد خلف عنوان
            واحد يدخلون دون أن يُحظر أحدهم، وتخمين كلمة مرور حساب واحد يتوقف.
          </li>
          <li>الحدود واحدة لكل الشركات، وتعمل في الخادم قبل أي فحص آخر.</li>
          <li>
            لا تُعدَّل من هنا. تغييرها يكون في كود الخادم (
            <code dir="ltr">rate-limit.policies.ts</code>) ثم النشر، أو من ملف{' '}
            <code dir="ltr">.env</code> على السيرفر: <code dir="ltr">RATE_LIMIT_DISABLED=true</code>{' '}
            للإيقاف الطارئ، و<code dir="ltr">RATE_LIMIT_DEFAULT_PER_MINUTE</code> للحد العام،
            ثم إعادة تشغيل الخادم.
          </li>
        </ul>
      </section>

      {query.isLoading ? <p className="text-sm text-muted-foreground">جاري التحميل…</p> : null}
      {query.isError ? (
        <div className="flex items-center gap-3 text-sm text-destructive">
          <span>تعذر تحميل الحدود.</span>
          <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
            إعادة المحاولة
          </Button>
        </div>
      ) : null}

      {view ? (
        <>
          <section className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm">
            <span className="font-medium">الحالة:</span>
            {view.enabled ? (
              <Badge>مفعّلة</Badge>
            ) : (
              <Badge variant="destructive">موقوفة من ملف .env على السيرفر</Badge>
            )}
            <span className="text-muted-foreground">
              الحد العام لكل طلب من الخارج: حتى {requestsAr(view.defaultPerMinute)} في الدقيقة لكل
              عنوان
            </span>
          </section>

          <div className="grid gap-3 md:grid-cols-2">
            {view.policies.map((policy) => (
              <article key={policy.key} className="rounded-xl border border-border bg-card p-4">
                <h3 className="font-medium">{policy.labelAr}</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {policy.rules.map((rule) => (
                    <li key={`${rule.per}-${rule.windowSeconds}`}>{ruleAr(rule)}</li>
                  ))}
                </ul>
                <details className="mt-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">النقاط المشمولة</summary>
                  <ul className="mt-1 space-y-0.5" dir="ltr">
                    {policy.routes.map((route) => (
                      <li key={route}>
                        <code>{route}</code>
                      </li>
                    ))}
                  </ul>
                </details>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
