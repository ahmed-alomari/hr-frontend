'use client';

import * as React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/shared/utils';

export type OrderableArticle = {
  id: string;
  code: string;
  title: string;
};

/** Moves one id a step up (-1) or down (+1); out-of-range moves change nothing. */
export function moveArticleId(ids: string[], index: number, delta: -1 | 1): string[] {
  const target = index + delta;
  if (index < 0 || index >= ids.length || target < 0 || target >= ids.length) {
    return ids;
  }
  const next = ids.slice();
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * Lays out ids in the given order, using the catalog for titles. Ids missing
 * from the catalog (archived since) are kept, labelled by the fallback.
 */
export function orderedArticles(
  ids: string[],
  catalog: OrderableArticle[],
  fallback?: (id: string) => OrderableArticle | undefined,
): OrderableArticle[] {
  const byId = new Map(catalog.map((a) => [a.id, a]));
  return ids.map(
    (id) => byId.get(id) ?? fallback?.(id) ?? { id, code: '', title: '—' },
  );
}

type Props = {
  /** Articles in print order. */
  items: OrderableArticle[];
  onChange?: (ids: string[]) => void;
  /** Hides the arrows (e.g. once the employee has signed). */
  readOnly?: boolean;
  className?: string;
  emptyText?: string;
};

/** The chosen articles in print order, each with up/down arrows. */
export function ArticleOrderList({
  items,
  onChange,
  readOnly = false,
  className,
  emptyText = 'لم تُختر مواد بعد',
}: Props) {
  const ids = items.map((a) => a.id);
  const canMove = !readOnly && !!onChange;

  if (items.length === 0) {
    return <p className="px-2 py-3 text-center text-xs text-muted-foreground">{emptyText}</p>;
  }

  return (
    <ol className={cn('space-y-1', className)}>
      {items.map((a, index) => (
        <li
          key={a.id}
          className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        >
          <span className="w-6 shrink-0 text-center font-mono text-xs text-muted-foreground" dir="ltr">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1 truncate">{a.title}</span>
          {a.code ? (
            <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline" dir="ltr">
              {a.code}
            </span>
          ) : null}
          {canMove ? (
            <span className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30"
                disabled={index === 0}
                onClick={() => onChange(moveArticleId(ids, index, -1))}
                aria-label={`نقل «${a.title}» للأعلى`}
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30"
                disabled={index === items.length - 1}
                onClick={() => onChange(moveArticleId(ids, index, 1))}
                aria-label={`نقل «${a.title}» للأسفل`}
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
