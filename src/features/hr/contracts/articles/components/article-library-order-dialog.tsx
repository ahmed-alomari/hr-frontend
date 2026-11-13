'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogFormFooterClass,
} from '@/components/ui/dialog';
import {
  ArticleOrderList,
  orderedArticles,
  type OrderableArticle,
} from '@/components/contracts/article-order-list';
import { contractArticlesApi } from '@/features/hr/contracts/lib/contracts-api';
import { contractArticleKeys } from '@/features/hr/contracts/lib/hooks/use-contract-articles';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  onSaved: () => void;
};

/**
 * The library's default order (ترتيب المواد): new templates and contracts
 * start from it. Saved templates and contracts keep the order they have.
 */
export function ArticleLibraryOrderDialog({ open, onOpenChange, companyId, onSaved }: Props) {
  const queryClient = useQueryClient();
  const [catalog, setCatalog] = React.useState<OrderableArticle[]>([]);
  const [ids, setIds] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open || !companyId) return;
    let cancelled = false;
    setLoading(true);
    void contractArticlesApi
      .list({ companyId, limit: 200, archiveScope: 'active' })
      .then((res) => {
        if (cancelled) return;
        // The server already returns them by sortOrder, then code.
        const rows = res.items.map((a) => ({ id: a.id, code: a.code, title: a.titleAr }));
        setCatalog(rows);
        setIds(rows.map((r) => r.id));
      })
      .catch((err) => {
        if (!cancelled) handleApiError(err, 'contract-articles.order.load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, companyId]);

  const handleSave = async () => {
    if (ids.length === 0) return;
    setSaving(true);
    try {
      await contractArticlesApi.reorder({ companyId, articleIds: ids });
      await queryClient.invalidateQueries({ queryKey: contractArticleKeys.all });
      toast.success('تم حفظ ترتيب المواد');
      onSaved();
      onOpenChange(false);
    } catch (err) {
      handleApiError(err, 'contract-articles.order.save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-border" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-display text-base">ترتيب المواد</DialogTitle>
          <DialogDescription className="text-xs">
            الترتيب الافتراضي للقوالب والعقود الجديدة. القوالب والعقود المحفوظة لا تتغير.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ArticleOrderList
            items={orderedArticles(ids, catalog)}
            onChange={setIds}
            emptyText="لا توجد مواد نشطة"
          />
        )}

        <DialogFooter className={dialogFormFooterClass}>
          <Button
            variant="luxe"
            onClick={handleSave}
            disabled={saving || loading || ids.length === 0}
            className="gap-2"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            حفظ الترتيب
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
