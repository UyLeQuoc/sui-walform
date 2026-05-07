'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

const STATS = [
  { value: 100, suffix: '%', label: 'Submissions encrypted' },
  { value: 0, suffix: ' SUI', label: 'Respondent pays' },
  { value: 15, suffix: '+', label: 'Question block types' },
  { value: 10, suffix: '%', label: 'Royalty on paid templates' },
];

export function Stats() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const nums = gsap.utils.toArray<HTMLElement>('[data-stat]');
      nums.forEach((el) => {
        const target = Number(el.dataset.target ?? '0');
        const obj = { n: 0 };
        gsap.to(obj, {
          n: target,
          duration: 1.6,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            once: true,
          },
          onUpdate: () => {
            el.textContent = Math.round(obj.n).toString();
          },
        });
      });
    },
    { scope: root },
  );

  return (
    <section className="relative py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div
          ref={root}
          className="border-border/70 from-card to-muted/40 grid grid-cols-2 gap-4 rounded-3xl border bg-gradient-to-br p-6 sm:p-10 md:grid-cols-4"
        >
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-foreground flex items-baseline justify-center gap-0.5 text-5xl font-semibold tracking-tight sm:text-6xl">
                <span data-stat data-target={s.value} className="text-primary tabular-nums">
                  0
                </span>
                <span className="text-primary">{s.suffix}</span>
              </div>
              <p className="text-muted-foreground mt-2 text-sm font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
