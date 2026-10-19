import Link from 'next/link';
import Image from 'next/image';
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  MessageCircle,
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8 pb-12 border-b border-ds-border/60">
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

            {/* Social Links */}
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="w-9 h-9 rounded-lg bg-ds-surface border border-ds-border flex items-center justify-center text-ds-text-muted hover:text-ds-accent hover:border-ds-accent/40 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
                </svg>
              </a>
              <a
                href="https://wa.me/919876543210"
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp"
                className="w-9 h-9 rounded-lg bg-ds-surface border border-ds-border flex items-center justify-center text-ds-text-muted hover:text-emerald-400 hover:border-emerald-500/40 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
                className="w-9 h-9 rounded-lg bg-ds-surface border border-ds-border flex items-center justify-center text-ds-text-muted hover:text-rose-400 hover:border-rose-500/40 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/>
                  <polygon points="10 15 15 12 10 9 10 15" fill="currentColor"/>
                </svg>
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Twitter / X"
                className="w-9 h-9 rounded-lg bg-ds-surface border border-ds-border flex items-center justify-center text-ds-text-muted hover:text-ds-ice hover:border-ds-ice/40 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4l11.733 16h4.267l-11.733 -16z"/>
                  <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"/>
                </svg>
              </a>
            </div>
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

          {/* Col 4: Operating Hours & Location */}
          <div>
            <h4 className="font-heading font-bold text-sm uppercase tracking-wider text-ds-text mb-4">
              Arena Hours & Info
            </h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2 text-ds-text-muted">
                <Clock className="w-4 h-4 text-ds-accent mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-ds-text">Monday – Sunday</p>
                  <p className="text-xs">10:00 AM – 12:00 AM Midnight</p>
                </div>
              </li>
              <li className="flex items-start gap-2 text-ds-text-muted">
                <MapPin className="w-4 h-4 text-ds-accent mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-ds-text">Dark Syndicate Arena</p>
                  <p className="text-xs">Main Commercial Hub, Ground Floor</p>
                </div>
              </li>
              <li className="flex items-center gap-2 text-ds-text-muted">
                <Phone className="w-4 h-4 text-ds-accent shrink-0" />
                <a href="tel:+919876543210" className="hover:text-ds-ice text-xs">
                  +91 98765 43210
                </a>
              </li>
              <li className="flex items-center gap-2 text-ds-text-muted">
                <Mail className="w-4 h-4 text-ds-accent shrink-0" />
                <a href="mailto:support@darksyndicate.com" className="hover:text-ds-ice text-xs">
                  support@darksyndicate.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ds-text-dim">
          <p>© {currentYear} DARK SYNDICATE GAMING WORLD. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/contact" className="hover:text-ds-text-muted transition-colors">
              Rules & Code of Conduct
            </Link>
            <Link href="/pricing" className="hover:text-ds-text-muted transition-colors">
              Cancellation & Refund Policy
            </Link>
            <Link href="/contact" className="hover:text-ds-text-muted transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
