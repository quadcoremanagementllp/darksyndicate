'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Menu,
  X,
  User,
  Calendar,
  CreditCard,
  LogOut,
  Gamepad2,
  ChevronRight,
  Shield,
  Sparkles,
  ArrowUpRight,
  Bell,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { NotificationBell } from '@/components/shared/NotificationBell';

export default function AccountLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [loading, isAuthenticated, pathname, router]);

  // Close mobile drawer on route changes
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const navItems = [
    { name: 'Dashboard Overview', shortName: 'Overview', href: '/account', icon: Gamepad2 },
    { name: 'Syndicate Member Pass', shortName: 'Member Pass', href: '/account/membership', icon: Shield },
    { name: 'My Bookings & QR', shortName: 'Bookings & QR', href: '/account/bookings', icon: Calendar },
    { name: 'Notifications & Alerts', shortName: 'Alerts', href: '/account/notifications', icon: Bell },
    { name: 'Profile & Security', shortName: 'Profile', href: '/account/profile', icon: User },
    { name: 'Payment History', shortName: 'Payments', href: '/account/payments', icon: CreditCard },
  ];

  const isActive = (href: string) => {
    if (href === '/account') return pathname === '/account';
    return pathname.startsWith(href);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ds-dark flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-ds-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ds-dark text-ds-text selection:bg-ds-accent selection:text-ds-dark flex flex-col">
      {/* ─── Mobile Slide-Over Backdrop ─── */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 lg:hidden animate-fade-in"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* ─── Mobile Slide-Over Left Sidebar Drawer ─── */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-ds-dark/98 border-r border-ds-border flex flex-col justify-between lg:hidden transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0 shadow-2xl shadow-cyan-500/10' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full justify-between overflow-y-auto">
          {/* Drawer User Card Header */}
          <div>
            <div className="p-4 border-b border-ds-border flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ds-primary to-ds-accent flex items-center justify-center text-sm font-heading font-extrabold text-ds-text shadow-glow-sm shrink-0">
                  {user?.firstName ? user.firstName[0].toUpperCase() : 'P'}
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] font-mono tracking-widest text-ds-accent uppercase block font-bold">
                    PLAYER PORTAL
                  </span>
                  <p className="font-heading font-black text-sm text-ds-text truncate leading-tight">
                    {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Player'}
                  </p>
                  <p className="text-[10px] text-ds-text-dim truncate mt-0.5">{user?.email}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="p-1.5 rounded-lg text-ds-text-dim hover:text-rose-400 hover:bg-ds-surface transition-all shrink-0 ml-1"
                aria-label="Close sidebar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation List in Left Sidebar */}
            <nav className="p-3 space-y-1">
              <span className="px-3 text-[10px] font-mono uppercase tracking-widest text-ds-text-dim block mb-2 mt-1">
                Account Navigation
              </span>
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl font-heading font-bold text-xs uppercase tracking-wider transition-all ${
                      active
                        ? 'bg-ds-accent text-ds-dark shadow-glow-sm'
                        : 'text-ds-text-muted hover:text-ds-text hover:bg-ds-surface/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${active ? 'opacity-90' : 'opacity-40'}`} />
                  </Link>
                );
              })}

              {user?.role && ['SUPER_ADMIN', 'ADMIN', 'STAFF'].includes(user.role) && (
                <Link
                  href="/staff"
                  onClick={() => setIsMobileOpen(false)}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl font-heading font-bold text-xs uppercase tracking-wider text-amber-400 hover:bg-amber-500/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Shield className="w-4 h-4 shrink-0" />
                    <span>Staff Operations</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 opacity-60 shrink-0" />
                </Link>
              )}
            </nav>
          </div>

          {/* Drawer Bottom Actions */}
          <div className="p-4 border-t border-ds-border bg-ds-surface/30 space-y-2">
            <Link
              href="/booking"
              onClick={() => setIsMobileOpen(false)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-ds-accent hover:bg-ds-ice text-ds-dark font-heading font-bold text-xs uppercase tracking-wider transition-colors shadow-glow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Book Gaming Station</span>
            </Link>

            <Link
              href="/"
              onClick={() => setIsMobileOpen(false)}
              className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-ds-text-dim hover:text-white hover:bg-ds-surface/60 transition-colors font-mono"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-ds-ice" />
                <span>Public Arena Website</span>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
            </Link>

            <a
              href="https://wa.me/919876543210"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              <span>WhatsApp Help Desk</span>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
            </a>

            <button
              type="button"
              onClick={() => {
                setIsMobileOpen(false);
                logout();
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-heading font-semibold transition-colors mt-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Dedicated Player Portal Header ─── */}
      <header className="sticky top-0 z-30 bg-ds-dark/95 backdrop-blur-xl border-b border-ds-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Mobile Top Bar */}
          <div className="flex lg:hidden items-center justify-between h-14">
            {/* Left: Hamburger button to open sidebar + User Name */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsMobileOpen(true)}
                className="p-2 rounded-xl bg-ds-surface/80 border border-ds-border hover:border-ds-accent/40 text-ds-accent hover:text-ds-ice transition-all flex items-center justify-center shadow-sm"
                aria-label="Open sidebar menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-ds-primary to-ds-accent flex items-center justify-center text-xs font-heading font-extrabold text-ds-text shadow-glow-sm shrink-0">
                  {user?.firstName ? user.firstName[0].toUpperCase() : 'P'}
                </div>
                <div className="min-w-0">
                  <h1 className="text-xs font-heading font-black uppercase tracking-wider text-ds-text truncate leading-tight">
                    {user?.firstName || 'Player'}
                  </h1>
                  <span className="text-[9px] font-mono text-ds-accent uppercase tracking-wider block leading-none">
                    Portal
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Notifications & Quick Sign Out */}
            <div className="flex items-center gap-1.5">
              <NotificationBell role={user?.role} />

              <button
                type="button"
                onClick={() => logout()}
                className="p-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 flex items-center justify-center transition-colors shrink-0"
                title="Sign out of your account"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mobile & Tablet Quick Navigation Bar */}
          <div className="lg:hidden border-t border-ds-border/60 py-2 -mx-4 px-4 sm:-mx-6 sm:px-6 overflow-x-auto no-scrollbar scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex items-center gap-1.5 min-w-max">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-heading font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                      active
                        ? 'bg-ds-accent text-ds-dark shadow-glow-sm'
                        : 'text-ds-text-muted hover:text-ds-text hover:bg-ds-surface/60 border border-ds-border/50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.shortName || item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Desktop Top Bar */}
          <div className="hidden lg:flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-ds-accent uppercase font-bold block">
                  SYNDICATE PLAYER HUB
                </span>
                <h1 className="text-lg font-heading font-bold text-ds-text">
                  Welcome back, {user?.firstName || 'Player'}
                </h1>
              </div>
              <Link
                href="/"
                className="text-xs text-ds-text-dim hover:text-ds-ice flex items-center gap-1 font-mono transition-colors pl-4 border-l border-ds-border/60"
              >
                <span>← Public Arena Website</span>
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/booking"
                className="inline-flex px-3.5 py-1.5 rounded-xl bg-ds-accent hover:bg-ds-ice text-ds-dark font-heading font-bold text-xs uppercase tracking-wider transition-colors shadow-glow-sm items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Book Station
              </Link>

              <NotificationBell role={user?.role} />

              <div className="flex items-center gap-2.5 pl-3 border-l border-ds-border/60">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-ds-primary to-ds-accent flex items-center justify-center text-xs font-heading font-extrabold text-ds-text shadow-glow-sm shrink-0">
                  {user?.firstName ? user.firstName[0].toUpperCase() : 'P'}
                </div>
                <div className="text-left text-xs min-w-0 max-w-[130px]">
                  <p className="font-heading font-bold text-ds-text truncate leading-tight">
                    {user?.firstName || 'Player'}
                  </p>
                  <p className="text-[10px] text-ds-text-dim truncate leading-none mt-0.5">
                    {user?.email}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => logout()}
                className="px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 font-heading font-semibold text-xs flex items-center gap-1.5 transition-colors"
                title="Sign out of your account"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Main Content Canvas ─── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 lg:pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Desktop Left Sidebar (Permanently visible on Desktop) */}
          <aside className="hidden lg:block lg:col-span-3 space-y-3 sticky top-24">
            <nav className="p-2 rounded-2xl bg-ds-surface/50 border border-ds-border space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between px-3.5 py-3 rounded-xl font-heading font-semibold text-sm transition-all ${
                      isActive(item.href)
                        ? 'bg-ds-accent text-ds-dark shadow-glow-sm'
                        : 'text-ds-text-muted hover:text-ds-text hover:bg-ds-border/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-60" />
                  </Link>
                );
              })}

              {user?.role && ['SUPER_ADMIN', 'ADMIN', 'STAFF'].includes(user.role) && (
                <Link
                  href="/staff"
                  className="flex items-center justify-between px-3.5 py-3 rounded-xl font-heading font-semibold text-sm text-amber-400 hover:bg-amber-500/10 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-4 h-4" />
                    <span>Staff Operations</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-60" />
                </Link>
              )}

              <div className="my-1 border-t border-ds-border/60" />

              <button
                type="button"
                onClick={() => logout()}
                className="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl font-heading font-semibold text-sm text-rose-400 hover:bg-rose-500/10 transition-colors text-left"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </nav>

            {/* Arena Info Box */}
            <div className="p-4 rounded-2xl bg-ds-dark/60 border border-ds-border text-xs space-y-2 text-ds-text-muted">
              <p className="font-heading font-bold text-ds-text uppercase">Need Assistance?</p>
              <p>Front desk hotline is active during all open hours (10 AM - 12 AM).</p>
              <a
                href="https://wa.me/919876543210"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 font-semibold block hover:underline"
              >
                WhatsApp Help Desk →
              </a>
            </div>
          </aside>

          {/* Subpage Content */}
          <div className="w-full lg:col-span-9 min-w-0">
            {/* Operator Quick Switch Banner for Staff/Admin */}
            {user?.role && ['SUPER_ADMIN', 'ADMIN', 'STAFF'].includes(user.role) && (
              <div className="mb-6 p-3 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-glow-sm animate-fade-in">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-heading font-black text-amber-300 uppercase tracking-wider block">
                      {user.role === 'STAFF' ? 'Staff Terminal Privileges' : 'Administrator Privileges'}
                    </span>
                    <span className="text-[11px] text-amber-200/80">
                      Logged in as {user.firstName || 'User'} ({user.role}). You have full console access.
                    </span>
                  </div>
                </div>
                <Link
                  href={user.role === 'STAFF' ? '/staff' : '/admin'}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-heading font-black text-xs uppercase tracking-wider transition-all text-center shrink-0 shadow-md"
                >
                  Open {user.role === 'STAFF' ? 'Staff Desk' : 'Admin Console'} →
                </Link>
              </div>
            )}

            {children}

            {/* Mobile Assistance Banner (At the bottom of content) */}
            <div className="mt-8 mb-4 lg:hidden p-4 rounded-2xl bg-ds-surface/40 border border-ds-border/60 text-xs flex items-center justify-between gap-3 text-ds-text-muted">
              <div>
                <p className="font-heading font-bold text-ds-text uppercase">Need Assistance?</p>
                <p className="text-[11px] text-ds-text-dim">Front desk hotline (10 AM – 12 AM)</p>
              </div>
              <a
                href="https://wa.me/919876543210"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-heading font-bold text-xs hover:bg-emerald-500/20 shrink-0"
              >
                WhatsApp Help →
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
