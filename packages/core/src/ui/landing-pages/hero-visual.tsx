/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { useTheme } from '@teispace/next-themes';
import { Blocks, Palette, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';

export function HeroVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const leftY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const rightY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const tiltY = useTransform(scrollYProgress, [0, 0.5, 1], [10, 0, -6]);

  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === 'dark';
  const imageSrc = isDark
    ? '/images/editor_form_setting_dark.png'
    : '/images/editor_form_setting.png';

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-6xl">
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
        initial={{ rotateX: 12, opacity: 0 }}
        animate={{ rotateX: 0, opacity: 1 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        style={{ perspective: 1600, rotateX: tiltY }}
        className="border-border/80 bg-card/80 relative overflow-hidden rounded-2xl border shadow-[0_30px_80px_-30px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      >
        {/* Browser chrome */}
        <div className="border-border/60 bg-muted/40 flex items-center gap-2 border-b px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="bg-destructive/60 size-2.5 rounded-full" />
            <span className="size-2.5 rounded-full bg-[color-mix(in_oklch,var(--primary)_50%,orange)]" />
            <span className="bg-primary/70 size-2.5 rounded-full" />
          </div>
          <div className="bg-background/80 text-muted-foreground mx-auto flex items-center gap-2 rounded-md px-3 py-1 text-xs">
            <LockIcon className="text-primary size-3" />
            walform.wal.app/forms/edit?formId=hackathon-signup
          </div>
          <div className="w-12" />
        </div>

        {/* Screenshot — crossfade on theme switch */}
        <div className="relative aspect-[16/9] w-full bg-background">
          <AnimatePresence initial={false} mode="sync">
            <motion.div
              key={imageSrc}
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0"
            >
              <Image
                src={imageSrc}
                alt="WalForm editor — field palette on the left, live form canvas in the middle, form settings on the right"
                fill
                sizes="(min-width: 1280px) 1152px, 100vw"
                className="object-cover object-top"
                priority
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Floating feature callouts — hug the corners of the frame on lg+ */}
      <Callout
        className="top-16 -left-4 hidden lg:flex lg:-left-6"
        y={leftY}
        delay={1.35}
        accent="violet"
        icon={<Blocks className="size-5" />}
        title="14+ field types"
      />
      <Callout
        className="top-16 -right-4 hidden lg:flex lg:-right-6"
        y={rightY}
        delay={1.5}
        accent="amber"
        icon={<Sparkles className="size-5" />}
        title="Generate with AI"
      />
      <Callout
        className="bottom-12 -left-4 hidden lg:flex lg:-left-6"
        y={leftY}
        delay={1.65}
        accent="emerald"
        icon={<ShieldCheck className="size-5" />}
        title="End-to-end encrypted"
      />
      <Callout
        className="bottom-12 -right-4 hidden lg:flex lg:-right-6"
        y={rightY}
        delay={1.8}
        accent="rose"
        icon={<Palette className="size-5" />}
        title="Fully customizable"
      />
      <Callout
        className="-bottom-6 left-1/2 hidden -translate-x-1/2 lg:flex"
        y={rightY}
        delay={1.95}
        accent="primary"
        icon={<Zap className="size-5" />}
        title="1-click publish"
      />
    </div>
  );
}

type Accent = 'violet' | 'amber' | 'sky' | 'rose' | 'emerald' | 'primary';

const accentMap: Record<Accent, { ring: string; iconBg: string; iconText: string; dot: string }> = {
  violet: {
    ring: 'ring-violet-500/30 dark:ring-violet-400/30',
    iconBg: 'bg-violet-500/10 dark:bg-violet-400/15',
    iconText: 'text-violet-600 dark:text-violet-300',
    dot: 'bg-violet-500',
  },
  amber: {
    ring: 'ring-amber-500/30 dark:ring-amber-400/30',
    iconBg: 'bg-amber-500/10 dark:bg-amber-400/15',
    iconText: 'text-amber-600 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  sky: {
    ring: 'ring-sky-500/30 dark:ring-sky-400/30',
    iconBg: 'bg-sky-500/10 dark:bg-sky-400/15',
    iconText: 'text-sky-600 dark:text-sky-300',
    dot: 'bg-sky-500',
  },
  rose: {
    ring: 'ring-rose-500/30 dark:ring-rose-400/30',
    iconBg: 'bg-rose-500/10 dark:bg-rose-400/15',
    iconText: 'text-rose-600 dark:text-rose-300',
    dot: 'bg-rose-500',
  },
  emerald: {
    ring: 'ring-emerald-500/30 dark:ring-emerald-400/30',
    iconBg: 'bg-emerald-500/10 dark:bg-emerald-400/15',
    iconText: 'text-emerald-600 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  primary: {
    ring: 'ring-primary/30',
    iconBg: 'bg-primary/10',
    iconText: 'text-primary',
    dot: 'bg-primary',
  },
};

interface CalloutProps {
  className: string;
  y: MotionValue<number>;
  delay: number;
  accent: Accent;
  icon: React.ReactNode;
  title: string;
}

function Callout({ className, y, delay, accent, icon, title }: CalloutProps) {
  const palette = accentMap[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      style={{ y }}
      className={cn(
        'border-border bg-background absolute flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 shadow-2xl ring-4',
        palette.ring,
        className,
      )}
    >
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-xl',
          palette.iconBg,
          palette.iconText,
        )}
      >
        {icon}
      </span>
      <div className="text-foreground text-sm font-semibold whitespace-nowrap">{title}</div>
      <span aria-hidden className={cn('size-1.5 rounded-full', palette.dot)} />
    </motion.div>
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
