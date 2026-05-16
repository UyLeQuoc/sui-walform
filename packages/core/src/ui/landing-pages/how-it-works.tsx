'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { SectionHeader } from './features';

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  {
    k: '01',
    title: 'Design',
    body: 'Drag-and-drop blocks on a Notion-style canvas. Add logic, limits, and access control — paid, token-gated, or allowlisted.',
    tag: 'Builder',
  },
  {
    k: '02',
    title: 'Publish',
    body: 'Schema is stored inline in a Sui object. Optionally deploy to a Walrus Site and attach a SuiNS name for {name}.wal.app.',
    tag: 'Sui + Walrus',
  },
  {
    k: '03',
    title: 'Collect',
    body: 'Respondents sign in with any Sui wallet or zkLogin. Submissions are Seal-encrypted client-side. Gas is sponsored by our Enoki key on testnet + mainnet, with a clean fallback to wallet-paid if the sponsor route is unavailable.',
    tag: 'Seal + Sponsored gas',
  },
  {
    k: '04',
    title: 'Decrypt',
    body: 'Only you (and each submitter for their own receipt) hold the key. Results decrypt in your browser — nothing we can read.',
    tag: 'Seal policy',
  },
];

export function HowItWorks() {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!track.current || !root.current) return;
      const cards = gsap.utils.toArray<HTMLElement>('[data-step]');

      gsap.fromTo(
        progress.current,
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: track.current,
            start: 'top 60%',
            end: 'bottom 70%',
            scrub: 0.5,
          },
        },
      );

      cards.forEach((card) => {
        gsap.fromTo(
          card,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 80%',
              toggleActions: 'play none none reverse',
            },
          },
        );
      });
    },
    { scope: root },
  );

  return (
    <section id="how" ref={root} className="bg-muted/30 relative overflow-hidden py-24 sm:py-32">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            'linear-gradient(to right, transparent, color-mix(in oklch, var(--primary) 40%, transparent), transparent)',
        }}
      />

      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader
          eyebrow="How it works"
          title="From blank canvas to encrypted receipts — in four steps."
          description="The full flow, from builder to on-chain submission, stays under two minutes."
        />

        <div ref={track} className="relative mt-20">
          {/* timeline rail */}
          <div
            aria-hidden
            className="bg-border absolute top-2 bottom-2 left-5 w-px sm:left-1/2 sm:-translate-x-1/2"
          />
          <div
            aria-hidden
            ref={progress}
            className="bg-primary absolute top-2 bottom-2 left-5 w-px origin-top sm:left-1/2 sm:-translate-x-1/2"
            style={{ transform: 'scaleY(0)' }}
          />

          <div className="space-y-10 sm:space-y-24">
            {STEPS.map((s, i) => (
              <div
                key={s.k}
                data-step
                className={`relative flex flex-col gap-4 pl-14 sm:pl-0 ${
                  i % 2 === 0 ? 'sm:flex-row' : 'sm:flex-row-reverse'
                }`}
              >
                {/* node */}
                <span className="border-primary bg-background absolute top-2 left-5 size-3 -translate-x-1/2 rounded-full border-2 sm:left-1/2" />

                <div className={`sm:w-1/2 ${i % 2 === 0 ? 'sm:pr-16' : 'sm:pl-16'}`}>
                  <div className="border-border bg-background text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold">
                    <span className="text-primary">{s.k}</span>
                    <span className="bg-border h-3 w-px" />
                    {s.tag}
                  </div>
                  <h3 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                    {s.title}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-base">{s.body}</p>
                </div>
                <div className="hidden sm:block sm:w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
