import * as React from 'react';

/**
 * True from the first time `open` is true, and stays true.
 *
 * For a dialog loaded with `next/dynamic`: render it only once this is true,
 * so its code (and libraries such as zod) loads on the first open, not with
 * the page. It stays mounted after closing, as it was before, so the closing
 * animation and the form's reset on the next open work as they did.
 */
export function useOpenedOnce(open: boolean): boolean {
  const [opened, setOpened] = React.useState(open);
  if (open && !opened) setOpened(true);
  return opened || open;
}
