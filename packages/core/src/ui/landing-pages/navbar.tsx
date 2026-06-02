'use client';

import { Link } from 'react-router-dom';
import { motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { useState } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../button';
import { ArrowRight } from 'lucide-react';
import { ThemeToggle } from '../../forms/components/editor/ThemeToggle';
import { Logo } from '../logo';
import { WalletButton } from '../../sui/wallet-ui';

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
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-4 py-2 sm:gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <Link to="/" className="flex shrink-0 items-center gap-2">
              <Logo variant="primary" className="size-7" />
              <span className="font-mono text-base font-bold sm:text-lg">WalForm</span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {links.map((l) => (
                <a key={l.href} href={l.href}>
                  <Button variant="ghost">{l.label}</Button>
                </a>
              ))}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <WalletButton />
            <Button asChild className="px-3 sm:px-4">
              <Link to="/forms">
                <span className="hidden sm:inline">Start building</span>
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
