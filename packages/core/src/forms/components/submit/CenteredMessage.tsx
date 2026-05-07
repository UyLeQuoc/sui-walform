'use client';

import { Send } from 'lucide-react';

interface CenteredMessageProps {
  title: string;
  description: string;
}

/**
 * Full-screen "form unavailable" card used by the submit page for terminal
 * states: form not found, closed, schema unparseable, etc.
 */
export function CenteredMessage({ title, description }: CenteredMessageProps) {
  return (
    <div className="bg-secondary/40 flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="bg-card flex max-w-md flex-col items-center gap-3 rounded-xl border p-8 text-center shadow-xl">
        <div className="bg-muted rounded-full p-3">
          <Send className="text-muted-foreground h-5 w-5" />
        </div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
    </div>
  );
}
