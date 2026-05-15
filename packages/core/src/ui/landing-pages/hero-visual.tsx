'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

export function HeroVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const leftY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const rightY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const tiltY = useTransform(scrollYProgress, [0, 0.5, 1], [10, 0, -6]);

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-5xl">
      {/* glow */}
      <div
        aria-hidden
        className="absolute -inset-x-10 -top-4 -bottom-10 -z-10 blur-3xl"
        style={{
          background:
            'radial-gradient(50% 60% at 50% 40%, color-mix(in oklch, var(--primary) 22%, transparent), transparent 70%)',
        }}
      />

      <motion.div
        initial={{ rotateX: 12 }}
        animate={{ rotateX: 0 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        style={{ perspective: 1600, rotateX: tiltY }}
        className="group border-border/80 bg-card/80 relative overflow-hidden rounded-2xl border shadow-[0_30px_80px_-30px_rgba(0,0,0,0.35)] backdrop-blur-xl"
      >
        {/* top chrome */}
        <div className="border-border/60 bg-muted/40 flex items-center gap-2 border-b px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="bg-destructive/60 size-2.5 rounded-full" />
            <span className="size-2.5 rounded-full bg-[color-mix(in_oklch,var(--primary)_50%,orange)]" />
            <span className="bg-primary/70 size-2.5 rounded-full" />
          </div>
          <div className="bg-background/80 text-muted-foreground mx-auto flex items-center gap-2 rounded-md px-3 py-1 text-xs">
            <LockIcon className="text-primary size-3" />
            walform.app/f/governance-q2
          </div>
          <div className="w-12" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr_260px]">
          {/* sidebar blocks */}
          <div className="border-border/60 hidden flex-col gap-1.5 border-r p-3 md:flex">
            <p className="text-muted-foreground mb-2 px-2 text-[10px] font-semibold tracking-wider uppercase">
              Blocks
            </p>
            {[
              'Short answer',
              'Multiple choice',
              'Rating',
              'File upload',
              'Payment',
              'Wallet connect',
            ].map((b, i) => (
              <motion.div
                key={b}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1 + i * 0.06, duration: 0.35 }}
                className="text-foreground/80 hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1.5 text-xs"
              >
                <span className="bg-primary size-1.5 rounded-full" /> {b}
              </motion.div>
            ))}
          </div>

          {/* canvas */}
          <div className="from-background to-muted/30 flex flex-col gap-4 bg-gradient-to-b p-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0, duration: 0.6 }}
            >
              <p className="text-primary text-[10px] font-semibold tracking-wider uppercase">
                Q1 · Required
              </p>
              <h3 className="text-foreground mt-1 text-lg font-semibold">
                What&apos;s your biggest priority for the DAO this quarter?
              </h3>
              <div className="mt-3 space-y-2">
                {['Treasury', 'Governance', 'Community growth', 'Product'].map((opt, i) => (
                  <motion.label
                    key={opt}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.15 + i * 0.07, duration: 0.35 }}
                    className="border-border bg-card flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm"
                  >
                    <span
                      className={`grid size-4 place-items-center rounded-full border ${
                        i === 1 ? 'border-primary bg-primary/20' : 'border-border'
                      }`}
                    >
                      {i === 1 && <span className="bg-primary size-2 rounded-full" />}
                    </span>
                    {opt}
                  </motion.label>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.45, duration: 0.6 }}
              className="border-primary/50 bg-primary/5 text-foreground/80 rounded-lg border border-dashed p-3 text-xs"
            >
              <div className="text-primary flex items-center gap-2 font-medium">
                <SparkleIcon className="size-3.5" /> AI suggests: add a follow-up question about
                timeline
              </div>
            </motion.div>
          </div>

          {/* right inspector */}
          <div className="border-border/60 bg-background/60 hidden flex-col gap-3 border-l p-4 md:flex">
            <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Encryption
            </p>
            <div className="border-primary/30 bg-primary/5 flex items-center gap-2 rounded-md border px-3 py-2 text-xs">
              <LockIcon className="text-primary size-3.5" />
              <span className="font-medium">Seal whitelist</span>
            </div>
            <p className="text-muted-foreground mt-1 text-[10px] font-semibold tracking-wider uppercase">
              Storage
            </p>
            <div className="bg-muted/50 flex items-center justify-between rounded-md px-3 py-2 text-xs">
              <span>Walrus blob</span>
              <span className="text-primary font-mono">0x4a…e2</span>
            </div>
            <p className="text-muted-foreground mt-1 text-[10px] font-semibold tracking-wider uppercase">
              Signer
            </p>
            <div className="bg-muted/50 flex items-center justify-between rounded-md px-3 py-2 text-xs">
              <span>Your wallet</span>
              <span className="text-primary">Self-paid</span>
            </div>

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 1.6, duration: 0.5 }}
              className="bg-primary text-primary-foreground mt-auto rounded-lg p-3 text-center text-sm font-semibold"
            >
              Publish form
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* floating encryption chip */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.8, duration: 0.6 }}
        style={{ y: leftY }}
        className="border-border/80 bg-card/90 absolute top-28 -left-6 hidden rounded-xl border p-3 shadow-xl backdrop-blur lg:block"
      >
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="flex items-center gap-2 text-xs font-medium">
            <LockIcon className="text-primary size-4" />
            Encrypted client-side
          </div>
          <div className="text-muted-foreground mt-1 font-mono text-[10px]">0xsealed:9f3b…42a1</div>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2, duration: 0.6 }}
        style={{ y: rightY }}
        className="border-border/80 bg-card/90 absolute -right-4 bottom-24 hidden rounded-xl border p-3 shadow-xl backdrop-blur lg:block"
      >
        <motion.div
          animate={{ y: [0, 5, 0] }}
          transition={{
            duration: 3.5,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.6,
          }}
        >
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Respondent pays
          </div>
          <div className="text-primary mt-0.5 text-xl font-semibold">0 SUI</div>
        </motion.div>
      </motion.div>
    </div>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
