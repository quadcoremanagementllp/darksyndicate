'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import {
  Calendar,
  Search,
  ExternalLink,
  RotateCw,
  Globe,
  UserCheck,
  X,
  Download,
  CheckCircle2,
  Ban,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

type DatePreset = 'ALL' | 'TODAY' | 'YESTERDAY' | '7DAYS' | 'MONTH' | 'CUSTOM';

function getKolkataDateString(dateInput: string | Date): string {
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return '';
  }
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [channelFilter, setChannelFilter] = useState<'ALL' | 'ONLINE' | 'DESK'>('ALL');
  const [datePreset, setDatePreset] = useState<DatePreset>('ALL');
  const [customDate, setCustomDate] = useState<string>('');
  const toast = useToast();

  const loadBookings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/bookings');
      const json = await res.json();
      if (json.success && json.data) {
        setBookings(json.data || []);
      }
    } catch {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const handleBookingAction = async (
    booking: any,
    action: 'CANCEL' | 'MARK_PAID' | 'NO_SHOW',
    paymentMethod?: 'CASH' | 'UPI'
  ) => {
    if (action === 'CANCEL') {
      if (!confirm(`Cancel reservation ${booking.bookingRef} for ${booking.customerName}?`)) return;
    } else if (action === 'NO_SHOW') {
      if (!confirm(`Mark ${booking.bookingRef} (${booking.customerName}) as No-Show?`)) return;
    }

    setActionLoadingId(booking.id);
    try {
      const res = await fetch('/api/admin/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          action,
          paymentMethod,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.data?.message || 'Booking updated');
        loadBookings();
      } else {
        toast.error(json.error?.message || 'Failed to update booking');
      }
    } catch {
      toast.error('Network error while updating booking');
    } finally {
      setActionLoadingId(null);
    }
  };

  const onlineCount = bookings.filter((b) => !b.isWalkIn).length;
  const deskCount = bookings.filter((b) => b.isWalkIn).length;

  const handlePresetClick = (preset: DatePreset) => {
    setDatePreset(preset);
    setCustomDate('');
  };

  const isAnyFilterActive =
    channelFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    datePreset !== 'ALL' ||
    Boolean(customDate) ||
    Boolean(search.trim());

  const handleResetFilters = () => {
    setChannelFilter('ALL');
    setStatusFilter('ALL');
    setDatePreset('ALL');
    setCustomDate('');
    setSearch('');
  };

  const filteredBookings = bookings.filter((b) => {
    const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;
    const matchesChannel =
      channelFilter === 'ALL' ||
      (channelFilter === 'ONLINE' && !b.isWalkIn) ||
      (channelFilter === 'DESK' && b.isWalkIn);

    const matchesSearch =
      !search ||
      b.bookingRef.toLowerCase().includes(search.toLowerCase()) ||
      b.customerName.toLowerCase().includes(search.toLowerCase()) ||
      b.stationName.toLowerCase().includes(search.toLowerCase()) ||
      (b.staffName && b.staffName.toLowerCase().includes(search.toLowerCase())) ||
      (b.channel && b.channel.toLowerCase().includes(search.toLowerCase())) ||
      (b.customerEmail && b.customerEmail.toLowerCase().includes(search.toLowerCase())) ||
      (b.customerPhone && b.customerPhone.includes(search));

    // Date filtering in Asia/Kolkata
    let matchesDate = true;
    const bDateStr = getKolkataDateString(b.startTime || b.date);

    if (customDate) {
      matchesDate = bDateStr === customDate;
    } else if (datePreset === 'TODAY') {
      const todayStr = getKolkataDateString(new Date());
      matchesDate = bDateStr === todayStr;
    } else if (datePreset === 'YESTERDAY') {
      const yesterdayStr = getKolkataDateString(new Date(Date.now() - 86400000));
      matchesDate = bDateStr === yesterdayStr;
    } else if (datePreset === '7DAYS') {
      const bookingTimestamp = new Date(b.startTime || b.date).getTime();
      const sevenDaysAgo = Date.now() - 7 * 86400000;
      matchesDate = bookingTimestamp >= sevenDaysAgo;
    } else if (datePreset === 'MONTH') {
      const currentMonth = getKolkataDateString(new Date()).slice(0, 7);
      matchesDate = bDateStr.startsWith(currentMonth);
    }

    return matchesStatus && matchesChannel && matchesSearch && matchesDate;
  });

  const handleExportCSV = () => {
    if (filteredBookings.length === 0) {
      toast.error('No bookings to export');
      return;
    }
    const headers = 'Booking Ref,Customer,Phone/Email,Channel,Station,Date,Start Time,Amount (INR),Payment Method,Payment Status,Booking Status\n';
    const rows = filteredBookings
      .map((b) =>
        [
          b.bookingRef,
          `"${(b.customerName || '').replace(/"/g, '""')}"`,
          `"${b.customerPhone || b.customerEmail || ''}"`,
          b.isWalkIn ? 'DESK' : 'ONLINE',
          `"${b.stationName}"`,
          getKolkataDateString(b.date),
          new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          (b.totalPricePaise / 100).toFixed(0),
          b.paymentMethod || 'UNPAID',
          b.paymentStatus,
          b.status,
        ].join(',')
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `dark_syndicate_bookings_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredBookings.length} bookings to CSV`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-black uppercase text-ds-text">
            All Reservations Ledger
          </h1>
          <p className="text-xs text-ds-text-muted mt-0.5">
            Audit trail of online bookings, front-desk walk-ins, payment settlement, and session completions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 font-mono text-xs mr-1">
            <span className="px-2.5 py-1 rounded-lg bg-ds-surface border border-ds-border text-ds-text-muted">
              Total: <strong className="text-ds-text font-bold">{bookings.length}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
              Online: <strong className="text-white font-bold">{onlineCount}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
              Desk: <strong className="text-white font-bold">{deskCount}</strong>
            </span>
          </div>

          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={filteredBookings.length === 0}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            <span>CSV</span>
          </Button>

          <Button variant="outline" size="sm" onClick={loadBookings} disabled={loading}>
            <RotateCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="space-y-3 bg-ds-surface/50 p-4 rounded-2xl border border-ds-border">
        {/* Row 1: Source / Channel Filter & Status Filters & Search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Source Tabs */}
            <div className="flex items-center gap-1 bg-ds-dark p-1 rounded-xl border border-ds-border text-xs">
              <button
                onClick={() => setChannelFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg font-heading font-bold uppercase transition-all ${
                  channelFilter === 'ALL'
                    ? 'bg-ds-surface-3 text-white shadow-sm'
                    : 'text-ds-text-dim hover:text-white'
                }`}
              >
                All Sources
              </button>
              <button
                onClick={() => setChannelFilter('ONLINE')}
                className={`px-3 py-1.5 rounded-lg font-heading font-bold uppercase transition-all flex items-center gap-1.5 ${
                  channelFilter === 'ONLINE'
                    ? 'bg-sky-500/25 text-sky-300 border border-sky-500/40 shadow-sm'
                    : 'text-ds-text-dim hover:text-white'
                }`}
              >
                <Globe className="w-3 h-3 text-sky-400" />
                <span>Online ({onlineCount})</span>
              </button>
              <button
                onClick={() => setChannelFilter('DESK')}
                className={`px-3 py-1.5 rounded-lg font-heading font-bold uppercase transition-all flex items-center gap-1.5 ${
                  channelFilter === 'DESK'
                    ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-ds-text-dim hover:text-white'
                }`}
              >
                <UserCheck className="w-3 h-3 text-amber-400" />
                <span>Desk ({deskCount})</span>
              </button>
            </div>

            <span className="hidden sm:inline-block w-px h-6 bg-ds-border" />

            {/* Status Filters */}
            <div className="flex flex-wrap gap-1 bg-ds-dark p-1 rounded-xl border border-ds-border text-xs">
              {['ALL', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'PENDING', 'CANCELLED', 'NO_SHOW'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1.5 rounded-lg font-heading font-bold uppercase transition-all ${
                    statusFilter === st
                      ? 'bg-ds-accent text-white shadow-sm'
                      : 'text-ds-text-dim hover:text-white'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Input
              placeholder="Search ref, player, staff, station..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs py-1.5 pl-8 pr-7 w-full sm:w-72"
            />
            <Search className="w-3.5 h-3.5 text-ds-text-dim absolute left-2.5 top-2.5" />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-2 text-ds-text-dim hover:text-white"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Date Filtering Bar (Preset Tabs & Custom Calendar Picker) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-ds-border/60 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono uppercase text-ds-text-dim flex items-center gap-1.5 mr-1 font-bold">
              <Calendar className="w-3.5 h-3.5 text-ds-accent" />
              <span>Date:</span>
            </span>

            {/* Date Preset Tabs */}
            <div className="flex items-center gap-1 bg-ds-dark p-1 rounded-xl border border-ds-border text-[11px] font-heading font-bold">
              {(
                [
                  { id: 'ALL', label: 'All Dates' },
                  { id: 'TODAY', label: 'Today' },
                  { id: 'YESTERDAY', label: 'Yesterday' },
                  { id: '7DAYS', label: '7 Days' },
                  { id: 'MONTH', label: 'Month' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetClick(preset.id)}
                  className={`px-2.5 py-1 rounded-lg uppercase transition-all ${
                    datePreset === preset.id && !customDate
                      ? 'bg-ds-accent text-white shadow-sm'
                      : 'text-ds-text-dim hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom Date Input */}
            <div className="flex items-center gap-1.5 bg-ds-dark px-2.5 py-1 rounded-xl border border-ds-border">
              <input
                type="date"
                value={customDate}
                onChange={(e) => {
                  setCustomDate(e.target.value);
                  setDatePreset(e.target.value ? 'CUSTOM' : 'ALL');
                }}
                className="bg-transparent text-xs text-ds-text font-mono [color-scheme:dark] focus:outline-none cursor-pointer"
                title="Select specific date"
              />
              {customDate && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomDate('');
                    setDatePreset('ALL');
                  }}
                  className="text-ds-text-dim hover:text-white ml-1"
                  title="Clear custom date"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Reset All Filters Button */}
            {isAnyFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-1 rounded-xl text-[11px] font-heading font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition-colors flex items-center gap-1 shrink-0 ml-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset All Filters</span>
              </button>
            )}
          </div>

          <div className="text-[11px] text-ds-text-dim font-mono">
            Showing <strong className="text-ds-text">{filteredBookings.length}</strong> of{' '}
            <strong className="text-ds-text">{bookings.length}</strong> bookings
          </div>
        </div>
      </div>

      {/* Table Card */}
      <Card glass className="border-ds-border overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-xs text-ds-text-dim flex flex-col items-center gap-2">
            <RotateCw className="w-5 h-5 animate-spin text-ds-accent" />
            <span>Loading reservations...</span>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="p-16 text-center text-xs text-ds-text-dim space-y-2">
            <p>No reservations found matching your filters.</p>
            {isAnyFilterActive && (
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                Clear All Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-ds-dark/60 text-ds-text-dim uppercase text-[10px] font-mono border-b border-ds-border">
                <tr>
                  <th className="py-3 px-4">Ref #</th>
                  <th className="py-3 px-4">Player Details</th>
                  <th className="py-3 px-4">Booked Via</th>
                  <th className="py-3 px-4">Station</th>
                  <th className="py-3 px-4">Time Window</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions & Pass</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ds-border/40">
                {filteredBookings.map((b) => {
                  const canMarkPaid =
                    b.paymentStatus !== 'COMPLETED' &&
                    !['CANCELLED', 'NO_SHOW', 'PAYMENT_FAILED'].includes(b.status);
                  const canCancelOrNoShow = ['PENDING', 'CONFIRMED'].includes(b.status);
                  const isBusy = actionLoadingId === b.id;

                  return (
                    <tr key={b.id} className="hover:bg-ds-surface/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-ds-ice">{b.bookingRef}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-heading font-bold text-ds-text">{b.customerName}</div>
                        <div className="text-[11px] text-ds-text-dim">{b.customerEmail || b.customerPhone}</div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {b.isWalkIn ? (
                          <div>
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-300 font-heading font-bold text-[10px] uppercase tracking-wider">
                              <UserCheck className="w-3 h-3 text-amber-400 shrink-0" />
                              <span>Desk Walk-in</span>
                            </div>
                            <div className="text-[11px] text-ds-text-muted mt-1 flex items-center gap-1">
                              <span className="text-[10px] text-ds-text-dim font-mono">Staff:</span>
                              <span className="font-semibold text-ds-ice truncate max-w-[140px]">
                                {b.staffName || 'Front Desk'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/25 text-sky-400 font-heading font-bold text-[10px] uppercase tracking-wider">
                              <Globe className="w-3 h-3 text-sky-400 shrink-0" />
                              <span>Online</span>
                            </div>
                            <div className="text-[10px] text-ds-text-dim mt-1 font-mono">
                              Customer Portal
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-ds-text">{b.stationName}</div>
                        <div className="text-[10px] text-ds-accent">{b.facilityName}</div>
                        {b.gameTitle && (
                          <div className="inline-flex items-center gap-1 text-[11px] text-ds-cyan font-mono mt-0.5">
                            <span>🎮</span>
                            <span className="truncate max-w-[130px] font-medium">{b.gameTitle}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-ds-text">
                        <div>
                          {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                          {new Date(b.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <span className="text-[10px] text-ds-text-dim">
                          {new Date(b.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-heading font-extrabold text-ds-text">
                        ₹{(b.totalPricePaise / 100).toFixed(0)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-[11px] font-mono block text-ds-text">{b.paymentMethod || '—'}</span>
                        <span
                          className={`text-[10px] font-semibold ${
                            b.paymentStatus === 'COMPLETED'
                              ? 'text-emerald-400'
                              : b.paymentStatus === 'PENDING' || b.paymentStatus === 'UNPAID'
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {b.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          variant={
                            b.status === 'CONFIRMED'
                              ? 'success'
                              : b.status === 'IN_PROGRESS' || b.status === 'CHECKED_IN'
                              ? 'accent'
                              : b.status === 'COMPLETED'
                              ? 'default'
                              : b.status === 'CANCELLED' || b.status === 'NO_SHOW'
                              ? 'danger'
                              : 'warning'
                          }
                          size="sm"
                          className="font-mono text-[10px]"
                        >
                          {b.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {canMarkPaid && (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleBookingAction(b, 'MARK_PAID', 'CASH')}
                                className="px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 text-[10px] font-heading font-bold uppercase transition-colors flex items-center gap-1"
                                title="Settle Pending Payment via Cash"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Cash</span>
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleBookingAction(b, 'MARK_PAID', 'UPI')}
                                className="px-2 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 hover:bg-sky-500/25 text-[10px] font-heading font-bold uppercase transition-colors flex items-center gap-1"
                                title="Settle Pending Payment via UPI"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>UPI</span>
                              </button>
                            </>
                          )}
                          {canCancelOrNoShow && (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleBookingAction(b, 'NO_SHOW')}
                                className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 hover:bg-amber-500/20 text-[10px] font-heading font-bold uppercase transition-colors"
                                title="Mark as No-Show"
                              >
                                No-Show
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleBookingAction(b, 'CANCEL')}
                                className="px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-400 hover:bg-rose-500/20 text-[10px] font-heading font-bold uppercase transition-colors"
                                title="Cancel Reservation"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          <Link href={`/booking/confirmation/${b.bookingRef || b.id}`} target="_blank">
                            <Button variant="outline" size="sm" className="text-[11px] py-1 px-2.5">
                              <ExternalLink className="w-3.5 h-3.5 mr-1" />
                              <span>Pass</span>
                            </Button>
                          </Link>
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
    </div>
  );
}
