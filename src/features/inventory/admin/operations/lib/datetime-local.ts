/**
 * `<input type="datetime-local">` holds local wall time without a zone.
 * Documents store an instant (ISO, UTC). Convert both ways through the
 * browser's zone, so saving a document without touching its date keeps it.
 */
export function toDateTimeLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/** Local wall time from the field → ISO instant; empty → null. */
export function fromDateTimeLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
