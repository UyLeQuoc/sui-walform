import { Navbar } from './navbar';
import { Hero } from './hero';
import { LogoStrip } from './logo-strip';
import { Marquee } from './marquee';
import { Features } from './features';
import { HowItWorks } from './how-it-works';
import { UseCases } from './use-cases';
import { Stats } from './stats';
import { Creators } from './creators';
import { Cta } from './cta';
import { Footer } from './footer';
import { ScrollProgress } from './scroll-progress';

export function LandingPage() {
  return (
    <main className="bg-background text-foreground relative min-h-screen overflow-x-clip">
      <ScrollProgress />
      <Navbar />
      <Hero />
      <LogoStrip />
      <Marquee />
      <Features />
      <HowItWorks />
      <UseCases />
      <Stats />
      <Creators />
      <Cta />
      <Footer />
    </main>
  );
}
