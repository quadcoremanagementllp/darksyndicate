'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Clock, Banknote, Sparkles, CreditCard, AlertCircle, QrCode, Copy, Check, Gamepad2 } from 'lucide-react';
import QRCode from 'qrcode';
import { useToast } from '@/components/ui/Toast';

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
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD'>('CASH');
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
  const stationName = station?.name || 'Console';

  // Generate dynamic QR fallback if admin has not uploaded a static QR image
  // Unconditionally called hook to satisfy React Rules of Hooks
  useEffect(() => {
    if (paymentMethod === 'UPI' && !adminQrUrl && station) {
      const amount = (extensionFeePaise / 100).toFixed(2);
      const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiPayeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Extension ${stationName}`)}`;
      QRCode.toDataURL(upiUrl, {
        width: 220,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      })
        .then((url) => setDynamicQrUrl(url))
        .catch(() => {});
    }
  }, [paymentMethod, adminQrUrl, upiId, upiPayeeName, extensionFeePaise, stationName, station]);

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopied(true);
    toast.success('UPI ID copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
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
          paymentMethod,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`Session extended by +${additionalMinutes}m successfully!`);
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

  // Unconditional render guard after all hooks are declared
  if (!isOpen || !station || !station.activeSession) return null;

  const currentEndRaw = station.activeSession.scheduledEndAt;
  const currentEnd = currentEndRaw ? new Date(currentEndRaw) : new Date();
  const validCurrentEnd = !isNaN(currentEnd.getTime()) ? currentEnd : new Date();
  const newEnd = new Date(validCurrentEnd.getTime() + additionalMinutes * 60 * 1000);

  const displayQrCode = adminQrUrl || dynamicQrUrl;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Extend Session — ${station.name}`}>
      <div className="space-y-5">
        {/* Gamer Info Banner */}
        <div className="p-4 rounded-xl bg-ds-dark border border-ds-border flex items-center justify-between text-xs">
          <div>
            <span className="text-[10px] uppercase font-mono text-ds-text-dim block">Current Player</span>
            <p className="font-heading font-bold text-sm text-ds-text">
              {station.activeSession.customerName}
            </p>
            <p className="text-ds-ice font-mono text-[11px] mt-0.5">
              Ref: {station.activeSession.bookingRef || 'Direct Session'}
            </p>
            {station.activeSession.gameTitle && (
              <p className="text-ds-accent font-heading font-semibold text-[11px] flex items-center gap-1 mt-0.5">
                <Gamepad2 className="w-3 h-3" />
                <span>Playing: {station.activeSession.gameTitle}</span>
              </p>
            )}
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-mono text-ds-text-dim block">Current End Time</span>
            <p className="font-mono font-bold text-ds-text">
              {validCurrentEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {/* Additional Duration Options */}
        <div className="space-y-1.5">
          <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
            Select Additional Time
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

        {/* Payment Method */}
        <div className="space-y-1.5">
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
                onClick={() => setPaymentMethod(id as any)}
                className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all text-xs font-heading font-bold ${
                  paymentMethod === id
                    ? 'bg-ds-surface border-emerald-500 text-emerald-400 ring-1 ring-emerald-500'
                    : 'bg-ds-surface/40 border-ds-border text-ds-text-muted hover:border-ds-border'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ─── UPI / QR CODE DISPLAY (When UPI / QR is selected) ─── */}
        {paymentMethod === 'UPI' && (
          <div className="p-4 rounded-xl bg-ds-surface/80 border border-emerald-500/40 space-y-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-emerald-400 font-heading font-bold text-xs">
                <QrCode className="w-4 h-4" />
                <span>Scan & Pay via UPI</span>
              </div>
              <Badge variant="success" size="sm" className="font-mono text-[10px]">
                Collect ₹{(extensionFeePaise / 100).toFixed(0)}
              </Badge>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 bg-ds-dark/90 p-3.5 rounded-xl border border-ds-border">
              {/* QR Code Container */}
              <div className="w-32 h-32 sm:w-36 sm:h-36 bg-white p-2 rounded-xl shadow-lg border border-ds-border flex items-center justify-center shrink-0">
                {displayQrCode ? (
                  <img
                    src={displayQrCode}
                    alt="Official Counter UPI QR"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                )}
              </div>

              {/* UPI Payee Info & Instructions */}
              <div className="space-y-2 text-xs flex-1 w-full text-center sm:text-left">
                <div>
                  <span className="text-[10px] uppercase font-mono text-ds-text-dim block">Official Payee</span>
                  <span className="font-heading font-bold text-ds-text block text-sm">
                    {upiPayeeName}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-mono text-ds-text-dim block">UPI ID / VPA</span>
                  <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-0.5">
                    <code className="bg-ds-surface px-2 py-0.5 rounded text-ds-ice font-mono font-bold text-[11px] border border-ds-border">
                      {upiId}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyUpi}
                      className="text-[10px] font-mono text-ds-accent hover:underline flex items-center gap-0.5"
                      title="Copy UPI ID"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-ds-text-muted pt-1">
                  Ask gamer to scan with <strong className="text-ds-text">GPay</strong>, <strong className="text-ds-text">PhonePe</strong>, or <strong className="text-ds-text">Paytm</strong> to complete extension.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Calculation Pill */}
        <div className="p-4 rounded-xl bg-ds-dark border border-ds-accent/30 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-mono text-ds-text-dim block">New Scheduled End</span>
            <p className="font-heading font-extrabold text-base text-ds-ice">
              {newEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-mono text-ds-text-dim block">Amount to Collect</span>
            <span className="text-xl font-heading font-black text-ds-text">
              ₹{(extensionFeePaise / 100).toFixed(0)}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="accent" onClick={handleExtend} disabled={submitting}>
            {submitting ? 'Extending...' : 'Confirm Extension & Update End Time'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
