'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const PHRASES = [
  "can't be taken down.",
  'encrypt by default.',
  'live on Walrus.',
  'never lock you in.',
  'respect respondents.',
];

const ROTATE_MS = 2800;

export function AnimatedHeadline() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % PHRASES.length), ROTATE_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <h1 className="max-w-5xl text-5xl leading-[1.02] font-semibold tracking-tight text-balance sm:text-6xl md:text-7xl">
      {/* Line 1: static */}
      <StaticLine text="Forms that" delay={0} />

      {/* Line 2: cycling */}
      <span className="text-primary relative mt-1 block">
        {/* height placeholder to prevent jump — uses the longest phrase */}
        <span aria-hidden className="invisible block whitespace-nowrap">
          {PHRASES.reduce((a, b) => (a.length > b.length ? a : b))}
        </span>

        <span className="absolute inset-0 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.span
              key={PHRASES[index]}
              className="inline-flex whitespace-nowrap"
              aria-live="polite"
            >
              {Array.from(PHRASES[index] ?? '').map((char, i) => (
                <motion.span
                  key={`${index}-${i}`}
                  initial={{ y: '100%', opacity: 0, filter: 'blur(8px)' }}
                  animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                  exit={{
                    y: '-100%',
                    opacity: 0,
                    filter: 'blur(10px)',
                    transition: {
                      delay: i * 0.012,
                      duration: 0.35,
                      ease: [0.7, 0, 0.84, 0],
                    },
                  }}
                  transition={{
                    delay: i * 0.022,
                    duration: 0.55,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="inline-block whitespace-pre"
                >
                  {char === ' ' ? ' ' : char}
                </motion.span>
              ))}
              {/* Blinking caret */}
              <motion.span
                aria-hidden
                animate={{ opacity: [1, 1, 0, 0] }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: 'linear',
                  times: [0, 0.5, 0.5, 1],
                }}
                className="bg-primary ml-1 inline-block h-[0.85em] w-[3px] translate-y-1 rounded-sm align-middle"
              />
            </motion.span>
          </AnimatePresence>
        </span>
      </span>

      {/* Line 3: gradient
      <span className="mt-2 block overflow-hidden">
        <motion.span
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{
            delay: 0.5,
            duration: 0.9,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="from-primary inline-block bg-gradient-to-br via-[color-mix(in_oklch,var(--primary)_70%,black)] to-[color-mix(in_oklch,var(--primary)_60%,black)] bg-clip-text text-transparent"
        >
          Own the data.
        </motion.span>
      </span> */}

      {/* Progress pips */}
      <div className="mt-6 flex justify-center gap-1.5">
        {PHRASES.map((_, i) => (
          <span key={i} className="bg-border relative h-1 w-8 overflow-hidden rounded-full">
            {i === index && (
              <motion.span
                layoutId="phrase-progress"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{
                  duration: ROTATE_MS / 1000,
                  ease: 'linear',
                }}
                className="bg-primary absolute inset-0 origin-left"
              />
            )}
          </span>
        ))}
      </div>
    </h1>
  );
}

function StaticLine({ text, delay }: { text: string; delay: number }) {
  return (
    <span className="block overflow-hidden">
      <motion.span
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{
          delay,
          duration: 0.85,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="inline-block"
      >
        {text}
      </motion.span>
    </span>
  );
}
