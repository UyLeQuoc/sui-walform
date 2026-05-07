'use client';

import Link from 'next/link';
import { motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { useState } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../button';
import { ArrowRight } from 'lucide-react';

const links = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how' },
  { label: 'Use cases', href: '#use-cases' },
  { label: 'Templates', href: '#cta' },
];

export function Navbar() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setScrolled(latest > 16);
  });

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center"
    >
      <div
        className={cn(
          'flex w-full items-center justify-center border transition-all duration-300',
          scrolled
            ? 'border-border/60 bg-background/70 backdrop-blur-md'
            : 'border-transparent bg-transparent',
        )}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-2">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold">WalForm</span>
            <span className="border-primary/30 bg-primary/10 text-primary ml-1 hidden border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase sm:inline-block">
              Testnet
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <Link key={l.href} href={l.href}>
                <Button variant="ghost">{l.label}</Button>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild>
              <Link href="/forms">
                Start building
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
