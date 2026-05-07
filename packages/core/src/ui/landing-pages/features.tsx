'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';

const FEATURES = [
  {
    title: 'End-to-end encrypted by default',
    body: 'Every submission is Seal-encrypted in the browser before it touches Walrus. The key custodian is the form owner — not us, not a platform, not anyone else.',
    icon: LockIcon,
    span: 'md:col-span-2',
    badge: 'Seal',
  },
  {
    title: 'Gasless for respondents',
    body: 'Enoki sponsors every submission from our app quota. Your respondents never see a wallet prompt for gas — regardless of whether they use Slush, Sui Wallet, or zkLogin.',
    icon: BoltIcon,
    span: '',
    badge: 'Enoki',
  },
  {
    title: 'Forms that can’t be taken down',
    body: 'Schema lives as a Sui object. Submissions live as encrypted blobs on Walrus. Deploy your own Walrus Site with a SuiNS name for a fully decentralized URL.',
    icon: ShieldIcon,
    span: '',
    badge: 'Walrus',
  },
  {
    title: 'Sign in with anything',
    body: 'Slush, Sui Wallet, any dApp-Kit wallet, or a burner Google account via zkLogin. Your respondents pick what they already have.',
    icon: UsersIcon,
    span: '',
    badge: 'zkLogin',
  },
  {
    title: 'AI-assisted form generation',
    body: 'Type “make me an NPS survey for a fintech product” — and WalForm’s BYOK AI (OpenRouter / OpenAI) hydrates a working schema into the canvas.',
    icon: SparkleIcon,
    span: 'md:col-span-2',
    badge: 'AI SDK v6',
  },
];

export function Features() {
  return (
    <section id="features" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader
          eyebrow="Why WalForm"
          title="The form builder your data deserves."
          description="Every piece of the stack is decentralized where it matters. Every piece that isn't is documented honestly."
        />

        <div className="mt-16 grid grid-cols-1 gap-3 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} feature={f} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ feature, index }: { feature: (typeof FEATURES)[number]; index: number }) {
  const ref = useRef<HTMLElement>(null);

  return (
    <motion.article
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ delay: index * 0.06, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      onMouseMove={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        ref.current?.style.setProperty('--mouse-x', `${x}%`);
        ref.current?.style.setProperty('--mouse-y', `${y}%`);
      }}
      className={`group border-border/80 bg-card relative overflow-hidden rounded-2xl border p-6 transition-shadow hover:shadow-[0_20px_50px_-28px_rgba(0,0,0,0.25)] ${feature.span}`}
    >
      <div className="flex items-start justify-between">
        <motion.div
          whileHover={{ rotate: 8, scale: 1.06 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="bg-primary/15 text-primary flex size-11 items-center justify-center rounded-xl"
        >
          <feature.icon className="size-5" />
        </motion.div>
        <span className="border-border bg-muted/50 text-muted-foreground border px-2 py-0.5 text-[10px] font-medium">
          {feature.badge}
        </span>
      </div>

      <h3 className="mt-5 text-lg font-semibold tracking-tight">{feature.title}</h3>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{feature.body}</p>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(360px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), color-mix(in oklch, var(--primary) 16%, transparent), transparent 60%)',
        }}
      />
      {/* subtle border glow on hover */}
      <div
        aria-hidden
        className="via-primary/60 pointer-events-none absolute inset-x-6 -top-px h-px bg-gradient-to-r from-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      />
    </motion.article>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  const words = title.split(' ');
  return (
    <div className="mx-auto max-w-2xl text-center">
      <motion.span
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="border-primary/30 bg-primary/10 text-primary inline-flex items-center border px-3 py-1 text-xs font-semibold tracking-wider uppercase"
      >
        {eyebrow}
      </motion.span>
      <motion.h2
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
        }}
        className="mt-4 text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl"
      >
        {words.map((w, i) => (
          <span key={i} className="inline-block overflow-hidden align-bottom">
            <motion.span
              variants={{
                hidden: { y: '110%', opacity: 0 },
                visible: { y: '0%', opacity: 1 },
              }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="inline-block whitespace-pre"
            >
              {w}
              {i < words.length - 1 ? ' ' : ''}
            </motion.span>
          </span>
        ))}
      </motion.h2>
      {description && (
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.18, duration: 0.6 }}
          className="text-muted-foreground mt-4 text-base sm:text-lg"
        >
          {description}
        </motion.p>
      )}
    </div>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function BoltIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M13 3L4 14h7l-1 7 9-11h-7l1-7z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="9" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16.5" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15 20c0-2.5 2-4.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
