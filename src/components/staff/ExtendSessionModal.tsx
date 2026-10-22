'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Clock,
  Banknote,
  Sparkles,
  CreditCard,
  QrCode,
  Copy,
  Check,
  Gamepad2,
  CheckCircle2,
  Receipt,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useToast } from '@/components/ui/Toast';
import { QrPaymentModal } from '@/components/staff/QrPaymentModal';

interface Station {
  id: string;
  name: string;
  pricePerHourPaise: number;
  activeSession?: {
    id: string;
    bookingId?: string;
    customerName: string;
    bookingRef?: string;
    scheduledEndAt: string;
    gameTitle?: string | null;
    paymentStatus?: string;
    paymentMethod?: string;
    totalPricePaise?: number;
    unpaidPaise?: number;
    paidPaise?: number;
    isPayOnExit?: boolean;
  } | null;
}

interface ExtendSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  station: Station | null;
  onSuccess: () => void;
}

export function ExtendSessionModal({
  isOpen,
  onClose,
  station,
  onSuccess,
}: ExtendSessionModalProps) {
  const [additionalMinutes, setAdditionalMinutes] = useState<number>(30);
  const [paymentTiming, setPaymentTiming] = useState<'PAY_ON_EXIT' | 'PRE_PAID'>('PAY_ON_EXIT');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD'>('CASH');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [showQrPopup, setShowQrPopup] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const toast = useToast();

  // Admin QR & UPI Details
  const [adminQrUrl, setAdminQrUrl] = useState<string>('');
  const [upiId, setUpiId] = useState<string>('darksyndicate@icici');
  const [upiPayeeName, setUpiPayeeName] = useState<string>('Dark Syndicate Gaming World');
  const [dynamicQrUrl, setDynamicQrUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

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

  const hourlyRate = station?.pricePerHourPaise || 15000;
  const extensionFeePaise = Math.round(hourlyRate * (additionalMinutes / 60));
  const extensionFeeRupees = Math.round(extensionFeePaise / 100);
  const stationName = station?.name || 'Console';

  // Determine whether current active session is on an Open Tab (Pay on Exit)
  const isExistingPayOnExit = Boolean(
    station?.activeSession?.isPayOnExit ||
    station?.activeSession?.paymentStatus === 'PENDING'
  );

  // Initialize defaults whenever modal opens for a station
  useEffect(() => {
    if (isOpen && station?.activeSession) {
      if (isExistingPayOnExit) {
        setPaymentTiming('PAY_ON_EXIT');
      } else {
        setPaymentTiming('PRE_PAID');
      }
      setPaymentMethod('CASH');
      setCashTendered('');
      setShowQrPopup(false);
    }
  }, [isOpen, station?.id, station?.activeSession?.id, isExistingPayOnExit]);

  // Generate dynamic QR fallback if admin has not uploaded a static QR image
  useEffect(() => {
    if (paymentTiming === 'PRE_PAID' && paymentMethod === 'UPI' && !adminQrUrl && station) {
      const amount = extensionFeeRupees.toFixed(2);
      const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiPayeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Extension ${stationName}`)}`;
      QRCode.toDataURL(upiUrl, {
        width: 220,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      })
        .then((url) => setDynamicQrUrl(url))
        .catch(() => {});
    }
  }, [paymentTiming, paymentMethod, adminQrUrl, upiId, upiPayeeName, extensionFeeRupees, stationName, station]);

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopied(true);
    toast.success('UPI ID copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectPaymentMethod = (method: 'CASH' | 'UPI' | 'CARD') => {
    setPaymentMethod(method);
    if (method === 'UPI') {
      setShowQrPopup(true);
    }
  };

  const handleExtend = async () => {
    if (!station) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/staff/sessions/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: station.activeSession?.id,
          stationId: station.id,
          bookingId: station.activeSession?.bookingId,
          additionalMinutes,
          paymentTiming,
          paymentMethod: paymentTiming === 'PAY_ON_EXIT' ? 'PAY_ON_EXIT' : paymentMethod,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(json.data?.message || `Session extended by +${additionalMinutes}m successfully!`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('ds-booking-updated'));
        }
        onSuccess();
        onClose();
      } else {
        toast.error(json.error?.message || 'Could not extend session');
      }
    } catch {
      toast.error('Failed to extend session');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !station || !station.activeSession) return null;

  const currentEndRaw = station.activeSession.scheduledEndAt;
  const currentEnd = currentEndRaw ? new Date(currentEndRaw) : new Date();
  const validCurrentEnd = !isNaN(currentEnd.getTime()) ? currentEnd : new Date();
  const newEnd = new Date(validCurrentEnd.getTime() + additionalMinutes * 60 * 1000);

  const displayQrCode = adminQrUrl || dynamicQrUrl;
  const cashTenderedNum = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, cashTenderedNum - extensionFeeRupees);

  // Clean gameTitle (strip any [PAY ON EXIT] text)
  const cleanGameTitle = station.activeSession.gameTitle?.replace(/\[PAY ON EXIT\]/gi, '').trim() || null;

  const unpaidCurrentTabRupees = Math.round(
    (station.activeSession.unpaidPaise ?? (isExistingPayOnExit ? (station.activeSession.totalPricePaise || 0) : 0)) / 100
  );
  const projectedExitTabRupees = unpaidCurrentTabRupees + extensionFeeRupees;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={`Extend Session — ${station.name}`} size="md">
        <div className="space-y-5">
          {/* Gamer Info Banner */}
          <div className="p-4 rounded-xl bg-ds-dark border border-ds-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-[10px] uppercase font-mono text-ds-text-dim block">Current Player</span>
              <p className="font-heading font-bold text-sm text-ds-text">
                {station.activeSession.customerName}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-ds-ice font-mono text-[11px]">
                  Ref: {station.activeSession.bookingRef || 'Walk-in'}
                </span>
                {isExistingPayOnExit ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 inline-flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    <span>OPEN TAB (PAY ON EXIT)</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    <span>PRE-PAID</span>
                  </span>
                )}
              </div>
              {cleanGameTitle && (
                <p className="text-ds-accent font-heading font-semibold text-[11px] flex items-center gap-1 mt-1">
                  <Gamepad2 className="w-3 h-3" />
                  <span>Playing: {cleanGameTitle}</span>
                </p>
              )}
            </div>
            <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-ds-border/50">
              <span className="text-[10px] uppercase font-mono text-ds-text-dim block">Current End Time</span>
              <p className="font-mono font-bold text-ds-text text-sm">
                {validCurrentEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <span className="text-[10px] font-mono text-ds-accent block">
                ₹{(hourlyRate / 100).toFixed(0)} / hr
              </span>
            </div>
          </div>

          {/* Additional Duration Options */}
          <div className="space-y-1.5">
            <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim flex items-center justify-between">
              <span>Select Additional Time</span>
              <span className="text-ds-accent font-mono text-[11px] font-semibold">
                +₹{extensionFeeRupees}
              </span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { min: 15, label: '+15M' },
                { min: 30, label: '+30M' },
                { min: 60, label: '+1 HOUR' },
                { min: 120, label: '+2 HOURS' },
              ].map((d) => (
                <button
                  type="button"
                  key={d.min}
                  onClick={() => setAdditionalMinutes(d.min)}
                  className={`py-2.5 rounded-xl text-xs font-heading font-bold uppercase transition-all border ${
                    additionalMinutes === d.min
                      ? 'bg-ds-accent text-white border-ds-accent shadow-sm'
                      : 'bg-ds-surface/60 border-ds-border text-ds-text-muted hover:text-white'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* ─── TIER 1: PAYMENT TIMING SELECTOR (Add to Tab vs Pay Now) ─── */}
          <div className="space-y-2">
            <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim flex items-center justify-between">
              <span>Extension Payment Timing</span>
              {isExistingPayOnExit && (
                <span className="text-[10px] font-mono text-amber-400 font-semibold">
                  (Guest has active open tab)
                </span>
              )}
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPaymentTiming('PAY_ON_EXIT')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  paymentTiming === 'PAY_ON_EXIT'
                    ? 'bg-amber-500/15 border-amber-500 text-amber-300 ring-1 ring-amber-500'
                    : 'bg-ds-surface/40 border-ds-border text-ds-text-muted hover:border-ds-border'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span className="font-heading font-bold text-xs sm:text-sm text-white">
                    Add to Tab
                  </span>
                </div>
                <p className="text-[11px] text-amber-200/80 mt-1 font-body">
                  Collect ₹0 now • Settle at exit
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPaymentTiming('PRE_PAID')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  paymentTiming === 'PRE_PAID'
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500'
                    : 'bg-ds-surface/40 border-ds-border text-ds-text-muted hover:border-ds-border'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-400" />
                  <span className="font-heading font-bold text-xs sm:text-sm text-white">
                    Pay Now
                  </span>
                </div>
                <p className="text-[11px] text-emerald-200/80 mt-1 font-body">
                  Collect ₹{extensionFeeRupees} immediately
                </p>
              </button>
            </div>
          </div>

          {/* ─── CASE A: ADD TO TAB EXPLANATION ─── */}
          {paymentTiming === 'PAY_ON_EXIT' && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-amber-400 font-heading font-bold text-xs">
                  <Clock className="w-4 h-4" />
                  <span>Extension Added to Exit Bill</span>
                </div>
                <Badge variant="warning" size="sm" className="font-mono text-[10px]">
                  Collect ₹0 Now
                </Badge>
              </div>
              <p className="text-xs text-amber-200/90 leading-relaxed font-body">
                The <strong className="text-white font-bold">₹{extensionFeeRupees}</strong> extension fee is added to{' '}
                <strong className="text-white font-bold">{station.activeSession.customerName}</strong>'s open tab. Collect ₹0 right now; the gamer will settle everything when concluding the session.
              </p>
              {unpaidCurrentTabRupees > 0 && (
                <div className="pt-1.5 flex items-center justify-between text-[11px] font-mono border-t border-amber-500/20 text-amber-300/90">
                  <span>Current Tab: ₹{unpaidCurrentTabRupees}</span>
                  <span className="text-amber-400 font-bold">
                    Projected Total on Exit: ₹{projectedExitTabRupees}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ─── CASE B: PAY NOW PAYMENT METHOD SELECTOR ─── */}
          {paymentTiming === 'PRE_PAID' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                Extension Payment Received
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'CASH', label: 'Cash', icon: Banknote },
                  { id: 'UPI', label: 'UPI / QR', icon: Sparkles },
                  { id: 'CARD', label: 'POS Card', icon: CreditCard },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    type="button"
                    key={id}
                    onClick={() => handleSelectPaymentMethod(id as any)}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 transition-all text-xs font-heading font-bold ${
                      paymentMethod === id
                        ? 'bg-ds-surface border-emerald-500 text-emerald-400 ring-1 ring-emerald-500 shadow-sm'
                        : 'bg-ds-surface/40 border-ds-border text-ds-text-muted hover:border-ds-border'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Cash Quick Tender Box */}
              {paymentMethod === 'CASH' && (
                <div className="p-3.5 rounded-xl bg-ds-surface/60 border border-ds-border space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ds-text-dim font-mono text-[11px]">Quick Tender</span>
                    {changeDue > 0 && (
                      <span className="text-emerald-400 font-mono font-bold text-xs">
                        Change Due: ₹{changeDue}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {[extensionFeeRupees, 100, 200, 500].filter((amt, i, arr) => arr.indexOf(amt) === i && amt >= extensionFeeRupees).map((amt) => (
                      <button
                        type="button"
                        key={amt}
                        onClick={() => setCashTendered(amt.toString())}
                        className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border ${
                          cashTenderedNum === amt
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                            : 'bg-ds-dark border-ds-border text-ds-text-muted hover:text-white'
                        }`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    placeholder="Enter cash amount received..."
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-ds-dark border border-ds-border text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              {/* UPI Quick Banner with Open QR Trigger */}
              {paymentMethod === 'UPI' && (
                <div className="p-3.5 rounded-xl bg-ds-surface/80 border border-emerald-500/40 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowQrPopup(true)}
                      className="w-12 h-12 bg-white p-1 rounded-lg shadow border border-ds-border flex items-center justify-center shrink-0 hover:scale-105 transition-transform"
                      title="Click to enlarge QR"
                    >
                      {displayQrCode ? (
                        <img src={displayQrCode} alt="UPI QR" className="w-full h-full object-contain" />
                      ) : (
                        <QrCode className="w-6 h-6 text-black" />
                      )}
                    </button>
                    <div>
                      <span className="text-emerald-400 font-heading font-bold text-xs flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>UPI / QR Payment</span>
                      </span>
                      <p className="text-[11px] text-ds-text-dim mt-0.5 font-mono">
                        {upiId}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowQrPopup(true)}
                    className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 text-xs font-heading font-bold flex items-center gap-1.5"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Show QR</span>
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ─── CALCULATION SUMMARY PILL ─── */}
          <div className="p-4 rounded-xl bg-ds-dark border border-ds-accent/30 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-mono text-ds-text-dim block">New Scheduled End</span>
              <p className="font-heading font-extrabold text-base text-ds-ice">
                {newEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <span className="text-[10px] font-mono text-ds-text-dim">
                (+{additionalMinutes} mins added)
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-mono text-ds-text-dim block">
                {paymentTiming === 'PAY_ON_EXIT' ? 'Amount to Collect Right Now' : 'Extension Fee'}
              </span>
              <span className={`text-xl font-heading font-black ${paymentTiming === 'PAY_ON_EXIT' ? 'text-emerald-400' : 'text-ds-text'}`}>
                {paymentTiming === 'PAY_ON_EXIT' ? '₹0' : `₹${extensionFeeRupees}`}
              </span>
              {paymentTiming === 'PAY_ON_EXIT' && (
                <span className="text-[10px] font-mono text-amber-400 block font-semibold">
                  +₹{extensionFeeRupees} added to exit bill
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 sm:gap-3 pt-2">
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
              onClick={handleExtend}
              disabled={submitting}
              className={`text-xs sm:text-sm py-1.5 sm:py-2 px-3.5 sm:px-5 shadow-md cursor-pointer font-heading font-bold ${
                paymentTiming === 'PAY_ON_EXIT'
                  ? 'bg-amber-500 hover:bg-amber-600 border-amber-500 text-black shadow-amber-500/20'
                  : 'shadow-ds-accent/20'
              }`}
            >
              {submitting ? (
                'Extending...'
              ) : paymentTiming === 'PAY_ON_EXIT' ? (
                <>
                  <span className="sm:hidden">Add to Tab (₹0)</span>
                  <span className="hidden sm:inline">Confirm Extension & Add to Tab (₹0)</span>
                </>
              ) : (
                <>
                  <span className="sm:hidden">Confirm Extension (₹{extensionFeeRupees})</span>
                  <span className="hidden sm:inline">Confirm Extension & Record Payment (₹{extensionFeeRupees})</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── DEDICATED QR PAYMENT POPUP MODAL ─── */}
      <QrPaymentModal
        isOpen={showQrPopup}
        onClose={() => setShowQrPopup(false)}
        amountRupees={extensionFeeRupees}
        customerName={station.activeSession?.customerName}
        stationName={station.name}
        bookingRef={station.activeSession?.bookingRef}
        upiId={upiId}
        payeeName={upiPayeeName}
        staticQrUrl={adminQrUrl || undefined}
        onPaymentVerified={() => {
          setShowQrPopup(false);
          setPaymentMethod('UPI');
          toast.success('UPI Payment confirmed for extension');
        }}
      />
    </>
  );
}
