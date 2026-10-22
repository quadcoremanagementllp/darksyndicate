'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Check, Copy, Sparkles, QrCode, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';

export interface QrPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amountRupees: number;
  customerName?: string;
  stationName?: string;
  bookingRef?: string;
  upiId?: string;
  payeeName?: string;
  staticQrUrl?: string;
  onPaymentVerified?: () => void;
}

export function QrPaymentModal({
  isOpen,
  onClose,
  amountRupees,
  customerName,
  stationName,
  bookingRef,
  upiId = 'darksyndicate@icici',
  payeeName = 'Dark Syndicate Gaming World',
  staticQrUrl,
  onPaymentVerified,
}: QrPaymentModalProps) {
  const [copied, setCopied] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(true);
  const toast = useToast();

  // Generate crisp dynamic UPI QR
  useEffect(() => {
    if (!isOpen) return;

    if (staticQrUrl) {
      setQrCodeDataUrl(staticQrUrl);
      setIsGenerating(false);
      return;
    }

    setIsGenerating(true);
    const formattedAmount = Number(amountRupees || 0).toFixed(2);
    const note = `Walk-in ${stationName || 'Gaming'}${bookingRef ? ` #${bookingRef}` : ''}`;
    const upiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${formattedAmount}&cu=INR&tn=${encodeURIComponent(note)}`;

    QRCode.toDataURL(upiUri, {
      width: 320,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => {
        setQrCodeDataUrl(url);
        setIsGenerating(false);
      })
      .catch(() => {
        setIsGenerating(false);
      });
  }, [isOpen, amountRupees, stationName, bookingRef, upiId, payeeName, staticQrUrl]);

  // Escape key handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleKeyDown]);

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopied(true);
    toast.success('UPI ID copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = () => {
    toast.success(`UPI Payment verified: ₹${amountRupees}`);
    if (onPaymentVerified) onPaymentVerified();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      {/* Dark backdrop blur */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-sm sm:max-w-md bg-[#09101d] border-2 border-emerald-500/50 rounded-3xl shadow-[0_0_40px_rgba(16,185,129,0.25)] overflow-hidden flex flex-col z-10 animate-in zoom-in-95 duration-200"
      >
        {/* Glow Header */}
        <div className="bg-gradient-to-r from-emerald-500/20 via-cyan-500/15 to-transparent p-4 sm:p-5 pb-3 border-b border-emerald-500/30 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/25 border border-emerald-400 text-emerald-300 flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.4)]">
              <QrCode className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-black text-base sm:text-lg text-white uppercase tracking-wider">
                  Scan to Pay via UPI
                </h3>
              </div>
              <p className="text-[11px] text-emerald-300/80 font-mono">
                {stationName ? `${stationName}` : 'Counter Walk-in'} {customerName ? `• ${customerName}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-ds-surface/60 hover:bg-ds-surface text-ds-text-dim hover:text-white flex items-center justify-center border border-ds-border transition-all cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-4 text-center flex flex-col items-center">
          {/* Amount Callout */}
          <div className="w-full bg-[#050a12] py-2.5 px-4 rounded-2xl border border-emerald-500/30 flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-ds-text-dim tracking-wider">
              Exact Amount to Pay:
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-heading font-black text-emerald-400 tracking-tight">
                ₹{amountRupees}
              </span>
            </div>
          </div>

          {/* Scannable High-Contrast QR Code Card */}
          <div className="relative group">
            <div className="w-64 h-64 sm:w-72 sm:h-72 bg-white p-3 rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.8)] border-4 border-white flex items-center justify-center transition-transform hover:scale-[1.02]">
              {isGenerating ? (
                <div className="flex flex-col items-center gap-2 text-zinc-500">
                  <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-mono">Generating QR...</span>
                </div>
              ) : qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt={`UPI QR Code for ₹${amountRupees}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-rose-500 text-xs font-mono">QR Generation Failed</div>
              )}
            </div>

            {/* Pulsing Scan Indicator Badge */}
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-emerald-500 text-black text-[10px] font-heading font-black uppercase px-3 py-1 rounded-full shadow-lg shadow-emerald-500/40 flex items-center gap-1.5 animate-pulse">
              <Sparkles className="w-3 h-3" />
              <span>GPay • PhonePe • Paytm • Any UPI</span>
            </div>
          </div>

          {/* Payee Info & Copy UPI ID */}
          <div className="w-full pt-3 space-y-2 text-xs">
            <div className="p-2.5 rounded-xl bg-ds-surface/50 border border-ds-border flex items-center justify-between gap-2">
              <div className="min-w-0 text-left">
                <span className="text-[10px] uppercase font-mono text-ds-text-dim block leading-tight">
                  Official Payee
                </span>
                <span className="font-heading font-bold text-ds-text text-xs truncate block">
                  {payeeName}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <code className="bg-[#050a12] px-2 py-1 rounded text-cyan-300 font-mono font-bold text-[11px] border border-cyan-950">
                  {upiId}
                </code>
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  className="p-1 rounded bg-ds-surface hover:bg-ds-surface-elevated text-ds-accent border border-ds-border hover:border-cyan-400 transition-all cursor-pointer"
                  title="Copy UPI ID"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-ds-text-dim font-body">
              Turn screen towards customer or allow customer to scan from across the counter.
            </p>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-3.5 sm:p-4 bg-[#050a12] border-t border-ds-border flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={onClose}
            className="text-xs py-1.5 px-3 font-heading font-semibold"
          >
            Close
          </Button>

          <Button
            variant="accent"
            size="sm"
            type="button"
            onClick={handleVerify}
            className="text-xs py-1.5 px-4 font-heading font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Payment Received</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
