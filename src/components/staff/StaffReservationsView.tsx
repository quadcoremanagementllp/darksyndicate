'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarDays, ExternalLink, Trash2 } from 'lucide-react';
import { StaffPreBookingModal } from '@/components/staff/StaffPreBookingModal';
import { useToast } from '@/components/ui/Toast';

type Reservation = {
  id: string;
  bookingRef: string;
  customerName: string;
  customerPhone: string | null;
  stationName: string;
  facilityName: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  totalPricePaise: number;
  paymentStatus: string;
  creatorName: string;
  canDelete: boolean;
};

type Station = {
  id: string;
  name: string;
  stationType: string;
  facilityName: string;
  pricePerHourPaise: number;
  status: string;
};

const dateTime = (value: string) => new Date(value).toLocaleString('en-IN', {
  timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric',
  hour: 'numeric', minute: '2-digit', hour12: true,
});

export function StaffReservationsView() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const toast = useToast();
  const notifyError = toast.error;

  const loadReservations = useCallback(async () => {
    try {
      const response = await fetch('/api/staff/reservations');
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error?.message || 'Could not load reservations');
      setReservations(json.data);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Could not load reservations');
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadReservations();
      void fetch('/api/staff/overview').then((response) => response.json()).then((json) => {
        if (json.success) setStations(json.data?.stations || []);
      }).catch(() => {});
    }, 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadReservations]);

  const deleteReservation = async (reservation: Reservation) => {
    if (!window.confirm(`Delete reservation ${reservation.bookingRef} for ${reservation.customerName}?`)) return;
    setDeletingId(reservation.id);
    try {
      const response = await fetch('/api/staff/reservations', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: reservation.id }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error?.message || 'Could not delete reservation');
      setReservations((current) => current.filter((item) => item.id !== reservation.id));
      toast.success(json.data.paymentRefundRequired ? 'Reservation removed. Review the payment for a refund.' : 'Reservation removed.');
      window.dispatchEvent(new Event('ds-booking-updated'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete reservation');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-2xl sm:text-3xl font-black uppercase text-white">Reservations</h1>
        <span className="rounded-full border border-ds-accent/30 bg-ds-accent/10 px-3 py-1 font-mono text-xs font-bold text-ds-ice">
          {reservations.length} Confirmed
        </span>
      </div>

      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="w-full max-w-sm p-5 rounded-3xl border-2 border-ds-border hover:border-amber-400 bg-ds-surface/30 hover:bg-amber-950/20 text-left transition-all group space-y-5"
      >
        <div className="flex items-center justify-between">
          <span className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-400/30 text-amber-400 flex items-center justify-center">
            <CalendarDays className="w-6 h-6" />
          </span>
          <span className="rounded-full px-3 py-1 text-[10px] font-mono font-bold uppercase text-amber-300 border border-amber-500/30 bg-amber-500/10">Reserve Ahead</span>
        </div>
        <h2 className="font-heading text-lg font-black uppercase text-white">Book Upcoming Slot</h2>
        <div className="pt-3 border-t border-ds-border/60 flex items-center justify-between text-xs font-heading font-bold uppercase text-amber-400">
          <span>Advance Reservation</span><ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </button>

      <section className="space-y-3" aria-label="Confirmed staff reservations">
        <h2 className="font-heading text-lg font-bold uppercase text-white">Confirmed Reservations</h2>
        {loading ? <p className="text-sm text-ds-text-muted">Loading reservations...</p> : reservations.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ds-border p-8 text-sm text-ds-text-muted">No confirmed staff reservations found.</p>
        ) : reservations.map((reservation) => (
          <div key={reservation.id} className="rounded-2xl border border-ds-border bg-ds-surface/40 p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-heading text-base font-bold text-white">{reservation.stationName}</p>
              <p className="text-xs text-ds-accent">{reservation.facilityName} · {reservation.bookingRef}</p>
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold text-white">{reservation.customerName}</p>
              <p className="text-xs text-ds-text-muted">{reservation.customerPhone || 'No phone'} · Booked by {reservation.creatorName}</p>
            </div>
            <div className="min-w-0 flex-1 text-xs font-mono text-ds-text-muted">
              <p className="text-ds-ice">{dateTime(reservation.startTime)}</p>
              <p>{reservation.durationMinutes} min · Until {dateTime(reservation.endTime)}</p>
            </div>
            <div className="xl:text-right text-sm">
              <p className="font-bold text-white">₹{(reservation.totalPricePaise / 100).toFixed(0)}</p>
              <p className="text-xs text-ds-text-muted">{reservation.paymentStatus}</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/booking/confirmation/${reservation.bookingRef}`} target="_blank" aria-label={`View pass for ${reservation.bookingRef}`} className="rounded-xl border border-ds-border p-2.5 text-ds-ice hover:border-ds-accent">
                <ExternalLink className="h-4 w-4" />
              </Link>
              {reservation.canDelete && <button type="button" onClick={() => void deleteReservation(reservation)} disabled={deletingId === reservation.id} className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50">
                <Trash2 className="h-4 w-4" /> {deletingId === reservation.id ? 'Deleting...' : 'Delete'}
              </button>}
            </div>
          </div>
        ))}
      </section>

      <StaffPreBookingModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        stations={stations}
        onBookingCreated={() => {
          void loadReservations();
          window.dispatchEvent(new Event('ds-booking-updated'));
        }}
      />
    </div>
  );
}
