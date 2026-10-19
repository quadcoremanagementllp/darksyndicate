'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Bell,
  CheckCheck,
  Calendar,
  CreditCard,
  Clock,
  AlertTriangle,
  Info,
  RotateCw,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  metadata?: { path?: string; [key: string]: any } | null;
}

export default function AccountNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications');
      const json = await res.json();
      if (json.success && json.data) {
        setNotifications(json.data.notifications || []);
      }
    } catch {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications', { method: 'PUT' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to update notifications');
    }
  };

  const handleMarkSingleRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch {
      // ignore
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'BOOKING_CONFIRMED':
        return <Calendar className="w-5 h-5 text-emerald-400" />;
      case 'PAYMENT_RECEIVED':
        return <CreditCard className="w-5 h-5 text-ds-accent" />;
      case 'SESSION_REMINDER':
        return <Clock className="w-5 h-5 text-sky-400" />;
      case 'SESSION_ENDING':
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      default:
        return <Info className="w-5 h-5 text-ds-ice" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-black uppercase text-ds-text">
            Notifications & Alerts
          </h1>
          <p className="text-xs text-ds-text-muted mt-0.5">
            Booking confirmations, payment receipts, tournament invitations, and arena alerts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
            <span>Mark All as Read</span>
          </Button>

          <Button variant="ghost" size="sm" onClick={loadNotifications}>
            <RotateCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Notifications Feed */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center text-xs text-ds-text-dim">
            Loading your notifications...
          </div>
        ) : notifications.length === 0 ? (
          <Card variant="glass" className="p-12 text-center text-xs text-ds-text-dim">
            No notifications in your inbox.
          </Card>
        ) : (
          notifications.map((notif) => (
            <Card
              key={notif.id}
              variant="glass"
              className={`p-4 transition-all flex items-start gap-4 ${
                notif.isRead
                  ? 'opacity-80 bg-ds-surface/30'
                  : 'bg-ds-surface/70 border-l-4 border-l-ds-accent shadow-glow-sm'
              }`}
            >
              <div className="p-2.5 rounded-xl bg-ds-dark border border-ds-border shrink-0 mt-0.5">
                {getTypeIcon(notif.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-bold text-sm text-ds-text">
                      {notif.title}
                    </h3>
                    {!notif.isRead && (
                      <span className="w-2 h-2 rounded-full bg-ds-accent" />
                    )}
                  </div>

                  <span className="text-[11px] font-mono text-ds-text-dim">
                    {new Date(notif.createdAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <p className="text-xs text-ds-text-muted leading-relaxed mb-2">
                  {notif.message}
                </p>

                <div className="flex items-center gap-3">
                  {notif.metadata?.path && (
                    <Link
                      href={notif.metadata.path}
                      onClick={() => handleMarkSingleRead(notif.id)}
                      className="inline-flex items-center gap-1 text-xs font-heading font-bold text-ds-ice hover:text-ds-accent transition-colors"
                    >
                      <span>View Related Details</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}

                  {!notif.isRead && (
                    <button
                      type="button"
                      onClick={() => handleMarkSingleRead(notif.id)}
                      className="text-[11px] text-ds-text-dim hover:text-ds-text transition-colors"
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
