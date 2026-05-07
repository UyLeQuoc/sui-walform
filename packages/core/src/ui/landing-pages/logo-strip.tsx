'use client';

import { motion } from 'framer-motion';

const STACK = [
  { label: 'Sui', sub: 'Object model' },
  { label: 'Walrus', sub: 'Storage' },
  { label: 'Seal', sub: 'E2E encryption' },
  { label: 'Enoki', sub: 'Sponsored gas' },
  { label: 'zkLogin', sub: 'Any Google login' },
  { label: 'Kiosk', sub: 'Template market' },
];

export function LogoStrip() {
  return (
    <section className="border-border/60 bg-muted/20 relative border-y py-10">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-muted-foreground mb-6 text-center text-xs font-semibold tracking-wider uppercase">
          Built on the full decentralized stack
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {STACK.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.06, duration: 0.5 }}
              className="border-border/60 bg-card/60 flex flex-col items-center rounded-xl border px-3 py-4 text-center backdrop-blur"
            >
              <span className="text-base font-semibold tracking-tight">{item.label}</span>
              <span className="text-muted-foreground mt-0.5 text-[11px]">{item.sub}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
