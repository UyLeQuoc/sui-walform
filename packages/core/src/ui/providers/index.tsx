import { ThemeProvider } from './theme-provider';
import { SuiProviders } from '../../sui/providers';

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SuiProviders>{children}</SuiProviders>
    </ThemeProvider>
  );
};
