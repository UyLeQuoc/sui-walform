'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Button } from '../button';
import { HeroVisual } from './hero-visual';
import { AnimatedGridBackground } from './animated-grid-background';
import { AnimatedHeadline } from './animated-headline';
import { ArrowRight } from 'lucide-react';

export function Hero() {
  const root = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: root,
    offset: ['start start', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0]);

  return (
    <section
      ref={root}
      className="relative isolate flex min-h-screen items-center overflow-hidden pt-28 pb-24 sm:pt-32"
    >
      <AnimatedGridBackground />

      {/* Radial spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 0%, color-mix(in oklch, var(--primary) 18%, transparent) 0%, transparent 70%)',
        }}
      />

      <motion.div
        style={{ y, opacity }}
        className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center px-6 text-center"
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="border-border/80 bg-background/70 text-muted-foreground mb-6 inline-flex items-center gap-2 border px-3 py-1 text-xs font-medium shadow-sm backdrop-blur"
        >
          <span className="relative flex size-2">
            <span className="bg-primary absolute inline-flex size-full animate-ping opacity-75" />
            <span className="bg-primary relative inline-flex size-2" />
          </span>
          Live on Sui Testnet · Built for Sui Overflow 2026
        </motion.div>

        <AnimatedHeadline />

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.7 }}
          className="text-muted-foreground mt-8 max-w-2xl text-base text-balance sm:text-lg"
        >
          The first truly decentralized form builder on Sui. End-to-end encrypted submissions,
          gasless UX for respondents, and forms that live forever on Walrus — no platform can take
          them down.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.05, duration: 0.6 }}
          className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Button asChild>
            <Link href="/forms">
              Start building — it&apos;s free
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="#how">See how it works</Link>
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 1.2, duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16 w-full"
        >
          <HeroVisual />
        </motion.div>
      </motion.div>
    </section>
  );
}
