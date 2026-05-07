'use client';

import { motion, useScroll, useSpring } from 'framer-motion';

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 24,
    mass: 0.3,
  });

  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="from-primary to-primary fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-gradient-to-r via-[color-mix(in_oklch,var(--primary)_60%,white)]"
    />
  );
}
