'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';

const FEATURES = [
  {
    title: 'End-to-end encrypted by default',
    body: 'Every submission is Seal-encrypted in the browser before it touches Walrus. Private forms also encrypt the schema itself. The key custodian is the form owner — not us, not a platform, not anyone else.',
    icon: LockIcon,
    span: 'md:col-span-2',
    badge: 'Seal',
  },
  {
    title: 'Sponsored gas, with a graceful fallback',
    body: 'A thin Enoki sponsor service covers gas for publish, submit, clone, vote, and Walrus-Site deploy on testnet and mainnet from a single key. If the sponsor is down, the connected wallet pays — same code path, no error screen.',
    icon: BoltIcon,
    span: '',
    badge: 'Enoki + wallet',
  },
  {
    title: 'Four access modes, picked at publish time',
    body: 'Public, allowlist-only Private, token-gated by Coin<T> balance, or paid in native SUI per submit. The creator treasury withdraw button is one click on the form card.',
    icon: KeyIcon,
    span: '',
    badge: 'Access control',
  },
  {
    title: 'Collaborate with on-chain reviewers',
    body: 'Add co-reviewers by address. The Move reviewers module lets them decrypt the same submissions you can — perfect for hackathon judging, hiring panels, or co-managed surveys.',
    icon: UsersIcon,
    span: '',
    badge: 'Reviewers',
  },
  {
    title: 'Brand the form without writing code',
    body: 'Card or full-page layout, eight curated web fonts across Sans / Serif / Display / Mono, eleven accent palettes, five border-radius scales, cover image uploaded to Walrus. Themes persist with the form on-chain.',
    icon: PaletteIcon,
    span: 'md:col-span-2',
    badge: 'Theme editor',
  },
  {
    title: 'AI-assisted form generation',
    body: '"Make me an NPS survey for a fintech product" — your BYOK OpenRouter key calls the model client-side and hydrates 18 supported field types onto the canvas.',
    icon: SparkleIcon,
    span: '',
    badge: 'AI SDK v6',
  },
  {
    title: 'Sign in with anything',
    body: 'Slush, Sui Wallet, any dApp-Kit wallet, or a burner Google account via Enoki zkLogin. Respondents pick what they already have.',
    icon: UsersIcon,
    span: '',
    badge: 'zkLogin',
  },
  {
    title: 'Two distribution modes, one schema',
    body: 'Default Mode A renders the form at walform.app/f/{id}. Optional Mode B pushes a static shell to Walrus with one click — the form lives at {base36}.wal.app/#/f/{id}, fully on-chain.',
    icon: ShieldIcon,
    span: '',
    badge: 'Mode A + Mode B',
  },
  {
    title: 'Multi-buyer template marketplace with on-chain voting',
    body: 'Publish a reusable schema as a TemplateListing. N buyers can clone; a 10% royalty routes to the platform on every paid clone. Voters upvote / downvote each listing on-chain — no off-chain ratings store.',
    icon: StoreIcon,
    span: 'md:col-span-2',
    badge: 'Sui Kiosk + voting',
  },
  {
    title: 'Built-in results dashboard',
    body: 'Aggregate charts per choice / rating / scale field, by-question panel, decrypt-on-demand row table, CSV export. Each submitter gets a private receipt only they can decrypt.',
    icon: ChartIcon,
    span: '',
    badge: 'Analytics',
  },
  {
    title: 'Walrus-backed cover image and file uploads',
    body: 'FILE_UPLOAD fields write the bytes to Walrus, the URL is sealed inside the encrypted submission body. Cover images upload at publish so the schema bytes stay tiny on-chain.',
    icon: UploadIcon,
    span: '',
    badge: 'Walrus storage',
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
function KeyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="8" cy="14" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M11 11l8-8M16 6l2 2M14 8l2 2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
function PaletteIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 3a9 9 0 100 18c1.5 0 2.5-1 2.5-2.5 0-1-.5-1.5-.5-2.5s.7-1.5 1.7-1.5H18a3 3 0 003-3 9 9 0 00-9-9z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="7.5" cy="11" r="1.2" fill="currentColor" />
      <circle cx="10.5" cy="7.5" r="1.2" fill="currentColor" />
      <circle cx="14.5" cy="7.5" r="1.2" fill="currentColor" />
      <circle cx="17" cy="11" r="1.2" fill="currentColor" />
    </svg>
  );
}
function StoreIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4 9l1-4h14l1 4M4 9v10h16V9M4 9h16M10 19v-5h4v5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ChartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="6" y="11" width="3" height="7" stroke="currentColor" strokeWidth="1.8" />
      <rect x="11" y="7" width="3" height="11" stroke="currentColor" strokeWidth="1.8" />
      <rect x="16" y="13" width="3" height="5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function UploadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 16V4M7 9l5-5 5 5M4 20h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
