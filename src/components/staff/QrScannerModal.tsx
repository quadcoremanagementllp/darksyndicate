'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { QrCode, Search, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckInSuccess: () => void;
}

export function QrScannerModal({ isOpen, onClose, onCheckInSuccess }: QrScannerModalProps) {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifiedBooking, setVerifiedBooking] = useState<any | null>(null);
  const toast = useToast();

  const handleLookup = async (idToSearch?: string) => {
    const query = (idToSearch || identifier).trim();
    if (!query) {
      toast.error('Please enter a booking reference or QR token');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${query}`);
      const json = await res.json();
      if (json.success && json.data) {
        setVerifiedBooking(json.data);
      } else {
        toast.error(json.error?.message || 'No reservation found');
        setVerifiedBooking(null);
      }
    } catch {
      toast.error('Failed to lookup reservation');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCheckIn = async () => {
    if (!verifiedBooking) return;
    setLoading(true);

    try {
      const res = await fetch('/api/staff/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: verifiedBooking.bookingRef || verifiedBooking.id,
          autoStartSession: true,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`Check-in successful! Console on ${verifiedBooking.station?.name || 'station'} unlocked.`);
        onCheckInSuccess();
        handleClose();
      } else {
        toast.error(json.error?.message || 'Check-in failed');
      }
    } catch {
      toast.error('Error during check-in');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIdentifier('');
    setVerifiedBooking(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Turnstile & Desk Pass Scanner">
      <div className="space-y-6">
        {/* Scanner / Reference Input */}
        <div className="space-y-2">
          <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
            Scan QR Code or Enter Booking Reference
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                placeholder="e.g. DS-2026-9041 or token"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                className="font-mono text-sm uppercase pl-9"
              />
              <QrCode className="w-4 h-4 text-ds-accent absolute left-3 top-3" />
            </div>
            <Button variant="accent" onClick={() => handleLookup()} disabled={loading}>
              <Search className="w-4 h-4 mr-1" />
              <span>Lookup</span>
            </Button>
          </div>
          <div className="flex gap-2 pt-1 text-[11px] text-ds-text-dim">
            <span>Quick test:</span>
            <button
              type="button"
              onClick={() => {
                setIdentifier('DS-2026-9041');
                handleLookup('DS-2026-9041');
              }}
              className="text-ds-ice hover:underline font-mono"
            >
              DS-2026-9041
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => {
                setIdentifier('DS-2026-8812');
                handleLookup('DS-2026-8812');
              }}
              className="text-ds-ice hover:underline font-mono"
            >
              DS-2026-8812
            </button>
          </div>
        </div>

        {/* Verified Pass Result Card */}
        {verifiedBooking && (
          <div className="p-5 rounded-2xl bg-ds-dark border border-ds-accent/40 space-y-4">
            <div className="flex items-center justify-between border-b border-ds-border/60 pb-3">
              <div>
                <span className="text-[10px] uppercase font-mono text-ds-text-dim block">Verified Pass</span>
                <h4 className="text-base font-heading font-bold text-ds-text">
                  {verifiedBooking.customerName || 'Gamer'}
                </h4>
              </div>
              <Badge variant={verifiedBooking.status === 'CONFIRMED' ? 'success' : 'warning'}>
                {verifiedBooking.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase text-ds-text-dim block">Station</span>
                <p className="font-heading font-bold text-ds-text">
                  {verifiedBooking.station?.name || 'PS5 Battle Station Alpha'}
                </p>
                <p className="text-[11px] text-ds-accent">
                  {verifiedBooking.station?.facility?.name || 'PlayStation 5 Pro Arena'}
                </p>
              </div>

              <div>
                <span className="text-[10px] uppercase text-ds-text-dim block">Duration</span>
                <p className="font-heading font-bold text-ds-text">
                  {verifiedBooking.durationMinutes / 60} Hour{verifiedBooking.durationMinutes > 60 ? 's' : ''}
                </p>
                <p className="text-[11px] text-ds-text-dim">
                  ₹{(verifiedBooking.totalPricePaise / 100).toFixed(0)} Total
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-ds-border/40 flex justify-between items-center text-xs text-ds-text-dim">
              <span>Ref: <strong className="text-ds-ice font-mono">{verifiedBooking.bookingRef}</strong></span>
              <span>Phone: {verifiedBooking.customerPhone || '—'}</span>
            </div>

            <Button
              variant="accent"
              onClick={handleConfirmCheckIn}
              disabled={loading}
              className="w-full justify-center py-2.5 mt-2"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              <span>Confirm Check-in & Unlock Console</span>
            </Button>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
