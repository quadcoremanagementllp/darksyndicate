'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Gamepad2,
  Calendar,
  Clock,
  Sparkles,
  QrCode,
  ArrowRight,
  TrendingUp,
  Award,
  Shield,
  AlertCircle,
  ChevronRight,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/hooks/useAuth';
import { formatBookingDate, formatBookingTime } from '@/lib/utils';

export default function AccountDashboardPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [membershipData, setMembershipData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedQrBooking, setSelectedQrBooking] = useState<any | null>(null);
  const [showTierModal, setShowTierModal] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [bookingsRes, memberRes] = await Promise.all([
          fetch('/api/customer/bookings'),
          fetch('/api/customer/membership').catch(() => null),
        ]);

        const bookingsJson = await bookingsRes.json();
        if (bookingsJson.success) {
          setBookings(bookingsJson.data);
        }

        if (memberRes) {
          const memberJson = await memberRes.json();
          if (memberJson.success && memberJson.data) {
            setMembershipData(memberJson.data);
          }
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const activeMembership = membershipData?.activeMembership;

  const upcomingBooking = bookings.find(
    (b) => b.status === 'CONFIRMED' || b.status === 'CHECKED_IN' || b.status === 'IN_PROGRESS'
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ─── Top Syndicate Tier Card (Positioned directly below headerbar, interactive) ─── */}
      <div
        onClick={() => setShowTierModal(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setShowTierModal(true)}
        className="p-3.5 sm:p-5 rounded-2xl bg-gradient-to-r from-ds-surface/90 via-ds-surface to-amber-950/25 border border-amber-500/40 hover:border-amber-400/80 shadow-lg hover:shadow-amber-500/10 cursor-pointer active:scale-[0.99] transition-all group relative overflow-hidden"
      >
        {/* Ambient Amber Glow in corner */}
        <div className="absolute -top-12 -right-12 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/20 transition-all" />

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 shadow-glow-sm">
              <Award className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider text-ds-text-dim">
                  Syndicate Tier
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-heading font-black uppercase bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  Active
                </span>
              </div>
              <div className="text-base sm:text-2xl font-heading font-black text-amber-400 tracking-wide uppercase truncate mt-0.5">
                {activeMembership?.planNameSnapshot || activeMembership?.tierSnapshot || 'GLACIER ELITE'}
              </div>
              <p className="text-[11px] text-ds-accent font-medium truncate mt-0.5">
                {activeMembership ? `${activeMembership.discountPercent}% Discount Active on Bookings` : 'Eligible for Happy Hour Perks & Member Discounts'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-heading font-bold uppercase tracking-wider shrink-0 group-hover:bg-amber-500/20 transition-colors">
            <span className="hidden sm:inline">Member Details</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>

      {/* ─── Metric Cards (Total Sessions & Hours Logged) ─────────── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-5">
        <Card glass className="p-4 sm:p-5 border-ds-border">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
              Total Sessions
            </span>
            <Gamepad2 className="w-4 h-4 sm:w-5 sm:h-5 text-ds-accent" />
          </div>
          <div className="text-2xl sm:text-3xl font-heading font-black text-ds-text mt-2 sm:mt-3">
            {bookings.length}
          </div>
          <span className="text-[10px] sm:text-[11px] text-emerald-400 font-medium block mt-1 truncate">
            Active Syndicate Member
          </span>
        </Card>

        <Card glass className="p-4 sm:p-5 border-ds-border">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
              Hours Logged
            </span>
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-ds-ice" />
          </div>
          <div className="text-2xl sm:text-3xl font-heading font-black text-ds-text mt-2 sm:mt-3">
            {bookings.reduce((acc, b) => acc + (b.durationMinutes || 60) / 60, 0)}h
          </div>
          <span className="text-[10px] sm:text-[11px] text-ds-text-muted font-medium block mt-1 truncate">
            Arena play time
          </span>
        </Card>
      </div>

      {/* ─── Upcoming Session Hero Card ──────────────────────────── */}
      {upcomingBooking ? (
        <div className="p-4 sm:p-8 rounded-2xl bg-gradient-to-r from-ds-surface via-ds-surface to-ds-primary/20 border border-ds-accent/40 shadow-glow relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="success" size="sm">
                  Active / Upcoming Reservation
                </Badge>
                <span className="font-mono text-xs text-ds-text-dim">
                  Ref: {upcomingBooking.bookingRef}
                </span>
              </div>

              <h3 className="text-xl sm:text-3xl font-heading font-extrabold text-ds-text">
                {upcomingBooking.station?.name || 'PS5 Battle Station'}
              </h3>

              <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-ds-text-muted">
                <span className="flex items-center gap-1.5 text-ds-text font-semibold">
                  <Calendar className="w-4 h-4 text-ds-accent" />
                  {formatBookingDate(upcomingBooking.date)}
                </span>
                <span className="flex items-center gap-1.5 text-ds-text font-semibold">
                  <Clock className="w-4 h-4 text-ds-accent" />
                  {formatBookingTime(upcomingBooking.startTime)} – {formatBookingTime(upcomingBooking.endTime)} ({upcomingBooking.durationMinutes} mins)
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Button
                variant="accent"
                onClick={() => setSelectedQrBooking(upcomingBooking)}
                className="justify-center shadow-glow-sm"
              >
                <QrCode className="w-4 h-4 mr-2" />
                View Check-in QR
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Card glass className="p-5 sm:p-8 text-center border-dashed border-ds-border space-y-4">
          <Gamepad2 className="w-12 h-12 text-ds-text-dim mx-auto" />
          <h3 className="text-lg font-heading font-bold text-ds-text">
            No Upcoming Sessions Scheduled
          </h3>
          <p className="text-xs text-ds-text-muted max-w-sm mx-auto">
            Ready to jump back into action? Reserve your favorite PS5 Pro station or pool table online with instant confirmation.
          </p>
          <Link href="/booking">
            <Button variant="accent" size="sm">
              <Sparkles className="w-4 h-4 mr-1.5" /> Book A Station Now
            </Button>
          </Link>
        </Card>
      )}

      {/* ─── Quick Actions & Bookings History ─────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base sm:text-xl font-heading font-bold text-ds-text uppercase">
            Recent Reservations
          </h3>
          <Link
            href="/account/bookings"
            className="text-xs font-heading font-bold text-ds-ice hover:underline flex items-center gap-1"
          >
            <span>All Bookings</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="space-y-3">
          {bookings.slice(0, 3).map((b) => (
            <div
              key={b.id}
              className="p-4 rounded-xl bg-ds-surface/60 border border-ds-border hover:border-ds-border-light flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-heading font-bold text-ds-text text-sm sm:text-base">
                    {b.station?.name || 'Gaming Station'}
                  </span>
                  <Badge
                    variant={
                      b.status === 'CONFIRMED'
                        ? 'success'
                        : b.status === 'COMPLETED'
                        ? 'default'
                        : 'warning'
                    }
                    size="sm"
                  >
                    {b.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 text-xs text-ds-text-dim font-mono">
                  <span>{b.bookingRef}</span>
                  <span>•</span>
                  <span>{formatBookingDate(b.date)} ({formatBookingTime(b.startTime)} - {formatBookingTime(b.endTime)})</span>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4">
                <span className="font-heading font-bold text-ds-ice text-base">
                  ₹{((b.totalPricePaise || 20000) / 100).toFixed(0)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedQrBooking(b)}
                  className="text-xs"
                >
                  <QrCode className="w-3.5 h-3.5 mr-1" /> QR Pass
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Syndicate Member Details Modal ──────────────────────── */}
      {showTierModal && (
        <Modal
          isOpen={showTierModal}
          onClose={() => setShowTierModal(false)}
          title="Syndicate Membership Details"
          size="md"
        >
          <div className="space-y-5 py-2">
            {/* Tier Card Header */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-500/20 via-ds-surface to-ds-dark border-2 border-amber-500/50 shadow-xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 shadow-glow-sm">
                  <Award className="w-7 h-7" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-mono tracking-widest text-amber-400 uppercase font-bold block">
                    CURRENT MEMBER TIER
                  </span>
                  <h3 className="text-xl sm:text-2xl font-heading font-black text-ds-text uppercase truncate">
                    {activeMembership?.planNameSnapshot || activeMembership?.tierSnapshot || 'GLACIER ELITE'}
                  </h3>
                  <p className="text-xs text-ds-text-dim truncate mt-0.5">
                    Member ID: #{user?.id ? user.id.slice(0, 8).toUpperCase() : 'DS-MEMBER'}
                  </p>
                </div>
              </div>

              <Badge variant="warning" size="md" className="font-heading font-black uppercase text-xs shrink-0">
                ACTIVE
              </Badge>
            </div>

            {/* Tier Perks & Privileges */}
            <div className="space-y-3">
              <h4 className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                Active Member Privileges
              </h4>

              <div className="grid grid-cols-1 gap-2.5">
                <div className="p-3 rounded-xl bg-ds-dark/60 border border-ds-border flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-heading font-bold text-xs text-ds-text">
                      {activeMembership?.discountPercent ? `${activeMembership.discountPercent}% Automatic Booking Discount` : 'Happy Hour & Member Discounts'}
                    </p>
                    <p className="text-[11px] text-ds-text-muted mt-0.5">
                      Discount is automatically applied at checkout across PS5, PS5 Pro, and Pool table stations.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-ds-dark/60 border border-ds-border flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-ds-accent/10 text-ds-accent shrink-0 mt-0.5">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-heading font-bold text-xs text-ds-text">Priority Station Allocation</p>
                    <p className="text-[11px] text-ds-text-muted mt-0.5">
                      Enjoy high-priority queue during peak evening & weekend hours and early access to newly installed titles.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-ds-dark/60 border border-ds-border flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 shrink-0 mt-0.5">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-heading font-bold text-xs text-ds-text">Digital Venue Pass & Walk-In Rates</p>
                    <p className="text-[11px] text-ds-text-muted mt-0.5">
                      Show your registered phone number or pass QR code at the desk to unlock member rates on walk-in play.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
              <Link href="/account/membership" className="w-full sm:flex-1" onClick={() => setShowTierModal(false)}>
                <Button variant="accent" size="sm" className="w-full justify-center">
                  <span>View Full Pass & QR Card</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </Link>

              <Link href="/membership" className="w-full sm:flex-1" onClick={() => setShowTierModal(false)}>
                <Button variant="outline" size="sm" className="w-full justify-center text-xs">
                  <span>Upgrade / Browse Passes</span>
                </Button>
              </Link>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── QR Code Modal ────────────────────────────────────────── */}
      {selectedQrBooking && (
        <Modal
          isOpen={!!selectedQrBooking}
          onClose={() => setSelectedQrBooking(null)}
          title="Digital Check-in Pass"
          size="sm"
        >
          <div className="text-center space-y-4 py-2">
            <div className="p-4 bg-white rounded-2xl inline-block shadow-xl border-2 border-ds-accent">
              <div className="w-48 h-48 bg-black flex flex-col items-center justify-center p-2 rounded-lg text-white">
                <QrCode className="w-32 h-32 text-white" />
                <span className="font-mono text-[9px] text-gray-300 mt-1 truncate max-w-[180px]">
                  {selectedQrBooking.qrToken || selectedQrBooking.bookingRef}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="font-mono text-sm font-bold text-ds-text">
                {selectedQrBooking.bookingRef}
              </span>
              <p className="text-xs text-ds-text-muted">
                {selectedQrBooking.station?.name} • {formatBookingDate(selectedQrBooking.date)}
              </p>
              <p className="text-[11px] text-ds-text-dim">
                Slot: {formatBookingTime(selectedQrBooking.startTime)} – {formatBookingTime(selectedQrBooking.endTime)}
              </p>
            </div>

            <p className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 p-2 rounded-lg">
              Show this QR code to staff at the venue desk to start your session.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
