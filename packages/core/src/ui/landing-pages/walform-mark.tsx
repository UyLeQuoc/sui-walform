import { cn } from '../../lib/utils';

export function WalformMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn('size-8', className)} aria-hidden>
      <rect x="2" y="2" width="28" height="28" rx="8" className="fill-primary" />
      <path
        d="M9 11l2.5 10L16 13l4.5 8L23 11"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary-foreground"
      />
    </svg>
  );
}
