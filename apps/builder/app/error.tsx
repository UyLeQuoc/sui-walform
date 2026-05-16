'use client';

import { useEffect } from 'react';
import { Button } from '@walform/core/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground mt-2 max-w-md text-sm">
          {error.message || 'An unexpected error occurred.'}
        </p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
