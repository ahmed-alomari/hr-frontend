import { resolveUploadUrl } from '@/shared/resolve-upload-url';

/**
 * Normalize legacy single URL + array field into a clean unique list of
 * browser-loadable links: uploaded receipts (`/uploads/...`, store plan A3)
 * go through the API proxy; old embedded images (`data:`) stay as they are.
 */
export function resolvePaymentProofUrls(input: {
  paymentProofUrls?: string[] | null;
  paymentProofUrl?: string | null;
}): string[] {
  const fromArray = (input.paymentProofUrls ?? [])
    .map((url) => url?.trim())
    .filter((url): url is string => Boolean(url))
    .map((url) => resolveUploadUrl(url));
  if (fromArray.length > 0) {
    return Array.from(new Set(fromArray));
  }
  const single = input.paymentProofUrl?.trim();
  return single ? [resolveUploadUrl(single)] : [];
}

/** UI limit before compression (original file). */
export const MAX_PAYMENT_PROOF_FILES = 5;
export const MAX_PAYMENT_PROOF_BYTES = 4 * 1024 * 1024;

/**
 * Re-encode an image as a JPEG of at most 1280px on the long edge before it is
 * uploaded: smaller, and without the photo's metadata (location, device).
 */
export async function compressImageToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const maxEdge = 1280;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('CANVAS_UNSUPPORTED');
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.8),
  );
  if (!blob) throw new Error('ENCODE_FAILED');
  return blob;
}
