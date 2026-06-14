'use client';

import { motion } from 'framer-motion';
import { SectionHeader } from './features';

const CASES = [
  {
    title: 'Branded customer survey on your own URL',
    body: 'Publish the form, click "Deploy to Walrus Site", link a SuiNS name. Share <your-brand>.wal.app — no formId in the URL, no platform, no hosting bill.',
    tag: 'Walrus Sites · SuiNS',
  },
  {
    title: 'DAO governance survey',
    body: 'Token-gated by Coin<T> balance. Members sign + pay gas from their own wallet, you decrypt everything, each voter keeps a receipt only they can read.',
    tag: 'Encrypted · Token-gated',
  },
  {
    title: 'Hackathon submissions with co-judges',
    body: 'Collect files to Walrus, add co-reviewers by address from the Manage tab. Every judge decrypts the same submissions; participants get a private receipt only they can read.',
    tag: 'Reviewers · File uploads',
  },
  {
    title: 'Pseudonymous tip line',
    body: 'Burner Google via Enoki zkLogin produces a fresh Sui address per respondent. Signed, rate-limited, but not tied to real identity.',
    tag: 'zkLogin · Private',
  },
  {
    title: 'Token-gated RSVP',
    body: 'NFT-holder-only events. Optional native SUI payment per RSVP. No credit cards, no Stripe, no custodians.',
    tag: 'NFT gate · Payments',
  },
  {
    title: 'Template marketplace',
    body: 'Publish a reusable form as a TemplateListing. Buyers can preview, then "Buy & edit" — the schema lands in their Drafts, they edit before publish. 10% royalty routes to you on every paid clone, free clones are free.',
    tag: 'Multi-buyer · Royalties',
  },
];

export function UseCases() {
  return (
    <section id="use-cases" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader
          eyebrow="Built for"
          title="Six real shapes. One primitive."
          description="A form is a Sui object. A submission is a Seal-encrypted blob. A site is a Walrus blob. Everything composes."
        />

        <div className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CASES.map((c, i) => (
            <motion.article
              key={c.title}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: (i % 3) * 0.08, duration: 0.55 }}
              className="group border-border/70 bg-card relative flex flex-col overflow-hidden rounded-2xl border p-6"
            >
              <div
                aria-hidden
                className="via-primary/50 absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              />
              <span className="bg-primary/10 text-primary inline-flex w-fit px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase">
                {c.tag}
              </span>
              <h3 className="mt-4 text-lg font-semibold tracking-tight">{c.title}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{c.body}</p>
              <div className="text-primary mt-5 flex items-center gap-1 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
                See example
                <svg viewBox="0 0 16 16" fill="none" className="size-3.5" aria-hidden>
                  <path
                    d="M3 8h10m0 0L9 4m4 4L9 12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
