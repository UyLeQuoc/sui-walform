import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center px-6">
      <div className="bg-card w-full max-w-md rounded-xl border p-6 text-center shadow-lg">
        <p className="text-base font-semibold">Not found</p>
        <p className="text-muted-foreground mt-2 text-sm">
          The page or form you’re looking for doesn’t exist or has been removed.
        </p>
        <Link
          to="/"
          className="text-primary mt-4 inline-block text-sm font-medium underline-offset-4 hover:underline"
        >
          Back to WalForm
        </Link>
      </div>
    </div>
  );
}
