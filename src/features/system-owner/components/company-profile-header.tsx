'use client';

import * as React from 'react';
import Link from 'next/link';
import { Archive, Building2, ImagePlus, Pause, Pencil, Play, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { systemOwnerRoutes } from '@/features/system-owner/constants/routes';
import {
  COMPANY_MODE_LABEL,
  COMPANY_STATUS_LABEL,
} from '@/features/system-owner/constants/company-status';
import { useSystemOwnerMutations } from '@/features/system-owner/hooks/use-system-owner';
import type {
  CompanyStatusAction,
  CreateSystemOwnerCompanyDto,
  SystemOwnerCompany,
} from '@/features/system-owner/lib/api/system-owner';
import { handleApiError } from '@/features/hr/lib/api/global-error-handler';
import { uploadsApi } from '@/shared/api/uploads';
import { resolveUploadUrl, uploadResponseToStoredPath } from '@/shared/resolve-upload-url';
import { COMPANY_LOGO_MAX_EDGE, isSvgFile, shrinkImageFile } from '@/shared/shrink-image-file';

const STATUS_BADGE: Record<SystemOwnerCompany['status'], 'success' | 'warning' | 'subtle'> = {
  active: 'success',
  suspended: 'warning',
  archived: 'subtle',
};

const ACTION_COPY: Record<
  CompanyStatusAction,
  { label: string; title: string; body: string; destructive: boolean }
> = {
  suspend: {
    label: 'إيقاف مؤقت',
    title: 'إيقاف الشركة مؤقتاً',
    body: 'لن يستطيع أي مستخدم من الشركة الدخول، وتُغلق الجلسات المفتوحة. لا يُحذف شيء، وعند الاستئناف يعود كل شيء كما كان.',
    destructive: true,
  },
  resume: {
    label: 'استئناف',
    title: 'استئناف الشركة',
    body: 'يعود مستخدمو الشركة للدخول بأدوارهم وبياناتهم كما كانت.',
    destructive: false,
  },
  archive: {
    label: 'إنهاء الشركة',
    title: 'إنهاء الشركة (أرشفة)',
    body: 'تنتقل الشركة إلى «المنتهية» ولا يدخلها مستخدموها. بياناتها كلها محفوظة، ويمكن إعادتها لاحقاً.',
    destructive: true,
  },
  restore: {
    label: 'إعادة الشركة',
    title: 'إعادة الشركة إلى العمل',
    body: 'تعود الشركة إلى «الفعّالة» ويدخلها مستخدموها كما كانوا.',
    destructive: false,
  },
};

const ACTIONS_BY_STATUS: Record<SystemOwnerCompany['status'], CompanyStatusAction[]> = {
  active: ['suspend', 'archive'],
  suspended: ['resume', 'archive'],
  archived: ['restore'],
};

const ACTION_ICON = {
  suspend: Pause,
  resume: Play,
  archive: Archive,
  restore: RotateCcw,
} as const;

export function CompanyProfileHeader({ company }: { company: SystemOwnerCompany }) {
  const [editing, setEditing] = React.useState(false);
  const [action, setAction] = React.useState<CompanyStatusAction | null>(null);
  const { changeCompanyStatus } = useSystemOwnerMutations();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href={systemOwnerRoutes.overview}>العودة للشركات</Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
            تعديل البيانات
          </Button>
          {ACTIONS_BY_STATUS[company.status].map((key) => {
            const Icon = ACTION_ICON[key];
            return (
              <Button
                key={key}
                variant={ACTION_COPY[key].destructive ? 'outline' : 'default'}
                size="sm"
                className={ACTION_COPY[key].destructive ? 'text-destructive' : undefined}
                onClick={() => setAction(key)}
              >
                <Icon className="h-4 w-4" />
                {ACTION_COPY[key].label}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40">
          {company.logoUrl ? (
            <img src={resolveUploadUrl(company.logoUrl)} alt="" className="h-full w-full object-contain" />
          ) : (
            <Building2 className="h-6 w-6 text-muted-foreground" />
          )}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-base font-semibold">{company.nameAr}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={STATUS_BADGE[company.status]}>{COMPANY_STATUS_LABEL[company.status]}</Badge>
            <Badge variant={company.operatingMode === 'production' ? 'gold' : 'secondary'}>
              وضع {COMPANY_MODE_LABEL[company.operatingMode]}
            </Badge>
            {company.code ? (
              <Badge variant="secondary" className="gap-1">
                الرمز:
                <span dir="ltr" className="font-mono">
                  {company.code}
                </span>
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      {company.status !== 'active' ? (
        <p className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-2 text-xs">
          {company.status === 'suspended'
            ? 'الشركة موقوفة مؤقتاً: مستخدموها لا يستطيعون الدخول. بياناتها محفوظة وتعود عند الاستئناف.'
            : 'الشركة منتهية: مستخدموها لا يستطيعون الدخول. بياناتها محفوظة ويمكن إعادتها.'}
        </p>
      ) : null}

      <EditCompanyDialog company={company} open={editing} onOpenChange={setEditing} />

      <Dialog
        open={action !== null}
        onOpenChange={(open) => (!open && !changeCompanyStatus.isPending ? setAction(null) : undefined)}
      >
        <DialogContent>
          {action ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {ACTION_COPY[action].title} — {company.nameAr}
                </DialogTitle>
                <DialogDescription>{ACTION_COPY[action].body}</DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  disabled={changeCompanyStatus.isPending}
                  onClick={() => setAction(null)}
                >
                  إلغاء
                </Button>
                <Button
                  variant={ACTION_COPY[action].destructive ? 'destructive' : 'default'}
                  disabled={changeCompanyStatus.isPending}
                  onClick={() =>
                    changeCompanyStatus.mutate(
                      { companyId: company.id, action },
                      { onSuccess: () => setAction(null) },
                    )
                  }
                >
                  {changeCompanyStatus.isPending ? 'جارٍ التنفيذ…' : ACTION_COPY[action].label}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

type EditForm = Record<
  Extract<
    keyof CreateSystemOwnerCompanyDto,
    | 'nameAr'
    | 'code'
    | 'nameEn'
    | 'commercialRegistrationNo'
    | 'taxNumber'
    | 'email'
    | 'phone'
    | 'mobile'
    | 'website'
    | 'city'
    | 'address'
    | 'logoUrl'
    | 'notes'
  >,
  string
>;

const toForm = (company: SystemOwnerCompany): EditForm => ({
  nameAr: company.nameAr ?? '',
  code: company.code ?? '',
  nameEn: company.nameEn ?? '',
  commercialRegistrationNo: company.commercialRegistrationNo ?? '',
  taxNumber: company.taxNumber ?? '',
  email: company.email ?? '',
  phone: company.phone ?? '',
  mobile: company.mobile ?? '',
  website: company.website ?? '',
  city: company.city ?? '',
  address: company.address ?? '',
  logoUrl: company.logoUrl ?? '',
  notes: company.notes ?? '',
});

const TEXT_FIELDS: ReadonlyArray<{ key: keyof EditForm; label: string; ltr?: boolean }> = [
  { key: 'nameEn', label: 'الاسم الإنجليزي', ltr: true },
  { key: 'code', label: 'رمز الشركة', ltr: true },
  { key: 'commercialRegistrationNo', label: 'السجل التجاري', ltr: true },
  { key: 'taxNumber', label: 'الرقم الضريبي', ltr: true },
  { key: 'email', label: 'البريد', ltr: true },
  { key: 'phone', label: 'الهاتف', ltr: true },
  { key: 'mobile', label: 'الجوال', ltr: true },
  { key: 'website', label: 'الموقع الإلكتروني', ltr: true },
  { key: 'city', label: 'المدينة' },
  { key: 'address', label: 'العنوان' },
];

function EditCompanyDialog({
  company,
  open,
  onOpenChange,
}: {
  company: SystemOwnerCompany;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { updateCompany } = useSystemOwnerMutations();
  const [form, setForm] = React.useState<EditForm>(() => toForm(company));
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) setForm(toForm(company));
  }, [open, company]);

  const patch = (partial: Partial<EditForm>) => setForm((prev) => ({ ...prev, ...partial }));

  const pickLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') && !isSvgFile(file)) {
      toast.error('يرجى اختيار ملف صورة');
      return;
    }
    setUploading(true);
    try {
      const prepared = await shrinkImageFile(file, COMPANY_LOGO_MAX_EDGE);
      const uploaded = await uploadsApi.upload('image', prepared);
      patch({ logoUrl: uploadResponseToStoredPath(uploaded) });
    } catch (err) {
      toast.error(handleApiError(err, 'uploads.image').displayMessage);
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    const code = form.code.trim();
    const orNull = (value: string) => value.trim() || null;
    updateCompany.mutate(
      {
        companyId: company.id,
        payload: {
          nameAr: form.nameAr.trim(),
          code: code && code !== (company.code ?? '') ? code : undefined,
          nameEn: orNull(form.nameEn),
          commercialRegistrationNo: orNull(form.commercialRegistrationNo),
          taxNumber: orNull(form.taxNumber),
          email: orNull(form.email),
          phone: orNull(form.phone),
          mobile: orNull(form.mobile),
          website: orNull(form.website),
          city: orNull(form.city),
          address: orNull(form.address),
          logoUrl: orNull(form.logoUrl),
          notes: orNull(form.notes),
        },
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const busy = uploading || updateCompany.isPending;

  return (
    <Dialog open={open} onOpenChange={(next) => (!busy ? onOpenChange(next) : undefined)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تعديل بيانات الشركة</DialogTitle>
          <DialogDescription>
            الاسم والشعار يظهران لمستخدمي الشركة وفي مستنداتها المطبوعة.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40">
              {form.logoUrl ? (
                <img src={resolveUploadUrl(form.logoUrl)} alt="شعار الشركة" className="h-full w-full object-contain" />
              ) : (
                <Building2 className="h-7 w-7 text-muted-foreground" />
              )}
            </span>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.svg"
                className="hidden"
                onChange={(e) => void pickLogo(e)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4" />
                {uploading ? 'جاري الرفع…' : 'رفع شعار'}
              </Button>
              {form.logoUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  disabled={busy}
                  onClick={() => patch({ logoUrl: '' })}
                >
                  <Trash2 className="h-4 w-4" />
                  إزالة الشعار
                </Button>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="so-edit-name-ar">اسم الشركة</Label>
            <Input
              id="so-edit-name-ar"
              value={form.nameAr}
              onChange={(e) => patch({ nameAr: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {TEXT_FIELDS.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`so-edit-${field.key}`}>{field.label}</Label>
                <Input
                  id={`so-edit-${field.key}`}
                  dir={field.ltr ? 'ltr' : undefined}
                  value={form[field.key]}
                  onChange={(e) => patch({ [field.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="so-edit-notes">ملاحظات داخلية</Label>
            <Textarea
              id="so-edit-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => patch({ notes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button disabled={busy || !form.nameAr.trim()} onClick={save}>
            {updateCompany.isPending ? 'جاري الحفظ…' : 'حفظ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
