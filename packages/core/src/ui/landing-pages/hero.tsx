'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Button } from '../button';
import { HeroVisual } from './hero-visual';
import { AnimatedGridBackground } from './animated-grid-background';
import { AnimatedHeadline } from './animated-headline';
import { ArrowRight } from 'lucide-react';
import { useActiveNetwork, useActivePackageId } from '../../sui/env-network';
import { suivisionUrl } from '../../sui/explorer';
import { NetworkBadge } from '../../sui/wallet-ui/NetworkBadge';

export function Hero() {
  const root = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: root,
    offset: ['start start', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0]);

  const network = useActiveNetwork() ?? 'mainnet';
  const packageId = useActivePackageId();
  const networkLabel = network === 'mainnet' ? 'Mainnet' : 'Testnet';
  const badgeHref = packageId
    ? suivisionUrl(network, 'package', packageId)
    : `https://${network === 'mainnet' ? '' : 'testnet.'}suivision.xyz/`;

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
          className="mb-6 flex flex-wrap items-center justify-center gap-2"
        >
          <a
            href={badgeHref}
            target="_blank"
            rel="noreferrer"
            className="border-border/80 bg-background/70 text-muted-foreground hover:text-foreground inline-flex items-center gap-2 border px-3 py-1 text-xs font-medium shadow-sm backdrop-blur transition-colors"
          >
            <span className="relative flex size-2">
              <span className="bg-primary absolute inline-flex size-full animate-ping opacity-75" />
              <span className="bg-primary relative inline-flex size-2" />
            </span>
            Live on Sui {networkLabel} · Built for Walrus Session 2
            <span aria-hidden className="text-muted-foreground/70">
              ↗
            </span>
          </a>
          <NetworkBadge className="h-7 px-2 py-0.5 text-xs" />
        </motion.div>

        <AnimatedHeadline />

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.7 }}
          className="text-muted-foreground mt-8 max-w-2xl text-base text-balance sm:text-lg"
        >
          The first truly decentralized form builder on Walrus. End-to-end encrypted submissions,
          sponsored-or-self-paid gas, and forms that live forever on Walrus blobs — no platform can
          take them down.
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
