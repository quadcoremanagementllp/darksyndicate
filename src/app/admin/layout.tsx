'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  Gamepad2,
  Calendar,
  Users,
  Tag,
  CreditCard,
  Shield,
  UserCog,
  MonitorPlay,
  ChevronRight,
  Sparkles,
  BarChart3,
  Globe,
  ShieldCheck,
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  LogOut,
  Disc3,
} from 'lucide-react';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { SessionExpiryAlertManager } from '@/components/staff/SessionExpiryAlertManager';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Financial Reports', href: '/admin/reports', icon: BarChart3 },
  { name: 'Station Inventory', href: '/admin/stations', icon: Gamepad2 },
  { name: 'Games Library', href: '/admin/games', icon: Disc3 },
  { name: 'All Bookings', href: '/admin/bookings', icon: Calendar },
  { name: 'Session History', href: '/admin/sessions', icon: Calendar },
  { name: 'Customer Directory', href: '/admin/customers', icon: Users },
  { name: 'Syndicate Passes', href: '/admin/memberships', icon: Sparkles },
  { name: 'Promo Coupons', href: '/admin/coupons', icon: Tag },
  { name: 'Payments Ledger', href: '/admin/payments', icon: CreditCard },
  { name: 'Website CMS & Venue', href: '/admin/cms', icon: Globe },
  { name: 'Broadcast Alerts', href: '/admin/notifications', icon: Bell },
  { name: 'System Audit Logs', href: '/admin/audit-logs', icon: ShieldCheck },
  { name: 'Staff Accounts', href: '/admin/staff', icon: UserCog },
];

function SidebarNav({
  pathname,
  user,
  onClose,
  onLogout,
  isMobile = false,
  collapsed = false,
}: {
  pathname: string;
  user: any;
  onClose?: () => void;
  onLogout?: () => void;
  isMobile?: boolean;
  collapsed?: boolean;
}) {
  return (
    <div className="flex flex-col h-full justify-between">
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Brand Header */}
        <div className={`${collapsed ? 'p-3 justify-center' : 'p-5 justify-between'} border-b border-ds-border flex items-center`}>
          <Link href="/admin" onClick={isMobile ? onClose : undefined} title={collapsed ? 'Dark Syndicate Dashboard' : undefined} aria-label="Dark Syndicate Dashboard" className="flex items-center gap-3 group min-w-0">
            <div className="w-9 h-9 rounded-xl bg-ds-surface flex items-center justify-center border border-ds-accent/40 shadow-inner shrink-0">
              <Image src="/logo.svg" alt="Dark Syndicate" width={26} height={26} className="object-contain" />
            </div>
            {!collapsed && <div className="truncate">
              <span className="font-heading font-black text-sm uppercase tracking-wider text-ds-text group-hover:text-ds-ice transition-colors block truncate">
                DARK SYNDICATE
              </span>
              <span className="text-[9px] font-mono tracking-widest text-ds-accent uppercase block font-bold truncate">
                COMMAND CENTER
              </span>
            </div>}
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
        <nav className={`${collapsed ? 'p-2' : 'p-4'} space-y-1.5 flex-1`}>
          {!collapsed && <span className="px-3 text-[10px] font-mono uppercase tracking-widest text-ds-text-dim block mb-2">
            Management
          </span>}
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={isMobile ? onClose : undefined}
                aria-label={item.name}
                aria-current={isActive ? 'page' : undefined}
                title={collapsed ? item.name : undefined}
                className={`flex items-center ${collapsed ? 'justify-center px-2' : 'justify-between px-3'} py-2.5 rounded-xl text-xs font-heading font-bold uppercase tracking-wider transition-all ${
                  isActive
                    ? 'bg-ds-accent text-white shadow-md shadow-ds-accent/20'
                    : 'text-ds-text-muted hover:text-white hover:bg-ds-surface/60'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.name}</span>}
                </div>
                {!collapsed && isActive && <ChevronRight className="w-3.5 h-3.5 opacity-80 shrink-0" />}
              </Link>
            );
          })}
        </nav>

        {/* User Profile Badge */}
        <div className={`${collapsed ? 'p-3' : 'p-4'} border-t border-ds-border bg-ds-surface/30`}>
          <div className={`flex items-center ${collapsed ? 'flex-col gap-2' : 'justify-between'}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-ds-accent/20 border border-ds-accent/40 text-ds-ice flex items-center justify-center font-heading font-bold text-xs shrink-0">
                {user?.firstName?.[0] || 'A'}
              </div>
              {!collapsed && <div className="text-left text-xs truncate">
                <p className="font-heading font-bold text-ds-text leading-tight truncate">
                  {user?.firstName || 'System'} {user?.lastName || 'Admin'}
                </p>
                <span className="text-[10px] text-emerald-400 font-mono font-semibold uppercase">
                  {user?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Administrator'}
                </span>
              </div>}
            </div>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className={`p-1.5 rounded-lg text-ds-text-dim hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all shrink-0 ${collapsed ? '' : 'ml-1'}`}
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();
  const [mounted, setMounted] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  // Guard: Redirect unauthorized users or customers out of the admin console
  useEffect(() => {
    if (mounted && !isLoading && (!user || !isAdmin)) {
      window.location.href = '/login?portal=admin';
    }
  }, [mounted, user, isLoading, isAdmin]);

  // Load saved sidebar state from localStorage (default to collapsed on tablets <1024px)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ds_admin_sidebar_open');
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
        localStorage.setItem('ds_admin_sidebar_open', String(next));
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

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      window.location.href = '/login?portal=admin';
    }
  };

  if (!mounted || !user || !isAdmin) {
    return (
      <div className="min-h-screen bg-ds-darker flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-ds-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono text-ds-text-dim">Verifying Admin Privileges...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ds-darker text-ds-text flex selection:bg-ds-accent selection:text-white">
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 md:hidden animate-fade-in"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Slide-Over Drawer */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-ds-dark/98 border-r border-ds-border flex flex-col justify-between md:hidden transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0 shadow-2xl shadow-cyan-500/10' : '-translate-x-full'
        }`}
      >
        <SidebarNav
          pathname={pathname}
          user={user}
          onClose={() => setIsMobileOpen(false)}
          onLogout={handleLogout}
          isMobile={true}
        />
      </aside>

      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`bg-ds-dark/95 border-r border-ds-border flex flex-col justify-between shrink-0 hidden md:flex sticky top-0 h-screen transition-all duration-300 ease-in-out ${
          isSidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        <div className="w-full h-full flex flex-col">
          <SidebarNav
            pathname={pathname}
            user={user}
            onClose={toggleSidebar}
            onLogout={handleLogout}
            isMobile={false}
            collapsed={!isSidebarOpen}
          />
        </div>
      </aside>

      {/* Main Admin Area */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out">
        {/* Top Header Bar */}
        <header className="bg-ds-surface/95 backdrop-blur-md border-b border-ds-border px-4 sm:px-6 py-3.5 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              className="md:hidden p-2 rounded-xl bg-ds-surface border border-ds-border hover:border-ds-accent/40 text-ds-text hover:text-ds-ice transition-all"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5 text-ds-accent" />
            </button>

            {/* Desktop Sidebar Toggle Button */}
            <button
              type="button"
              onClick={toggleSidebar}
              className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-ds-surface/80 border border-ds-border hover:border-ds-accent/50 text-ds-text-muted hover:text-ds-ice transition-all text-xs font-mono group shadow-sm"
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

            {/* Mobile Brand Title */}
            <span className="md:hidden font-heading font-black text-xs uppercase tracking-wider text-ds-text">
              DARK SYNDICATE
            </span>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell role="ADMIN" />
            <Link
              href="/staff"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ds-surface border border-ds-accent/30 text-xs font-heading font-bold text-ds-ice hover:bg-ds-accent/20 transition-all"
            >
              <MonitorPlay className="w-3.5 h-3.5" />
              <span>Staff Floor View</span>
            </Link>

            {/* Header Sign Out Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ds-surface/80 border border-ds-border hover:border-rose-500/40 text-ds-text-muted hover:text-rose-400 text-xs font-heading font-bold uppercase transition-all"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Log Out</span>
            </button>
          </div>
        </header>

        {/* Content canvas */}
        <main className="flex-1 p-4 sm:p-6 lg:p-10 max-w-7xl w-full mx-auto">{children}</main>
        <SessionExpiryAlertManager />
      </div>
    </div>
  );
}
