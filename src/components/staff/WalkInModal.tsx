'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Gamepad2, Search, Monitor, AlertCircle, Crown, Clock, Check } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { ARENA_GAMES, lookupGame, type GameCatalogItem } from '@/lib/gameCatalog';

interface StationGame {
  id: string;
  title: string;
  genre: string | null;
  coverImage: string | null;
  maxPlayers: number;
  isFeatured?: boolean;
}

interface Station {
  id: string;
  name: string;
  stationType: string;
  facilityName: string;
  imageUrl?: string;
  specs?: string;
  capacity?: number;
  pricePerHourPaise: number;
  status: string;
  games?: StationGame[];
  upcomingBookings?: Array<{
    id: string;
    bookingRef: string;
    customerName: string;
    startTime: string;
    endTime: string;
    status?: string;
  }>;
}

interface WalkInModalProps {
  isOpen: boolean;
  onClose: () => void;
  stations: Station[];
  preselectedStationId?: string;
  onSuccess: () => void;
}

export function getStationAvailabilityState(st: Station, durationMins: number = 60): {
  isAvailable: boolean;
  statusLabel: string;
  conflictReason?: string;
} {
  if (st.status === 'MAINTENANCE') {
    return { isAvailable: false, statusLabel: 'MAINT' };
  }
  if (st.status === 'DEACTIVATED') {
    return { isAvailable: false, statusLabel: 'OFFLINE' };
  }
  if (st.status === 'OCCUPIED') {
    return { isAvailable: false, statusLabel: 'BUSY' };
  }

  // Check if upcoming booking overlaps with [now, now + durationMins]
  if (st.upcomingBookings && st.upcomingBookings.length > 0) {
    const nowMs = Date.now();
    const sessionEndMs = nowMs + durationMins * 60 * 1000;
    const conflictBooking = st.upcomingBookings.find((b) => {
      const bStart = new Date(b.startTime).getTime();
      const bEnd = new Date(b.endTime).getTime();
      return bStart < sessionEndMs && bEnd > nowMs;
    });

    if (conflictBooking) {
      const conflictDate = new Date(conflictBooking.startTime);
      const timeStr = conflictDate.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      return {
        isAvailable: false,
        statusLabel: 'RESERVED',
        conflictReason: `Reserved at ${timeStr}`,
      };
    }
  }

  return { isAvailable: true, statusLabel: 'READY' };
}

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  PS5: { label: 'PlayStation 5', icon: '🎮' },
  POOL_TABLE: { label: 'Snooker & Pool', icon: '🎱' },
  PC: { label: 'PC Gaming', icon: '💻' },
  VR: { label: 'VR Arena', icon: '🥽' },
  OTHER: { label: 'Other Stations', icon: '🎯' },
};

function PlayStationLogo({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.669 17.217c-.38-.975-1.474-1.74-2.883-2.062l-3.83-.872v2.709l2.842.663c.691.162.918.47.918.777 0 .428-.488.752-1.283.752-.942 0-2.327-.406-3.864-1.118v2.771c1.554.673 3.125 1.007 4.549 1.007 2.274 0 3.905-1.082 3.905-2.827 0-.616-.201-1.242-.754-1.8m-8.988-7.397v10.513l-3.08-1.033v-4.004l-3.151.71v-2.736l3.151-.71V3.12l3.08 1.042v5.658zm-5.748 6.471l-2.842-.663c-.691-.162-.918-.47-.918-.777 0-.428.488-.752 1.283-.752.942 0 2.327.406 3.864 1.118v-2.771c-1.554-.673-3.125-1.007-4.549-1.007-2.274 0-3.905 1.082-3.905 2.827 0 .616.201 1.242.754 1.8.38.975 1.474 1.74 2.883 2.062l3.83.872v-2.709z" />
    </svg>
  );
}

function PoolTableIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="7" cy="11" r="1.5" fill="currentColor" />
      <circle cx="12" cy="13" r="1.5" fill="currentColor" />
      <circle cx="17" cy="10" r="1.5" fill="currentColor" />
      <path d="M4 18v2" />
      <path d="M20 18v2" />
      <path d="M4 6V4" />
      <path d="M20 6V4" />
    </svg>
  );
}

function getStationIcon(type: string) {
  switch (type) {
    case 'PS5':
      return <PlayStationLogo className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" />;
    case 'POOL_TABLE':
      return <PoolTableIcon className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]" />;
    case 'PC':
      return <Monitor className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" />;
    default:
      return <Gamepad2 className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" />;
  }
}

export function WalkInModal({
  isOpen,
  onClose,
  stations,
  preselectedStationId,
  onSuccess,
}: WalkInModalProps) {
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const availableStations = stations.filter((s) => getStationAvailabilityState(s, durationMinutes).isAvailable);
  const initialStation =
    stations.find((s) => s.id === preselectedStationId && getStationAvailabilityState(s, 60).isAvailable) ||
    availableStations[0] ||
    stations[0];

  // Distinct category tabs ordered PS5 -> Snooker -> PC -> others
  const availableCategories = Array.from(
    new Set(stations.map((s) => s.stationType))
  ).sort((a, b) => {
    const order = ['PS5', 'POOL_TABLE', 'PC', 'VR', 'OTHER'];
    return (
      (order.indexOf(a) !== -1 ? order.indexOf(a) : 99) -
      (order.indexOf(b) !== -1 ? order.indexOf(b) : 99)
    );
  });

  const [activeCategory, setActiveCategory] = useState<string>(initialStation?.stationType || 'PS5');
  const [selectedStationId, setSelectedStationId] = useState<string>(initialStation?.id || '');
  const [selectedGameTitle, setSelectedGameTitle] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [playerCount, setPlayerCount] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const toast = useToast();

  // Customer Autocomplete & Active Membership State
  const [searchResults, setSearchResults] = useState<Array<{
    id: string;
    name: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;
    membership: {
      id: string;
      tier: string;
      planName: string;
      discountPercent: number;
      badgeColor: string;
      expiresAt: string;
    } | null;
  }>>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [activeMembership, setActiveMembership] = useState<{
    id: string;
    tier: string;
    planName: string;
    discountPercent: number;
    badgeColor: string;
    expiresAt: string;
  } | null>(null);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Form Validation State & Helpers
  const [formErrors, setFormErrors] = useState<{
    station?: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
  }>({});
  const [touched, setTouched] = useState<{
    customerName?: boolean;
    customerPhone?: boolean;
    customerEmail?: boolean;
  }>({});

  const validateName = (name: string): string | undefined => {
    const trimmed = name.trim();
    if (!trimmed) return 'Gamer name is required';
    if (trimmed.length < 2) return 'Name must be at least 2 characters';
    if (!/^[a-zA-Z0-9\s.'-]+$/.test(trimmed)) return 'Name contains invalid characters';
    return undefined;
  };

  const validatePhone = (phone: string): string | undefined => {
    const trimmed = phone.trim();
    if (!trimmed) return undefined; // Optional for desk walk-in
    const rawDigits = trimmed.replace(/\D/g, '');
    const digits = rawDigits.length === 12 && rawDigits.startsWith('91') ? rawDigits.slice(2) : rawDigits;
    if (digits.length !== 10) return 'Must be a 10-digit mobile number';
    if (!/^[6-9]/.test(digits)) return 'Indian mobile numbers start with 6, 7, 8, or 9';
    return undefined;
  };

  const validateEmail = (email: string): string | undefined => {
    const trimmed = email.trim();
    if (!trimmed) return undefined; // Optional field
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return 'Please enter a valid email address';
    }
    return undefined;
  };

  // Debounced search customer directory
  const searchCustomers = (query: string) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    const cleanQuery = query.trim();
    if (cleanQuery.length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    setIsSearching(true);
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
      } finally {
        setIsSearching(false);
      }
    }, 250);
  };

  const handleSelectCustomer = (cust: typeof searchResults[0]) => {
    setCustomerName(cust.name);
    setCustomerPhone(cust.phone || '');
    setCustomerEmail(cust.email && !cust.email.includes('@darksyndicate.in') ? cust.email : '');
    setActiveMembership(cust.membership);
    setShowSearchDropdown(false);
    setSearchResults([]);
    setFormErrors((prev) => ({ ...prev, customerName: undefined, customerPhone: undefined, customerEmail: undefined }));
    if (cust.membership) {
      toast.success(`${cust.membership.planName} applied (${cust.membership.discountPercent}% discount)`);
    } else {
      toast.info(`Selected gamer: ${cust.name}`);
    }
  };

  // Direct check when 10 digits are typed in phone input
  const checkPhoneMembership = async (rawPhone: string) => {
    const digits = rawPhone.replace(/\D/g, '').slice(-10);
    if (digits.length === 10 && !activeMembership) {
      try {
        const res = await fetch(`/api/staff/customers/search?phone=${digits}`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const matched = json.data[0];
          if (matched.membership) {
            setActiveMembership(matched.membership);
            toast.success(`${matched.membership.planName} applied for ${matched.name} (${matched.membership.discountPercent}% OFF)`);
          }
          if (!customerName || customerName === 'Walk-in Guest') {
            setCustomerName(matched.name);
          }
        }
      } catch {
        // Ignore
      }
    }
  };

  // Ref to track modal transition so 10-second polling does not wipe what staff is typing
  const prevIsOpenRef = React.useRef(false);

  // Synchronize preselected station and category ONLY when modal transitions from closed to open
  useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (isOpen && !wasOpen) {
      const target =
        stations.find((s) => s.id === preselectedStationId && getStationAvailabilityState(s, durationMinutes).isAvailable) ||
        stations.find((s) => s.id === preselectedStationId) ||
        stations.find((s) => s.stationType === activeCategory && getStationAvailabilityState(s, durationMinutes).isAvailable) ||
        stations.find((s) => getStationAvailabilityState(s, durationMinutes).isAvailable) ||
        stations[0];
      if (target) {
        setSelectedStationId(target.id);
        setActiveCategory(target.stationType);
      }
      setDurationMinutes(60);
      setSelectedGameTitle('');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setPlayerCount(1);
      setFormErrors({});
      setTouched({});
      setActiveMembership(null);
      setSearchResults([]);
      setShowSearchDropdown(false);
    }
  }, [isOpen, preselectedStationId, stations, durationMinutes, activeCategory]);

  const selectedStation = stations.find((s) => s.id === selectedStationId);
  const categoryStations = stations.filter((s) => s.stationType === activeCategory);
  const isConsoleStation =
    selectedStation?.stationType === 'PS5' ||
    selectedStation?.stationType === 'PC' ||
    Boolean(selectedStation?.games && selectedStation.games.length > 0);

  const isPs5 =
    selectedStation?.stationType === 'PS5' ||
    Boolean(selectedStation?.name?.toUpperCase().includes('PS5'));
  const isPool =
    selectedStation?.stationType === 'POOL_TABLE' ||
    Boolean(selectedStation?.name?.toUpperCase().includes('SNOOKER')) ||
    Boolean(selectedStation?.name?.toUpperCase().includes('POOL'));

  let dynamicHourlyRate = selectedStation ? selectedStation.pricePerHourPaise : 15000;
  if (isPs5) {
    if (playerCount === 2) dynamicHourlyRate = 20000;
    else if (playerCount >= 3) dynamicHourlyRate = 25000;
    else dynamicHourlyRate = 15000;
  } else if (isPool) {
    const basePoolRate = selectedStation ? selectedStation.pricePerHourPaise : 25000;
    dynamicHourlyRate = basePoolRate + Math.max(0, playerCount - 4) * 5000;
  } else {
    dynamicHourlyRate = selectedStation ? selectedStation.pricePerHourPaise : 15000;
  }

  // Safety clamp: if non-pool station is selected, clamp max players to 4
  useEffect(() => {
    if (!isPool && playerCount > 4) {
      setPlayerCount(4);
    }
  }, [isPool, playerCount]);
  const subtotalPaise = Math.round(dynamicHourlyRate * (durationMinutes / 60));
  const discountPercent = activeMembership?.discountPercent || 0;
  const discountPaise = discountPercent > 0 ? Math.round((subtotalPaise * discountPercent) / 100) : 0;
  const totalFeePaise = Math.max(0, subtotalPaise - discountPaise);

  // Switch category and auto-select first available station
  const handleCategoryChange = (catKey: string) => {
    setActiveCategory(catKey);
    const firstAvailable =
      stations.find((s) => s.stationType === catKey && getStationAvailabilityState(s, durationMinutes).isAvailable) ||
      stations.find((s) => s.stationType === catKey);
    if (firstAvailable) {
      setSelectedStationId(firstAvailable.id);
    }
    setSelectedGameTitle('');
  };

  // Change duration and switch station if currently selected station has a conflict
  const handleDurationChange = (minutes: number) => {
    setDurationMinutes(minutes);
    const curr = stations.find((s) => s.id === selectedStationId);
    if (curr && !getStationAvailabilityState(curr, minutes).isAvailable) {
      const firstAvailableInCat = stations.find(
        (s) => s.stationType === activeCategory && getStationAvailabilityState(s, minutes).isAvailable
      );
      if (firstAvailableInCat) {
        setSelectedStationId(firstAvailableInCat.id);
      }
    }
  };

  // Base catalog games for current category
  const isPoolCategory = activeCategory === 'POOL_TABLE';
  const platformGames = useMemo(() => {
    return ARENA_GAMES.filter((g) =>
      isPoolCategory ? g.platform === 'POOL_TABLE' : g.platform === 'PS5'
    );
  }, [isPoolCategory]);

  // Merge station games with catalog games to ensure rich cover images and all top 8 games
  const popularGames = useMemo(() => {
    const list: GameCatalogItem[] = [];
    const seen = new Set<string>();

    // 1. Top platform games from catalog (e.g. FC 24, Tekken 8, Spider-Man 2, MK1, GTA V, WWE 2K24, It Takes Two, COD MW3)
    for (const g of platformGames) {
      if (!seen.has(g.title.toLowerCase())) {
        seen.add(g.title.toLowerCase());
        list.push(g);
      }
    }

    // 2. Any additional games configured on the station in DB
    if (selectedStation?.games && selectedStation.games.length > 0) {
      for (const sg of selectedStation.games) {
        if (!seen.has(sg.title.toLowerCase())) {
          seen.add(sg.title.toLowerCase());
          const lookedUp = lookupGame(sg.title);
          list.push({
            slug: lookedUp?.slug || sg.id,
            title: sg.title,
            platform: (selectedStation.stationType === 'POOL_TABLE' ? 'POOL_TABLE' : 'PS5') as 'PS5' | 'POOL_TABLE',
            genre: sg.genre || lookedUp?.genre || 'Action',
            description: lookedUp?.description || '',
            coverImage: sg.coverImage || lookedUp?.coverImage || '/games/ea-sports-fc-24.jpg',
            maxPlayers: sg.maxPlayers || lookedUp?.maxPlayers || 2,
            isFeatured: sg.isFeatured ?? lookedUp?.isFeatured,
          });
        }
      }
    }

    return list.slice(0, 8);
  }, [platformGames, selectedStation]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const nameErr = validateName(customerName);
    const phoneErr = validatePhone(customerPhone);
    const emailErr = validateEmail(customerEmail);
    const stationErr = !selectedStationId ? 'Please choose an available station to continue' : undefined;

    setTouched({ customerName: true, customerPhone: true, customerEmail: true });
    setFormErrors({
      customerName: nameErr,
      customerPhone: phoneErr,
      customerEmail: emailErr,
      station: stationErr,
    });

    if (stationErr) {
      toast.error(stationErr);
      return;
    }

    if (selectedStation) {
      const availState = getStationAvailabilityState(selectedStation, durationMinutes);
      if (!availState.isAvailable) {
        toast.error(`Selected station is ${availState.statusLabel}. Please choose an available station.`);
        return;
      }
    }

    if (nameErr || phoneErr || emailErr) {
      toast.error(nameErr || phoneErr || emailErr || 'Please check the highlighted errors');
      return;
    }

    const rawDigits = customerPhone.replace(/\D/g, '');
    const cleanPhone = rawDigits.length === 12 && rawDigits.startsWith('91') ? rawDigits.slice(2) : rawDigits;
    const resolvedPaymentMethod = 'PAY_ON_EXIT';

    setSubmitting(true);
    try {
      const res = await fetch('/api/staff/walk-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationId: selectedStationId,
          durationMinutes,
          playerCount,
          customerName: customerName.trim(),
          customerPhone: cleanPhone || undefined,
          customerEmail: customerEmail.trim() || undefined,
          paymentMethod: resolvedPaymentMethod,
          gameTitle: selectedGameTitle.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`Walk-in tab opened for ${customerName}! (Pay on Exit)`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('ds-booking-updated'));
        }
        onSuccess();
        onClose();
      } else {
        toast.error(json.error?.message || 'Failed to start session');
      }
    } catch {
      toast.error('Error allocating console');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Desk Walk-in Rapid Allocation"
      description="Quickly assign available gaming consoles and snooker tables to walk-in players."
      size="full"
      footerClassName="bg-[#090f19] border-t border-cyan-500/30 shadow-[0_-12px_32px_rgba(0,0,0,0.85)] z-20 py-2.5 sm:py-3.5 px-3 sm:px-6"
      footer={
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4 w-full">
          <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <Badge variant="accent" size="sm" className="font-heading font-bold text-xs uppercase shrink-0">
                {selectedStation?.name || 'No Station'}
              </Badge>
              {selectedGameTitle && (
                <Badge variant="default" size="sm" className="font-mono text-[11px] sm:text-xs text-ds-ice truncate max-w-[130px] sm:max-w-none">
                  🎮 {selectedGameTitle}
                </Badge>
              )}
            </div>

            <div className="pl-2.5 sm:pl-3 border-l border-ds-border shrink-0 text-right sm:text-left">
              <span className="text-[9px] uppercase font-mono text-cyan-400 font-bold block leading-tight">
                {activeMembership && discountPaise > 0 ? (
                  <span className="text-amber-400 font-bold">{activeMembership.planName} (Save ₹{(discountPaise / 100).toFixed(0)})</span>
                ) : (
                  'To Collect on Exit (Open Tab)'
                )}
              </span>
              <div className="flex items-baseline gap-1.5 justify-end sm:justify-start">
                {activeMembership && discountPaise > 0 && (
                  <span className="text-xs line-through text-ds-text-dim font-mono">
                    ₹{(subtotalPaise / 100).toFixed(0)}
                  </span>
                )}
                <span className="text-base sm:text-xl font-heading font-black text-ds-ice leading-tight">
                  ₹{(totalFeePaise / 100).toFixed(0)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="text-xs sm:text-sm py-1.5 sm:py-2 px-3 sm:px-4 font-heading font-semibold"
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              size="sm"
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit()}
              className="text-xs sm:text-sm py-1.5 sm:py-2 px-3.5 sm:px-5 shadow-md shadow-ds-accent/20 cursor-pointer font-heading font-bold"
            >
              {submitting ? (
                'Allocating...'
              ) : (
                <>
                  <span className="sm:hidden">Confirm & Open Tab</span>
                  <span className="hidden sm:inline">Confirm & Open Tab (Pay on Exit)</span>
                </>
              )}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col justify-between" noValidate>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-4">
          {/* ─── LEFT COLUMN: CATEGORY, STATION & GAME (7 COLS) ─── */}
          <div className="lg:col-span-7 space-y-4">
            {/* 1. Choose Station: When PlayStation is selected, show ONLY PlayStations (3 consoles); when Snooker is selected, show ONLY Snookers (3 tables) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-heading font-black text-ds-ice uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-400 text-cyan-300 text-[11px] flex items-center justify-center font-mono font-bold">1</span>
                  <span>Choose {activeCategory === 'PS5' ? `PlayStation Console (${categoryStations.length} Units)` : `Snooker Table (${categoryStations.length} Units)`}</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-[#08101a] p-1 rounded-xl border border-cyan-950/80">
                    <button
                      type="button"
                      onClick={() => handleCategoryChange('PS5')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-heading font-bold uppercase transition-all flex items-center gap-1 ${
                        activeCategory === 'PS5'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/60 shadow-sm'
                          : 'text-ds-text-dim hover:text-white'
                      }`}
                    >
                      <span>🎮 PS5</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCategoryChange('POOL_TABLE')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-heading font-bold uppercase transition-all flex items-center gap-1 ${
                        activeCategory === 'POOL_TABLE'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/60 shadow-sm'
                          : 'text-ds-text-dim hover:text-white'
                      }`}
                    >
                      <span>🎱 Snooker</span>
                    </button>
                  </div>
                  <span className="text-[11px] font-mono text-cyan-400 font-bold hidden sm:inline">
                    {categoryStations.filter((s) => getStationAvailabilityState(s, durationMinutes).isAvailable).length} / {categoryStations.length} Ready
                  </span>
                </div>
              </div>

              {formErrors.station && (
                <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 px-3 py-1.5 rounded-lg font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{formErrors.station}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {categoryStations.map((st) => {
                  const isSelected = selectedStationId === st.id;
                  const state = getStationAvailabilityState(st, durationMinutes);
                  const isAvailable = state.isAvailable;

                  return (
                    <button
                      type="button"
                      key={st.id}
                      disabled={!isAvailable}
                      onClick={() => {
                        setSelectedStationId(st.id);
                        if (activeCategory === 'POOL_TABLE') {
                          setSelectedGameTitle('');
                        }
                        setFormErrors((prev) => ({ ...prev, station: undefined }));
                      }}
                      className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between gap-3 group ${
                        isSelected
                          ? 'bg-cyan-950/60 border-cyan-400 text-white ring-2 ring-cyan-400/80 shadow-[0_0_16px_rgba(6,182,212,0.35)]'
                          : isAvailable
                          ? 'bg-[#08101a] border-cyan-950/70 text-ds-text hover:border-cyan-400/50 hover:bg-[#0c1827]'
                          : 'bg-rose-950/15 border-rose-500/25 text-ds-text-dim opacity-50 cursor-not-allowed'
                      }`}
                    >
                      {/* Top Row: Icon + Name + Specs + Status Badge */}
                      <div className="flex items-start justify-between gap-2 w-full">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                              isSelected
                                ? 'bg-cyan-500/25 border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                                : 'bg-ds-surface border-ds-border group-hover:border-cyan-500/40'
                            }`}
                          >
                            {getStationIcon(st.stationType)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-heading font-black text-xs text-ds-ice group-hover:text-white truncate">
                              {st.name}
                            </div>
                            <p className="text-[10px] text-ds-text-dim truncate">
                              {st.specs || (st.stationType === 'PS5' ? '4K 120Hz OLED Display' : 'Championship Slate Bed')}
                            </p>
                          </div>
                        </div>

                        {/* Top-right Status / Selected Check */}
                        <div className="flex items-center gap-1 shrink-0">
                          {isSelected ? (
                            <div className="w-5 h-5 rounded-full bg-cyan-400 text-black flex items-center justify-center font-black text-xs shadow-md shadow-cyan-400/50 animate-in zoom-in-75">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          ) : (
                            <Badge
                              variant={isAvailable ? 'success' : 'danger'}
                              size="sm"
                              className="text-[9px] px-1.5 py-0.5"
                            >
                              {state.statusLabel}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Bottom Row: Rate + Selection Hint */}
                      <div className="flex items-center justify-between pt-2 border-t border-ds-border/30 text-xs w-full">
                        <span className="text-cyan-400 font-mono font-bold text-xs">
                          {st.stationType === 'PS5' ? 'From ₹150/hr' : '₹250/hr'}
                        </span>
                        <span
                          className={`text-[10px] font-semibold ${
                            isSelected
                              ? 'text-cyan-300 font-bold'
                              : isAvailable
                              ? 'text-ds-text-dim group-hover:text-white'
                              : 'text-rose-400'
                          }`}
                        >
                          {isSelected ? 'Selected ✓' : isAvailable ? 'Click to Select' : (state.conflictReason || 'Busy')}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Game Selection (Consoles Only — Automatically Hidden for Snooker/Pool) */}
            {isConsoleStation && (
              <div className="space-y-3 p-3.5 rounded-xl bg-ds-surface/50 border border-ds-border">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div>
                    <label className="text-xs font-heading font-black text-ds-ice uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-400 text-cyan-300 text-[11px] flex items-center justify-center font-mono">2</span>
                      <Gamepad2 className="w-4 h-4 text-cyan-400" />
                      <span>Select Game To Play</span>
                      <span className="text-[10px] text-ds-text-dim normal-case font-normal">(optional)</span>
                    </label>
                    <p className="text-[11px] text-ds-text-dim mt-0.5">
                      Choose from our popular games or search for your favorite.
                    </p>
                  </div>

                  {selectedGameTitle && (
                    <button
                      type="button"
                      onClick={() => setSelectedGameTitle('')}
                      className="text-[11px] font-mono text-rose-400 hover:text-rose-300 hover:underline self-start sm:self-auto"
                    >
                      Clear choice
                    </button>
                  )}
                </div>

                {/* 8-Card Popular Game Grid (4 cols on desktop, 2 cols on mobile) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                  {popularGames.map((game) => {
                    const isSelected = selectedGameTitle.trim().toLowerCase() === game.title.trim().toLowerCase();

                    return (
                      <button
                        type="button"
                        key={game.slug || game.title}
                        onClick={() => setSelectedGameTitle(isSelected ? '' : game.title)}
                        className={`relative flex items-center gap-2 p-1.5 sm:p-2 rounded-xl border text-left transition-all group h-[44px] sm:h-[46px] overflow-hidden ${
                          isSelected
                            ? 'bg-cyan-950/40 border-cyan-400 ring-1 ring-cyan-400/80 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                            : 'bg-[#08101a] border-cyan-950/70 hover:border-cyan-500/40 hover:bg-[#0c1827]'
                        }`}
                      >
                        {/* Cover Thumbnail: Compact landscape matching reference */}
                        <div className="w-10 sm:w-12 h-7 sm:h-8 rounded-md overflow-hidden shrink-0 relative bg-black/50 border border-cyan-900/40">
                          <img
                            src={game.coverImage}
                            alt={game.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        </div>

                        {/* Title: Centered, bold, clean without genre clutter */}
                        <div className="flex-1 min-w-0 pr-1">
                          <div className="font-heading font-bold text-[11px] sm:text-xs text-ds-ice group-hover:text-white leading-tight line-clamp-2">
                            {game.title}
                          </div>
                        </div>

                        {/* Selected Checkmark Badge: Inside card on right, matching reference */}
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-cyan-400 text-black flex items-center justify-center shrink-0 ml-auto mr-0.5 shadow-sm shadow-cyan-400/50">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Search / Custom input for other games */}
                <div className="relative">
                  <Search className="w-4 h-4 text-ds-text-dim absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Or type other game title (e.g. Call of Duty, Mortal Kombat)..."
                    value={selectedGameTitle}
                    onChange={(e) => setSelectedGameTitle(e.target.value)}
                    className="w-full bg-ds-dark border border-ds-border rounded-xl pl-9 pr-3 py-2 text-xs text-ds-text placeholder:text-ds-text-dim focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 focus:outline-none transition-all"
                  />
                </div>

                {/* Selected Game Confirmation Pill */}
                {selectedGameTitle && (
                  <div className="flex items-center justify-between gap-2 text-xs text-cyan-300 font-mono bg-cyan-950/40 border border-cyan-500/30 px-3 py-1.5 rounded-lg">
                    <div className="flex items-center gap-1.5 truncate">
                      <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="truncate">
                        Selected: <strong className="text-white font-semibold">{selectedGameTitle}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedGameTitle('')}
                      className="text-[10px] text-rose-400 hover:underline shrink-0"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── RIGHT COLUMN: DURATION, CUSTOMER INFO, PAYMENT (5 COLS) ─── */}
          <div className="lg:col-span-5 space-y-4">
            {/* Session Duration */}
            <div className="space-y-1.5">
              <label className="text-xs font-heading font-black text-ds-ice uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-ds-accent/20 border border-ds-accent text-ds-accent text-[11px] flex items-center justify-center font-mono">
                  {isConsoleStation ? '3' : '2'}
                </span>
                <span>Session Duration</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { min: 30, label: '30 Mins' },
                  { min: 60, label: '1 Hour' },
                  { min: 120, label: '2 Hours' },
                  { min: 180, label: '3 Hours' },
                ].map((d) => (
                  <button
                    type="button"
                    key={d.min}
                    onClick={() => handleDurationChange(d.min)}
                    className={`py-2.5 rounded-xl text-xs font-heading font-bold uppercase transition-all border ${
                      durationMinutes === d.min
                        ? 'bg-ds-accent text-white border-ds-accent shadow-md shadow-ds-accent/20 ring-1 ring-ds-accent'
                        : 'bg-ds-surface/60 border-ds-border text-ds-text-muted hover:text-white'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Number of Players */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-heading font-black text-ds-ice uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-400 text-cyan-300 text-[11px] flex items-center justify-center font-mono">
                    {isConsoleStation ? '4' : '3'}
                  </span>
                  <span>Number of Players</span>
                </label>
                <div className="flex items-center gap-2">
                  {isPool && playerCount > 4 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                      +{playerCount - 4} Extra ({playerCount - 4} × ₹50/hr = +₹{(playerCount - 4) * 50}/hr)
                    </span>
                  )}
                  <span className="text-[11px] font-mono text-cyan-400 font-bold">
                    {isPs5
                      ? playerCount === 1
                        ? '₹150/hr'
                        : playerCount === 2
                        ? '₹200/hr'
                        : '₹250/hr'
                      : `₹${(dynamicHourlyRate / 100).toFixed(0)}/hr`}
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

              {/* Extra Players: ONLY for Snookers / Pool Table AND ONLY when 4 or more players are selected */}
              {isPool && playerCount >= 4 && (
                <div className="p-2.5 rounded-xl bg-ds-dark/60 border border-amber-500/30 space-y-1.5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-heading font-bold text-amber-400 uppercase tracking-wide flex items-center gap-1">
                      <span>Add Extra Players (&gt; 4 Players)</span>
                    </span>
                    <span className="font-mono text-[10px] text-amber-300/90 font-semibold">
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

            {/* Gamer Information (Name, Phone, optional Email) */}
            <div className="space-y-1.5 relative">
              <div className="flex items-center justify-between">
                <label className="text-xs font-heading font-black text-ds-ice uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-ds-accent/20 border border-ds-accent text-ds-accent text-[11px] flex items-center justify-center font-mono">
                    {isConsoleStation ? '5' : '4'}
                  </span>
                  <span>Gamer Information</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerName('Walk-in Guest');
                      setCustomerPhone('');
                      setCustomerEmail('');
                      setActiveMembership(null);
                      setShowSearchDropdown(false);
                      setFormErrors((prev) => ({ ...prev, customerName: undefined, customerPhone: undefined, customerEmail: undefined }));
                      setTouched((prev) => ({ ...prev, customerName: true, customerPhone: false }));
                      toast.info('Quick Walk-in Guest details filled');
                    }}
                    className="text-[10px] font-mono font-bold text-ds-cyan hover:underline hover:text-white px-2 py-0.5 rounded bg-ds-cyan/10 border border-ds-cyan/30 flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <span>⚡ Quick Walk-in Guest</span>
                  </button>
                </div>
              </div>

              {/* Active Membership Banner if matched */}
              {activeMembership && (
                <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-transparent border border-amber-500/40 flex items-center justify-between gap-2 animate-in fade-in zoom-in-95">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
                      <Crown className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-heading font-black text-amber-300 uppercase tracking-wide truncate">
                          {activeMembership.planName}
                        </span>
                        <Badge variant="warning" size="sm" className="text-[10px] py-0 px-1.5 font-bold font-mono">
                          {activeMembership.discountPercent}% OFF
                        </Badge>
                      </div>
                      <span className="text-[10px] text-ds-text-dim block">
                        Member discount applied automatically to total bill
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMembership(null);
                      toast.info('Membership discount removed');
                    }}
                    className="text-[10px] text-zinc-400 hover:text-rose-400 underline font-mono shrink-0 ml-1"
                  >
                    Remove
                  </button>
                </div>
              )}

              <div className="space-y-2.5 relative">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1 relative">
                    <span className="text-[10px] uppercase font-mono text-ds-text-muted block">
                      Gamer Name <span className="text-rose-400">*</span>
                    </span>
                    <Input
                      placeholder="e.g. Rahul Verma"
                      value={customerName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomerName(val);
                        searchCustomers(val);
                        if (touched.customerName) {
                          setFormErrors((prev) => ({ ...prev, customerName: validateName(val) }));
                        }
                      }}
                      onFocus={() => {
                        if (searchResults.length > 0) setShowSearchDropdown(true);
                      }}
                      onBlur={() => {
                        setTouched((prev) => ({ ...prev, customerName: true }));
                        setFormErrors((prev) => ({ ...prev, customerName: validateName(customerName) }));
                        setTimeout(() => setShowSearchDropdown(false), 250);
                      }}
                      error={touched.customerName ? formErrors.customerName : undefined}
                      required
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-mono text-ds-text-muted block">
                      WhatsApp Phone <span className="text-ds-text-dim lowercase">(optional)</span>
                    </span>
                    <Input
                      placeholder="10-digit mobile number"
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomerPhone(val);
                        searchCustomers(val);
                        const digits = val.replace(/\D/g, '');
                        if (digits.length === 10) {
                          checkPhoneMembership(digits);
                        }
                        if (touched.customerPhone) {
                          setFormErrors((prev) => ({ ...prev, customerPhone: validatePhone(val) }));
                        }
                      }}
                      onFocus={() => {
                        if (searchResults.length > 0) setShowSearchDropdown(true);
                      }}
                      onBlur={() => {
                        setTouched((prev) => ({ ...prev, customerPhone: true }));
                        setFormErrors((prev) => ({ ...prev, customerPhone: validatePhone(customerPhone) }));
                        checkPhoneMembership(customerPhone);
                        setTimeout(() => setShowSearchDropdown(false), 250);
                      }}
                      error={touched.customerPhone ? formErrors.customerPhone : undefined}
                      className="text-xs"
                    />
                  </div>
                </div>

                {/* Autocomplete Search Dropdown */}
                {showSearchDropdown && searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-14 z-50 bg-[#08121e] border border-cyan-500/40 rounded-xl shadow-[0_12px_28px_rgba(0,0,0,0.85)] p-1.5 space-y-1 backdrop-blur-md max-h-48 overflow-y-auto">
                    <div className="text-[10px] font-mono text-cyan-400 font-bold px-2 py-1 uppercase tracking-wider flex items-center justify-between border-b border-cyan-900/40">
                      <span>Existing Customer Directory</span>
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
                        className="w-full text-left p-2 rounded-lg hover:bg-cyan-950/60 transition-all flex items-center justify-between gap-2 group border border-transparent hover:border-cyan-500/30 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-heading font-bold text-xs text-ds-ice group-hover:text-white truncate">
                              {cust.name}
                            </span>
                            {cust.membership && (
                              <Badge variant="warning" size="sm" className="text-[9px] py-0 px-1 font-mono font-bold">
                                👑 {cust.membership.tier} ({cust.membership.discountPercent}%)
                              </Badge>
                            )}
                          </div>
                          <div className="text-[10px] text-ds-text-dim font-mono truncate">
                            {cust.phone ? `📱 ${cust.phone}` : ''} {cust.email && !cust.email.includes('@darksyndicate.in') ? `• ${cust.email}` : ''}
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-cyan-400 group-hover:underline shrink-0">
                          Select ↵
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-mono text-ds-text-muted block">
                    Email ID <span className="text-ds-text-dim lowercase">(optional)</span>
                  </span>
                  <Input
                    type="email"
                    placeholder="gamer@gmail.com"
                    value={customerEmail}
                    onChange={(e) => {
                      setCustomerEmail(e.target.value);
                      if (touched.customerEmail) {
                        setFormErrors((prev) => ({ ...prev, customerEmail: validateEmail(e.target.value) }));
                      }
                    }}
                    onBlur={() => {
                      setTouched((prev) => ({ ...prev, customerEmail: true }));
                      setFormErrors((prev) => ({ ...prev, customerEmail: validateEmail(customerEmail) }));
                    }}
                    error={touched.customerEmail ? formErrors.customerEmail : undefined}
                    className="text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Desk Payment Policy (Pay After / Post-Paid Tab Only) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-heading font-black text-ds-ice uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-400 text-cyan-300 text-[11px] flex items-center justify-center font-mono font-bold">
                    {isConsoleStation ? '6' : '5'}
                  </span>
                  <span>Payment Policy</span>
                </label>
                <span className="text-[10px] font-mono font-bold uppercase text-cyan-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Settle on Exit
                </span>
              </div>

              {/* Post-Paid Open Tab Confirmation Card */}
              <div className="p-3.5 rounded-2xl bg-[#08101a] border border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)] ring-1 ring-cyan-400/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400 shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-black text-sm text-white">Pay After</span>
                        <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
                          Post-Paid Tab
                        </span>
                      </div>
                      <p className="text-[11px] text-ds-text-dim">Open tab. Gamer settles ₹{(totalFeePaise / 100).toFixed(0)} upon exit.</p>
                    </div>
                  </div>
                  <Badge variant="info" size="sm" className="font-mono text-[10px]">
                    Zero Upfront
                  </Badge>
                </div>

                <div className="p-2.5 rounded-xl bg-black/50 border border-cyan-900/40 flex items-center justify-between font-mono text-xs">
                  <span className="text-ds-text-dim">Pending Bill on Checkout:</span>
                  <span className="text-cyan-300 font-bold font-heading text-sm">
                    ₹{(totalFeePaise / 100).toFixed(0)}
                    <span className="text-ds-text-dim font-normal text-[10px] ml-1">(+ overtime if any)</span>
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-cyan-950/30 border border-cyan-500/20 text-[11px] text-cyan-200/90 flex items-center gap-1.5">
                  <span className="shrink-0">ℹ️</span>
                  <span>Session starts immediately. No upfront collection at desk. Cashier settles payment at checkout.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
