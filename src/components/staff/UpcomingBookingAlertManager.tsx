'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Clock,
  AlertTriangle,
  Play,
  X,
  Volume2,
  VolumeX,
  Minus,
  Maximize2,
  Calendar,
  Gamepad2,
  CheckCircle2,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import {
  isAlarmSoundEnabled,
  setAlarmSoundEnabled,
  playBookingDueAlarm,
  playEndingSoonAlarm,
} from '@/lib/soundAlarm';
import { sendMobilePushNotification } from '@/lib/pushNotifications';

export interface UpcomingSlotAlert {
  id: string; // `${bookingId}-${stage}`
  bookingId: string;
  bookingRef: string;
  customerName: string;
  customerPhone?: string;
  stationId: string;
  stationName: string;
  facilityName?: string;
  startTime: string;
  endTime: string;
  stage: '15m' | '5m' | 'due';
  diffMs: number;
  paymentStatus?: string;
  totalPricePaise?: number;
}

export function UpcomingBookingAlertManager() {
  const pathname = usePathname();
  const isOnBookingsPage = pathname?.startsWith('/staff/bookings');

  const [alerts, setAlerts] = useState<UpcomingSlotAlert[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname.startsWith('/staff/bookings');
    }
    return false;
  });

  // When navigating to /staff/bookings, auto-minimize to avoid obscuring the schedule table
  useEffect(() => {
    if (isOnBookingsPage) {
      setIsMinimized(true);
    }
  }, [pathname, isOnBookingsPage]);

  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(() => !isAlarmSoundEnabled());

  // Synchronize mute state with global sound alarm settings
  useEffect(() => {
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<{ enabled: boolean }>;
      if (customEvent.detail) {
        setIsMuted(!customEvent.detail.enabled);
      } else {
        setIsMuted(!isAlarmSoundEnabled());
      }
    };
    window.addEventListener('ds-alarm-sound-changed', handleSync);
    return () => window.removeEventListener('ds-alarm-sound-changed', handleSync);
  }, []);

  const toast = useToast();
  const triggeredMilestones = useRef<Map<string, Set<string>>>(new Map());
  const dismissedAlertIds = useRef<Set<string>>(new Set());
  const rawBookingsRef = useRef<any[]>([]);

  // Toggle Mute
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    setAlarmSoundEnabled(!nextMuted);
  };

  // Poll for upcoming confirmed bookings every 15 seconds
  const fetchUpcomingBookings = async () => {
    try {
      const res = await fetch('/api/admin/bookings?status=CONFIRMED');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        rawBookingsRef.current = json.data;
        evaluateAlerts();
      }
    } catch {
      // Ignore background errors
    }
  };

  // Evaluate alerts every second against current time
  const evaluateAlerts = () => {
    const now = Date.now();
    const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const currentAlerts: UpcomingSlotAlert[] = [];

    for (const b of rawBookingsRef.current) {
      if (b.status !== 'CONFIRMED' || !b.startTime) continue;

      // Filter only for today's bookings
      const startIST = new Date(b.startTime).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const dateIST = b.date ? new Date(b.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : '';
      if (startIST !== todayIST && dateIST !== todayIST) continue;

      const startMs = new Date(b.startTime).getTime();
      const diffMs = startMs - now;

      // We alert when:
      // 1. Starts in <= 15 minutes
      // 2. Or is overdue/due for checkin up to 90 minutes past start time
      if (diffMs > 15 * 60 * 1000 || diffMs < -90 * 60 * 1000) continue;

      let stage: '15m' | '5m' | 'due' = '15m';
      if (diffMs <= 0) {
        stage = 'due';
      } else if (diffMs <= 5 * 60 * 1000) {
        stage = '5m';
      } else {
        stage = '15m';
      }

      const alertId = `${b.id}-${stage}`;
      if (dismissedAlertIds.current.has(alertId)) continue;

      // Play audio chime once per milestone
      let milestones = triggeredMilestones.current.get(b.id);
      if (!milestones) {
        milestones = new Set();
        triggeredMilestones.current.set(b.id, milestones);
      }

      if (!milestones.has(stage)) {
        milestones.add(stage);
        setIsMinimized(false); // Pop up to ensure visibility
        if (!isMuted) {
          const stationLabel = b.station?.name || b.stationName || 'Gaming Station';
          const guestLabel = b.customerName || `${b.user?.firstName || 'Gamer'} ${b.user?.lastName || ''}`.trim();
          if (stage === 'due') {
            playBookingDueAlarm();
            sendMobilePushNotification(`🎮 RESERVATION READY: ${stationLabel}`, {
              body: `Player: ${guestLabel} • Slot is starting now! Ready to check in.`,
              tag: `booking-due-${b.id}`,
              url: '/staff/bookings/online',
            });
          } else {
            playEndingSoonAlarm();
            const stageLabel = stage === '5m' ? '5 Mins' : '15 Mins';
            sendMobilePushNotification(`📅 Upcoming Slot (${stageLabel}): ${stationLabel}`, {
              body: `Player: ${guestLabel} • Arriving in ${stageLabel}.`,
              tag: `booking-upcoming-${stage}-${b.id}`,
              url: '/staff/bookings/online',
            });
          }
        }
      }

      currentAlerts.push({
        id: alertId,
        bookingId: b.id,
        bookingRef: b.bookingRef,
        customerName: b.customerName || `${b.user?.firstName || 'Gamer'} ${b.user?.lastName || ''}`.trim(),
        customerPhone: b.customerPhone || b.user?.phone,
        stationId: b.stationId,
        stationName: b.station?.name || b.stationName || 'Gaming Station',
        facilityName: b.station?.facility?.name || b.facilityName || 'Arena',
        startTime: b.startTime,
        endTime: b.endTime,
        stage,
        diffMs,
        paymentStatus: b.paymentStatus || (b.payments && b.payments[0]?.status) || 'COMPLETED',
        totalPricePaise: b.totalPricePaise || 0,
      });
    }

    setAlerts(currentAlerts);
  };

  useEffect(() => {
    fetchUpcomingBookings();
    const pollInterval = setInterval(fetchUpcomingBookings, 30000);
    const tickInterval = setInterval(evaluateAlerts, 1000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(tickInterval);
    };
  }, [isMuted]);

  // Quick Check In from alert
  const handleQuickCheckIn = async (alert: UpcomingSlotAlert) => {
    setCheckingInId(alert.bookingId);
    try {
      const res = await fetch('/api/staff/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: alert.bookingRef,
          autoStartSession: true,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`Session started for ${alert.customerName} on ${alert.stationName}!`);
        dismissedAlertIds.current.add(alert.id);
        setAlerts((prev) => prev.filter((a) => a.bookingId !== alert.bookingId));
        // Remove from rawBookingsRef
        rawBookingsRef.current = rawBookingsRef.current.filter((b) => b.id !== alert.bookingId);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ds-booking-updated'));
        }
      } else {
        toast.error(json.error?.message || 'Check-in failed');
      }
    } catch {
      toast.error('Network error during check-in');
    } finally {
      setCheckingInId(null);
    }
  };

  const handleDismiss = (alertId: string) => {
    dismissedAlertIds.current.add(alertId);
    setAlerts((prev) => {
      const remaining = prev.filter((a) => a.id !== alertId);
      if (currentIndex >= remaining.length) {
        setCurrentIndex(Math.max(0, remaining.length - 1));
      }
      return remaining;
    });
  };

  const handleSnooze = (alert: UpcomingSlotAlert) => {
    dismissedAlertIds.current.add(alert.id);
    setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
    toast.info(`Alert for ${alert.stationName} snoozed`);
  };

  if (alerts.length === 0) return null;

  const safeIndex = Math.min(currentIndex, alerts.length - 1);
  const currentAlert = alerts[safeIndex] || alerts[0];
  const isDue = currentAlert.stage === 'due';
  const is5m = currentAlert.stage === '5m';

  const startTimeFormatted = new Date(currentAlert.startTime).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const endTimeFormatted = new Date(currentAlert.endTime).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Calculate live minutes and seconds to start
  const diffSecTotal = Math.floor(Math.abs(currentAlert.diffMs) / 1000);
  const diffMins = Math.floor(diffSecTotal / 60);
  const diffSecs = diffSecTotal % 60;

  return (
    <>
      {/* ─── MINIMIZED FLOATING BADGE (BOTTOM-LEFT) ─── */}
      {isMinimized && (
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className={`fixed bottom-6 left-6 z-40 pointer-events-auto bg-ds-dark/95 backdrop-blur-xl rounded-2xl p-3 px-4 shadow-2xl flex items-center gap-3 text-xs text-white transition-all border-2 animate-bounce ${
            isDue
              ? 'border-rose-500 shadow-rose-500/20'
              : is5m
              ? 'border-amber-400 shadow-amber-400/20'
              : 'border-cyan-400 shadow-cyan-400/20'
          }`}
        >
          <span className="relative flex h-3 w-3">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isDue ? 'bg-rose-500' : is5m ? 'bg-amber-400' : 'bg-cyan-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${
                isDue ? 'bg-rose-500' : is5m ? 'bg-amber-400' : 'bg-cyan-400'
              }`}
            />
          </span>
          <div className="text-left">
            <div
              className={`font-heading font-black tracking-wider uppercase text-[11px] ${
                isDue ? 'text-rose-300' : is5m ? 'text-amber-300' : 'text-cyan-300'
              }`}
            >
              {alerts.length} Upcoming {alerts.length === 1 ? 'Slot' : 'Slots'} Near
            </div>
            <div className="text-[10px] text-white/75 font-mono">
              {currentAlert.stationName} • {isDue ? 'Slot Due Now!' : `in ${diffMins}m ${diffSecs}s`}
            </div>
          </div>
          <Maximize2 className="w-4 h-4 text-white/60 ml-1" />
        </button>
      )}

      {/* ─── EXPANDED ALERT DOCKED CARD (BOTTOM-RIGHT / TOP ON MOBILE) ─── */}
      {!isMinimized && (
        <div className="fixed bottom-6 right-6 z-40 max-w-sm sm:max-w-md w-full animate-slide-up pointer-events-auto">
          <div
            className={`p-4 sm:p-5 rounded-2xl shadow-2xl border-2 backdrop-blur-2xl transition-all overflow-hidden ${
              isDue
                ? 'bg-[#15070a]/95 border-rose-500/90 shadow-[0_0_30px_rgba(244,63,94,0.3)] ring-1 ring-rose-500/40'
                : is5m
                ? 'bg-[#191005]/95 border-amber-400/90 shadow-[0_0_30px_rgba(251,191,36,0.3)] ring-1 ring-amber-400/40'
                : 'bg-[#06141f]/95 border-cyan-400/90 shadow-[0_0_30px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400/40'
            }`}
          >
            {/* Header: Broadcast Title + Status Badge + Controls */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      isDue ? 'bg-rose-500' : is5m ? 'bg-amber-400' : 'bg-cyan-400'
                    }`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-3 w-3 ${
                      isDue ? 'bg-rose-500' : is5m ? 'bg-amber-400' : 'bg-cyan-400'
                    }`}
                  />
                </span>
                <span
                  className={`font-heading font-black text-xs uppercase tracking-wider ${
                    isDue ? 'text-rose-300' : is5m ? 'text-amber-300' : 'text-cyan-300'
                  }`}
                >
                  {isDue ? '🚨 Booked Slot Due Now' : is5m ? '⏳ Slot Imminent (5m)' : '⏰ Upcoming Slot Near (15m)'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Audio Mute Button */}
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className={`p-1.5 rounded-lg border transition-colors ${
                    isMuted
                      ? 'border-white/10 text-white/40 hover:text-white hover:bg-white/10'
                      : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20'
                  }`}
                  title={isMuted ? 'Unmute chime' : 'Mute chime'}
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>

                {/* Minimize Button */}
                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  className="p-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  title="Minimize"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => handleDismiss(currentAlert.id)}
                  className="p-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Multiple Alerts Navigator Tabs */}
            {alerts.length > 1 && (
              <div className="flex items-center justify-between gap-1.5 pt-2 pb-1 overflow-x-auto no-scrollbar">
                {alerts.map((a, idx) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`px-2 py-0.5 rounded text-[10px] font-heading font-bold uppercase tracking-wider shrink-0 transition-all ${
                      idx === safeIndex
                        ? 'bg-white text-black shadow-sm'
                        : 'bg-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    <span>{a.stationName}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Main Alert Card Body */}
            <div className="pt-3 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-base font-heading font-black text-white leading-tight">
                    {currentAlert.stationName}
                  </h4>
                  <div className="text-[11px] text-cyan-300 font-mono mt-0.5">
                    {currentAlert.facilityName}
                  </div>
                </div>

                {/* Live Countdown Badge */}
                <div className="text-right shrink-0">
                  <div
                    className={`text-sm font-mono font-black ${
                      isDue ? 'text-rose-400 animate-pulse' : is5m ? 'text-amber-400' : 'text-cyan-300'
                    }`}
                  >
                    {isDue ? 'DUE NOW' : `${diffMins}m ${diffSecs}s`}
                  </div>
                  <div className="text-[10px] text-white/60 font-mono">
                    {isDue ? 'Overdue' : 'until start'}
                  </div>
                </div>
              </div>

              {/* Player & Booking Details */}
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 text-xs space-y-1">
                <div className="flex items-center justify-between text-white/90">
                  <span className="font-heading font-bold">{currentAlert.customerName}</span>
                  <span className="font-mono text-[11px] text-white/60">{currentAlert.bookingRef}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-white/70 font-mono">
                  <span>Slot Window:</span>
                  <span className="text-cyan-300 font-bold">{startTimeFormatted} – {endTimeFormatted}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-white/70 font-mono">
                  <span>Payment:</span>
                  <span
                    className={`font-bold ${
                      currentAlert.paymentStatus === 'COMPLETED'
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {currentAlert.paymentStatus === 'COMPLETED'
                      ? `PAID ONLINE (₹${((currentAlert.totalPricePaise || 0) / 100).toFixed(0)})`
                      : `DUE AT DESK (₹${((currentAlert.totalPricePaise || 0) / 100).toFixed(0)})`}
                  </span>
                </div>
                {currentAlert.customerPhone && (
                  <div className="flex items-center justify-between text-[11px] text-white/70 font-mono">
                    <span>WhatsApp:</span>
                    <span>{currentAlert.customerPhone}</span>
                  </div>
                )}
              </div>

              {/* Bottom Quick Action Buttons */}
              <div className="pt-2 flex items-center gap-2">
                <Button
                  variant="accent"
                  size="sm"
                  onClick={() => handleQuickCheckIn(currentAlert)}
                  disabled={checkingInId === currentAlert.bookingId}
                  className="flex-1 justify-center text-xs py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-black uppercase tracking-wider shadow-lg shadow-emerald-500/20"
                >
                  <Play className="w-3.5 h-3.5 mr-1 fill-black" />
                  <span>{checkingInId === currentAlert.bookingId ? 'Checking In...' : 'Quick Check In'}</span>
                </Button>

                <Link href="/staff/bookings/online" className="shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs py-2 px-3 border-white/20 text-white/80 hover:text-white hover:bg-white/10"
                    title="View in full schedule"
                  >
                    <Calendar className="w-3.5 h-3.5 mr-1 text-cyan-400" />
                    <span>Schedule</span>
                  </Button>
                </Link>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSnooze(currentAlert)}
                  className="text-xs py-2 px-2 text-white/50 hover:text-white"
                  title="Snooze for 5 minutes"
                >
                  Snooze
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
