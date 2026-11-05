/**
 * What the server's slugify makes from an Arabic or Latin name: lowercase
 * letters of any script and digits, joined by single hyphens. A slug the
 * system generated must pass the form unchanged.
 */
const SLUG_PATTERN = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

export function isValidSlug(value: string): boolean {
  return SLUG_PATTERN.test(value) && value === value.toLowerCase();
}

export const SLUG_MESSAGE = 'الرابط المختصر حروف صغيرة وأرقام تفصلها شرطات، بلا مسافات ولا رموز';
