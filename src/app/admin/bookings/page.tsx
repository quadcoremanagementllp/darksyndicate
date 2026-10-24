'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import {
  Search,
  ExternalLink,
  RotateCw,
  Globe,
  UserCheck,
  X,
  Download,
  CheckCircle2,
  Trash2,
  CheckSquare,
  Square,
  Info,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

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

interface SelectedBooking {
  bookingRef: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  playerCount?: number | null;
  stationName: string;
  facilityName: string;
  bookedVia?: string | null;
  isWalkIn: boolean;
  staffName?: string | null;
  gameTitle?: string | null;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  totalPricePaise: number;
  paymentMethod?: string | null;
  paymentStatus: string;
  status: string;
  session?: { startedAt: string; endedAt?: string | null } | null;
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [channelFilter, setChannelFilter] = useState<'ALL' | 'ONLINE' | 'DESK'>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [todayOnly, setTodayOnly] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<SelectedBooking | null>(null);

  // Row selection and deletion states
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [clearLoading, setClearLoading] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);

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

  const handleDeleteSingle = async (b: any) => {
    if (
      !confirm(
        `Permanently delete reservation ${b.bookingRef} (${b.customerName})? This will remove it from the ledger.`
      )
    ) {
      return;
    }
    setDeleteLoadingId(b.id);
    try {
      const res = await fetch('/api/admin/bookings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: b.id }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.data?.message || 'Reservation deleted');
        setSelectedIds((prev) => prev.filter((id) => id !== b.id));
        loadBookings();
      } else {
        toast.error(json.error?.message || 'Failed to delete reservation');
      }
    } catch {
      toast.error('Network error while deleting reservation');
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (
      !confirm(
        `Permanently delete the ${selectedIds.length} selected reservation(s)? This will remove them from the ledger.`
      )
    ) {
      return;
    }
    setClearLoading(true);
    try {
      const res = await fetch('/api/admin/bookings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingIds: selectedIds }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.data?.message || `Deleted ${selectedIds.length} reservation(s)`);
        setSelectedIds([]);
        loadBookings();
      } else {
        toast.error(json.error?.message || 'Failed to delete selected reservations');
      }
    } catch {
      toast.error('Network error while deleting reservations');
    } finally {
      setClearLoading(false);
    }
  };

  const handleSelectAllVisible = () => {
    const visibleIds = filteredBookings.map((b) => b.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const isAnyFilterActive =
    channelFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    todayOnly ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    Boolean(search.trim());

  const handleResetFilters = () => {
    setChannelFilter('ALL');
    setStatusFilter('ALL');
    setDateFrom('');
    setDateTo('');
    setTodayOnly(false);
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

    if (todayOnly) {
      matchesDate = bDateStr === getKolkataDateString(new Date());
    } else {
      matchesDate = (!dateFrom || bDateStr >= dateFrom) && (!dateTo || bDateStr <= dateTo);
    }

    return matchesStatus && matchesChannel && matchesSearch && matchesDate;
  });

  const visibleIds = filteredBookings.map((b) => b.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

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
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-black uppercase text-ds-text tracking-tight">
            <span>All Reservations Ledger</span>
          </h1>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          disabled={filteredBookings.length === 0}
          className="text-xs font-heading font-bold whitespace-nowrap h-8"
        >
          <Download className="w-3.5 h-3.5 mr-1.5" />
          <span>CSV</span>
        </Button>
      </div>

      {/* Filter Bar (3 Clean Balanced Tiers) */}
      <div className="space-y-3 bg-ds-surface/50 p-3.5 sm:p-4 rounded-2xl border border-ds-border shadow-lg">
        {/* Source channels and search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Source Tabs */}
            <div className="flex items-center gap-1 bg-ds-dark p-1 rounded-xl border border-ds-border text-xs shrink-0">
              <button
                onClick={() => setChannelFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg font-heading font-bold uppercase transition-all whitespace-nowrap cursor-pointer ${
                  channelFilter === 'ALL'
                    ? 'bg-ds-surface text-white shadow-sm border border-ds-border'
                    : 'text-ds-text-dim hover:text-white'
                }`}
              >
                All Sources
              </button>
              <button
                onClick={() => setChannelFilter('ONLINE')}
                className={`px-3 py-1.5 rounded-lg font-heading font-bold uppercase transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  channelFilter === 'ONLINE'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                    : 'text-ds-text-dim hover:text-white'
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                <span>Online ({onlineCount})</span>
              </button>
              <button
                onClick={() => setChannelFilter('DESK')}
                className={`px-3 py-1.5 rounded-lg font-heading font-bold uppercase transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  channelFilter === 'DESK'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-ds-text-dim hover:text-white'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Desk ({deskCount})</span>
              </button>
            </div>

          </div>

          {/* Search Bar - Responsive without overflowing card on tablet */}
          <div className="relative flex-1 min-w-0 max-w-full md:max-w-xs lg:max-w-sm">
            <Input
              placeholder="Search ref, player, staff, station..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs py-1.5 pl-8 pr-7 w-full bg-ds-dark/90 focus:border-ds-accent"
            />
            <Search className="w-3.5 h-3.5 text-ds-text-dim absolute left-2.5 top-2.5" />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2 text-ds-text-dim hover:text-white cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tier 2: Reservation Status Tabs - Clean wrapping so no tabs get cut off */}
        <div className="flex flex-wrap items-center gap-1.5 bg-ds-dark/60 p-1.5 rounded-xl border border-ds-border text-xs">
          {[
            { id: 'ALL', label: 'All Statuses' },
            { id: 'CONFIRMED', label: 'Confirmed' },
            { id: 'CHECKED_IN', label: 'Checked In' },
            { id: 'IN_PROGRESS', label: 'In Progress' },
            { id: 'COMPLETED', label: 'Completed' },
            { id: 'PENDING', label: 'Pending' },
            { id: 'CANCELLED', label: 'Cancelled' },
            { id: 'NO_SHOW', label: 'No Show' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              className={`px-3 py-1.5 rounded-lg font-heading font-bold uppercase transition-all whitespace-nowrap text-[11px] sm:text-xs cursor-pointer ${
                statusFilter === st.id
                  ? 'bg-ds-accent text-white shadow-sm'
                  : 'text-ds-text-dim hover:text-white hover:bg-ds-surface/50'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* Date range and record count */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-ds-border/50 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setTodayOnly(!todayOnly);
                setDateFrom('');
                setDateTo('');
              }}
              aria-pressed={todayOnly}
              className={`px-3 py-2 rounded-xl border font-heading font-bold ${todayOnly ? 'bg-ds-accent text-white border-ds-accent' : 'bg-ds-dark text-ds-text-muted border-ds-border hover:text-white'}`}
            >
              Today Only
            </button>
            <label className="flex items-center gap-2 text-ds-text-muted font-semibold">
              From
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => { setDateFrom(e.target.value); setTodayOnly(false); }}
                className="bg-ds-dark border border-ds-border rounded-xl px-3 py-2 text-ds-text font-mono [color-scheme:dark] focus:outline-none focus:border-ds-accent"
              />
            </label>
            <label className="flex items-center gap-2 text-ds-text-muted font-semibold">
              To
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => { setDateTo(e.target.value); setTodayOnly(false); }}
                className="bg-ds-dark border border-ds-border rounded-xl px-3 py-2 text-ds-text font-mono [color-scheme:dark] focus:outline-none focus:border-ds-accent"
              />
            </label>
          </div>

          {/* Sub-bar on tablet / right aligned on desktop: Filter Reset & Count */}
          <div className="flex items-center justify-between lg:justify-end gap-3 text-[11px] font-mono shrink-0">
            {isAnyFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-1 rounded-xl text-[11px] font-heading font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}

            <div className="text-ds-text-dim">
              Showing <strong className="text-ds-text">{filteredBookings.length}</strong> of{' '}
              <strong className="text-ds-text">{bookings.length}</strong> bookings
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/30 shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-mono font-bold text-xs border border-rose-500/30">
              {selectedIds.length} Selected
            </span>
            <span className="text-xs text-ds-text-muted">
              Select records to remove from the ledger.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds([])}
              className="text-xs py-1"
            >
              Clear Selection
            </Button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={clearLoading}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-heading font-bold text-xs uppercase flex items-center gap-1.5 transition-all shadow-md shadow-rose-900/40 disabled:opacity-50"
            >
              <Trash2 className={`w-3.5 h-3.5 ${clearLoading ? 'animate-spin' : ''}`} />
              <span>Delete Selected ({selectedIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Ledger table */}
      {loading ? (
        <Card glass className="border-ds-border p-16 text-center text-xs text-ds-text-dim flex flex-col items-center gap-2">
          <RotateCw className="w-5 h-5 animate-spin text-ds-accent" />
          <span>Loading reservations...</span>
        </Card>
      ) : filteredBookings.length === 0 ? (
        <Card glass className="border-ds-border p-16 text-center text-xs text-ds-text-dim space-y-2">
          <p>No reservations found matching your filters.</p>
          {isAnyFilterActive && (
            <Button variant="outline" size="sm" onClick={handleResetFilters} className="cursor-pointer">
              Clear All Filters
            </Button>
          )}
        </Card>
      ) : (
        <Card glass className="border-ds-border overflow-hidden shadow-lg">
          <p className="xl:hidden px-4 py-2.5 border-b border-ds-border bg-ds-dark/95 text-[11px] font-mono text-ds-text-dim">
            Swipe horizontally to see all columns.
          </p>
          <div className="overflow-x-auto relative">
            <table className="w-full text-left text-xs min-w-[1080px]">
              <thead className="bg-ds-dark/80 text-ds-text-dim uppercase text-[10px] font-mono border-b border-ds-border">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">
                    <button
                      type="button"
                      onClick={handleSelectAllVisible}
                      className="text-ds-text-dim hover:text-white transition-colors cursor-pointer"
                      title={allVisibleSelected ? 'Deselect all' : 'Select all visible'}
                    >
                      {allVisibleSelected ? (
                        <CheckSquare className="w-4 h-4 text-rose-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4 min-w-[140px] whitespace-nowrap">Ref #</th>
                  <th className="py-3 px-4 min-w-[160px] whitespace-nowrap">Player Details</th>
                  <th className="py-3 px-4 min-w-[140px] whitespace-nowrap">Booked Via</th>
                  <th className="py-3 px-4 min-w-[160px] whitespace-nowrap">Station</th>
                  <th className="py-3 px-4 min-w-[170px] whitespace-nowrap">Time Window</th>
                  <th className="py-3 px-4 min-w-[90px] whitespace-nowrap">Amount</th>
                  <th className="py-3 px-4 min-w-[110px] whitespace-nowrap">Payment</th>
                  <th className="py-3 px-4 min-w-[110px] whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 text-right min-w-[200px] whitespace-nowrap sticky right-0 bg-ds-dark/95 backdrop-blur-md z-20 shadow-[-10px_0_15px_rgba(0,0,0,0.5)]">
                    Actions & Pass
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ds-border/40">
                {filteredBookings.map((b) => {
                  const canMarkPaid =
                    b.paymentStatus !== 'COMPLETED' &&
                    !['CANCELLED', 'NO_SHOW', 'PAYMENT_FAILED'].includes(b.status);
                  const canCancelOrNoShow = ['PENDING', 'CONFIRMED'].includes(b.status);
                  const isBusy = actionLoadingId === b.id;
                  const isRowSelected = selectedIds.includes(b.id);

                  return (
                    <tr
                      key={b.id}
                      className={`hover:bg-ds-surface/40 transition-colors ${
                        isRowSelected ? 'bg-rose-500/5' : ''
                      }`}
                    >
                      <td className="py-3.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(b.id)}
                          className="text-ds-text-dim hover:text-white transition-colors cursor-pointer"
                        >
                          {isRowSelected ? (
                            <CheckSquare className="w-4 h-4 text-rose-400" />
                          ) : (
                            <Square className="w-4 h-4 text-ds-border hover:text-ds-text" />
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-xs text-ds-ice bg-ds-dark/80 border border-ds-border/80 px-2.5 py-1 rounded-lg select-all tracking-tight shadow-sm inline-block whitespace-nowrap">
                          {b.bookingRef}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 min-w-[160px]">
                        <div className="font-heading font-bold text-ds-text whitespace-nowrap">{b.customerName}</div>
                        <div className="text-[11px] text-ds-text-dim truncate max-w-[180px]">{b.customerEmail || b.customerPhone || '—'}</div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap min-w-[140px]">
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
                              {b.staffName ? `Staff: ${b.staffName}` : 'Customer Portal'}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 min-w-[160px]">
                        <div className="font-semibold text-ds-text whitespace-nowrap">{b.stationName}</div>
                        <div className="text-[10px] text-ds-accent whitespace-nowrap">{b.facilityName}</div>
                        {b.gameTitle && (
                          <div className="inline-flex items-center gap-1 text-[11px] text-ds-cyan font-mono mt-0.5 whitespace-nowrap">
                            <span>🎮</span>
                            <span className="truncate max-w-[140px] font-medium">{b.gameTitle}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-ds-text min-w-[170px]">
                        <div className="font-bold text-ds-ice whitespace-nowrap">
                          {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                          {new Date(b.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <span className="text-[10px] text-ds-text-dim block whitespace-nowrap mt-0.5">
                          {new Date(b.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-heading font-extrabold text-ds-text text-sm min-w-[90px]">
                        ₹{(b.totalPricePaise / 100).toFixed(0)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap min-w-[110px]">
                        <span className="text-[11px] font-mono block text-ds-text whitespace-nowrap">{b.paymentMethod || '—'}</span>
                        <span
                          className={`text-[10px] font-semibold whitespace-nowrap ${
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
                      <td className="py-3.5 px-4 whitespace-nowrap min-w-[110px]">
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
                          className="font-mono text-[10px] whitespace-nowrap"
                        >
                          {b.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap sticky right-0 bg-ds-dark/95 backdrop-blur-md z-10 shadow-[-10px_0_15px_rgba(0,0,0,0.5)]">
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          {canMarkPaid && (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleBookingAction(b, 'MARK_PAID', 'CASH')}
                                className="px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 text-[10px] font-heading font-bold uppercase transition-colors flex items-center gap-1 cursor-pointer"
                                title="Settle Pending Payment via Cash"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Cash</span>
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleBookingAction(b, 'MARK_PAID', 'UPI')}
                                className="px-2 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 hover:bg-sky-500/25 text-[10px] font-heading font-bold uppercase transition-colors flex items-center gap-1 cursor-pointer"
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
                                className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 hover:bg-amber-500/20 text-[10px] font-heading font-bold uppercase transition-colors cursor-pointer"
                                title="Mark as No-Show"
                              >
                                No-Show
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleBookingAction(b, 'CANCEL')}
                                className="px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-400 hover:bg-rose-500/20 text-[10px] font-heading font-bold uppercase transition-colors cursor-pointer"
                                title="Cancel Reservation"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          <Link href={`/booking/confirmation/${b.bookingRef || b.id}`} target="_blank">
                            <Button variant="outline" size="sm" className="text-[11px] py-1 px-2.5 cursor-pointer">
                              <ExternalLink className="w-3.5 h-3.5 mr-1" />
                              <span>Pass</span>
                            </Button>
                          </Link>

                          <button
                            type="button"
                            onClick={() => setSelectedBooking(b)}
                            className="p-1.5 rounded-lg border border-ds-border text-ds-ice hover:border-ds-accent hover:bg-ds-surface transition-colors"
                            title={`View details for ${b.bookingRef}`}
                            aria-label={`View details for ${b.bookingRef}`}
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            disabled={deleteLoadingId === b.id || isBusy}
                            onClick={() => handleDeleteSingle(b)}
                            className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-400 hover:bg-rose-500/25 hover:text-rose-300 transition-colors disabled:opacity-50 cursor-pointer"
                            title={`Delete reservation ${b.bookingRef}`}
                          >
                            <Trash2 className={`w-3.5 h-3.5 ${deleteLoadingId === b.id ? 'animate-spin' : ''}`} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        isOpen={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        title="Reservation Details"
        description={selectedBooking?.bookingRef}
        size="lg"
      >
        {selectedBooking && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                ['Player', selectedBooking.customerName],
                ['Phone', selectedBooking.customerPhone || '—'],
                ['Email', selectedBooking.customerEmail || '—'],
                ['Players', String(selectedBooking.playerCount ?? '—')],
                ['Station', selectedBooking.stationName],
                ['Facility', selectedBooking.facilityName],
                ['Booking Channel', selectedBooking.bookedVia || (selectedBooking.isWalkIn ? 'Desk Walk-in' : 'Online')],
                ['Booked By', selectedBooking.staffName || 'Customer Portal'],
                ['Game', selectedBooking.gameTitle || '—'],
                ['Date (IST)', getKolkataDateString(selectedBooking.startTime)],
                ['Start (IST)', new Date(selectedBooking.startTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })],
                ['End (IST)', new Date(selectedBooking.endTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })],
                ['Duration', `${Math.floor(selectedBooking.durationMinutes / 60)}h ${selectedBooking.durationMinutes % 60}m`],
                ['Price', `₹${(selectedBooking.totalPricePaise / 100).toLocaleString('en-IN')}`],
                ['Payment Mode', selectedBooking.paymentMethod || 'Unpaid'],
                ['Payment Status', selectedBooking.paymentStatus],
                ['Booking Status', selectedBooking.status],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="rounded-xl border border-ds-border bg-ds-dark/60 px-3 py-2.5 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider font-mono text-ds-text-dim">{label}</p>
                  <p className="mt-1 font-semibold text-ds-text break-words">{value}</p>
                </div>
              ))}
              {selectedBooking.session?.endedAt && (
                <div className="rounded-xl border border-ds-border bg-ds-dark/60 px-3 py-2.5 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider font-mono text-ds-text-dim">Actual Session</p>
                  <p className="mt-1 font-semibold text-ds-text">
                    {Math.max(0, Math.round((new Date(selectedBooking.session.endedAt).getTime() - new Date(selectedBooking.session.startedAt).getTime()) / 60000))} minutes
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSelectedBooking(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
