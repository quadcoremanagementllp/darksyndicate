'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  CreditCard,
  Banknote,
  Sparkles,
  Layers,
  CheckCircle2,
  Clock,
  Maximize2,
  AlertCircle,
  Gamepad2,
  User,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { QrPaymentModal } from '@/components/staff/QrPaymentModal';
import { calculateSessionCheckout } from '@/lib/sessionCheckout';

interface SettlePendingPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: any | null;
  onSuccess: () => void;
}

export function SettlePendingPaymentModal({
  isOpen,
  onClose,
  booking,
  onSuccess,
}: SettlePendingPaymentModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [settleMethod, setSettleMethod] = useState<'CASH' | 'UPI' | 'SPLIT'>('CASH');
  const [splitCash, setSplitCash] = useState('');
  const [splitUpi, setSplitUpi] = useState('');
  const [cashTendered, setCashTendered] = useState('');
  const [showQrPopup, setShowQrPopup] = useState(false);
  const [priceMode, setPriceMode] = useState<'standard' | 'discount' | 'offered'>('standard');
  const [priceInput, setPriceInput] = useState('');
  const toast = useToast();

  const originalPricePaise = booking?.totalPricePaise || 0;
  const alreadyPaidPaise = 0; // For pending bookings, balance is due

  const priorTabs = booking?.priorPendingTabs || [];
  const priorTabsPaise =
    booking?.priorUnpaidPaise !== undefined
      ? booking.priorUnpaidPaise
      : priorTabs.reduce((sum: number, t: any) => sum + t.amountPaise, 0);

  const validPriceInput = /^\d+(?:\.\d{1,2})?$/.test(priceInput.trim());
  const enteredPaise = validPriceInput ? Math.round(Number(priceInput) * 100) : null;
  let priceError = '';
  let checkout = calculateSessionCheckout(originalPricePaise, alreadyPaidPaise, {});

  if (priceMode !== 'standard') {
    if (enteredPaise === null) {
      priceError = 'Enter a valid rupee amount (up to 2 decimal places).';
    } else {
      try {
        checkout = calculateSessionCheckout(
          originalPricePaise,
          alreadyPaidPaise,
          priceMode === 'discount' ? { discountPaise: enteredPaise } : { finalPricePaise: enteredPaise }
        );
      } catch (error) {
        priceError = error instanceof Error ? error.message : 'Invalid price';
      }
    }
  }

  const totalCollectPaise = checkout.duePaise + priorTabsPaise;
  const totalCollectRupees = totalCollectPaise / 100;

  const cashTenderedNum = parseFloat(cashTendered) || 0;
  const splitCashNum = parseFloat(splitCash) || 0;
  const splitUpiNum = parseFloat(splitUpi) || 0;
  const splitTotal = Math.round((splitCashNum + splitUpiNum) * 100) / 100;
  const splitDifference = Math.round((totalCollectRupees - splitTotal) * 100) / 100;
  const isSplitValid =
    settleMethod === 'SPLIT'
      ? Math.abs(splitDifference) < 0.01 && splitCashNum > 0 && splitUpiNum > 0
      : true;

  const cashPortion = settleMethod === 'SPLIT' ? splitCashNum : totalCollectRupees;
  const changeDue = Math.max(0, cashTenderedNum - cashPortion);

  const handleSelectSplit = () => {
    setSettleMethod('SPLIT');
    if (!splitCash && !splitUpi && totalCollectRupees > 0) {
      const half = Math.floor(totalCollectRupees / 2);
      setSplitCash(half.toString());
      setSplitUpi((totalCollectRupees - half).toString());
    }
  };

  const handleSplitCashChange = (val: string) => {
    setSplitCash(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0 && num <= totalCollectRupees) {
      setSplitUpi(String(Math.round((totalCollectRupees - num) * 100) / 100));
    }
  };

  const handleSplitUpiChange = (val: string) => {
    setSplitUpi(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0 && num <= totalCollectRupees) {
      setSplitCash(String(Math.round((totalCollectRupees - num) * 100) / 100));
    }
  };

  useEffect(() => {
    if (isOpen && booking) {
      setCashTendered('');
      setSettleMethod('CASH');
      setSplitCash('');
      setSplitUpi('');
      setShowQrPopup(false);
      setPriceMode('standard');
      setPriceInput('');
    }
  }, [isOpen, booking?.id]);

  if (!isOpen || !booking) return null;

  const handleConfirmSettle = async () => {
    if (priceError) return toast.error(priceError);
    if (settleMethod === 'SPLIT' && !isSplitValid) {
      return toast.error('Split amounts must match the total bill amount.');
    }

    setSubmitting(true);
    try {
      const additionalBookingIds = priorTabs.map((t: any) => t.bookingId).filter(Boolean);
      const res = await fetch('/api/staff/payments/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          settlePaymentMethod: settleMethod,
          splitCashPaise: settleMethod === 'SPLIT' ? Math.round(splitCashNum * 100) : undefined,
          splitUpiPaise: settleMethod === 'SPLIT' ? Math.round(splitUpiNum * 100) : undefined,
          settleAdditionalBookingIds: additionalBookingIds.length > 0 ? additionalBookingIds : undefined,
          ...(priceMode === 'discount' ? { discountPaise: enteredPaise } :
            priceMode === 'offered' ? { finalPricePaise: enteredPaise } : {}),
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(
          json.data?.message ||
            `Payment of ₹${totalCollectRupees} settled successfully for ${booking.customerName || booking.bookingRef}.`
        );
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('ds-booking-updated'));
        }
        onSuccess();
        onClose();
      } else {
        toast.error(json.error?.message || 'Failed to complete payment.');
      }
    } catch {
      toast.error('Network error settling payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Complete Pending Payment"
      size="md"
    >
      <div className="space-y-4">
        {/* Customer & Station Dossier Banner */}
        <div className="p-3.5 rounded-xl bg-ds-dark/90 border border-ds-border space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-mono text-ds-text-dim block">Station</span>
              <h3 className="text-base font-heading font-black text-white truncate">
                {booking.stationName}
              </h3>
            </div>
            <span className="font-mono text-xs font-bold text-ds-ice bg-ds-surface px-2.5 py-1 rounded-lg border border-ds-border shrink-0 select-all">
              {booking.bookingRef}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-ds-border/50 text-xs">
            <div>
              <span className="text-[10px] font-mono text-ds-text-dim uppercase block">Gamer / Customer</span>
              <p className="font-heading font-bold text-ds-text truncate">{booking.customerName}</p>
              <p className="text-[11px] font-mono text-ds-text-dim truncate">{booking.customerPhone || 'Walk-in'}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-mono text-ds-text-dim uppercase block">Played Time</span>
              <p className="font-mono text-xs text-ds-text font-semibold">
                {booking.startTime ? new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'} –{' '}
                {booking.endTime ? new Date(booking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
              </p>
              <p className="text-[10px] font-mono text-ds-text-dim">
                {booking.durationMinutes ? `${booking.durationMinutes} mins` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Price Adjustment Controls */}
        <div className="rounded-xl bg-ds-dark/70 border border-ds-border p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-ds-text-dim font-mono uppercase text-[10px]">Price Mode:</span>
            <div className="flex items-center gap-1">
              {(['standard', 'discount', 'offered'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setPriceMode(mode);
                    setPriceInput('');
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-heading font-bold uppercase transition-all ${
                    priceMode === mode
                      ? 'bg-ds-accent text-white shadow-sm'
                      : 'text-ds-text-dim hover:text-white hover:bg-ds-surface'
                  }`}
                >
                  {mode === 'standard' ? 'Standard' : mode === 'discount' ? 'Discount' : 'Edit price'}
                </button>
              ))}
            </div>
          </div>

          {priceMode !== 'standard' && (
            <div className="pt-2 border-t border-ds-border/40 space-y-1">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={priceMode === 'discount' ? 'Discount (₹)' : 'Offered price (₹)'}
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  className="w-full bg-ds-dark border border-ds-border rounded-lg px-3 py-1.5 text-xs text-ds-text font-mono focus:border-ds-accent focus:outline-none"
                />
              </div>
              {priceError && <p className="text-[11px] text-rose-400 font-mono">{priceError}</p>}
            </div>
          )}
        </div>

        {/* Desk Payment Collection Card */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-transparent border-2 border-amber-500/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-300 font-heading font-black text-xs uppercase tracking-wider">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Collect Pending Payment</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full font-mono text-xs font-black bg-amber-500 text-black shadow-sm">
              Total Due: ₹{totalCollectRupees}
            </span>
          </div>

          {priorTabs.length > 0 && (
            <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 space-y-2 text-cyan-200">
              <div className="flex items-center justify-between text-xs font-heading font-black text-cyan-300 pb-1 border-b border-cyan-500/20">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Itemized Multi-Game Open Tab</span>
                </span>
                <Badge variant="accent" size="sm" className="font-mono text-[10px]">
                  {priorTabs.length + 1} Games Combined
                </Badge>
              </div>
              <div className="space-y-1 text-xs">
                {priorTabs.map((pt: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-0.5 text-[11px] text-cyan-100">
                    <span>{pt.stationType === 'POOL_TABLE' ? '🎱' : '🎮'} {pt.stationName} (Transferred Tab)</span>
                    <span className="font-mono font-bold text-white">₹{(pt.amountPaise / 100).toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between py-0.5 text-[11px] text-emerald-300">
                  <span>{booking.stationType === 'POOL_TABLE' ? '🎱' : '🎮'} {booking.stationName} (Current Session)</span>
                  <span className="font-mono font-bold text-white">₹{(checkout.duePaise / 100).toFixed(2)}</span>
                </div>
              </div>
              <div className="pt-1.5 border-t border-cyan-500/30 flex items-center justify-between font-heading font-black text-amber-300 text-sm">
                <span>Combined Bill:</span>
                <span className="font-mono text-base text-white">₹{totalCollectRupees}</span>
              </div>
            </div>
          )}

          {/* Settle Method Selector (Cash, UPI, Split only — NO Pending option) */}
          <div className="pt-2 border-t border-amber-500/30 space-y-2">
            <span className="text-[11px] font-heading font-bold uppercase tracking-wider text-amber-200 block">
              How is customer paying at desk?
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSettleMethod('CASH')}
                className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 transition-all font-heading font-bold text-xs ${
                  settleMethod === 'CASH'
                    ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-sm ring-1 ring-emerald-400'
                    : 'bg-black/40 border-white/10 text-white/60 hover:text-white'
                }`}
              >
                <Banknote className="w-4 h-4 text-emerald-400" />
                <span>Cash Desk</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettleMethod('UPI');
                  if (totalCollectRupees > 0) {
                    setShowQrPopup(true);
                  }
                }}
                className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 transition-all font-heading font-bold text-xs ${
                  settleMethod === 'UPI'
                    ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-sm ring-1 ring-cyan-400'
                    : 'bg-black/40 border-white/10 text-white/60 hover:text-white'
                }`}
              >
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>UPI / GPay</span>
              </button>
              <button
                type="button"
                onClick={handleSelectSplit}
                className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 transition-all font-heading font-bold text-xs ${
                  settleMethod === 'SPLIT'
                    ? 'bg-amber-500/20 border-amber-400 text-white shadow-sm ring-1 ring-amber-400'
                    : 'bg-black/40 border-white/10 text-white/60 hover:text-white'
                }`}
              >
                <Layers className="w-4 h-4 text-amber-400" />
                <span>Split (Both)</span>
              </button>
            </div>

            {/* Split Payment Distribution Inputs */}
            {settleMethod === 'SPLIT' && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3 animate-in fade-in duration-200 mt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-amber-300 font-heading font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>Split Distribution</span>
                  </span>
                  <span className={`text-[11px] font-mono font-bold ${isSplitValid ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isSplitValid
                      ? '✓ Balanced'
                      : splitDifference > 0
                      ? `₹${splitDifference} remaining`
                      : `₹${Math.abs(splitDifference)} extra`}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-mono text-emerald-400 font-semibold flex items-center gap-1">
                      <Banknote className="w-3 h-3" />
                      Cash Portion (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={totalCollectRupees}
                      placeholder="0"
                      value={splitCash}
                      onChange={(e) => handleSplitCashChange(e.target.value)}
                      className="w-full bg-ds-dark border border-ds-border rounded-lg px-3 py-2 text-sm text-ds-text font-mono focus:border-emerald-400 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-cyan-400 font-semibold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        UPI / GPay (₹)
                      </span>
                      {splitUpiNum > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowQrPopup(true)}
                          className="text-[10px] text-cyan-400 underline hover:text-cyan-300 cursor-pointer font-bold"
                        >
                          Show QR (₹{splitUpiNum})
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={totalCollectRupees}
                      placeholder="0"
                      value={splitUpi}
                      onChange={(e) => handleSplitUpiChange(e.target.value)}
                      className="w-full bg-ds-dark border border-ds-border rounded-lg px-3 py-2 text-sm text-ds-text font-mono focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Cash Change Helper */}
            {settleMethod === 'CASH' && (
              <div className="p-2.5 rounded-xl bg-black/50 border border-white/10 space-y-2 mt-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-ds-text-dim uppercase font-mono">Cash Change Helper:</span>
                  {cashTenderedNum >= totalCollectRupees && cashTenderedNum > 0 && (
                    <Badge variant="success" size="sm" className="font-mono text-[10px] animate-in zoom-in-75">
                      Change to return: ₹{changeDue}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="₹ Cash Received"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    className="w-full bg-ds-dark border border-ds-border rounded-lg px-2.5 py-1.5 text-xs text-ds-text font-mono focus:border-emerald-400 focus:outline-none"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setCashTendered(totalCollectRupees.toString())}
                      className="px-2 py-1 text-[10px] font-mono font-bold rounded bg-ds-surface border border-ds-border hover:border-emerald-500 text-emerald-400"
                    >
                      Exact
                    </button>
                    <button
                      type="button"
                      onClick={() => setCashTendered('500')}
                      className="px-2 py-1 text-[10px] font-mono font-bold rounded bg-ds-surface border border-ds-border hover:border-emerald-500 text-white"
                    >
                      ₹500
                    </button>
                  </div>
                </div>
              </div>
            )}

            {settleMethod === 'UPI' && (
              <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-xs text-ds-text-dim flex items-center justify-between gap-2 mt-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="truncate">Scan counter UPI QR to collect ₹{totalCollectRupees}.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQrPopup(true)}
                  className="text-[10px] font-mono font-bold text-cyan-300 hover:text-white bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 px-2 py-0.5 rounded-lg flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-sm"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>Popup QR</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Operational Consequences Notice */}
        <div className="rounded-xl bg-ds-surface/50 border border-ds-border p-3.5 space-y-2 text-xs">
          <span className="text-[11px] font-heading font-bold uppercase tracking-wider text-ds-text-dim block">
            What happens when you confirm:
          </span>
          <div className="space-y-1.5 text-ds-text-muted text-[11px]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                Payment of <strong className="text-white">₹{totalCollectRupees}</strong> will be marked as <strong className="text-emerald-400">COMPLETED</strong>.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                Payment method stored in Admin Panel as <strong className="text-cyan-300 font-mono font-bold">{settleMethod}</strong>.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Booking will be cleared from the Pending section.</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-ds-border/60">
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
            onClick={handleConfirmSettle}
            disabled={submitting || Boolean(priceError) || (settleMethod === 'SPLIT' && !isSplitValid)}
            className="text-xs sm:text-sm font-bold flex items-center gap-1.5 py-1.5 sm:py-2 px-3.5 sm:px-4 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>
              {submitting
                ? 'Processing...'
                : settleMethod === 'SPLIT'
                ? `Collect ₹${splitCashNum} Cash + ₹${splitUpiNum} UPI & Complete`
                : `Collect ₹${totalCollectRupees} & Complete Payment`}
            </span>
          </Button>
        </div>
      </div>

      <QrPaymentModal
        isOpen={showQrPopup}
        onClose={() => setShowQrPopup(false)}
        amountRupees={settleMethod === 'SPLIT' ? splitUpiNum : totalCollectRupees}
        customerName={booking.customerName}
        stationName={booking.stationName}
        bookingRef={booking.bookingRef}
        onPaymentVerified={() => {
          setShowQrPopup(false);
          toast.success(`Exit payment verified for ${booking.customerName}`);
        }}
      />
    </Modal>
  );
}
