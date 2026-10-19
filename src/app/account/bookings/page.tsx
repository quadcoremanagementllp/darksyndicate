'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  QrCode,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { formatBookingDate, formatBookingTime } from '@/lib/utils';

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [loading, setLoading] = useState(true);
  const [selectedQr, setSelectedQr] = useState<any | null>(null);
  const [cancellingBooking, setCancellingBooking] = useState<any | null>(null);
  const [isProcessingCancel, setIsProcessingCancel] = useState(false);
  const { toast } = useToast();

  const loadBookings = async () => {
    try {
      const res = await fetch('/api/customer/bookings');
      const json = await res.json();
      if (json.success) {
        setBookings(json.data);
      }
    } catch (err) {
      console.error('Error fetching bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const handleCancel = async () => {
    if (!cancellingBooking) return;
    setIsProcessingCancel(true);
    try {
      const res = await fetch(`/api/customer/bookings/${cancellingBooking.id}/cancel`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to cancel booking');
      }

      toast(json.data.message || 'Booking cancelled successfully', 'success');
      setCancellingBooking(null);
      await loadBookings();
    } catch (err: any) {
      toast(err.message || 'Error processing cancellation', 'error');
    } finally {
      setIsProcessingCancel(false);
    }
  };

  const filteredBookings = bookings.filter((b) => {
    if (filter === 'ALL') return true;
    if (filter === 'UPCOMING') return ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'PENDING'].includes(b.status);
    if (filter === 'COMPLETED') return b.status === 'COMPLETED';
    if (filter === 'CANCELLED') return b.status === 'CANCELLED';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-ds-text uppercase">
            MY <span className="gradient-text">BOOKINGS & PASSES</span>
          </h2>
          <p className="text-xs text-ds-text-muted mt-0.5">
            Manage your gaming sessions and access digital QR codes for venue check-in.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-ds-surface border border-ds-border overflow-x-auto no-scrollbar">
          {(['ALL', 'UPCOMING', 'COMPLETED', 'CANCELLED'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold uppercase transition-all shrink-0 whitespace-nowrap ${
                filter === tab
                  ? 'bg-ds-accent text-ds-dark shadow-glow-sm'
                  : 'text-ds-text-muted hover:text-ds-text'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Bookings List */}
      {filteredBookings.length > 0 ? (
        <div className="space-y-4">
          {filteredBookings.map((booking) => (
            <Card
              key={booking.id}
              glass
              className="p-4 sm:p-6 border-ds-border hover:border-ds-border-light transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-ds-border/60">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-ds-ice bg-ds-dark/80 px-2.5 py-1 rounded border border-ds-border">
                    {booking.bookingRef}
                  </span>
                  <Badge
                    variant={
                      booking.status === 'CONFIRMED'
                        ? 'success'
                        : booking.status === 'COMPLETED'
                        ? 'default'
                        : booking.status === 'CANCELLED'
                        ? 'danger'
                        : 'warning'
                    }
                    size="sm"
                  >
                    {booking.status}
                  </Badge>
                </div>

                <div className="text-right">
                  <span className="text-lg font-heading font-bold text-ds-ice">
                    ₹{((booking.totalPricePaise || 20000) / 100).toFixed(0)}
                  </span>
                  <span className="text-xs text-ds-text-dim block">
                    {booking.payment?.method || 'UPI'} • {booking.payment?.status || 'PAID'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-xs">
                <div>
                  <span className="text-ds-text-dim block font-heading uppercase text-[10px]">
                    Gaming Station
                  </span>
                  <p className="font-bold text-ds-text text-sm mt-0.5">
                    {booking.station?.name || 'PS5 Battle Station'}
                  </p>
                  <p className="text-ds-text-muted text-[11px]">
                    {booking.station?.facility?.name || 'PlayStation 5 Arena'}
                  </p>
                </div>

                <div>
                  <span className="text-ds-text-dim block font-heading uppercase text-[10px]">
                    Scheduled Date
                  </span>
                  <p className="font-bold text-ds-text text-sm mt-0.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-ds-accent" />
                    {formatBookingDate(booking.date)}
                  </p>
                </div>

                <div>
                  <span className="text-ds-text-dim block font-heading uppercase text-[10px]">
                    Session Time & Duration
                  </span>
                  <p className="font-bold text-ds-text text-sm mt-0.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-ds-accent" />
                    {formatBookingTime(booking.startTime)} – {formatBookingTime(booking.endTime)} ({booking.durationMinutes} mins)
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="accent"
                    size="sm"
                    onClick={() => setSelectedQr(booking)}
                    disabled={booking.status === 'CANCELLED'}
                  >
                    <QrCode className="w-4 h-4 mr-1.5" />
                    Show Check-in Pass
                  </Button>
                </div>

                {['CONFIRMED', 'PENDING'].includes(booking.status) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCancellingBooking(booking)}
                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs"
                  >
                    Cancel Session
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card glass className="p-12 text-center border-dashed border-ds-border space-y-4">
          <Calendar className="w-12 h-12 text-ds-text-dim mx-auto" />
          <h3 className="text-lg font-heading font-bold text-ds-text">
            No Bookings Found Under "{filter}"
          </h3>
          <p className="text-xs text-ds-text-muted max-w-sm mx-auto">
            Ready to hit the arena? Secure your next gaming session with a few clicks.
          </p>
          <Link href="/booking">
            <Button variant="accent" size="sm">
              <Sparkles className="w-4 h-4 mr-1.5" /> Book A Session
            </Button>
          </Link>
        </Card>
      )}

      {/* QR Code Pass Modal */}
      {selectedQr && (
        <Modal
          isOpen={!!selectedQr}
          onClose={() => setSelectedQr(null)}
          title="Digital Venue Pass"
          size="sm"
        >
          <div className="text-center space-y-4 py-2">
            <div className="p-4 bg-white rounded-2xl inline-block shadow-2xl border-2 border-ds-accent">
              <div className="w-48 h-48 bg-black flex flex-col items-center justify-center p-2 rounded-lg text-white">
                <QrCode className="w-32 h-32 text-white" />
                <span className="font-mono text-[9px] text-gray-300 mt-1 truncate max-w-[180px]">
                  {selectedQr.qrToken || selectedQr.bookingRef}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="font-mono text-base font-bold text-ds-text">
                {selectedQr.bookingRef}
              </span>
              <p className="text-xs text-ds-text-muted">
                {selectedQr.station?.name} • {formatBookingDate(selectedQr.date)}
              </p>
              <p className="text-xs text-ds-ice font-semibold">
                Slot: {formatBookingTime(selectedQr.startTime)} – {formatBookingTime(selectedQr.endTime)}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-ds-surface border border-ds-border text-xs text-ds-text-muted leading-relaxed">
              Show this QR code at the check-in desk upon arrival. Our team will verify and start your gaming session authoritatively.
            </div>
          </div>
        </Modal>
      )}

      {/* Cancellation Confirmation Modal */}
      {cancellingBooking && (
        <Modal
          isOpen={!!cancellingBooking}
          onClose={() => setCancellingBooking(null)}
          title="Confirm Session Cancellation"
          size="md"
        >
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs leading-relaxed">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <p className="font-bold">Cancellation Policy Notice</p>
                <p className="mt-1">
                  Cancellations initiated at least 2 hours prior to the session start time are eligible for a 100% refund to the original payment source.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-ds-dark border border-ds-border text-xs space-y-1">
              <p className="text-ds-text-muted">Booking Reference: <span className="font-mono font-bold text-ds-text">{cancellingBooking.bookingRef}</span></p>
              <p className="text-ds-text-muted">Station: <span className="text-ds-text font-bold">{cancellingBooking.station?.name}</span></p>
              <p className="text-ds-text-muted">Timing: <span className="text-ds-text font-bold">{formatBookingDate(cancellingBooking.date)} ({formatBookingTime(cancellingBooking.startTime)} – {formatBookingTime(cancellingBooking.endTime)})</span></p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancellingBooking(null)}
                disabled={isProcessingCancel}
              >
                Keep Booking
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleCancel}
                disabled={isProcessingCancel}
              >
                {isProcessingCancel ? 'Processing...' : 'Confirm Cancellation'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
