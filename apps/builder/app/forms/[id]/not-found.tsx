import Link from 'next/link';
import { FileX } from 'lucide-react';
import { Button } from '@walform/core/ui/button';

export default function FormNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 text-center">
      <div className="bg-muted rounded-full p-5">
        <FileX className="text-muted-foreground h-10 w-10" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold">Form not found</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          This form doesn&apos;t exist or may have been deleted.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Back to forms</Link>
      </Button>
    </div>
  );
}
