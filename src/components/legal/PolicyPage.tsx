import Link from 'next/link';
import type { ReactNode } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

const helpLinks = [
  { label: 'Contact us', href: '/contact' },
  { label: 'Shipping policy', href: '/shipping-policy' },
  { label: 'Terms and conditions', href: '/terms-and-conditions' },
  { label: 'Privacy policy', href: '/privacy-policy' },
  { label: 'Cancellation and refund policy', href: '/cancellation-and-refund-policy' },
];

export function PolicyPage({ title, description, currentPath, children }: {
  title: string;
  description: string;
  currentPath: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ds-dark text-ds-text flex flex-col">
      <Navbar />
      <main className="flex-1 pt-32 sm:pt-36 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mb-10">
            <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-ds-accent">Customer help</p>
            <h1 className="mt-3 text-3xl sm:text-4xl font-heading font-black uppercase text-ds-text">{title}</h1>
            <p className="mt-3 text-sm sm:text-base text-ds-text-muted leading-relaxed">{description}</p>
            <p className="mt-3 text-xs text-ds-text-dim font-mono">Last updated: 25 October 2026</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-8 lg:gap-12 items-start">
            <nav aria-label="Customer help pages" className="rounded-2xl border border-ds-border bg-ds-surface/50 p-4 lg:sticky lg:top-28">
              <h2 className="font-heading font-bold uppercase tracking-wider text-sm text-ds-text px-3 mb-2">Help</h2>
              <ul className="space-y-1">
                {helpLinks.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={currentPath === item.href ? 'page' : undefined}
                      className={`block rounded-lg px-3 py-2 text-sm transition-colors ${currentPath === item.href ? 'bg-ds-accent/15 text-ds-ice font-semibold' : 'text-ds-text-muted hover:bg-ds-surface hover:text-ds-text'}`}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <article className="rounded-2xl border border-ds-border bg-ds-surface/40 p-6 sm:p-8 lg:p-10 space-y-8 text-sm text-ds-text-muted leading-relaxed">
              {children}
              <div className="border-t border-ds-border pt-6">
                <h2 className="text-lg font-heading font-bold text-ds-text">Need help?</h2>
                <p className="mt-2">Contact us with your booking reference or payment ID so we can find your transaction.</p>
                <Link href="/contact" className="inline-flex mt-3 text-ds-ice font-semibold hover:underline">Go to contact us</Link>
              </div>
            </article>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg sm:text-xl font-heading font-bold text-ds-text">{title}</h2>
      {children}
    </section>
  );
}
