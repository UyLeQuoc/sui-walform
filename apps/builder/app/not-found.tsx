import Link from 'next/link';
import { FileX } from 'lucide-react';
import { Button } from '@walform/core/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 text-center">
      <div className="bg-muted rounded-full p-5">
        <FileX className="text-muted-foreground h-10 w-10" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
      </div>
      <Button asChild>
        <Link href="/forms">Back to forms</Link>
      </Button>
    </div>
  );
}
