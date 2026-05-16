import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@walform/core/lib/utils";
import { Toaster } from "@walform/core/ui/sonner";
import { Providers } from "@walform/core/ui/providers";

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
    <html lang="en" suppressHydrationWarning className={cn("h-full", "antialiased", "font-sans")}>
      <body className="flex min-h-full flex-col">
        <Providers>
          {children}
          <Toaster richColors position="bottom-right" />
        </Providers>
      </body>
    </html>
  );
}
