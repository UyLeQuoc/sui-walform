'use client';

import { motion } from 'framer-motion';

const PHRASES = [
  'Encrypted by default',
  'Gasless for respondents',
  'Own the data',
  'Walrus-hosted',
  'Seal whitelist',
  'Any wallet, any zkLogin',
  'No platform lock-in',
  'Sui Overflow 2026',
];

export function Marquee() {
  return (
    <section className="border-border/60 from-background via-muted/40 to-background relative overflow-hidden border-y bg-gradient-to-r py-5">
      <div
        aria-hidden
        className="from-background pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r to-transparent"
      />
      <div
        aria-hidden
        className="from-background pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l to-transparent"
      />

      <motion.div
        className="flex gap-10 whitespace-nowrap"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 28, ease: 'linear', repeat: Infinity }}
      >
        {[...PHRASES, ...PHRASES, ...PHRASES, ...PHRASES].map((p, i) => (
          <span
            key={`${p}-${i}`}
            className="text-muted-foreground flex shrink-0 items-center gap-10 text-xl font-semibold tracking-tight sm:text-2xl"
          >
            {p}
            <StarIcon className="text-primary size-5" />
          </span>
        ))}
      </motion.div>
    </section>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 2l2.39 7.36H22l-6.18 4.49L18.18 22 12 17.27 5.82 22l2.36-8.15L2 9.36h7.61L12 2z"
        fill="currentColor"
      />
    </svg>
  );
}
