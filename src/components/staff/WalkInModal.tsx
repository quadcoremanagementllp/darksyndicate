'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Gamepad2, Banknote, CreditCard, Sparkles, QrCode, Copy, Check, Search, Monitor, AlertCircle } from 'lucide-react';
import QRCode from 'qrcode';
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
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD'>('CASH');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const toast = useToast();

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

  // Admin QR & UPI Details
  const [adminQrUrl, setAdminQrUrl] = useState<string>('');
  const [upiId, setUpiId] = useState<string>('darksyndicate@icici');
  const [upiPayeeName, setUpiPayeeName] = useState<string>('Dark Syndicate Gaming World');
  const [dynamicQrUrl, setDynamicQrUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // Ref to track modal transition so 10-second polling does not wipe what staff is typing
  const prevIsOpenRef = React.useRef(false);

  // Synchronize preselected station and category ONLY when modal transitions from closed to open
  useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (isOpen && !wasOpen) {
      const target =
        stations.find((s) => s.id === preselectedStationId && getStationAvailabilityState(s, durationMinutes).isAvailable) ||
        stations.find((s) => getStationAvailabilityState(s, durationMinutes).isAvailable) ||
        stations[0];
      if (target) {
        setSelectedStationId(target.id);
        setActiveCategory(target.stationType);
      }
      setSelectedGameTitle('');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setPlayerCount(1);
      setFormErrors({});
      setTouched({});
    }
  }, [isOpen, preselectedStationId, stations, durationMinutes]);

  // Fetch Admin uploaded QR Code and UPI configuration
  useEffect(() => {
    let isMounted = true;
    fetch('/api/cms/public')
      .then((res) => res.json())
      .then((json) => {
        if (isMounted && json.success && json.data?.settings) {
          const s = json.data.settings;
          if (s.counter_upi_qr_url) setAdminQrUrl(s.counter_upi_qr_url);
          if (s.counter_upi_id) setUpiId(s.counter_upi_id);
          if (s.counter_upi_name) setUpiPayeeName(s.counter_upi_name);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const selectedStation = stations.find((s) => s.id === selectedStationId);
  const categoryStations = stations.filter((s) => s.stationType === activeCategory);
  const isConsoleStation =
    selectedStation?.stationType === 'PS5' ||
    selectedStation?.stationType === 'PC' ||
    Boolean(selectedStation?.games && selectedStation.games.length > 0);

  const isPs5 = selectedStation?.stationType === 'PS5';
  const isPool = selectedStation?.stationType === 'POOL_TABLE';
  let dynamicHourlyRate = selectedStation ? selectedStation.pricePerHourPaise : 15000;
  if (isPs5) {
    if (playerCount === 2) dynamicHourlyRate = 20000;
    else if (playerCount >= 3) dynamicHourlyRate = 25000;
    else dynamicHourlyRate = 15000;
  } else if (isPool) {
    dynamicHourlyRate = 25000 + Math.max(0, playerCount - 4) * 5000;
  }
  const totalFeePaise = Math.round(dynamicHourlyRate * (durationMinutes / 60));

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

  // Generate dynamic QR fallback if admin has not uploaded a static QR image
  useEffect(() => {
    if (paymentMethod === 'UPI' && !adminQrUrl) {
      const amount = (totalFeePaise / 100).toFixed(2);
      const stationName = selectedStation?.name || 'Walk-in Gaming';
      const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiPayeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Walk-in ${stationName}`)}`;
      QRCode.toDataURL(upiUrl, {
        width: 220,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      })
        .then((url) => setDynamicQrUrl(url))
        .catch(() => {});
    }
  }, [paymentMethod, adminQrUrl, upiId, upiPayeeName, totalFeePaise, selectedStation?.name]);

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopied(true);
    toast.success('UPI ID copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

    if (nameErr || phoneErr || emailErr) {
      toast.error(nameErr || phoneErr || emailErr || 'Please check the highlighted errors');
      return;
    }

    const rawDigits = customerPhone.replace(/\D/g, '');
    const cleanPhone = rawDigits.length === 12 && rawDigits.startsWith('91') ? rawDigits.slice(2) : rawDigits;

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
          customerPhone: cleanPhone,
          customerEmail: customerEmail.trim() || undefined,
          paymentMethod,
          gameTitle: selectedGameTitle.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`Walk-in session started for ${customerName}!`);
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

  const displayQrCode = adminQrUrl || dynamicQrUrl;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Desk Walk-in Rapid Allocation"
      description="Quickly assign available gaming consoles and snooker tables to walk-in players."
      size="full"
    >
      <form onSubmit={handleSubmit} className="flex flex-col justify-between" noValidate>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ─── LEFT COLUMN: CATEGORY, STATION & GAME (7 COLS) ─── */}
          <div className="lg:col-span-7 space-y-4">
            {/* 1. Category Switcher Tabs */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-heading font-black text-ds-ice uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-ds-accent/20 border border-ds-accent text-ds-accent text-[11px] flex items-center justify-center font-mono">1</span>
                  <span>Select Arena Category</span>
                </label>
                <span className="text-[11px] font-mono text-ds-text-dim">
                  {stations.filter((s) => getStationAvailabilityState(s, durationMinutes).isAvailable).length} Available Units
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {availableCategories.map((catKey) => {
                  const isSelected = activeCategory === catKey;
                  const count = stations.filter(
                    (s) => s.stationType === catKey && getStationAvailabilityState(s, durationMinutes).isAvailable
                  ).length;
                  const totalCount = stations.filter((s) => s.stationType === catKey).length;
                  const meta = CATEGORY_META[catKey] || { label: catKey, icon: '🎯' };

                  return (
                    <button
                      type="button"
                      key={catKey}
                      onClick={() => handleCategoryChange(catKey)}
                      className={`p-3 rounded-xl font-heading font-bold text-xs uppercase tracking-wider transition-all border flex items-center justify-between ${
                        isSelected
                          ? 'bg-ds-accent text-white border-ds-accent shadow-lg shadow-ds-accent/25 ring-1 ring-ds-accent'
                          : 'bg-ds-dark/80 border-ds-border text-ds-text-muted hover:text-white hover:border-ds-accent/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-lg">{meta.icon}</span>
                        <span className="truncate">{meta.label}</span>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0 ml-1.5 ${
                          isSelected ? 'bg-black/35 text-white font-bold' : 'bg-ds-surface text-ds-text-dim'
                        }`}
                      >
                        {count}/{totalCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Choose Station (1-click Cards with Console Logo) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-heading font-black text-ds-ice uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-400 text-cyan-300 text-[11px] flex items-center justify-center font-mono">2</span>
                  <span>Choose {CATEGORY_META[activeCategory]?.label || 'Station'}</span>
                </label>
                <span className="text-[11px] font-mono text-ds-text-dim">
                  {categoryStations.filter((s) => getStationAvailabilityState(s, durationMinutes).isAvailable).length} Available
                </span>
              </div>

              {formErrors.station && (
                <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 px-3 py-1.5 rounded-lg font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{formErrors.station}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
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
                        setSelectedGameTitle('');
                        setFormErrors((prev) => ({ ...prev, station: undefined }));
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all relative flex items-center gap-2.5 group h-[52px] sm:h-[54px] ${
                        isSelected
                          ? 'bg-cyan-950/40 border-cyan-400 text-white ring-1 ring-cyan-400/80 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                          : isAvailable
                          ? 'bg-[#08101a] border-cyan-950/70 text-ds-text hover:border-cyan-400/50 hover:bg-[#0c1827]'
                          : 'bg-ds-surface/20 border-ds-border/40 text-ds-text-dim opacity-50 cursor-not-allowed'
                      }`}
                    >
                      {/* Console / Station Icon */}
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                          isSelected
                            ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                            : 'bg-ds-surface border-ds-border group-hover:border-cyan-500/40'
                        }`}
                      >
                        {getStationIcon(st.stationType)}
                      </div>

                      {/* Station Details */}
                      <div className="flex-1 min-w-0 pr-14">
                        <div className="font-heading font-bold text-xs text-ds-ice group-hover:text-white truncate">
                          {st.name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-cyan-400 font-mono font-bold text-[11px]">
                            ₹{(st.pricePerHourPaise / 100).toFixed(0)}/hr
                          </span>
                          {state.conflictReason && (
                            <span className="text-[10px] font-mono text-amber-400 truncate">
                              • {state.conflictReason}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status indicator on right */}
                      <div className="absolute top-2.5 right-2.5 flex items-center">
                        {isSelected ? (
                          <div className="w-4 h-4 rounded-full bg-cyan-400 text-black flex items-center justify-center font-black text-xs shadow-sm shadow-cyan-400/50">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                isAvailable
                                  ? 'bg-emerald-400 animate-pulse'
                                  : state.statusLabel === 'RESERVED'
                                  ? 'bg-amber-400'
                                  : 'bg-rose-400'
                              }`}
                            />
                            <span
                              className={`text-[9px] font-mono font-bold uppercase tracking-wider ${
                                isAvailable
                                  ? 'text-emerald-400'
                                  : state.statusLabel === 'RESERVED'
                                  ? 'text-amber-400'
                                  : 'text-rose-400'
                              }`}
                              title={state.conflictReason}
                            >
                              {state.statusLabel}
                            </span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Game Selection (Consoles Only — Automatically Hidden for Snooker/Pool) */}
            {isConsoleStation && (
              <div className="space-y-3 p-3.5 rounded-xl bg-ds-surface/50 border border-ds-border">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div>
                    <label className="text-xs font-heading font-black text-ds-ice uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-400 text-cyan-300 text-[11px] flex items-center justify-center font-mono">3</span>
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
            {/* 4. Session Duration */}
            <div className="space-y-1.5">
              <label className="text-xs font-heading font-black text-ds-ice uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-ds-accent/20 border border-ds-accent text-ds-accent text-[11px] flex items-center justify-center font-mono">
                  {isConsoleStation ? '4' : '3'}
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

            {/* Players Selection */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-heading font-black text-ds-ice uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-400 text-cyan-300 text-[11px] flex items-center justify-center font-mono">
                    {isConsoleStation ? '5' : '4'}
                  </span>
                  <span>Number of Players</span>
                </label>
                <span className="text-[11px] font-mono text-cyan-400 font-bold">
                  {isPs5
                    ? playerCount === 1 ? '₹150/hr' : playerCount === 2 ? '₹200/hr' : '₹250/hr'
                    : isPool
                    ? playerCount <= 4 ? '₹250/hr' : `₹${250 + (playerCount - 4) * 50}/hr`
                    : `₹${(dynamicHourlyRate / 100).toFixed(0)}/hr`
                  }
                </span>
              </div>
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
            </div>

            {/* Customer Details (Name, Phone, optional Email) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-heading font-black text-ds-ice uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-ds-accent/20 border border-ds-accent text-ds-accent text-[11px] flex items-center justify-center font-mono">
                    {isConsoleStation ? '6' : '5'}
                  </span>
                  <span>Gamer Information</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerName('Walk-in Guest');
                    setCustomerPhone('');
                    setFormErrors((prev) => ({ ...prev, customerName: undefined, customerPhone: undefined }));
                    setTouched((prev) => ({ ...prev, customerName: true, customerPhone: false }));
                    toast.info('Quick Walk-in Guest details filled');
                  }}
                  className="text-[10px] font-mono font-bold text-ds-cyan hover:underline hover:text-white px-2 py-0.5 rounded bg-ds-cyan/10 border border-ds-cyan/30 flex items-center gap-1 transition-all cursor-pointer"
                >
                  <span>⚡ Quick Walk-in Guest</span>
                </button>
              </div>
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-mono text-ds-text-muted block">
                      Gamer Name <span className="text-rose-400">*</span>
                    </span>
                    <Input
                      placeholder="e.g. Rahul Verma"
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        if (touched.customerName) {
                          setFormErrors((prev) => ({ ...prev, customerName: validateName(e.target.value) }));
                        }
                      }}
                      onBlur={() => {
                        setTouched((prev) => ({ ...prev, customerName: true }));
                        setFormErrors((prev) => ({ ...prev, customerName: validateName(customerName) }));
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
                      placeholder="10-digit mobile number (optional)"
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => {
                        setCustomerPhone(e.target.value);
                        if (touched.customerPhone) {
                          setFormErrors((prev) => ({ ...prev, customerPhone: validatePhone(e.target.value) }));
                        }
                      }}
                      onBlur={() => {
                        setTouched((prev) => ({ ...prev, customerPhone: true }));
                        setFormErrors((prev) => ({ ...prev, customerPhone: validatePhone(customerPhone) }));
                      }}
                      error={touched.customerPhone ? formErrors.customerPhone : undefined}
                      className="text-xs"
                    />
                  </div>
                </div>

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

            {/* Desk Payment Method */}
            <div className="space-y-1.5">
              <label className="text-xs font-heading font-black text-ds-ice uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-ds-accent/20 border border-ds-accent text-ds-accent text-[11px] flex items-center justify-center font-mono">
                  {isConsoleStation ? '7' : '6'}
                </span>
                <span>Desk Payment Received</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'CASH', label: 'Cash Desk', icon: Banknote },
                  { id: 'UPI', label: 'UPI / QR', icon: Sparkles },
                  { id: 'CARD', label: 'POS Card', icon: CreditCard },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    type="button"
                    key={id}
                    onClick={() => setPaymentMethod(id as any)}
                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                      paymentMethod === id
                        ? 'bg-ds-surface border-emerald-500 text-emerald-400 ring-1 ring-emerald-500'
                        : 'bg-ds-surface/40 border-ds-border text-ds-text-muted hover:border-ds-border'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-heading font-bold">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* UPI QR Display if selected */}
            {paymentMethod === 'UPI' && (
              <div className="p-3.5 rounded-xl bg-ds-surface/80 border border-emerald-500/40 space-y-2.5 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-heading font-bold text-xs">
                    <QrCode className="w-4 h-4" />
                    <span>Scan & Pay via UPI</span>
                  </div>
                  <Badge variant="success" size="sm" className="font-mono text-[10px]">
                    Collect ₹{(totalFeePaise / 100).toFixed(0)}
                  </Badge>
                </div>

                <div className="flex items-center gap-3.5 bg-ds-dark/90 p-2.5 rounded-xl border border-ds-border">
                  <div className="w-24 h-24 bg-white p-1.5 rounded-lg shadow-md shrink-0 flex items-center justify-center">
                    {displayQrCode ? (
                      <img
                        src={displayQrCode}
                        alt="Counter UPI QR"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                  <div className="space-y-1 text-xs min-w-0 flex-1">
                    <span className="text-[10px] uppercase font-mono text-ds-text-dim block">Official Payee</span>
                    <span className="font-heading font-bold text-ds-text block truncate text-xs">
                      {upiPayeeName}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <code className="bg-ds-surface px-1.5 py-0.5 rounded text-ds-ice font-mono font-bold text-[10px] border border-ds-border truncate">
                        {upiId}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopyUpi}
                        className="text-[10px] font-mono text-ds-accent hover:underline flex items-center gap-0.5 shrink-0"
                      >
                        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── BOTTOM ACTION STRIP (STICKY AT BOTTOM) ─── */}
        <div className="sticky bottom-0 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 px-4 sm:px-6 py-3.5 bg-ds-surface/95 backdrop-blur-md border-t border-ds-border/80 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 shadow-2xl z-20 mt-6">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2">
              <Badge variant="accent" size="md" className="font-heading font-bold text-xs uppercase">
                {selectedStation?.name || 'No Station'}
              </Badge>
              {selectedGameTitle && (
                <Badge variant="default" size="md" className="font-mono text-xs text-ds-ice">
                  🎮 {selectedGameTitle}
                </Badge>
              )}
            </div>

            <div className="pl-3 border-l border-ds-border">
              <span className="text-[10px] uppercase font-mono text-ds-text-dim block">Total Collection</span>
              <span className="text-xl font-heading font-black text-ds-ice">
                ₹{(totalFeePaise / 100).toFixed(0)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <Button variant="outline" type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="accent"
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 shadow-lg shadow-ds-accent/20"
            >
              {submitting ? 'Allocating Console...' : 'Confirm & Start Session'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
