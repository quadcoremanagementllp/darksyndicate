'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Receipt, Sparkles, User, LogIn, Calendar } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export function MobileBottomBar() {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();

  // Hide on admin or staff backends, booking flow, and authentication pages
  if (
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/staff') ||
    pathname?.startsWith('/booking') ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password'
  ) {
    return null;
  }

  const isCurrent = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  return (
    <aside
      aria-label="Mobile Navigation Dock"
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden pointer-events-auto"
    >
      {/* Top Cyber Accent Glow Border */}
      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-ds-accent/60 to-transparent" />

      {/* Main Glassmorphic Dock */}
      <div className="bg-ds-dark/95 backdrop-blur-2xl border-t border-ds-border/80 px-3 py-2 sm:px-6 shadow-[0_-10px_25px_rgba(0,0,0,0.7)]">
        <div className="max-w-md mx-auto flex items-center justify-between gap-2">
          {/* Sign In / Account Link */}
          {isAuthenticated && user ? (
            <Link
              href="/account"
              className={`flex-1 flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
                isCurrent('/account')
                  ? 'bg-ds-accent/15 text-ds-ice border border-ds-accent/30'
                  : 'text-ds-text-muted hover:text-ds-text hover:bg-ds-surface/60'
              }`}
            >
              <div className="relative">
                <div className="w-5 h-5 rounded-full bg-ds-accent/20 border border-ds-accent flex items-center justify-center text-[10px] font-heading font-black text-ds-ice">
                  {user.firstName ? user.firstName[0].toUpperCase() : 'U'}
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-2 ring-ds-dark" />
              </div>
              <span className="text-[11px] font-heading font-bold uppercase tracking-wider mt-0.5 max-w-[70px] truncate">
                {user.firstName || 'Account'}
              </span>
            </Link>
          ) : (
            <Link
              href="/login"
              className={`flex-1 flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
                isCurrent('/login')
                  ? 'bg-ds-accent/15 text-ds-ice border border-ds-accent/30'
                  : 'text-ds-text-muted hover:text-ds-text hover:bg-ds-surface/60'
              }`}
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <LogIn className="w-4 h-4 text-ds-accent" />
              </div>
              <span className="text-[11px] font-heading font-bold uppercase tracking-wider mt-0.5">
                Sign In
              </span>
            </Link>
          )}

          {/* Quick Pricing Navigation */}
          <Link
            href="/pricing"
            className={`flex-1 flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
              isCurrent('/pricing')
                ? 'bg-ds-accent/15 text-ds-ice border border-ds-accent/30'
                : 'text-ds-text-muted hover:text-ds-text hover:bg-ds-surface/60'
            }`}
          >
            <div className="w-5 h-5 flex items-center justify-center">
              <Receipt className="w-4 h-4 text-ds-ice" />
            </div>
            <span className="text-[11px] font-heading font-bold uppercase tracking-wider mt-0.5">
              Pricing
            </span>
          </Link>

          {/* Primary Action: Book Now Button */}
          <div className="flex-[1.4] pl-1">
            <Link
              href="/booking"
              prefetch={true}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-ds-accent via-cyan-400 to-ds-ice text-ds-dark font-heading font-extrabold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(0,240,255,0.4)] active:scale-[0.98] transition-all hover:shadow-[0_0_20px_rgba(0,240,255,0.6)]"
            >
              <Sparkles className="w-3.5 h-3.5 animate-pulse shrink-0 fill-ds-dark" />
              <span className="truncate">Book Now</span>
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default MobileBottomBar;
