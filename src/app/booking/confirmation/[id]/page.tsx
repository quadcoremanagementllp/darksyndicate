'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  Download,
  Share2,
  ArrowRight,
  ShieldCheck,
  Gamepad2,
  Printer,
  Sparkles,
  Ticket,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { formatBookingDate, formatBookingTime } from '@/lib/utils';

interface BookingDetail {
  id: string;
  bookingRef: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  subtotalPaise: number;
  discountPaise: number;
  totalPricePaise: number;
  status: string;
  qrToken: string;
  qrDataUrl: string;
  customerName: string;
  customerPhone?: string;
  gameTitle?: string;
  notes?: string;
  createdAt: string;
  station?: {
    id: string;
    name: string;
    stationType: string;
    facility?: {
      name: string;
      shortDesc?: string;
    };
  };
  payments?: Array<{
    id: string;
    amountPaise: number;
    method: string;
    status: string;
    gatewayPaymentId?: string;
    paidAt?: string;
  }>;
}

export default function BookingConfirmationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const bookingId = params?.id as string;

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const passRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadBooking() {
      if (!bookingId) return;
      try {
        const passToken = searchParams.get('token');
        const res = await fetch(`/api/bookings/${bookingId}${passToken ? `?token=${encodeURIComponent(passToken)}` : ''}`);
        const json = await res.json();
        if (json.success && json.data) {
          setBooking(json.data);
        } else {
          toast.error(json.error?.message || 'Failed to load booking details');
        }
      } catch (err) {
        console.error('Failed to fetch booking:', err);
      } finally {
        setLoading(false);
      }
    }
    loadBooking();
  }, [bookingId, searchParams]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyRef = () => {
    if (booking?.bookingRef) {
      navigator.clipboard.writeText(booking.bookingRef);
      toast.success('Booking Reference copied to clipboard!');
    }
  };

  const handleShareWhatsApp = async () => {
    if (!booking) return;

    // Human-readable date: e.g. "Mon, Oct 5, 2026"
    const dateFormatted = formatBookingDate(booking.date);

    // Human-readable start and end times: e.g. "01:00 PM – 03:00 PM"
    const startTimeFormatted = formatBookingTime(booking.startTime);
    const endTimeFormatted = formatBookingTime(booking.endTime);

    const durationHrs = booking.durationMinutes ? booking.durationMinutes / 60 : 0;
    const durationStr = durationHrs > 0 ? (durationHrs === 1 ? '1 Hour' : `${durationHrs} Hours`) : '';

    const stationName = booking.station?.name || 'PS5 Pro Station';
    const facilityName = booking.station?.facility?.name ? ` (${booking.station.facility.name})` : '';

    const passUrl = `${typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || 'https://darksyndicate.in')}/booking/confirmation/${booking.id}?token=${encodeURIComponent(booking.qrToken)}`;

    const latestPay = booking.payments?.[0];
    const isBookingPaid = booking.totalPricePaise === 0 || latestPay?.status === 'COMPLETED';
    const paymentStatus = isBookingPaid ? 'Paid' : booking.status === 'PENDING' ? 'Payment pending' : 'Pay at Venue';
    const amount = `₹${(booking.totalPricePaise / 100).toFixed(0)}`;

    const lines = [
      `🎮 *DARK SYNDICATE GAMING WORLD*`,
      `*Digital Check-in Pass*`,
      ``,
      `👤 *Player:* ${booking.customerName}`,
      `🔖 *Booking Ref:* ${booking.bookingRef}`,
      `🕹️ *Station:* ${stationName}${facilityName}`,
      booking.gameTitle ? `🎯 *Game:* ${booking.gameTitle}` : `🎯 *Game Choice:* Decide at Venue`,
      `📅 *Date:* ${dateFormatted}`,
      durationStr
        ? `⏰ *Time Slot:* ${startTimeFormatted} – ${endTimeFormatted} (${durationStr})`
        : `⏰ *Time Slot:* ${startTimeFormatted} – ${endTimeFormatted}`,
      `💳 *Amount:* ${amount} (${paymentStatus})`,
      ``,
      `🎟️ *Open Your Digital Pass & QR:*`,
      passUrl,
      ``,
      `📍 *Venue:* Dark Syndicate Arena · 4th Floor, Nexus Mall, Velachery, Chennai`,
      `⚡ *Note:* Please arrive 5–10 minutes early to scan in at the desk.`,
      ``,
      `See you at the Arena! 🚀`,
    ];

    const message = lines.join('\n');

    // On mobile devices supporting navigator.canShare with image files, share with logo image attached
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      /mobile|android|iphone|ipad/i.test(navigator.userAgent || '')
    ) {
      try {
        const logoRes = await fetch('/logo-1024.png');
        if (logoRes.ok) {
          const blob = await logoRes.blob();
          const imageFile = new File([blob], 'dark-syndicate-pass.png', { type: blob.type || 'image/png' });
          if (navigator.canShare({ files: [imageFile] })) {
            await navigator.share({
              title: 'DARK SYNDICATE · Digital Check-in Pass',
              text: message,
              files: [imageFile],
            });
            return;
          }
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    }

    // Direct WhatsApp API endpoint (WhatsApp displays the logo preview card automatically via Open Graph)
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    try {
      const win = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      if (!win || win.closed || typeof win.closed === 'undefined') {
        window.location.href = whatsappUrl;
      }
    } catch {
      window.location.href = whatsappUrl;
    }
  };

  // Google Calendar Integration
  const getGoogleCalendarUrl = () => {
    if (!booking) return '#';
    const startDate = new Date(booking.startTime).toISOString().replace(/-|:|\.\d\d\d/g, '');
    const endDate = new Date(booking.endTime).toISOString().replace(/-|:|\.\d\d\d/g, '');
    const title = encodeURIComponent(`Gaming at Dark Syndicate (${booking.station?.name || 'Session'})`);
    const details = encodeURIComponent(
      `Dark Syndicate Gaming World Session\nRef: ${booking.bookingRef}\nPass QR available on site.\nNotes: ${booking.notes || 'None'}`
    );
    const location = encodeURIComponent('Dark Syndicate Gaming World, Nexus Mall, Chennai');
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${details}&location=${location}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ds-darker text-ds-text flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-ds-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-heading font-semibold uppercase tracking-wider text-ds-ice">
              Generating Digital Check-in Pass...
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-ds-darker text-ds-text flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center py-20">
          <Card glass className="p-8 max-w-md text-center space-y-4">
            <h2 className="text-2xl font-heading font-bold text-ds-text">Booking Not Found</h2>
            <p className="text-xs text-ds-text-muted">
              We couldn't retrieve this booking reservation. It may have expired or been moved.
            </p>
            <Link href="/booking">
              <Button variant="accent" className="w-full justify-center mt-2">
                Make a New Booking
              </Button>
            </Link>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const latestPayment = booking.payments?.[0];
  const isPaid = booking.totalPricePaise === 0 || latestPayment?.status === 'COMPLETED';

  return (
    <div className="min-h-screen bg-ds-darker text-ds-text flex flex-col selection:bg-ds-accent selection:text-white print:bg-white print:text-black">
      <div className="print:hidden">
        <Navbar />
      </div>

      <main className="flex-1 pt-32 sm:pt-36 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Success Banner */}
          <div className="text-center mb-10 print:hidden">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mb-4 shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-heading font-black tracking-tight uppercase text-ds-text">
              Reservation <span className="text-emerald-400">Confirmed!</span>
            </h1>
            <p className="mt-2 text-ds-text-muted text-sm max-w-md mx-auto">
              Your battle station has been reserved. Present the digital QR pass below at the front reception counter.
            </p>
          </div>

          {/* DIGITAL CHECK-IN PASS (BOARDING PASS STYLE) */}
          <div
            ref={passRef}
            className="relative bg-gradient-to-b from-ds-surface to-ds-dark border-2 border-ds-accent/60 rounded-3xl overflow-hidden shadow-2xl shadow-ds-accent/20 print:border-black print:shadow-none print:bg-white print:text-black"
          >
            {/* Top Pass Brand Header */}
            <div className="bg-ds-accent/20 border-b border-ds-accent/30 p-6 flex items-center justify-between print:bg-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-ds-dark flex items-center justify-center border border-ds-accent/40 shadow-inner">
                  <Image src="/logo.svg" alt="Dark Syndicate" width={28} height={28} className="object-contain" />
                </div>
                <div>
                  <h2 className="text-base font-heading font-black tracking-wider uppercase text-ds-text print:text-black">
                    DARK SYNDICATE
                  </h2>
                  <span className="text-[10px] font-mono tracking-widest text-ds-ice uppercase font-bold block print:text-black">
                    OFFICIAL GAMING PASS
                  </span>
                </div>
              </div>

              <div className="text-right">
                <Badge
                  variant={isPaid ? 'success' : 'warning'}
                  size="sm"
                  className="font-mono uppercase tracking-wider text-xs px-3 py-1"
                >
                  {isPaid ? 'CONFIRMED / ACTIVE' : booking.status === 'PENDING' ? 'AWAITING PAYMENT' : 'RESERVED (PAY AT DESK)'}
                </Badge>
              </div>
            </div>

            {/* Pass Body Content */}
            <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Left Column: Details */}
              <div className="md:col-span-8 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ds-border/60 pb-4">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-ds-text-dim tracking-wider block">
                      Booking Reference
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-2xl font-mono font-extrabold text-ds-ice tracking-wider print:text-black">
                        {booking.bookingRef}
                      </span>
                      <button
                        onClick={handleCopyRef}
                        className="p-1 rounded hover:bg-ds-surface text-ds-text-dim hover:text-ds-ice transition-colors print:hidden"
                        title="Copy Reference"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-mono text-ds-text-dim tracking-wider block">
                      Player Name
                    </span>
                    <span className="text-base font-heading font-bold text-ds-text print:text-black">
                      {booking.customerName}
                    </span>
                  </div>
                </div>

                {/* Station & Facility Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-ds-text-dim tracking-wider block">
                      Reserved Arena
                    </span>
                    <p className="text-lg font-heading font-bold text-ds-text print:text-black">
                      {booking.station?.name || 'PS5 Pro Station'}
                    </p>
                    <p className="text-xs text-ds-accent print:text-black">
                      {booking.station?.facility?.name || 'PlayStation 5 Arena'}
                    </p>
                    {booking.gameTitle && (
                      <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-ds-accent/15 border border-ds-accent/30 text-ds-cyan text-xs font-heading font-bold print:border-black print:text-black">
                        <Gamepad2 className="w-3.5 h-3.5" />
                        <span>Game: {booking.gameTitle}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-mono text-ds-text-dim tracking-wider block">
                      Session Length
                    </span>
                    <p className="text-lg font-heading font-bold text-ds-text print:text-black">
                      {booking.durationMinutes / 60} Hour{booking.durationMinutes > 60 ? 's' : ''}
                    </p>
                    <p className="text-xs text-ds-text-dim print:text-black">High-Performance LAN</p>
                  </div>
                </div>

                {/* Date & Time Window */}
                <div className="p-4 rounded-2xl bg-ds-dark/70 border border-ds-border/80 grid grid-cols-2 gap-4 print:bg-white print:border-gray-300">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-ds-surface flex items-center justify-center text-ds-ice flex-shrink-0">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-mono text-ds-text-dim block">Date</span>
                      <span className="text-sm font-heading font-bold text-ds-text print:text-black">
                        {formatBookingDate(booking.date)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-ds-surface flex items-center justify-center text-ds-ice flex-shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-mono text-ds-text-dim block">Time Window</span>
                      <span className="text-sm font-heading font-bold text-ds-ice print:text-black">
                        {formatBookingTime(booking.startTime)} – {formatBookingTime(booking.endTime)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Total & Payment Badge */}
                <div className="flex items-center justify-between pt-2">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-ds-text-dim block">Amount Total</span>
                    <span className="text-2xl font-heading font-black text-ds-ice print:text-black">
                      ₹{(booking.totalPricePaise / 100).toFixed(0)}
                    </span>
                    {booking.discountPaise > 0 && (
                      <span className="text-xs text-emerald-400 block">
                        Saved ₹{(booking.discountPaise / 100).toFixed(0)} with promo
                      </span>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-mono text-ds-text-dim block">Payment Mode</span>
                    <span className="text-xs font-semibold text-ds-text print:text-black">
                      {latestPayment?.method || (isPaid ? 'UPI Instant' : 'Pay at Counter')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: QR Code Pass */}
              <div className="md:col-span-4 flex flex-col items-center justify-center p-6 rounded-2xl bg-ds-dark border border-ds-border/60 text-center print:border-black print:bg-white">
                <div className="p-3 bg-white rounded-2xl shadow-xl border-4 border-ds-accent/30 mb-3">
                  {booking.qrDataUrl ? (
                    <img
                      src={booking.qrDataUrl}
                      alt="Check-in QR Code"
                      className="w-40 h-40 object-contain mx-auto"
                    />
                  ) : (
                    <div className="w-40 h-40 bg-gray-100 flex items-center justify-center text-gray-400">
                      QR Generated
                    </div>
                  )}
                </div>

                <span className="text-[11px] font-mono uppercase tracking-wider text-ds-text-dim font-semibold block">
                  Scan at Turnstile / Desk
                </span>
                <span className="text-[9px] font-mono text-ds-text-dim block truncate max-w-[180px] opacity-60 mt-0.5">
                  Token: {booking.qrToken.slice(0, 16)}...
                </span>
              </div>
            </div>

            {/* Bottom Pass Bar */}
            <div className="px-6 py-3 bg-ds-surface/60 border-t border-ds-border/60 flex flex-wrap items-center justify-between text-xs text-ds-text-dim gap-2 print:bg-white">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-ds-accent" />
                Dark Syndicate Arena • 4th Floor, Nexus Mall, Velachery, Chennai
              </span>
              <span>Please arrive 5-10 minutes before slot start time.</span>
            </div>
          </div>

          {/* Action Button Strip */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 print:hidden">
            <Button variant="accent" onClick={handlePrint} className="flex items-center gap-2">
              <Printer className="w-4 h-4" />
              <span>Print / Save Pass</span>
            </Button>

            <Button
              variant="secondary"
              onClick={handleShareWhatsApp}
              className="flex items-center gap-2 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 hover:border-emerald-400 shadow-sm"
            >
              <Share2 className="w-4 h-4 text-emerald-400" />
              <span>Share on WhatsApp</span>
            </Button>

            <a href={getGoogleCalendarUrl()} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Add to Calendar</span>
                <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-60" />
              </Button>
            </a>

            <Link href="/account/bookings">
              <Button variant="outline" className="flex items-center gap-2">
                <span>View in My Bookings</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          {/* Arrival Guidelines */}
          <div className="mt-12 p-6 rounded-2xl bg-ds-surface/40 border border-ds-border text-xs text-ds-text-muted space-y-3 print:hidden">
            <div className="flex items-center gap-2 text-ds-text font-heading font-bold uppercase text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Player Check-in Instructions</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[11px] leading-relaxed pt-2">
              <div>
                <p className="font-bold text-ds-text mb-1">1. Fast-Track Entry</p>
                <p>Present the QR code above to the front desk scanner. Your console will be unlocked automatically.</p>
              </div>
              <div>
                <p className="font-bold text-ds-text mb-1">2. Gear & Peripherals</p>
                <p>Each station includes sanitized wireless DualSense controllers. Headsets are available upon request.</p>
              </div>
              <div>
                <p className="font-bold text-ds-text mb-1">3. Refreshments & Extension</p>
                <p>Order energy drinks and snacks directly to your seat. Extend your session anytime subject to availability.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  );
}
