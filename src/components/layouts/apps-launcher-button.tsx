import Link from 'next/link';
import { LayoutGrid } from 'lucide-react';
import { cn } from '@/shared/utils';

type AppsLauncherButtonProps = {
  className?: string;
  /** Shown instead of «التطبيقات» while inside an app, so the chip names where you are. */
  label?: string;
};

/**
 * App switcher: soft gold accent + label, separated from in-app nav.
 * Solid gold block competed visually with the active nav pill beside it.
 */
export function AppsLauncherButton({ className, label = 'التطبيقات' }: AppsLauncherButtonProps) {
  return (
    <Link
      href="/"
      aria-label="قائمة التطبيقات"
      title="العودة إلى قائمة التطبيقات"
      className={cn(
        'group flex h-8 shrink-0 items-center gap-1.5 rounded-xl border px-2 sm:px-2.5',
        'border-gold/35 bg-gold/10 text-gold shadow-xs',
        'transition-all duration-200',
        'hover:border-gold/50 hover:bg-gold/15 hover:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2',
        className,
      )}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gold/15 transition-colors group-hover:bg-gold/25">
        <LayoutGrid className="h-3.5 w-3.5" strokeWidth={2.25} />
      </span>
      <span className="hidden text-[11px] font-semibold leading-none sm:inline">
        {label}
      </span>
    </Link>
  );
}
