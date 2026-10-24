'use client';

import { useState, useEffect, useRef, useCallback, type ComponentProps } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  Calendar,
  ExternalLink,
  Play,
  Info,
  Square,
  PlusCircle,
  Gamepad2,
  UserPlus,
  RotateCcw,
  X,
  Download,
} from 'lucide-react';
import { ExtendSessionModal } from '@/components/staff/ExtendSessionModal';
import { EndSessionModal, type EndSessionTarget } from '@/components/staff/EndSessionModal';
import { WalkInModal } from '@/components/staff/WalkInModal';
import { StaffArenaPickerModal } from '@/components/staff/StaffArenaPickerModal';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import { canManageStaffSession, sessionHourlyRatePaise } from '@/lib/staffSessionRules';
import { serializeCsv } from '@/lib/csv';
import {
  filterStaffBookings,
  isActiveStaffBooking,
  staffBookingDateInIST,
  type StaffBookingView,
  type StaffDateFilter,
} from '@/lib/staffBookingViews';

export function StaffBookingsView({ view }: { view: StaffBookingView }) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateScope, setDateScope] = useState<StaffDateFilter['kind']>('ALL');
  const [selectedDate, setSelectedDate] = useState('');
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const requestId = useRef(0);

  // Modal states
  const [selectedBookingForGrid, setSelectedBookingForGrid] = useState<any | null>(null);
  const [extendStation, setExtendStation] = useState<any | null>(null);
  const [endSessionTarget, setEndSessionTarget] = useState<EndSessionTarget | null>(null);
  const [updatingPlayerBookingId, setUpdatingPlayerBookingId] = useState<string | null>(null);
  const [liveCategoryPickerOpen, setLiveCategoryPickerOpen] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInCategory, setWalkInCategory] = useState<'PS5' | 'POOL_TABLE'>('PS5');
  const [walkInStations, setWalkInStations] = useState<ComponentProps<typeof WalkInModal>['stations']>([]);
  const [startingLive, setStartingLive] = useState(false);

  // Live real-time ticker
  const [currentTime, setCurrentTime] = useState(Date.now());
  const toast = useToast();
  const notifyError = toast.error;
  const todayIST = new Date(currentTime).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const requestedDay = dateScope === 'TODAY' ? todayIST : dateScope === 'DATE' ? selectedDate : '';
  const requestedFrom = dateScope === 'RANGE' ? rangeFrom : '';
  const requestedTo = dateScope === 'RANGE' ? rangeTo : '';

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

  // Tick every second for live countdowns
  useEffect(() => {
    const tick = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const loadBookings = useCallback(async (silent = false) => {
    const currentRequest = ++requestId.current;
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (view !== 'ACTIVE') params.set('status', view === 'UPCOMING' ? 'CONFIRMED' : 'COMPLETED');
      if (requestedDay) params.set('day', requestedDay);
      if (requestedFrom) params.set('from', requestedFrom);
      if (requestedTo) params.set('to', requestedTo);
      const query = params.toString();
      const res = await fetch(`/api/admin/bookings${query ? `?${query}` : ''}`);
      const json = await res.json();
      if (currentRequest === requestId.current) {
        if (res.ok && json.success && Array.isArray(json.data)) {
          setBookings(json.data);
        } else if (!silent) {
          setBookings([]);
          notifyError(json.error?.message || 'Failed to load bookings');
        }
      }
    } catch {
      if (!silent && currentRequest === requestId.current) notifyError('Failed to load bookings');
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [view, requestedDay, requestedFrom, requestedTo, notifyError]);

  useEffect(() => {
    const firstLoad = setTimeout(() => { void loadBookings(false); }, 0);
    const interval = setInterval(() => {
      void loadBookings(true); // Silent background polling — zero UI flicker/unmounting
    }, 30000);

    const handleBookingUpdate = () => { void loadBookings(true); };
    if (typeof window !== 'undefined') {
      window.addEventListener('ds-booking-updated', handleBookingUpdate);
    }

    return () => {
      clearTimeout(firstLoad);
      clearInterval(interval);
      requestId.current++;
      if (typeof window !== 'undefined') {
        window.removeEventListener('ds-booking-updated', handleBookingUpdate);
      }
    };
  }, [loadBookings]);

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

  const startLiveSession = async (category: 'PS5' | 'POOL_TABLE') => {
    setStartingLive(true);
    try {
      const response = await fetch('/api/staff/overview');
      const json = await response.json();
      if (!response.ok || !json.success || !Array.isArray(json.data?.stations)) throw new Error(json.error?.message || 'Could not load stations');
      const stations = json.data.stations as ComponentProps<typeof WalkInModal>['stations'];
      if (!stations.some((station) => station.stationType === category)) throw new Error('No stations are configured for this arena');
      setWalkInStations(stations);
      setWalkInCategory(category);
      setLiveCategoryPickerOpen(false);
      setWalkInOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start a session');
    } finally {
      setStartingLive(false);
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
      pricePerHourPaise: sessionHourlyRatePaise(booking.stationType, booking.pricePerHourPaise || 15000, booking.playerCount || 1),
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
      pricePerHourPaise: sessionHourlyRatePaise(booking.stationType, booking.pricePerHourPaise || 15000, booking.playerCount || 1),
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

  const getIsToday = (booking: any) => staffBookingDateInIST(booking, 'UPCOMING') === todayIST;
  const getIsSessionActive = isActiveStaffBooking;
  const filteredBookings = filterStaffBookings(bookings, view, { kind: dateScope, date: selectedDate, from: rangeFrom, to: rangeTo, today: todayIST });
  const downloadHistory = () => {
    const rows: Array<Array<string | number | null | undefined>> = [
      ['Booking Ref', 'Station', 'Facility', 'Customer', 'Phone', 'Start (IST)', 'Completed (IST)', 'Duration (minutes)', 'Amount (INR)', 'Payment Method'],
      ...filteredBookings.map((booking) => [
        booking.bookingRef || booking.id,
        booking.stationName,
        booking.facilityName,
        booking.customerName,
        booking.customerPhone || '',
        new Date(booking.startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        new Date(booking.session?.endedAt || booking.updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        booking.durationMinutes,
        (booking.totalPricePaise / 100).toFixed(2),
        booking.paymentMethod || 'OTHER',
      ]),
    ];
    const url = URL.createObjectURL(new Blob(['\uFEFF', serializeCsv(rows)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `session-history-${todayIST}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const nearUpcomingBookings = filterStaffBookings(bookings, 'UPCOMING', { kind: 'TODAY', today: todayIST }).filter((b) => {
    if (!b.startTime) return false;
    const diffMs = new Date(b.startTime).getTime() - currentTime;
    return diffMs <= 15 * 60 * 1000 && diffMs >= -90 * 60 * 1000;
  });

  const dueBookingsCount = nearUpcomingBookings.filter(
    (b) => new Date(b.startTime).getTime() <= currentTime
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <h1 className="text-xl sm:text-2xl font-heading font-black uppercase text-ds-text tracking-tight">
              {view === 'ACTIVE' ? 'In Sessions' : view === 'UPCOMING' ? 'Online Booking' : 'History'}
            </h1>
            <Badge variant="accent" size="sm" className="font-mono whitespace-nowrap shrink-0">
              {filteredBookings.length} {view === 'ACTIVE' ? 'In Session' : view === 'UPCOMING' ? 'Upcoming' : 'Completed'}
            </Badge>
            {view === 'UPCOMING' && nearUpcomingBookings.length > 0 && (
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
        </div>
        {view === 'ACTIVE' && <button type="button" onClick={() => setLiveCategoryPickerOpen(true)} className="ml-auto inline-flex items-center gap-2 rounded-xl border border-cyan-400/50 bg-cyan-500/15 px-3 py-2 text-xs sm:text-sm font-heading font-bold text-cyan-300 hover:bg-cyan-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"><Play className="h-4 w-4" /> Start Live Session</button>}
      </div>

      {view === 'UPCOMING' && nearUpcomingBookings.length > 0 && dateScope !== 'DATE' && (
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

      {view !== 'ACTIVE' && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ds-border bg-ds-surface/50 p-3 sm:p-4">
          <button
            type="button"
            onClick={() => {
              setSelectedDate('');
              setRangeFrom('');
              setRangeTo('');
              setDateScope(dateScope === 'TODAY' ? 'ALL' : 'TODAY');
            }}
            aria-pressed={dateScope === 'TODAY'}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-heading font-bold transition-colors ${
              dateScope === 'TODAY'
                ? 'border-ds-accent/50 bg-ds-accent/20 text-ds-ice'
                : 'border-ds-border text-ds-text-muted hover:border-ds-accent/40 hover:text-white'
            }`}
          >
            <Calendar className="h-4 w-4" />
            Today Only
          </button>
          {view !== 'COMPLETED' && <label className="flex items-center gap-2 text-xs font-heading font-bold text-ds-text-muted">
            Date
            <input
              type="date"
              value={dateScope === 'DATE' ? selectedDate : ''}
              onChange={(event) => {
                setSelectedDate(event.target.value);
                setRangeFrom('');
                setRangeTo('');
                setDateScope(event.target.value ? 'DATE' : 'ALL');
              }}
              className="rounded-xl border border-ds-border bg-ds-dark px-3 py-2 text-ds-text [color-scheme:dark] focus:border-ds-accent focus:outline-none"
            />
          </label>}
          <label className="flex items-center gap-2 text-xs font-heading font-bold text-ds-text-muted">
            From
            <input
              type="date"
              aria-label="From date"
              value={dateScope === 'RANGE' ? rangeFrom : ''}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedDate('');
                setRangeFrom(value);
                if (value && rangeTo && value > rangeTo) setRangeTo('');
                setDateScope(value || rangeTo ? 'RANGE' : 'ALL');
              }}
              className="rounded-xl border border-ds-border bg-ds-dark px-3 py-2 text-ds-text [color-scheme:dark] focus:border-ds-accent focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-heading font-bold text-ds-text-muted">
            To
            <input
              type="date"
              aria-label="To date"
              value={dateScope === 'RANGE' ? rangeTo : ''}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedDate('');
                setRangeTo(value);
                if (value && rangeFrom && value < rangeFrom) setRangeFrom('');
                setDateScope(value || rangeFrom ? 'RANGE' : 'ALL');
              }}
              className="rounded-xl border border-ds-border bg-ds-dark px-3 py-2 text-ds-text [color-scheme:dark] focus:border-ds-accent focus:outline-none"
            />
          </label>
          {dateScope === 'ALL' && <span className="text-xs text-ds-text-dim">All dates</span>}
          <button
            type="button"
            disabled={dateScope === 'ALL'}
            onClick={() => {
              setSelectedDate('');
              setRangeFrom('');
              setRangeTo('');
              setDateScope('ALL');
            }}
            aria-label="Clear date filters"
            title="Clear date filters"
            className="inline-flex items-center gap-1 rounded-lg border border-ds-border px-2 py-2 text-xs text-ds-text-muted hover:text-white hover:border-ds-accent disabled:opacity-40 disabled:cursor-not-allowed"
          ><X className="h-3.5 w-3.5" /> Clear</button>
          {view === 'COMPLETED' && <button type="button" onClick={downloadHistory} disabled={loading || filteredBookings.length === 0} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-ds-accent/50 px-3 py-2 text-xs font-heading font-bold text-ds-ice hover:bg-ds-accent/10 disabled:opacity-40 disabled:cursor-not-allowed"><Download className="h-4 w-4" /> Download CSV</button>}
        </div>
      )}

      {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-ds-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-ds-text-muted">Loading bookings...</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="p-12 text-center bg-ds-surface/30 rounded-2xl border border-dashed border-ds-border text-ds-text-dim space-y-2">
            <p className="text-sm font-heading font-bold text-ds-text">
              {view === 'ACTIVE' ? 'No live sessions right now' : view === 'UPCOMING' ? 'No upcoming online bookings found' : 'No completed sessions found'}
            </p>
            <p className="text-xs text-ds-text-muted">
              {view === 'ACTIVE' ? 'Active sessions will appear here as soon as players check in.' : 'Try another date or turn off Today Only.'}
            </p>
          </div>
        ) : view === 'COMPLETED' ? (
          <div className="space-y-3">
            {filteredBookings.map((b) => (
              <div key={b.id} className="rounded-2xl border border-ds-border bg-ds-surface/40 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-5">
                <div className="min-w-0 lg:w-1/4">
                  <p className="font-heading font-bold text-white truncate">{b.stationName}</p>
                  <p className="font-mono text-xs text-ds-accent">{b.bookingRef}</p>
                  <p className="text-xs text-ds-text-muted">{b.facilityName}</p>
                </div>
                <div className="min-w-0 lg:w-1/5">
                  <p className="text-sm font-bold text-white">{b.customerName}</p>
                  <p className="text-xs text-ds-text-muted">{b.customerPhone || b.customerEmail || 'No contact'}</p>
                </div>
                <div className="min-w-0 lg:flex-1 text-xs font-mono text-ds-text-muted">
                  <p className="text-ds-ice">{new Date(b.startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</p>
                  <p>{b.durationMinutes} min · Completed {new Date(b.session?.endedAt || b.updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}</p>
                  {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && <p>Booked by staff: {b.staffName || 'Unassigned'}</p>}
                </div>
                <div className="lg:text-right shrink-0">
                  <p className="font-mono font-bold text-white">₹{(b.totalPricePaise / 100).toFixed(0)}</p>
                  <p className="text-[10px] font-mono uppercase text-ds-text-muted">{b.paymentMethod || 'OTHER'} · Completed</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/booking/confirmation/${b.bookingRef || b.id}`} target="_blank" aria-label={`Receipt for ${b.bookingRef}`} className="p-2.5 rounded-xl border border-ds-border text-ds-ice hover:border-ds-accent">
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                  <button type="button" onClick={() => setSelectedBookingForGrid(b)} aria-label={`Details for ${b.bookingRef}`} className="p-2.5 rounded-xl border border-ds-border text-ds-ice hover:border-ds-accent">
                    <Info className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
            {filteredBookings.map((b) => {
              const isSessionActive = getIsSessionActive(b);
              const canManage = canManageStaffSession(user?.role, user?.id, b.staffId);
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
                          {isSessionActive && canManage && (
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
                    {isSessionActive && canManage ? (
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
                    ) : isSessionActive ? (
                      <span className="text-xs text-ds-text-muted">Managed by {b.staffName || 'another staff member'}</span>
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
      }

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
            const canManage = canManageStaffSession(user?.role, user?.id, b.staffId);
            const isSnooker = b.isSnooker ?? (b.stationType === 'POOL_TABLE' || b.stationName?.toUpperCase().includes('SNOOKER') || b.stationName?.toUpperCase().includes('POOL'));
            const currentPlayers = b.playerCount || (isSnooker ? 4 : 1);
            const scheduledEnd = b.session?.scheduledEndAt || b.endTime;
            const sessionStart = b.session?.startedAt || b.startTime;
            const countdown = isSessionActive ? getCountdown(scheduledEnd, sessionStart) : null;
            const actualMinutes = b.session?.startedAt && b.session?.endedAt
              ? Math.max(0, Math.round((new Date(b.session.endedAt).getTime() - new Date(b.session.startedAt).getTime()) / 60000))
              : null;

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
                          End: {new Date(scheduledEnd).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
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
                          {new Date(b.startTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} –{' '}
                          {new Date(b.endTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Primary Operational Actions (Matching Image 1) */}
                  {isSessionActive && canManage && (
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
                  <div className="flex justify-between items-center">
                    <span className="text-ds-text-dim">Number of Players:</span>
                    <span className="font-bold text-ds-text">{currentPlayers}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-ds-text-dim">Booked Duration:</span>
                    <span className="font-bold text-ds-text">{Math.floor(b.durationMinutes / 60)}h {b.durationMinutes % 60}m</span>
                  </div>
                  {actualMinutes !== null && (
                    <div className="flex justify-between items-center">
                      <span className="text-ds-text-dim">Actual Session:</span>
                      <span className="font-bold text-ds-text">{Math.floor(actualMinutes / 60)}h {actualMinutes % 60}m</span>
                    </div>
                  )}
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
                      <span className="text-ds-text-dim">Booked by staff:</span>
                      <span className="font-semibold text-emerald-400">{b.staffName}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-ds-text-dim">Price:</span>
                    <span className="font-bold text-ds-text">₹{(b.totalPricePaise / 100).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-ds-text-dim">Payment Mode:</span>
                    <span className="font-bold text-ds-text">{b.paymentMethod || 'Unpaid'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-ds-text-dim">Payment Status:</span>
                    <span className="font-bold text-ds-text">{b.paymentStatus}</span>
                  </div>
                </div>

                {/* Quick Link Footer */}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-ds-text-dim">Reference: {b.bookingRef}</span>

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

      <StaffArenaPickerModal
        isOpen={liveCategoryPickerOpen}
        onClose={() => setLiveCategoryPickerOpen(false)}
        onSelect={(arena) => void startLiveSession(arena)}
        accessibleTitle="Choose arena for live session"
        busy={startingLive}
      />
      <WalkInModal isOpen={walkInOpen} onClose={() => setWalkInOpen(false)} stations={walkInStations} initialCategory={walkInCategory} onSuccess={() => { void loadBookings(true); window.dispatchEvent(new Event('ds-booking-updated')); }} />
    </div>
  );
}
