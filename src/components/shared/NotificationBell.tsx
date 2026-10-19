'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  CheckCheck,
  Clock,
  CreditCard,
  AlertTriangle,
  Info,
  Calendar,
  X,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  metadata?: { path?: string; [key: string]: unknown } | null;
}

export function NotificationBell({ role = 'CUSTOMER' }: { role?: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clockTime, setClockTime] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      const json = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error?.message || 'Could not load notifications.');
      }
      setNotifications(json.data.notifications || []);
      setUnreadCount(json.data.unreadCount || 0);
      setClockTime(Date.now());
      setError('');
    } catch {
      setError('Could not load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initial = window.setTimeout(() => { void fetchNotifications(); }, 0);
    const interval = window.setInterval(() => { void fetchNotifications(); }, 30000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, []);

  // Dismiss on outside click or Escape.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/notifications', { method: 'PUT' });
      if (!res.ok) throw new Error('Could not update notifications.');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      setError('');
    } catch {
      setError('Could not mark notifications as read.');
    }
  };

  const handleItemClick = async (notif: NotificationItem) => {
    if (!notif.isRead) {
      try {
        const res = await fetch(`/api/notifications/${notif.id}/read`, { method: 'PUT' });
        if (!res.ok) throw new Error('Could not update notification.');
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
        setError('');
      } catch {
        setError('Could not mark this notification as read.');
      }
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'SESSION_ENDING':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'BOOKING_CONFIRMED':
        return <Calendar className="w-4 h-4 text-emerald-400" />;
      case 'PAYMENT_RECEIVED':
        return <CreditCard className="w-4 h-4 text-ds-accent" />;
      case 'SESSION_REMINDER':
        return <Clock className="w-4 h-4 text-sky-400" />;
      default:
        return <Info className="w-4 h-4 text-ds-ice" />;
    }
  };

  const formatRelativeTime = (isoString: string) => {
    if (clockTime === null) return '';
    const timestamp = new Date(isoString).getTime();
    if (!Number.isFinite(timestamp)) return '';
    const diff = Math.max(0, Math.floor((clockTime - timestamp) / 1000));
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={`relative p-2 rounded-xl border transition-all ${
          open
            ? 'bg-ds-surface border-ds-accent text-ds-ice shadow-glow-sm'
            : 'bg-ds-surface/60 hover:bg-ds-surface border-ds-border hover:border-ds-accent/40 text-ds-text-muted hover:text-ds-text'
        }`}
        aria-label="View notifications"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-ds-accent text-[10px] font-heading font-black text-ds-dark shadow-glow">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Mobile Backdrop to prevent clipping & dismiss easily */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 sm:hidden animate-fade-in"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Dropdown Menu Panel: Fixed full-width on mobile to prevent clipping; absolute anchored on desktop */}
      {open && (
        <div
          className="fixed inset-x-3.5 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[22rem] flex max-h-[calc(100dvh-5.5rem)] flex-col overflow-hidden rounded-2xl border border-ds-border-light bg-ds-surface/98 backdrop-blur-2xl shadow-2xl shadow-black/90 z-50 animate-fade-in-down"
          role="region"
          aria-label="Notifications"
        >
          {/* Header */}
          <div className="shrink-0 px-4 py-3 border-b border-ds-border flex items-center justify-between gap-3 bg-ds-surface-2/95">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full bg-ds-accent animate-pulse shrink-0" />
              <span className="font-heading font-black text-xs uppercase tracking-wider text-ds-text truncate">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="shrink-0 px-2 py-0.5 rounded-full bg-ds-accent text-ds-dark text-[10px] font-heading font-black shadow-glow-sm">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  aria-label="Mark all notifications as read"
                  title="Mark all as read"
                  className="flex items-center gap-1 text-[10px] text-ds-accent hover:text-ds-ice font-heading font-bold uppercase tracking-wider px-2 py-1 rounded-lg hover:bg-ds-surface-3 transition-colors shrink-0"
                >
                  <CheckCheck className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Mark read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
                title="Close notifications"
                className="p-1.5 text-ds-text-dim hover:text-ds-text rounded-lg hover:bg-ds-surface-3 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" className="flex shrink-0 items-center justify-between gap-2 border-b border-rose-500/20 bg-rose-500/10 px-4 py-2 text-[11px] text-rose-300">
              <span>{error}</span>
              <button type="button" onClick={() => { setLoading(true); void fetchNotifications(); }} className="shrink-0 font-semibold underline">Retry</button>
            </div>
          )}

          {/* List */}
          <div className="min-h-0 max-h-72 flex-1 overflow-y-auto divide-y divide-ds-border/40 bg-ds-surface">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-ds-text-dim">Loading alerts…</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-ds-dark/80 border border-ds-border flex items-center justify-center mx-auto text-ds-accent shadow-glow-sm">
                  <Bell className="w-6 h-6 opacity-75" />
                </div>
                <p className="font-heading font-bold text-sm text-ds-text">All Caught Up</p>
                <p className="text-xs text-ds-text-muted max-w-[200px] mx-auto leading-relaxed">
                  {error ? 'Notifications are unavailable right now.' : 'You have no new alerts or activity updates.'}
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => { if (!notif.isRead) void handleItemClick(notif); }}
                  onKeyDown={(event) => {
                    if (!notif.isRead && event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      void handleItemClick(notif);
                    }
                  }}
                  role={notif.isRead ? undefined : 'button'}
                  tabIndex={notif.isRead ? undefined : 0}
                  aria-label={notif.isRead ? undefined : `Mark ${notif.title} as read`}
                  className={`px-4 py-3 transition-colors flex items-start gap-3 ${
                    notif.isRead
                      ? 'bg-ds-surface hover:bg-ds-surface-2/70'
                      : 'cursor-pointer bg-ds-surface-2/90 hover:bg-ds-surface-2 border-l-2 border-ds-accent'
                  }`}
                >
                  <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ds-surface-3/80 border border-ds-border">
                    {getTypeIcon(notif.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="min-w-0 font-heading font-bold text-xs leading-snug text-ds-text line-clamp-2">
                        {notif.title}
                      </span>
                      <span className="text-[10px] text-ds-text-dim font-mono shrink-0 whitespace-nowrap">
                        {formatRelativeTime(notif.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-ds-text-muted leading-relaxed line-clamp-2">
                      {notif.message}
                    </p>

                    {notif.metadata?.path && (
                      <Link
                        href={notif.metadata.path}
                        onClick={() => setOpen(false)}
                        className="inline-flex items-center gap-1 text-[11px] text-ds-ice hover:text-ds-accent font-semibold mt-1.5"
                      >
                        <span>View Details</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 p-3 border-t border-ds-border bg-ds-surface-2/90 text-center">
            {role === 'CUSTOMER' ? (
              <Link
                href="/account/notifications"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl bg-ds-accent/15 border border-ds-accent/30 text-xs font-heading font-bold uppercase tracking-wider text-ds-ice hover:bg-ds-accent hover:text-ds-dark transition-all shadow-glow-sm"
              >
                <span>Open Full Notification Center</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            ) : role === 'STAFF' ? (
              <Link
                href="/staff"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl bg-ds-accent/15 border border-ds-accent/30 text-xs font-heading font-bold uppercase tracking-wider text-ds-ice hover:bg-ds-accent hover:text-ds-dark transition-all shadow-glow-sm"
              >
                <span>Open Staff Operations</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <Link
                href="/admin/notifications"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl bg-ds-accent/15 border border-ds-accent/30 text-xs font-heading font-bold uppercase tracking-wider text-ds-ice hover:bg-ds-accent hover:text-ds-dark transition-all shadow-glow-sm"
              >
                <span>Manage Broadcast Alerts</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
