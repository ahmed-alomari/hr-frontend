import { compressImageToJpeg } from '@/features/ecommerce/domain/lib/payment-proofs';
import type { CreateStoreOrderAttachmentInput } from '@/features/ecommerce/domain/types/order';
import { resolveApiBaseUrl } from '@/shared/api-base-url';
import { publicConfig } from '@/shared/config';
import { resolveUploadUrl } from '@/shared/resolve-upload-url';

/** Backend caps attachments uploaded with a single order at 20. */
export const MAX_ORDER_ATTACHMENTS = 20;
/** Original file size cap (per file); the server accepts up to 5 MB. */
export const MAX_ORDER_ATTACHMENT_BYTES = 5 * 1024 * 1024;
/** File picker accept list — images + PDF cover the common receipt/ID cases. */
export const ORDER_ATTACHMENT_ACCEPT = 'image/*,application/pdf';

/** Thrown by the upload helpers with a user-facing Arabic message. */
export class OrderAttachmentError extends Error {}

export function isImageMime(mime?: string | null): boolean {
  return Boolean(mime && mime.startsWith('image/'));
}

/** Human-readable size from a bigint-as-string or number. */
export function formatAttachmentSize(bytes: string | number | null | undefined): string {
  const value = typeof bytes === 'string' ? Number(bytes) : bytes;
  if (!value || !Number.isFinite(value) || value <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  const rounded = size >= 10 || unit === 0 ? Math.round(size) : Math.round(size * 10) / 10;
  return `${rounded} ${units[unit]}`;
}

function jpegName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '') || 'receipt';
  return `${base}.jpg`;
}

/**
 * Uploads a receipt or attachment for a store order (store plan A3) and
 * returns a link the order accepts: `POST /public/store/order-files`. The
 * order itself only stores the file's path, never its content and never an
 * outside link. Images are re-encoded as JPEG first (smaller, no metadata).
 */
export async function uploadStoreOrderFile(
  companyId: string,
  file: File,
): Promise<{ url: string; fileName: string; mimeType: string; sizeBytes: number }> {
  if (file.size > MAX_ORDER_ATTACHMENT_BYTES) {
    throw new OrderAttachmentError(
      `${file.name}: حجم الملف كبير جداً (الحد ${formatAttachmentSize(MAX_ORDER_ATTACHMENT_BYTES)}).`,
    );
  }
  const isImage = file.type.startsWith('image/');
  let body: Blob = file;
  let fileName = file.name;
  if (isImage) {
    try {
      body = await compressImageToJpeg(file);
      fileName = jpegName(file.name);
    } catch {
      throw new OrderAttachmentError(`${file.name}: تعذّرت قراءة الصورة. جرّب صورة أخرى.`);
    }
  }
  const form = new FormData();
  form.append('file', body, fileName);

  const base = resolveApiBaseUrl(publicConfig.apiUrl).replace(/\/$/, '');
  let response: Response;
  try {
    response = await fetch(
      `${base}/public/store/order-files?companyId=${encodeURIComponent(companyId)}`,
      { method: 'POST', body: form },
    );
  } catch {
    throw new OrderAttachmentError(`${file.name}: تعذّر الاتصال. تحقق من الإنترنت وحاول مجدداً.`);
  }
  const payload = (await response.json().catch(() => null)) as {
    message?: string | string[];
    data?: { url?: string; mimeType?: string; size?: number };
  } | null;
  if (!response.ok || !payload?.data?.url) {
    const message = Array.isArray(payload?.message)
      ? payload?.message.join(' · ')
      : payload?.message;
    throw new OrderAttachmentError(
      `${file.name}: ${message?.trim() || 'تعذّر رفع الملف. حاول مجدداً.'}`,
    );
  }
  return {
    // Browser-loadable (through the API proxy) and accepted by the order.
    url: resolveUploadUrl(payload.data.url),
    fileName,
    mimeType: payload.data.mimeType || body.type || file.type,
    sizeBytes: payload.data.size ?? body.size,
  };
}

/** Upload a picked file and build the attachment the order API expects. */
export async function fileToOrderAttachment(
  companyId: string,
  file: File,
  label?: string | null,
): Promise<CreateStoreOrderAttachmentInput> {
  if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
    throw new OrderAttachmentError(`${file.name}: المسموح صور أو PDF فقط.`);
  }
  const uploaded = await uploadStoreOrderFile(companyId, file);
  const trimmedLabel = label?.trim();
  return {
    fileName: uploaded.fileName.slice(0, 255),
    fileUrl: uploaded.url,
    mimeType: uploaded.mimeType || null,
    sizeBytes: uploaded.sizeBytes || null,
    label: trimmedLabel ? trimmedLabel.slice(0, 120) : null,
  };
}
