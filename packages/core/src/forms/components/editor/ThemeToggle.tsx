/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@teispace/next-themes';
import { useEffect, useState } from 'react';
import { Button } from '../../../ui/button';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="size-9" />;

  const isDark = resolvedTheme === 'dark';

  return (
    <Button variant="outline" size="icon" onClick={() => setTheme(isDark ? 'light' : 'dark')}>
      {isDark ? <Sun /> : <Moon />}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
