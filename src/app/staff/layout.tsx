'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  Gamepad2,
  Calendar,
  Clock,
  Sparkles,
  LogOut,
  ChevronRight,
  ArrowUpRight,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from 'lucide-react';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { SoundAlarmToggle } from '@/components/staff/SoundAlarmToggle';
import { SessionExpiryAlertManager } from '@/components/staff/SessionExpiryAlertManager';
import { UpcomingBookingAlertManager } from '@/components/staff/UpcomingBookingAlertManager';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navigation: NavItem[] = [
  { name: 'Live Station Grid', href: '/staff', icon: Gamepad2 },
  { name: "Today's Schedule", href: '/staff/bookings', icon: Calendar },
];

function StaffSidebarNav({
  pathname,
  user,
  onClose,
  onLogout,
  isMobile = false,
}: {
  pathname: string;
  user: any;
  onClose?: () => void;
  onLogout: () => void;
  isMobile?: boolean;
}) {
  const isAdminUser = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  return (
    <div className="flex flex-col h-full justify-between">
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Brand Header */}
        <div className="p-5 border-b border-ds-border flex items-center justify-between">
          <Link href="/staff" onClick={isMobile ? onClose : undefined} className="flex items-center gap-3 group min-w-0">
            <div className="w-9 h-9 rounded-xl bg-ds-surface flex items-center justify-center border border-ds-accent/40 shadow-inner shrink-0">
              <Image src="/logo.svg" alt="Dark Syndicate" width={26} height={26} className="object-contain" />
            </div>
            <div className="truncate">
              <span className="font-heading font-black text-sm uppercase tracking-wider text-ds-text group-hover:text-ds-ice transition-colors block truncate">
                DARK SYNDICATE
              </span>
              <span className="text-[9px] font-mono tracking-widest text-ds-accent uppercase block font-bold truncate">
                STAFF PORTAL
              </span>
            </div>
          </Link>
          {isMobile && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-ds-text-dim hover:text-rose-400 hover:bg-rose-500/10 transition-all shrink-0 ml-1"
              title="Close menu"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="p-4 space-y-1.5 flex-1">
          <span className="px-3 text-[10px] font-mono uppercase tracking-widest text-ds-text-dim block mb-2">
            Arena Operations
          </span>
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={isMobile ? onClose : undefined}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-heading font-bold uppercase tracking-wider transition-all ${
                  isActive
                    ? 'bg-ds-accent text-white shadow-md shadow-ds-accent/20'
                    : 'text-ds-text-muted hover:text-white hover:bg-ds-surface/60'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-80 shrink-0" />}
              </Link>
            );
          })}

          <div className="pt-4 mt-4 border-t border-ds-border/60 space-y-1.5">
            <span className="px-3 text-[10px] font-mono uppercase tracking-widest text-ds-text-dim block mb-2">
              Cross Portals
            </span>
            {isAdminUser && (
              <Link
                href="/admin"
                onClick={isMobile ? onClose : undefined}
                className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-amber-400 hover:bg-ds-surface/60 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span className="font-heading font-bold uppercase">Admin Command Center</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 opacity-60 shrink-0" />
              </Link>
            )}

            <Link
              href="/"
              onClick={isMobile ? onClose : undefined}
              className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-ds-text-dim hover:text-white hover:bg-ds-surface/60 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Public Arena Website</span>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-60 shrink-0" />
            </Link>
          </div>
        </nav>

        {/* User Profile Badge & Logout */}
        <div className="p-4 border-t border-ds-border bg-ds-surface/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-ds-accent/20 border border-ds-accent/40 text-ds-ice flex items-center justify-center font-heading font-bold text-xs shrink-0">
                {user?.firstName?.[0] || 'S'}
              </div>
              <div className="text-left text-xs truncate">
                <p className="font-heading font-bold text-ds-text leading-tight truncate">
                  {user?.firstName || 'Staff'} {user?.lastName || 'Operator'}
                </p>
                <span className="text-[10px] text-emerald-400 font-mono font-semibold uppercase">
                  {user?.role === 'SUPER_ADMIN' ? 'Super Admin' : user?.role === 'ADMIN' ? 'Admin' : 'Shift Operator'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="p-1.5 rounded-lg text-ds-text-dim hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all shrink-0 ml-1"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();
  const [timeStr, setTimeStr] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  const isStaffOrAdmin = user?.role === 'STAFF' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  // Guard: Redirect unauthorized users or customers out of the staff operations floor
  useEffect(() => {
    if (!isLoading && (!user || !isStaffOrAdmin)) {
      window.location.href = '/login?portal=staff';
    }
  }, [user, isLoading, isStaffOrAdmin]);

  useEffect(() => {
    const updateTime = () => {
      setTimeStr(
        new Date().toLocaleTimeString('en-US', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load saved sidebar state from localStorage (default to collapsed on tablets <1024px)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ds_staff_sidebar_open');
      if (saved !== null) {
        setIsSidebarOpen(saved === 'true');
      } else if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      }
    } catch {}
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ds_staff_sidebar_open', String(next));
      } catch {}
      return next;
    });
  };

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Keyboard shortcut: Ctrl + B or Cmd + B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ─── 12-HOUR SHIFT INACTIVITY TIMEOUT ───
  const INACTIVITY_LIMIT_MS = 12 * 60 * 60 * 1000; // 12 hours full shift duration

  useEffect(() => {
    // Record active timestamp on mount (always start fresh on page load)
    const markActivity = () => {
      try {
        localStorage.setItem('ds_staff_last_active', String(Date.now()));
      } catch {}
    };

    markActivity();

    // User activity listeners (throttled to at most once every 5 seconds)
    let lastThrottledTime = 0;
    const onUserInteraction = () => {
      const now = Date.now();
      if (now - lastThrottledTime > 5000) {
        lastThrottledTime = now;
        markActivity();
      }
    };

    const trackedEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    trackedEvents.forEach((evt) => window.addEventListener(evt, onUserInteraction, { passive: true }));

    // Reset activity when tab/screen becomes visible again
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        markActivity();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Periodic check every 60 seconds
    const inactivityInterval = setInterval(async () => {
      try {
        const lastActiveTimestamp = Number(localStorage.getItem('ds_staff_last_active')) || Date.now();
        const inactiveTime = Date.now() - lastActiveTimestamp;

        if (inactiveTime >= INACTIVITY_LIMIT_MS) {
          console.warn('[Staff Portal] Shift duration exceeded. Logging out.');
          try {
            await logout('SYSTEM_INACTIVE');
          } finally {
            window.location.href = '/login?portal=staff&reason=inactive';
          }
        }
      } catch (err) {
        console.error('Inactivity check error:', err);
      }
    }, 60000);

    return () => {
      trackedEvents.forEach((evt) => window.removeEventListener(evt, onUserInteraction));
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(inactivityInterval);
    };
  }, [logout]);

  const handleLogout = async () => {
    try {
      await logout('MANUAL');
    } finally {
      window.location.href = '/login?portal=staff';
    }
  };

  if (!user || !isStaffOrAdmin) {
    return (
      <div className="min-h-screen bg-ds-darker flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-ds-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono text-ds-text-dim">Verifying Staff Authorization...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ds-darker text-ds-text flex selection:bg-ds-accent selection:text-white">
      {/* Mobile/Tablet Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 lg:hidden animate-fade-in"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile & Tablet Slide-Over Drawer */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-ds-dark/98 border-r border-ds-border flex flex-col justify-between lg:hidden transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0 shadow-2xl shadow-cyan-500/10' : '-translate-x-full'
        }`}
      >
        <StaffSidebarNav
          pathname={pathname}
          user={user}
          onClose={() => setIsMobileOpen(false)}
          onLogout={handleLogout}
          isMobile={true}
        />
      </aside>

      {/* Desktop Collapsible Sidebar (visible on lg screens >= 1024px) */}
      <aside
        className={`bg-ds-dark/95 border-r border-ds-border flex flex-col justify-between shrink-0 hidden lg:flex sticky top-0 h-screen transition-all duration-300 ease-in-out ${
          isSidebarOpen
            ? 'w-64 opacity-100'
            : 'w-0 opacity-0 pointer-events-none overflow-hidden border-r-0'
        }`}
      >
        <div className="w-64 h-full flex flex-col">
          <StaffSidebarNav
            pathname={pathname}
            user={user}
            onClose={toggleSidebar}
            onLogout={handleLogout}
            isMobile={false}
          />
        </div>
      </aside>

      {/* Main Staff Operations Area */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out">
        {/* Top Header Bar */}
        <header className="bg-ds-surface/95 backdrop-blur-md border-b border-ds-border px-3 sm:px-5 lg:px-6 py-3 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile / Tablet Menu Button */}
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-ds-surface border border-ds-border hover:border-ds-accent/40 text-ds-text hover:text-ds-ice transition-all shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5 text-ds-accent" />
            </button>

            {/* Desktop Sidebar Toggle Button */}
            <button
              type="button"
              onClick={toggleSidebar}
              className="hidden lg:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-ds-surface/80 border border-ds-border hover:border-ds-accent/50 text-ds-text-muted hover:text-ds-ice transition-all text-xs font-mono group shadow-sm shrink-0"
              title={isSidebarOpen ? 'Collapse sidebar (Ctrl+B)' : 'Expand sidebar (Ctrl+B)'}
              aria-label="Toggle sidebar"
            >
              {isSidebarOpen ? (
                <PanelLeftClose className="w-4 h-4 text-ds-accent group-hover:scale-110 transition-transform" />
              ) : (
                <PanelLeftOpen className="w-4 h-4 text-ds-accent group-hover:scale-110 transition-transform" />
              )}
              <span className="text-[11px] font-heading font-bold uppercase tracking-wider text-ds-text group-hover:text-ds-ice">
                {isSidebarOpen ? 'Collapse' : 'Expand Sidebar'}
              </span>
            </button>

            {/* Brand Title on Mobile / Tablet */}
            <div className="lg:hidden flex items-center gap-2 min-w-0">
              <span className="font-heading font-black text-xs sm:text-sm uppercase tracking-wider text-ds-text truncate">
                DARK SYNDICATE
              </span>
              <span className="hidden sm:inline-block text-[9px] font-mono px-1.5 py-0.5 rounded bg-ds-accent/15 border border-ds-accent/30 text-ds-accent uppercase font-bold shrink-0">
                STAFF
              </span>
            </div>

            {/* Live Arena Pulse */}
            <div className="hidden sm:flex items-center gap-2 pl-2 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-mono text-ds-text-dim">ARENA ACTIVE</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Clock */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-ds-surface/60 border border-ds-border text-xs font-mono text-ds-text-dim">
              <Clock className="w-3.5 h-3.5 text-ds-accent shrink-0" />
              <span suppressHydrationWarning className="whitespace-nowrap">{timeStr || '10:00:00 AM'} IST</span>
            </div>

            {/* Sound Alarm Controls */}
            <SoundAlarmToggle />

            <NotificationBell role="STAFF" />

            {/* Quick Switch to Admin Console if permitted */}
            {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
              <Link
                href="/admin"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ds-surface border border-amber-500/30 text-xs font-heading font-bold text-amber-300 hover:bg-amber-500/10 transition-all shrink-0"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Admin Console</span>
              </Link>
            )}

            {/* Header Sign Out Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-ds-surface/80 border border-ds-border hover:border-rose-500/40 text-ds-text-muted hover:text-rose-400 text-xs font-heading font-bold uppercase transition-all shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Log Out</span>
            </button>
          </div>
        </header>

        {/* Content canvas - Optimized padding for tablets */}
        <main className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>

        {/* Real-time Session Expiry & Extra Time Alerts Popups */}
        <SessionExpiryAlertManager />

        {/* Real-time Upcoming Booked Time Slot Near Alerts */}
        <UpcomingBookingAlertManager />
      </div>
    </div>
  );
}
