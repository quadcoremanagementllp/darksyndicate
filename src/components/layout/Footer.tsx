import Link from 'next/link';
import Image from 'next/image';
import {
  MapPin,
  Gamepad2,
  Shield,
  FileText,
  Sparkles,
} from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative bg-ds-dark border-t border-ds-border overflow-hidden">
      {/* Subtle ambient light */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-24 bg-ds-accent/5 blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-28 lg:pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-10 lg:gap-8 pb-12 border-b border-ds-border/60">
          {/* Col 1: Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-ds-accent/30 p-0.5 bg-ds-surface shadow-glow">
                <Image
                  src="/logo.png"
                  alt="DARK SYNDICATE GAMING WORLD"
                  width={48}
                  height={48}
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <span className="font-heading font-extrabold text-xl tracking-wider text-ds-text block leading-tight">
                  DARK <span className="gradient-text">SYNDICATE</span>
                </span>
                <span className="font-heading font-semibold text-xs text-ds-accent tracking-[0.2em] uppercase">
                  Gaming World
                </span>
              </div>
            </Link>

            <p className="font-heading font-bold text-ds-ice tracking-wider text-sm mt-2">
              ENTER THE GAME. OWN THE NIGHT.
            </p>

            <p className="text-ds-text-muted text-sm leading-relaxed max-w-sm">
              The ultimate gaming destination featuring premium PlayStation 5 Pro consoles, tournament-grade pool tables, and an electric esports arena atmosphere.
            </p>

          </div>

          {/* Col 2: Gaming World */}
          <div>
            <h4 className="font-heading font-bold text-sm uppercase tracking-wider text-ds-text mb-4">
              Gaming World
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  href="/booking"
                  className="text-ds-text-muted hover:text-ds-ice transition-colors flex items-center gap-1.5"
                >
                  <Gamepad2 className="w-3.5 h-3.5 text-ds-accent" />
                  <span>PS5 Pro Battle Stations</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/booking"
                  className="text-ds-text-muted hover:text-ds-ice transition-colors flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-ds-ice" />
                  <span>Snooker & Billiards Lounge</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="text-ds-text-muted hover:text-ds-ice transition-colors flex items-center gap-1.5"
                >
                  <Shield className="w-3.5 h-3.5 text-ds-primary-light" />
                  <span>Tariff & Pricing Card</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/membership"
                  className="text-ds-text-muted hover:text-ds-ice transition-colors"
                >
                  Syndicate Member Passes
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Quick Links */}
          <div>
            <h4 className="font-heading font-bold text-sm uppercase tracking-wider text-ds-text mb-4">
              Navigation
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/booking" className="text-ds-text-muted hover:text-ds-ice transition-colors">
                  Book A Session
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-ds-text-muted hover:text-ds-ice transition-colors">
                  Pricing & Passes
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-ds-text-muted hover:text-ds-ice transition-colors">
                  Location & Contact
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-ds-text-muted hover:text-ds-ice transition-colors">
                  Customer Sign In
                </Link>
              </li>
              <li>
                <Link href="/register" className="text-ds-text-muted hover:text-ds-ice transition-colors">
                  Join The Syndicate
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Help and policies */}
          <div>
            <h4 className="font-heading font-bold text-sm uppercase tracking-wider text-ds-text mb-4">Help</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/contact" className="text-ds-text-muted hover:text-ds-ice transition-colors">Contact us</Link></li>
              <li><Link href="/shipping-policy" className="text-ds-text-muted hover:text-ds-ice transition-colors">Shipping policy</Link></li>
              <li><Link href="/terms-and-conditions" className="text-ds-text-muted hover:text-ds-ice transition-colors">Terms and conditions</Link></li>
              <li><Link href="/privacy-policy" className="text-ds-text-muted hover:text-ds-ice transition-colors">Privacy policy</Link></li>
              <li><Link href="/cancellation-and-refund-policy" className="text-ds-text-muted hover:text-ds-ice transition-colors">Cancellation and refund policy</Link></li>
            </ul>
          </div>

          {/* Col 5: Venue and support */}
          <div>
            <h4 className="font-heading font-bold text-sm uppercase tracking-wider text-ds-text mb-4">
              Visit & Support
            </h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2 text-ds-text-muted">
                <MapPin className="w-4 h-4 text-ds-accent mt-0.5 shrink-0" />
                <a href="https://maps.app.goo.gl/PFuypQdnfK9Zc5wSA?g_st=iw" target="_blank" rel="noopener noreferrer" className="hover:text-ds-ice">Find us on Google Maps</a>
              </li>
              <li className="text-ds-text-muted">
                <Link href="/contact" className="hover:text-ds-ice">Contact the venue</Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ds-text-dim">
          <p>© {currentYear} DARK SYNDICATE GAMING WORLD. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <Link href="/terms-and-conditions" className="hover:text-ds-text-muted transition-colors">
              Terms and Conditions
            </Link>
            <Link href="/cancellation-and-refund-policy" className="hover:text-ds-text-muted transition-colors">
              Cancellation & Refund Policy
            </Link>
            <Link href="/privacy-policy" className="hover:text-ds-text-muted transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
