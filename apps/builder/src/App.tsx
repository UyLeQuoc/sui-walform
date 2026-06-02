import { RouterProvider } from 'react-router-dom';
import { Providers } from '@walform/core/ui/providers';
import { Toaster } from '@walform/core/ui/sonner';
import { router } from './router';

export function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
      <Toaster richColors position="bottom-right" />
    </Providers>
  );
}
