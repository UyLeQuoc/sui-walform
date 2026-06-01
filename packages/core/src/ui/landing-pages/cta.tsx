'use client';

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../button';

export function Cta() {
  return (
    <section id="cta" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="border-primary/30 from-primary/15 via-background to-background relative overflow-hidden rounded-3xl border bg-gradient-to-br p-10 text-center sm:p-16"
        >
          {/* glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 left-1/2 size-[560px] -translate-x-1/2 rounded-full blur-3xl"
            style={{
              background:
                'radial-gradient(circle, color-mix(in oklch, var(--primary) 35%, transparent), transparent 70%)',
            }}
          />

          {/* grid overlay */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.15]"
            style={{
              backgroundImage:
                'linear-gradient(to right, currentColor 1px, transparent 1px),\n                 linear-gradient(to bottom, currentColor 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              color: 'var(--foreground)',
              maskImage: 'radial-gradient(ellipse 60% 80% at 50% 50%, black 30%, transparent 80%)',
              WebkitMaskImage:
                'radial-gradient(ellipse 60% 80% at 50% 50%, black 30%, transparent 80%)',
            }}
          />

          <div className="relative">
            <h2 className="text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl">
              Build forms your respondents
              <br className="hidden sm:block" />
              <span className="from-primary bg-gradient-to-r to-[color-mix(in_oklch,var(--primary)_60%,black)] bg-clip-text text-transparent">
                {' '}
                actually trust.
              </span>
            </h2>
            <p className="text-muted-foreground mx-auto mt-5 max-w-lg text-base sm:text-lg">
              Free on Sui testnet. No credit card, no SUI deposit, no platform lock-in. Your first
              form is live in 60 seconds.
            </p>

            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button asChild size="lg" className="rounded-full px-7">
                <Link to="/forms">Start building</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-border/80 rounded-full px-7 backdrop-blur"
              >
                <a href="https://github.com/ngogiahuandev" target="_blank" rel="noreferrer">
                  Read the docs
                </a>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
