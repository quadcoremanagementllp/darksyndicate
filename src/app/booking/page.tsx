'use client';

import React, { useState, useEffect, useTransition, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast';
import {
  Gamepad2,
  Calendar as CalendarIcon,
  Clock,
  User as UserIcon,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Tag,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Zap,
  Info,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Banknote,
  QrCode,
  Crown,
  X,
  Search,
} from 'lucide-react';
import { ARENA_GAMES, lookupGame, GameCatalogItem } from '@/lib/gameCatalog';

interface Station {
  id: string;
  name: string;
  stationType: string;
  facilityName: string;
  pricePerHourPaise: number;
  specs: string;
  capacity: number;
  status: string;
  games?: string[];
  gameDetails?: GameCatalogItem[];
}

type CheckoutResult = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type CheckoutWindow = Window & { Razorpay?: new (options: Record<string, unknown>) => {
  open(): void;
  on(event: string, handler: () => void): void;
} };

function loadRazorpayCheckout(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as CheckoutWindow).Razorpay) return resolve();
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Payment checkout could not load'));
    document.body.appendChild(script);
  });
}

interface TimeSlot {
  time: string;
  endTime: string;
  label: string;
  period: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';
  available: boolean;
  reason?: string;
  availableStationIds?: string[];
}

const DURATION_OPTIONS = [
  { minutes: 60, label: '1 Hour', tag: 'Standard' },
  { minutes: 120, label: '2 Hours', tag: 'Popular' },
  { minutes: 180, label: '3 Hours', tag: '10% OFF' },
  { minutes: 240, label: '4 Hours', tag: 'Pro Grind' },
  { minutes: 360, label: '6 Hours', tag: 'LAN Pass' },
];

function BookingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const toast = useToast();

  const preselectedStationId = searchParams.get('stationId') || '';

  // Wizard Step (1: Date & Slot, 2: Arena & Station, 3: Gamer Info, 4: Payment)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSummaryOpen, setIsSummaryOpen] = useState<boolean>(false);

  const goToStep = (step: number) => {
    setIsSummaryOpen(false);
    setCurrentStep(step);
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        const el = document.getElementById('booking-stepper-header') || document.getElementById('booking-step-container');
        if (el) {
          const navOffset = 90;
          const y = el.getBoundingClientRect().top + window.pageYOffset - navOffset;
          window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 50);
    }
  };

  // Ensure scroll is restored to top on step transitions
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const el = document.getElementById('booking-stepper-header') || document.getElementById('booking-step-container');
      if (el) {
        const navOffset = 90;
        const y = el.getBoundingClientRect().top + window.pageYOffset - navOffset;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }
    }
  }, [currentStep]);


  // Stations State
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  // Date & Duration State (IST-aware to prevent midnight date rollover)
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const todayStr = new Date(Date.now() + istOffsetMs).toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [durationMinutes, setDurationMinutes] = useState<number>(120);
  const [playerCount, setPlayerCount] = useState<number>(1);
  const dateScrollRef = useRef<HTMLDivElement>(null);

  const scrollDates = (direction: 'left' | 'right') => {
    if (dateScrollRef.current) {
      const scrollAmount = direction === 'left' ? -260 : 260;
      dateScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Slots State
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [slotPeriod, setSlotPeriod] = useState<string>('ALL');

  // Gamer Info State
  const [customerName, setCustomerName] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Gamer Info Validation State & Helpers
  const [formErrors, setFormErrors] = useState<{
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
  }>({});
  const [formTouched, setFormTouched] = useState<{
    customerName?: boolean;
    customerPhone?: boolean;
    customerEmail?: boolean;
  }>({});

  const validateCustomerName = (val: string): string | undefined => {
    const trimmed = val.trim();
    if (!trimmed) return 'Full name is required';
    if (trimmed.length < 2) return 'Name must be at least 2 characters';
    if (!/^[a-zA-Z\s.'-]+$/.test(trimmed)) return 'Name contains invalid characters';
    return undefined;
  };

  const validateCustomerPhone = (val: string): string | undefined => {
    const rawDigits = val.replace(/\D/g, '');
    if (!rawDigits) return 'WhatsApp phone number is required';
    const digits = rawDigits.length === 12 && rawDigits.startsWith('91') ? rawDigits.slice(2) : rawDigits;
    if (digits.length !== 10) return 'Must be a 10-digit mobile number';
    if (!/^[6-9]/.test(digits)) return 'Indian mobile numbers start with 6, 7, 8, or 9';
    return undefined;
  };

  const validateCustomerEmail = (val: string): string | undefined => {
    const trimmed = val.trim();
    if (!trimmed) return undefined; // Optional field
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return 'Please enter a valid email address';
    }
    return undefined;
  };

  // Game Selection State (Optional)
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [showGameModal, setShowGameModal] = useState<boolean>(false);
  const [gameSearchQuery, setGameSearchQuery] = useState<string>('');
  const gameCarouselRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false);
  const [canScrollRight, setCanScrollRight] = useState<boolean>(true);

  const checkCarouselScroll = () => {
    if (gameCarouselRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = gameCarouselRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scrollGameCarousel = (direction: 'left' | 'right') => {
    if (gameCarouselRef.current) {
      const scrollAmount = direction === 'left' ? -280 : 280;
      gameCarouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Resolved list of available games for the current station with rich metadata
  const stationAvailableGames: GameCatalogItem[] = React.useMemo(() => {
    if (!selectedStation) return [];

    if (selectedStation.gameDetails && selectedStation.gameDetails.length > 0) {
      return selectedStation.gameDetails.map((g: any) => {
        const meta = lookupGame(g.title);
        return {
          slug: g.slug || meta?.slug || g.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          title: g.title,
          platform: (g.platform || meta?.platform || selectedStation.stationType) as any,
          genre: g.genre || meta?.genre || 'Esports',
          description: g.description || meta?.description || 'Installed and ready to launch on this station.',
          coverImage: g.coverImage || meta?.coverImage || (selectedStation.stationType === 'PS5' ? '/ps5-station.jpg' : '/snooker-table.jpg'),
          maxPlayers: g.maxPlayers || meta?.maxPlayers || (selectedStation.stationType === 'PS5' ? 2 : 4),
        };
      });
    }

    if (selectedStation.games && selectedStation.games.length > 0) {
      return selectedStation.games.map((title) => {
        const meta = lookupGame(title);
        if (meta) return meta;
        return {
          slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          title,
          platform: selectedStation.stationType as any,
          genre: selectedStation.stationType === 'PS5' ? 'Console Game' : 'Billiards',
          description: 'Installed and fully optimized for low-latency tournament gameplay.',
          coverImage: selectedStation.stationType === 'PS5'
            ? '/ps5-station.jpg'
            : '/snooker-table.jpg',
          maxPlayers: selectedStation.stationType === 'PS5' ? 2 : 4,
        };
      });
    }

    return ARENA_GAMES.filter(
      (g) => g.platform === (selectedStation.stationType === 'PS5' ? 'PS5' : 'POOL_TABLE')
    );
  }, [selectedStation]);

  const displayedGames = React.useMemo(() => {
    if (!gameSearchQuery.trim()) return stationAvailableGames;
    const q = gameSearchQuery.toLowerCase();
    return stationAvailableGames.filter(
      (g) => g.title.toLowerCase().includes(q) || g.genre.toLowerCase().includes(q)
    );
  }, [stationAvailableGames, gameSearchQuery]);

  // Payment & Coupon State
  const [couponCode, setCouponCode] = useState<string>('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountPaise: number;
    description: string;
  } | null>(null);
  const [couponLoading, setCouponLoading] = useState<boolean>(false);
  const [paymentOption, setPaymentOption] = useState<'ONLINE' | 'COUNTER'>('COUNTER');
  const [onlineEnabled, setOnlineEnabled] = useState(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/payments/config').then((res) => res.json()).then((data) => setOnlineEnabled(Boolean(data.onlineEnabled))).catch(() => {});
  }, []);

  // Auto-fill user information if logged in
  useEffect(() => {
    if (user) {
      if (!customerName) setCustomerName(`${user.firstName} ${user.lastName}`.trim());
      if (!customerEmail) setCustomerEmail(user.email);
      if (!customerPhone && user.phone) setCustomerPhone(user.phone);
    }
  }, [user]);

  // Fetch active user membership (if logged in)
  const [activeMembership, setActiveMembership] = useState<{
    planNameSnapshot: string;
    tierSnapshot: string;
    discountPercent: number;
  } | null>(null);

  useEffect(() => {
    if (!user) {
      setActiveMembership(null);
      return;
    }
    async function loadUserMembership() {
      try {
        const res = await fetch('/api/customer/membership');
        const json = await res.json();
        if (json.success && json.data?.activeMembership) {
          setActiveMembership(json.data.activeMembership);
        }
      } catch (err) {
        console.error('Failed to load user membership:', err);
      }
    }
    loadUserMembership();
  }, [user]);

  // Fetch stations on mount
  useEffect(() => {
    async function loadStations() {
      try {
        const res = await fetch('/api/facilities');
        const json = await res.json();
        const data = json.data || [];

        const allStations: Station[] = [];
        data.forEach((fac: any) => {
          (fac.stations || []).forEach((st: any) => {
            allStations.push({
              id: st.id,
              name: st.name,
              stationType: st.stationType,
              facilityName: fac.name,
              pricePerHourPaise: st.pricePerHourPaise,
              specs: st.specs || 'High-performance battle station',
              capacity: st.capacity || (st.stationType === 'PS5' ? 2 : 4),
              status: st.status,
              games: st.games || [],
              gameDetails: st.gameDetails || [],
            });
          });
        });

        setStations(allStations);

        if (preselectedStationId) {
          const matched = allStations.find((s) => s.id === preselectedStationId);
          if (matched) {
            setSelectedStation(matched);
            setSelectedZone(matched.stationType);
          }
        }
      } catch (err) {
        console.error('Failed to load stations:', err);
      }
    }
    loadStations();
  }, [preselectedStationId]);

  // Fetch slots whenever zone, date, or duration changes (checks all stations in zone)
  useEffect(() => {
    async function fetchSlots() {
      setLoadingSlots(true);
      try {
        const zoneParam = selectedZone ? `&zone=${selectedZone}` : '';
        const res = await fetch(
          `/api/bookings/availability?date=${selectedDate}&duration=${durationMinutes}${zoneParam}`
        );
        const json = await res.json();
        if (json.success && json.data) {
          setSlots(json.data.slots || []);
          // Clear selected slot if it is no longer available in new response
          if (selectedSlot) {
            const stillValid = (json.data.slots || []).find(
              (s: TimeSlot) => s.time === selectedSlot.time && s.available
            );
            if (!stillValid) setSelectedSlot(null);
          }
        }
      } catch (err) {
        console.error('Failed to load slots:', err);
      } finally {
        setLoadingSlots(false);
      }
    }

    fetchSlots();
  }, [selectedZone, selectedDate, durationMinutes]);

  // Slot-synchronized station pre-selection: ensure selectedStation is free for selectedSlot
  useEffect(() => {
    if (selectedSlot && selectedZone && stations.length > 0) {
      const zoneStations = stations.filter(
        (st) => st.stationType === selectedZone && st.status !== 'MAINTENANCE' && st.status !== 'DEACTIVATED'
      );
      const availableStations = zoneStations.filter((st) =>
        selectedSlot.availableStationIds?.includes(st.id)
      );
      if (availableStations.length > 0) {
        if (!selectedStation || !availableStations.some((st) => st.id === selectedStation.id)) {
          setSelectedStation(availableStations[0]);
        }
      }
    }
  }, [selectedSlot, selectedZone, stations, selectedStation]);

  // Calculate dynamic hourly rate based on zone, station and player count
  const getHourlyRatePaise = () => {
    const isSnooker =
      selectedZone === 'POOL_TABLE' ||
      selectedStation?.stationType === 'POOL_TABLE' ||
      selectedStation?.name.toUpperCase().includes('SNOOKER') ||
      selectedStation?.name.toUpperCase().includes('POOL');

    if (isSnooker) {
      // Snooker: Flat ₹250/hr per table/frame (max 4 players)
      if (playerCount <= 4) return 25000;
      return 25000 + (playerCount - 4) * 5000;
    }

    // PlayStation 5 (exact match to illuminated rate board):
    if (playerCount === 1) return 15000; // Single Player: ₹150/hr
    if (playerCount === 2) return 20000; // Two Player: ₹200/hr
    return 25000; // Multi Player (3 & 4 Players): ₹250/hr
  };

  const hourlyRatePaise = getHourlyRatePaise();
  const hours = durationMinutes / 60;
  const subtotalPaise = Math.round(hourlyRatePaise * hours);

  // Multi-hour discount: 3+ hours gives 10%
  const multiHourDiscountPaise = durationMinutes >= 180 ? Math.round(subtotalPaise * 0.1) : 0;

  // Happy Hour discount: 10 AM to 3 PM gives 15% off if not already multi-hour discounted
  const slotStartHour = selectedSlot ? parseInt(selectedSlot.time.split(':')[0], 10) : -1;
  const isHappyHour = slotStartHour >= 10 && slotStartHour < 15 && durationMinutes < 180;
  const happyHourDiscountPaise = isHappyHour ? Math.round(subtotalPaise * 0.15) : 0;

  // Coupon discount
  const couponDiscountPaise = appliedCoupon ? appliedCoupon.discountPaise : 0;

  // Active Syndicate Member discount
  const membershipDiscountPercent = activeMembership?.discountPercent || 0;
  const membershipDiscountPaise =
    membershipDiscountPercent > 0
      ? Math.round((subtotalPaise * membershipDiscountPercent) / 100)
      : 0;

  const totalDiscountPaise =
    multiHourDiscountPaise + happyHourDiscountPaise + couponDiscountPaise + membershipDiscountPaise;
  const finalPricePaise = Math.max(0, subtotalPaise - totalDiscountPaise);

  // Handle Coupon Apply
  const handleApplyCoupon = async (codeToApply?: string) => {
    const code = (codeToApply || couponCode).trim().toUpperCase();
    if (!code) {
      toast.error('Please enter a coupon code');
      return;
    }

    setCouponLoading(true);
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          subtotalPaise,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setAppliedCoupon({
          code: json.data.code,
          discountPaise: json.data.discountPaise,
          description: json.data.description || `${json.data.code} Applied`,
        });
        setCouponCode(json.data.code);
        toast.success(`Coupon ${json.data.code} applied! Saved ₹${(json.data.discountPaise / 100).toFixed(0)}`);
      } else {
        toast.error(json.error?.message || 'Invalid or expired coupon code');
      }
    } catch {
      toast.error('Failed to validate coupon code');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    toast.info('Coupon removed');
  };

  // Generate date list for the next 14 days (IST time zone aware)
  const dateList = Array.from({ length: 14 }).map((_, idx) => {
    const dIst = new Date(Date.now() + istOffsetMs + idx * 24 * 60 * 60 * 1000);
    const dateStr = dIst.toISOString().split('T')[0];
    const dayName =
      idx === 0
        ? 'Today'
        : idx === 1
        ? 'Tmrw'
        : dIst.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    const dayNum = dIst.getUTCDate();
    const month = dIst.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    return { dateStr, dayName, dayNum, month };
  });

  // Filtered slots by period (passed time slots are never shown)
  const filteredSlots = slots.filter((slot) => {
    if (slot.reason === 'Time slot has passed') return false;
    if (slotPeriod === 'ALL') return true;
    return slot.period === slotPeriod;
  });

  // Handle Booking Submission
  const handleConfirmBooking = async () => {
    if (!selectedZone) {
      toast.error('Please select a gaming zone');
      goToStep(1);
      return;
    }

    if (!selectedSlot) {
      toast.error('Please pick an available time slot');
      goToStep(2);
      return;
    }

    if (!selectedStation) {
      toast.error('Please select a gaming station');
      goToStep(3);
      return;
    }

    const nameErr = validateCustomerName(customerName);
    const phoneErr = validateCustomerPhone(customerPhone);
    const emailErr = validateCustomerEmail(customerEmail);

    if (nameErr || phoneErr || emailErr) {
      setFormTouched({ customerName: true, customerPhone: true, customerEmail: true });
      setFormErrors({
        customerName: nameErr,
        customerPhone: phoneErr,
        customerEmail: emailErr,
      });
      toast.error(nameErr || phoneErr || emailErr || 'Please check your player details');
      goToStep(4);
      return;
    }

    const rawDigits = customerPhone.replace(/\D/g, '');
    const cleanPhone = rawDigits.length === 12 && rawDigits.startsWith('91') ? rawDigits.slice(2) : rawDigits;

    setSubmitting(true);
    try {
      // 1. Create Booking Record
      const combinedNotes = [
        selectedGame ? `Requested Game: ${selectedGame}` : null,
        notes?.trim() || null,
      ].filter(Boolean).join(' | ');

      const bookingPayload = {
        stationId: selectedStation.id,
        date: selectedDate,
        startTime: selectedSlot.time,
        durationMinutes,
        playerCount,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim() || undefined,
        customerPhone: cleanPhone,
        gameTitle: selectedGame || undefined,
        notes: combinedNotes || undefined,
        couponCode: appliedCoupon ? appliedCoupon.code : undefined,
        payAtCounter: paymentOption === 'COUNTER',
        paymentMethod: paymentOption === 'COUNTER' ? 'CASH' : 'RAZORPAY',
      };

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingPayload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        if (res.status === 409) {
          toast.error('This time slot was just booked by another player. Please select another slot or station.');
          setCurrentStep(2);
          // Refresh slots with zone
          const zoneParam = selectedZone ? `&zone=${selectedZone}` : '';
          const reloadRes = await fetch(
            `/api/bookings/availability?date=${selectedDate}&duration=${durationMinutes}${zoneParam}`
          );
          const reloadJson = await reloadRes.json();
          if (reloadJson.success) setSlots(reloadJson.data.slots || []);
        } else {
          toast.error(json.error?.message || 'Failed to create booking');
        }
        setSubmitting(false);
        return;
      }

      const booking = json.data;

      // 2. If Paying at Desk, redirect straight to confirmation pass
      if (paymentOption === 'COUNTER') {
        toast.success('Booking confirmed! Show your QR code at the reception desk.');
        router.push(`/booking/confirmation/${booking.id || booking.bookingRef}?token=${encodeURIComponent(booking.qrToken)}`);
        return;
      }

      // 3. Razorpay checkout
      const orderRes = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id }),
      });

      const orderJson = await orderRes.json();
      if (!orderRes.ok || !orderJson.success) throw new Error(orderJson.error?.message || 'Could not start online payment');
      const orderData = orderJson.data;

      await loadRazorpayCheckout();
      const Checkout = (window as CheckoutWindow).Razorpay;
      if (!Checkout) throw new Error('Payment checkout is unavailable');
      const gatewayResult = await new Promise<CheckoutResult>((resolve, reject) => {
        const checkout = new Checkout({
          key: orderData.key,
          amount: orderData.amountPaise,
          currency: 'INR',
          name: 'Dark Syndicate Gaming World',
          order_id: orderData.orderId,
          handler: (response: CheckoutResult) => resolve(response),
          modal: { ondismiss: () => reject(new Error('Payment was cancelled')) },
        });
        checkout.on('payment.failed', () => reject(new Error('Payment failed. Please try again.')));
        checkout.open();
      });

      const verifyRes = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: orderData?.paymentId,
          gatewayOrderId: gatewayResult.razorpay_order_id,
          gatewayPaymentId: gatewayResult.razorpay_payment_id,
          gatewaySignature: gatewayResult.razorpay_signature,
        }),
      });

      const verifyJson = await verifyRes.json();

      if (verifyJson.success) {
        toast.success('Payment verified! Your session pass has been issued.');
        router.push(`/booking/confirmation/${booking.id || booking.bookingRef}?token=${encodeURIComponent(booking.qrToken)}`);
      } else {
        toast.error('Payment confirmation is pending. Contact reception with your booking reference.');
        router.push(`/booking/confirmation/${booking.id || booking.bookingRef}?token=${encodeURIComponent(booking.qrToken)}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Mobile Sticky Navigation Handlers
  const isMobileBackDisabled = currentStep === 1 || submitting;

  const handleMobileBack = () => {
    setIsSummaryOpen(false);
    if (currentStep === 1) return;
    goToStep(currentStep - 1);
  };

  const handleMobileContinue = () => {
    setIsSummaryOpen(false);
    if (currentStep === 1) {
      if (!selectedZone) {
        toast.error('Please select a gaming zone to continue');
        return;
      }
      goToStep(2);
      return;
    }
    if (currentStep === 2) {
      if (!selectedSlot) {
        toast.error('Please pick an available time slot to continue');
        return;
      }
      goToStep(3);
      return;
    }
    if (currentStep === 3) {
      if (!selectedStation) {
        toast.error('Please choose a gaming station or table to continue');
        return;
      }
      goToStep(4);
      return;
    }
    if (currentStep === 4) {
      const nameErr = validateCustomerName(customerName);
      const phoneErr = validateCustomerPhone(customerPhone);
      const emailErr = validateCustomerEmail(customerEmail);

      setFormTouched({ customerName: true, customerPhone: true, customerEmail: true });
      setFormErrors({
        customerName: nameErr,
        customerPhone: phoneErr,
        customerEmail: emailErr,
      });

      if (nameErr || phoneErr || emailErr) {
        toast.error(nameErr || phoneErr || emailErr || 'Please fill in all required fields correctly');
        return;
      }
      goToStep(5);
      return;
    }
    if (currentStep === 5) {
      handleConfirmBooking();
      return;
    }
  };

  const getMobileContinueText = () => {
    if (submitting) return 'Processing...';
    if (currentStep === 1) return 'Pick Date & Slot';
    if (currentStep === 2) return 'Choose Station';
    if (currentStep === 3) return 'Player Details';
    if (currentStep === 4) return 'Proceed to Checkout';
    if (currentStep === 5) {
      return paymentOption === 'ONLINE'
        ? `Pay ₹${(finalPricePaise / 100).toFixed(0)}`
        : 'Reserve Desk';
    }
    return 'Continue';
  };

  return (
    <div className="min-h-screen bg-ds-darker text-ds-text flex flex-col selection:bg-ds-accent selection:text-white">
      <Navbar />

      <main className="flex-1 pt-24 sm:pt-32 pb-36 lg:pb-16">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          {/* Header Banner */}
          <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-10 px-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-ds-accent/10 border border-ds-accent/30 text-ds-ice mb-2 sm:mb-3">
              <Sparkles className="w-3.5 h-3.5 text-ds-accent" />
              <span>Real-Time Reservation Engine</span>
            </div>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-heading font-black tracking-tight uppercase text-ds-text">
              Book Your <span className="text-ds-ice">Gaming Session</span>
            </h1>
            <p className="mt-2 sm:mt-3 text-ds-text-muted text-xs sm:text-sm md:text-base leading-relaxed">
              Reserve your PS5 Pro arena or Championship Pool table in 4 simple steps. Instant confirmation & QR check-in pass.
            </p>
          </div>

          {/* Stepper Progress Bar */}
          <div id="booking-stepper-header" className="max-w-4xl mx-auto mb-8 sm:mb-12">
            <div className="grid grid-cols-5 gap-1 sm:gap-2 md:gap-3 relative">
              {[
                { step: 1, title: 'Gaming Zone', icon: Sparkles },
                { step: 2, title: 'Date & Slot', icon: CalendarIcon },
                { step: 3, title: 'Choose Station', icon: Gamepad2 },
                { step: 4, title: 'Player Info', icon: UserIcon },
                { step: 5, title: 'Pass & Pay', icon: CreditCard },
              ].map(({ step, title, icon: Icon }) => {
                const isActive = currentStep === step;
                const isCompleted = currentStep > step;

                return (
                  <button
                    key={step}
                    onClick={() => {
                      if (
                        step < currentStep ||
                        (step === 2 && selectedZone) ||
                        (step === 3 && selectedZone && selectedSlot) ||
                        (step === 4 && selectedZone && selectedSlot && selectedStation)
                      ) {
                        goToStep(step);
                      }
                    }}
                    className={`flex flex-col items-center text-center p-1 sm:p-2.5 rounded-xl transition-all duration-200 border cursor-pointer ${
                      isActive
                        ? 'bg-ds-surface border-ds-accent text-ds-ice shadow-lg shadow-ds-accent/10 ring-1 ring-ds-accent/40'
                        : isCompleted
                        ? 'bg-ds-surface/50 border-emerald-500/50 text-emerald-400 hover:border-emerald-400'
                        : 'bg-ds-surface/20 border-ds-border text-ds-text-dim cursor-not-allowed opacity-75'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center mb-1 transition-all ${
                        isActive
                          ? 'bg-ds-accent text-white shadow-md shadow-ds-accent/30'
                          : isCompleted
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-ds-border/40 text-ds-text-dim'
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                    </div>
                    <span className="text-[9px] sm:text-xs font-heading font-bold uppercase tracking-wider">
                      Step {step}
                    </span>
                    <span className="text-[10px] sm:text-xs font-medium hidden sm:inline truncate max-w-[70px] sm:max-w-[110px]">
                      {title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Wizard Step Content */}
          <div id="booking-step-container" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Main Form / Stepper Canvas */}
            <div className="lg:col-span-8 space-y-8 min-h-[640px]">
              {/* STEP 1: GAMING ZONE SELECTION */}
              {currentStep === 1 && (
                <Card glass className="p-6 sm:p-8 border-ds-border space-y-6 min-h-[580px] flex flex-col justify-between">
                  <div className="space-y-6">
                    <div className="border-b border-ds-border pb-4">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-ds-accent/15 border border-ds-accent/30 text-ds-ice mb-2">
                        <Sparkles className="w-3.5 h-3.5 text-ds-accent" />
                        <span>Step 1: Choose Your Zone</span>
                      </div>
                      <h2 className="text-2xl font-heading font-black uppercase text-ds-text">
                        Choose Your Gaming Zone
                      </h2>
                      <p className="text-xs sm:text-sm text-ds-text-muted mt-1">
                        Select an arena below to explore available gaming consoles and championship snooker tables.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* 1. PlayStation 5 Arena Card */}
                      <div
                        onClick={() => {
                          setSelectedZone('PS5');
                          setSelectedStation(null);
                          setPlayerCount(1);
                          goToStep(2);
                        }}
                        className={`group relative rounded-2xl overflow-hidden border-2 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-2xl hover:shadow-ds-accent/20 bg-ds-dark flex flex-col justify-between ${
                          selectedZone === 'PS5'
                            ? 'border-ds-accent ring-2 ring-ds-accent/40 shadow-ds-accent/30'
                            : 'border-ds-border hover:border-ds-accent'
                        }`}
                      >
                        <div className="relative w-full h-56 sm:h-64 overflow-hidden">
                          <Image
                            src="/ps5-station.jpg"
                            alt="PlayStation 5 Gaming Station"
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                            priority
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-ds-dark via-ds-dark/30 to-transparent" />
                          <div className="absolute top-3 right-3">
                            {(() => {
                              const ps5List = stations.filter((s) => s.stationType === 'PS5');
                              const ps5Avail = ps5List.filter((s) => s.status === 'AVAILABLE').length;
                              const ps5Total = ps5List.length || 3;
                              return ps5Avail > 0 ? (
                                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/90 text-white shadow-md backdrop-blur-sm flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-200 animate-pulse" />
                                  {ps5Avail} of {ps5Total} Available Now
                                </span>
                              ) : (
                                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-ds-surface/90 border border-ds-accent/50 text-ds-ice shadow-md backdrop-blur-sm flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                  {ps5Total} Consoles • Advance Slots Open
                                </span>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="p-4 sm:p-5 flex items-center justify-between border-t border-ds-border/50 bg-ds-surface/40">
                          <div className="flex items-center gap-2.5">
                            <span className="text-2xl">🎮</span>
                            <h3 className="font-heading font-black text-lg text-ds-text uppercase group-hover:text-ds-ice transition-colors">
                              PlayStation 5 Arena
                            </h3>
                          </div>
                          <span className="text-ds-ice font-mono font-bold text-xs bg-ds-surface px-3 py-1.5 rounded-lg border border-ds-border">
                            From ₹150/hr
                          </span>
                        </div>
                      </div>

                      {/* 2. Snooker Lounge Card */}
                      <div
                        onClick={() => {
                          setSelectedZone('POOL_TABLE');
                          setSelectedStation(null);
                          setPlayerCount(4);
                          goToStep(2);
                        }}
                        className={`group relative rounded-2xl overflow-hidden border-2 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-2xl hover:shadow-emerald-500/20 bg-ds-dark flex flex-col justify-between ${
                          selectedZone === 'POOL_TABLE'
                            ? 'border-emerald-500 ring-2 ring-emerald-500/40 shadow-emerald-500/30'
                            : 'border-ds-border hover:border-emerald-500'
                        }`}
                      >
                        <div className="relative w-full h-56 sm:h-64 overflow-hidden">
                          <Image
                            src="/snooker-table.jpg"
                            alt="Championship Snooker Table"
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                            priority
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-ds-dark via-ds-dark/30 to-transparent" />
                          <div className="absolute top-3 right-3">
                            {(() => {
                              const poolList = stations.filter((s) => s.stationType === 'POOL_TABLE');
                              const poolAvail = poolList.filter((s) => s.status === 'AVAILABLE').length;
                              const poolTotal = poolList.length || 3;
                              return poolAvail > 0 ? (
                                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/90 text-white shadow-md backdrop-blur-sm flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-200 animate-pulse" />
                                  {poolAvail} of {poolTotal} Available Now
                                </span>
                              ) : (
                                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-ds-surface/90 border border-emerald-500/50 text-emerald-400 shadow-md backdrop-blur-sm flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                  {poolTotal} Tables • Advance Slots Open
                                </span>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="p-4 sm:p-5 flex items-center justify-between border-t border-ds-border/50 bg-ds-surface/40">
                          <div className="flex items-center gap-2.5">
                            <span className="text-2xl">🎱</span>
                            <h3 className="font-heading font-black text-lg text-ds-text uppercase group-hover:text-emerald-400 transition-colors">
                              Snooker Lounge
                            </h3>
                          </div>
                          <span className="text-emerald-400 font-mono font-bold text-xs bg-ds-surface px-3 py-1.5 rounded-lg border border-ds-border">
                            ₹250/hr
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Navigation for Step 1 */}
                  <div className="hidden lg:flex items-center gap-2 sm:gap-3 w-full justify-end pt-4 border-t border-ds-border">
                    <Button
                      variant="accent"
                      size="sm"
                      onClick={() => {
                        if (selectedZone) goToStep(2);
                        else toast.error('Please choose a gaming zone to continue');
                      }}
                      disabled={!selectedZone}
                      className="text-xs sm:text-sm py-2 px-4 sm:px-5 shadow-md shadow-ds-accent/20"
                    >
                      <span>Continue to Date & Slot</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>
                </Card>
              )}

              {/* STEP 2: DATE, DURATION & TIME SLOT */}
              {currentStep === 2 && (
                <Card glass className="p-4 sm:p-6 md:p-8 border-ds-border space-y-6 sm:space-y-8 min-h-[580px] flex flex-col justify-between">
                  <div className="flex items-center justify-between border-b border-ds-border pb-4">
                    <div>
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-ds-accent/15 border border-ds-accent/30 text-ds-ice mb-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-ds-accent" />
                        <span>Step 2: Pick Date & Slot</span>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-heading font-black uppercase text-ds-text">
                        2. Pick Date & Session Duration
                      </h2>
                      <p className="text-xs text-ds-text-muted mt-0.5">
                        Zone: <span className="text-ds-ice font-semibold">{selectedZone === 'PS5' ? 'PlayStation 5 Arena' : selectedZone === 'POOL_TABLE' ? 'Snooker Lounge' : 'Gaming Arena'}</span> • Choose your session date, duration, player count, and time slot.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => goToStep(1)}
                      className="text-xs text-ds-accent hover:underline flex items-center gap-1 font-semibold cursor-pointer shrink-0"
                    >
                      Change Zone
                    </button>
                  </div>

                  {/* 1. Date Selector Carousel */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim flex items-center gap-1.5">
                          <CalendarIcon className="w-3.5 h-3.5 text-ds-accent" />
                          <span>Select Date (Next 14 Days)</span>
                        </label>
                        {selectedDate && (
                          <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[11px] font-mono bg-ds-accent/10 text-ds-ice border border-ds-accent/25">
                            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        )}
                      </div>

                      {/* Navigation Chevrons */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => scrollDates('left')}
                          className="w-7 h-7 rounded-lg border border-ds-border bg-ds-surface/80 hover:bg-ds-surface hover:border-ds-accent/60 text-ds-text-dim hover:text-ds-ice flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
                          title="Previous dates"
                          aria-label="Previous dates"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => scrollDates('right')}
                          className="w-7 h-7 rounded-lg border border-ds-border bg-ds-surface/80 hover:bg-ds-surface hover:border-ds-accent/60 text-ds-text-dim hover:text-ds-ice flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
                          title="Next dates"
                          aria-label="Next dates"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div
                      ref={dateScrollRef}
                      onWheel={(e) => {
                        if (e.deltaY !== 0 && dateScrollRef.current) {
                          e.currentTarget.scrollLeft += e.deltaY;
                        }
                      }}
                      className="flex gap-2.5 overflow-x-auto py-1.5 scroll-smooth no-scrollbar select-none touch-pan-x overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                    >
                      {dateList.map((item) => {
                        const isSelected = selectedDate === item.dateStr;
                        return (
                          <button
                            key={item.dateStr}
                            type="button"
                            onClick={() => setSelectedDate(item.dateStr)}
                            className={`flex-shrink-0 w-20 py-3 rounded-xl flex flex-col items-center justify-center transition-all border cursor-pointer ${
                              isSelected
                                ? 'bg-ds-accent text-white border-ds-accent shadow-lg shadow-ds-accent/25 scale-[1.03] ring-2 ring-ds-accent/40 font-bold'
                                : 'bg-ds-surface/60 border-ds-border text-ds-text-muted hover:border-ds-accent/40 hover:text-white hover:bg-ds-surface'
                            }`}
                          >
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-white' : 'text-ds-text-dim'}`}>
                              {item.dayName}
                            </span>
                            <span className="text-xl font-heading font-extrabold my-0.5">{item.dayNum}</span>
                            <span className={`text-[10px] uppercase font-semibold ${isSelected ? 'text-white/90' : 'text-ds-text-muted'}`}>
                              {item.month}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                    {/* 2. Player Count Selector (Matches Official Rate Board) */}
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                        <span>Number of Players</span>
                        <span className="text-ds-ice font-semibold">
                          {(selectedZone === 'PS5' || (!selectedZone && selectedStation?.stationType === 'PS5') || (!selectedZone && !selectedStation))
                            ? playerCount === 1
                              ? 'Single Player (₹150/hr)'
                              : playerCount === 2
                              ? 'Two Player (₹200/hr)'
                              : 'Multi Player 3-4P (₹250/hr)'
                            : playerCount <= 4
                            ? 'Standard Table (Max 4 Players — ₹250/hr)'
                            : `Large Group (${playerCount} Players — ₹${250 + (playerCount - 4) * 50}/hr)`}
                        </span>
                      </div>

                      {(selectedZone === 'PS5' || (!selectedZone && selectedStation?.stationType === 'PS5') || (!selectedZone && !selectedStation)) ? (
                        <div className="grid grid-cols-3 gap-2 sm:gap-3">
                          {[
                            { count: 1, label: 'Single Player', sub: '1 Player', rate: '₹150 / hr' },
                            { count: 2, label: 'Two Player', sub: '2 Players', rate: '₹200 / hr' },
                            { count: 4, label: 'Multi Player', sub: '3 & 4 Players', rate: '₹250 / hr' },
                          ].map((opt) => (
                            <button
                              key={opt.count}
                              type="button"
                              onClick={() => setPlayerCount(opt.count)}
                              className={`p-2 sm:p-3 rounded-xl border text-center transition-all cursor-pointer ${
                                playerCount === opt.count
                                  ? 'bg-ds-surface border-ds-accent text-ds-ice ring-1 ring-ds-accent shadow-md'
                                  : 'bg-ds-surface/50 border-ds-border text-ds-text-muted hover:border-ds-border hover:text-white'
                              }`}
                            >
                              <div className="text-[11px] sm:text-xs font-heading font-bold">{opt.label}</div>
                              <span className="text-[9px] sm:text-[10px] text-ds-text-dim block mt-0.5">{opt.sub}</span>
                              <span className="text-[9px] sm:text-[10px] text-ds-accent font-mono font-bold block mt-1">{opt.rate}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          <div className="grid grid-cols-3 gap-2 sm:gap-3">
                            {[
                              { count: 1, label: 'Solo Practice', sub: '1 Player', rate: '₹250 / hr' },
                              { count: 2, label: '1v1 Match', sub: '2 Players', rate: '₹250 / hr' },
                              { count: 4, label: 'Standard Group', sub: 'Up to 4 Players', rate: '₹250 / hr' },
                            ].map((opt) => (
                              <button
                                key={opt.count}
                                type="button"
                                onClick={() => setPlayerCount(opt.count)}
                                className={`p-2 sm:p-3 rounded-xl border text-center transition-all cursor-pointer ${
                                  playerCount === opt.count
                                    ? 'bg-ds-surface border-emerald-500 text-emerald-400 ring-1 ring-emerald-500 shadow-md'
                                    : 'bg-ds-surface/50 border-ds-border text-ds-text-muted hover:border-ds-border hover:text-white'
                                }`}
                              >
                                <div className="text-[11px] sm:text-xs font-heading font-bold">{opt.label}</div>
                                <span className="text-[9px] sm:text-[10px] text-ds-text-dim block mt-0.5">{opt.sub}</span>
                                <span className="text-[9px] sm:text-[10px] text-emerald-400 font-mono font-bold block mt-1">{opt.rate}</span>
                              </button>
                            ))}
                          </div>

                          {/* Extra players: 5 to 8 (ONLY shown when 4 or more players selected) */}
                          {playerCount >= 4 && (
                            <div className="p-2.5 rounded-xl bg-ds-surface/30 border border-ds-border space-y-1.5 animate-in fade-in duration-150">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-heading font-bold text-amber-400 uppercase tracking-wide">
                                  Add Extra Players (&gt; 4 Players)
                                </span>
                                <span className="font-mono text-[10px] text-amber-300/80 font-semibold">
                                  +₹50 / person per hour
                                </span>
                              </div>
                              <div className="grid grid-cols-4 gap-2">
                                {[
                                  { count: 5, label: '5 Players', rate: '₹300/hr' },
                                  { count: 6, label: '6 Players', rate: '₹350/hr' },
                                  { count: 7, label: '7 Players', rate: '₹400/hr' },
                                  { count: 8, label: '8 Players', rate: '₹450/hr' },
                                ].map((opt) => (
                                  <button
                                    key={opt.count}
                                    type="button"
                                    onClick={() => setPlayerCount(opt.count)}
                                    className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                                      playerCount === opt.count
                                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400 shadow-sm'
                                        : 'bg-ds-surface/50 border-ds-border text-ds-text-muted hover:border-amber-400/50 hover:text-amber-200'
                                    }`}
                                  >
                                    <div className="text-[10px] sm:text-xs font-heading font-bold">{opt.label}</div>
                                    <span className="text-[9px] font-mono font-semibold text-amber-400/90 block mt-0.5">{opt.rate}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 3. Duration Selector */}
                  <div className="space-y-3">
                    <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                      Session Length
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {DURATION_OPTIONS.map((opt) => {
                        const isSelected = durationMinutes === opt.minutes;
                        return (
                          <button
                            key={opt.minutes}
                            onClick={() => setDurationMinutes(opt.minutes)}
                            className={`p-3 rounded-xl border text-center transition-all ${
                              isSelected
                                ? 'bg-ds-surface border-ds-accent text-ds-ice ring-1 ring-ds-accent shadow-md'
                                : 'bg-ds-surface/50 border-ds-border text-ds-text-muted hover:border-ds-border hover:text-white'
                            }`}
                          >
                            <div className="text-sm font-heading font-bold">{opt.label}</div>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded mt-1 inline-block ${
                                opt.tag.includes('OFF')
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : opt.tag.includes('Popular')
                                  ? 'bg-ds-accent/20 text-ds-ice'
                                  : 'bg-ds-border/40 text-ds-text-dim'
                              }`}
                            >
                              {opt.tag}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Slot Matrix */}
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim flex items-center gap-2">
                        <Clock className="w-4 h-4 text-ds-accent" />
                        Available Starting Times
                      </label>

                      {/* Period Filter Tabs */}
                      <div className="flex gap-1 bg-ds-surface p-1 rounded-lg border border-ds-border text-[11px] overflow-x-auto no-scrollbar max-w-full">
                        {['ALL', 'MORNING', 'AFTERNOON', 'EVENING', 'NIGHT'].map((p) => (
                          <button
                            key={p}
                            onClick={() => setSlotPeriod(p)}
                            className={`px-2.5 py-1 rounded font-semibold transition-all uppercase whitespace-nowrap ${
                              slotPeriod === p ? 'bg-ds-accent text-white shadow-sm' : 'text-ds-text-muted hover:text-white'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    {loadingSlots ? (
                      <div className="py-12 flex flex-col items-center justify-center gap-3">
                        <div className="w-8 h-8 border-2 border-ds-accent border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-ds-text-muted">Scanning real-time arena schedule...</span>
                      </div>
                    ) : filteredSlots.length === 0 ? (
                      <div className="p-8 text-center bg-ds-surface/30 rounded-xl border border-dashed border-ds-border text-xs text-ds-text-muted">
                        No available slots for the selected period. Please try a different date or period.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
                        {filteredSlots.map((slot) => {
                          const isSelected = selectedSlot?.time === slot.time;
                          const isBooked = !slot.available;

                          return (
                            <button
                              key={slot.time}
                              type="button"
                              onClick={() => {
                                if (slot.available) {
                                  setSelectedSlot(slot);
                                } else {
                                  toast.error(
                                    selectedZone === 'PS5'
                                      ? `All PlayStation 5 consoles are booked for ${slot.label}. Please select another time.`
                                      : selectedZone === 'POOL_TABLE'
                                      ? `All Snooker tables are booked for ${slot.label}. Please select another time.`
                                      : `All stations are booked for ${slot.label}. Please select another time.`
                                  );
                                }
                              }}
                              className={`p-3 rounded-xl border text-center transition-all ${
                                isSelected
                                  ? 'bg-ds-accent text-white border-ds-accent shadow-lg shadow-ds-accent/20 ring-2 ring-white/20 cursor-pointer'
                                  : slot.available
                                  ? 'bg-ds-surface border-ds-border text-ds-text hover:border-ds-accent/60 hover:text-ds-ice active:scale-95 cursor-pointer'
                                  : 'bg-rose-950/20 border-rose-500/25 text-ds-text-dim hover:border-rose-500/40 cursor-not-allowed'
                              }`}
                            >
                              <div
                                className={`text-sm font-heading font-extrabold ${
                                  isBooked ? 'text-ds-text-muted/60 line-through' : ''
                                }`}
                              >
                                {slot.label}
                              </div>
                              <span
                                className={`text-[10px] block mt-1 font-bold uppercase tracking-wider ${
                                  slot.available ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {slot.available
                                  ? slot.availableStationIds && slot.availableStationIds.length > 0
                                    ? `${slot.availableStationIds.length} ${
                                        selectedZone === 'PS5'
                                          ? 'PS5'
                                          : selectedZone === 'POOL_TABLE'
                                          ? 'Table'
                                          : 'Spot'
                                      }${slot.availableStationIds.length > 1 ? 's' : ''} Ready`
                                    : 'Available'
                                  : 'Booked'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="mt-3 flex items-start sm:items-center gap-2 px-3 py-2 rounded-lg bg-ds-surface/40 border border-ds-border/60 text-[11px] text-ds-text-muted">
                      <span className="text-ds-ice text-sm mt-0.5 sm:mt-0">⚡</span>
                      <span>
                        <strong className="text-ds-text">Dynamic Arena Availability:</strong> Time slots reflect real-time station schedules. Ongoing live gaming sessions automatically release consoles for upcoming booking slots upon completion.
                      </span>
                    </div>
                  </div>

                  {/* Bottom Navigation */}
                  <div className="space-y-3 pt-4 border-t border-ds-border">
                    {selectedSlot && (
                      <div className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-ds-surface/50 border border-ds-border/60">
                        <span className="text-[10px] text-ds-text-dim uppercase font-mono">Selected Slot</span>
                        <span className="text-xs font-bold text-ds-ice font-heading">{selectedSlot.label}</span>
                      </div>
                    )}

                    <div className="hidden lg:flex items-center gap-2 sm:gap-3 w-full sm:justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToStep(1)}
                        className="flex-1 sm:flex-initial text-xs sm:text-sm py-2 px-3 sm:px-4"
                      >
                        <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                        <span>Back to Zone</span>
                      </Button>

                      <Button
                        variant="accent"
                        size="sm"
                        onClick={() => {
                          if (selectedSlot) goToStep(3);
                          else toast.error('Please pick an available time slot');
                        }}
                        disabled={!selectedSlot}
                        className="flex-[1.5] sm:flex-initial text-xs sm:text-sm py-2 px-4 sm:px-5 shadow-md shadow-ds-accent/20"
                      >
                        <span>Choose {selectedZone === 'POOL_TABLE' ? 'Snooker Table' : 'PS5 Station'}</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                </Card>
              )}



              {/* STEP 3: SPECIFIC STATION SELECTION */}
              {currentStep === 3 && (
                <Card glass className="p-6 sm:p-8 border-ds-border space-y-6 min-h-[600px] flex flex-col justify-between">
                    <div className="space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ds-border pb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedZone(null);
                                setSelectedStation(null);
                              }}
                              className="inline-flex items-center gap-1.5 text-xs font-heading font-bold text-ds-ice hover:text-white bg-ds-surface px-2.5 py-1 rounded-lg border border-ds-border hover:border-ds-accent transition-colors"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" />
                              <span>All Arenas</span>
                            </button>
                            <span className="text-ds-text-dim">•</span>
                            <span className="text-xs font-mono uppercase text-ds-accent font-bold">
                              {selectedZone === 'PS5' ? 'PlayStation 5' : 'Snooker & Pool'}
                            </span>
                          </div>
                          <h2 className="text-xl font-heading font-black uppercase text-ds-text">
                            {selectedZone === 'PS5'
                              ? 'Choose Your PlayStation 5 Station'
                              : 'Choose Your Snooker Table'}
                          </h2>
                          <p className="text-xs text-ds-text-muted mt-0.5">
                            Click a station to select it for your session.
                          </p>
                        </div>

                        {/* Quick Zone Toggle Pills */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => goToStep(2)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-heading font-semibold text-ds-accent hover:underline flex items-center gap-1 cursor-pointer mr-1"
                          >
                            <CalendarIcon className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Change Slot</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedZone !== 'PS5') {
                                setSelectedZone('PS5');
                                setSelectedStation(null);
                                setSelectedSlot(null);
                                toast.info('Switched to PS5 Arena. Please select an available slot.');
                                goToStep(2);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold transition-all border flex items-center gap-1.5 ${
                              selectedZone === 'PS5'
                                ? 'bg-ds-accent text-white border-ds-accent shadow-sm'
                                : 'bg-ds-surface/60 border-ds-border text-ds-text-muted hover:text-white'
                            }`}
                          >
                            <span>🎮</span>
                            <span>PS5 Arena</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedZone !== 'POOL_TABLE') {
                                setSelectedZone('POOL_TABLE');
                                setSelectedStation(null);
                                setSelectedSlot(null);
                                toast.info('Switched to Snooker Arena. Please select an available slot.');
                                goToStep(2);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold transition-all border flex items-center gap-1.5 ${
                              selectedZone === 'POOL_TABLE'
                                ? 'bg-ds-accent text-white border-ds-accent shadow-sm'
                                : 'bg-ds-surface/60 border-ds-border text-ds-text-muted hover:text-white'
                            }`}
                          >
                            <span>🎱</span>
                            <span>Snooker</span>
                          </button>
                        </div>
                      </div>

                      {/* Slot Synchronization Notice */}
                      {selectedSlot && (() => {
                        const availableCount = stations.filter(
                          (st) =>
                            st.stationType === selectedZone &&
                            st.status !== 'MAINTENANCE' &&
                            st.status !== 'DEACTIVATED' &&
                            Boolean(selectedSlot.availableStationIds?.includes(st.id))
                        ).length;

                        return (
                          <div className="flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-ds-surface/60 border border-ds-border">
                            <div className="flex items-center gap-2 text-ds-text-muted">
                              <Clock className="w-3.5 h-3.5 text-ds-accent" />
                              <span>
                                Availability for{' '}
                                <strong className="text-ds-ice">{selectedSlot.label}</strong> on{' '}
                                <strong className="text-ds-ice">{selectedDate}</strong>
                              </span>
                            </div>
                            <span
                              className={`text-[11px] font-mono font-bold ${
                                availableCount > 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {availableCount > 0
                                ? `${availableCount} ${
                                    selectedZone === 'PS5'
                                      ? availableCount === 1
                                        ? 'Console'
                                        : 'Consoles'
                                      : availableCount === 1
                                      ? 'Table'
                                      : 'Tables'
                                  } Free`
                                : selectedZone === 'PS5'
                                ? 'All PS5s Booked'
                                : 'All Tables Booked'}
                            </span>
                          </div>
                        );
                      })()}

                      {/* Stations Grid for Selected Zone (Minimal, slot-synchronized, no games clutter) */}
                      {stations.filter((st) => st.stationType === selectedZone && st.status !== 'DEACTIVATED').length === 0 ? (
                        <div className="p-8 text-center bg-ds-surface/30 rounded-xl border border-dashed border-ds-border text-xs text-ds-text-muted">
                          No active stations found for this arena.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {stations
                            .filter((st) => st.stationType === selectedZone && st.status !== 'DEACTIVATED')
                            .map((station) => {
                              const isSelected = selectedStation?.id === station.id;
                              const isSlotAvailable = Boolean(selectedSlot?.availableStationIds?.includes(station.id));
                              const isOperational = station.status !== 'MAINTENANCE' && station.status !== 'DEACTIVATED';
                              const isAvailable = isSlotAvailable && isOperational;

                              return (
                                <div
                                  key={station.id}
                                  onClick={() => {
                                    if (isAvailable) {
                                      setSelectedStation(station);
                                      toast.success(`Selected ${station.name}`);
                                    } else {
                                      toast.error(
                                        `${station.name} is booked during ${selectedSlot?.label || 'this slot'}. Please choose an available station.`
                                      );
                                    }
                                  }}
                                  className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between gap-3 group ${
                                    isSelected
                                      ? 'bg-ds-surface border-ds-accent shadow-xl shadow-ds-accent/20 ring-2 ring-ds-accent'
                                      : isAvailable
                                      ? 'bg-ds-surface/50 border-ds-border hover:border-ds-accent/40 hover:bg-ds-surface/80'
                                      : 'bg-rose-950/15 border-rose-500/25 opacity-50 cursor-not-allowed'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div
                                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 border ${
                                          isSelected
                                            ? 'bg-ds-accent text-ds-dark border-ds-accent font-black shadow-glow-sm'
                                            : 'bg-ds-surface-2 border-ds-border text-ds-text'
                                        }`}
                                      >
                                        {station.stationType === 'PS5' ? '🎮' : '🎱'}
                                      </div>
                                      <div className="min-w-0">
                                        <h3 className="text-base font-heading font-extrabold text-ds-text group-hover:text-ds-ice transition-colors truncate">
                                          {station.name}
                                        </h3>
                                        <p className="text-[11px] text-ds-text-dim truncate">
                                          {station.specs || (station.stationType === 'PS5' ? '4K 120Hz OLED Display' : 'Championship Slate Bed')}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <Badge
                                        variant={isAvailable ? 'success' : station.status === 'MAINTENANCE' ? 'warning' : 'danger'}
                                        size="sm"
                                        className={`text-[10px] px-2 py-0.5 ${
                                          !isAvailable ? 'bg-rose-500/15 border-rose-500/30 text-rose-400' : ''
                                        }`}
                                      >
                                        {isAvailable ? 'Ready' : station.status === 'MAINTENANCE' ? 'Maintenance' : 'Booked'}
                                      </Badge>
                                    {isSelected && (
                                      <div className="w-5 h-5 rounded-full bg-ds-accent text-ds-dark font-black text-xs flex items-center justify-center shadow-md shadow-ds-accent/40 animate-in zoom-in-75">
                                        ✓
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-ds-border/30 text-xs">
                                  <span className="text-ds-accent font-bold font-mono text-xs">
                                    {station.stationType === 'PS5' ? 'From ₹150/hr' : '₹250/hr'}
                                  </span>
                                  <span
                                    className={`text-[11px] font-semibold inline-flex items-center gap-1 ${
                                      isSelected
                                        ? 'text-ds-ice font-bold'
                                        : isAvailable
                                        ? 'text-ds-text-dim group-hover:text-white'
                                        : 'text-rose-400 font-mono'
                                    }`}
                                  >
                                    {isSelected ? 'Selected ✓' : isAvailable ? 'Click to Select' : 'Booked for this Slot'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Bottom Navigation */}
                      <div className="space-y-3 pt-4 border-t border-ds-border mt-2">
                        {selectedStation && (
                          <div className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-ds-surface/50 border border-ds-border/60">
                            <span className="text-[10px] text-ds-text-dim uppercase font-mono">Selected Station</span>
                            <span className="text-xs font-bold text-ds-ice font-heading truncate max-w-[200px]">{selectedStation.name}</span>
                          </div>
                        )}

                        <div className="hidden lg:flex items-center gap-2 sm:gap-3 w-full sm:justify-between">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => goToStep(2)}
                            className="flex-1 sm:flex-initial text-xs sm:text-sm py-2 px-3 sm:px-4"
                          >
                            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                            <span>Back to Date & Slot</span>
                          </Button>

                          <Button
                            variant="accent"
                            size="sm"
                            onClick={() => {
                              if (selectedStation) goToStep(4);
                              else toast.error('Please choose a gaming station or table to continue');
                            }}
                            disabled={!selectedStation}
                            className="flex-[1.5] sm:flex-initial text-xs sm:text-sm py-2 px-4 sm:px-5 shadow-md shadow-ds-accent/20"
                          >
                            <span>Proceed to Gamer Info</span>
                            <ArrowRight className="w-3.5 h-3.5 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

              {/* STEP 4: GAMER DETAILS */}
              {currentStep === 4 && (
                <Card glass className="p-4 sm:p-6 md:p-8 border-ds-border space-y-6 min-h-[580px] flex flex-col justify-between">
                  <div className="border-b border-ds-border pb-4">
                    <h2 className="text-xl font-heading font-bold uppercase text-ds-text">
                      4. Player Information
                    </h2>
                    <p className="text-xs text-ds-text-muted mt-0.5">
                      Your digital check-in pass and QR code will be registered under these details.
                    </p>
                  </div>

                  {isAuthenticated ? (
                    <div className="space-y-3">
                      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-heading font-bold">
                            {user?.firstName?.[0] || 'U'}
                          </div>
                          <div>
                            <p className="text-sm font-heading font-bold text-ds-text">
                              Logged in as {user?.firstName} {user?.lastName}
                            </p>
                            <p className="text-xs text-ds-text-muted">{user?.email}</p>
                          </div>
                        </div>
                        <Badge variant="success" size="sm">
                          Verified Gamer
                        </Badge>
                      </div>

                      {activeMembership && (
                        <div className="p-3.5 rounded-xl bg-ds-accent/10 border border-ds-accent/30 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Crown className="w-5 h-5 text-amber-400 shrink-0" />
                            <div>
                              <p className="text-sm font-heading font-bold text-ds-ice">
                                {activeMembership.planNameSnapshot} ({activeMembership.discountPercent}% OFF)
                              </p>
                              <p className="text-xs text-ds-text-dim">
                                Your Syndicate pass discount is active and applied automatically to your session.
                              </p>
                            </div>
                          </div>
                          <Badge variant="accent" size="sm">
                            Tier Discount Active
                          </Badge>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-ds-accent/10 border border-ds-accent/30 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-ds-text-muted">
                        <Info className="w-4 h-4 text-ds-accent flex-shrink-0" />
                        <span>Have an account? Sign in for loyalty perks and saved history.</span>
                      </div>
                      <Link
                        href="/login?redirect=/booking"
                        className="inline-flex items-center justify-center font-heading font-semibold tracking-wide rounded-lg px-3 py-1.5 text-xs border border-ds-border text-ds-text hover:border-ds-accent hover:text-ds-accent transition-all active:scale-[0.98] shrink-0"
                      >
                        Sign In
                      </Link>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-ds-text-muted uppercase">
                        Full Name <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        placeholder="Alex Mercer"
                        value={customerName}
                        onChange={(e) => {
                          setCustomerName(e.target.value);
                          if (formTouched.customerName) {
                            setFormErrors((prev) => ({ ...prev, customerName: validateCustomerName(e.target.value) }));
                          }
                        }}
                        onBlur={() => {
                          setFormTouched((prev) => ({ ...prev, customerName: true }));
                          setFormErrors((prev) => ({ ...prev, customerName: validateCustomerName(customerName) }));
                        }}
                        error={formTouched.customerName ? formErrors.customerName : undefined}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-ds-text-muted uppercase">
                        WhatsApp Phone Number <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        placeholder="+91 98765 43210"
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => {
                          setCustomerPhone(e.target.value);
                          if (formTouched.customerPhone) {
                            setFormErrors((prev) => ({ ...prev, customerPhone: validateCustomerPhone(e.target.value) }));
                          }
                        }}
                        onBlur={() => {
                          setFormTouched((prev) => ({ ...prev, customerPhone: true }));
                          setFormErrors((prev) => ({ ...prev, customerPhone: validateCustomerPhone(customerPhone) }));
                        }}
                        error={formTouched.customerPhone ? formErrors.customerPhone : undefined}
                        required
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-xs font-semibold text-ds-text-muted uppercase">
                        Email Address (For Receipt & Pass)
                      </label>
                      <Input
                        type="email"
                        placeholder="alex@example.com"
                        value={customerEmail}
                        onChange={(e) => {
                          setCustomerEmail(e.target.value);
                          if (formTouched.customerEmail) {
                            setFormErrors((prev) => ({ ...prev, customerEmail: validateCustomerEmail(e.target.value) }));
                          }
                        }}
                        onBlur={() => {
                          setFormTouched((prev) => ({ ...prev, customerEmail: true }));
                          setFormErrors((prev) => ({ ...prev, customerEmail: validateCustomerEmail(customerEmail) }));
                        }}
                        error={formTouched.customerEmail ? formErrors.customerEmail : undefined}
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-ds-text-muted uppercase">
                          Special Requests / Pre-load Note (Optional)
                        </label>
                        {selectedGame && (
                          <span className="text-xs text-ds-cyan font-medium flex items-center gap-1">
                            <Gamepad2 className="w-3.5 h-3.5 text-ds-cyan" />
                            Game: <strong>{selectedGame}</strong>
                          </span>
                        )}
                      </div>
                      <textarea
                        rows={3}
                        className="w-full px-4 py-2.5 rounded-xl bg-ds-surface border border-ds-border text-ds-text placeholder:text-ds-text-dim text-sm focus:outline-none focus:border-ds-accent transition-colors"
                        placeholder="e.g. Please connect two DualSense controllers with Tekken 8 ready."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Bottom Navigation */}
                  <div className="hidden lg:flex items-center gap-2 sm:gap-3 w-full sm:justify-between pt-4 border-t border-ds-border">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToStep(3)}
                      className="flex-1 sm:flex-initial text-xs sm:text-sm py-2 px-3 sm:px-4"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                      <span>Back to Stations</span>
                    </Button>

                    <Button
                      variant="accent"
                      size="sm"
                      onClick={() => {
                        const nameErr = validateCustomerName(customerName);
                        const phoneErr = validateCustomerPhone(customerPhone);
                        const emailErr = validateCustomerEmail(customerEmail);

                        setFormTouched({ customerName: true, customerPhone: true, customerEmail: true });
                        setFormErrors({
                          customerName: nameErr,
                          customerPhone: phoneErr,
                          customerEmail: emailErr,
                        });

                        if (nameErr || phoneErr || emailErr) {
                          toast.error(nameErr || phoneErr || emailErr || 'Please check the highlighted errors');
                          return;
                        }
                        goToStep(5);
                      }}
                      className="flex-[1.5] sm:flex-initial text-xs sm:text-sm py-2 px-4 sm:px-5 shadow-md shadow-ds-accent/20"
                    >
                      <span>Proceed to Checkout</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>
                </Card>
              )}


              {/* STEP 5: REVIEW & PAYMENT SELECTION */}
              {currentStep === 5 && (
                <Card glass className="p-4 sm:p-6 md:p-8 border-ds-border space-y-6 min-h-[580px] flex flex-col justify-between">
                  <div className="border-b border-ds-border pb-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-ds-accent/15 border border-ds-accent/30 text-ds-ice mb-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-ds-accent" />
                      <span>Step 5: Pass & Pay</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-heading font-bold uppercase text-ds-text">
                      5. Review & Confirm Booking
                    </h2>
                    <p className="text-xs text-ds-text-muted mt-0.5">
                      Choose your payment preference and finalize your reservation. Instant QR pass issued.
                    </p>
                  </div>

                  {/* Payment Method Cards */}
                  <div className="space-y-3">
                    <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                      Select Payment Mode
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div
                        onClick={() => { if (onlineEnabled && user) setPaymentOption('ONLINE'); }}
                        className={`p-4 sm:p-5 rounded-xl border transition-all ${onlineEnabled && user ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'} ${
                          paymentOption === 'ONLINE'
                            ? 'bg-ds-surface border-ds-accent ring-1 ring-ds-accent shadow-lg shadow-ds-accent/10'
                            : 'bg-ds-surface/50 border-ds-border hover:border-ds-accent/40'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-ds-ice" />
                            <span className="font-heading font-bold text-ds-text">Instant Online Pass</span>
                          </div>
                          <Badge variant="accent" size="sm">
                            {onlineEnabled && user ? 'Fast Track' : 'Unavailable'}
                          </Badge>
                        </div>
                        <p className="text-xs text-ds-text-muted">
                          {onlineEnabled && user ? 'Pay securely through Razorpay via UPI, card or net banking.' : 'Online payment is available after gateway setup and sign in.'}
                        </p>
                      </div>

                      <div
                        onClick={() => setPaymentOption('COUNTER')}
                        className={`p-4 sm:p-5 rounded-xl border cursor-pointer transition-all ${
                          paymentOption === 'COUNTER'
                            ? 'bg-ds-surface border-emerald-500 ring-1 ring-emerald-500 shadow-lg shadow-emerald-500/10'
                            : 'bg-ds-surface/50 border-ds-border hover:border-emerald-500/40'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Banknote className="w-5 h-5 text-emerald-400" />
                            <span className="font-heading font-bold text-ds-text">Pay at Reception Desk</span>
                          </div>
                          <Badge variant="outline" size="sm">
                            Cash / UPI
                          </Badge>
                        </div>
                        <p className="text-xs text-ds-text-muted">
                          Reserve now, pay in cash or UPI at the front desk when you arrive. Hold released 10 mins post-slot.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Quick Summary Box for Mobile & Laplets (< lg) */}
                  <div className="lg:hidden p-3.5 sm:p-4 rounded-xl bg-ds-surface/60 border border-ds-border space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-ds-text-dim">Reservation</span>
                      <span className="font-heading font-bold text-ds-text truncate max-w-[200px]">
                        {selectedStation?.name} • {durationMinutes / 60}hr
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-ds-text-dim">Date & Slot</span>
                      <span className="text-ds-ice font-mono font-semibold">
                        {selectedDate} • {selectedSlot?.label}
                      </span>
                    </div>
                    {couponDiscountPaise > 0 && (
                      <div className="flex items-center justify-between text-xs text-emerald-400">
                        <span>Promo Code ({appliedCoupon?.code})</span>
                        <span>-₹{(couponDiscountPaise / 100).toFixed(0)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-ds-border/60">
                      <span className="text-xs font-heading font-bold uppercase text-ds-text">Total Payable</span>
                      <span className="text-xl font-heading font-black text-ds-ice">
                        ₹{(finalPricePaise / 100).toFixed(0)}
                      </span>
                    </div>
                  </div>

                  {/* Terms & Policies */}
                  <div className="p-3.5 sm:p-4 rounded-xl bg-ds-surface/40 border border-ds-border text-xs text-ds-text-dim space-y-2">
                    <div className="flex items-center gap-2 text-ds-text font-semibold">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Syndicate Booking Guarantee</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-[11px] leading-relaxed">
                      <li>Free cancellation up to 2 hours before your scheduled session.</li>
                      <li>Please arrive 5-10 minutes early to check in with your QR pass.</li>
                      <li>Extra controllers and refreshments are available on demand at the arena.</li>
                    </ul>
                  </div>

                  {/* Bottom Navigation */}
                  <div className="hidden lg:flex items-center gap-2 sm:gap-3 w-full sm:justify-between pt-4 border-t border-ds-border">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToStep(4)}
                      disabled={submitting}
                      className="flex-1 sm:flex-initial text-xs sm:text-sm py-2 px-3 sm:px-4"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                      <span>Back to Player Info</span>
                    </Button>

                    <Button
                      variant="accent"
                      size="sm"
                      onClick={handleConfirmBooking}
                      disabled={submitting}
                      className="flex-[1.8] sm:flex-initial text-xs sm:text-sm py-2 px-4 sm:px-6 shadow-md shadow-ds-accent/25"
                    >
                      {submitting ? (
                        <div className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Issuing Pass...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span>
                            {paymentOption === 'ONLINE' ? 'Pay & Confirm Pass' : 'Reserve & Pay at Desk'}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </div>
                      )}
                    </Button>
                  </div>
                </Card>
              )}

            </div>

            {/* Right Booking Receipt / Summary Sticky Card (Desktop Only) */}
            <div className="hidden lg:block lg:col-span-4 space-y-6">
              <Card glass className="p-4 sm:p-6 border-ds-border lg:sticky lg:top-24 space-y-5 sm:space-y-6">
                <div className="flex items-center justify-between border-b border-ds-border pb-4">
                  <h3 className="text-lg font-heading font-bold uppercase text-ds-text">Order Summary</h3>
                  <Badge variant="outline" size="sm">
                    {durationMinutes / 60} Hour{durationMinutes > 60 ? 's' : ''}
                  </Badge>
                </div>

                {/* Selected Item Details */}
                <div className="space-y-4 text-xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-ds-accent">Station</p>
                      <p className="font-heading font-bold text-sm text-ds-text">
                        {selectedStation?.name || (selectedZone ? 'Choose a station on left' : 'Select a zone to begin')}
                      </p>
                      <p className="text-ds-text-dim text-[11px]">
                        {selectedStation?.facilityName || (selectedZone ? (selectedZone === 'PS5' ? 'PlayStation 5 Arena' : 'Snooker Lounge') : 'No Arena Selected')}
                      </p>
                      {selectedGame && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-ds-cyan font-medium">
                          <span>🎮 {selectedGame}</span>
                          <button
                            type="button"
                            onClick={() => setShowGameModal(true)}
                            className="text-[10px] text-ds-text-dim hover:text-white underline ml-1"
                          >
                            Change
                          </button>
                        </div>
                      )}
                    </div>
                    <Gamepad2 className="w-5 h-5 text-ds-ice mt-1" />
                  </div>

                  <div className="flex items-start justify-between pt-3 border-t border-ds-border/40">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-ds-accent">Players</p>
                      <p className="font-heading font-bold text-sm text-ds-text">
                        {(selectedZone === 'PS5' || (!selectedZone && selectedStation?.stationType === 'PS5') || (!selectedZone && !selectedStation))
                          ? playerCount === 1
                            ? 'Single Player (1P)'
                            : playerCount === 2
                            ? 'Two Player (2P)'
                            : 'Multi Player (3-4P)'
                          : 'Per Frame (Max 4P)'}
                      </p>
                      <p className="text-ds-ice font-semibold text-[11px]">
                        ₹{(hourlyRatePaise / 100).toFixed(0)} / hr
                      </p>
                    </div>
                    <UserIcon className="w-5 h-5 text-ds-text-dim mt-1" />
                  </div>

                  <div className="flex items-start justify-between pt-3 border-t border-ds-border/40">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-ds-accent">Date & Window</p>
                      <p className="font-heading font-bold text-ds-text">
                        {selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { dateStyle: 'medium' }) : '—'}
                      </p>
                      <p className="text-ds-ice font-semibold text-[11px]">
                        {selectedSlot ? selectedSlot.label : 'Slot not chosen'}
                      </p>
                    </div>
                    <CalendarIcon className="w-5 h-5 text-ds-text-dim mt-1" />
                  </div>
                </div>

                {/* Coupon Code Section */}
                <div className="space-y-2 pt-3 border-t border-ds-border/40">
                  <label className="text-[10px] font-heading font-bold uppercase tracking-wider text-ds-text-dim flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-ds-accent" />
                    Promo Code
                  </label>

                  {appliedCoupon ? (
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-emerald-400">{appliedCoupon.code}</span>
                        <p className="text-[10px] text-emerald-300/80">{appliedCoupon.description}</p>
                      </div>
                      <button
                        onClick={handleRemoveCoupon}
                        className="text-rose-400 hover:underline text-[11px] font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g. WELCOME10"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        className="text-xs uppercase font-mono"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleApplyCoupon()}
                        disabled={couponLoading}
                        className="text-xs"
                      >
                        {couponLoading ? '...' : 'Apply'}
                      </Button>
                    </div>
                  )}

                  {/* Promo quick buttons */}
                  {!appliedCoupon && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button
                        onClick={() => handleApplyCoupon('WELCOME10')}
                        className="text-[10px] px-2 py-0.5 rounded bg-ds-border/50 text-ds-text-dim hover:text-ds-ice hover:bg-ds-border"
                      >
                        WELCOME10 (10% off)
                      </button>
                      <button
                        onClick={() => handleApplyCoupon('SYNDICATE20')}
                        className="text-[10px] px-2 py-0.5 rounded bg-ds-border/50 text-ds-text-dim hover:text-ds-ice hover:bg-ds-border"
                      >
                        SYNDICATE20 (20% off)
                      </button>
                    </div>
                  )}
                </div>

                {/* Price Calculation Table */}
                <div className="space-y-2 pt-4 border-t border-ds-border text-xs">
                  <div className="flex justify-between text-ds-text-muted">
                    <span>
                      {selectedStation
                        ? `Base Hourly Rate (₹${(hourlyRatePaise / 100).toFixed(0)} × ${hours} hr)`
                        : 'Base Hourly Rate'}
                    </span>
                    <span>{selectedStation ? `₹${(subtotalPaise / 100).toFixed(0)}` : '—'}</span>
                  </div>

                  {multiHourDiscountPaise > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Multi-Hour Deal (10% off)</span>
                      <span>-₹{(multiHourDiscountPaise / 100).toFixed(0)}</span>
                    </div>
                  )}

                  {happyHourDiscountPaise > 0 && (
                    <div className="flex justify-between text-amber-400">
                      <span>Happy Hour Deal (10 AM–3 PM: 15% off)</span>
                      <span>-₹{(happyHourDiscountPaise / 100).toFixed(0)}</span>
                    </div>
                  )}

                  {membershipDiscountPaise > 0 && (
                    <div className="flex justify-between text-ds-cyan font-medium">
                      <span className="flex items-center gap-1.5">
                        <Crown className="w-3.5 h-3.5 text-ds-cyan shrink-0" />
                        {activeMembership?.planNameSnapshot || 'Member Pass'} ({membershipDiscountPercent}% off)
                      </span>
                      <span className="font-mono">-₹{(membershipDiscountPaise / 100).toFixed(0)}</span>
                    </div>
                  )}

                  {couponDiscountPaise > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Coupon Discount</span>
                      <span>-₹{(couponDiscountPaise / 100).toFixed(0)}</span>
                    </div>
                  )}

                  {!activeMembership && (
                    <div className="py-2 px-2.5 rounded-lg bg-ds-dark/40 border border-ds-border/50 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 text-ds-text-dim">
                        <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Save up to 30% every hour</span>
                      </div>
                      <Link href="/membership" className="text-ds-cyan hover:underline font-semibold">
                        Get Pass →
                      </Link>
                    </div>
                  )}

                  <div className="flex justify-between text-ds-text-dim text-[11px]">
                    <span>GST (Included)</span>
                    <span>18%</span>
                  </div>

                  <div className="flex justify-between items-baseline pt-3 border-t border-ds-border">
                    <span className="text-sm font-heading font-bold text-ds-text uppercase">Total Payable</span>
                    <div className="text-right">
                      <span className="text-2xl font-heading font-black text-ds-ice">
                        {selectedStation ? `₹${(finalPricePaise / 100).toFixed(0)}` : '—'}
                      </span>
                      <span className="text-[10px] text-ds-text-dim block">Taxes & Amenities Included</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>

        {/* ─── MOBILE STICKY CHECKOUT BAR & EXPANDABLE DRAWER (lg:hidden) ─── */}
        <div className="lg:hidden">
          {/* Backdrop Overlay when Summary is Open */}
          {isSummaryOpen && (
            <div
              onClick={() => setIsSummaryOpen(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40 transition-opacity animate-in fade-in duration-200"
            />
          )}

          {/* Floating Bottom Drawer & Bar */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0B0F17]/95 backdrop-blur-2xl border-t border-ds-border shadow-[0_-12px_40px_rgba(0,0,0,0.85)] px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="max-w-2xl mx-auto">
              {/* Top Pull Handle / Tap Indicator */}
              <div
                onClick={() => setIsSummaryOpen((prev) => !prev)}
                className="w-12 h-1 bg-ds-border-light/60 hover:bg-ds-accent/80 rounded-full mx-auto mb-2 cursor-pointer transition-colors"
              />

              {/* EXPANDED SUMMARY SHEET CONTENT */}
              {isSummaryOpen && (
                <div className="border-b border-ds-border/80 pb-3 mb-3 max-h-[55vh] overflow-y-auto space-y-3 animate-in slide-in-from-bottom-4 duration-200">
                  <div className="flex items-center justify-between text-xs border-b border-ds-border/40 pb-2">
                    <span className="font-heading font-bold uppercase tracking-wider text-ds-ice text-[11px]">
                      Booking Details
                    </span>
                    <button
                      onClick={() => setIsSummaryOpen(false)}
                      className="text-[10px] text-ds-text-dim hover:text-white"
                    >
                      Close ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* 1. Experience */}
                    <div className="flex items-start gap-2 p-2.5 rounded-xl bg-ds-surface-2/70 border border-ds-border/60">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                        ✓
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] uppercase font-mono text-ds-text-dim">Experience</p>
                        <p className="font-heading font-bold text-ds-text truncate">
                          {selectedZone === 'PS5' ? 'PlayStation 5' : selectedZone === 'POOL_TABLE' ? 'Snooker Lounge' : 'Arena Selection'}
                        </p>
                      </div>
                    </div>

                    {/* 2. Station */}
                    <div className="flex items-start gap-2 p-2.5 rounded-xl bg-ds-surface-2/70 border border-ds-border/60">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                        ✓
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] uppercase font-mono text-ds-text-dim">Station</p>
                        <p className="font-heading font-bold text-ds-text truncate">
                          {selectedStation?.name || 'Not Chosen Yet'}
                        </p>
                        {selectedGame && (
                          <p className="text-[10px] text-ds-cyan font-semibold truncate">
                            🎮 {selectedGame}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 3. Date */}
                    <div className="flex items-start gap-2 p-2.5 rounded-xl bg-ds-surface-2/70 border border-ds-border/60">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                        ✓
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] uppercase font-mono text-ds-text-dim">Date</p>
                        <p className="font-heading font-bold text-ds-text truncate">
                          {selectedDate
                            ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })
                            : 'Today'}
                        </p>
                      </div>
                    </div>

                    {/* 4. Slot Window */}
                    <div className="flex items-start gap-2 p-2.5 rounded-xl bg-ds-surface-2/70 border border-ds-border/60">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                        ✓
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] uppercase font-mono text-ds-text-dim">Time Slot</p>
                        <p className="font-heading font-bold text-ds-text truncate">
                          {selectedSlot ? selectedSlot.label : `${durationMinutes / 60} Hour Session`}
                        </p>
                      </div>
                    </div>

                    {/* 5. Players */}
                    <div className="flex items-start gap-2 p-2.5 rounded-xl bg-ds-surface-2/70 border border-ds-border/60">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                        ✓
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] uppercase font-mono text-ds-text-dim">Players</p>
                        <p className="font-heading font-bold text-ds-text truncate">
                          {selectedStation?.stationType === 'PS5'
                            ? playerCount === 1
                              ? 'Single Player (1P)'
                              : playerCount === 2
                              ? 'Duo (2P)'
                              : `${playerCount} Players`
                            : `${playerCount} Players`}
                        </p>
                      </div>
                    </div>

                    {/* 6. Hourly Rate */}
                    <div className="flex items-start gap-2 p-2.5 rounded-xl bg-ds-surface-2/70 border border-ds-border/60">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                        ✓
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] uppercase font-mono text-ds-text-dim">Rate Tier</p>
                        <p className="font-heading font-bold text-ds-text truncate">
                          {selectedStation ? `₹${(hourlyRatePaise / 100).toFixed(0)}/hr` : '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Promo Code Section in Drawer */}
                  <div className="space-y-1.5 pt-1">
                    {appliedCoupon ? (
                      <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-emerald-400">{appliedCoupon.code}</span>
                          <p className="text-[10px] text-emerald-300/80">{appliedCoupon.description}</p>
                        </div>
                        <button
                          onClick={handleRemoveCoupon}
                          className="text-rose-400 hover:underline text-[11px] font-semibold"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1.5">
                        <Input
                          placeholder="ENTER PROMO CODE"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                          className="text-xs uppercase font-mono h-8"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleApplyCoupon()}
                          disabled={couponLoading}
                          className="text-xs h-8 px-3"
                        >
                          {couponLoading ? '...' : 'Apply'}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Price Breakdown in Drawer */}
                  <div className="p-2.5 rounded-xl bg-ds-darker/60 border border-ds-border/50 space-y-1 text-[11px]">
                    <div className="flex justify-between text-ds-text-dim">
                      <span>Base Hourly {selectedStation ? `(${hours}h × ₹${(hourlyRatePaise / 100).toFixed(0)})` : ''}</span>
                      <span className="font-mono text-ds-text">
                        {selectedStation ? `₹${(subtotalPaise / 100).toFixed(0)}` : '—'}
                      </span>
                    </div>
                    {multiHourDiscountPaise > 0 && (
                      <div className="flex justify-between text-emerald-400">
                        <span>Multi-Hour Deal (10% off)</span>
                        <span className="font-mono">-₹{(multiHourDiscountPaise / 100).toFixed(0)}</span>
                      </div>
                    )}
                    {membershipDiscountPaise > 0 && (
                      <div className="flex justify-between text-ds-cyan">
                        <span className="flex items-center gap-1">
                          <Crown className="w-3 h-3 text-ds-cyan shrink-0" />
                          {activeMembership?.planNameSnapshot || 'Member Pass'} ({membershipDiscountPercent}%)
                        </span>
                        <span className="font-mono font-medium">-₹{(membershipDiscountPaise / 100).toFixed(0)}</span>
                      </div>
                    )}
                    {couponDiscountPaise > 0 && (
                      <div className="flex justify-between text-emerald-400">
                        <span>Coupon Discount</span>
                        <span className="font-mono">-₹{(couponDiscountPaise / 100).toFixed(0)}</span>
                      </div>
                    )}
                    {!activeMembership && (
                      <div className="flex items-center justify-between pt-1 border-t border-ds-border/30 text-[10px]">
                        <span className="text-ds-text-dim flex items-center gap-1">
                          <Crown className="w-3 h-3 text-amber-400" />
                          Save 10–30% with Syndicate Pass
                        </span>
                        <Link href="/membership" className="text-ds-cyan font-bold underline">
                          Explore Passes
                        </Link>
                      </div>
                    )}
                    <div className="flex justify-between text-ds-text-dim text-[10px] pt-1 border-t border-ds-border/40">
                      <span>Taxes & Hardware Amenities</span>
                      <span className="text-emerald-400 font-semibold">Included</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TOP ROW: Estimated Total & Summary Accordion */}
              <div className="flex items-center justify-between pb-1.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] uppercase tracking-wider text-ds-text-dim font-mono">
                    Estimated total
                  </span>
                  <span className="text-xl sm:text-2xl font-heading font-black text-ds-ice tracking-tight">
                    {selectedStation ? `₹${(finalPricePaise / 100).toFixed(0)}` : '—'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSummaryOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 text-xs font-heading font-bold text-ds-ice hover:text-white transition-colors py-1 px-2.5 rounded-lg bg-ds-surface hover:bg-ds-surface-2 border border-ds-border/70 shadow-sm"
                >
                  <span>Summary</span>
                  {isSummaryOpen ? (
                    <ChevronUp className="w-3.5 h-3.5 text-ds-accent transition-transform" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-ds-accent transition-transform" />
                  )}
                </button>
              </div>

              {/* BOTTOM ROW: Back Button (30%) + Continue Button (70%) */}
              <div className="flex items-center gap-2 pb-0.5 w-full">
                {/* Back Button (30% width) */}
                <button
                  type="button"
                  onClick={handleMobileBack}
                  disabled={isMobileBackDisabled}
                  aria-label="Previous step"
                  className="w-[30%] shrink-0 h-11 sm:h-12 rounded-xl bg-ds-surface border border-ds-border hover:border-ds-accent/60 flex items-center justify-center gap-1 text-xs font-heading font-bold text-ds-text hover:text-white active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                >
                  <ChevronLeft className="w-4 h-4 text-ds-text" />
                  <span>Back</span>
                </button>

                {/* Continue Action Button (70% width) */}
                <button
                  type="button"
                  onClick={handleMobileContinue}
                  disabled={submitting}
                  className="w-[70%] flex-1 h-11 sm:h-12 rounded-xl bg-gradient-to-r from-ds-accent to-ds-ice hover:brightness-110 active:scale-[0.98] text-ds-darker font-heading font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-ds-accent/25 transition-all disabled:opacity-50"
                >
                  {submitting ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 border-2 border-ds-darker border-t-transparent rounded-full animate-spin" />
                      <span>Processing...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span>{getMobileContinueText()}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── OPTIONAL GAME SELECTION MODAL (FULL VIEW WITH SWIPE) ─── */}
        {showGameModal && selectedStation && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in"
            onClick={() => setShowGameModal(false)}
          >
            <div
              className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-ds-dark border border-ds-border shadow-2xl shadow-ds-accent/15 overflow-hidden animate-in zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Top Header */}
              <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-ds-border/60 bg-ds-surface/50 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-ds-accent/15 border border-ds-accent/30 flex items-center justify-center text-ds-cyan shrink-0">
                    <Gamepad2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading font-black text-base sm:text-lg uppercase text-ds-text truncate">
                        Select Game
                      </h3>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-ds-accent/15 border border-ds-accent/30 text-ds-cyan font-bold tracking-wider shrink-0">
                        Optional
                      </span>
                    </div>
                    <p className="text-xs text-ds-text-muted mt-0.5 truncate">
                      Installed on <span className="text-ds-ice font-semibold">{selectedStation.name}</span> • Swipe to pre-load or decide at the venue
                    </p>
                  </div>
                </div>

                {/* Prominent X Close Button */}
                <button
                  type="button"
                  onClick={() => setShowGameModal(false)}
                  aria-label="Close game selector"
                  className="w-10 h-10 rounded-xl bg-ds-surface border border-ds-border hover:border-ds-accent text-ds-text-dim hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-sm shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sub-Header: Search & Carousel Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 sm:px-6 pt-3.5 pb-2 shrink-0 border-b border-ds-border/30 bg-ds-dark">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-xs">
                  <Search className="w-3.5 h-3.5 text-ds-text-dim absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={gameSearchQuery}
                    onChange={(e) => setGameSearchQuery(e.target.value)}
                    placeholder="Search titles (e.g. Tekken, FC 24)..."
                    className="w-full pl-9 pr-7 py-1.5 rounded-xl bg-ds-surface border border-ds-border text-xs text-ds-text placeholder:text-ds-text-dim focus:outline-none focus:border-ds-accent transition-colors"
                  />
                  {gameSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setGameSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ds-text-dim hover:text-white text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Swipe Helper & Chevron Navigation */}
                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-ds-text-dim">
                    <span className="w-2 h-2 rounded-full bg-ds-accent animate-pulse" />
                    <span>Swipe or click arrows to browse ({displayedGames.length} games)</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => scrollGameCarousel('left')}
                      disabled={!canScrollLeft}
                      className="w-8 h-8 rounded-lg border border-ds-border bg-ds-surface/80 hover:bg-ds-surface hover:border-ds-accent/60 text-ds-text-dim hover:text-ds-ice flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title="Scroll left"
                      aria-label="Previous game"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollGameCarousel('right')}
                      disabled={!canScrollRight}
                      className="w-8 h-8 rounded-lg border border-ds-border bg-ds-surface/80 hover:bg-ds-surface hover:border-ds-accent/60 text-ds-text-dim hover:text-ds-ice flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title="Scroll right"
                      aria-label="Next game"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* ─── HORIZONTAL SWIPEABLE CAROUSEL ─── */}
              <div
                ref={gameCarouselRef}
                onScroll={checkCarouselScroll}
                onWheel={(e) => {
                  if (e.deltaY !== 0 && gameCarouselRef.current) {
                    e.currentTarget.scrollLeft += e.deltaY;
                  }
                }}
                className="flex-1 overflow-x-auto overflow-y-hidden flex gap-4 p-4 sm:p-6 snap-x snap-mandatory scroll-smooth touch-pan-x no-scrollbar select-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {/* CARD 1: "Decide at Venue / Any Game" Option */}
                <div
                  onClick={() => setSelectedGame(null)}
                  className={`snap-center shrink-0 w-[240px] sm:w-[270px] rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden group select-none relative ${
                    selectedGame === null
                      ? 'bg-ds-surface/90 border-ds-accent shadow-xl shadow-ds-accent/25 ring-2 ring-ds-accent'
                      : 'bg-ds-surface/40 border-ds-border hover:border-ds-accent/50 hover:bg-ds-surface/70'
                  }`}
                >
                  {/* Poster Area */}
                  <div className="relative h-48 sm:h-56 w-full bg-gradient-to-br from-slate-900 via-ds-darker to-black flex flex-col items-center justify-center p-6 text-center overflow-hidden border-b border-ds-border/40">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-ds-accent/15 via-transparent to-transparent" />
                    <div
                      className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-3 border transition-transform duration-300 group-hover:scale-110 ${
                        selectedGame === null
                          ? 'bg-ds-accent/20 border-ds-accent text-ds-cyan'
                          : 'bg-ds-dark border-ds-border text-ds-text-dim'
                      }`}
                    >
                      🎮
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-ds-accent font-bold">
                      Open Choice
                    </span>
                    <h4 className="font-heading font-black text-base uppercase text-ds-text mt-1">
                      Decide at Venue
                    </h4>
                    <span className="text-[10px] text-emerald-400 font-mono mt-0.5">
                      Switch games anytime
                    </span>

                    {selectedGame === null && (
                      <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-ds-accent text-ds-darker font-black text-xs flex items-center justify-center shadow-lg shadow-ds-accent/40 animate-in zoom-in-75">
                        ✓
                      </div>
                    )}
                  </div>

                  {/* Card Description & Action */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <p className="text-xs text-ds-text-dim leading-relaxed">
                      Don't want to lock in a title right now? Choose from our full game library or swap games whenever you want at the arena.
                    </p>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedGame(null);
                      }}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-heading font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        selectedGame === null
                          ? 'bg-ds-accent text-white shadow-md shadow-ds-accent/30'
                          : 'bg-ds-surface border border-ds-border hover:border-ds-accent/60 text-ds-text hover:text-white'
                      }`}
                    >
                      {selectedGame === null ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Selected ✓</span>
                        </>
                      ) : (
                        <span>Choose at Venue</span>
                      )}
                    </button>
                  </div>
                </div>

                {/* CARDS 2..N: Full-View Game Posters */}
                {displayedGames.map((game, idx) => {
                  const isGameSelected = selectedGame === game.title;

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedGame(game.title)}
                      className={`snap-center shrink-0 w-[240px] sm:w-[270px] rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden group select-none relative ${
                        isGameSelected
                          ? 'bg-ds-surface/90 border-ds-accent shadow-xl shadow-ds-accent/25 ring-2 ring-ds-accent scale-[1.01]'
                          : 'bg-ds-surface/40 border-ds-border hover:border-ds-accent/50 hover:bg-ds-surface/70'
                      }`}
                    >
                      {/* Full Game Cover Poster Image */}
                      <div className="relative h-48 sm:h-56 w-full bg-ds-dark overflow-hidden border-b border-ds-border/40">
                        <Image
                          src={game.coverImage}
                          alt={game.title}
                          fill
                          sizes="(max-width: 768px) 240px, 270px"
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-ds-darker via-black/35 to-black/50" />

                        {/* Top Badges */}
                        <div className="absolute top-2.5 left-2.5">
                          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-md border border-white/15 text-ds-cyan font-bold">
                            {game.genre}
                          </span>
                        </div>

                        <div className="absolute top-2.5 right-2.5">
                          {isGameSelected ? (
                            <div className="w-6 h-6 rounded-full bg-ds-accent text-ds-darker font-black text-xs flex items-center justify-center shadow-lg shadow-ds-accent/40 animate-in zoom-in-75">
                              ✓
                            </div>
                          ) : (
                            <span className="text-[10px] font-mono text-white/90 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 font-bold">
                              {game.maxPlayers}P Max
                            </span>
                          )}
                        </div>

                        {/* Title Overlay on Poster */}
                        <div className="absolute bottom-2.5 left-2.5 right-2.5">
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 mb-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Installed & Ready</span>
                          </div>
                          <h4 className="font-heading font-black text-sm sm:text-base text-white truncate drop-shadow-md">
                            {game.title}
                          </h4>
                        </div>
                      </div>

                      {/* Description & Selection Button */}
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <p className="text-xs text-ds-text-dim line-clamp-2 leading-relaxed">
                          {game.description}
                        </p>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedGame(game.title);
                          }}
                          className={`w-full py-2 px-3 rounded-xl text-xs font-heading font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            isGameSelected
                              ? 'bg-ds-accent text-white shadow-md shadow-ds-accent/30'
                              : 'bg-ds-surface border border-ds-border hover:border-ds-accent/60 text-ds-text hover:text-white'
                          }`}
                        >
                          {isGameSelected ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Selected ✓</span>
                            </>
                          ) : (
                            <span>Select Game</span>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Modal Bottom Action Bar */}
              <div className="p-4 sm:p-5 border-t border-ds-border/60 bg-ds-surface/60 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2 text-xs w-full sm:w-auto">
                  <span className="text-ds-text-dim font-mono">Current choice:</span>
                  {selectedGame ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-ds-accent/15 border border-ds-accent/30 text-ds-cyan font-heading font-bold">
                      <Gamepad2 className="w-3.5 h-3.5" />
                      <span>{selectedGame}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-ds-surface border border-ds-border text-ds-text-muted font-mono">
                      <span>Decide at Venue (Any Game)</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedGame(null);
                      setShowGameModal(false);
                    }}
                    className="text-xs flex-1 sm:flex-initial"
                  >
                    Decide at Venue
                  </Button>

                  <Button
                    variant="accent"
                    size="sm"
                    onClick={() => setShowGameModal(false)}
                    className="text-xs font-heading font-bold uppercase tracking-wider flex-1 sm:flex-initial shadow-md shadow-ds-accent/25"
                  >
                    {selectedGame ? `Confirm ${selectedGame}` : 'Confirm & Continue'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-ds-darker flex items-center justify-center text-ds-ice">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-ds-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-heading tracking-wider uppercase">Loading Syndicate Booking...</span>
          </div>
        </div>
      }
    >
      <BookingContent />
    </Suspense>
  );
}
