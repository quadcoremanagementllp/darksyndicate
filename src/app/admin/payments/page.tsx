'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import {
  CreditCard,
  Search,
  RotateCw,
  Banknote,
  Sparkles,
  Globe,
  Store,
  UserCheck,
  Filter,
  Download,
  RotateCcw,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface CollectedBy {
  id?: string;
  name: string;
  role: string;
  isDesk: boolean;
}

interface Payment {
  id: string;
  bookingRef: string;
  isMembership?: boolean;
  customerName: string;
  customerEmail?: string;
  stationName: string;
  amountPaise: number;
  refundedPaise?: number;
  pendingRefundPaise?: number;
  netAmountPaise?: number;
  method: string;
  status: string;
  channel: 'ONLINE' | 'DESK';
  collectedBy: CollectedBy;
  gatewayOrderId: string;
  gatewayPaymentId: string;
  paidAt: string;
  notes?: string;
}

interface StaffUser {
  id: string;
  name: string;
  role: string;
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<'ALL' | 'ONLINE' | 'DESK'>('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [staffFilter, setStaffFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Refund & Settlement State
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [refundAmountINR, setRefundAmountINR] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const toast = useToast();

  const loadPayments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/payments');
      const json = await res.json();
      if (json.success && json.data) {
        const list = Array.isArray(json.data) ? json.data : json.data.payments || [];
        setPayments(list);
        if (json.data.staffList) {
          setStaffList(json.data.staffList);
        }
      }
    } catch {
      toast.error('Failed to load payments ledger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const handleSettlePayment = async (payment: Payment, method: 'CASH' | 'UPI') => {
    if (!confirm(`Mark ${payment.bookingRef} (₹${(payment.amountPaise / 100).toFixed(0)}) as settled via ${method}?`)) {
      return;
    }
    setProcessingId(payment.id);
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: payment.id,
          action: 'SETTLE',
          method,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.data?.message || 'Payment settled');
        loadPayments();
      } else {
        toast.error(json.error?.message || 'Failed to settle payment');
      }
    } catch {
      toast.error('Network error settling payment');
    } finally {
      setProcessingId(null);
    }
  };

  const openRefundModal = (payment: Payment) => {
    const refundablePaise = payment.netAmountPaise ?? payment.amountPaise - (payment.refundedPaise || 0);
    setSelectedPayment(payment);
    setRefundAmountINR(String(Math.round(refundablePaise / 100)));
    setRefundReason('Customer cancellation / adjustment');
    setRefundModalOpen(true);
  };

  const handleIssueRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;

    const amountNum = Number(refundAmountINR);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Enter a valid refund amount greater than ₹0');
      return;
    }

    setProcessingId(selectedPayment.id);
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: selectedPayment.id,
          action: 'REFUND',
          refundAmountPaise: Math.round(amountNum * 100),
          reason: refundReason.trim() || 'Admin refund',
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.data?.message || 'Refund processed');
        setRefundModalOpen(false);
        setSelectedPayment(null);
        loadPayments();
      } else {
        toast.error(json.error?.message || 'Failed to process refund');
      }
    } catch {
      toast.error('Network error issuing refund');
    } finally {
      setProcessingId(null);
    }
  };

  const handleExportCSV = () => {
    if (filteredPayments.length === 0) {
      toast.error('No transactions to export');
      return;
    }
    const headers = 'Reference,Customer,Email,Channel,AmountINR,RefundedINR,NetINR,Method,Collector,Station,Status,Date\n';
    const rows = filteredPayments
      .map((p) => {
        const net = (p.netAmountPaise ?? p.amountPaise) / 100;
        const refunded = (p.refundedPaise || 0) / 100;
        return `"${p.bookingRef}","${p.customerName}","${p.customerEmail || ''}","${p.channel}","${(p.amountPaise / 100).toFixed(2)}","${refunded.toFixed(2)}","${net.toFixed(2)}","${p.method}","${p.collectedBy?.name || ''}","${p.stationName}","${p.status}","${new Date(p.paidAt).toLocaleString()}"`;
      })
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `dark_syndicate_payments_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Payments ledger exported to CSV');
  };

  // Compute live ledger summary (net of refunds)
  const summary = useMemo(() => {
    const settledStatuses = ['COMPLETED', 'PARTIALLY_REFUNDED'];
    const totalRevenuePaise = payments
      .filter((p) => settledStatuses.includes(p.status))
      .reduce((sum, p) => sum + (p.netAmountPaise ?? p.amountPaise), 0);

    const onlineRevenuePaise = payments
      .filter((p) => settledStatuses.includes(p.status) && p.channel === 'ONLINE')
      .reduce((sum, p) => sum + (p.netAmountPaise ?? p.amountPaise), 0);

    const deskRevenuePaise = payments
      .filter((p) => settledStatuses.includes(p.status) && p.channel === 'DESK')
      .reduce((sum, p) => sum + (p.netAmountPaise ?? p.amountPaise), 0);

    const onlineCount = payments.filter((p) => p.channel === 'ONLINE').length;
    const deskCount = payments.filter((p) => p.channel === 'DESK').length;

    return {
      totalRevenuePaise,
      onlineRevenuePaise,
      deskRevenuePaise,
      totalCount: payments.length,
      onlineCount,
      deskCount,
    };
  }, [payments]);

  // Extract unique staff names from payments list
  const uniqueCollectors = useMemo(() => {
    const names = new Set<string>();
    payments.forEach((p) => {
      if (p.channel === 'DESK' && p.collectedBy?.name) {
        names.add(p.collectedBy.name);
      }
    });
    return Array.from(names);
  }, [payments]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchesChannel = channelFilter === 'ALL' || p.channel === channelFilter;
      const matchesMethod = methodFilter === 'ALL' || p.method === methodFilter;
      const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;

      const matchesStaff =
        staffFilter === 'ALL' ||
        (staffFilter === 'ONLINE_GATEWAY' && p.channel === 'ONLINE') ||
        (p.collectedBy?.name && p.collectedBy.name.toLowerCase() === staffFilter.toLowerCase());

      const query = search.toLowerCase();
      const matchesSearch =
        !search ||
        p.bookingRef.toLowerCase().includes(query) ||
        p.customerName.toLowerCase().includes(query) ||
        (p.customerEmail && p.customerEmail.toLowerCase().includes(query)) ||
        p.stationName.toLowerCase().includes(query) ||
        p.gatewayPaymentId.toLowerCase().includes(query) ||
        (p.notes && p.notes.toLowerCase().includes(query)) ||
        (p.collectedBy?.name && p.collectedBy.name.toLowerCase().includes(query)) ||
        p.channel.toLowerCase().includes(query);

      return matchesChannel && matchesMethod && matchesStatus && matchesStaff && matchesSearch;
    });
  }, [payments, channelFilter, methodFilter, statusFilter, staffFilter, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-black uppercase text-ds-text tracking-wide flex items-center gap-2.5">
            <CreditCard className="w-6 h-6 text-ds-accent" />
            <span>Financial & Payments Ledger</span>
          </h1>
          <p className="text-xs text-ds-text-muted mt-0.5">
            Comprehensive audit logs of online gateway collections, pass purchases, front-desk receipts, and refunds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="border-ds-border hover:border-ds-accent/40">
            <Download className="w-3.5 h-3.5 mr-1.5" />
            <span>Export CSV</span>
          </Button>
          <Button variant="outline" size="sm" onClick={loadPayments} className="border-ds-border hover:border-ds-accent/40">
            <RotateCw className="w-3.5 h-3.5 mr-1.5 text-ds-accent" />
            <span>Refresh Ledger</span>
          </Button>
        </div>
      </div>

      {/* KPI Stat Cards: Online vs Desk Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Ledger Revenue */}
        <Card glass className="p-4 border-ds-border hover:border-ds-accent/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-ds-text-dim">
              Net Settled Revenue
            </span>
            <Banknote className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-heading font-black text-emerald-400">
            ₹{(summary.totalRevenuePaise / 100).toLocaleString('en-IN')}
          </p>
          <span className="text-[11px] font-mono text-ds-text-muted mt-1 block">
            {summary.totalCount} total transactions logged
          </span>
        </Card>

        {/* Online Gateway Payments */}
        <Card glass className="p-4 border-ds-border hover:border-cyan-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-300">
              Online Payments
            </span>
            <Globe className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="mt-2 text-2xl font-heading font-black text-cyan-300">
            ₹{(summary.onlineRevenuePaise / 100).toLocaleString('en-IN')}
          </p>
          <span className="text-[11px] font-mono text-ds-text-muted mt-1 block">
            {summary.onlineCount} online website checkouts
          </span>
        </Card>

        {/* Front-Desk Collections */}
        <Card glass className="p-4 border-ds-border hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-amber-300">
              Front-Desk Collections
            </span>
            <Store className="w-4 h-4 text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-heading font-black text-amber-300">
            ₹{(summary.deskRevenuePaise / 100).toLocaleString('en-IN')}
          </p>
          <span className="text-[11px] font-mono text-ds-text-muted mt-1 block">
            {summary.deskCount} walk-in & counter cash/UPI
          </span>
        </Card>

        {/* Active Staff Collectors */}
        <Card glass className="p-4 border-ds-border hover:border-purple-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-purple-300">
              Staff Collectors
            </span>
            <UserCheck className="w-4 h-4 text-purple-400" />
          </div>
          <p className="mt-2 text-2xl font-heading font-black text-purple-300">
            {uniqueCollectors.length || staffList.length}
          </p>
          <span className="text-[11px] font-mono text-ds-text-muted mt-1 block">
            Operators actively recording payments
          </span>
        </Card>
      </div>

      {/* Filter Strip & Toolbar */}
      <div className="flex flex-col gap-3 bg-ds-surface/50 p-4 rounded-2xl border border-ds-border">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Channel Filters (ONLINE vs DESK) */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-ds-text-dim mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              Source:
            </span>
            <div className="flex flex-wrap gap-1 bg-ds-dark p-1 rounded-xl border border-ds-border text-xs">
              <button
                type="button"
                onClick={() => setChannelFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg font-heading font-bold uppercase transition-all ${
                  channelFilter === 'ALL'
                    ? 'bg-ds-accent text-white shadow-sm'
                    : 'text-ds-text-dim hover:text-white'
                }`}
              >
                All Sources
              </button>
              <button
                type="button"
                onClick={() => setChannelFilter('ONLINE')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-heading font-bold uppercase transition-all ${
                  channelFilter === 'ONLINE'
                    ? 'bg-cyan-500 text-white shadow-sm'
                    : 'text-cyan-400/80 hover:text-cyan-300 hover:bg-ds-surface/50'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Online ({summary.onlineCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setChannelFilter('DESK')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-heading font-bold uppercase transition-all ${
                  channelFilter === 'DESK'
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'text-amber-400/80 hover:text-amber-300 hover:bg-ds-surface/50'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Desk Counter ({summary.deskCount})</span>
              </button>
            </div>
          </div>

          {/* Payment Method & Status Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-ds-text-dim mr-1">
              Method:
            </span>
            <div className="flex flex-wrap gap-1 bg-ds-dark p-1 rounded-xl border border-ds-border text-xs">
              {['ALL', 'UPI', 'CASH', 'RAZORPAY'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethodFilter(m)}
                  className={`px-3 py-1.5 rounded-lg font-heading font-bold uppercase transition-all ${
                    methodFilter === m
                      ? 'bg-ds-surface text-ds-ice border border-ds-accent/40 shadow-sm'
                      : 'text-ds-text-dim hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-ds-dark border border-ds-border text-xs font-mono text-ds-text focus:outline-none focus:border-ds-accent"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="PENDING">PENDING</option>
              <option value="PARTIALLY_REFUNDED">PARTIALLY_REFUNDED</option>
              <option value="REFUNDED">REFUNDED</option>
            </select>
          </div>
        </div>

        {/* Second Row: Staff Filter Dropdown & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-ds-border/40">
          {/* Staff Filter Dropdown */}
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-purple-400 shrink-0" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-ds-text-dim">
              Staff:
            </span>
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-ds-dark border border-ds-border text-xs font-mono text-ds-text focus:outline-none focus:border-ds-accent transition-all cursor-pointer"
            >
              <option value="ALL">All Staff & Online</option>
              <option value="ONLINE_GATEWAY">🌐 Online System Only</option>
              {uniqueCollectors.map((collector) => (
                <option key={collector} value={collector}>
                  👤 {collector}
                </option>
              ))}
            </select>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Input
              placeholder="Search ref, gamer, staff collector, gateway ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs py-1.5 pl-8 w-full sm:w-80"
            />
            <Search className="w-3.5 h-3.5 text-ds-text-dim absolute left-2.5 top-2.5" />
          </div>
        </div>
      </div>

      {/* Transactions Table Card */}
      <Card glass className="border-ds-border overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-xs text-ds-text-dim animate-pulse">
            Loading verified payment settlements...
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-16 text-center text-xs text-ds-text-dim space-y-2">
            <CreditCard className="w-8 h-8 text-ds-text-dim mx-auto opacity-50" />
            <p>No transactions match the selected filters.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setChannelFilter('ALL');
                setMethodFilter('ALL');
                setStatusFilter('ALL');
                setStaffFilter('ALL');
                setSearch('');
              }}
              className="text-xs mt-2"
            >
              Reset Filters
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-ds-dark/80 text-ds-text-dim uppercase text-[10px] font-mono border-b border-ds-border">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Reference</th>
                  <th className="py-3.5 px-4 font-semibold">Gamer Details</th>
                  <th className="py-3.5 px-4 font-semibold">Channel</th>
                  <th className="py-3.5 px-4 font-semibold">Amount</th>
                  <th className="py-3.5 px-4 font-semibold">Method</th>
                  <th className="py-3.5 px-4 font-semibold">Collected By</th>
                  <th className="py-3.5 px-4 font-semibold">Station / Pass</th>
                  <th className="py-3.5 px-4 font-semibold">Gateway / Desk Reference</th>
                  <th className="py-3.5 px-4 font-semibold">Timestamp</th>
                  <th className="py-3.5 px-4 text-right font-semibold">Status & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ds-border/40 font-body">
                {filteredPayments.map((p) => {
                  const isOnline = p.channel === 'ONLINE';
                  const hasRefund = (p.refundedPaise || 0) > 0;
                  const netPaise = p.netAmountPaise ?? p.amountPaise - (p.refundedPaise || 0);

                  return (
                    <tr key={p.id} className="hover:bg-ds-surface/50 transition-colors">
                      {/* Booking Ref */}
                      <td className="py-3.5 px-4 font-mono font-bold text-ds-ice whitespace-nowrap">
                        {p.bookingRef}
                      </td>

                      {/* Gamer Details */}
                      <td className="py-3.5 px-4">
                        <div className="font-heading font-bold text-ds-text leading-tight">
                          {p.customerName}
                        </div>
                        <div className="text-[11px] text-ds-text-dim truncate max-w-[180px]">
                          {p.customerEmail || 'Walk-in Guest'}
                        </div>
                      </td>

                      {/* Source Channel (ONLINE vs DESK) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isOnline ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm">
                            <Globe className="w-3 h-3 text-cyan-400" />
                            <span>ONLINE</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/30 shadow-sm">
                            <Store className="w-3 h-3 text-amber-400" />
                            <span>DESK</span>
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-heading font-black text-emerald-400 text-sm">
                          ₹{(netPaise / 100).toFixed(0)}
                        </div>
                        {hasRefund && (
                          <span className="text-[10px] font-mono text-rose-400 block">
                            Refunded ₹{((p.refundedPaise || 0) / 100).toFixed(0)}
                          </span>
                        )}
                        {(p.pendingRefundPaise || 0) > 0 && (
                          <span className="text-[10px] font-mono text-amber-300 block">
                            Refund review required: ₹{((p.pendingRefundPaise || 0) / 100).toFixed(0)}
                          </span>
                        )}
                      </td>

                      {/* Payment Method */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-ds-surface border border-ds-border text-ds-text">
                          {p.method}
                        </span>
                      </td>

                      {/* Collected By (Which Staff Collected) */}
                      <td className="py-3.5 px-4 min-w-[170px]">
                        {!isOnline ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center font-heading font-bold text-[10px] shrink-0">
                              {p.collectedBy?.name?.[0] || 'S'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-heading font-bold text-ds-text truncate text-xs leading-tight">
                                {p.collectedBy?.name || 'Staff Operator'}
                              </p>
                              <span className="text-[9px] font-mono font-semibold uppercase text-emerald-400 block">
                                {p.collectedBy?.role === 'SUPER_ADMIN'
                                  ? 'Super Admin'
                                  : p.collectedBy?.role === 'ADMIN'
                                  ? 'Admin'
                                  : 'Staff Operator'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-ds-text-dim text-xs">
                            <Sparkles className="w-3.5 h-3.5 text-cyan-400/80 shrink-0" />
                            <span className="font-mono text-[11px]">Online (Self-Service)</span>
                          </div>
                        )}
                      </td>

                      {/* Station */}
                      <td className="py-3.5 px-4 text-ds-text whitespace-nowrap">{p.stationName}</td>

                      {/* Gateway / Desk Reference */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-ds-text-dim max-w-xs truncate">
                        {p.gatewayPaymentId !== '—'
                          ? p.gatewayPaymentId
                          : p.notes || 'Front Counter Record'}
                      </td>

                      {/* Timestamp */}
                      <td className="py-3.5 px-4 text-ds-text-dim font-mono text-[11px] whitespace-nowrap">
                        {new Date(p.paidAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* Status & Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Badge
                            variant={
                              p.status === 'COMPLETED'
                                ? 'success'
                                : p.status === 'REFUNDED'
                                ? 'danger'
                                : 'warning'
                            }
                            size="sm"
                          >
                            {p.status}
                          </Badge>

                          {!p.isMembership && p.method !== 'RAZORPAY' && p.status === 'PENDING' && (
                            <>
                              <button
                                type="button"
                                disabled={processingId === p.id}
                                onClick={() => handleSettlePayment(p, 'CASH')}
                                className="px-2 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 font-mono text-[10px] font-bold"
                                title="Settle with Cash"
                              >
                                +Cash
                              </button>
                              <button
                                type="button"
                                disabled={processingId === p.id}
                                onClick={() => handleSettlePayment(p, 'UPI')}
                                className="px-2 py-1 rounded bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 font-mono text-[10px] font-bold"
                                title="Settle with UPI"
                              >
                                +UPI
                              </button>
                            </>
                          )}

                          {!p.isMembership &&
                            p.method !== 'RAZORPAY' &&
                            (p.status === 'COMPLETED' || p.status === 'PARTIALLY_REFUNDED') &&
                            netPaise > 0 && (
                              <button
                                type="button"
                                disabled={processingId === p.id}
                                onClick={() => openRefundModal(p)}
                                className="p-1.5 rounded-lg border border-ds-border text-ds-text-dim hover:text-rose-400 hover:border-rose-500/40 hover:bg-rose-500/10 transition-colors"
                                title="Issue Refund"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Refund Modal */}
      <Modal
        isOpen={refundModalOpen}
        onClose={() => {
          setRefundModalOpen(false);
          setSelectedPayment(null);
        }}
        title={`Issue Refund: ${selectedPayment?.bookingRef || ''}`}
      >
        {selectedPayment && (
          <form onSubmit={handleIssueRefund} className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-ds-surface/60 border border-ds-border space-y-1 font-mono">
              <div className="flex justify-between">
                <span className="text-ds-text-dim">Gamer:</span>
                <span className="text-ds-text font-bold">{selectedPayment.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ds-text-dim">Original Amount:</span>
                <span className="text-emerald-400 font-bold">
                  ₹{(selectedPayment.amountPaise / 100).toFixed(0)}
                </span>
              </div>
              {(selectedPayment.refundedPaise || 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-ds-text-dim">Already Refunded:</span>
                  <span className="text-rose-400 font-bold">
                    ₹{((selectedPayment.refundedPaise || 0) / 100).toFixed(0)}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-heading font-bold uppercase text-ds-text-dim">
                Refund Amount (₹ INR)
              </label>
              <Input
                type="number"
                min={1}
                max={Math.round(
                  (selectedPayment.netAmountPaise ??
                    selectedPayment.amountPaise - (selectedPayment.refundedPaise || 0)) / 100
                )}
                value={refundAmountINR}
                onChange={(e) => setRefundAmountINR(e.target.value)}
                required
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-heading font-bold uppercase text-ds-text-dim">
                Reason for Refund
              </label>
              <Input
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="e.g. Power outage / Early departure / Cancelled slot"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-ds-border/60">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setRefundModalOpen(false);
                  setSelectedPayment(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="danger"
                size="sm"
                disabled={processingId === selectedPayment.id}
              >
                {processingId === selectedPayment.id ? 'Processing...' : 'Confirm Refund'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
