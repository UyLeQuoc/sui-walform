import type { Metadata } from 'next';
import {
  Geist,
  Geist_Mono,
  Inter,
  JetBrains_Mono,
  Lora,
  Merriweather,
  Playfair_Display,
  Roboto,
  Space_Grotesk,
} from 'next/font/google';
import './globals.css';
import { cn } from '@walform/core/lib/utils';
import { Toaster } from '@walform/core/ui/sonner';
import { Providers } from '@walform/core/ui/providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Form-level fonts — exposed as CSS variables and switched at runtime via
// FormSettings.fontFamily. See src/lib/form-fonts.ts for the user-facing list.
const roboto = Roboto({
  variable: '--font-form-roboto',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});

const spaceGrotesk = Space_Grotesk({
  variable: '--font-form-space-grotesk',
  subsets: ['latin'],
});

const lora = Lora({
  variable: '--font-form-lora',
  subsets: ['latin'],
});

const merriweather = Merriweather({
  variable: '--font-form-merriweather',
  subsets: ['latin'],
  weight: ['400', '700'],
});

const playfair = Playfair_Display({
  variable: '--font-form-playfair',
  subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-form-jetbrains-mono',
  subsets: ['latin'],
});

const SITE_URL = 'https://walform.wal.app';
const SITE_TITLE = 'WalForm — Decentralized form builder on Walrus';
const SITE_DESCRIPTION =
  'End-to-end encrypted forms on Sui + Walrus. Publish your form to its own Walrus Site straight from the browser — same as Walgo, with zero platform fee.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: '%s · WalForm',
  },
  description: SITE_DESCRIPTION,
  applicationName: 'WalForm',
  keywords: [
    'Walrus',
    'Sui',
    'Seal',
    'forms',
    'survey',
    'decentralized',
    'Walrus Sites',
    'SuiNS',
    'zero platform fee',
  ],
  openGraph: {
    type: 'website',
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: 'WalForm',
    images: [
      {
        url: '/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'WalForm — decentralized form builder on Walrus',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/images/og-image.png'],
  },
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        'h-full',
        'antialiased',
        geistSans.variable,
        geistMono.variable,
        'font-sans',
        inter.variable,
        roboto.variable,
        spaceGrotesk.variable,
        lora.variable,
        merriweather.variable,
        playfair.variable,
        jetbrainsMono.variable,
      )}
    >
      <body className="flex min-h-full flex-col">
        <Providers>
          {children}
          <Toaster richColors position="bottom-right" />
        </Providers>
      </body>
    </html>
  );
}
