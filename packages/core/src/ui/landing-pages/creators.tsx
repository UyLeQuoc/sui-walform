'use client';

import { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { SectionHeader } from './features';

gsap.registerPlugin(ScrollTrigger);

// Drop-in creator image paths.
// Place the files in the consuming app's `public/` directory, e.g.:
//   apps/builder/public/creators/uydev.jpg
//   apps/builder/public/creators/huanngdev.jpg
// If a file is missing or fails to load, the initials avatar shows through.
const CREATORS = [
  {
    handle: 'Uydev',
    role: 'Fullstack dev',
    bio: 'Software Engineer at CommandOSS',
    accent: 'from-primary/30 via-primary/10 to-transparent',
    initials: 'UY',
    image: '/creators/uydev.jpg',
  },
  {
    handle: 'Huanngdev',
    role: 'Fullstack dev',
    bio: 'React 19 + Vite, shadcn, Seal client-side crypto, Walrus storage glue — ships the surface users actually touch.',
    accent: 'from-[color-mix(in_oklch,var(--primary)_70%,black)]/30 via-primary/10 to-transparent',
    initials: 'HN',
    image: '/creators/huanngdev.jpg',
  },
];

export function Creators() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const cards = gsap.utils.toArray<HTMLElement>('[data-creator]');
      cards.forEach((card, i) => {
        gsap.fromTo(
          card,
          { opacity: 0, y: 60, rotateX: -14 },
          {
            opacity: 1,
            y: 0,
            rotateX: 0,
            duration: 0.9,
            ease: 'expo.out',
            delay: i * 0.12,
            scrollTrigger: {
              trigger: card,
              start: 'top 85%',
              once: true,
            },
          },
        );
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="creators" className="relative overflow-hidden py-24 sm:py-32">
      {/* Backdrop flourish */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(70% 50% at 50% 100%, color-mix(in oklch, var(--primary) 12%, transparent) 0%, transparent 70%)',
        }}
      />

      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader
          eyebrow="Creators"
          title="Shipped by two humans."
          description="WalForm is a weekend-and-nights build for Sui Overflow 2026. No team, no funding, no excuses."
        />

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2" style={{ perspective: 1400 }}>
          {CREATORS.map((c) => (
            <CreatorCard key={c.handle} {...c} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CreatorCard({ handle, role, bio, accent, initials, image }: (typeof CREATORS)[number]) {
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  const rotateX = useSpring(useTransform(mouseY, [0, 1], [6, -6]), { stiffness: 180, damping: 18 });
  const rotateY = useSpring(useTransform(mouseX, [0, 1], [-6, 6]), { stiffness: 180, damping: 18 });
  const glowX = useTransform(mouseX, (v) => `${v * 100}%`);
  const glowY = useTransform(mouseY, (v) => `${v * 100}%`);

  return (
    <motion.div
      data-creator
      ref={ref}
      onMouseMove={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        mouseX.set((e.clientX - rect.left) / rect.width);
        mouseY.set((e.clientY - rect.top) / rect.height);
      }}
      onMouseLeave={() => {
        mouseX.set(0.5);
        mouseY.set(0.5);
      }}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
      className="group border-border/80 bg-card relative overflow-hidden rounded-3xl border p-8"
    >
      {/* Mouse-tracked glow */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(380px circle at ${glowX.get()} ${glowY.get()}, color-mix(in oklch, var(--primary) 22%, transparent), transparent 60%)`,
        }}
      />
      {/* Accent corner */}
      <div
        aria-hidden
        className={`pointer-events-none absolute -top-20 -right-20 size-60 rounded-full bg-gradient-to-br ${accent} blur-3xl`}
      />

      <div className="relative flex items-start gap-5">
        <motion.div
          whileHover={{ scale: 1.06, rotate: -4 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="bg-primary text-primary-foreground relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-xl font-bold shadow-[0_18px_40px_-18px_color-mix(in_oklch,var(--primary)_80%,transparent)]"
        >
          <span className="absolute inset-0 grid place-items-center">{initials}</span>
          {image && (
            <img
              src={image}
              alt={`${handle} avatar`}
              className="relative size-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
        </motion.div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-xl font-semibold tracking-tight">{handle}</h3>
            <span className="border-border bg-muted/50 text-muted-foreground rounded-full border px-2 py-0.5 text-[10px] font-medium">
              {role}
            </span>
          </div>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{bio}</p>

          <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-medium">
            {['Sui', 'Move', 'Vite', 'Seal', 'Walrus'].map((t) => (
              <span
                key={t}
                className="border-border/60 bg-background text-muted-foreground group-hover:border-primary/30 group-hover:text-foreground rounded-full border px-2.5 py-1 transition-colors"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row: socials */}
      <div className="border-border/60 text-muted-foreground relative mt-6 flex items-center justify-between border-t pt-4 text-xs">
        <span className="font-mono">@{handle.toLowerCase()}</span>
        <div className="flex items-center gap-1.5 opacity-70 transition-opacity group-hover:opacity-100">
          <SocialDot />
          <SocialDot />
          <SocialDot />
        </div>
      </div>
    </motion.div>
  );
}

function SocialDot() {
  return (
    <span className="border-border bg-background group-hover:border-primary/40 grid size-7 place-items-center rounded-full border transition-colors">
      <span className="bg-primary size-1.5 rounded-full" />
    </span>
  );
}
