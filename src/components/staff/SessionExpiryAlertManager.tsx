'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Clock,
  AlertTriangle,
  AlertCircle,
  Volume2,
  VolumeX,
  X,
  PlusCircle,
  Square,
  Gamepad2,
  User,
  Minus,
  ChevronLeft,
  ChevronRight,
  Maximize2,
} from 'lucide-react';
import { ExtendSessionModal } from '@/components/staff/ExtendSessionModal';
import { EndSessionModal, type EndSessionTarget } from '@/components/staff/EndSessionModal';
import {
  isAlarmSoundEnabled,
  setAlarmSoundEnabled,
  playEndingSoonAlarm,
  playOverdueAlarm,
} from '@/lib/soundAlarm';

export interface ActiveSessionData {
  stationId: string;
  stationName: string;
  pricePerHourPaise: number;
  sessionId: string;
  bookingId?: string;
  bookingRef?: string;
  customerName: string;
  customerPhone?: string;
  scheduledEndAt: string;
}

export interface SessionAlert {
  id: string; // `${stationId}-${stage}`
  session: ActiveSessionData;
  stage: '15m' | '10m' | '5m' | 'extra';
  remainingSeconds: number;
  extraMinutes: number;
  createdAt: number;
}

export function SessionExpiryAlertManager() {
  const [activeSessions, setActiveSessions] = useState<ActiveSessionData[]>([]);
  const [alerts, setAlerts] = useState<SessionAlert[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(() => !isAlarmSoundEnabled());
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  // Modals controlled directly from alerts
  const [extendStation, setExtendStation] = useState<any | null>(null);
  const [endSessionTarget, setEndSessionTarget] = useState<EndSessionTarget | null>(null);

  // Track which milestones have been triggered to prevent duplicate alerts
  const triggeredMilestones = useRef<Map<string, Set<string>>>(new Map());
  const lastOverdueChimeTime = useRef<Map<string, number>>(new Map());
  const dismissedAlertIds = useRef<Set<string>>(new Set());

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

  // Toggle Mute
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    setAlarmSoundEnabled(!nextMuted);
  };

  // Poll for active stations every 10 seconds
  const fetchActiveSessions = async () => {
    try {
      const res = await fetch('/api/staff/overview');
      const json = await res.json();
      if (json.success && json.data?.stations) {
        const list: ActiveSessionData[] = [];
        for (const st of json.data.stations) {
          if (st.activeSession) {
            list.push({
              stationId: st.id,
              stationName: st.name,
              pricePerHourPaise: st.pricePerHourPaise || 15000,
              sessionId: st.activeSession.id,
              bookingId: st.activeSession.bookingId,
              bookingRef: st.activeSession.bookingRef,
              customerName: st.activeSession.customerName || 'Player',
              customerPhone: st.activeSession.customerPhone,
              scheduledEndAt: st.activeSession.scheduledEndAt,
            });
          }
        }
        setActiveSessions(list);
      }
    } catch {
      // Ignore background errors
    }
  };

  useEffect(() => {
    fetchActiveSessions();
    const interval = setInterval(fetchActiveSessions, 30000);
    const handleBookingUpdate = () => fetchActiveSessions();
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

  // 1-second live countdown evaluator
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const newAlerts: SessionAlert[] = [];

      for (const session of activeSessions) {
        if (!session.scheduledEndAt) continue;
        const endTime = new Date(session.scheduledEndAt).getTime();
        const diffMs = endTime - now;
        const remainingSec = Math.floor(diffMs / 1000);

        let stage: '15m' | '10m' | '5m' | 'extra' | null = null;
        let extraMins = 0;

        if (diffMs <= 0) {
          stage = 'extra';
          extraMins = Math.max(1, Math.floor(Math.abs(diffMs) / 60000));
        } else if (remainingSec <= 5 * 60) {
          stage = '5m';
        } else if (remainingSec <= 10 * 60) {
          stage = '10m';
        } else if (remainingSec <= 15 * 60) {
          stage = '15m';
        }

        if (stage) {
          const alertId = `${session.sessionId || session.stationId}-${stage}`;
          const isDismissed = dismissedAlertIds.current.has(alertId);

          if (!isDismissed) {
            // Check if we already played sound for this stage
            let stationMilestones = triggeredMilestones.current.get(session.sessionId || session.stationId);
            if (!stationMilestones) {
              stationMilestones = new Set();
              triggeredMilestones.current.set(session.sessionId || session.stationId, stationMilestones);
            }

            if (!stationMilestones.has(stage)) {
              stationMilestones.add(stage);
              // Auto un-minimize so staff immediately sees new milestone in center
              setIsMinimized(false);
              if (!isMuted) {
                if (stage === 'extra') {
                  lastOverdueChimeTime.current.set(session.sessionId || session.stationId, now);
                  playOverdueAlarm();
                } else {
                  playEndingSoonAlarm();
                }
              }
            } else if (stage === 'extra' && !isMuted) {
              // Re-chime urgent alarm every 45s while station remains in unmetered overtime
              const lastChime = lastOverdueChimeTime.current.get(session.sessionId || session.stationId) || 0;
              if (now - lastChime > 45000) {
                lastOverdueChimeTime.current.set(session.sessionId || session.stationId, now);
                playOverdueAlarm();
              }
            }

            newAlerts.push({
              id: alertId,
              session,
              stage,
              remainingSeconds: Math.max(0, remainingSec),
              extraMinutes: extraMins,
              createdAt: now,
            });
          }
        }
      }

      setAlerts(newAlerts);
    }, 1000);

    return () => clearInterval(timer);
  }, [activeSessions, isMuted]);

  // Dismiss a specific alert
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

  // Dismiss all active alerts
  const handleDismissAll = () => {
    alerts.forEach((a) => dismissedAlertIds.current.add(a.id));
    setAlerts([]);
    setCurrentIndex(0);
  };

  // Open Extend Modal from Alert
  const handleOpenExtend = (alert: SessionAlert) => {
    setExtendStation({
      id: alert.session.stationId,
      name: alert.session.stationName,
      pricePerHourPaise: alert.session.pricePerHourPaise,
      activeSession: {
        id: alert.session.sessionId,
        bookingId: alert.session.bookingId,
        customerName: alert.session.customerName,
        bookingRef: alert.session.bookingRef,
        scheduledEndAt: alert.session.scheduledEndAt,
      },
    });
  };

  // Open End Session Modal from Alert
  const handleOpenEndSession = (alert: SessionAlert) => {
    setEndSessionTarget({
      sessionId: alert.session.sessionId,
      stationId: alert.session.stationId,
      stationName: alert.session.stationName,
      bookingId: alert.session.bookingId,
      customerName: alert.session.customerName,
      bookingRef: alert.session.bookingRef,
      scheduledEndAt: alert.session.scheduledEndAt,
      pricePerHourPaise: alert.session.pricePerHourPaise,
    });
  };

  const handleSessionActionComplete = (stationId?: string) => {
    if (stationId) {
      setActiveSessions((prev) => prev.filter((s) => s.stationId !== stationId));
      setAlerts((prev) => prev.filter((a) => a.session.stationId !== stationId));
    }
    fetchActiveSessions();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('ds-booking-updated'));
    }
  };

  // If no alerts exist, only keep the standalone modals ready in DOM
  if (alerts.length === 0) {
    return (
      <>
        <ExtendSessionModal
          isOpen={Boolean(extendStation)}
          onClose={() => setExtendStation(null)}
          station={extendStation}
          onSuccess={() => {
            const stId = extendStation?.id;
            setExtendStation(null);
            handleSessionActionComplete(stId);
          }}
        />
        <EndSessionModal
          isOpen={Boolean(endSessionTarget)}
          onClose={() => setEndSessionTarget(null)}
          target={endSessionTarget}
          onSuccess={() => {
            const stId = endSessionTarget?.stationId;
            setEndSessionTarget(null);
            handleSessionActionComplete(stId);
          }}
        />
      </>
    );
  }

  // Active Alert in current focus
  const safeIndex = Math.min(currentIndex, alerts.length - 1);
  const currentAlert = alerts[safeIndex] || alerts[0];
  const isExtra = currentAlert.stage === 'extra';
  const is5m = currentAlert.stage === '5m';
  const is10m = currentAlert.stage === '10m';

  const mins = Math.floor(currentAlert.remainingSeconds / 60);
  const secs = currentAlert.remainingSeconds % 60;
  const formattedRemaining = `${mins}:${secs.toString().padStart(2, '0')}`;

  const overtimeCharge = isExtra
    ? Math.max(10, Math.round((currentAlert.extraMinutes / 60) * (currentAlert.session.pricePerHourPaise / 100)))
    : 0;

  // Don't show centered alert backdrop while staff is actively using Extend or End Session modal
  const isActionModalOpen = Boolean(extendStation || endSessionTarget);

  return (
    <>
      {/* ─── MINIMIZED FLOATING BADGE (BOTTOM-RIGHT) ─── */}
      {isMinimized && !isActionModalOpen && (
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="fixed bottom-6 right-6 z-40 pointer-events-auto bg-ds-dark/95 border-2 border-rose-500/80 hover:border-rose-400 backdrop-blur-xl rounded-2xl p-3 px-4 shadow-2xl flex items-center gap-3 text-xs text-white hover:bg-ds-surface transition-all animate-bounce"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
          </span>
          <div className="text-left">
            <div className="font-heading font-black tracking-wider uppercase text-rose-300">
              {alerts.length} Active Floor {alerts.length === 1 ? 'Alert' : 'Alerts'}
            </div>
            <div className="text-[10px] text-white/70 font-mono">
              {currentAlert.session.stationName} • {isExtra ? `+${currentAlert.extraMinutes}m Overtime` : `${formattedRemaining} Left`}
            </div>
          </div>
          <Maximize2 className="w-4 h-4 text-white/60 ml-1" />
        </button>
      )}

      {/* ─── CENTERED "LITTLE BIG" POPUP SCREEN VIEW MODAL ─── */}
      {!isMinimized && !isActionModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
          {/* Subtle Ambient Radial Backlight */}
          <div
            className={`fixed inset-0 pointer-events-none opacity-20 transition-all duration-700 ${
              isExtra
                ? 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-rose-600 via-transparent to-transparent'
                : is5m
                ? 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-600 via-transparent to-transparent'
                : 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500 via-transparent to-transparent'
            }`}
          />

          <div
            className={`relative w-full max-w-xl sm:max-w-2xl rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-2xl border-2 transition-all animate-scale-in overflow-hidden my-auto ${
              isExtra
                ? 'bg-gradient-to-b from-[#280914] via-[#16060c] to-[#0c0306] border-rose-500/80 shadow-rose-950/80 ring-2 ring-rose-500/30'
                : is5m
                ? 'bg-gradient-to-b from-[#2a1408] via-[#160c05] to-[#0d0703] border-orange-500/80 shadow-orange-950/80 ring-2 ring-orange-500/30'
                : 'bg-gradient-to-b from-[#261b07] via-[#150f04] to-[#0d0a03] border-amber-500/80 shadow-amber-950/80 ring-2 ring-amber-500/30'
            }`}
          >
            {/* Top Bar: Alert Broadcast Title + Action Controls */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      isExtra ? 'bg-rose-500' : is5m ? 'bg-orange-500' : 'bg-amber-400'
                    }`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-3 w-3 ${
                      isExtra ? 'bg-rose-500' : is5m ? 'bg-orange-500' : 'bg-amber-400'
                    }`}
                  />
                </span>
                <span className="font-heading font-black text-xs sm:text-sm tracking-widest uppercase text-white/90">
                  Floor Session Alert {alerts.length > 1 ? `(${safeIndex + 1} of ${alerts.length})` : ''}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Audio Mute Button */}
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className={`p-2 rounded-xl border transition-colors ${
                    isMuted
                      ? 'border-white/10 text-white/40 hover:text-white hover:bg-white/10'
                      : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20'
                  }`}
                  title={isMuted ? 'Unmute chime' : 'Mute chime'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
                </button>

                {/* Minimize Button */}
                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  className="p-2 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  title="Minimize alert to bottom badge"
                >
                  <Minus className="w-4 h-4" />
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => handleDismiss(currentAlert.id)}
                  className="p-2 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  title="Dismiss this alert"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Multiple Stations Navigator Tabs (if multiple alerts) */}
            {alerts.length > 1 && (
              <div className="flex items-center justify-between gap-2 pt-3 pb-1 border-b border-white/10">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                  {alerts.map((a, idx) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      className={`px-3 py-1 rounded-lg font-heading font-bold text-[11px] uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 ${
                        idx === safeIndex
                          ? a.stage === 'extra'
                            ? 'bg-rose-500 text-white shadow-md shadow-rose-500/40'
                            : a.stage === '5m'
                            ? 'bg-orange-500 text-white shadow-md shadow-orange-500/40'
                            : 'bg-amber-400 text-black shadow-md shadow-amber-400/40'
                          : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      <span>{a.session.stationName}</span>
                      <span className="text-[9px] opacity-75 font-mono">
                        {a.stage === 'extra' ? `+${a.extraMinutes}m` : a.stage}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((prev) => (prev > 0 ? prev - 1 : alerts.length - 1))}
                    className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10"
                    title="Previous alert"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((prev) => (prev < alerts.length - 1 ? prev + 1 : 0))}
                    className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10"
                    title="Next alert"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Station Hero Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-5">
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shrink-0 border ${
                    isExtra
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-lg shadow-rose-500/20'
                      : is5m
                      ? 'bg-orange-500/20 text-orange-300 border-orange-500/50 shadow-lg shadow-orange-500/20'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-lg shadow-amber-500/20'
                  }`}
                >
                  {isExtra ? (
                    <AlertCircle className="w-8 h-8 animate-bounce text-rose-400" />
                  ) : is5m ? (
                    <Clock className="w-8 h-8 text-orange-400 animate-pulse" />
                  ) : (
                    <Clock className="w-8 h-8 text-amber-400" />
                  )}
                </div>

                <div>
                  <h2 className="text-2xl sm:text-3xl font-heading font-black text-white uppercase tracking-wider">
                    {currentAlert.session.stationName}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 text-sm text-white/80 font-medium">
                    <User className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="text-white font-bold">{currentAlert.session.customerName}</span>
                    {currentAlert.session.customerPhone && (
                      <>
                        <span className="text-white/40">•</span>
                        <span className="font-mono text-xs text-white/60">{currentAlert.session.customerPhone}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Urgency Badge */}
              <div>
                <Badge
                  variant={isExtra ? 'danger' : 'warning'}
                  size="md"
                  className={`text-xs sm:text-sm font-mono font-black uppercase tracking-wider px-3.5 py-1.5 shadow-lg ${
                    isExtra
                      ? 'bg-rose-500 text-white animate-pulse shadow-rose-500/40'
                      : is5m
                      ? 'bg-orange-500 text-white shadow-orange-500/40'
                      : is10m
                      ? 'bg-amber-500 text-white shadow-amber-500/40'
                      : 'bg-amber-400 text-black shadow-amber-400/40'
                  }`}
                >
                  {isExtra
                    ? `🚨 EXTRA TIME (+${currentAlert.extraMinutes}M)`
                    : is5m
                    ? `⏱️ 5 MIN WARNING`
                    : is10m
                    ? `⏱️ 10 MIN WARNING`
                    : `⏱️ 15 MIN WARNING`}
                </Badge>
              </div>
            </div>

            {/* High-Impact 3-Tile Metric Dossier */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-6">
              {/* Tile 1: Slot End Time */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-1">
                <span className="text-[10px] uppercase font-mono text-white/50 tracking-wider block">
                  Scheduled End Time
                </span>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-base sm:text-lg font-mono font-bold text-white">
                    {(() => {
                      const endDt = new Date(currentAlert.session.scheduledEndAt);
                      const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
                      const endIST = endDt.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
                      if (endIST !== todayIST) {
                        return endDt.toLocaleString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                      }
                      return endDt.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                    })()}
                  </span>
                </div>
                {currentAlert.session.bookingRef && (
                  <span className="text-[10px] font-mono text-white/40 block truncate">
                    Ref: {currentAlert.session.bookingRef}
                  </span>
                )}
              </div>

              {/* Tile 2: Live Time Remaining or Extra Time */}
              <div
                className={`p-4 rounded-2xl border space-y-1 ${
                  isExtra
                    ? 'bg-rose-950/60 border-rose-500/40'
                    : is5m
                    ? 'bg-orange-950/60 border-orange-500/40'
                    : 'bg-amber-950/60 border-amber-500/40'
                }`}
              >
                <span className="text-[10px] uppercase font-mono text-white/60 tracking-wider block">
                  {isExtra ? 'Extra Time Played' : 'Time Remaining'}
                </span>
                <div className="text-xl sm:text-2xl font-mono font-black tracking-tight flex items-baseline gap-1">
                  {isExtra ? (
                    <span className="text-rose-400 animate-pulse">+{currentAlert.extraMinutes} mins</span>
                  ) : (
                    <span className={is5m ? 'text-orange-400 animate-pulse' : 'text-amber-300'}>
                      {formattedRemaining}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-white/60 block">
                  {isExtra ? 'Overdue slot status' : 'Until booking expires'}
                </span>
              </div>

              {/* Tile 3: Estimated Overtime Fee or Hourly Base Rate */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-1">
                <span className="text-[10px] uppercase font-mono text-white/50 tracking-wider block">
                  {isExtra ? 'Estimated Overtime Fee' : 'Station Base Rate'}
                </span>
                <div className="text-xl sm:text-2xl font-mono font-black text-white">
                  {isExtra ? (
                    <span className="text-rose-300 font-bold bg-rose-950/80 px-2.5 py-0.5 rounded border border-rose-500/40 inline-block">
                      ₹{overtimeCharge}
                    </span>
                  ) : (
                    <span className="text-emerald-400 font-bold">
                      ₹{(currentAlert.session.pricePerHourPaise / 100).toFixed(0)}/hr
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-white/40 block">
                  {isExtra
                    ? `Rate: ₹${(currentAlert.session.pricePerHourPaise / 100).toFixed(0)}/hr`
                    : 'Floor rack rate'}
                </span>
              </div>
            </div>

            {/* Clear Narrative Alert Callout Banner */}
            <div
              className={`mt-5 p-4 rounded-2xl border text-sm leading-relaxed ${
                isExtra
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-100'
                  : is5m
                  ? 'bg-orange-500/15 border-orange-500/40 text-orange-100'
                  : 'bg-amber-500/15 border-amber-500/40 text-amber-100'
              }`}
            >
              <div className="flex items-start gap-3">
                {isExtra ? (
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                ) : is5m ? (
                  <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                ) : (
                  <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold text-xs sm:text-sm">
                    {isExtra ? (
                      <>
                        ⚠️ Session slot has ended! The player is currently running in{' '}
                        <strong className="text-white font-black underline">
                          EXTRA TIME (+{currentAlert.extraMinutes} minutes)
                        </strong>
                        . Floor action required: apply an extension or conclude the active session.
                      </>
                    ) : is5m ? (
                      <>
                        🚨 Final <strong className="text-white font-bold">{formattedRemaining}</strong> left for{' '}
                        <strong className="text-white font-bold">{currentAlert.session.customerName}</strong>! Time
                        will end in 5 minutes — check if the player wants to extend now or prepare the station for wrap-up.
                      </>
                    ) : is10m ? (
                      <>
                        ⚠️ Only <strong className="text-white font-bold">{formattedRemaining}</strong> left for{' '}
                        <strong className="text-white font-bold">{currentAlert.session.customerName}</strong>! Session
                        time will end in 10 minutes.
                      </>
                    ) : (
                      <>
                        ⏰ <strong className="text-white font-bold">{formattedRemaining}</strong> remaining for{' '}
                        <strong className="text-white font-bold">{currentAlert.session.customerName}</strong>! Session
                        time will end in 15 minutes.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Actions: Clear & Sizable */}
            <div className="mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => handleDismiss(currentAlert.id)}
                  className="w-full sm:w-auto text-xs sm:text-sm font-semibold border-white/20 text-white/70 hover:text-white hover:bg-white/10 px-5"
                >
                  Dismiss
                </Button>

                {alerts.length > 1 && (
                  <Button
                    variant="outline"
                    size="md"
                    onClick={handleDismissAll}
                    className="w-full sm:w-auto text-xs sm:text-sm font-semibold border-white/20 text-white/50 hover:text-white hover:bg-white/10 px-3"
                  >
                    Dismiss All ({alerts.length})
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => handleOpenExtend(currentAlert)}
                  className="flex-1 sm:flex-initial text-xs sm:text-sm font-bold flex items-center justify-center gap-2 bg-cyan-600/25 hover:bg-cyan-600/40 text-cyan-200 border border-cyan-500/40 px-6 py-2.5 shadow-md"
                >
                  <PlusCircle className="w-4 h-4 text-cyan-400" />
                  <span>Extend Session</span>
                </Button>

                <Button
                  variant="danger"
                  size="md"
                  onClick={() => handleOpenEndSession(currentAlert)}
                  className="flex-1 sm:flex-initial text-xs sm:text-sm font-bold flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white px-6 py-2.5 shadow-lg shadow-rose-600/30"
                >
                  <Square className="w-4 h-4" />
                  <span>End Session</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Modals for Quick Actions from any alert */}
      <ExtendSessionModal
        isOpen={Boolean(extendStation)}
        onClose={() => setExtendStation(null)}
        station={extendStation}
        onSuccess={() => {
          const stId = extendStation?.id;
          setExtendStation(null);
          handleSessionActionComplete(stId);
        }}
      />

      <EndSessionModal
        isOpen={Boolean(endSessionTarget)}
        onClose={() => setEndSessionTarget(null)}
        target={endSessionTarget}
        onSuccess={() => {
          const stId = endSessionTarget?.stationId;
          setEndSessionTarget(null);
          handleSessionActionComplete(stId);
        }}
      />
    </>
  );
}
