'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import {
  Calendar,
  Clock,
  Search,
  CheckCircle2,
  ExternalLink,
  Play,
  RotateCw,
  QrCode,
  Tag,
  Info,
  Square,
  PlusCircle,
  Gamepad2,
  AlertTriangle,
  User,
  Phone,
  LayoutGrid,
  List,
  Sparkles,
  ArrowRight,
  UserPlus,
  RotateCcw,
} from 'lucide-react';
import { ExtendSessionModal } from '@/components/staff/ExtendSessionModal';
import { EndSessionModal, type EndSessionTarget } from '@/components/staff/EndSessionModal';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';

export default function StaffBookingsSchedulePage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateScope, setDateScope] = useState<'TODAY' | 'ALL'>('TODAY');
  const [staffScope, setStaffScope] = useState<'ALL' | 'MINE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const hasLoadedOnce = useRef(false);

  // Modal states
  const [selectedBookingForGrid, setSelectedBookingForGrid] = useState<any | null>(null);
  const [extendStation, setExtendStation] = useState<any | null>(null);
  const [endSessionTarget, setEndSessionTarget] = useState<EndSessionTarget | null>(null);
  const [updatingPlayerBookingId, setUpdatingPlayerBookingId] = useState<string | null>(null);

  // Live real-time ticker
  const [currentTime, setCurrentTime] = useState(Date.now());
  const toast = useToast();

  const handleExtraPlayerAction = async (booking: any, action: 'ADD' | 'REMOVE' = 'ADD') => {
    setUpdatingPlayerBookingId(booking.id);
    try {
      const res = await fetch('/api/staff/sessions/extra-player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id, action }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(
          json.data?.message ||
            (action === 'REMOVE' ? 'Extra person undone (-₹50)' : 'Extra person added (+₹50)')
        );
        setBookings((prev) =>
          prev.map((item) =>
            item.id === booking.id
              ? {
                  ...item,
                  playerCount: json.data.playerCount,
                  totalPricePaise: json.data.totalPricePaise,
                }
              : item
          )
        );
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('ds-booking-updated'));
        }
      } else {
        toast.error(json.error?.message || 'Failed to update extra players');
      }
    } catch {
      toast.error('Network error updating extra players');
    } finally {
      setUpdatingPlayerBookingId(null);
    }
  };

  // Auto-default to Cards view on tablet and mobile viewports (< 1024px) for optimal touch UX
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setViewMode('grid');
    }
  }, []);

  // Tick every second for live countdowns
  useEffect(() => {
    const tick = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  // Support ?tab=ACTIVE or other tab param from URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam && ['ALL', 'ACTIVE', 'UPCOMING', 'COMPLETED'].includes(tabParam)) {
        setStatusFilter(tabParam);
      }
    }
  }, []);

  const loadBookings = async (silent = false) => {
    if (!silent && !hasLoadedOnce.current) {
      setLoading(true);
    } else if (!silent) {
      setRefreshing(true);
    }
    try {
      const res = await fetch('/api/admin/bookings');
      const json = await res.json();
      if (json.success && json.data) {
        setBookings(json.data || []);
        hasLoadedOnce.current = true;
      }
    } catch {
      if (!silent) toast.error('Failed to load schedule');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadBookings(false);
    const interval = setInterval(() => {
      loadBookings(true); // Silent background polling — zero UI flicker/unmounting
    }, 30000);

    const handleBookingUpdate = () => loadBookings(true);
    if (typeof window !== 'undefined') {
      window.addEventListener('ds-booking-updated', handleBookingUpdate);
    }

    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('ds-booking-updated', handleBookingUpdate);
      }
    };
  }, []);

  // Countdown timer calculations with true proportional elapsed percentage
  const getCountdown = (scheduledEndAt: string, startedAt?: string) => {
    const end = new Date(scheduledEndAt).getTime();
    const diffMs = end - currentTime;

    if (diffMs <= 0) {
      const overdueSec = Math.floor(Math.abs(diffMs) / 1000);
      const mins = Math.floor(overdueSec / 60);
      const secs = overdueSec % 60;
      return {
        formatted: `+${mins}:${secs.toString().padStart(2, '0')}`,
        overdueMins: mins,
        isOverdue: true,
        isEndingSoon: true,
        isCriticalEnding: true,
        percentage: 100,
      };
    }

    const totalSec = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    const formatted =
      hours > 0
        ? `${hours}h ${mins.toString().padStart(2, '0')}m`
        : `${mins}:${secs.toString().padStart(2, '0')}`;

    // True mathematical progress calculation based on actual slot/session start and end
    let percentage = 0;
    if (startedAt) {
      const start = new Date(startedAt).getTime();
      const totalDuration = Math.max(60 * 1000, end - start);
      const elapsed = Math.max(0, currentTime - start);
      percentage = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    } else {
      const estimatedTotal = diffMs > 60 * 60 * 1000 ? 120 * 60 * 1000 : 60 * 60 * 1000;
      percentage = Math.min(100, Math.max(0, 100 - (diffMs / estimatedTotal) * 100));
    }

    return {
      formatted,
      overdueMins: 0,
      isOverdue: false,
      isEndingSoon: totalSec <= 900, // <= 15 mins
      isCriticalEnding: totalSec <= 300, // <= 5 mins
      percentage,
    };
  };

  const handleQuickCheckIn = async (booking: any) => {
    try {
      const res = await fetch('/api/staff/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: booking.bookingRef || booking.id,
          autoStartSession: true,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Check-in confirmed for ${booking.customerName}!`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('ds-booking-updated'));
        }
        loadBookings(true);
      } else {
        toast.error(json.error?.message || 'Check-in failed');
      }
    } catch {
      toast.error('Check-in error');
    }
  };

  const handleEndSession = (booking: any) => {
    setEndSessionTarget({
      sessionId: booking.session?.id,
      stationId: booking.stationId,
      stationName: booking.stationName,
      bookingId: booking.id,
      customerName: booking.customerName,
      bookingRef: booking.bookingRef,
      scheduledEndAt: booking.session?.scheduledEndAt || booking.endTime,
      pricePerHourPaise: booking.pricePerHourPaise || 15000,
      gameTitle: booking.gameTitle || booking.session?.gameTitle || null,
      paymentStatus: booking.paymentStatus,
      paymentMethod: booking.paymentMethod,
      totalPricePaise: booking.totalPricePaise,
    });
  };

  const openExtendModal = (booking: any) => {
    setExtendStation({
      id: booking.stationId,
      name: booking.stationName,
      pricePerHourPaise: booking.pricePerHourPaise || 15000,
      activeSession: {
        id: booking.session?.id || `active-${booking.id}`,
        bookingId: booking.id,
        customerName: booking.customerName,
        bookingRef: booking.bookingRef,
        scheduledEndAt: booking.session?.scheduledEndAt || booking.endTime,
        gameTitle: booking.gameTitle || booking.session?.gameTitle || null,
        paymentStatus: booking.paymentStatus,
        paymentMethod: booking.paymentMethod,
        totalPricePaise: booking.totalPricePaise,
        isPayOnExit: booking.paymentStatus === 'PENDING' || booking.notes?.includes('[PAY ON EXIT]'),
        unpaidPaise: booking.unpaidPaise,
      },
    });
  };

  const getIsToday = (b: any) => {
    const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
    const startIST = b.startTime
      ? new Date(b.startTime).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      : '';
    const dateIST = b.date
      ? new Date(b.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      : '';
    const endIST = b.endTime
      ? new Date(b.endTime).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      : '';
    const sessionEndIST = b.session?.endedAt
      ? new Date(b.session.endedAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      : '';
    const updatedIST = b.updatedAt
      ? new Date(b.updatedAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      : '';
    const createdIST = b.createdAt
      ? new Date(b.createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      : '';

    return (
      startIST === todayIST ||
      dateIST === todayIST ||
      endIST === todayIST ||
      sessionEndIST === todayIST ||
      createdIST === todayIST ||
      (b.status === 'COMPLETED' && updatedIST === todayIST)
    );
  };

  const getIsSessionActive = (b: any) =>
    b.status === 'IN_PROGRESS' ||
    b.status === 'CHECKED_IN' ||
    Boolean(b.session && ['ACTIVE', 'PAUSED', 'EXTENDED', 'OVERDUE'].includes(b.session.status));

  const getIsMine = (b: any) => {
    // 1. Any desk walk-in is always considered a walk-in reservation
    if (b.isWalkIn || b.channel === 'DESK' || (b.bookingRef && b.bookingRef.startsWith('DS-WALK'))) {
      return true;
    }
    // 2. Or if explicitly assigned to or initiated by the current staff member
    if (user) {
      if (b.session?.staff?.id === user.id || b.session?.staffId === user.id) return true;
      const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase();
      const staffName = (b.staffName || '').toLowerCase();
      if (userName && staffName && (staffName.includes(userName) || userName.includes(staffName))) {
        return true;
      }
    }
    return false;
  };

  const filteredBookings = bookings.filter((b) => {
    const isSessionActive = getIsSessionActive(b);

    // 1. Date Scope: TODAY by default, but always include currently active floor sessions
    if (dateScope === 'TODAY' && !getIsToday(b) && !isSessionActive) {
      return false;
    }

    // 2. Staff Scope: All Arena vs My Walk-ins
    if (staffScope === 'MINE' && !getIsMine(b)) {
      return false;
    }

    // 3. Status Tabs
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && isSessionActive) ||
      (statusFilter === 'UPCOMING' && b.status === 'CONFIRMED' && !isSessionActive) ||
      (statusFilter === 'COMPLETED' && b.status === 'COMPLETED');

    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      (b.bookingRef || '').toLowerCase().includes(query) ||
      (b.customerName || '').toLowerCase().includes(query) ||
      (b.stationName || '').toLowerCase().includes(query) ||
      (b.gameTitle || '').toLowerCase().includes(query);

    return matchesStatus && matchesSearch;
  });

  const activeInSessionCount = bookings.filter((b) => {
    const isSessionActive = getIsSessionActive(b);
    if (!isSessionActive) return false;
    if (staffScope === 'MINE' && !getIsMine(b)) return false;
    return true;
  }).length;

  const upcomingCount = bookings.filter((b) => {
    if (b.status !== 'CONFIRMED' || getIsSessionActive(b)) return false;
    if (dateScope === 'TODAY' && !getIsToday(b)) return false;
    if (staffScope === 'MINE' && !getIsMine(b)) return false;
    return true;
  }).length;

  const completedCount = bookings.filter((b) => {
    if (b.status !== 'COMPLETED') return false;
    if (dateScope === 'TODAY' && !getIsToday(b)) return false;
    if (staffScope === 'MINE' && !getIsMine(b)) return false;
    return true;
  }).length;

  const allBookingsCount = bookings.filter((b) => {
    const isSessionActive = getIsSessionActive(b);
    if (dateScope === 'TODAY' && !getIsToday(b) && !isSessionActive) return false;
    if (staffScope === 'MINE' && !getIsMine(b)) return false;
    return true;
  }).length;

  const nearUpcomingBookings = bookings.filter((b) => {
    if (b.status !== 'CONFIRMED' || !b.startTime) return false;
    if (!getIsToday(b)) return false;
    const diffMs = new Date(b.startTime).getTime() - currentTime;
    return diffMs <= 15 * 60 * 1000 && diffMs >= -90 * 60 * 1000;
  });

  const dueBookingsCount = nearUpcomingBookings.filter(
    (b) => new Date(b.startTime).getTime() <= currentTime
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <h1 className="text-xl sm:text-2xl font-heading font-black uppercase text-ds-text tracking-tight">
              Arena Daily Reservation Schedule
            </h1>
            {activeInSessionCount > 0 && (
              <Badge variant="accent" size="sm" className="font-mono whitespace-nowrap shrink-0">
                {activeInSessionCount} In Session
              </Badge>
            )}
            {nearUpcomingBookings.length > 0 && (
              <Badge
                variant={dueBookingsCount > 0 ? 'default' : 'warning'}
                size="sm"
                className={`font-mono font-bold animate-pulse whitespace-nowrap shrink-0 ${
                  dueBookingsCount > 0
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/60'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                }`}
              >
                {dueBookingsCount > 0
                  ? `🚨 ${dueBookingsCount} Due for Check-In`
                  : `⏰ ${nearUpcomingBookings.length} Near Slot Start`}
              </Badge>
            )}
          </div>
          <p className="text-xs text-ds-text-muted mt-1">
            Monitor player check-ins, active play sessions, time remaining, and equipment assignments in real-time.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadBookings(false)}
            disabled={refreshing}
            title="Refresh schedule"
            className="whitespace-nowrap shrink-0 text-xs font-heading font-semibold"
          >
            <RotateCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin text-ds-accent' : ''}`} />
            <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </Button>
          <Link href="/staff" className="shrink-0">
            <Button
              variant="accent"
              size="sm"
              className="flex items-center gap-1.5 whitespace-nowrap shrink-0 text-xs font-heading font-bold shadow-sm"
            >
              <Gamepad2 className="w-3.5 h-3.5 shrink-0" />
              <span>Live Console Grid</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* ─── UPCOMING BOOKED TIME SLOTS NEAR ALERT BANNER ─── */}
      {nearUpcomingBookings.length > 0 && (
        <div
          className={`p-4 sm:p-5 rounded-2xl border-2 shadow-xl animate-fade-in space-y-3.5 transition-all ${
            dueBookingsCount > 0
              ? 'bg-gradient-to-r from-rose-500/15 via-ds-surface to-rose-500/5 border-rose-500/80 shadow-rose-500/10'
              : 'bg-gradient-to-r from-amber-500/15 via-ds-surface to-amber-500/5 border-amber-500/60 shadow-amber-500/10'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3.5 w-3.5">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    dueBookingsCount > 0 ? 'bg-rose-500' : 'bg-amber-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-3.5 w-3.5 ${
                    dueBookingsCount > 0 ? 'bg-rose-500' : 'bg-amber-400'
                  }`}
                />
              </span>
              <div>
                <span
                  className={`font-heading font-black text-xs sm:text-sm uppercase tracking-wider ${
                    dueBookingsCount > 0 ? 'text-rose-300' : 'text-amber-300'
                  }`}
                >
                  {dueBookingsCount > 0
                    ? `🚨 Booked Slots Due for Check-In (${dueBookingsCount} Ready for Desk)`
                    : `⏰ Upcoming Booked Time Slots (${nearUpcomingBookings.length} Starting Soon)`}
                </span>
                <p className="text-[11px] text-white/70 font-mono">
                  Players with booked slots starting in ≤15 minutes or due for front desk check-in.
                </p>
              </div>
            </div>

            {statusFilter !== 'UPCOMING' && (
              <button
                type="button"
                onClick={() => setStatusFilter('UPCOMING')}
                className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ds-dark/90 hover:bg-ds-surface border border-ds-border hover:border-amber-400 text-xs font-heading font-bold text-ds-ice transition-all shadow-sm"
                title="Switch table to Upcoming tab"
              >
                <span>Switch to Upcoming Tab ({nearUpcomingBookings.length})</span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {nearUpcomingBookings.map((b) => {
              const startMs = new Date(b.startTime).getTime();
              const diffMs = startMs - currentTime;
              const isDue = diffMs <= 0;
              const diffSec = Math.floor(Math.abs(diffMs) / 1000);
              const mins = Math.floor(diffSec / 60);
              const secs = diffSec % 60;
              const timeFormatted = new Date(b.startTime).toLocaleTimeString('en-IN', {
                timeZone: 'Asia/Kolkata',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              });

              return (
                <div
                  key={b.id}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                    isDue
                      ? 'bg-rose-500/15 border-rose-500/70 shadow-lg shadow-rose-500/10'
                      : 'bg-black/50 border-amber-400/50 hover:border-amber-400'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-bold text-xs text-white truncate">
                        {b.stationName || b.station?.name}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                          isDue
                            ? 'bg-rose-500 text-white animate-pulse'
                            : 'bg-amber-400 text-black font-black'
                        }`}
                      >
                        {isDue ? '🚨 DUE NOW' : `in ${mins}m ${secs}s`}
                      </span>
                    </div>
                    <div className="text-[11px] text-white/80 truncate mt-1">
                      <strong className="text-white">{b.customerName}</strong> •{' '}
                      <span suppressHydrationWarning className="font-mono text-cyan-300 font-bold">{timeFormatted}</span>
                      {b.bookingRef && <span className="text-white/50 font-mono text-[10px] ml-1.5">({b.bookingRef})</span>}
                    </div>
                  </div>

                  <Button
                    variant="accent"
                    size="sm"
                    onClick={() => handleQuickCheckIn(b)}
                    className="text-[11px] py-1.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-black shrink-0 shadow-md shadow-emerald-500/20"
                  >
                    <Play className="w-3 h-3 mr-1 fill-black" />
                    <span>Check In</span>
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter & View Switcher Bar (Tablet & Desktop Optimized) */}
      <div className="bg-ds-surface/50 p-3 sm:p-4 rounded-2xl border border-ds-border space-y-3 shadow-lg">
        {/* Tier 1: Main Status Tabs & View Mode Switcher */}
        <div className="flex items-center justify-between gap-2.5 sm:gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-ds-dark p-1 rounded-xl border border-ds-border text-xs overflow-x-auto no-scrollbar min-w-0 flex-nowrap shrink">
            {[
              {
                id: 'ALL',
                label: dateScope === 'TODAY' ? `All Today (${allBookingsCount})` : `All Bookings (${allBookingsCount})`,
              },
              { id: 'ACTIVE', label: `In Session (${activeInSessionCount})` },
              {
                id: 'UPCOMING',
                label:
                  nearUpcomingBookings.length > 0
                    ? `Upcoming (${upcomingCount} • ${nearUpcomingBookings.length} Near!)`
                    : `Upcoming (${upcomingCount})`,
              },
              { id: 'COMPLETED', label: `Completed (${completedCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-heading font-bold uppercase transition-all whitespace-nowrap text-[11px] sm:text-xs shrink-0 cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-ds-accent text-white shadow-sm'
                    : 'text-ds-text-dim hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Table vs Grid toggle */}
          <div className="flex items-center bg-ds-dark p-1 rounded-xl border border-ds-border shrink-0">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-bold transition-all cursor-pointer ${
                viewMode === 'table' ? 'bg-ds-surface text-ds-ice shadow-sm border border-ds-ice/30' : 'text-ds-text-dim hover:text-white'
              }`}
              title="Table View"
            >
              <List className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-bold transition-all cursor-pointer ${
                viewMode === 'grid' ? 'bg-ds-surface text-ds-ice shadow-sm border border-ds-ice/30' : 'text-ds-text-dim hover:text-white'
              }`}
              title="Grid Cards View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
          </div>
        </div>

        {/* Tier 2: Refinement Filters & Search Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3 pt-2.5 border-t border-ds-border/40">
          {/* Sub-Filters: Date Scope + Staff Scope */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            {/* Date Scope Filter */}
            <div className="flex items-center gap-1 bg-ds-dark p-1 rounded-xl border border-ds-border text-xs shrink-0">
              <button
                onClick={() => setDateScope('TODAY')}
                className={`px-2.5 py-1.5 rounded-lg font-heading font-bold uppercase text-[11px] transition-all flex items-center gap-1.5 cursor-pointer ${
                  dateScope === 'TODAY'
                    ? 'bg-ds-surface text-ds-ice border border-ds-ice/30 shadow-sm'
                    : 'text-ds-text-dim hover:text-white'
                }`}
                title="Only show reservations and sessions scheduled for today"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Today Only</span>
              </button>
              <button
                onClick={() => setDateScope('ALL')}
                className={`px-2.5 py-1.5 rounded-lg font-heading font-bold uppercase text-[11px] transition-all flex items-center gap-1.5 cursor-pointer ${
                  dateScope === 'ALL'
                    ? 'bg-ds-surface text-amber-300 border border-amber-500/30 shadow-sm'
                    : 'text-ds-text-dim hover:text-white'
                }`}
                title="Show all historical bookings from previous days"
              >
                <span>All History</span>
              </button>
            </div>

            {/* Staff Scope Filter */}
            <div className="flex items-center gap-1 bg-ds-dark p-1 rounded-xl border border-ds-border text-xs shrink-0">
              <button
                onClick={() => setStaffScope('ALL')}
                className={`px-2.5 py-1.5 rounded-lg font-heading font-bold uppercase text-[11px] transition-all flex items-center gap-1.5 cursor-pointer ${
                  staffScope === 'ALL'
                    ? 'bg-ds-surface text-ds-accent border border-ds-accent/30 shadow-sm'
                    : 'text-ds-text-dim hover:text-white'
                }`}
                title="Show all bookings across all stations on the arena floor"
              >
                <Gamepad2 className="w-3.5 h-3.5" />
                <span>All Arena</span>
              </button>
              <button
                onClick={() => setStaffScope('MINE')}
                className={`px-2.5 py-1.5 rounded-lg font-heading font-bold uppercase text-[11px] transition-all flex items-center gap-1.5 cursor-pointer ${
                  staffScope === 'MINE'
                    ? 'bg-ds-surface text-emerald-300 border border-emerald-500/30 shadow-sm'
                    : 'text-ds-text-dim hover:text-white'
                }`}
                title="Show only bookings handled by you"
              >
                <User className="w-3.5 h-3.5" />
                <span>My Walk-ins</span>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative w-full lg:w-72 xl:w-80 shrink-0">
            <Input
              placeholder="Search ref, player, station..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs py-1.5 pl-8 w-full bg-ds-dark/90"
            />
            <Search className="w-3.5 h-3.5 text-ds-text-dim absolute left-2.5 top-2.5" />
          </div>
        </div>
      </div>

      {/* ─── GRID CARDS VIEW (Tablet-Optimized Touch Cards) ─── */}
      {viewMode === 'grid' ? (
        loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-ds-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-ds-text-muted">Loading schedule cards...</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="p-12 text-center bg-ds-surface/30 rounded-2xl border border-dashed border-ds-border text-ds-text-dim space-y-2">
            <p className="text-sm font-heading font-bold text-ds-text">No matching reservations found</p>
            <p className="text-xs text-ds-text-muted">
              Try adjusting your search query, status tabs, or switch to All History.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
            {filteredBookings.map((b) => {
              const isSessionActive = getIsSessionActive(b);
              const scheduledEnd = b.session?.scheduledEndAt || b.endTime;
              const sessionStart = b.session?.startedAt || b.startTime;
              const countdown = isSessionActive ? getCountdown(scheduledEnd, sessionStart) : null;

              const isSnooker = b.isSnooker ?? (b.stationType === 'POOL_TABLE' || b.stationName?.toUpperCase().includes('SNOOKER') || b.stationName?.toUpperCase().includes('POOL'));
              const currentPlayers = b.playerCount || (isSnooker ? 4 : 1);
              const startDiffMs = b.startTime ? new Date(b.startTime).getTime() - currentTime : null;
              const isSlotNear = startDiffMs !== null && getIsToday(b) && b.status === 'CONFIRMED' && !isSessionActive && startDiffMs <= 15 * 60 * 1000 && startDiffMs >= -120 * 60 * 1000;
              const isSlotDue = startDiffMs !== null && getIsToday(b) && b.status === 'CONFIRMED' && !isSessionActive && startDiffMs <= 0 && startDiffMs >= -120 * 60 * 1000;
              const diffSec = startDiffMs !== null ? Math.floor(Math.abs(startDiffMs) / 1000) : 0;
              const startMins = Math.floor(diffSec / 60);
              const startSecs = diffSec % 60;

              return (
                <Card
                  key={b.id}
                  glass
                  className={`p-5 sm:p-6 border transition-all flex flex-col justify-between relative overflow-hidden ${
                    countdown?.isOverdue || isSlotDue
                      ? 'border-rose-500/80 bg-rose-500/5 shadow-lg shadow-rose-500/10 ring-1 ring-rose-500'
                      : countdown?.isEndingSoon || isSlotNear
                      ? 'border-amber-400/80 bg-amber-400/5 shadow-lg shadow-amber-400/10'
                      : isSessionActive
                      ? 'border-ds-accent/60 bg-ds-surface/80 shadow-md shadow-ds-accent/5'
                      : b.status === 'COMPLETED'
                      ? 'border-ds-border bg-ds-surface/40'
                      : 'border-ds-border hover:border-ds-accent/40 bg-ds-surface/60'
                  }`}
                >
                  <div className="space-y-4">
                    {/* Header: Facility + Status Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-ds-accent truncate">
                        {b.facilityName || 'PLAYSTATION 5 ARENA'}
                      </span>
                      <Badge
                        variant={
                          countdown?.isOverdue || isSlotDue
                            ? 'default'
                            : countdown?.isCriticalEnding || isSlotNear
                            ? 'warning'
                            : countdown?.isEndingSoon
                            ? 'warning'
                            : isSessionActive
                            ? 'accent'
                            : b.status === 'CONFIRMED'
                            ? 'success'
                            : b.status === 'COMPLETED'
                            ? 'default'
                            : 'warning'
                        }
                        size="sm"
                        className={`font-mono text-[10px] uppercase tracking-wider shrink-0 ${
                          countdown?.isOverdue || isSlotDue
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 animate-pulse font-bold'
                            : isSlotNear
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                            : ''
                        }`}
                      >
                        {countdown?.isOverdue
                          ? '🚨 OVERDUE'
                          : isSlotDue
                          ? '🚨 DUE NOW'
                          : isSlotNear
                          ? '⏳ STARTS SOON'
                          : countdown?.isEndingSoon
                          ? '⏳ ENDING SOON'
                          : isSessionActive
                          ? (isSnooker ? '🎱 IN SESSION' : '🎮 IN SESSION')
                          : b.status}
                      </Badge>
                    </div>

                    {/* Station Name & Ref */}
                    <div>
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="text-lg sm:text-xl font-heading font-bold text-ds-text truncate">
                          {b.stationName}
                        </h3>
                        <span className="font-mono text-xs font-bold text-ds-ice bg-ds-dark/90 px-2 py-0.5 rounded border border-ds-border/80 shrink-0 select-all">
                          {b.bookingRef}
                        </span>
                      </div>

                      {isSnooker ? (
                        <div className="mt-2.5 p-2.5 rounded-xl bg-ds-dark/70 border border-ds-border/70 space-y-2">
                          {/* Top Row: Capacity & Extra Breakdown */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm shrink-0">🎱</span>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-xs font-heading font-black text-white uppercase tracking-wider whitespace-nowrap">
                                  {currentPlayers} Players
                                </span>
                                <span className="text-[10px] font-mono text-ds-text-dim whitespace-nowrap">
                                  (4 base)
                                </span>
                              </div>
                            </div>

                            {currentPlayers > 4 ? (
                              <span className="font-mono text-[10px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap shadow-sm">
                                +{currentPlayers - 4} Extra (+₹{(currentPlayers - 4) * 50})
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-ds-text-dim shrink-0">
                                Standard Table
                              </span>
                            )}
                          </div>

                          {/* Bottom Actions Row (Active Session Only) */}
                          {isSessionActive && (
                            <div className={`pt-1.5 border-t border-ds-border/40 ${currentPlayers > 4 ? 'grid grid-cols-2 gap-2' : 'flex justify-end'}`}>
                              {currentPlayers > 4 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleExtraPlayerAction(b, 'REMOVE');
                                  }}
                                  disabled={updatingPlayerBookingId === b.id}
                                  className="h-7.5 px-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 hover:border-rose-500/50 text-rose-300 hover:text-white font-mono font-bold text-[11px] transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-sm whitespace-nowrap disabled:opacity-50"
                                  title="Undo 1 extra person (-₹50)"
                                >
                                  {updatingPlayerBookingId === b.id ? (
                                    <span className="animate-spin text-xs">⏳</span>
                                  ) : (
                                    <RotateCcw className="w-3 h-3 text-rose-400" />
                                  )}
                                  <span>Undo (-₹50)</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleExtraPlayerAction(b, 'ADD');
                                }}
                                disabled={updatingPlayerBookingId === b.id}
                                className={`h-7.5 px-2.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-300 hover:text-white font-mono font-bold text-[11px] transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-sm whitespace-nowrap disabled:opacity-50 ${currentPlayers <= 4 ? 'w-full' : ''}`}
                                title="Add 1 extra person (+₹50)"
                              >
                                {updatingPlayerBookingId === b.id ? (
                                  <span className="animate-spin text-xs">⏳</span>
                                ) : (
                                  <UserPlus className="w-3 h-3 text-emerald-400" />
                                )}
                                <span>+ Person (+₹50)</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-ds-text-muted line-clamp-1 mt-0.5">
                          {b.stationSpecs || 'Ultra-low latency 4K 120Hz display'}
                        </p>
                      )}
                    </div>

                    {/* Player & Session Details Box */}
                    <div className="p-3.5 sm:p-4 rounded-xl bg-ds-dark/90 border border-ds-border space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[9px] uppercase font-mono text-ds-text-dim block">Player</span>
                          <span className="text-sm font-heading font-bold text-ds-text truncate block">
                            {b.customerName}
                          </span>
                          <span className="text-[11px] font-mono text-ds-text-dim block truncate">
                            {b.customerPhone || b.customerEmail || 'Walk-in Guest'}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[9px] uppercase font-mono text-ds-text-dim block">
                            {isSessionActive
                              ? countdown?.isOverdue
                                ? 'Extra Time'
                                : 'Time Left'
                              : isSlotDue
                              ? 'Slot Due'
                              : isSlotNear
                              ? 'Slot Starts In'
                              : 'Window'}
                          </span>
                          {isSessionActive && countdown ? (
                            <span
                              className={`text-base sm:text-lg font-mono font-black tracking-tight ${
                                countdown.isOverdue
                                  ? 'text-rose-400'
                                  : countdown.isEndingSoon
                                  ? 'text-amber-400'
                                  : 'text-ds-ice'
                              }`}
                            >
                              {countdown.formatted}
                            </span>
                          ) : isSlotNear ? (
                            <span className="text-xs font-mono font-bold text-amber-300">
                              {startMins}m {startSecs}s
                            </span>
                          ) : (
                            <span suppressHydrationWarning className="text-xs font-mono font-semibold text-ds-text-muted">
                              {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Mini progress bar if active session */}
                      {isSessionActive && countdown && (
                        <div className="w-full h-1.5 rounded-full bg-ds-surface overflow-hidden">
                          <div
                            className={`h-full transition-all duration-1000 ${
                              countdown.isOverdue
                                ? 'bg-rose-500'
                                : countdown.isEndingSoon
                                ? 'bg-amber-400'
                                : 'bg-ds-accent'
                            }`}
                            style={{ width: `${countdown.percentage}%` }}
                          />
                        </div>
                      )}

                      {!isSnooker && (b.gameTitle || b.session?.gameTitle) && !(b.gameTitle || b.session?.gameTitle)?.includes('[PAY ON EXIT]') && (
                        <div className="flex items-center gap-1.5 text-[11px] font-heading font-bold text-ds-ice bg-ds-accent/15 border border-ds-accent/30 px-2.5 py-1 rounded-lg">
                          <Gamepad2 className="w-3.5 h-3.5 text-ds-accent shrink-0" />
                          <span className="truncate">Game: {b.gameTitle || b.session?.gameTitle}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center text-[10px] font-mono text-ds-text-dim pt-1 border-t border-ds-border/40">
                        <span suppressHydrationWarning>
                          {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                          {new Date(b.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="font-bold text-ds-text">
                          ₹{(b.totalPricePaise / 100).toFixed(0)} ({b.paymentMethod || 'CASH'})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action Controls */}
                  <div className="pt-3.5 mt-3.5 border-t border-ds-border/60 flex items-center justify-between gap-2">
                    {isSessionActive ? (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openExtendModal(b)}
                          className="flex-1 justify-center text-xs font-bold"
                        >
                          <PlusCircle className="w-3.5 h-3.5 mr-1" />
                          <span>Extend</span>
                        </Button>

                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleEndSession(b)}
                          className="flex-1 justify-center text-xs font-bold"
                        >
                          <Square className="w-3.5 h-3.5 mr-1" />
                          <span>End Session</span>
                        </Button>
                      </>
                    ) : b.status === 'CONFIRMED' ? (
                      <Button
                        variant={isSlotNear || isSlotDue ? 'accent' : 'outline'}
                        size="sm"
                        onClick={() => handleQuickCheckIn(b)}
                        className={`flex-1 justify-center text-xs font-bold ${
                          isSlotDue
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20'
                            : isSlotNear
                            ? 'bg-amber-400 hover:bg-amber-300 text-black shadow-md shadow-amber-400/20'
                            : 'text-ds-ice border-ds-border hover:border-ds-accent'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5 mr-1" />
                        <span>Check In</span>
                      </Button>
                    ) : (
                      <Link
                        href={`/booking/confirmation/${b.bookingRef || b.id}`}
                        target="_blank"
                        className="flex-1"
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-center text-xs text-ds-ice hover:bg-ds-surface"
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-1" />
                          <span>Receipt / Pass</span>
                        </Button>
                      </Link>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedBookingForGrid(b)}
                      className="px-2.5 text-xs text-ds-ice hover:bg-ds-surface shrink-0"
                      title="View Full Station Dossier"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : (
        /* ─── TABLE VIEW (Tablet-Optimized with Sticky Actions & Unbroken Refs) ─── */
        <Card glass className="border-ds-border overflow-hidden">
          {loading ? (
            <div className="p-16 text-center text-xs text-ds-text-dim">Loading schedule...</div>
          ) : filteredBookings.length === 0 ? (
            <div className="p-14 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-ds-surface/60 border border-ds-border flex items-center justify-center text-ds-text-dim">
                <Calendar className="w-6 h-6 text-ds-accent/60" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-heading font-bold text-ds-text">
                  {statusFilter === 'COMPLETED'
                    ? dateScope === 'TODAY'
                      ? 'No reservations completed today'
                      : 'No completed reservations found'
                    : statusFilter === 'ACTIVE'
                    ? 'No active sessions at the moment'
                    : statusFilter === 'UPCOMING'
                    ? dateScope === 'TODAY'
                      ? 'No upcoming reservations scheduled for today'
                      : 'No upcoming reservations found'
                    : dateScope === 'TODAY'
                    ? 'No reservations scheduled for today'
                    : 'No reservations found'}
                </p>
                <p className="text-xs text-ds-text-muted max-w-sm">
                  {dateScope === 'TODAY'
                    ? 'There are no matching reservations for today. Switch to All History to inspect records from previous dates.'
                    : 'Try adjusting your search query or station filters to see more results.'}
                </p>
              </div>
              {dateScope === 'TODAY' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDateScope('ALL')}
                  className="mt-2 text-xs font-heading font-bold uppercase tracking-wider text-amber-300 border-amber-500/40 hover:bg-amber-500/10"
                >
                  <span>Switch to All History</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto relative rounded-xl border border-ds-border/60 shadow-inner">
              {/* Tablet/Mobile Swipe Hint Banner */}
              <div className="lg:hidden flex items-center justify-between px-3.5 py-2 bg-ds-dark/90 border-b border-ds-border/60 text-[11px] font-mono text-ds-text-dim">
                <span className="flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Swipe horizontally for full table</span>
                </span>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className="text-cyan-300 hover:text-white font-bold flex items-center gap-1 hover:underline ml-2 shrink-0"
                >
                  <LayoutGrid className="w-3 h-3" />
                  <span>Cards View (Recommended) →</span>
                </button>
              </div>
              <table className="w-full text-left text-xs min-w-[1040px]">
                <thead className="bg-ds-dark/80 text-ds-text-dim uppercase text-[10px] font-mono border-b border-ds-border tracking-wider">
                  <tr>
                    <th className="py-3 px-4 whitespace-nowrap min-w-[170px]">Booking Ref</th>
                    <th className="py-3 px-4 whitespace-nowrap min-w-[160px]">Player Details</th>
                    <th className="py-3 px-4 whitespace-nowrap min-w-[170px]">Station & Facility</th>
                    <th className="py-3 px-4 whitespace-nowrap min-w-[190px]">Time Window / Countdown</th>
                    <th className="py-3 px-4 whitespace-nowrap min-w-[110px]">Payment</th>
                    <th className="py-3 px-4 whitespace-nowrap min-w-[130px]">Status</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap min-w-[190px] lg:sticky lg:right-0 bg-ds-dark/95 backdrop-blur-md lg:shadow-[-12px_0_16px_rgba(0,0,0,0.6)] z-20">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ds-border/40">
                  {filteredBookings.map((b) => {
                    const isSessionActive = getIsSessionActive(b);
                    const isSnooker = b.isSnooker ?? (b.stationType === 'POOL_TABLE' || b.stationName?.toUpperCase().includes('SNOOKER') || b.stationName?.toUpperCase().includes('POOL'));
                    const currentPlayers = b.playerCount || (isSnooker ? 4 : 1);
                    const scheduledEnd = b.session?.scheduledEndAt || b.endTime;
                    const sessionStart = b.session?.startedAt || b.startTime;
                    const countdown = isSessionActive ? getCountdown(scheduledEnd, sessionStart) : null;

                    const startDiffMs = b.startTime ? new Date(b.startTime).getTime() - currentTime : null;
                    const isSlotNear = startDiffMs !== null && getIsToday(b) && b.status === 'CONFIRMED' && !isSessionActive && startDiffMs <= 15 * 60 * 1000 && startDiffMs >= -120 * 60 * 1000;
                    const isSlotDue = startDiffMs !== null && getIsToday(b) && b.status === 'CONFIRMED' && !isSessionActive && startDiffMs <= 0 && startDiffMs >= -120 * 60 * 1000;
                    const diffSec = startDiffMs !== null ? Math.floor(Math.abs(startDiffMs) / 1000) : 0;
                    const startMins = Math.floor(diffSec / 60);
                    const startSecs = diffSec % 60;

                    return (
                      <tr key={b.id} className="hover:bg-ds-surface/40 transition-colors">
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-xs text-ds-ice bg-ds-dark/80 border border-ds-border/80 px-2.5 py-1 rounded-lg select-all tracking-tight shadow-sm inline-block">
                              {b.bookingRef}
                            </span>
                            {b.isWalkIn && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold uppercase tracking-wider shrink-0">
                                WALK-IN
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 min-w-[160px]">
                          <div className="font-heading font-bold text-ds-text">{b.customerName}</div>
                          <div className="text-[11px] text-ds-text-dim flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-ds-text-dim/70 shrink-0" />
                            <span>{b.customerPhone || b.customerEmail || '—'}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 min-w-[170px]">
                          <div className="font-heading font-semibold text-ds-text">{b.stationName}</div>
                          <div className="text-[10px] text-ds-accent font-mono uppercase tracking-wider">{b.facilityName}</div>
                          {isSnooker ? (
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className="px-1.5 py-0.5 rounded bg-ds-dark border border-ds-border text-[10px] font-mono font-bold text-cyan-300 whitespace-nowrap">
                                🎱 {currentPlayers}P {currentPlayers > 4 ? `(+${currentPlayers - 4} Extra)` : ''}
                              </span>
                              {isSessionActive && (
                                <div className="flex items-center gap-1 shrink-0">
                                  {currentPlayers > 4 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleExtraPlayerAction(b, 'REMOVE');
                                      }}
                                      disabled={updatingPlayerBookingId === b.id}
                                      className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-white border border-rose-500/30 cursor-pointer active:scale-95 transition-all flex items-center gap-1"
                                      title="Undo 1 extra person (-₹50)"
                                    >
                                      <RotateCcw className="w-2.5 h-2.5 text-rose-400" />
                                      <span>Undo (-₹50)</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleExtraPlayerAction(b, 'ADD');
                                    }}
                                    disabled={updatingPlayerBookingId === b.id}
                                    className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 hover:text-white border border-emerald-500/30 cursor-pointer active:scale-95 transition-all flex items-center gap-1"
                                    title="Add 1 extra person (+₹50)"
                                  >
                                    <UserPlus className="w-2.5 h-2.5 text-emerald-400" />
                                    <span>+ Person (+₹50)</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            (b.gameTitle || b.session?.gameTitle) && !(b.gameTitle || b.session?.gameTitle)?.includes('[PAY ON EXIT]') && (
                              <div className="flex items-center gap-1 text-[11px] text-ds-ice font-heading mt-0.5">
                                <Gamepad2 className="w-3 h-3 text-ds-accent shrink-0" />
                                <span className="truncate max-w-[140px]">{b.gameTitle || b.session?.gameTitle}</span>
                              </div>
                            )
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-ds-text whitespace-nowrap min-w-[190px]">
                          <div className="flex items-center gap-1.5">
                            <span suppressHydrationWarning>
                              {!getIsToday(b) && (
                                <span className="mr-1.5 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-300 font-bold font-mono">
                                  {new Date(b.startTime || b.date).toLocaleDateString('en-US', {
                                    timeZone: 'Asia/Kolkata',
                                    day: '2-digit',
                                    month: 'short',
                                  })}
                                </span>
                              )}
                              {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                              {new Date(b.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {isSessionActive && countdown && (
                            <div className="mt-1 flex items-center gap-2">
                              <span
                                className={`text-[11px] font-bold font-mono tracking-tight flex items-center gap-1 ${
                                  countdown.isOverdue
                                    ? 'text-rose-400 font-black animate-pulse'
                                    : countdown.isCriticalEnding
                                    ? 'text-orange-400 font-black'
                                    : countdown.isEndingSoon
                                    ? 'text-amber-400'
                                    : 'text-ds-ice'
                                }`}
                              >
                                {countdown.isOverdue ? (
                                  <span>🚨 EXTRA TIME: {countdown.formatted}</span>
                                ) : (
                                  <span>⏱ {countdown.formatted} left</span>
                                )}
                              </span>
                              <span className="text-[10px] text-ds-text-dim">({b.durationMinutes / 60} hr)</span>
                            </div>
                          )}
                          {!isSessionActive && (
                            <div className="mt-1 flex items-center gap-1.5">
                              {isSlotDue ? (
                                <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/60 text-rose-300 font-bold font-mono text-[10px] animate-pulse flex items-center gap-1">
                                  <span>🚨 DUE NOW (Check-in Ready)</span>
                                </span>
                              ) : isSlotNear ? (
                                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/60 text-amber-300 font-bold font-mono text-[10px] flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-amber-400" />
                                  <span>Starts in {startMins}m {startSecs}s</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-ds-text-dim">
                                  {startDiffMs !== null && startDiffMs > 0 && startDiffMs <= 120 * 60 * 1000 && getIsToday(b)
                                    ? `Starts in ${Math.round(startDiffMs / 60000)}m • ${b.durationMinutes / 60} hr session`
                                    : `${b.durationMinutes / 60} hr session`}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap min-w-[110px]">
                          <div className="font-bold text-ds-text">₹{(b.totalPricePaise / 100).toFixed(0)}</div>
                          <span className="text-[10px] text-ds-text-dim uppercase font-mono">
                            {b.paymentMethod || 'CASH'} • {b.paymentStatus || 'PAID'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap min-w-[130px]">
                          <Badge
                            variant={
                              countdown?.isOverdue || isSlotDue
                                ? 'default'
                                : countdown?.isCriticalEnding || isSlotNear
                                ? 'warning'
                                : countdown?.isEndingSoon
                                ? 'warning'
                                : isSessionActive
                                ? 'accent'
                                : b.status === 'CONFIRMED'
                                ? 'success'
                                : b.status === 'COMPLETED'
                                ? 'default'
                                : 'warning'
                            }
                            size="sm"
                            className={`font-mono text-[10px] ${
                              countdown?.isOverdue
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 animate-pulse font-bold'
                                : isSlotDue
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/60 animate-pulse font-bold'
                                : countdown?.isCriticalEnding
                                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40 font-bold'
                                : isSlotNear
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/60 font-bold'
                                : countdown?.isEndingSoon
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : ''
                            }`}
                          >
                            {countdown?.isOverdue
                              ? `🔴 EXTRA TIME (+${countdown.overdueMins}m)`
                              : isSlotDue
                              ? '🚨 DUE NOW'
                              : isSlotNear
                              ? '⏳ STARTS SOON'
                              : countdown?.isCriticalEnding
                              ? '🟠 FINAL 5 MINS'
                              : countdown?.isEndingSoon
                              ? '⏳ ENDING SOON'
                              : isSessionActive
                              ? '🎮 IN SESSION'
                              : b.status}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap min-w-[190px] lg:sticky lg:right-0 bg-ds-dark/95 backdrop-blur-md lg:shadow-[-12px_0_16px_rgba(0,0,0,0.6)] z-10">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* In-Session Quick Actions: Extend & End Session */}
                            {isSessionActive && (
                              <>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => openExtendModal(b)}
                                  className="text-[11px] py-1 px-2.5 flex items-center gap-1 border-ds-accent/30 hover:border-ds-accent text-ds-ice hover:bg-ds-accent/20 font-bold"
                                  title="Extend session duration"
                                >
                                  <PlusCircle className="w-3.5 h-3.5 text-ds-accent" />
                                  <span>Extend</span>
                                </Button>

                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() => handleEndSession(b)}
                                  className="text-[11px] py-1 px-2.5 flex items-center gap-1 text-white bg-rose-600 hover:bg-rose-500 font-bold shadow-sm"
                                  title="End active session"
                                >
                                  <Square className="w-3.5 h-3.5" />
                                  <span>End Session</span>
                                </Button>
                              </>
                            )}

                            {/* Check In action for confirmed bookings */}
                            {b.status === 'CONFIRMED' && !isSessionActive && (
                              <Button
                                variant={isSlotNear || isSlotDue ? 'accent' : 'outline'}
                                size="sm"
                                onClick={() => handleQuickCheckIn(b)}
                                className={`text-[11px] py-1 px-3 flex items-center gap-1 font-bold ${
                                  isSlotDue
                                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/30 ring-1 ring-emerald-300 animate-pulse'
                                    : isSlotNear
                                    ? 'bg-amber-400 hover:bg-amber-300 text-black shadow-md shadow-amber-400/20 font-bold'
                                    : 'text-ds-ice border-ds-border hover:border-ds-accent'
                                }`}
                              >
                                <Play className={`w-3 h-3 mr-1 ${isSlotNear || isSlotDue ? 'fill-black' : ''}`} />
                                <span>Check In</span>
                              </Button>
                            )}

                            {/* Info Button — Shows Station Grid View Modal */}
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setSelectedBookingForGrid(b)}
                              className="text-[11px] py-1 px-2.5 flex items-center gap-1 border-ds-border text-ds-text-dim hover:text-white hover:bg-ds-surface font-semibold"
                              title="Open Live Station Console Grid View"
                            >
                              <Info className="w-3.5 h-3.5 text-ds-accent" />
                              <span>Info</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ─── STATION GRID VIEW MODAL ("thats grid view here") ─── */}
      {selectedBookingForGrid && (
        <Modal
          isOpen={!!selectedBookingForGrid}
          onClose={() => setSelectedBookingForGrid(null)}
          title={`Station Console — ${selectedBookingForGrid.stationName}`}
          size="md"
        >
          {(() => {
            const b = selectedBookingForGrid;
            const isSessionActive = getIsSessionActive(b);
            const isSnooker = b.isSnooker ?? (b.stationType === 'POOL_TABLE' || b.stationName?.toUpperCase().includes('SNOOKER') || b.stationName?.toUpperCase().includes('POOL'));
            const currentPlayers = b.playerCount || (isSnooker ? 4 : 1);
            const scheduledEnd = b.session?.scheduledEndAt || b.endTime;
            const sessionStart = b.session?.startedAt || b.startTime;
            const countdown = isSessionActive ? getCountdown(scheduledEnd, sessionStart) : null;

            return (
              <div className="space-y-5">
                {/* Station Card Preview (Replicating Image 1) */}
                <div
                  className={`p-6 rounded-2xl border transition-all relative overflow-hidden bg-ds-surface/90 shadow-2xl ${
                    countdown?.isOverdue
                      ? 'border-rose-500/80 shadow-rose-500/10 ring-1 ring-rose-500'
                      : countdown?.isCriticalEnding
                      ? 'border-orange-500/80 shadow-orange-500/10'
                      : countdown?.isEndingSoon
                      ? 'border-amber-400/80 shadow-amber-400/10'
                      : 'border-ds-accent/60 shadow-ds-accent/10'
                  }`}
                >
                  {/* Top Bar: Facility Name + Status Badge */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-ds-accent">
                      {b.facilityName || 'PLAYSTATION 5 ARENA'}
                    </span>
                    <Badge
                      variant={
                        countdown?.isOverdue
                          ? 'default'
                          : countdown?.isCriticalEnding
                          ? 'warning'
                          : countdown?.isEndingSoon
                          ? 'warning'
                          : isSessionActive
                          ? 'accent'
                          : 'default'
                      }
                      size="sm"
                      className={`font-mono text-[11px] uppercase tracking-wider ${
                        countdown?.isOverdue
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 animate-pulse font-bold'
                          : countdown?.isCriticalEnding
                          ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40 font-bold'
                          : countdown?.isEndingSoon
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : ''
                      }`}
                    >
                      {countdown?.isOverdue
                        ? `🔴 EXTRA TIME (+${countdown.overdueMins}m)`
                        : countdown?.isCriticalEnding
                        ? '🟠 FINAL 5 MINS'
                        : countdown?.isEndingSoon
                        ? '⏳ ENDING SOON'
                        : isSessionActive
                        ? (isSnooker ? '🎱 IN SESSION' : '🎮 IN SESSION')
                        : b.status}
                    </Badge>
                  </div>

                  {/* Title & Station Specs */}
                  <div className="mt-3">
                    <h3 className="text-2xl font-heading font-black text-ds-text">{b.stationName}</h3>
                    {isSnooker ? (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-xs text-cyan-300">🎱 {currentPlayers} Players</span>
                        {currentPlayers > 4 && (
                          <span className="text-xs text-amber-300 font-mono">
                            (+{currentPlayers - 4} Extra • +₹{(currentPlayers - 4) * 50})
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-ds-text-muted mt-0.5">
                        {b.stationSpecs || 'Ultra-low latency 4K 120Hz display'}
                      </p>
                    )}
                  </div>

                  {/* Active Session Inner Box (Exact Replica of Image 1) */}
                  {isSessionActive && countdown ? (
                    <div className="mt-5 p-4 rounded-xl bg-ds-dark/95 border border-ds-border space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[9px] uppercase font-mono text-ds-text-dim block">Active Player</span>
                          <span className="text-base font-heading font-bold text-ds-text">
                            {b.customerName}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] uppercase font-mono text-ds-text-dim block">
                            {countdown.isOverdue ? 'Extra Time Played' : 'Time Remaining'}
                          </span>
                          <span
                            className={`text-xl font-mono font-black tracking-tight ${
                              countdown.isOverdue
                                ? 'text-rose-400'
                                : countdown.isCriticalEnding
                                ? 'text-orange-400 animate-pulse'
                                : countdown.isEndingSoon
                                ? 'text-amber-400'
                                : 'text-ds-ice'
                            }`}
                          >
                            {countdown.isOverdue ? `+${countdown.formatted}` : countdown.formatted}
                          </span>
                        </div>
                      </div>

                      {/* Animated Progress Bar */}
                      <div className="w-full h-2 rounded-full bg-ds-surface overflow-hidden">
                        <div
                          className={`h-full transition-all duration-1000 ${
                            countdown.isOverdue
                              ? 'bg-rose-500'
                              : countdown.isCriticalEnding
                              ? 'bg-orange-500'
                              : countdown.isEndingSoon
                              ? 'bg-amber-400'
                              : 'bg-ds-accent'
                          }`}
                          style={{ width: `${countdown.percentage}%` }}
                        />
                      </div>

                      <div className="flex justify-between items-center text-[10px] font-mono text-ds-text-dim pt-1">
                        <span>Ref: {b.bookingRef}</span>
                        <span suppressHydrationWarning>
                          End: {new Date(scheduledEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 p-4 rounded-xl bg-ds-dark/60 border border-ds-border text-xs space-y-2">
                      <div className="flex justify-between">
                        <span className="text-ds-text-dim">Player:</span>
                        <span className="font-bold text-ds-text">{b.customerName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ds-text-dim">Time Window:</span>
                        <span suppressHydrationWarning className="font-mono text-ds-text">
                          {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                          {new Date(b.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Primary Operational Actions (Matching Image 1) */}
                  {isSessionActive && (
                    <div className="mt-5 pt-4 border-t border-ds-border/60 flex items-center justify-between gap-3">
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={() => openExtendModal(b)}
                        className="flex-1 justify-center text-xs font-bold"
                      >
                        <PlusCircle className="w-4 h-4 mr-1.5" />
                        <span>Extend</span>
                      </Button>

                      <Button
                        variant="danger"
                        size="md"
                        onClick={() => handleEndSession(b)}
                        className="flex-1 justify-center text-xs font-bold"
                      >
                        <Square className="w-4 h-4 mr-1.5" />
                        <span>End Session</span>
                      </Button>
                    </div>
                  )}
                </div>

                {/* Additional Dossier Information */}
                <div className="p-4 rounded-xl bg-ds-dark/60 border border-ds-border space-y-2 text-xs">
                  {(b.gameTitle || b.session?.gameTitle) && (
                    <div className="flex justify-between items-center pb-1.5 border-b border-ds-border/60">
                      <span className="text-ds-text-dim">Game Playing:</span>
                      <span className="font-bold text-ds-ice flex items-center gap-1.5 font-heading">
                        <Gamepad2 className="w-3.5 h-3.5 text-ds-accent" />
                        <span>{b.gameTitle || b.session?.gameTitle}</span>
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-ds-text-dim">Player Contact:</span>
                    <span className="font-mono text-ds-text">{b.customerPhone || b.customerEmail || '—'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-ds-text-dim">Booking Channel:</span>
                    <span className="font-semibold text-ds-ice">{b.bookedVia || (b.isWalkIn ? 'Desk Walk-in' : 'Online')}</span>
                  </div>
                  {b.staffName && (
                    <div className="flex justify-between items-center">
                      <span className="text-ds-text-dim">Desk Staff Collected:</span>
                      <span className="font-semibold text-emerald-400">{b.staffName}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-ds-text-dim">Payment Info:</span>
                    <span className="font-bold text-ds-text">
                      ₹{(b.totalPricePaise / 100).toFixed(0)} ({b.paymentMethod || 'CASH'} • {b.paymentStatus})
                    </span>
                  </div>
                </div>

                {/* Quick Link Footer */}
                <div className="flex items-center justify-between pt-2">
                  <Link
                    href={`/booking/confirmation/${b.bookingRef || b.id}`}
                    target="_blank"
                    className="text-xs text-ds-ice hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View Customer Receipt / QR Pass</span>
                  </Link>

                  <Button variant="outline" size="sm" onClick={() => setSelectedBookingForGrid(null)}>
                    Close
                  </Button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {/* ─── EXTEND DURATION MODAL ─── */}
      <ExtendSessionModal
        isOpen={!!extendStation}
        onClose={() => setExtendStation(null)}
        station={extendStation}
        onSuccess={() => {
          setExtendStation(null);
          setSelectedBookingForGrid(null);
          loadBookings(true);
        }}
      />

      {/* ─── END SESSION CONFIRMATION MODAL ─── */}
      <EndSessionModal
        isOpen={!!endSessionTarget}
        onClose={() => setEndSessionTarget(null)}
        target={endSessionTarget}
        onSuccess={() => {
          setEndSessionTarget(null);
          setSelectedBookingForGrid(null);
          loadBookings(true);
        }}
      />
    </div>
  );
}
