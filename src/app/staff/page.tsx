'use client';

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
  QrCode,
  UserPlus,
  Play,
  Square,
  PlusCircle,
  Wrench,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Users,
  Sparkles,
  Flame,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { QrScannerModal } from '@/components/staff/QrScannerModal';
import { WalkInModal } from '@/components/staff/WalkInModal';
import { ExtendSessionModal } from '@/components/staff/ExtendSessionModal';
import { EndSessionModal, type EndSessionTarget } from '@/components/staff/EndSessionModal';
import { useToast } from '@/components/ui/Toast';

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
  } | null;
  upcomingBookings?: Array<{
    id: string;
    bookingRef: string;
    customerName: string;
    startTime: string;
    endTime: string;
  }>;
}

export default function StaffStationGridPage() {
  const [stations, setStations] = useState<Station[]>([]);
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
  const [scannerOpen, setScannerOpen] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [selectedWalkInStationId, setSelectedWalkInStationId] = useState<string | undefined>(undefined);
  const [extendModalStation, setExtendModalStation] = useState<Station | null>(null);
  const [endSessionTarget, setEndSessionTarget] = useState<EndSessionTarget | null>(null);

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

  const handleEndSession = (station: Station) => {
    if (!station.activeSession) return;
    setEndSessionTarget({
      sessionId: station.activeSession.id,
      stationId: station.id,
      stationName: station.name,
      bookingId: station.activeSession.bookingId,
      customerName: station.activeSession.customerName,
      bookingRef: station.activeSession.bookingRef,
      scheduledEndAt: station.activeSession.scheduledEndAt,
      pricePerHourPaise: station.pricePerHourPaise,
      gameTitle: station.activeSession.gameTitle || null,
      paymentStatus: station.activeSession.paymentStatus,
      paymentMethod: station.activeSession.paymentMethod,
      totalPricePaise: station.activeSession.totalPricePaise,
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
  const ps5Occupied = ps5List.filter((s) => s.status === 'OCCUPIED' || Boolean(s.activeSession)).length;
  const ps5Maint = ps5List.filter((s) => s.status === 'MAINTENANCE').length;
  const ps5Total = ps5List.length || 3;

  const poolList = stations.filter((s) => s.stationType === 'POOL_TABLE');
  const poolAvailable = poolList.filter((s) => s.status === 'AVAILABLE' && !s.activeSession).length;
  const poolOccupied = poolList.filter((s) => s.status === 'OCCUPIED' || Boolean(s.activeSession)).length;
  const poolMaint = poolList.filter((s) => s.status === 'MAINTENANCE').length;
  const poolTotal = poolList.length || 3;

  const isZoneView = !searchQuery;

  return (
    <div className="space-y-8">
      {/* 1. Metric KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card glass className="p-4 border-ds-border">
          <span className="text-[10px] uppercase font-mono text-ds-text-dim block">Available Consoles</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-heading font-black text-emerald-400">{stats.availableCount}</span>
            <span className="text-xs text-ds-text-dim">/ {stats.totalStations} Ready</span>
          </div>
        </Card>

        <Link href="/staff/bookings?tab=ACTIVE" className="block group">
          <Card glass className="p-4 border-ds-border hover:border-ds-ice/60 hover:bg-ds-surface/70 transition-all cursor-pointer">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono text-ds-text-dim block">Active In-Session</span>
              <span className="text-[9px] font-mono text-ds-ice group-hover:underline flex items-center gap-1">
                View Schedule →
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-heading font-black text-ds-ice">{stats.occupiedCount}</span>
              <span className="text-xs text-ds-text-dim">Playing Now</span>
            </div>
          </Card>
        </Link>

        <Card glass className="p-4 border-ds-border">
          <span className="text-[10px] uppercase font-mono text-ds-text-dim block">In Maintenance</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-heading font-black text-amber-400">{stats.maintenanceCount}</span>
            <span className="text-xs text-ds-text-dim">Servicing</span>
          </div>
        </Card>

        <Card glass className="p-4 border-ds-border">
          <span className="text-[10px] uppercase font-mono text-ds-text-dim block">Revenue Collected Today</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-heading font-black text-ds-text">
              ₹{(stats.todayRevenuePaise / 100).toFixed(0)}
            </span>
            <span className="text-xs text-emerald-400 font-semibold">Live</span>
          </div>
        </Card>
      </div>

      {/* 2. Operations Action & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-ds-surface/50 p-4 rounded-2xl border border-ds-border">
        {/* Left Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="accent"
            onClick={() => setScannerOpen(true)}
            className="flex items-center gap-2 shadow-lg shadow-ds-accent/20"
          >
            <QrCode className="w-4 h-4" />
            <span>Scan QR Pass</span>
          </Button>

          <Button
            variant="secondary"
            onClick={() => {
              setSelectedWalkInStationId(undefined);
              setWalkInOpen(true);
            }}
            className="flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>Desk Walk-in</span>
          </Button>

          <Link href="/staff/bookings?tab=ACTIVE">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5 text-xs text-ds-ice border-ds-ice/30 hover:border-ds-ice hover:bg-ds-ice/10"
              title="View all active in-session consoles in Schedule"
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>In-Session ({stats.occupiedCount})</span>
            </Button>
          </Link>

          <Button variant="outline" size="sm" onClick={loadData} title="Refresh Live State">
            <RotateCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Right Search & Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <Input
              placeholder="Search station or player..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs py-1.5 pl-8 w-full sm:w-52"
            />
            <Search className="w-3.5 h-3.5 text-ds-text-dim absolute left-2.5 top-2.5" />
          </div>

          {/* Status Filter */}
          <div className="flex gap-1 bg-ds-dark p-1 rounded-xl border border-ds-border text-xs overflow-x-auto no-scrollbar max-w-full flex-nowrap shrink-0">
            {[
              { id: 'ALL', label: 'All Floor' },
              { id: 'AVAILABLE', label: `Ready (${stats.availableCount})` },
              { id: 'OCCUPIED', label: `Playing (${stats.occupiedCount})` },
              { id: 'MAINTENANCE', label: `Service (${stats.maintenanceCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-2.5 py-1 rounded-lg font-heading font-bold uppercase transition-all text-[11px] whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-ds-surface text-ds-ice border border-ds-ice/30 shadow-sm'
                    : 'text-ds-text-dim hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Platform / Category Quick Launch Buttons */}
          <div className="flex gap-1.5 bg-ds-dark p-1 rounded-xl border border-ds-border text-xs overflow-x-auto no-scrollbar max-w-full flex-nowrap shrink-0">
            <button
              onClick={() => {
                const firstAvail = ps5List.find((s) => s.status === 'AVAILABLE' && !s.activeSession);
                setSelectedWalkInStationId(firstAvail?.id || ps5List[0]?.id);
                setWalkInOpen(true);
              }}
              className="px-3 py-1.5 rounded-lg font-heading font-bold uppercase transition-all text-[11px] text-ds-ice bg-ds-surface/60 hover:bg-ds-surface border border-ds-border hover:border-cyan-400/50 flex items-center gap-1.5 cursor-pointer"
            >
              <span>🎮</span>
              <span>PlayStation 5</span>
              <span className="text-[10px] font-mono text-emerald-400">({ps5Available} Ready)</span>
            </button>
            <button
              onClick={() => {
                const firstAvail = poolList.find((s) => s.status === 'AVAILABLE' && !s.activeSession);
                setSelectedWalkInStationId(firstAvail?.id || poolList[0]?.id);
                setWalkInOpen(true);
              }}
              className="px-3 py-1.5 rounded-lg font-heading font-bold uppercase transition-all text-[11px] text-ds-ice bg-ds-surface/60 hover:bg-ds-surface border border-ds-border hover:border-emerald-400/50 flex items-center gap-1.5 cursor-pointer"
            >
              <span>🎱</span>
              <span>Snooker Lounge</span>
              <span className="text-[10px] font-mono text-emerald-400">({poolAvailable} Ready)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Live Station Matrix / Arenas View */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-ds-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-ds-text-muted">Loading live station matrix...</p>
        </div>
      ) : isZoneView ? (
        /* Top Level Arena Cards with Single Hero Images matching User Booking Flow */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-ds-border pb-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-ds-accent/15 border border-ds-accent/30 text-ds-ice mb-1">
                <Sparkles className="w-3.5 h-3.5 text-ds-accent" />
                <span>Floor Operations: Choose Arena Zone</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-heading font-black uppercase text-ds-text">
                Dark Syndicate Gaming Arenas
              </h2>
              <p className="text-xs text-ds-text-muted mt-0.5">
                Select an arena below to view individual consoles, inspect active timers, or allocate walk-in players.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. PlayStation 5 Arena Card */}
            <div
              onClick={() => {
                const firstAvail = ps5List.find((s) => s.status === 'AVAILABLE' && !s.activeSession);
                setSelectedWalkInStationId(firstAvail?.id || ps5List[0]?.id);
                setWalkInOpen(true);
              }}
              className="group relative rounded-2xl overflow-hidden border-2 border-ds-border hover:border-ds-accent transition-all duration-300 cursor-pointer shadow-lg hover:shadow-2xl hover:shadow-ds-accent/20 bg-ds-dark flex flex-col justify-between"
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
                  <p className="text-xs text-white/80 line-clamp-1 drop-shadow mt-1">
                    {ps5Total} Consoles • 4K 120Hz OLED Displays • DualSense Edge
                  </p>
                </div>
              </div>

              <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-t border-ds-border/50 bg-ds-surface/40">
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold">
                    {ps5Available} Ready
                  </span>
                  {ps5Occupied > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-ds-accent/15 border border-ds-accent/30 text-ds-ice font-bold">
                      {ps5Occupied} In-Session
                    </span>
                  )}
                  {ps5Maint > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold">
                      {ps5Maint} Service
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-ds-ice font-mono font-bold text-xs bg-ds-surface px-3 py-1.5 rounded-lg border border-ds-border">
                    From ₹150/hr
                  </span>
                  <Button
                    variant="accent"
                    size="sm"
                    className="text-xs flex items-center gap-1.5 shadow-lg shadow-ds-accent/20"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Desk Walk-in →</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* 2. Snooker Lounge Card */}
            <div
              onClick={() => {
                const firstAvail = poolList.find((s) => s.status === 'AVAILABLE' && !s.activeSession);
                setSelectedWalkInStationId(firstAvail?.id || poolList[0]?.id);
                setWalkInOpen(true);
              }}
              className="group relative rounded-2xl overflow-hidden border-2 border-ds-border hover:border-emerald-500 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-2xl hover:shadow-emerald-500/20 bg-ds-dark flex flex-col justify-between"
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
                  <p className="text-xs text-white/80 line-clamp-1 drop-shadow mt-1">
                    {poolTotal} Championship Tables • Slate Bed • Aramith Balls
                  </p>
                </div>
              </div>

              <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-t border-ds-border/50 bg-ds-surface/40">
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold">
                    {poolAvailable} Ready
                  </span>
                  {poolOccupied > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-ds-accent/15 border border-ds-accent/30 text-ds-ice font-bold">
                      {poolOccupied} In-Session
                    </span>
                  )}
                  {poolMaint > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold">
                      {poolMaint} Service
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-mono font-bold text-xs bg-ds-surface px-3 py-1.5 rounded-lg border border-ds-border">
                    ₹250/hr
                  </span>
                  <Button
                    variant="accent"
                    size="sm"
                    className="text-xs flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 border-emerald-400 text-black font-bold shadow-lg shadow-emerald-500/20"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Desk Walk-in →</span>
                  </Button>
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
            <Link href="/staff/bookings">
              <Button variant="secondary" size="sm">
                <span>View Full Schedule →</span>
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
                          {station.specs || (station.stationType === 'PS5' ? '4K 120Hz OLED Display' : 'Championship Slate Bed')}
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
                        ? '🎮 PLAYING'
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
                              {station.activeSession.gameTitle && (
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
                            <span>Ref: {station.activeSession.bookingRef || 'Walk-in'}</span>
                            <span suppressHydrationWarning>
                              End: {new Date(station.activeSession.scheduledEndAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
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
                                {new Date(station.upcomingBookings[0].startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                      {isOccupied ? (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setExtendModalStation(station)}
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
      <QrScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onCheckInSuccess={loadData}
      />

      <WalkInModal
        isOpen={walkInOpen}
        onClose={() => setWalkInOpen(false)}
        stations={stations}
        preselectedStationId={selectedWalkInStationId}
        onSuccess={loadData}
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
