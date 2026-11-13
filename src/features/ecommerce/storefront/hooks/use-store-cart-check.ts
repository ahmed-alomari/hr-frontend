'use client';

import { useQuery } from '@tanstack/react-query';
import {
  checkPublicStoreOrder,
  type StoreOrderCheckIssue,
} from '@/features/ecommerce/shared/lib/api/store-orders-api';
import { useStorefrontCartUi } from '@/features/ecommerce/storefront/hooks/use-storefront-cart-ui';
import { useStorefrontCompanyId } from '@/features/ecommerce/storefront/components/storefront-company-provider';

/**
 * The cart's lines checked by the server with the rules of placing the order
 * (approved 2026-10-09): a problem (option not chosen, product no longer
 * sold) shows on the line from the start, not at the last step.
 */
export function useStoreCartCheck() {
  const companyId = useStorefrontCompanyId();
  const lines = useStorefrontCartUi((state) => state.lines);
  const items = lines.map((line) => ({
    productId: line.productId,
    variantId: line.variantId ?? null,
    quantity: line.quantity,
  }));
  const query = useQuery({
    queryKey: ['storefront', 'cart-check', companyId, items],
    queryFn: () => checkPublicStoreOrder({ companyId, lines: items }),
    enabled: Boolean(companyId) && items.length > 0,
    staleTime: 15_000,
  });
  const issues = query.data?.issues ?? [];
  const lineIssues = issues.filter((issue) => issue.productId);
  const storeIssues = issues.filter((issue) => !issue.productId);
  return {
    issues,
    storeIssues,
    /** The problem on one cart line, if any — never a store-wide stock switch. */
    issueFor(productId: string, variantId?: string | null): StoreOrderCheckIssue | undefined {
      return lineIssues.find(
        (issue) =>
          issue.productId === productId &&
          (issue.variantId == null || issue.variantId === (variantId ?? null)),
      );
    },
    blocked: issues.length > 0,
    checking: query.isFetching,
  };
}
