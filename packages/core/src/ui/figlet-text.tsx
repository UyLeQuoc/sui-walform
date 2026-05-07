'use client';

import figlet from 'figlet';
import ansiShadow from 'figlet/importable-fonts/ANSI Shadow.js';
import { useEffect, useState } from 'react';
import { cn } from '../lib/utils';

type Fonts = NonNullable<NonNullable<Parameters<typeof figlet.textSync>[1]>['font']>;

interface Props {
  font?: Fonts;
  className?: string;
  children?: React.ReactNode;
}

const loaded = new Set<string>();

function ensureFont(font: Fonts) {
  if (loaded.has(font)) return;
  if (font === 'ANSI Shadow') {
    figlet.parseFont('ANSI Shadow', ansiShadow as unknown as string);
    loaded.add(font);
  }
}

export default function FigletText({ children, font = 'ANSI Shadow', className }: Props) {
  const text = typeof children === 'string' ? children : '';
  const [ascii, setAscii] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      ensureFont(font);
      return figlet.textSync(text, { font });
    } catch {
      return '';
    }
  });

  useEffect(() => {
    try {
      ensureFont(font);
      setAscii(figlet.textSync(text, { font }));
    } catch {
      setAscii('');
    }
  }, [text, font]);

  return (
    <pre className={cn('text-primary font-mono text-xs leading-tight whitespace-pre', className)}>
      {ascii}
    </pre>
  );
}
