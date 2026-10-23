'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Square, AlertTriangle, AlertCircle, Clock, Gamepad2, CheckCircle2, User, Banknote, Sparkles, CreditCard, Maximize2, ArrowRight, Layers } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { QrPaymentModal } from '@/components/staff/QrPaymentModal';

export interface EndSessionTarget {
  sessionId?: string;
  stationId?: string;
  stationName: string;
  stationType?: string;
  bookingId?: string;
  customerName: string;
  customerPhone?: string;
  bookingRef?: string;
  scheduledEndAt?: string;
  pricePerHourPaise?: number;
  gameTitle?: string | null;
  paymentStatus?: string;
  paymentMethod?: string;
  totalPricePaise?: number;
  unpaidPaise?: number;
  isPayOnExit?: boolean;
  priorPendingTabs?: Array<{
    bookingId: string;
    bookingRef: string;
    stationName: string;
    stationType: string;
    gameTitle?: string | null;
    amountPaise: number;
  }>;
  priorUnpaidPaise?: number;
}

interface EndSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: EndSessionTarget | null;
  onSuccess: () => void;
  onTransferTab?: (data: {
    customerName: string;
    customerPhone?: string;
    priorBookingId: string;
    carriedOverPaise: number;
    stationName: string;
  }) => void;
}

export function EndSessionModal({
  isOpen,
  onClose,
  target,
  onSuccess,
  onTransferTab,
}: EndSessionModalProps) {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [transferring, setTransferring] = useState<boolean>(false);
  const [chargeOvertime, setChargeOvertime] = useState<boolean>(true);
  const [settleMethod, setSettleMethod] = useState<'CASH' | 'UPI'>('CASH');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [showQrPopup, setShowQrPopup] = useState<boolean>(false);
  const toast = useToast();

  const endDateTime = target?.scheduledEndAt ? new Date(target.scheduledEndAt) : null;
  const validEndTime = endDateTime && !isNaN(endDateTime.getTime()) ? endDateTime : null;
  const now = new Date();
  const isOverdue = validEndTime ? now.getTime() > validEndTime.getTime() : false;
  const extraMinutes = isOverdue && validEndTime
    ? Math.max(1, Math.floor((now.getTime() - validEndTime.getTime()) / (60 * 1000)))
    : 0;
  const extraSeconds = isOverdue && validEndTime
    ? Math.floor((now.getTime() - validEndTime.getTime()) / 1000) % 60
    : 0;
  const overtimeCharge = target?.pricePerHourPaise && extraMinutes > 0
    ? Math.max(10, Math.round((extraMinutes / 60) * (target.pricePerHourPaise / 100)))
    : null;
  const isStalePreviousSession = extraMinutes > 180;

  const isPostPaidPending = target?.paymentStatus === 'PENDING' || target?.isPayOnExit;
  const priorTabs = target?.priorPendingTabs || [];
  const priorTabsPaise =
    target?.priorUnpaidPaise !== undefined
      ? target.priorUnpaidPaise
      : priorTabs.reduce((sum, t) => sum + t.amountPaise, 0);

  // Current session unpaid base (excluding prior tabs)
  const currentSessionBasePaise = Math.max(
    0,
    (target?.unpaidPaise !== undefined
      ? target.unpaidPaise
      : isPostPaidPending
      ? target?.totalPricePaise || 0
      : 0) - priorTabsPaise
  );
  const overtimePaise = chargeOvertime && overtimeCharge ? overtimeCharge * 100 : 0;
  const currentSessionTotalPaise = currentSessionBasePaise + overtimePaise;
  const currentSessionTotalRupees = Math.round(currentSessionTotalPaise / 100);

  const totalCollectPaise = currentSessionBasePaise + overtimePaise + priorTabsPaise;
  const totalCollectRupees = Math.round(totalCollectPaise / 100);

  const cashTenderedNum = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, cashTenderedNum - totalCollectRupees);

  React.useEffect(() => {
    if (isOpen && target) {
      // Auto-default to waive overtime if session was left open for > 3 hours (e.g. previous day)
      setChargeOvertime(extraMinutes > 0 && extraMinutes <= 180);
      setCashTendered('');
      setSettleMethod('CASH');
      setShowQrPopup(false);
      setTransferring(false);
    }
  }, [isOpen, target?.sessionId, target?.bookingId, target?.stationId]);

  if (!isOpen || !target) return null;

  const handleConfirmEnd = async () => {
    setSubmitting(true);
    try {
      const additionalBookingIds = priorTabs.map((t) => t.bookingId).filter(Boolean);
      const res = await fetch('/api/staff/sessions/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: target.sessionId,
          stationId: target.stationId,
          bookingId: target.bookingId,
          extraMinutes: chargeOvertime ? extraMinutes : 0,
          settlePaymentMethod: totalCollectPaise > 0 ? settleMethod : undefined,
          settleAdditionalBookingIds: additionalBookingIds.length > 0 ? additionalBookingIds : undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(json.data?.message || `Session ended. ${target.stationName} is now Available.`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('ds-booking-updated'));
        }
        onSuccess();
        onClose();
      } else {
        toast.error(json.error?.message || 'Failed to end session');
      }
    } catch {
      toast.error('Error ending session. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransferTab = async () => {
    setTransferring(true);
    try {
      const res = await fetch('/api/staff/sessions/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: target.sessionId,
          stationId: target.stationId,
          bookingId: target.bookingId,
          extraMinutes: chargeOvertime ? extraMinutes : 0,
          transferTab: true,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(
          json.data?.message ||
            `${target.stationName} is now Available! Carried over open tab to next game.`
        );
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('ds-booking-updated'));
        }
        onSuccess();
        onClose();
        if (onTransferTab) {
          onTransferTab({
            customerName: target.customerName,
            customerPhone: target.customerPhone,
            priorBookingId: target.bookingId || '',
            carriedOverPaise: currentSessionTotalPaise + priorTabsPaise,
            stationName: target.stationName,
          });
        }
      } else {
        toast.error(json.error?.message || 'Failed to transfer tab');
      }
    } catch {
      toast.error('Error transferring tab to next game');
    } finally {
      setTransferring(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Conclude Active Session"
      size="md"
    >
      <div className="space-y-5">
        {/* Warning / Confirmation Banner */}
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-heading font-bold text-sm text-white">
              End Session for {target.customerName}?
            </h4>
            <p className="text-xs text-ds-text-dim mt-0.5 leading-relaxed">
              This will wrap up the ongoing gaming session on <strong className="text-white">{target.stationName}</strong> and immediately free up the station for new players.
            </p>
          </div>
        </div>

        {/* Extra Time / Overtime Alert Banner if Overdue */}
        {isOverdue && (
          <div className="p-4 rounded-xl bg-rose-500/15 border-2 border-rose-500/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-300 font-heading font-black text-xs uppercase tracking-wider">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  {isStalePreviousSession ? 'Unclosed Past Session Detected' : 'Extra Time (Overtime) Detected'}
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full font-mono text-xs font-black bg-rose-500 text-white shadow-sm">
                +{extraMinutes}m {extraSeconds.toString().padStart(2, '0')}s EXTRA
              </span>
            </div>

            <p className="text-xs text-rose-200/90 leading-relaxed font-body">
              Scheduled slot ended at{' '}
              <strong className="text-white font-bold">
                {validEndTime?.toLocaleString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </strong>
              . Elapsed extra time: <strong className="text-white font-bold">+{extraMinutes} minutes</strong>.
            </p>

            {overtimeCharge !== null && (
              <div className="pt-2 border-t border-rose-500/30 space-y-2">
                <span className="text-[11px] font-heading font-bold uppercase tracking-wider text-rose-200 block">
                  Overtime Billing Option:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setChargeOvertime(false)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      !chargeOvertime
                        ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-sm'
                        : 'bg-black/40 border-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    <div className="font-heading font-bold text-xs flex items-center justify-between">
                      <span>Waive Overtime</span>
                      <span className="font-mono text-emerald-300">₹0</span>
                    </div>
                    <p className="text-[10px] text-white/60 mt-0.5">
                      Close session at original booking price
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setChargeOvertime(true)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      chargeOvertime
                        ? 'bg-rose-500/25 border-rose-400 text-white shadow-sm'
                        : 'bg-black/40 border-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    <div className="font-heading font-bold text-xs flex items-center justify-between">
                      <span>Charge Overtime</span>
                      <span className="font-mono text-rose-300">+₹{overtimeCharge}</span>
                    </div>
                    <p className="text-[10px] text-white/60 mt-0.5">
                      Record +₹{overtimeCharge} Cash overtime fee
                    </p>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Session Dossier Summary */}
        <div className="p-4 rounded-xl bg-ds-dark border border-ds-border space-y-3 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-ds-border/60">
            <div className="flex items-center gap-2 text-ds-text-muted">
              <User className="w-4 h-4 text-ds-accent" />
              <span>Current Player</span>
            </div>
            <span className="font-heading font-bold text-white text-sm">
              {target.customerName}
            </span>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-ds-border/60">
            <div className="flex items-center gap-2 text-ds-text-muted">
              <Gamepad2 className="w-4 h-4 text-ds-ice" />
              <span>Console / Station</span>
            </div>
            <Badge variant="accent" size="sm" className="font-mono">
              {target.stationName}
            </Badge>
          </div>

          {target.gameTitle && (
            <div className="flex items-center justify-between pb-2 border-b border-ds-border/60">
              <div className="flex items-center gap-2 text-ds-text-muted">
                <Gamepad2 className="w-4 h-4 text-ds-accent" />
                <span>Game Playing</span>
              </div>
              <span className="font-heading font-bold text-ds-ice text-xs">
                {target.gameTitle}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between pb-2 border-b border-ds-border/60">
            <div className="flex items-center gap-2 text-ds-text-muted">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Scheduled End Time</span>
            </div>
            <span className="font-mono text-ds-text font-bold">
              {validEndTime
                ? validEndTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Active Now'}
            </span>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-ds-border/60">
            <div className="flex items-center gap-2 text-ds-text-muted">
              <Clock className="w-4 h-4 text-ds-ice" />
              <span>Conclude Time (Now)</span>
            </div>
            <span className="font-mono text-ds-text font-bold">
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-ds-text-muted">Extra Time Status</span>
            {isOverdue ? (
              <span className="font-mono font-black text-rose-400 text-xs">
                +{extraMinutes} mins (Overtime)
              </span>
            ) : (
              <span className="font-mono text-emerald-400 text-xs font-semibold">
                None (On Schedule)
              </span>
            )}
          </div>

          <div className="flex items-center justify-between pb-1">
            <span className="text-ds-text-muted">Payment Record</span>
            {isPostPaidPending ? (
              <Badge variant="warning" size="sm" className="font-mono font-bold text-[10px] animate-pulse">
                ⏳ UNPAID TAB (PAY ON EXIT)
              </Badge>
            ) : (
              <Badge variant="success" size="sm" className="font-mono text-[10px]">
                ✓ PRE-PAID ({target.paymentMethod || 'CASH'})
              </Badge>
            )}
          </div>

          {target.bookingRef && (
            <div className="flex items-center justify-between pt-2 border-t border-ds-border/60">
              <span className="text-ds-text-dim font-mono text-[11px]">Booking Reference</span>
              <code className="text-ds-ice font-mono text-[11px] bg-ds-surface px-2 py-0.5 rounded border border-ds-border">
                {target.bookingRef}
              </code>
            </div>
          )}
        </div>

        {/* Payment Settlement Card (if Post-Paid Tab or Overtime Fee due) */}
        {totalCollectPaise > 0 && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-transparent border-2 border-amber-500/40 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-300 font-heading font-black text-xs uppercase tracking-wider">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  {isPostPaidPending ? 'Collect Desk Payment (Open Tab)' : 'Collect Overtime Fee'}
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full font-mono text-xs font-black bg-amber-500 text-black shadow-sm">
                Total Due: ₹{totalCollectRupees}
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-ds-text-dim">
              {priorTabs.length > 0 && (
                <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-500/30 mb-2 space-y-1.5 text-cyan-200">
                  <div className="flex items-center justify-between text-[11px] font-heading font-bold text-cyan-300 pb-1 border-b border-cyan-500/20">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Itemized Multi-Game Open Tab:</span>
                    </span>
                    <Badge variant="accent" size="sm" className="font-mono text-[10px]">
                      {priorTabs.length + 1} Games Combined
                    </Badge>
                  </div>
                  {priorTabs.map((pt, idx) => (
                    <div key={idx} className="flex items-center justify-between py-0.5 text-[11px]">
                      <span className="text-cyan-100 truncate flex items-center gap-1.5">
                        <span>{pt.stationType === 'POOL_TABLE' ? '🎱' : '🎮'}</span>
                        <span className="truncate">{pt.stationName} (Prior Open Tab)</span>
                      </span>
                      <span className="font-mono font-bold text-white shrink-0">
                        ₹{(pt.amountPaise / 100).toFixed(0)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-0.5 text-[11px]">
                    <span className="text-emerald-300 truncate flex items-center gap-1.5">
                      <span>{target.stationType === 'POOL_TABLE' ? '🎱' : '🎮'}</span>
                      <span className="truncate">{target.stationName} (Current Game)</span>
                    </span>
                    <span className="font-mono font-bold text-white shrink-0">
                      ₹{(currentSessionBasePaise / 100).toFixed(0)}
                    </span>
                  </div>
                </div>
              )}

              {priorTabs.length === 0 && isPostPaidPending && (
                <div className="flex items-center justify-between py-1 border-b border-amber-500/20">
                  <span>Base Gaming Session:</span>
                  <span className="font-mono font-bold text-white">₹{(currentSessionBasePaise / 100).toFixed(0)}</span>
                </div>
              )}
              {overtimePaise > 0 && (
                <div className="flex items-center justify-between py-1 border-b border-amber-500/20">
                  <span>Overtime Charge (+{extraMinutes} mins):</span>
                  <span className="font-mono font-bold text-rose-300">+₹{(overtimePaise / 100).toFixed(0)}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1 text-sm font-heading font-black text-amber-300">
                <span>{priorTabs.length > 0 ? 'Combined Multi-Game Bill:' : 'Total Desk Collection:'}</span>
                <span className="text-base font-mono text-white">₹{totalCollectRupees}</span>
              </div>
            </div>

            {/* Settle Method Selector */}
            <div className="pt-2 border-t border-amber-500/30 space-y-2">
              <span className="text-[11px] font-heading font-bold uppercase tracking-wider text-amber-200 block">
                How is customer paying at desk?
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSettleMethod('CASH')}
                  className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 transition-all font-heading font-bold text-xs ${
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
                  className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 transition-all font-heading font-bold text-xs ${
                    settleMethod === 'UPI'
                      ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-sm ring-1 ring-cyan-400'
                      : 'bg-black/40 border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>UPI / QR</span>
                </button>
              </div>

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
                <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-xs text-ds-text-dim flex items-center justify-between gap-2">
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
        )}

        {/* Operational Consequences Notice */}
        <div className="rounded-xl bg-ds-surface/50 border border-ds-border p-3.5 space-y-2 text-xs">
          <span className="text-[11px] font-heading font-bold uppercase tracking-wider text-ds-text-dim block">
            What happens when you confirm:
          </span>
          <div className="space-y-1.5 text-ds-text-muted text-[11px]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                <strong className="text-emerald-400">{target.stationName}</strong> will instantly switch to <strong className="text-emerald-400">AVAILABLE</strong> on the floor grid.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Booking status moves to <strong className="text-white">COMPLETED</strong> in reservation history.</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Active timers and notifications are halted.</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2 border-t border-ds-border/60">
          {/* Transfer Tab Option (e.g. customer finishes PS5 and wants to play Snooker) */}
          {onTransferTab && (
            <button
              type="button"
              onClick={handleTransferTab}
              disabled={submitting || transferring}
              className="w-full group p-2.5 rounded-xl bg-gradient-to-r from-cyan-950/70 via-ds-surface to-emerald-950/70 hover:from-cyan-900/80 hover:to-emerald-900/80 border border-cyan-500/40 hover:border-cyan-400 text-left transition-all cursor-pointer flex items-center justify-between gap-3 shadow-md"
              title="Free this console immediately and carry over unpaid tab to Snooker"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-base shrink-0">
                  🎱
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-heading font-black text-white flex items-center gap-1.5">
                    <span>Transfer Tab to Snooker Game</span>
                    <ArrowRight className="w-3.5 h-3.5 text-cyan-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <p className="text-[10px] text-cyan-200/80 truncate">
                    Frees <strong className="text-white">{target.stationName}</strong> for next player & carries ₹{currentSessionTotalRupees + (priorTabsPaise > 0 ? Math.round(priorTabsPaise / 100) : 0)} tab
                  </p>
                </div>
              </div>
              <span className="font-mono text-[11px] font-bold text-cyan-300 bg-cyan-500/20 px-2.5 py-1 rounded-lg border border-cyan-400/40 shrink-0">
                {transferring ? 'Transferring...' : 'Play Snooker →'}
              </span>
            </button>
          )}

          <div className="flex items-center justify-end gap-2 sm:gap-3">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={onClose}
              disabled={submitting || transferring}
              className="text-xs sm:text-sm py-1.5 sm:py-2 px-3 sm:px-4 font-heading font-semibold"
            >
              Cancel
            </Button>

            <Button
              variant={totalCollectPaise > 0 ? 'accent' : 'danger'}
              size="sm"
              type="button"
              onClick={handleConfirmEnd}
              disabled={submitting || transferring}
              className={`text-xs sm:text-sm font-bold flex items-center gap-1.5 py-1.5 sm:py-2 px-3.5 sm:px-4 ${
                totalCollectPaise > 0
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                  : 'bg-rose-600 hover:bg-rose-500 text-white'
              }`}
            >
              <Square className="w-3.5 h-3.5" />
              <span>
                {submitting
                  ? 'Processing...'
                  : totalCollectPaise > 0
                  ? `Collect ₹${totalCollectRupees} & End Session`
                  : 'Confirm & End Session'}
              </span>
            </Button>
          </div>
        </div>
      </div>

      <QrPaymentModal
        isOpen={showQrPopup}
        onClose={() => setShowQrPopup(false)}
        amountRupees={totalCollectRupees}
        customerName={target.customerName}
        stationName={target.stationName}
        bookingRef={target.bookingRef}
        onPaymentVerified={() => {
          setShowQrPopup(false);
          toast.success(`Exit payment verified for ${target.customerName}`);
        }}
      />
    </Modal>
  );
}
