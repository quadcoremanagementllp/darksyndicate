'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Square, AlertTriangle, AlertCircle, Clock, Gamepad2, CheckCircle2, User } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

export interface EndSessionTarget {
  sessionId?: string;
  stationId?: string;
  stationName: string;
  bookingId?: string;
  customerName: string;
  bookingRef?: string;
  scheduledEndAt?: string;
  pricePerHourPaise?: number;
  gameTitle?: string | null;
}

interface EndSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: EndSessionTarget | null;
  onSuccess: () => void;
}

export function EndSessionModal({
  isOpen,
  onClose,
  target,
  onSuccess,
}: EndSessionModalProps) {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [chargeOvertime, setChargeOvertime] = useState<boolean>(true);
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

  React.useEffect(() => {
    if (isOpen && target) {
      // Auto-default to waive overtime if session was left open for > 3 hours (e.g. previous day)
      setChargeOvertime(extraMinutes > 0 && extraMinutes <= 180);
    }
  }, [isOpen, target?.sessionId, target?.bookingId, target?.stationId]);

  if (!isOpen || !target) return null;

  const handleConfirmEnd = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/staff/sessions/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: target.sessionId,
          stationId: target.stationId,
          bookingId: target.bookingId,
          extraMinutes: chargeOvertime ? extraMinutes : 0,
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

          {target.bookingRef && (
            <div className="flex items-center justify-between pt-2 border-t border-ds-border/60">
              <span className="text-ds-text-dim font-mono text-[11px]">Booking Reference</span>
              <code className="text-ds-ice font-mono text-[11px] bg-ds-surface px-2 py-0.5 rounded border border-ds-border">
                {target.bookingRef}
              </code>
            </div>
          )}
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
        <div className="flex items-center justify-end gap-3 pt-1">
          <Button
            variant="outline"
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-xs"
          >
            Cancel / Keep Running
          </Button>

          <Button
            variant="danger"
            type="button"
            onClick={handleConfirmEnd}
            disabled={submitting}
            className="text-xs font-bold flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white"
          >
            <Square className="w-3.5 h-3.5" />
            <span>{submitting ? 'Ending Session...' : 'Confirm & End Session'}</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
