import type { Metadata } from "next";
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
} from "next/font/google";
import "./globals.css";
import { cn } from "@walform/core/lib/utils";
import { Toaster } from "@walform/core/ui/sonner";
import { Providers } from "@walform/core/ui/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const roboto = Roboto({
  variable: "--font-form-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});
const spaceGrotesk = Space_Grotesk({
  variable: "--font-form-space-grotesk",
  subsets: ["latin"],
});
const lora = Lora({ variable: "--font-form-lora", subsets: ["latin"] });
const merriweather = Merriweather({
  variable: "--font-form-merriweather",
  subsets: ["latin"],
  weight: ["400", "700"],
});
const playfair = Playfair_Display({
  variable: "--font-form-playfair",
  subsets: ["latin"],
});
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-form-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WalForm",
  description: "Decentralized form on Walrus + Sui",
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
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
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
