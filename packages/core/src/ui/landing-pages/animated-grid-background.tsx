'use client';

import { motion } from 'framer-motion';

export function AnimatedGridBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-20">
      <div
        className="absolute inset-0 opacity-[0.35] dark:opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(to right, color-mix(in oklch, var(--foreground) 10%, transparent) 1px, transparent 1px),\n             linear-gradient(to bottom, color-mix(in oklch, var(--foreground) 10%, transparent) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, black 40%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 60% at 50% 30%, black 40%, transparent 100%)',
        }}
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
        className="absolute top-1/2 left-1/2 size-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            'conic-gradient(from 90deg at 50% 50%, color-mix(in oklch, var(--primary) 30%, transparent), transparent 40%, color-mix(in oklch, var(--primary) 15%, transparent) 70%, transparent)',
          opacity: 0.4,
        }}
      />
    </div>
  );
}
