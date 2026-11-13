'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  dialogFormFooterClass,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import { contractTemplatesApi } from '@/features/hr/contracts/contract-templates/lib/api/contract-templates';
import type {
  ContractNature,
  ContractTemplateDto,
  WorkArrangement,
} from '@/features/hr/contracts/contract-templates/types/contract-template';
import {
  TEMPLATE_CONTRACT_NATURE_LABELS,
  TEMPLATE_WORK_ARRANGEMENT_LABELS,
} from '@/features/hr/contracts/contract-templates/constants/contract-template-options';
import { allowanceTypesApi, type AllowanceTypeDto } from '@/features/hr/contracts/lib/api/allowance-types';
import { useContractArticles } from '@/features/hr/contracts/lib/hooks/use-contract-articles';
import { payrollListArchiveQuery } from '@/features/hr/organization/lib/archive-scope';
import { ArticleOrderList, orderedArticles } from '@/components/contracts/article-order-list';
import {
  ContractTemplateAllowanceLinesEditor,
  type AllowanceLineDraft,
} from '@/features/hr/contracts/contract-templates/dialogs/contract-template-allowance-lines-editor';

type DraftForm = {
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  defaultContractNature: ContractNature;
  defaultWorkArrangement: WorkArrangement;
  defaultProbationDays: string;
  defaultAnnualLeaveDays: string;
  suggestedBaseSalary: string;
  currency: string;
  durationMonths: string;
  allowancesHint: string;
  sortOrder: string;
  isActive: boolean;
  allowanceLines: AllowanceLineDraft[];
  articleIds: string[];
};

const EMPTY_FORM: DraftForm = {
  nameAr: '',
  nameEn: '',
  descriptionAr: '',
  descriptionEn: '',
  defaultContractNature: 'indefinite',
  defaultWorkArrangement: 'full_time',
  defaultProbationDays: '90',
  defaultAnnualLeaveDays: '21',
  suggestedBaseSalary: '',
  currency: 'SAR',
  durationMonths: '',
  allowancesHint: '',
  sortOrder: '0',
  isActive: true,
  allowanceLines: [],
  articleIds: [],
};

const VALID_NATURES: ContractNature[] = ['indefinite', 'fixed_term', 'project_based'];
const VALID_ARRANGEMENTS: WorkArrangement[] = ['full_time', 'part_time', 'remote', 'hybrid'];

function normalizeNature(value: string): ContractNature {
  return VALID_NATURES.includes(value as ContractNature) ? (value as ContractNature) : 'indefinite';
}

function normalizeArrangement(value: string): WorkArrangement {
  return VALID_ARRANGEMENTS.includes(value as WorkArrangement) ? (value as WorkArrangement) : 'full_time';
}

function formFromDto(dto: ContractTemplateDto): DraftForm {
  return {
    nameAr: dto.nameAr,
    nameEn: dto.nameEn ?? '',
    descriptionAr: dto.descriptionAr ?? '',
    descriptionEn: dto.descriptionEn ?? '',
    defaultContractNature: normalizeNature(dto.defaultContractNature),
    defaultWorkArrangement: normalizeArrangement(dto.defaultWorkArrangement),
    defaultProbationDays: dto.defaultProbationDays != null ? String(dto.defaultProbationDays) : '',
    defaultAnnualLeaveDays: dto.defaultAnnualLeaveDays != null ? String(dto.defaultAnnualLeaveDays) : '',
    suggestedBaseSalary: dto.suggestedBaseSalary ? String(parseFloat(dto.suggestedBaseSalary)) : '',
    currency: dto.currency || 'SAR',
    durationMonths: dto.durationMonths != null ? String(dto.durationMonths) : '',
    allowancesHint: dto.allowancesHint ?? '',
    sortOrder: String(dto.sortOrder),
    isActive: dto.isActive,
    allowanceLines: (dto.allowanceLines ?? []).map((l) => ({
      allowanceTypeId: l.allowanceTypeId,
      amount: String(parseFloat(l.amount) || 0),
      sortOrder: l.sortOrder,
    })),
    articleIds: (dto.articles ?? []).map((a) => a.articleId),
  };
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editItem: ContractTemplateDto | null;
  companyId: string;
  onSaved: () => void;
};

export function ContractTemplateFormDialog({ open, onOpenChange, editItem, companyId, onSaved }: Props) {
  const { data: catalogArticles = [] } = useContractArticles();
  const [form, setForm] = React.useState<DraftForm>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [allowanceTypes, setAllowanceTypes] = React.useState<AllowanceTypeDto[]>([]);

  const articles = React.useMemo(
    () => catalogArticles.filter((a) => a.isActive).map((a) => ({
      id: a.id,
      code: a.code,
      titleAr: a.title,
    })),
    [catalogArticles],
  );

  React.useEffect(() => {
    if (!open || !companyId) return;
    setForm(editItem ? formFromDto(editItem) : EMPTY_FORM);
    setError(null);
    void allowanceTypesApi
      .getAll({ companyId, isActive: true, limit: 200, ...payrollListArchiveQuery() })
      .then((allowances) => setAllowanceTypes(allowances.items))
      .catch(() => setAllowanceTypes([]));
  }, [open, editItem, companyId]);

  const patch = (p: Partial<DraftForm>) => setForm((f) => ({ ...f, ...p }));

  const toggleArticle = (articleId: string) => {
    setForm((f) => ({
      ...f,
      articleIds: f.articleIds.includes(articleId)
        ? f.articleIds.filter((id) => id !== articleId)
        : [...f.articleIds, articleId],
    }));
  };

  const handleSave = async () => {
    if (!form.nameAr.trim()) { setError('الاسم العربي مطلوب'); return; }

    const allowanceLines = form.allowanceLines
      .filter((l) => l.allowanceTypeId && l.amount !== '')
      .map((l, i) => ({
        allowanceTypeId: l.allowanceTypeId,
        amount: Number(l.amount),
        sortOrder: l.sortOrder ?? i,
      }));

    setSaving(true);
    setError(null);
    try {
      const base = {
        nameAr: form.nameAr.trim(),
        nameEn: form.nameEn.trim() || null,
        descriptionAr: form.descriptionAr.trim() || null,
        descriptionEn: form.descriptionEn.trim() || null,
        defaultContractNature: form.defaultContractNature,
        defaultWorkArrangement: form.defaultWorkArrangement,
        defaultProbationDays: form.defaultProbationDays ? Number(form.defaultProbationDays) : null,
        defaultAnnualLeaveDays: form.defaultAnnualLeaveDays ? Number(form.defaultAnnualLeaveDays) : null,
        suggestedBaseSalary: form.suggestedBaseSalary ? Number(form.suggestedBaseSalary) : undefined,
        currency: form.currency || 'SAR',
        durationMonths:
          form.defaultContractNature === 'fixed_term' && form.durationMonths
            ? Number(form.durationMonths)
            : null,
        allowancesHint: form.allowancesHint.trim() || null,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
        allowanceLines,
        articleIds: form.articleIds,
      };

      if (editItem) {
        await contractTemplatesApi.update(editItem.id, base);
        toast.success('تم تحديث قالب العقد');
      } else {
        await contractTemplatesApi.create({ companyId, ...base });
        toast.success('تمت إضافة قالب العقد');
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const { displayMessage } = handleApiError(err, 'contract-templates.save');
      setError(displayMessage);
    } finally {
      setSaving(false);
    }
  };

  const showDuration = form.defaultContractNature === 'fixed_term';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-border" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-display text-base">
            {editItem ? 'تعديل قالب العقد' : 'قالب عقد جديد'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            إعدادات افتراضية للعقود — الراتب، البدلات، ومواد العقد
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              الاسم العربي <span className="text-destructive">*</span>
            </Label>
            <Input value={form.nameAr} onChange={(e) => patch({ nameAr: e.target.value })} className="h-9" />
          </div>

          <div className="space-y-1.5 max-w-[140px]">
            <Label className="text-xs font-medium text-muted-foreground">الترتيب</Label>
            <Input type="number" value={form.sortOrder} onChange={(e) => patch({ sortOrder: e.target.value })} className="h-9" dir="ltr" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">طبيعة العقد</Label>
              <Select
                value={form.defaultContractNature}
                onValueChange={(v) => patch({ defaultContractNature: v as ContractNature })}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(TEMPLATE_CONTRACT_NATURE_LABELS) as [ContractNature, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">نظام العمل</Label>
              <Select
                value={form.defaultWorkArrangement}
                onValueChange={(v) => patch({ defaultWorkArrangement: v as WorkArrangement })}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(TEMPLATE_WORK_ARRANGEMENT_LABELS) as [WorkArrangement, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">فترة التجربة (يوم)</Label>
              <Input type="number" min={0} value={form.defaultProbationDays} onChange={(e) => patch({ defaultProbationDays: e.target.value })} className="h-9" dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">إجازة سنوية (يوم)</Label>
              <Input type="number" min={0} value={form.defaultAnnualLeaveDays} onChange={(e) => patch({ defaultAnnualLeaveDays: e.target.value })} className="h-9" dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">الراتب المقترح</Label>
              <Input type="number" min={0} value={form.suggestedBaseSalary} onChange={(e) => patch({ suggestedBaseSalary: e.target.value })} className="h-9" dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">العملة</Label>
              <Input value={form.currency} onChange={(e) => patch({ currency: e.target.value })} className="h-9 font-mono" dir="ltr" />
            </div>
          </div>

          {showDuration && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">مدة العقد (شهر)</Label>
              <Input type="number" min={1} value={form.durationMonths} onChange={(e) => patch({ durationMonths: e.target.value })} className="h-9 max-w-[140px]" dir="ltr" />
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">وصف عربي</Label>
              <Textarea value={form.descriptionAr} onChange={(e) => patch({ descriptionAr: e.target.value })} className="min-h-[56px] resize-none text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">تلميح البدلات</Label>
              <Textarea value={form.allowancesHint} onChange={(e) => patch({ allowancesHint: e.target.value })} className="min-h-[56px] resize-none text-sm" placeholder="يشمل بدل السكن والمواصلات…" />
            </div>
          </div>

          <ContractTemplateAllowanceLinesEditor
            lines={form.allowanceLines}
            allowanceTypes={allowanceTypes}
            onChange={(allowanceLines) => patch({ allowanceLines })}
          />

          {articles.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">مواد العقد المرتبطة</Label>
              <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-border p-2">
                {articles.map((a) => (
                  <label
                    key={a.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={form.articleIds.includes(a.id)}
                      onCheckedChange={() => toggleArticle(a.id)}
                    />
                    <span className="flex-1 truncate">{a.titleAr}</span>
                    <span className="font-mono text-[10px] text-muted-foreground" dir="ltr">{a.code}</span>
                  </label>
                ))}
              </div>
              {form.articleIds.length > 1 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">ترتيب المواد في العقد</Label>
                  <ArticleOrderList
                    items={orderedArticles(
                      form.articleIds,
                      articles.map((a) => ({ id: a.id, code: a.code, title: a.titleAr })),
                      (id) => {
                        const saved = editItem?.articles?.find((x) => x.articleId === id);
                        return saved ? { id, code: saved.articleCode ?? '', title: saved.articleTitleAr ?? '—' } : undefined;
                      },
                    )}
                    onChange={(articleIds) => patch({ articleIds })}
                  />
                </div>
              )}
            </div>
          )}

          <label className="flex cursor-pointer items-center justify-between rounded-xl border-2 border-border px-4 py-3 transition-all hover:bg-muted/20">
            <div>
              <p className="text-sm font-medium">نشط</p>
              <p className="text-xs text-muted-foreground">يظهر القالب عند إنشاء عقود جديدة</p>
            </div>
            <Switch checked={form.isActive} onCheckedChange={(v) => patch({ isActive: v })} />
          </label>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className={dialogFormFooterClass}>
          <Button variant="luxe" onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {editItem ? 'حفظ التعديلات' : 'إضافة القالب'}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
