'use client';

import { FoldedHeaderTool } from '@/components/layouts/phone-fold';
import * as React from 'react';
import { Bookmark, BookmarkCheck, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { notifyPersistedStateRestored } from '@/shared/hooks/use-persisted-state-restore';
import { cn } from '@/shared/utils';

/** A named copy of a list's filters, period, sort, grouping and columns. */
type SavedView = { id: string; name: string; values: Record<string, string> };

/**
 * The storage keys of a list's state, by section / page / company — the
 * filters (`hr-filters:…`), the sort order (`hr-sort:…`) and the grouping
 * (`hr-group:…`).
 */
export function listStateKeys(section: string, page: string, companyId: string | null | undefined) {
  const id = companyId ? `${section}:${page}:${companyId}` : null;
  return {
    sort: id ? `hr-sort:${id}` : null,
    group: id ? `hr-group:${id}` : null,
    views: id ? `hr-saved-views:${id}` : null,
    /** Every key a saved view copies (prefix match). */
    prefixes: id ? [`hr-filters:${id}:`, `hr-sort:${id}`, `hr-group:${id}`] : [],
  };
}

function readViews(key: string | null): SavedView[] {
  if (!key || typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter(
          (v): v is SavedView =>
            !!v && typeof v === 'object' && typeof (v as SavedView).id === 'string'
            && typeof (v as SavedView).name === 'string' && typeof (v as SavedView).values === 'object',
        )
      : [];
  } catch {
    return [];
  }
}

function writeViews(key: string | null, views: SavedView[]): void {
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(views));
  } catch {
    toast.error('تعذر حفظ العرض في هذا المتصفح');
  }
}

function snapshot(prefixes: readonly string[]): Record<string, string> {
  const values: Record<string, string> = {};
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && prefixes.some((p) => k.startsWith(p))) values[k] = window.localStorage.getItem(k) ?? '';
    }
  } catch {
    // blocked storage: nothing to copy
  }
  return values;
}

function restore(prefixes: readonly string[], values: Record<string, string>): void {
  try {
    const current = Object.keys(snapshot(prefixes));
    current.forEach((k) => {
      if (!(k in values)) window.localStorage.removeItem(k);
    });
    Object.entries(values).forEach(([k, v]) => window.localStorage.setItem(k, v));
  } catch {
    // blocked storage
  }
  notifyPersistedStateRestored();
}

/**
 * «العروض المحفوظة»: saves the list's current filters, period, sort order,
 * grouping and visible columns under a name, and brings them back in one
 * tap. Views are kept in this browser, per user, company and screen.
 */
export function ListSavedViews({
  storageKey,
  prefixes,
}: {
  storageKey: string | null;
  prefixes: readonly string[];
}) {
  const [open, setOpen] = React.useState(false);
  const [views, setViews] = React.useState<SavedView[]>(() => readViews(storageKey));
  const [name, setName] = React.useState('');
  const [activeId, setActiveId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setViews(readViews(storageKey));
    setActiveId(null);
  }, [storageKey]);

  if (!storageKey) return null;

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const values = snapshot(prefixes);
    const existing = views.find((v) => v.name === trimmed);
    const view: SavedView = { id: existing?.id ?? `${Date.now()}`, name: trimmed, values };
    const next = existing ? views.map((v) => (v.id === existing.id ? view : v)) : [...views, view];
    setViews(next);
    writeViews(storageKey, next);
    setActiveId(view.id);
    setName('');
    toast.success(existing ? `تم تحديث العرض «${trimmed}»` : `تم حفظ العرض «${trimmed}»`);
  };

  const apply = (view: SavedView) => {
    restore(prefixes, view.values);
    setActiveId(view.id);
    setOpen(false);
  };

  const remove = (view: SavedView) => {
    const next = views.filter((v) => v.id !== view.id);
    setViews(next);
    writeViews(storageKey, next);
    if (activeId === view.id) setActiveId(null);
  };

  const active = views.find((v) => v.id === activeId);

  return (
    <FoldedHeaderTool>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn('h-8 w-8 shrink-0', active && 'border-primary/40 text-primary')}
            aria-label={active ? `العرض: ${active.name}` : 'العروض المحفوظة'}
            title={active ? `العرض: ${active.name}` : 'العروض المحفوظة'}
          >
            {active ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-0" dir="rtl">
          <div className="border-b border-border/60 px-3 py-2.5">
            <p className="text-sm font-semibold">العروض المحفوظة</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              الفلاتر والفترة والترتيب والتجميع والأعمدة، تُحفظ في هذا المتصفح
            </p>
          </div>
          <div className="max-h-64 space-y-0.5 overflow-y-auto p-2">
            {views.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">لا توجد عروض محفوظة بعد</p>
            ) : (
              views.map((view) => (
                <div
                  key={view.id}
                  className={cn(
                    'flex items-center justify-between gap-1 rounded-md px-1 transition-colors hover:bg-muted/50',
                    view.id === activeId && 'bg-primary/5',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => apply(view)}
                    className={cn(
                      'min-w-0 flex-1 truncate px-1.5 py-1.5 text-start text-sm',
                      view.id === activeId && 'font-semibold text-primary',
                    )}
                  >
                    {view.name}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`حذف العرض ${view.name}`}
                    onClick={() => remove(view)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
          <form
            className="flex items-center gap-1.5 border-t border-border/60 p-2"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم العرض الحالي"
              className="h-8 text-sm"
              maxLength={60}
            />
            <Button type="submit" size="sm" className="h-8 shrink-0 gap-1" disabled={!name.trim()}>
              <Plus className="h-3.5 w-3.5" />
              حفظ
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </FoldedHeaderTool>
  );
}
