import { Link } from 'react-router-dom';
import { Logo } from '../logo';

const GROUPS = [
  {
    title: 'Product',
    links: [
      { label: 'Builder', href: '/forms' },
      { label: 'Templates', href: '#cta' },
      { label: 'Pricing', href: '#' },
      { label: 'Changelog', href: '#' },
    ],
  },
  {
    title: 'Stack',
    links: [
      { label: 'Sui', href: 'https://sui.io' },
      { label: 'Walrus', href: 'https://walrus.xyz' },
      { label: 'Seal', href: 'https://seal.mystenlabs.com' },
      { label: 'Enoki', href: 'https://enoki.mystenlabs.com' },
    ],
  },
  {
    title: 'Project',
    links: [
      { label: 'Docs', href: '#' },
      { label: 'GitHub', href: 'https://github.com' },
      { label: 'Walrus Session 2', href: 'https://www.walrus.xyz' },
      { label: 'Roadmap', href: '#' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-border/70 bg-muted/20 border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Link to="/" className="flex items-center gap-2">
            <Logo variant="primary" className="size-7" />
            <span className="text-base font-semibold tracking-tight">WalForm</span>
          </Link>
          <p className="text-muted-foreground max-w-xs text-sm">
            Build forms that can&apos;t be taken down. Own the data. Encrypt by default.
          </p>
          <p className="text-muted-foreground text-xs">
            Built on Sui + Walrus mainnet for Walrus Session 2.
          </p>
        </div>

        {GROUPS.map((g) => (
          <div key={g.title}>
            <p className="text-foreground text-xs font-semibold tracking-wider uppercase">
              {g.title}
            </p>
            <ul className="mt-4 space-y-2.5">
              {g.links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-border/70 border-t">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-xs sm:flex-row">
          <p>© {new Date().getFullYear()} WalForm. MIT licensed.</p>
          <p>
            <span className="inline-flex items-center gap-1.5">
              <span className="bg-primary size-1.5 rounded-full" /> All systems decentralized
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
