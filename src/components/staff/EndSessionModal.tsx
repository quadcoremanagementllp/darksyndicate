'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Square,
  AlertTriangle,
  AlertCircle,
  Clock,
  Gamepad2,
  CheckCircle2,
  User,
  Banknote,
  Sparkles,
  CreditCard,
  Maximize2,
  ArrowRight,
  ArrowRightLeft,
  Layers,
  RefreshCw,
  Crown,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { QrPaymentModal } from '@/components/staff/QrPaymentModal';
import { calculateSessionCheckout } from '@/lib/sessionCheckout';
import { sessionHourlyRatePaise } from '@/lib/staffSessionRules';

export interface EndSessionTarget {
  sessionId?: string;
  stationId?: string;
  stationName: string;
  stationType?: string;
  bookingId?: string;
  userId?: string;
  customerName: string;
  customerPhone?: string;
  bookingRef?: string;
  scheduledEndAt?: string;
  pricePerHourPaise?: number;
  durationMinutes?: number;
  gameTitle?: string | null;
  paymentStatus?: string;
  paymentMethod?: string;
  totalPricePaise?: number;
  paidPaise?: number;
  unpaidPaise?: number;
  isPayOnExit?: boolean;
  syndicatePass?: {
    id: string;
    planName: string;
    tier: string;
    discountPercent: number;
    totalHours: number;
    usedHours: number;
    remainingMinutes: number;
    remainingHours: number;
    hasHoursAvailable: boolean;
  } | null;
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

export interface StationOption {
  id: string;
  name: string;
  stationType: string;
  pricePerHourPaise?: number;
  status?: string;
  specs?: string;
}

interface EndSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: EndSessionTarget | null;
  onSuccess: () => void;
  hidePendingOption?: boolean;
  stations?: StationOption[];
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
  hidePendingOption = false,
  stations,
  onTransferTab,
}: EndSessionModalProps) {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [transferring, setTransferring] = useState<boolean>(false);
  const [chargeOvertime, setChargeOvertime] = useState<boolean>(true);
  const [settleMethod, setSettleMethod] = useState<'CASH' | 'UPI' | 'SPLIT' | 'PENDING' | 'SYNDICATE_PASS'>('CASH');
  const [splitCash, setSplitCash] = useState<string>('');
  const [splitUpi, setSplitUpi] = useState<string>('');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [showQrPopup, setShowQrPopup] = useState<boolean>(false);
  const [priceMode, setPriceMode] = useState<'standard' | 'discount' | 'offered'>('standard');
  const [priceInput, setPriceInput] = useState('');
  const [refundConfirmed, setRefundConfirmed] = useState(false);

  // Syndicate Pass states
  const [activePass, setActivePass] = useState<EndSessionTarget['syndicatePass'] | null>(null);
  const [checkingPass, setCheckingPass] = useState<boolean>(false);

  // Transfer Mode states
  const [isTransferMode, setIsTransferMode] = useState<boolean>(false);
  const [loadedStations, setLoadedStations] = useState<StationOption[]>([]);
  const [loadingStations, setLoadingStations] = useState<boolean>(false);
  const [transferCategory, setTransferCategory] = useState<string>('ALL');
  const [selectedTargetStationId, setSelectedTargetStationId] = useState<string>('');
  const [transferDuration, setTransferDuration] = useState<number>(60);
  const [transferGameTitle, setTransferGameTitle] = useState<string>('');

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
  const overtimeChargePaise = target?.pricePerHourPaise && extraMinutes > 0
    ? Math.round((extraMinutes / 60) * target.pricePerHourPaise)
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
  const overtimePaise = chargeOvertime && overtimeChargePaise ? overtimeChargePaise : 0;
  const originalPricePaise = (target?.totalPricePaise || 0) + overtimePaise;
  const alreadyPaidPaise = target?.paidPaise ?? Math.max(0, (target?.totalPricePaise || 0) - currentSessionBasePaise);
  const validPriceInput = /^\d+(?:\.\d{1,2})?$/.test(priceInput.trim());
  const enteredPaise = validPriceInput ? Math.round(Number(priceInput) * 100) : null;
  let priceError = '';
  let checkout = calculateSessionCheckout(originalPricePaise, alreadyPaidPaise, {});
  if (priceMode !== 'standard') {
    if (enteredPaise === null) {
      priceError = 'Enter a valid rupee amount (up to 2 decimal places).';
    } else {
      try {
        checkout = calculateSessionCheckout(originalPricePaise, alreadyPaidPaise,
          priceMode === 'discount' ? { discountPaise: enteredPaise } : { finalPricePaise: enteredPaise });
      } catch (error) {
        priceError = error instanceof Error ? error.message : 'Invalid price';
      }
    }
  }
  const gatewayRefundRequired = checkout.refundPaise > 0 && ['RAZORPAY', 'CASHFREE'].includes(target?.paymentMethod || '');
  const currentSessionTotalPaise = checkout.duePaise;
  const currentSessionTotalRupees = currentSessionTotalPaise / 100;

  const totalCollectPaise = checkout.duePaise + priorTabsPaise;
  const totalCollectRupees = totalCollectPaise / 100;

  const cashTenderedNum = parseFloat(cashTendered) || 0;
  const splitCashNum = parseFloat(splitCash) || 0;
  const splitUpiNum = parseFloat(splitUpi) || 0;
  const splitTotal = Math.round((splitCashNum + splitUpiNum) * 100) / 100;
  const splitDifference = Math.round((totalCollectRupees - splitTotal) * 100) / 100;
  const isSplitValid = settleMethod === 'SPLIT'
    ? Math.abs(splitDifference) < 0.01 && splitCashNum > 0 && splitUpiNum > 0
    : true;

  const cashPortion = settleMethod === 'SPLIT' ? splitCashNum : totalCollectRupees;
  const changeDue = Math.max(0, cashTenderedNum - cashPortion);

  // Transfer calculation helpers
  const effectiveStations = loadedStations.length > 0 ? loadedStations : (stations || []);
  const availableTargetStations = effectiveStations.filter((s) => s.id !== target?.stationId);
  const filteredTargetStations = availableTargetStations.filter((s) => {
    if (transferCategory === 'ALL') return true;
    if (transferCategory === 'PS5') return s.stationType === 'PS5';
    if (transferCategory === 'POOL_TABLE') {
      return (
        s.stationType === 'POOL_TABLE' ||
        s.name.toUpperCase().includes('SNOOKER') ||
        s.name.toUpperCase().includes('POOL')
      );
    }
    return s.stationType === transferCategory;
  });

  const selectedTargetStation = availableTargetStations.find((s) => s.id === selectedTargetStationId);
  const isTargetPool =
    selectedTargetStation?.stationType === 'POOL_TABLE' ||
    selectedTargetStation?.name.toUpperCase().includes('SNOOKER') ||
    selectedTargetStation?.name.toUpperCase().includes('POOL');
  const targetHourlyRatePaise = selectedTargetStation
    ? sessionHourlyRatePaise(
        isTargetPool ? 'POOL_TABLE' : selectedTargetStation.stationType,
        selectedTargetStation.pricePerHourPaise || (isTargetPool ? 25000 : 15000),
        isTargetPool ? 4 : 1
      )
    : 0;
  const newStationFeePaise = Math.round(targetHourlyRatePaise * (transferDuration / 60));
  const newStationFeeRupees = newStationFeePaise / 100;
  const combinedProjectedPaise = totalCollectPaise + newStationFeePaise;
  const combinedProjectedRupees = combinedProjectedPaise / 100;

  // Pass Hours Deduction calculation
  const scheduledMinutes = target?.durationMinutes || 60;
  const sessionMinutes = Math.max(15, scheduledMinutes + (chargeOvertime ? extraMinutes : 0));
  const passHoursToDeduct = Number((sessionMinutes / 60).toFixed(1));
  const passRemainingAfter = activePass
    ? Math.max(0, Number((activePass.remainingHours - passHoursToDeduct).toFixed(1)))
    : 0;

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
    if (isOpen && target) {
      // Auto-default to waive overtime if session was left open for > 3 hours
      setChargeOvertime(extraMinutes > 0 && extraMinutes <= 180);
      setCashTendered('');
      const isInitiallyPass = target.paymentMethod === 'SYNDICATE_PASS' || Boolean(target.syndicatePass?.hasHoursAvailable);
      setSettleMethod(isInitiallyPass ? 'SYNDICATE_PASS' : 'CASH');
      setSplitCash('');
      setSplitUpi('');
      setShowQrPopup(false);
      setTransferring(false);
      setPriceMode('standard');
      setPriceInput('');
      setRefundConfirmed(false);
      setIsTransferMode(false);
      setSelectedTargetStationId('');
      setTransferDuration(60);
      setTransferGameTitle('');
      setTransferCategory('ALL');

      // Check active Syndicate Pass for this customer
      if (target.syndicatePass !== undefined) {
        setActivePass(target.syndicatePass);
        if (target.syndicatePass && target.syndicatePass.hasHoursAvailable) {
          setSettleMethod('SYNDICATE_PASS');
        }
      } else if (target.userId || target.customerPhone) {
        setCheckingPass(true);
        const params = new URLSearchParams();
        if (target.userId) params.set('userId', target.userId);
        if (target.customerPhone) params.set('phone', target.customerPhone);
        fetch(`/api/staff/memberships/check?${params.toString()}`)
          .then((r) => r.json())
          .then((json) => {
            if (json.success && json.data?.hasPass) {
              setActivePass(json.data.pass);
              if (json.data.pass.hasHoursAvailable && (target.paymentMethod === 'SYNDICATE_PASS' || target.totalPricePaise === 0)) {
                setSettleMethod('SYNDICATE_PASS');
              }
            } else {
              setActivePass(null);
            }
          })
          .catch(() => setActivePass(null))
          .finally(() => setCheckingPass(false));
      } else {
        setActivePass(null);
      }

      // Load station inventory if not passed as props
      if (stations && stations.length > 0) {
        setLoadedStations(stations);
      } else {
        setLoadingStations(true);
        fetch('/api/staff/overview')
          .then((r) => r.json())
          .then((json) => {
            if (json.success && Array.isArray(json.data?.stations)) {
              setLoadedStations(json.data.stations);
            }
          })
          .catch(() => {})
          .finally(() => setLoadingStations(false));
      }
    }
  }, [isOpen, target?.sessionId, target?.bookingId, target?.stationId, stations]);

  if (!isOpen || !target) return null;

  const handleConfirmEnd = async () => {
    if (priceError) return toast.error(priceError);
    if (gatewayRefundRequired) return toast.error('Ask an administrator to process the online payment refund first.');
    if (checkout.refundPaise > 0 && !refundConfirmed) return toast.error('Confirm the refund was returned to the customer.');
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
          settlePaymentMethod: settleMethod === 'SYNDICATE_PASS' ? 'SYNDICATE_PASS' : (totalCollectPaise > 0 ? settleMethod : undefined),
          splitCashPaise: settleMethod === 'SPLIT' ? Math.round(splitCashNum * 100) : undefined,
          splitUpiPaise: settleMethod === 'SPLIT' ? Math.round(splitUpiNum * 100) : undefined,
          settleAdditionalBookingIds: additionalBookingIds.length > 0 ? additionalBookingIds : undefined,
          ...(priceMode === 'discount' ? { discountPaise: enteredPaise } :
            priceMode === 'offered' ? { finalPricePaise: enteredPaise } : {}),
          refundConfirmed: checkout.refundPaise > 0 ? refundConfirmed : undefined,
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

  const handleConfirmTransfer = async () => {
    if (!selectedTargetStationId) {
      return toast.error('Please choose a destination station to transfer to.');
    }
    setTransferring(true);
    try {
      const res = await fetch('/api/staff/sessions/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromSessionId: target.sessionId,
          fromStationId: target.stationId,
          fromBookingId: target.bookingId,
          extraMinutes: chargeOvertime ? extraMinutes : 0,
          chargeOvertime,
          targetStationId: selectedTargetStationId,
          durationMinutes: transferDuration,
          playerCount: isTargetPool ? 4 : 1,
          gameTitle: transferGameTitle.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(
          json.data?.message ||
            `Transferred ${target.customerName} to ${selectedTargetStation?.name}. ${target.stationName} is now Available!`
        );
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('ds-booking-updated'));
        }
        onSuccess();
        onClose();
      } else {
        toast.error(json.error?.message || 'Failed to transfer session');
      }
    } catch {
      toast.error('Network error transferring session. Please try again.');
    } finally {
      setTransferring(false);
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
            carriedOverPaise: originalPricePaise - alreadyPaidPaise + priorTabsPaise,
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
      title={isTransferMode ? `Transfer Session: ${target.stationName}` : "Conclude Active Session"}
      size="md"
    >
      <div className="space-y-4">
        {/* Warning / Confirmation Banner */}
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-heading font-bold text-sm text-white">
              {isTransferMode ? `Transfer ${target.customerName} to another station?` : `End Session for ${target.customerName}?`}
            </h4>
            <p className="text-xs text-ds-text-dim mt-0.5 leading-relaxed">
              {isTransferMode
                ? `This will conclude the game on ${target.stationName}, make it Available immediately, and carry over the ₹${totalCollectRupees} tab to the next station.`
                : `This will wrap up the ongoing gaming session on ${target.stationName} and immediately free up the station for new players.`}
            </p>
          </div>
        </div>

        {/* ─── PROMINENT MULTI-GAME TRANSFERRED TAB AT TOP ─── */}
        {priorTabs.length > 0 && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/80 via-ds-surface to-emerald-950/80 border-2 border-cyan-400/50 space-y-3 shadow-lg">
            <div className="flex items-center justify-between pb-2 border-b border-cyan-500/20">
              <div className="flex items-center gap-2 font-heading font-black text-xs uppercase tracking-wider text-cyan-300">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Multi-Game Transferred Open Tab</span>
              </div>
              <Badge variant="accent" size="sm" className="font-mono text-xs">
                {priorTabs.length + 1} Games Combined
              </Badge>
            </div>
            <div className="space-y-1.5 text-xs">
              {priorTabs.map((pt, idx) => (
                <div key={idx} className="flex items-center justify-between py-1 text-cyan-100 border-b border-cyan-500/15">
                  <span className="flex items-center gap-2 font-medium">
                    <span>{pt.stationType === 'POOL_TABLE' ? '🎱' : '🎮'}</span>
                    <span>{pt.stationName} (Transferred Tab)</span>
                  </span>
                  <span className="font-mono font-bold text-white">
                    ₹{(pt.amountPaise / 100).toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between py-1 text-emerald-300">
                <span className="flex items-center gap-2 font-medium">
                  <span>{target.stationType === 'POOL_TABLE' ? '🎱' : '🎮'}</span>
                  <span>{target.stationName} (Current Session)</span>
                </span>
                <span className="font-mono font-bold text-white">
                  ₹{(checkout.duePaise / 100).toFixed(2)}
                </span>
              </div>
            </div>
            <div className="pt-2 border-t border-cyan-500/30 flex items-center justify-between font-heading font-black">
              <span className="text-amber-300 text-sm">Combined Total Due:</span>
              <span className="text-xl font-mono text-white">₹{totalCollectRupees.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Extra Time / Overtime Alert Banner if Overdue */}
        {isOverdue && (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border-2 border-rose-500/50 space-y-2.5">
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

            {overtimeChargePaise !== null && (
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
                      <span className="font-mono text-rose-300">+₹{(overtimeChargePaise / 100).toFixed(2)}</span>
                    </div>
                    <p className="text-[10px] text-white/60 mt-0.5">
                      Record +₹{(overtimeChargePaise / 100).toFixed(2)} overtime fee
                    </p>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── TRANSFER STATION PANEL (IF ACTIVATED) ─── */}
        {isTransferMode ? (
          <div className="p-4 rounded-xl bg-ds-dark border-2 border-cyan-400/40 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-cyan-500/20">
              <div className="flex items-center gap-2 font-heading font-black text-sm text-cyan-300 uppercase tracking-wider">
                <ArrowRightLeft className="w-4 h-4 text-cyan-400" />
                <span>Select Target Station to Transfer</span>
              </div>
              <button
                type="button"
                onClick={() => setIsTransferMode(false)}
                className="text-xs font-mono text-cyan-400 hover:text-white underline cursor-pointer"
              >
                ← Back to Payment
              </button>
            </div>

            {/* Current Open Tab Info */}
            <div className="p-3 rounded-lg bg-black/40 border border-white/10 flex items-center justify-between text-xs">
              <span className="text-ds-text-dim">Carried Open Tab ({target.stationName}):</span>
              <span className="font-mono font-black text-amber-300 text-sm">₹{totalCollectRupees}</span>
            </div>

            {/* Arena / Category Tabs */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-heading font-bold uppercase text-ds-text-dim block">
                Choose Station Category:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  { id: 'ALL', label: 'All Stations' },
                  { id: 'PS5', label: '🎮 PlayStation 5' },
                  { id: 'POOL_TABLE', label: '🎱 Snooker' },
                  { id: 'PC', label: '🖥️ PC Gaming' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setTransferCategory(cat.id)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-heading font-bold border transition-all text-center truncate ${
                      transferCategory === cat.id
                        ? 'bg-cyan-500 text-black border-cyan-400 shadow-sm'
                        : 'bg-ds-surface/60 border-ds-border text-ds-text-muted hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Station Selection Grid */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-heading font-bold uppercase text-ds-text-dim">
                  Choose Available Station:
                </span>
                {loadingStations && (
                  <span className="text-cyan-400 flex items-center gap-1 font-mono text-[10px]">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Loading...
                  </span>
                )}
              </div>

              {filteredTargetStations.length === 0 ? (
                <div className="p-3 rounded-xl bg-ds-surface border border-ds-border text-center text-xs text-ds-text-dim">
                  No other stations found in this category.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                  {filteredTargetStations.map((st) => {
                    const isOccupied = st.status === 'OCCUPIED';
                    const isMaintenance = st.status === 'MAINTENANCE' || st.status === 'DEACTIVATED';
                    const isSelected = selectedTargetStationId === st.id;
                    const isStationPool =
                      st.stationType === 'POOL_TABLE' ||
                      st.name.toUpperCase().includes('SNOOKER') ||
                      st.name.toUpperCase().includes('POOL');

                    return (
                      <button
                        key={st.id}
                        type="button"
                        disabled={isOccupied || isMaintenance || transferring}
                        onClick={() => setSelectedTargetStationId(st.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                          isSelected
                            ? 'bg-cyan-500/20 border-cyan-400 text-white ring-2 ring-cyan-400/50 shadow-md'
                            : isOccupied || isMaintenance
                            ? 'bg-ds-surface/30 border-ds-border/40 opacity-50 cursor-not-allowed'
                            : 'bg-ds-surface border-ds-border hover:border-cyan-400/60 text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-heading font-bold text-xs truncate">{st.name}</span>
                          <span className="text-[10px]">
                            {isStationPool ? '🎱' : '🎮'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-ds-text-dim">
                            ₹{((st.pricePerHourPaise || (isStationPool ? 25000 : 15000)) / 100).toFixed(0)}/h
                          </span>
                          <span className={isOccupied ? 'text-rose-400 font-bold' : isMaintenance ? 'text-amber-400' : 'text-emerald-400 font-bold'}>
                            {isOccupied ? 'IN USE' : isMaintenance ? 'MAINT' : 'FREE'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Duration Selector */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-heading font-bold uppercase text-ds-text-dim block">
                Session Duration:
              </span>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { mins: 30, label: '30m' },
                  { mins: 60, label: '1 hour' },
                  { mins: 90, label: '1.5h' },
                  { mins: 120, label: '2 hours' },
                  { mins: 180, label: '3 hours' },
                ].map((d) => (
                  <button
                    key={d.mins}
                    type="button"
                    onClick={() => setTransferDuration(d.mins)}
                    className={`py-1.5 rounded-lg font-mono text-xs font-bold border transition-all text-center ${
                      transferDuration === d.mins
                        ? 'bg-cyan-500 text-black border-cyan-400 shadow-sm'
                        : 'bg-ds-surface border-ds-border text-ds-text-dim hover:text-white'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Game Title */}
            {!isTargetPool && (
              <div className="space-y-1">
                <label className="text-[11px] font-heading font-bold uppercase text-ds-text-dim block">
                  Game Playing (Optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g. FIFA 24, GTA V, Tekken 8..."
                  value={transferGameTitle}
                  onChange={(e) => setTransferGameTitle(e.target.value)}
                  className="w-full bg-ds-surface border border-ds-border rounded-lg px-3 py-1.5 text-xs text-ds-text focus:border-cyan-400 focus:outline-none"
                />
              </div>
            )}

            {/* Projected Combined Bill Summary */}
            <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 space-y-1.5 text-xs text-cyan-200">
              <div className="flex items-center justify-between pb-1 border-b border-cyan-500/20 font-heading font-bold text-cyan-300">
                <span>Multi-Game Bill Calculation:</span>
                <span className="font-mono">Pay On Exit</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-cyan-100">
                  Carried Tab ({target.stationName}):
                </span>
                <span className="font-mono font-bold text-white">
                  ₹{totalCollectRupees}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-emerald-300">
                  New Session ({selectedTargetStation?.name || 'Selected Station'}, {transferDuration >= 60 ? `${transferDuration / 60}h` : `${transferDuration}m`}):
                </span>
                <span className="font-mono font-bold text-white">
                  +₹{newStationFeeRupees}
                </span>
              </div>
              <div className="pt-1.5 border-t border-cyan-500/30 flex items-center justify-between font-heading font-black text-amber-300 text-sm">
                <span>Total Combined on Final Exit:</span>
                <span className="font-mono text-base text-white">₹{combinedProjectedRupees}</span>
              </div>
            </div>

            {/* Transfer Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-ds-border">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setIsTransferMode(false)}
                disabled={transferring}
                className="text-xs font-heading font-semibold"
              >
                Back to Payment
              </Button>
              <Button
                variant="accent"
                size="sm"
                type="button"
                onClick={handleConfirmTransfer}
                disabled={transferring || !selectedTargetStationId}
                className="text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-black shadow-md shadow-cyan-500/20 flex items-center gap-1.5"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>
                  {transferring
                    ? 'Transferring...'
                    : selectedTargetStation
                    ? `Confirm Transfer to ${selectedTargetStation.name} & Free ${target.stationName}`
                    : 'Select a Station to Transfer'}
                </span>
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Session Dossier Summary */}
            <div className="p-3.5 rounded-xl bg-ds-dark border border-ds-border space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-ds-border/60">
                <div className="flex items-center gap-2 text-ds-text-muted">
                  <User className="w-4 h-4 text-ds-accent" />
                  <span>Current Player</span>
                </div>
                <span className="font-heading font-bold text-white text-sm">
                  {target.customerName}
                </span>
              </div>

              <div className="flex items-center justify-between pb-1.5 border-b border-ds-border/60">
                <div className="flex items-center gap-2 text-ds-text-muted">
                  <Gamepad2 className="w-4 h-4 text-ds-ice" />
                  <span>Console / Station</span>
                </div>
                <Badge variant="accent" size="sm" className="font-mono">
                  {target.stationName}
                </Badge>
              </div>

              {target.gameTitle && (
                <div className="flex items-center justify-between pb-1.5 border-b border-ds-border/60">
                  <div className="flex items-center gap-2 text-ds-text-muted">
                    <Gamepad2 className="w-4 h-4 text-ds-accent" />
                    <span>Game Playing</span>
                  </div>
                  <span className="font-heading font-bold text-ds-ice text-xs">
                    {target.gameTitle}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between pb-1.5 border-b border-ds-border/60">
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
                <div className="flex items-center justify-between pt-1.5 border-t border-ds-border/60">
                  <span className="text-ds-text-dim font-mono text-[11px]">Booking Reference</span>
                  <code className="text-ds-ice font-mono text-[11px] bg-ds-surface px-2 py-0.5 rounded border border-ds-border">
                    {target.bookingRef}
                  </code>
                </div>
              )}
            </div>

            {/* Checkout Pricing Section */}
            <div className="p-3.5 rounded-xl bg-ds-dark border border-ds-border space-y-2.5 text-xs">
              <div className="flex items-center justify-between font-heading font-bold text-white">
                <span>Session checkout price</span>
                <span className="font-mono text-ds-ice">₹{(originalPricePaise / 100).toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['standard', 'discount', 'offered'] as const).map((mode) => (
                  <button key={mode} type="button" onClick={() => { setPriceMode(mode); setPriceInput(''); setRefundConfirmed(false); }}
                    className={`rounded-lg border px-2 py-1.5 font-bold text-xs ${priceMode === mode ? 'border-ds-ice bg-ds-ice/20 text-white' : 'border-ds-border text-ds-text-muted'}`}>
                    {mode === 'standard' ? 'Standard' : mode === 'discount' ? 'Discount' : 'Edit price'}
                  </button>
                ))}
              </div>
              {priceMode !== 'standard' && (
                <label className="block text-ds-text-muted">
                  {priceMode === 'discount' ? 'Discount amount (₹)' : 'Final offered price (₹)'}
                  <input type="number" min="0" step="0.01" inputMode="decimal" value={priceInput}
                    onChange={(event) => { setPriceInput(event.target.value); setRefundConfirmed(false); }}
                    placeholder="0.00"
                    className="mt-1 w-full rounded-lg border border-ds-border bg-ds-surface px-3 py-1.5 font-mono text-white focus:border-ds-ice focus:outline-none" />
                </label>
              )}
              {priceError && <p className="text-rose-400" role="alert">{priceError}</p>}
              <div className="flex items-center justify-between border-t border-ds-border pt-2 font-heading font-bold text-white">
                <span>Final session price</span>
                <span className="font-mono text-emerald-400">₹{(checkout.finalPricePaise / 100).toFixed(2)}</span>
              </div>
              {checkout.discountPaise > 0 && <p className="text-emerald-400">Discount: ₹{(checkout.discountPaise / 100).toFixed(2)}</p>}
              {gatewayRefundRequired && <p className="text-rose-400" role="alert">Online payment refunds must be processed by an administrator before ending at a lower price.</p>}
              {checkout.refundPaise > 0 && !priceError && !gatewayRefundRequired && (
                <label className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-amber-200">
                  <input type="checkbox" checked={refundConfirmed} onChange={(event) => setRefundConfirmed(event.target.checked)} className="mt-0.5" />
                  <span>I returned ₹{(checkout.refundPaise / 100).toFixed(2)} to the customer. This refund will be recorded.</span>
                </label>
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
                  {priorTabs.length === 0 && checkout.duePaise > 0 && (
                    <div className="flex items-center justify-between py-1 border-b border-amber-500/20">
                      <span>Current Session Balance:</span>
                      <span className="font-mono font-bold text-white">₹{(checkout.duePaise / 100).toFixed(2)}</span>
                    </div>
                  )}
                  {overtimePaise > 0 && (
                    <div className="flex items-center justify-between py-1 border-b border-amber-500/20">
                      <span>Includes Overtime (+{extraMinutes} mins):</span>
                      <span className="font-mono font-bold text-rose-300">₹{(overtimePaise / 100).toFixed(2)}</span>
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
                  <div className={`grid ${activePass && activePass.hasHoursAvailable ? 'grid-cols-2 sm:grid-cols-5' : hidePendingOption ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'} gap-2`}>
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
                    {!hidePendingOption && (
                      <button
                        type="button"
                        onClick={() => setSettleMethod('PENDING')}
                        className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 transition-all font-heading font-bold text-xs ${
                          settleMethod === 'PENDING'
                            ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-sm ring-1 ring-amber-400'
                            : 'bg-black/40 border-white/10 text-white/60 hover:text-white'
                        }`}
                      >
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span>Pending</span>
                      </button>
                    )}
                    {activePass && activePass.hasHoursAvailable && (
                      <button
                        type="button"
                        onClick={() => setSettleMethod('SYNDICATE_PASS')}
                        className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 transition-all font-heading font-bold text-xs ${
                          settleMethod === 'SYNDICATE_PASS'
                            ? 'bg-purple-600/30 border-purple-400 text-purple-200 shadow-sm ring-1 ring-purple-400'
                            : 'bg-purple-950/20 border-purple-500/40 text-purple-300 hover:text-white hover:bg-purple-900/30'
                        }`}
                      >
                        <Crown className="w-4 h-4 text-purple-400" />
                        <span>Pass ({activePass.remainingHours}h)</span>
                      </button>
                    )}
                  </div>

                  {/* Syndicate Pass Deduction Card */}
                  {settleMethod === 'SYNDICATE_PASS' && activePass && (
                    <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/40 space-y-2.5 animate-in fade-in duration-200 mt-2">
                      <div className="flex items-center justify-between pb-1.5 border-b border-purple-500/20">
                        <div className="flex items-center gap-2 font-heading font-bold text-purple-300 text-xs uppercase tracking-wider">
                          <Crown className="w-4 h-4 text-purple-400" />
                          <span>Redeem Syndicate Pass Allowance</span>
                        </div>
                        <Badge variant="accent" size="sm" className="font-mono text-[10px] bg-purple-500/20 text-purple-300 border-purple-400/40">
                          {activePass.planName} ({activePass.tier})
                        </Badge>
                      </div>

                      <div className="space-y-1.5 text-xs text-purple-200/90 font-mono">
                        <div className="flex items-center justify-between">
                          <span className="text-ds-text-dim">Pass Plan Allowance:</span>
                          <span className="text-white font-bold">{activePass.totalHours} hrs</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-ds-text-dim">Current Remaining Hours:</span>
                          <span className="text-emerald-400 font-bold">{activePass.remainingHours} hrs</span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-t border-b border-purple-500/20 text-amber-300 font-bold">
                          <span>Session Time to Deduct ({sessionMinutes} mins):</span>
                          <span className="text-rose-400">-{passHoursToDeduct} hrs</span>
                        </div>
                        <div className="flex items-center justify-between font-heading font-black text-white text-sm">
                          <span>Balance Remaining After Session:</span>
                          <span className="font-mono text-cyan-300">{passRemainingAfter} hrs</span>
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-black/40 border border-purple-500/20 text-[11px] text-purple-200/80 leading-relaxed">
                        ✓ Station <strong>{target.stationName}</strong> will switch to <strong>AVAILABLE</strong> immediately.
                        <br />
                        ✓ <strong>₹0.00</strong> desk collection (covered by gamer&apos;s Syndicate Pass hours).
                      </div>
                    </div>
                  )}

                  {/* Pending Payment Notice */}
                  {settleMethod === 'PENDING' && (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-1.5 animate-in fade-in duration-200 mt-2">
                      <div className="flex items-center gap-2 font-heading font-bold text-amber-300">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Mark Payment as Pending</span>
                      </div>
                      <p className="text-[11px] text-amber-100/90 leading-relaxed">
                        Station <strong>{target.stationName}</strong> will instantly switch to <strong>AVAILABLE</strong> for new players. The balance of <strong>₹{totalCollectRupees}</strong> will be stored in the <strong>Pending</strong> section on the sidebar for later collection.
                      </p>
                    </div>
                  )}

                  {/* Split Payment Inputs */}
                  {settleMethod === 'SPLIT' && (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3 animate-in fade-in duration-200 mt-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-amber-300 font-heading font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-amber-400" />
                          <span>Split Payment Distribution</span>
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
                        {/* Cash Portion */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-mono text-ds-text-dim flex items-center justify-between">
                            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                              <Banknote className="w-3 h-3" />
                              Cash Portion (₹)
                            </span>
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

                        {/* UPI Portion */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="flex items-center gap-1 text-cyan-400 font-semibold">
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

            {/* ─── TRANSFER OPTION CARD (BELOW PAYMENT & PENDING) ─── */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/50 via-ds-surface to-emerald-950/50 border border-cyan-500/40 space-y-2.5 shadow-md">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/30 text-cyan-400 flex items-center justify-center shrink-0">
                    <ArrowRightLeft className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h5 className="font-heading font-black text-xs text-white flex items-center gap-1.5">
                      <span>Transfer Session to Another Station</span>
                      <Badge variant="accent" size="sm" className="font-mono text-[9px]">
                        Add On
                      </Badge>
                    </h5>
                    <p className="text-[11px] text-cyan-200/80 truncate">
                      Moving to PlayStation or Snooker? Free {target.stationName} and carry over ₹{totalCollectRupees} tab.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTransferMode(true)}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-heading font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-md shadow-cyan-500/20"
                >
                  <span>Transfer Tab</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Operational Consequences Notice */}
            <div className="rounded-xl bg-ds-surface/50 border border-ds-border p-3 space-y-1.5 text-xs">
              <span className="text-[11px] font-heading font-bold uppercase tracking-wider text-ds-text-dim block">
                What happens when you confirm:
              </span>
              <div className="space-y-1 text-ds-text-muted text-[11px]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    <strong className="text-emerald-400">{target.stationName}</strong> will instantly switch to <strong className="text-emerald-400">AVAILABLE</strong> on the floor grid.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-3.5 h-3.5 ${settleMethod === 'PENDING' ? 'text-amber-400' : 'text-emerald-400'} shrink-0`} />
                  <span>
                    {settleMethod === 'PENDING' ? (
                      <>Payment of <strong className="text-amber-300">₹{totalCollectRupees}</strong> moves to <strong className="text-amber-400">PENDING</strong> in Pending section.</>
                    ) : (
                      <>Booking status moves to <strong className="text-white">COMPLETED</strong> in reservation history.</>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Active timers and notifications are halted.</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-ds-border/60">
              {onTransferTab && (
                <button
                  type="button"
                  onClick={handleTransferTab}
                  disabled={submitting || transferring || priceMode !== 'standard'}
                  className="w-full group p-2.5 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 text-left transition-all cursor-pointer flex items-center justify-between gap-3"
                  title="Free this console and launch Walk-in modal"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ArrowRightLeft className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="text-xs font-heading font-bold text-cyan-200">
                      Open in Walk-in Floor Planner with Carried Tab
                    </span>
                  </div>
                  <span className="font-mono text-[10px] font-bold text-cyan-300 bg-cyan-500/20 px-2 py-0.5 rounded border border-cyan-400/40">
                    Walk-in Planner →
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
                  disabled={submitting || transferring || Boolean(priceError) || gatewayRefundRequired || (checkout.refundPaise > 0 && !refundConfirmed) || (settleMethod === 'SPLIT' && !isSplitValid)}
                  className={`text-xs sm:text-sm font-bold flex items-center gap-1.5 py-1.5 sm:py-2 px-3.5 sm:px-4 ${
                    settleMethod === 'SYNDICATE_PASS'
                      ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-500/20'
                      : settleMethod === 'PENDING'
                      ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-md shadow-amber-500/20'
                      : totalCollectPaise > 0
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                      : 'bg-rose-600 hover:bg-rose-500 text-white'
                  }`}
                >
                  {settleMethod === 'SYNDICATE_PASS' ? (
                    <Crown className="w-3.5 h-3.5" />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {submitting
                      ? 'Processing...'
                      : settleMethod === 'SYNDICATE_PASS'
                      ? `Deduct ${passHoursToDeduct}h & End Session`
                      : settleMethod === 'PENDING'
                      ? `End Session & Mark ₹${totalCollectRupees} as Pending`
                      : settleMethod === 'SPLIT'
                      ? `Collect ₹${splitCashNum} Cash + ₹${splitUpiNum} UPI & End`
                      : totalCollectPaise > 0
                      ? `Collect ₹${totalCollectRupees} & End Session`
                      : 'Confirm & End Session'}
                  </span>
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <QrPaymentModal
        isOpen={showQrPopup}
        onClose={() => setShowQrPopup(false)}
        amountRupees={settleMethod === 'SPLIT' ? splitUpiNum : totalCollectRupees}
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
