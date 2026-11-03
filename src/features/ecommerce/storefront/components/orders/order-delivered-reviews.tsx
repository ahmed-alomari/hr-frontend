'use client';

import * as React from 'react';
import Image from 'next/image';
import { Loader2, Package, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { createStoreProductReview } from '@/features/ecommerce/shared/lib/api/store-reviews-api';
import { StoreHttpError } from '@/features/ecommerce/storefront/lib/api/store-http';
import type { StorefrontCustomerOrder } from '@/features/ecommerce/storefront/domain/checkout';
import { useStorefrontCustomerUi } from '@/features/ecommerce/storefront/hooks/use-storefront-customer-ui';
import { getPublicStorefrontCompanyId } from '@/features/ecommerce/storefront/lib/storefront-company';
import { Link } from '@/i18n/navigation';
import { cn } from '@/shared/utils';
import { customerErrorText } from '@/features/ecommerce/storefront/lib/customer-error';

type ReviewableLine = {
  productId: string;
  productName: string;
  productSlug: string;
  imageUrl?: string | null;
};

function uniqueDeliveredProducts(order: StorefrontCustomerOrder): ReviewableLine[] {
  const seen = new Set<string>();
  const items: ReviewableLine[] = [];
  for (const line of order.lines) {
    if (seen.has(line.productId)) continue;
    seen.add(line.productId);
    items.push({
      productId: line.productId,
      productName: line.productName,
      productSlug: line.productSlug,
      imageUrl: line.imageUrl,
    });
  }
  return items;
}

function StarsPicker({
  rating,
  onSelect,
}: {
  rating: number;
  onSelect: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, index) => {
        const value = index + 1;
        const filled = rating >= value;
        return (
          <button
            key={value}
            type="button"
            className="rounded p-0.5"
            aria-label={`${value}`}
            onClick={() => onSelect(value)}
          >
            <Star
              className={cn(
                'h-5 w-5 transition-transform hover:scale-110',
                filled ? 'fill-secondary text-secondary' : 'text-muted-foreground/35',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

function LineReviewCard({
  line,
  companyId,
  defaultName,
  partnerId,
  accessToken,
}: {
  line: ReviewableLine;
  companyId: string;
  defaultName: string;
  partnerId: string | null;
  accessToken: string | null;
}) {
  const t = useTranslations('storefront');
  const [rating, setRating] = React.useState(5);
  const [comment, setComment] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (rating < 1 || rating > 5) {
      toast.error(t('reviews.ratingRequired'));
      return;
    }
    setSubmitting(true);
    try {
      await createStoreProductReview({
        companyId,
        productId: line.productId,
        rating,
        body: comment,
        guestName: defaultName || undefined,
        partnerId,
        accessToken,
      });
      setDone(true);
      toast.success(t('reviews.submitSuccess'));
    } catch (error) {
      toast.error(customerErrorText(error, t('reviews.submitError')));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <li className="rounded-2xl border border-border/70 bg-muted/15 p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-background">
          {line.imageUrl ? (
            <Image
              src={line.imageUrl}
              alt=""
              fill
              unoptimized
              className="object-contain p-1.5"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Package className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <Link
            href={`/store/products/${line.productSlug}`}
            prefetch={false}
            className="line-clamp-2 text-sm font-medium text-foreground hover:text-primary"
          >
            {line.productName}
          </Link>

          {done ? (
            <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
              {t('orders.reviewSubmitted')}
            </p>
          ) : (
            <form onSubmit={(event) => void handleSubmit(event)} className="mt-3 space-y-2.5">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {t('reviews.yourRating')}
                </p>
                <StarsPicker rating={rating} onSelect={setRating} />
              </div>
              <Textarea
                rows={2}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder={t('reviews.commentPlaceholder')}
                className="min-h-[4rem] rounded-xl text-sm"
                maxLength={2000}
              />
              <Button type="submit" size="sm" className="rounded-xl" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    {t('reviews.submitting')}
                  </>
                ) : (
                  t('orders.submitProductReview')
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </li>
  );
}

/** Review products from a delivered order. */
export function OrderDeliveredReviews({ order }: { order: StorefrontCustomerOrder }) {
  const t = useTranslations('storefront');
  const customer = useStorefrontCustomerUi((s) => s.customer);
  const accessToken = useStorefrontCustomerUi((s) => s.accessToken);

  if (order.status !== 'delivered') return null;

  const products = uniqueDeliveredProducts(order);
  if (products.length === 0) return null;

  const companyId = order.companyId || getPublicStorefrontCompanyId();

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <Star className="h-4 w-4 fill-secondary text-secondary" />
        <h2 className="font-arabic-display text-base font-semibold">
          {t('orders.rateDeliveredTitle')}
        </h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t('orders.rateDeliveredHint')}</p>
      <ul className="space-y-3">
        {products.map((line) => (
          <LineReviewCard
            key={line.productId}
            line={line}
            companyId={companyId}
            defaultName={customer?.name?.trim() || order.address.fullName || ''}
            partnerId={customer?.partnerId ?? null}
            accessToken={accessToken}
          />
        ))}
      </ul>
    </section>
  );
}
