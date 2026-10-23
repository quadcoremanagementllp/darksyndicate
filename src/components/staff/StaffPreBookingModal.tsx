'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  Gamepad2,
  Check,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Zap,
  ArrowRight,
  RotateCw,
  X,
  CreditCard,
  Banknote,
  QrCode,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';

interface Station {
  id: string;
  name: string;
  stationType: string;
  facilityName: string;
  pricePerHourPaise: number;
  status: string;
}

interface StaffPreBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  stations: Station[];
  initialCategory?: 'PS5' | 'POOL_TABLE';
  initialStationId?: string;
  onBookingCreated?: () => void;
}

interface Slot {
  time: string;
  endTime: string;
  label: string;
  period: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';
  available: boolean;
  reason?: string;
  availableStationIds?: string[];
}

function getTodayKolkataDate(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

function getTomorrowKolkataDate(): string {
  try {
    const d = new Date(Date.now() + 86400000);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return new Date(Date.now() + 86400000).toISOString().split('T')[0];
  }
}

/**
 * Formats a 24-hour time string like "22:00" or "09:30" into normal 12-hour AM/PM format like "10:00 PM" or "9:30 AM"
 */
export function formatNormalTime(time24: string): string {
  if (!time24) return '';
  const parts = time24.split(':');
  if (parts.length < 2) return time24;
  let hour = parseInt(parts[0], 10);
  const min = parts[1] || '00';
  if (isNaN(hour)) return time24;
  const period = hour >= 12 && hour < 24 ? 'PM' : 'AM';
  if (hour === 0 || hour === 24) {
    hour = 12;
  } else if (hour > 12) {
    hour -= 12;
  }
  return `${hour}:${min} ${period}`;
}

export function StaffPreBookingModal({
  isOpen,
  onClose,
  stations,
  initialCategory = 'PS5',
  initialStationId,
  onBookingCreated,
}: StaffPreBookingModalProps) {
  const toast = useToast();

  const [category, setCategory] = useState<'PS5' | 'POOL_TABLE'>(initialCategory);
  const [stationId, setStationId] = useState<string>(initialStationId || 'ANY');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayKolkataDate());
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [playerCount, setPlayerCount] = useState<number>(1);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'PAY_ON_ARRIVAL' | 'CASH_NOW' | 'UPI_NOW'>('PAY_ON_ARRIVAL');

  // Customer Autocomplete / Search History state
  const [searchResults, setSearchResults] = useState<Array<{
    id: string;
    name: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;
    totalBookings?: number;
    lastPlayed?: string | null;
    lastPlayedDate?: string | null;
    membership: {
      id: string;
      tier: string;
      planName: string;
      discountPercent: number;
      badgeColor: string | null;
      expiresAt: string;
    } | null;
  }>>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState<boolean>(false);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const searchCustomers = (query: string) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    const cleanQuery = query.trim();
    if (cleanQuery.length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/staff/customers/search?q=${encodeURIComponent(cleanQuery)}`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setSearchResults(json.data);
          setShowSearchDropdown(true);
        } else {
          setSearchResults([]);
          setShowSearchDropdown(false);
        }
      } catch {
        setSearchResults([]);
      }
    }, 250);
  };

  const handleSelectCustomer = (cust: typeof searchResults[0]) => {
    setCustomerName(cust.name);
    setCustomerPhone(cust.phone || '');
    if (cust.email && !cust.email.includes('@darksyndicate.in')) {
      setCustomerEmail(cust.email);
    }
    setShowSearchDropdown(false);
    setSearchResults([]);
    toast.success(`Loaded returning player: ${cust.name}${cust.totalBookings ? ` (${cust.totalBookings} past games)` : ''}`);
  };

  const [slots, setSlots] = useState<Slot[]>([]);
  const [periodFilter, setPeriodFilter] = useState<'ALL' | 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT'>('ALL');
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successBooking, setSuccessBooking] = useState<any | null>(null);

  const isPs5 = category === 'PS5';
  const isPool = category === 'POOL_TABLE';

  const filteredSlots = useMemo(() => {
    if (periodFilter === 'ALL') return slots;
    return slots.filter((s) => s.period === periodFilter);
  }, [slots, periodFilter]);

  const periodCounts = useMemo(() => {
    return {
      ALL: slots.length,
      MORNING: slots.filter((s) => s.period === 'MORNING').length,
      AFTERNOON: slots.filter((s) => s.period === 'AFTERNOON').length,
      EVENING: slots.filter((s) => s.period === 'EVENING').length,
      NIGHT: slots.filter((s) => s.period === 'NIGHT').length,
    };
  }, [slots]);

  const firstAvailableSlot = useMemo(() => {
    return slots.find((s) => s.available);
  }, [slots]);

  const selectedSlotObj = useMemo(() => {
    return slots.find((s) => s.time === selectedTime);
  }, [slots, selectedTime]);

  // Synchronize category with initialCategory when modal opens
  useEffect(() => {
    if (isOpen) {
      setCategory(initialCategory || 'PS5');
      setStationId(initialStationId || 'ANY');
      setSelectedDate(getTodayKolkataDate());
      setSuccessBooking(null);
      setSelectedTime('');
      setPlayerCount(initialCategory === 'POOL_TABLE' ? 2 : 1);
      setSearchResults([]);
      setShowSearchDropdown(false);
    }
  }, [isOpen, initialCategory, initialStationId]);

  // Clamp player count when switching to PS5
  useEffect(() => {
    if (isPs5 && playerCount > 4) {
      setPlayerCount(4);
    }
  }, [isPs5, playerCount]);

  // Filter stations for selected category
  const filteredCategoryStations = useMemo(() => {
    return stations.filter((s) => s.stationType === category && s.status !== 'DEACTIVATED');
  }, [stations, category]);

  // Fetch slot availability when category, stationId, date, or duration changes
  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;

    const fetchAvailability = async () => {
      setLoadingSlots(true);
      try {
        const queryParams = new URLSearchParams({
          zone: category,
          date: selectedDate,
          duration: String(durationMinutes),
        });
        if (stationId && stationId !== 'ANY') {
          queryParams.set('stationId', stationId);
        }

        const res = await fetch(`/api/bookings/availability?${queryParams.toString()}`);
        const json = await res.json();
        if (!isCancelled && json.success && json.data?.slots) {
          setSlots(json.data.slots);
          // Auto deselect if selected slot is now unavailable
          if (selectedTime) {
            const matched = json.data.slots.find((s: Slot) => s.time === selectedTime);
            if (!matched || !matched.available) {
              setSelectedTime('');
            }
          }
        }
      } catch {
        if (!isCancelled) {
          toast.error('Could not load time slot availability.');
        }
      } finally {
        if (!isCancelled) setLoadingSlots(false);
      }
    };

    fetchAvailability();
    return () => {
      isCancelled = true;
    };
  }, [isOpen, category, stationId, selectedDate, durationMinutes]);

  // Calculate pricing
  const hourlyRate = useMemo(() => {
    if (isPs5) {
      if (playerCount === 2) return 200;
      if (playerCount >= 3) return 250;
      return 150;
    }
    // Snooker: Base ₹250/hr covers up to 4 players; +₹50/person/hr for >4
    if (playerCount <= 4) return 250;
    return 250 + (playerCount - 4) * 50;
  }, [isPs5, playerCount]);

  const totalPayable = Math.round(hourlyRate * (durationMinutes / 60));

  const handleQuickGuest = () => {
    setCustomerName('Walk-in Guest');
    if (!customerPhone) setCustomerPhone('');
  };

  const handleCategorySwitch = (newCat: 'PS5' | 'POOL_TABLE') => {
    setCategory(newCat);
    setStationId('ANY');
    setSelectedTime('');
    setPlayerCount(newCat === 'POOL_TABLE' ? 2 : 1);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedTime) {
      toast.error('Please select an available upcoming time slot.');
      return;
    }
    if (!customerName.trim()) {
      toast.error('Please enter the customer name.');
      return;
    }

    // Resolve station ID
    let targetStationId = stationId;
    if (targetStationId === 'ANY') {
      const selectedSlotObj = slots.find((s) => s.time === selectedTime);
      if (selectedSlotObj?.availableStationIds && selectedSlotObj.availableStationIds.length > 0) {
        targetStationId = selectedSlotObj.availableStationIds[0];
      } else {
        targetStationId = filteredCategoryStations[0]?.id;
      }
    }

    if (!targetStationId) {
      toast.error('No station is available for this slot.');
      return;
    }

    setSubmitting(true);
    try {
      const isSettled = paymentMode === 'CASH_NOW' || paymentMode === 'UPI_NOW';
      const paymentMethod = paymentMode === 'UPI_NOW' ? 'UPI' : 'CASH';
      const notesPayload = `[Front Desk Pre-Booking]${isSettled ? ' [SETTLED]' : ''} • Mode: ${paymentMode}${notes ? ` • Note: ${notes.trim()}` : ''}`;

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationId: targetStationId,
          date: selectedDate,
          startTime: selectedTime,
          durationMinutes,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim() || undefined,
          customerEmail: customerEmail.trim() || undefined,
          playerCount,
          payAtCounter: true,
          paymentMethod,
          notes: notesPayload,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        toast.success(`Reserved! Ref: ${json.data.bookingRef}`);
        setSuccessBooking(json.data);
        if (onBookingCreated) {
          onBookingCreated();
        }
      } else {
        toast.error(json.error?.message || 'Failed to create reservation.');
      }
    } catch {
      toast.error('Network error while creating reservation.');
    } finally {
      setSubmitting(false);
    }
  };

  const todayStr = getTodayKolkataDate();
  const tomorrowStr = getTomorrowKolkataDate();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      showCloseButton={!submitting}
      title={
        successBooking ? undefined : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-black text-base sm:text-lg text-white uppercase tracking-wide">
                  Pre-Book Upcoming Slot
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  24/7 Advance
                </span>
              </div>
              <p className="text-[11px] text-ds-text-dim mt-0.5">
                24 Hours Open (Round-the-Clock) • Schedule upcoming slots even when current stations are busy.
              </p>
            </div>
          </div>
        )
      }
      footer={
        successBooking ? undefined : (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
            <div className="flex items-baseline gap-2 text-xs">
              <span className="text-ds-text-dim uppercase font-heading font-bold">Total Payable:</span>
              <span className="text-2xl font-heading font-black text-ds-ice font-mono">
                ₹{totalPayable}
              </span>
              <span className="text-[10px] text-ds-text-dim font-mono">
                ({durationMinutes}m • {playerCount}P{selectedTime ? ` • ${formatNormalTime(selectedTime)}` : ''})
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 sm:flex-none text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="accent"
                size="sm"
                type="button"
                disabled={submitting || !selectedTime || !customerName.trim()}
                onClick={() => handleSubmit()}
                className="flex-1 sm:flex-none font-heading font-bold uppercase text-xs flex items-center justify-center gap-2 shadow-lg shadow-ds-accent/20 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Reserving...</span>
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    <span>Confirm Upcoming Slot</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )
      }
      className="border border-ds-border/80 bg-ds-dark shadow-2xl"
    >
      {/* ─── SUCCESS SCREEN ─── */}
      {successBooking ? (
        <div className="p-4 sm:p-6 space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400">
              Advance Slot Reserved Successfully
            </span>
            <h3 className="text-2xl font-heading font-black text-white uppercase">
              {successBooking.customerName || 'Guest Player'}
            </h3>
            <p className="text-xs text-ds-text-dim">
              Reservation confirmed on the Dark Syndicate ledger. Digital pass and QR code have been issued.
            </p>
          </div>

          <div className="max-w-md mx-auto p-4 rounded-2xl bg-ds-surface/50 border border-ds-border text-left space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-ds-border/60">
              <span className="text-ds-text-dim">Booking Reference</span>
              <span className="font-heading font-black text-sm text-ds-ice">
                {successBooking.bookingRef}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-ds-text-dim">Station</span>
              <span className="font-bold text-white">
                {successBooking.station?.name || 'Assigned Station'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-ds-text-dim">Scheduled Date &amp; Time</span>
              <span className="font-bold text-emerald-400 font-mono">
                {selectedTime ? formatNormalTime(selectedTime) : ''} ({selectedDate})
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-ds-text-dim">Players & Duration</span>
              <span className="text-white">
                {playerCount} Player{playerCount > 1 ? 's' : ''} • {durationMinutes} Mins
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-ds-border/60">
              <span className="text-ds-text-dim">Payment Status</span>
              <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                paymentMode !== 'PAY_ON_ARRIVAL'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {paymentMode !== 'PAY_ON_ARRIVAL' ? 'PAID AT COUNTER' : 'PAY ON ARRIVAL'} (₹{totalPayable})
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a
              href={`/booking/confirmation/${successBooking.bookingRef || successBooking.id}`}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="accent" size="sm" className="font-heading font-bold uppercase text-xs flex items-center gap-2">
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Digital Pass &amp; QR</span>
              </Button>
            </a>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSuccessBooking(null);
                setSelectedTime('');
              }}
              className="font-heading font-bold uppercase text-xs"
            >
              Book Another Slot
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="font-heading font-bold uppercase text-xs"
            >
              Close
            </Button>
          </div>
        </div>
      ) : (
        /* ─── BOOKING FORM (Single scrollbar, NO duplicate X, NO inner header) ─── */
        <div className="space-y-5 text-xs py-1">
            {/* 1. Arena & Station Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-heading font-bold uppercase tracking-wider text-ds-text flex items-center gap-1.5">
                  <span className={`w-5 h-5 rounded-full ${isPool ? 'bg-emerald-500/20 text-emerald-300' : 'bg-cyan-500/20 text-cyan-300'} text-[10px] flex items-center justify-center font-mono font-bold`}>
                    1
                  </span>
                  <span>{isPool ? 'Snooker Lounge Arena' : 'PlayStation 5 Arena'}</span>
                </label>
                <button
                  type="button"
                  onClick={() => handleCategorySwitch(isPool ? 'PS5' : 'POOL_TABLE')}
                  className="text-[10px] font-mono text-ds-text-dim hover:text-white underline transition-colors"
                >
                  Switch to {isPool ? 'PlayStation 5' : 'Snooker Lounge'}
                </button>
              </div>

              {/* Chosen Arena Display: ONLY show the selected arena! */}
              {isPool ? (
                <div className="p-3 sm:p-3.5 rounded-2xl border bg-emerald-950/40 border-emerald-400 text-white shadow-md shadow-emerald-950/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 flex items-center justify-center text-xl shrink-0">
                      🎱
                    </div>
                    <div>
                      <div className="font-heading font-black text-xs sm:text-sm uppercase text-white flex items-center gap-2">
                        <span>Snooker Lounge</span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                          Selected Arena
                        </span>
                      </div>
                      <div className="text-[10px] sm:text-[11px] text-emerald-300/90 font-mono mt-0.5">
                        ₹250 / hr (up to 4 Players • +₹50/extra for &gt; 4)
                      </div>
                    </div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                </div>
              ) : (
                <div className="p-3 sm:p-3.5 rounded-2xl border bg-cyan-950/40 border-cyan-400 text-white shadow-md shadow-cyan-950/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/30 text-cyan-400 flex items-center justify-center text-xl shrink-0">
                      🎮
                    </div>
                    <div>
                      <div className="font-heading font-black text-xs sm:text-sm uppercase text-white flex items-center gap-2">
                        <span>PlayStation 5 Arena</span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase">
                          Selected Arena
                        </span>
                      </div>
                      <div className="text-[10px] sm:text-[11px] text-cyan-300/90 font-mono mt-0.5">
                        From ₹150 / hr (1P: ₹150 • 2P: ₹200 • 3–4P: ₹250)
                      </div>
                    </div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0" />
                </div>
              )}

              {/* Specific Station Dropdown */}
              <div className="pt-1">
                <select
                  value={stationId}
                  onChange={(e) => setStationId(e.target.value)}
                  className="w-full bg-ds-dark border border-ds-border rounded-xl px-3 py-2 text-xs text-ds-text font-mono focus:border-cyan-400 focus:outline-none"
                >
                  <option value="ANY">
                    ✨ Any Available {isPool ? 'Snooker Table' : 'PS5 Console'} (Auto-Allocate)
                  </option>
                  {filteredCategoryStations.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} — ({st.facilityName})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 2. Date & Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Date */}
              <div className="space-y-2">
                <label className="text-[11px] font-heading font-bold uppercase tracking-wider text-ds-text flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] flex items-center justify-center font-mono">2</span>
                  <span>Booking Date</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDate(todayStr)}
                    className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-heading font-bold uppercase border transition-all ${
                      selectedDate === todayStr
                        ? 'bg-ds-accent text-white border-ds-accent shadow-sm'
                        : 'bg-ds-surface/40 border-ds-border text-ds-text-muted hover:text-white'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(tomorrowStr)}
                    className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-heading font-bold uppercase border transition-all ${
                      selectedDate === tomorrowStr
                        ? 'bg-ds-accent text-white border-ds-accent shadow-sm'
                        : 'bg-ds-surface/40 border-ds-border text-ds-text-muted hover:text-white'
                    }`}
                  >
                    Tomorrow
                  </button>
                  <div className="relative">
                    <input
                      type="date"
                      min={todayStr}
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="bg-ds-dark border border-ds-border rounded-xl px-2.5 py-2 text-xs font-mono text-ds-text [color-scheme:dark] focus:border-cyan-400 focus:outline-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <label className="text-[11px] font-heading font-bold uppercase tracking-wider text-ds-text flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] flex items-center justify-center font-mono">3</span>
                  <span>Duration</span>
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { min: 30, label: '30m' },
                    { min: 60, label: '1 Hour' },
                    { min: 120, label: '2 Hours' },
                    { min: 180, label: '3 Hours' },
                  ].map((d) => (
                    <button
                      key={d.min}
                      type="button"
                      onClick={() => setDurationMinutes(d.min)}
                      className={`py-2 px-1 rounded-xl text-xs font-heading font-bold uppercase border transition-all text-center ${
                        durationMinutes === d.min
                          ? 'bg-ds-accent text-white border-ds-accent shadow-sm'
                          : 'bg-ds-surface/40 border-ds-border text-ds-text-muted hover:text-white'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Upcoming Time Slot Selection (24 Hours Open) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-heading font-bold uppercase tracking-wider text-ds-text flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] flex items-center justify-center font-mono">4</span>
                  <span>Select Upcoming Time Slot</span>
                </label>
                <span className="text-[11px] font-mono text-cyan-400 font-bold">
                  {selectedSlotObj?.label ? `Selected: ${selectedSlotObj.label}` : selectedTime ? `Selected: ${formatNormalTime(selectedTime)}` : 'Pick a time'}
                </span>
              </div>

              {/* 24-Hour Chronological Period Filter Chips with live counts */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'ALL', label: 'All 24 Hours', count: slots.length },
                  { id: 'MORNING', label: 'Morning (6AM – 12PM)', count: periodCounts.MORNING },
                  { id: 'AFTERNOON', label: 'Afternoon (12PM – 5PM)', count: periodCounts.AFTERNOON },
                  { id: 'EVENING', label: 'Evening (5PM – 9PM)', count: periodCounts.EVENING },
                  { id: 'NIGHT', label: 'Night (9PM – 6AM)', count: periodCounts.NIGHT },
                ].map((p) => {
                  const isZero = p.count === 0 && p.id !== 'ALL';
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={isZero}
                      onClick={() => setPeriodFilter(p.id as any)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all border flex items-center gap-1 ${
                        periodFilter === p.id
                          ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300 font-bold shadow-sm'
                          : isZero
                          ? 'bg-ds-surface/20 border-ds-border/40 text-ds-text-dim/40 cursor-not-allowed'
                          : 'bg-ds-surface/40 border-ds-border/60 text-ds-text-dim hover:text-white cursor-pointer'
                      }`}
                    >
                      <span>{p.label}</span>
                      <span className={`text-[9px] font-bold ${periodFilter === p.id ? 'text-cyan-300' : 'text-ds-text-dim'}`}>
                        ({p.count})
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Earliest Slot Quick-Select Banner */}
              {!loadingSlots && firstAvailableSlot && slots.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-400 font-bold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Earliest Open Slot:</span>
                    </span>
                    <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                      {formatNormalTime(firstAvailableSlot.time)}
                    </span>
                    <span className="text-ds-text-dim text-[11px] hidden sm:inline">
                      ({firstAvailableSlot.label})
                    </span>
                  </div>
                  {selectedTime !== firstAvailableSlot.time && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTime(firstAvailableSlot.time);
                        setPeriodFilter('ALL');
                      }}
                      className="text-[11px] font-heading font-bold text-cyan-300 hover:text-white uppercase transition-colors underline cursor-pointer"
                    >
                      Select Earliest Slot →
                    </button>
                  )}
                </div>
              )}

              {loadingSlots ? (
                <div className="p-8 text-center bg-ds-surface/30 rounded-2xl border border-ds-border flex flex-col items-center justify-center gap-2 text-ds-text-dim font-mono text-xs">
                  <RotateCw className="w-5 h-5 animate-spin text-cyan-400" />
                  <span>Checking live station availability for {selectedDate}...</span>
                </div>
              ) : slots.length === 0 ? (
                /* Empty state when NO slots are available for the entire day */
                <div className="p-6 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto text-xl">
                    🌙
                  </div>
                  <div>
                    <h4 className="font-heading font-black text-sm uppercase text-white">
                      {selectedDate === todayStr
                        ? 'No More Advance Slots for Tonight'
                        : 'No Slots Available for Selected Date'}
                    </h4>
                    <p className="text-xs text-ds-text-muted mt-1 max-w-md mx-auto leading-relaxed">
                      {selectedDate === todayStr
                        ? 'All scheduled slots for today have concluded or are in-session. Advance bookings open continuously starting from 12:00 AM (Midnight) for tomorrow.'
                        : 'All stations are fully booked for this selected date and duration. Try selecting a shorter duration or checking adjacent dates.'}
                    </p>
                  </div>
                  {selectedDate === todayStr && (
                    <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                      <Button
                        variant="accent"
                        size="sm"
                        type="button"
                        onClick={() => {
                          setSelectedDate(tomorrowStr);
                          setPeriodFilter('ALL');
                          setSelectedTime('');
                        }}
                        className="text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
                      >
                        <span>View Tomorrow (From 12:00 AM Midnight)</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ) : filteredSlots.length === 0 ? (
                /* Empty state when a specific period chip has 0 slots, but other periods have slots */
                <div className="p-6 text-center bg-ds-surface/30 rounded-2xl border border-dashed border-ds-border text-ds-text-dim space-y-2.5">
                  <p className="text-xs text-ds-text-muted">
                    No slots available in the <span className="font-bold text-cyan-300 uppercase">{periodFilter}</span> period.
                  </p>
                  <button
                    type="button"
                    onClick={() => setPeriodFilter('ALL')}
                    className="px-3 py-1 rounded-lg bg-ds-surface border border-ds-border hover:border-cyan-400 text-xs font-mono text-cyan-300 transition-all cursor-pointer"
                  >
                    Show All {slots.length} Open Slots
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-ds-surface/20 border border-ds-border space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-72 overflow-y-auto pr-1">
                    {filteredSlots.map((slot) => {
                      const isSelected = selectedTime === slot.time;
                      const readyCount = slot.availableStationIds?.length ?? (slot.available ? 3 : 0);
                      const arenaUnit = isPool
                        ? (readyCount === 1 ? 'TABLE' : 'TABLES')
                        : (readyCount === 1 ? 'PS5' : 'PS5S');
                      const rangeDisplay = slot.label || `${formatNormalTime(slot.time)} – ${formatNormalTime(slot.endTime)}`;

                      return (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={!slot.available}
                          onClick={() => setSelectedTime(slot.time)}
                          className={`p-3.5 sm:p-4 rounded-2xl text-center transition-all flex flex-col items-center justify-center gap-1.5 min-h-[76px] cursor-pointer ${
                            isSelected
                              ? 'bg-[#38bdf8] text-white border-2 border-[#7dd3fc] shadow-[0_0_25px_rgba(56,189,248,0.5)] ring-2 ring-[#38bdf8]/40 scale-[1.02]'
                              : slot.available
                              ? 'bg-ds-surface/50 border border-ds-border hover:border-cyan-400/60 hover:bg-ds-surface/80 text-white shadow-sm'
                              : 'bg-ds-surface/20 border border-ds-border/30 text-ds-text-dim/40 cursor-not-allowed opacity-40'
                          }`}
                        >
                          <span className="font-heading font-black text-xs sm:text-sm text-white tracking-wide uppercase leading-tight text-center">
                            {rangeDisplay}
                          </span>
                          <span
                            className={`text-[10px] sm:text-[11px] font-heading font-black tracking-wider uppercase ${
                              isSelected
                                ? 'text-emerald-700 drop-shadow-sm'
                                : slot.available
                                ? 'text-emerald-400'
                                : 'text-rose-400/80'
                            }`}
                          >
                            {slot.available ? `${readyCount} ${arenaUnit} READY` : 'BOOKED'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-between text-[10px] text-ds-text-dim font-mono gap-1.5 pt-1 border-t border-ds-border/40">
                    <span className="text-amber-400 font-bold flex items-center gap-1">
                      <span>⚡ Operating Hours: 24 Hours Open (Round-the-Clock 24/7)</span>
                    </span>
                    <span className="flex items-center gap-2.5">
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Available
                      </span>
                      <span className="inline-flex items-center gap-1 text-rose-400/80">
                        <span className="w-2 h-2 rounded-full bg-rose-400/60" /> Booked
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Player Count (Strictly Snookers only for extra players >4, and only revealed when 4 players selected) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-heading font-bold uppercase tracking-wider text-ds-text flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] flex items-center justify-center font-mono">5</span>
                  <span>Number of Players</span>
                </label>
                <div className="flex items-center gap-2">
                  {isPool && playerCount > 4 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                      +{playerCount - 4} Extra ({playerCount - 4} × ₹50/hr)
                    </span>
                  )}
                  <span className="text-[11px] font-mono text-cyan-400 font-bold">
                    ₹{hourlyRate}/hr
                  </span>
                </div>
              </div>

              {/* Standard 1 - 4 Players */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { count: 1, label: '1 Player' },
                  { count: 2, label: '2 Players' },
                  { count: 3, label: '3 Players' },
                  { count: 4, label: '4 Players' },
                ].map(({ count, label }) => (
                  <button
                    type="button"
                    key={count}
                    onClick={() => setPlayerCount(count)}
                    className={`py-2 rounded-xl text-xs font-heading font-bold uppercase transition-all border ${
                      playerCount === count
                        ? 'bg-cyan-950/60 border-cyan-400 text-white ring-1 ring-cyan-400/80 shadow-sm shadow-cyan-400/30'
                        : 'bg-ds-surface/60 border-ds-border text-ds-text-muted hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Extra Players: ONLY for Snookers / Pool Table AND ONLY when 4 or more players selected */}
              {isPool && playerCount >= 4 && (
                <div className="p-2.5 rounded-xl bg-ds-dark/60 border border-amber-500/30 space-y-1.5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-heading font-bold text-amber-400 uppercase tracking-wide flex items-center gap-1">
                      <span>Add Extra Players (&gt; 4 Players)</span>
                    </span>
                    <span className="font-mono text-[10px] text-amber-300 font-semibold">
                      +₹50 / person per hour
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { count: 5, label: '5 Players', extra: '+₹50' },
                      { count: 6, label: '6 Players', extra: '+₹100' },
                      { count: 7, label: '7 Players', extra: '+₹150' },
                      { count: 8, label: '8 Players', extra: '+₹200' },
                    ].map(({ count, label, extra }) => (
                      <button
                        type="button"
                        key={count}
                        onClick={() => setPlayerCount(count)}
                        className={`py-2 px-1 rounded-xl text-xs font-heading font-bold uppercase transition-all border flex flex-col items-center justify-center ${
                          playerCount === count
                            ? 'bg-amber-500/25 border-amber-400 text-amber-300 ring-1 ring-amber-400 shadow-sm shadow-amber-400/30'
                            : 'bg-ds-surface/40 border-ds-border text-ds-text-muted hover:border-amber-400/50 hover:text-amber-200'
                        }`}
                      >
                        <span className="text-[11px] font-bold">{label}</span>
                        <span
                          className={`text-[10px] font-mono font-bold mt-0.5 ${
                            playerCount === count ? 'text-amber-300' : 'text-amber-400/90'
                          }`}
                        >
                          {extra}/hr
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 5. Customer Information */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-heading font-bold uppercase tracking-wider text-ds-text flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] flex items-center justify-center font-mono">6</span>
                  <span>Customer Information</span>
                </label>
                <button
                  type="button"
                  onClick={handleQuickGuest}
                  className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 underline font-semibold flex items-center gap-1"
                >
                  <Zap className="w-3 h-3" />
                  <span>Quick Walk-in Guest</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
                <div className="relative">
                  <Input
                    placeholder="Gamer / Customer Name *"
                    value={customerName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomerName(val);
                      searchCustomers(val);
                    }}
                    onFocus={() => {
                      if (searchResults.length > 0) setShowSearchDropdown(true);
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowSearchDropdown(false), 250);
                    }}
                    required
                    className="text-xs py-2 bg-ds-dark border-ds-border focus:border-cyan-400"
                  />

                  {/* Autocomplete Search Dropdown */}
                  {showSearchDropdown && searchResults.length > 0 && (
                    <div className="absolute left-0 right-0 sm:right-auto sm:w-[380px] top-full mt-1.5 z-[100] bg-[#08121e] border border-cyan-500/50 rounded-xl shadow-[0_12px_28px_rgba(0,0,0,0.9)] p-1.5 space-y-1 backdrop-blur-md max-h-56 overflow-y-auto">
                      <div className="text-[10px] font-mono text-cyan-400 font-bold px-2 py-1 uppercase tracking-wider flex items-center justify-between border-b border-cyan-900/50">
                        <span className="flex items-center gap-1">
                          <span>🎮 Returning Players</span>
                        </span>
                        <span>{searchResults.length} found</span>
                      </div>
                      {searchResults.map((cust) => (
                        <button
                          type="button"
                          key={cust.id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectCustomer(cust);
                          }}
                          className="w-full text-left p-2 rounded-lg hover:bg-cyan-950/70 transition-all flex items-center justify-between gap-2 group border border-transparent hover:border-cyan-500/40 cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-heading font-black text-xs text-white group-hover:text-cyan-300 truncate">
                                {cust.name}
                              </span>
                              {cust.membership && (
                                <Badge variant="warning" size="sm" className="text-[9px] py-0 px-1 font-mono font-bold">
                                  👑 {cust.membership.tier} ({cust.membership.discountPercent}%)
                                </Badge>
                              )}
                              {cust.totalBookings && cust.totalBookings > 0 && (
                                <span className="text-[9px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1 rounded">
                                  {cust.totalBookings}x played
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-ds-text-dim font-mono truncate flex items-center gap-1.5 mt-0.5">
                              {cust.phone ? <span>📱 {cust.phone}</span> : null}
                              {cust.lastPlayed ? <span>• Last: {cust.lastPlayed}</span> : null}
                              {cust.lastPlayedDate ? <span className="text-ds-text-muted">({cust.lastPlayedDate})</span> : null}
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-cyan-400 group-hover:underline shrink-0 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                            Auto-fill ↵
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <Input
                  placeholder="WhatsApp Mobile Number (Optional)"
                  value={customerPhone}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomerPhone(val);
                    searchCustomers(val);
                  }}
                  onFocus={() => {
                    if (searchResults.length > 0) setShowSearchDropdown(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowSearchDropdown(false), 250);
                  }}
                  className="text-xs py-2 bg-ds-dark border-ds-border focus:border-cyan-400 font-mono"
                />
              </div>

              <Input
                placeholder="Optional Special Request / Game Title / Tournament Note"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-xs py-2 bg-ds-dark border-ds-border focus:border-cyan-400"
              />
            </div>

            {/* 6. Payment Timing & Mode */}
            <div className="space-y-2">
              <label className="text-[11px] font-heading font-bold uppercase tracking-wider text-ds-text flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] flex items-center justify-center font-mono">7</span>
                <span>Payment Settlement Mode</span>
              </label>

              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    id: 'PAY_ON_ARRIVAL',
                    label: 'Pay on Arrival',
                    sub: 'Unpaid Reservation',
                    icon: CreditCard,
                  },
                  {
                    id: 'CASH_NOW',
                    label: 'Cash (Paid Now)',
                    sub: 'Settled at Desk',
                    icon: Banknote,
                  },
                  {
                    id: 'UPI_NOW',
                    label: 'UPI (Paid Now)',
                    sub: 'Settled at Desk',
                    icon: QrCode,
                  },
                ].map((m) => {
                  const Icon = m.icon;
                  const isChosen = paymentMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMode(m.id as any)}
                      className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center ${
                        isChosen
                          ? 'bg-ds-surface border-cyan-400 text-white ring-1 ring-cyan-400/80 shadow-md shadow-cyan-950/40'
                          : 'bg-ds-surface/40 border-ds-border text-ds-text-dim hover:text-white hover:border-ds-border/80'
                      }`}
                    >
                      <Icon className={`w-4 h-4 mb-1 ${isChosen ? 'text-cyan-400' : 'text-ds-text-dim'}`} />
                      <span className="font-heading font-bold text-[11px] uppercase">{m.label}</span>
                      <span className="text-[9px] text-ds-text-dim font-mono">{m.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>
    );
  }
