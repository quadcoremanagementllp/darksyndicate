'use client';
// Dark Syndicate Staff Portal - v1.2.0 (Clean 3-KPI Overview without Maintenance)

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import {
  Gamepad2,
  Clock,
  UserPlus,
  Play,
  Square,
  PlusCircle,
  Wrench,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Users,
  Flame,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CalendarClock,
  Zap,
  X,
} from 'lucide-react';
import { WalkInModal } from '@/components/staff/WalkInModal';
import { ExtendSessionModal } from '@/components/staff/ExtendSessionModal';
import { EndSessionModal, type EndSessionTarget } from '@/components/staff/EndSessionModal';
import { StaffPreBookingModal } from '@/components/staff/StaffPreBookingModal';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import { canManageStaffSession, sessionHourlyRatePaise } from '@/lib/staffSessionRules';

interface StationGame {
  id: string;
  title: string;
  genre: string | null;
  coverImage: string | null;
  maxPlayers: number;
  isFeatured?: boolean;
  description?: string | null;
}

interface Station {
  id: string;
  name: string;
  stationType: string;
  facilityName: string;
  imageUrl?: string;
  pricePerHourPaise: number;
  specs: string;
  capacity: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'DEACTIVATED';
  games?: StationGame[];
  activeSession?: {
    id: string;
    staffId?: string | null;
    bookingId: string;
    customerName: string;
    customerPhone?: string;
    bookingRef?: string;
    startedAt: string;
    scheduledEndAt: string;
    extensionMinutes?: number;
    gameTitle?: string | null;
    paymentStatus?: string;
    paymentMethod?: string;
    totalPricePaise?: number;
    unpaidPaise?: number;
    paidPaise?: number;
    isPayOnExit?: boolean;
    playerCount?: number;
    isPool?: boolean;
    priorPendingTabs?: Array<{
      bookingId: string;
      bookingRef: string;
      stationName: string;
      stationType: string;
      gameTitle?: string | null;
      amountPaise: number;
    }>;
    priorUnpaidPaise?: number;
  } | null;
  upcomingBookings?: Array<{
    id: string;
    bookingRef: string;
    customerName: string;
    startTime: string;
    endTime: string;
  }>;
}

interface OpenGuestTab {
  bookingId: string;
  bookingRef: string;
  stationId: string;
  stationName: string;
  stationType: string;
  gameTitle: string | null;
  customerName: string;
  customerPhone: string | null;
  amountPaise: number;
  createdAt: string;
}

export default function StaffStationGridPage() {
  const { user } = useAuth();
  const [stations, setStations] = useState<Station[]>([]);
  const [openGuestTabs, setOpenGuestTabs] = useState<OpenGuestTab[]>([]);
  const [stats, setStats] = useState({
    totalStations: 2,
    availableCount: 2,
    occupiedCount: 0,
    maintenanceCount: 0,
    todayRevenuePaise: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [selectedWalkInStationId, setSelectedWalkInStationId] = useState<string | undefined>(undefined);
  const [walkInInitialCustomerName, setWalkInInitialCustomerName] = useState<string | undefined>(undefined);
  const [walkInInitialCustomerPhone, setWalkInInitialCustomerPhone] = useState<string | undefined>(undefined);
  const [walkInInitialCategory, setWalkInInitialCategory] = useState<string | undefined>(undefined);
  const [walkInLinkedPriorTab, setWalkInLinkedPriorTab] = useState<{
    bookingId: string;
    stationName: string;
    amountPaise: number;
  } | null>(null);
  const [extendModalStation, setExtendModalStation] = useState<Station | null>(null);
  const [endSessionTarget, setEndSessionTarget] = useState<EndSessionTarget | null>(null);

  // Mode Selection & Pre-booking states
  const [modeModalZone, setModeModalZone] = useState<'PS5' | 'POOL_TABLE' | null>(null);
  const [preBookingOpen, setPreBookingOpen] = useState(false);
  const [preBookingCategory, setPreBookingCategory] = useState<'PS5' | 'POOL_TABLE'>('PS5');
  const [preBookingStationId, setPreBookingStationId] = useState<string | undefined>(undefined);
  const [preBookingPickerOpen, setPreBookingPickerOpen] = useState(false);

  // Station Games Modal state
  const [selectedStationForGames, setSelectedStationForGames] = useState<Station | null>(null);
  const [gamesModalOpen, setGamesModalOpen] = useState(false);
  const [stationGamesSearch, setStationGamesSearch] = useState('');

  // Live timer tick state
  const [currentTime, setCurrentTime] = useState(Date.now());
  const toast = useToast();

  const loadData = async () => {
    try {
      const res = await fetch('/api/staff/overview');
      const json = await res.json();
      if (json.success && json.data) {
        setStations(json.data.stations || []);
        if (json.data.stats) setStats(json.data.stats);
        if (json.data.openGuestTabs) setOpenGuestTabs(json.data.openGuestTabs);
      }
    } catch (err) {
      console.error('Failed to load staff overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Polling every 30s
    const handleBookingUpdate = () => loadData();
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

  // Timer tick every second for real-time countdowns
  useEffect(() => {
    const tick = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const handleExtraPlayerAction = async (station: Station, action: 'ADD' | 'REMOVE' = 'ADD') => {
    if (!station.activeSession) return;
    try {
      const res = await fetch('/api/staff/sessions/extra-player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: station.activeSession.bookingId,
          sessionId: station.activeSession.id,
          action,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(
          json.data?.message ||
            (action === 'REMOVE' ? 'Extra person undone (-₹50)' : 'Extra person added (+₹50)')
        );
        loadData();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('ds-booking-updated'));
        }
      } else {
        toast.error(json.error?.message || 'Failed to update extra players');
      }
    } catch {
      toast.error('Network error updating extra players');
    }
  };

  const handleEndSession = (station: Station) => {
    if (!station.activeSession) return;
    setEndSessionTarget({
      sessionId: station.activeSession.id,
      stationId: station.id,
      stationName: station.name,
      stationType: station.stationType,
      bookingId: station.activeSession.bookingId,
      customerName: station.activeSession.customerName,
      customerPhone: station.activeSession.customerPhone,
      bookingRef: station.activeSession.bookingRef,
      scheduledEndAt: station.activeSession.scheduledEndAt,
      pricePerHourPaise: sessionHourlyRatePaise(station.stationType, station.pricePerHourPaise, station.activeSession.playerCount || 1),
      gameTitle: station.activeSession.gameTitle || null,
      paymentStatus: station.activeSession.paymentStatus,
      paymentMethod: station.activeSession.paymentMethod,
      totalPricePaise: station.activeSession.totalPricePaise,
      paidPaise: station.activeSession.paidPaise,
      unpaidPaise: station.activeSession.unpaidPaise,
      isPayOnExit: station.activeSession.isPayOnExit,
      priorPendingTabs: station.activeSession.priorPendingTabs,
      priorUnpaidPaise: station.activeSession.priorUnpaidPaise,
    });
  };

  const handleOpenGuestTabToSnooker = (tab: OpenGuestTab) => {
    setWalkInInitialCustomerName(tab.customerName);
    setWalkInInitialCustomerPhone(tab.customerPhone || undefined);
    setWalkInInitialCategory('POOL_TABLE');
    setWalkInLinkedPriorTab({
      bookingId: tab.bookingId,
      stationName: tab.stationName,
      amountPaise: tab.amountPaise,
    });
    setSelectedWalkInStationId(undefined);
    setWalkInOpen(true);
  };

  const handleSettleOpenGuestTab = (tab: OpenGuestTab) => {
    setEndSessionTarget({
      stationName: tab.stationName,
      stationType: tab.stationType,
      bookingId: tab.bookingId,
      customerName: tab.customerName,
      customerPhone: tab.customerPhone || undefined,
      bookingRef: tab.bookingRef,
      pricePerHourPaise: 15000,
      paymentStatus: 'PENDING',
      isPayOnExit: true,
      totalPricePaise: tab.amountPaise,
      unpaidPaise: tab.amountPaise,
    });
  };

  const handleToggleMaintenance = async (station: Station) => {
    const newStatus = station.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE';
    try {
      const res = await fetch(`/api/admin/stations/${station.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        toast.info(`${station.name} marked as ${newStatus}`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('ds-booking-updated'));
        }
        loadData();
      }
    } catch {
      toast.error('Failed to toggle status');
    }
  };

  // Helper for countdown display with true proportional elapsed percentage
  const getCountdown = (scheduledEndAt: string, startedAt?: string) => {
    const end = new Date(scheduledEndAt).getTime();
    const diffMs = end - currentTime;

    if (diffMs <= 0) {
      const overdueSec = Math.floor(Math.abs(diffMs) / 1000);
      const mins = Math.max(1, Math.floor(overdueSec / 60));
      const secs = overdueSec % 60;
      return {
        formatted: `${mins}:${secs.toString().padStart(2, '0')}`,
        overdueMins: mins,
        isOverdue: true,
        isCriticalEnding: true,
        isEndingSoon: true,
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
      isCriticalEnding: totalSec <= 300, // <= 5 mins
      isEndingSoon: totalSec <= 900, // <= 15 mins
      percentage,
    };
  };

  const filteredStations = stations.filter((st) => {
    const isOccupied = st.status === 'OCCUPIED' || Boolean(st.activeSession);
    const isAvailable = st.status === 'AVAILABLE' && !st.activeSession;
    const isMaintenance = st.status === 'MAINTENANCE';

    if (statusFilter === 'AVAILABLE' && !isAvailable) return false;
    if (statusFilter === 'OCCUPIED' && !isOccupied) return false;
    if (statusFilter === 'MAINTENANCE' && !isMaintenance) return false;

    const matchesCategory = filterType === 'ALL' || st.stationType === filterType;
    const matchesSearch =
      !searchQuery ||
      st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.facilityName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (st.activeSession?.customerName && st.activeSession.customerName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const ps5List = stations.filter((s) => s.stationType === 'PS5');
  const ps5Available = ps5List.filter((s) => s.status === 'AVAILABLE' && !s.activeSession).length;
  const ps5Total = ps5List.length || 3;

  const poolList = stations.filter((s) => s.stationType === 'POOL_TABLE');
  const poolAvailable = poolList.filter((s) => s.status === 'AVAILABLE' && !s.activeSession).length;
  const poolTotal = poolList.length || 3;

  const isZoneView = !searchQuery;

  return (
    <div className="space-y-8">
      {/* 1. Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        {/* Card 1: Available Stations */}
        <Card glass className="p-4 sm:p-5 border-ds-border hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-mono text-ds-text-dim tracking-wider">
              Available Stations
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl sm:text-3xl font-heading font-black text-emerald-400">
              {stats.availableCount}
            </span>
            <span className="text-xs text-ds-text-dim font-mono">
              / {stats.totalStations} Ready
            </span>
          </div>
        </Card>

        {/* Card 2: Active In-Session */}
        <Link href="/staff/bookings/in-session" className="block group">
          <Card glass className="p-4 sm:p-5 border-ds-border hover:border-ds-ice/60 hover:bg-ds-surface/70 transition-all cursor-pointer">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase font-mono text-ds-text-dim tracking-wider whitespace-nowrap">
                Active In-Session
              </span>
              <span className="text-[10px] font-mono font-semibold text-ds-ice group-hover:underline flex items-center gap-1 shrink-0 whitespace-nowrap">
                <span>View Sessions</span>
                <ArrowRight className="w-3 h-3 text-ds-accent" />
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl sm:text-3xl font-heading font-black text-ds-ice">
                {stats.occupiedCount}
              </span>
              <span className="text-xs text-ds-text-dim font-mono">
                Playing Now
              </span>
            </div>
          </Card>
        </Link>

        {/* Card 3: Revenue Collected Today */}
        <Card glass className="p-4 sm:p-5 border-ds-border hover:border-ds-border/80 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-mono text-ds-text-dim tracking-wider">
              Revenue Collected Today
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              LIVE
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl sm:text-3xl font-heading font-black text-white">
              ₹{(stats.todayRevenuePaise / 100).toFixed(0)}
            </span>
            <span className="text-xs text-ds-text-dim font-mono">
              Total Today
            </span>
          </div>
        </Card>
      </div>

      {/* ─── ACTIVE GUEST TABS BAR (Unsettled tabs / Moving to next game) ─── */}
      {openGuestTabs.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-cyan-950/40 to-ds-surface border-2 border-amber-500/40 space-y-3 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0">
                ⏳
              </div>
              <div>
                <h3 className="font-heading font-black text-sm text-white flex items-center gap-2">
                  <span>Guests with Open Tabs (Awaiting Snooker / Exit Checkout)</span>
                  <span className="px-2 py-0.5 rounded-full font-mono text-[11px] font-bold bg-amber-500 text-black">
                    {openGuestTabs.length} Unsettled
                  </span>
                </h3>
                <p className="text-[11px] text-ds-text-dim">
                  These players finished their previous console session with an open tab and can be allocated to Snooker or settled at the desk.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pt-1">
            {openGuestTabs.map((tab) => (
              <div
                key={tab.bookingId}
                className="p-3 rounded-xl bg-ds-dark/90 border border-amber-500/30 hover:border-cyan-400 transition-all flex flex-col justify-between gap-2.5 shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-heading font-black text-sm text-white flex items-center gap-1.5 truncate">
                      <span>{tab.customerName}</span>
                      {tab.customerPhone && (
                        <span className="text-[10px] font-mono text-ds-text-dim truncate">
                          ({tab.customerPhone})
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-cyan-300 font-mono flex items-center gap-1 mt-0.5">
                      <span>{tab.stationType === 'POOL_TABLE' ? '🎱' : '🎮'}</span>
                      <span className="truncate">{tab.stationName} (Ref: {tab.bookingRef})</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[9px] uppercase font-mono text-amber-300 block">Open Tab</span>
                    <span className="text-base font-mono font-black text-amber-400">
                      ₹{(tab.amountPaise / 100).toFixed(0)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                  <Button
                    variant="accent"
                    size="sm"
                    onClick={() => handleOpenGuestTabToSnooker(tab)}
                    className="flex-1 justify-center text-xs py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-heading font-bold flex items-center gap-1.5"
                  >
                    <span>🎱</span>
                    <span>Start Snooker Table</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSettleOpenGuestTab(tab)}
                    className="justify-center text-xs py-1.5 border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-400 font-heading font-semibold"
                  >
                    <span>💳 Settle</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Station Matrix / Arenas View */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-ds-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-ds-text-muted">Loading live station matrix...</p>
        </div>
      ) : isZoneView ? (
        /* Top Level Arena Cards with Single Hero Images matching User Booking Flow */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ds-border pb-3">
            <h2 className="text-xl sm:text-2xl font-heading font-black uppercase text-ds-text">
              Dark Syndicate Gaming World
            </h2>
            <Link
              href="/staff/bookings/in-session"
              title="View all active sessions"
              className="self-start sm:self-auto inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-ds-accent/20 via-ds-surface to-ds-surface border border-ds-accent/50 hover:border-ds-accent text-ds-ice hover:text-white font-heading font-black tracking-wider text-xs sm:text-sm uppercase shadow-[0_0_15px_rgba(6,182,212,0.25)] hover:shadow-[0_0_22px_rgba(6,182,212,0.45)] transition-all duration-200 group shrink-0"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <Gamepad2 className="w-4 h-4 text-ds-accent group-hover:scale-110 transition-transform" />
              <span>In-Session</span>
              <span className="px-2 py-0.5 rounded-full font-mono text-xs font-black bg-ds-accent/20 border border-ds-accent/40 text-cyan-200 shadow-inner">
                {stats.occupiedCount}
              </span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. PlayStation 5 Arena Card */}
            <div
              onClick={() => {
                setModeModalZone('PS5');
              }}
              className="group relative rounded-2xl overflow-hidden border-2 border-ds-border hover:border-ds-accent transition-all duration-300 cursor-pointer shadow-lg hover:shadow-2xl hover:shadow-ds-accent/20 bg-ds-dark"
            >
              <div className="relative w-full h-60 sm:h-72 overflow-hidden">
                <Image
                  src="/ps5-station.jpg"
                  alt="PlayStation 5 Gaming Station"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ds-dark via-ds-dark/40 to-transparent" />
                
                {/* Top availability badge */}
                <div className="absolute top-3 right-3 z-10">
                  {ps5Available > 0 ? (
                    <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/90 text-white shadow-md backdrop-blur-sm flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-200 animate-pulse" />
                      {ps5Available} of {ps5Total} Available Now
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-ds-surface/90 border border-ds-accent/50 text-ds-ice shadow-md backdrop-blur-sm flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      {ps5Total} Consoles • Fully Booked
                    </span>
                  )}
                </div>

                {/* Bottom Title on Image */}
                <div className="absolute bottom-3 left-4 right-4 z-10">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🎮</span>
                    <h3 className="font-heading font-black text-2xl text-white uppercase group-hover:text-ds-ice transition-colors">
                      PlayStation 5 Arena
                    </h3>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Snooker Lounge Card */}
            <div
              onClick={() => {
                setModeModalZone('POOL_TABLE');
              }}
              className="group relative rounded-2xl overflow-hidden border-2 border-ds-border hover:border-emerald-500 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-2xl hover:shadow-emerald-500/20 bg-ds-dark"
            >
              <div className="relative w-full h-60 sm:h-72 overflow-hidden">
                <Image
                  src="/snooker-table.jpg"
                  alt="Championship Snooker Table"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ds-dark via-ds-dark/40 to-transparent" />
                
                {/* Top availability badge */}
                <div className="absolute top-3 right-3 z-10">
                  {poolAvailable > 0 ? (
                    <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/90 text-white shadow-md backdrop-blur-sm flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-200 animate-pulse" />
                      {poolAvailable} of {poolTotal} Available Now
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-ds-surface/90 border border-emerald-500/50 text-emerald-400 shadow-md backdrop-blur-sm flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      {poolTotal} Tables • Fully Booked
                    </span>
                  )}
                </div>

                {/* Bottom Title on Image */}
                <div className="absolute bottom-3 left-4 right-4 z-10">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🎱</span>
                    <h3 className="font-heading font-black text-2xl text-white uppercase group-hover:text-emerald-400 transition-colors">
                      Snooker Lounge
                    </h3>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : filteredStations.length === 0 ? (
        <div className="p-12 text-center bg-ds-surface/30 rounded-2xl border border-dashed border-ds-border text-ds-text-dim space-y-3">
          <Gamepad2 className="w-8 h-8 text-ds-ice/60 mx-auto" />
          <h4 className="text-base font-heading font-bold text-ds-text">
            No gaming stations match selected filter
          </h4>
          <p className="text-xs text-ds-text-muted max-w-md mx-auto">
            Try resetting status filters or clearing the search box to view all gaming stations.
          </p>
          <div className="pt-2 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter('ALL');
                setFilterType('ALL');
                setSearchQuery('');
              }}
            >
              Reset Filters
            </Button>
            <Link href="/staff/bookings/in-session">
              <Button variant="secondary" size="sm">
                <span>View Sessions →</span>
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Breadcrumb Navigation Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-ds-surface/60 p-4 rounded-2xl border border-ds-border">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFilterType('ALL');
                  setSearchQuery('');
                  setStatusFilter('ALL');
                }}
                className="flex items-center gap-1.5 text-xs font-heading font-bold"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>All Arenas</span>
              </Button>
              <div>
                <h3 className="text-lg font-heading font-black text-ds-text uppercase flex items-center gap-2">
                  <span>
                    {filterType === 'PS5'
                      ? '🎮 PlayStation 5 Arena'
                      : filterType === 'POOL_TABLE'
                      ? '🎱 Snooker Lounge'
                      : 'Arena Floor Consoles'}
                  </span>
                </h3>
                <p className="text-xs text-ds-text-muted">
                  Showing {filteredStations.length} {filterType === 'PS5' ? 'consoles' : filterType === 'POOL_TABLE' ? 'tables' : 'units'} • Live session controls & rapid walk-in
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="success" size="sm" className="font-mono text-xs">
                {filteredStations.filter((s) => s.status === 'AVAILABLE' && !s.activeSession).length} Ready
              </Badge>
              <Badge variant="accent" size="sm" className="font-mono text-xs">
                {filteredStations.filter((s) => s.status === 'OCCUPIED' || Boolean(s.activeSession)).length} In-Session
              </Badge>
            </div>
          </div>

          {/* Individual Station Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStations.map((station) => {
              const isOccupied = station.status === 'OCCUPIED' && station.activeSession;
              const canManage = canManageStaffSession(user?.role, user?.id, station.activeSession?.staffId);
              const isMaintenance = station.status === 'MAINTENANCE';
              const countdown = isOccupied
                ? getCountdown(station.activeSession!.scheduledEndAt, station.activeSession?.startedAt)
                : null;

              return (
                <Card
                  key={station.id}
                  glass
                  className={`p-0 border transition-all flex flex-col justify-between relative overflow-hidden group shadow-xl ${
                    countdown?.isOverdue
                      ? 'border-rose-500/80 bg-rose-500/5 shadow-rose-500/10 ring-1 ring-rose-500'
                      : countdown?.isCriticalEnding
                      ? 'border-orange-500/80 bg-orange-500/5 shadow-orange-500/10'
                      : countdown?.isEndingSoon
                      ? 'border-amber-400/80 bg-amber-400/5 shadow-amber-400/10'
                      : isOccupied
                      ? 'border-ds-accent/60 bg-ds-surface/80 shadow-ds-accent/5'
                      : isMaintenance
                      ? 'border-ds-border/60 bg-ds-dark/40 opacity-70'
                      : 'border-ds-border hover:border-emerald-500/50'
                  }`}
                >
                  {/* Clean Station Card Header matching /booking Step 3 */}
                  <div className="p-4 sm:p-5 border-b border-ds-border/60 bg-ds-surface/40 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 border bg-ds-dark/80 border-ds-border shadow-inner">
                        {station.stationType === 'PS5' ? '🎮' : '🎱'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg sm:text-xl font-heading font-black text-white group-hover:text-ds-ice transition-colors truncate">
                            {station.name}
                          </h3>
                        </div>
                        <p className="text-xs text-ds-text-dim truncate mt-0.5">
                          {station.stationType === 'POOL_TABLE' || station.name.toUpperCase().includes('SNOOKER') || station.name.toUpperCase().includes('POOL')
                            ? 'Tournament 12ft Snooker • 4 Base Players'
                            : (station.specs || '4K 120Hz OLED Display')}
                        </p>
                      </div>
                    </div>

                    {/* Live Status Badge */}
                    <Badge
                      variant={
                        countdown?.isOverdue
                          ? 'default'
                          : countdown?.isCriticalEnding
                          ? 'warning'
                          : countdown?.isEndingSoon
                          ? 'warning'
                          : isOccupied
                          ? 'accent'
                          : isMaintenance
                          ? 'warning'
                          : 'success'
                      }
                      size="sm"
                      className={`font-mono text-[10px] uppercase tracking-wider shrink-0 ${
                        countdown?.isOverdue
                          ? 'bg-rose-500/90 text-white border border-rose-400 animate-pulse font-bold'
                          : countdown?.isCriticalEnding
                          ? 'bg-orange-500/90 text-white border border-orange-400 font-bold'
                          : countdown?.isEndingSoon
                          ? 'bg-amber-500/90 text-white border border-amber-400'
                          : ''
                      }`}
                    >
                      {countdown?.isOverdue
                        ? `🔴 +${countdown.overdueMins}m`
                        : countdown?.isCriticalEnding
                        ? '🟠 5 MINS'
                        : countdown?.isEndingSoon
                        ? '⏳ SOON'
                        : isOccupied
                        ? (station.stationType === 'POOL_TABLE' || station.name.toUpperCase().includes('SNOOKER') || station.name.toUpperCase().includes('POOL') ? '🎱 PLAYING' : '🎮 PLAYING')
                        : isMaintenance
                        ? '🔧 SERVICE'
                        : '🟢 READY'}
                    </Badge>
                  </div>

                  {/* Card Body Details & Actions */}
                  <div className="p-5 sm:p-6 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-4">
                      {/* ACTIVE SESSION DETAILS (IF OCCUPIED) */}
                      {isOccupied && station.activeSession && countdown && (
                        <div className="p-4 rounded-xl bg-ds-dark/90 border border-ds-border space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-[9px] uppercase font-mono text-ds-text-dim block">Active Player</span>
                              <span className="text-sm font-heading font-bold text-ds-text">
                                {station.activeSession.customerName}
                              </span>
                              {!(station.stationType === 'POOL_TABLE' || station.name.toUpperCase().includes('SNOOKER') || station.name.toUpperCase().includes('POOL')) && station.activeSession.gameTitle && !station.activeSession.gameTitle.includes('[PAY ON EXIT]') && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-heading font-bold text-ds-ice bg-ds-accent/15 border border-ds-accent/30 px-2 py-0.5 rounded mt-1">
                                  <Gamepad2 className="w-3 h-3 text-ds-accent" />
                                  <span>Playing: {station.activeSession.gameTitle}</span>
                                </span>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="text-[9px] uppercase font-mono text-ds-text-dim block">
                                {countdown.isOverdue ? 'Extra Time Played' : 'Time Remaining'}
                              </span>
                              <span
                                className={`text-lg font-mono font-black ${
                                  countdown.isOverdue
                                    ? 'text-rose-400 animate-pulse'
                                    : countdown.isCriticalEnding
                                    ? 'text-orange-400'
                                    : countdown.isEndingSoon
                                    ? 'text-amber-400'
                                    : 'text-ds-ice'
                                }`}
                              >
                                {countdown.isOverdue ? `+${countdown.formatted}` : countdown.formatted}
                              </span>
                            </div>
                          </div>

                          {/* Mini progress bar */}
                          <div className="w-full h-1.5 rounded-full bg-ds-surface overflow-hidden">
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
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>Ref: {station.activeSession.bookingRef || 'Walk-in'}</span>
                              {station.activeSession.isPayOnExit && (
                                <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                  TAB (PAY ON EXIT)
                                </span>
                              )}
                              {station.activeSession.priorPendingTabs && station.activeSession.priorPendingTabs.length > 0 && (
                                <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 flex items-center gap-1 shadow-sm">
                                  <span>🔗 Multi-Game Tab: +₹{((station.activeSession.priorUnpaidPaise || 0) / 100).toFixed(0)} ({station.activeSession.priorPendingTabs[0].stationName})</span>
                                </span>
                              )}
                            </div>
                            <span suppressHydrationWarning>
                              End: {new Date(station.activeSession.scheduledEndAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}
                            </span>
                          </div>

                          {(station.stationType === 'POOL_TABLE' || station.name.toUpperCase().includes('SNOOKER') || station.name.toUpperCase().includes('POOL')) && (
                            <div className="pt-2.5 mt-1 border-t border-ds-border/60 space-y-2">
                              {/* Top Row: Capacity & Extra Breakdown */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm shrink-0">🎱</span>
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-xs font-heading font-black text-white uppercase tracking-wider whitespace-nowrap">
                                      {station.activeSession?.playerCount || 4} Players
                                    </span>
                                    <span className="text-[10px] font-mono text-ds-text-dim whitespace-nowrap">
                                      (4 base)
                                    </span>
                                  </div>
                                </div>

                                {(station.activeSession?.playerCount || 4) > 4 ? (
                                  <span className="font-mono text-[10px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap shadow-sm">
                                    +{(station.activeSession?.playerCount || 4) - 4} Extra (+₹{((station.activeSession?.playerCount || 4) - 4) * 50})
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-mono text-ds-text-dim shrink-0">
                                    Standard Table
                                  </span>
                                )}
                              </div>

                              {/* Bottom Actions Row */}
                              {canManage && <div className={`pt-1.5 border-t border-ds-border/40 ${(station.activeSession?.playerCount || 4) > 4 ? 'grid grid-cols-2 gap-2' : 'flex justify-end'}`}>
                                {(station.activeSession?.playerCount || 4) > 4 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleExtraPlayerAction(station, 'REMOVE');
                                    }}
                                    className="h-7.5 px-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 hover:border-rose-500/50 text-rose-300 hover:text-white font-mono font-bold text-[11px] transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-sm whitespace-nowrap"
                                    title="Undo 1 extra person (-₹50)"
                                  >
                                    <RotateCcw className="w-3 h-3 text-rose-400" />
                                    <span>Undo (-₹50)</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleExtraPlayerAction(station, 'ADD');
                                  }}
                                  className={`h-7.5 px-2.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-300 hover:text-white font-mono font-bold text-[11px] transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-sm whitespace-nowrap ${(station.activeSession?.playerCount || 4) <= 4 ? 'w-full' : ''}`}
                                  title="Add 1 extra person (+₹50)"
                                >
                                  <UserPlus className="w-3 h-3 text-emerald-400" />
                                  <span>+ Person (+₹50)</span>
                                </button>
                              </div>}
                            </div>
                          )}
                        </div>
                      )}

                      {/* AVAILABLE STATE & UPCOMING SCHEDULE */}
                      {!isOccupied && !isMaintenance && (
                        <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs space-y-1">
                          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Ready for Allocation</span>
                          </div>
                          <p className="text-[11px] text-ds-text-dim">
                            Base rate: ₹{(station.pricePerHourPaise / 100).toFixed(0)} / hr • {station.capacity} Players
                          </p>
                          {station.upcomingBookings && station.upcomingBookings.length > 0 && (
                            <p className="text-[11px] text-ds-ice pt-1 font-mono">
                              Next: {station.upcomingBookings[0].customerName} at{' '}
                              <span suppressHydrationWarning>
                                {new Date(station.upcomingBookings[0].startTime).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}
                              </span>
                            </p>
                          )}
                        </div>
                      )}

                      {/* MAINTENANCE STATE */}
                      {isMaintenance && (
                        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1">
                          <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Under Maintenance</span>
                          </div>
                          <p className="text-[11px] text-ds-text-dim">Station locked from public booking.</p>
                        </div>
                      )}

                      {/* Installed Games Button/Chip (Only for PS5) */}
                      {station.stationType === 'PS5' && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStationForGames(station);
                              setStationGamesSearch('');
                              setGamesModalOpen(true);
                            }}
                            className="w-full py-1.5 px-2.5 rounded-lg bg-ds-dark/60 hover:bg-ds-accent/15 border border-ds-border hover:border-ds-accent/50 text-[11px] text-ds-text hover:text-ds-ice transition-all flex items-center justify-between group"
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <Gamepad2 className="w-3.5 h-3.5 text-ds-accent shrink-0" />
                              <span className="font-heading font-bold uppercase text-[10px] text-ds-accent tracking-wider">
                                Games ({station.games?.length || 0}):
                              </span>
                              <span className="text-ds-text-dim truncate text-[11px]">
                                {station.games && station.games.length > 0
                                  ? station.games.slice(0, 2).map((g) => g.title).join(', ') + (station.games.length > 2 ? '...' : '')
                                  : 'Tap to inspect'}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-ds-ice group-hover:text-ds-accent underline shrink-0 ml-1">
                              View →
                            </span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Bottom Actions Strip */}
                    <div className="pt-4 mt-2 border-t border-ds-border/60 flex items-center justify-between gap-2">
                      {isOccupied && canManage ? (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setExtendModalStation({ ...station, pricePerHourPaise: sessionHourlyRatePaise(station.stationType, station.pricePerHourPaise, station.activeSession?.playerCount || 1) })}
                            className="flex-1 justify-center text-xs px-2"
                          >
                            <PlusCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                            <span className="truncate">Extend</span>
                          </Button>

                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleEndSession(station)}
                            className="flex-1 justify-center text-xs px-2"
                          >
                            <Square className="w-3.5 h-3.5 mr-1 shrink-0" />
                            <span className="truncate">End Session</span>
                          </Button>
                        </>
                      ) : isOccupied ? (
                        <span className="text-xs text-ds-text-muted">Managed by another staff member</span>
                      ) : isMaintenance ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleMaintenance(station)}
                          className="w-full justify-center text-xs"
                        >
                          <Wrench className="w-3.5 h-3.5 mr-1" />
                          <span>Return to Available</span>
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="accent"
                            size="sm"
                            onClick={() => {
                              setSelectedWalkInStationId(station.id);
                              setWalkInOpen(true);
                            }}
                            className="flex-1 justify-center text-xs"
                          >
                            <Play className="w-3.5 h-3.5 mr-1" />
                            <span>Walk-in Here</span>
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleMaintenance(station)}
                            title="Mark Maintenance"
                            className="px-2.5"
                          >
                            <Wrench className="w-3.5 h-3.5 text-ds-text-dim hover:text-amber-400" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* MODALS */}
      <WalkInModal
        isOpen={walkInOpen}
        onClose={() => {
          setWalkInOpen(false);
          setWalkInInitialCustomerName(undefined);
          setWalkInInitialCustomerPhone(undefined);
          setWalkInInitialCategory(undefined);
          setWalkInLinkedPriorTab(null);
        }}
        stations={stations}
        preselectedStationId={selectedWalkInStationId}
        initialCustomerName={walkInInitialCustomerName}
        initialCustomerPhone={walkInInitialCustomerPhone}
        initialCategory={walkInInitialCategory}
        linkedPriorTab={walkInLinkedPriorTab}
        onSuccess={loadData}
      />

      {/* ─── BOOKING MODE SELECTION MODAL (Live Walk-In vs Pre-Booking) ─── */}
      <Modal
        isOpen={modeModalZone !== null}
        onClose={() => setModeModalZone(null)}
        size="lg"
        showCloseButton={false}
        className="p-0 border border-ds-border/90 bg-ds-dark shadow-2xl overflow-hidden"
      >
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-ds-border/70">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-ds-surface border border-ds-border flex items-center justify-center text-2xl shrink-0 shadow-inner">
                {modeModalZone === 'PS5' ? '🎮' : '🎱'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-black text-lg sm:text-xl text-white uppercase tracking-wide">
                    {modeModalZone === 'PS5' ? 'PlayStation 5 Arena' : 'Snooker Lounge'}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-ds-accent/15 border border-ds-accent/30 text-ds-ice">
                    Choose Booking Mode
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setModeModalZone(null)}
              className="text-ds-text-dim hover:text-white p-1.5 rounded-xl hover:bg-ds-surface/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Two Mode Choice Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card 1: Start Live Session Now */}
            <div
              onClick={() => {
                const targetZone = modeModalZone;
                setModeModalZone(null);
                setWalkInInitialCategory(targetZone || 'PS5');
                if (targetZone === 'PS5') {
                  const firstAvail = ps5List.find((s) => s.status === 'AVAILABLE' && !s.activeSession);
                  setSelectedWalkInStationId(firstAvail?.id || ps5List[0]?.id);
                } else {
                  const firstAvail = poolList.find((s) => s.status === 'AVAILABLE' && !s.activeSession);
                  setSelectedWalkInStationId(firstAvail?.id || poolList[0]?.id);
                }
                setWalkInOpen(true);
              }}
              className="p-5 rounded-2xl border-2 border-ds-border hover:border-cyan-400 bg-ds-surface/30 hover:bg-cyan-950/20 transition-all cursor-pointer group flex flex-col justify-between space-y-4 hover:shadow-xl hover:shadow-cyan-950/50"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Play className="w-5 h-5 fill-current" />
                  </div>
                </div>

                <div>
                  <h4 className="font-heading font-black text-base text-white uppercase group-hover:text-cyan-300 transition-colors">
                    Start Live Session
                  </h4>
                </div>
              </div>

              <div className="pt-3 border-t border-ds-border/60 flex items-center justify-between text-xs font-heading font-bold text-cyan-400 uppercase">
                <span>Instant Walk-in</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>

            {/* Card 2: Book Upcoming Slot (Pre-Booking) */}
            <div
              onClick={() => {
                const targetZone = modeModalZone;
                setModeModalZone(null);
                setPreBookingCategory(targetZone || 'PS5');
                setPreBookingStationId('ANY');
                setPreBookingOpen(true);
              }}
              className="p-5 rounded-2xl border-2 border-ds-border hover:border-amber-400 bg-ds-surface/30 hover:bg-amber-950/20 transition-all cursor-pointer group flex flex-col justify-between space-y-4 hover:shadow-xl hover:shadow-amber-950/50"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Calendar className="w-5 h-5" />
                  </div>
                </div>

                <div>
                  <h4 className="font-heading font-black text-base text-white uppercase group-hover:text-amber-300 transition-colors">
                    Book Upcoming Slot
                  </h4>
                </div>
              </div>

              <div className="pt-3 border-t border-ds-border/60 flex items-center justify-between text-xs font-heading font-bold text-amber-400 uppercase">
                <span>Advance Reservation</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* ─── ARENA CHOOSER FOR PRE-BOOKING (From top bar) ─── */}
      <Modal
        isOpen={preBookingPickerOpen}
        onClose={() => setPreBookingPickerOpen(false)}
        size="md"
        showCloseButton={false}
        className="p-6 border border-ds-border/80 bg-ds-dark shadow-2xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-ds-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading font-black text-lg text-white uppercase tracking-wide">
                  Pre-Book Upcoming Slot
                </h3>
                <p className="text-xs text-ds-text-dim">
                  Select gaming arena to reserve
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPreBookingPickerOpen(false)}
              className="text-ds-text-dim hover:text-white p-1.5 rounded-xl hover:bg-ds-surface/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setPreBookingPickerOpen(false);
                setPreBookingCategory('PS5');
                setPreBookingStationId('ANY');
                setPreBookingOpen(true);
              }}
              className="p-4 rounded-2xl border-2 border-cyan-500/40 hover:border-cyan-400 bg-cyan-950/20 hover:bg-cyan-950/40 text-left transition-all group flex flex-col justify-between space-y-3 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">🎮</span>
                <span className="text-[10px] font-mono font-bold text-cyan-300 uppercase bg-cyan-500/20 px-2 py-0.5 rounded-full border border-cyan-500/30">
                  From ₹150/hr
                </span>
              </div>
              <div>
                <h4 className="font-heading font-black text-sm text-white uppercase group-hover:text-cyan-300">
                  PlayStation 5
                </h4>
                <p className="text-[11px] text-ds-text-muted mt-0.5">
                  Pre-book PS5 gaming consoles
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setPreBookingPickerOpen(false);
                setPreBookingCategory('POOL_TABLE');
                setPreBookingStationId('ANY');
                setPreBookingOpen(true);
              }}
              className="p-4 rounded-2xl border-2 border-emerald-500/40 hover:border-emerald-400 bg-emerald-950/20 hover:bg-emerald-950/40 text-left transition-all group flex flex-col justify-between space-y-3 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">🎱</span>
                <span className="text-[10px] font-mono font-bold text-emerald-300 uppercase bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  ₹250/hr
                </span>
              </div>
              <div>
                <h4 className="font-heading font-black text-sm text-white uppercase group-hover:text-emerald-300">
                  Snooker Lounge
                </h4>
                <p className="text-[11px] text-ds-text-muted mt-0.5">
                  Pre-book championship tables
                </p>
              </div>
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── STAFF PRE-BOOKING MODAL (Upcoming Slot Reservation) ─── */}
      <StaffPreBookingModal
        isOpen={preBookingOpen}
        onClose={() => setPreBookingOpen(false)}
        stations={stations}
        initialCategory={preBookingCategory}
        initialStationId={preBookingStationId}
        onBookingCreated={() => {
          loadData();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('ds-booking-updated'));
          }
        }}
      />

      <ExtendSessionModal
        isOpen={!!extendModalStation}
        onClose={() => setExtendModalStation(null)}
        station={extendModalStation}
        onSuccess={loadData}
      />

      <EndSessionModal
        isOpen={!!endSessionTarget}
        onClose={() => setEndSessionTarget(null)}
        target={endSessionTarget}
        onSuccess={loadData}
        onTransferTab={(transferData) => {
          setWalkInInitialCustomerName(transferData.customerName);
          setWalkInInitialCustomerPhone(transferData.customerPhone);
          setWalkInInitialCategory('POOL_TABLE');
          setWalkInLinkedPriorTab({
            bookingId: transferData.priorBookingId,
            stationName: transferData.stationName,
            amountPaise: transferData.carriedOverPaise,
          });
          setSelectedWalkInStationId(undefined);
          setWalkInOpen(true);
        }}
      />

      {/* Station Games Inspection Modal */}
      <Modal
        isOpen={gamesModalOpen}
        onClose={() => {
          setGamesModalOpen(false);
          setSelectedStationForGames(null);
        }}
        title={`Installed Games: ${selectedStationForGames?.name || 'Station'}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-ds-dark/60 border border-ds-border">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase text-ds-accent font-bold tracking-wider">
                  {selectedStationForGames?.facilityName}
                </span>
                <span className="text-xs text-ds-text-dim">•</span>
                <span className="text-xs font-heading font-bold text-ds-ice">
                  {selectedStationForGames?.stationType}
                </span>
              </div>
              <p className="text-xs text-ds-text-muted mt-0.5">
                {selectedStationForGames?.games?.length || 0} titles playable on this station.
              </p>
            </div>

            <div className="relative w-full sm:w-56">
              <Input
                placeholder="Search games on console..."
                value={stationGamesSearch}
                onChange={(e) => setStationGamesSearch(e.target.value)}
                className="text-xs py-1.5 pl-8"
              />
              <Search className="w-3.5 h-3.5 text-ds-text-dim absolute left-2.5 top-2.5" />
            </div>
          </div>

          {/* Games List Grid */}
          {(() => {
            const list = (selectedStationForGames?.games || []).filter((g) =>
              !stationGamesSearch ||
              g.title.toLowerCase().includes(stationGamesSearch.toLowerCase()) ||
              (g.genre && g.genre.toLowerCase().includes(stationGamesSearch.toLowerCase()))
            );

            if (list.length === 0) {
              return (
                <div className="p-8 text-center text-xs text-ds-text-dim border border-dashed border-ds-border rounded-xl">
                  <Gamepad2 className="w-8 h-8 text-ds-accent/40 mx-auto mb-2" />
                  <p>No games found matching your search.</p>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
                {list.map((game) => (
                  <div
                    key={game.id}
                    className="p-3 rounded-xl bg-ds-dark/70 border border-ds-border hover:border-ds-accent/40 transition-colors flex gap-3 items-center"
                  >
                    <div className="w-14 h-16 rounded-lg bg-ds-surface overflow-hidden shrink-0 relative">
                      {game.coverImage ? (
                        <img
                          src={game.coverImage}
                          alt={game.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-ds-text-dim">
                          <Gamepad2 className="w-6 h-6 opacity-30" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono uppercase text-ds-accent font-bold">
                          {game.genre || 'Game'}
                        </span>
                        {game.isFeatured && (
                          <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-mono font-bold">
                            HOT
                          </span>
                        )}
                      </div>
                      <h4 className="font-heading font-bold text-xs text-ds-text truncate">
                        {game.title}
                      </h4>
                      <p className="text-[10px] text-ds-text-dim flex items-center gap-1">
                        <Users className="w-3 h-3 text-ds-accent" />
                        <span>{game.maxPlayers === 1 ? 'Single Player' : `Up to ${game.maxPlayers} Players`}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          <div className="pt-2 flex justify-end border-t border-ds-border/60">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setGamesModalOpen(false);
                setSelectedStationForGames(null);
              }}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
