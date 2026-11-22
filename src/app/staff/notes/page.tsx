'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  Plus,
  Search,
  Clock,
  User,
  Phone,
  Gamepad2,
  Users,
  CheckCircle2,
  Trash2,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Filter,
  AlertCircle,
  X,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';

interface QuickNote {
  id: string;
  customerName: string;
  timeSlot: string;
  phone?: string | null;
  stationPreference?: string | null;
  playerCount: number;
  note?: string | null;
  status: 'PENDING' | 'SEATED' | 'COMPLETED' | 'CANCELLED';
  staffName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function StaffQuickNotesPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [filterTab, setFilterTab] = useState<'ACTIVE' | 'SEATED' | 'ALL'>('ACTIVE');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [phone, setPhone] = useState('');
  const [stationPreference, setStationPreference] = useState('PS5');
  const [playerCount, setPlayerCount] = useState(1);
  const [noteText, setNoteText] = useState('');

  // Fetch Notes
  const fetchNotes = useCallback(async (tab: 'ACTIVE' | 'SEATED' | 'ALL' = filterTab, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/staff/notes?status=${tab}`, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      const json = await res.json();
      if (res.ok && json.success && Array.isArray(json.data)) {
        setNotes(json.data);
      } else {
        if (!silent) toast.error(json.error?.message || 'Failed to load quick notes');
      }
    } catch {
      if (!silent) toast.error('Failed to load quick notes');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filterTab]);

  useEffect(() => {
    fetchNotes(filterTab, false);
    // Silent auto-refresh every 20 seconds so all staff iPads stay in sync
    const interval = setInterval(() => {
      fetchNotes(filterTab, true);
    }, 20000);
    return () => clearInterval(interval);
  }, [filterTab, fetchNotes]);

  // Real-time client-side search filtering across name, phone, console preference, and note
  const filteredNotes = notes.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      item.customerName.toLowerCase().includes(q) ||
      (item.phone && item.phone.toLowerCase().includes(q)) ||
      (item.stationPreference && item.stationPreference.toLowerCase().includes(q)) ||
      (item.note && item.note.toLowerCase().includes(q))
    );
  });

  // Quick preset helper for arrival time
  const handleTimePreset = (minutesAhead: number) => {
    const target = new Date(Date.now() + minutesAhead * 60 * 1000);
    const timeFormatted = target.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    setTimeSlot(timeFormatted);
  };

  // Create Note
  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      toast.error('Please enter customer name');
      return;
    }
    if (!timeSlot.trim()) {
      toast.error('Please enter the arrival / slot time');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/staff/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          timeSlot: timeSlot.trim(),
          phone: phone.trim() || null,
          stationPreference: stationPreference || null,
          playerCount: Number(playerCount) || 1,
          note: noteText.trim() || null,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(`Quick note saved for ${customerName}`);
        // Reset form
        setCustomerName('');
        setTimeSlot('');
        setPhone('');
        setNoteText('');
        setPlayerCount(1);
        setShowCreateModal(false);
        fetchNotes(filterTab, true);
      } else {
        toast.error(json.error?.message || 'Failed to save note');
      }
    } catch {
      toast.error('Network error saving note');
    } finally {
      setSubmitting(false);
    }
  };

  // Update Status (Seat / Complete / Cancel)
  const handleUpdateStatus = async (noteId: string, status: 'PENDING' | 'SEATED' | 'COMPLETED' | 'CANCELLED') => {
    try {
      const res = await fetch('/api/staff/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId, status }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(status === 'SEATED' ? 'Marked as Seated!' : `Status updated to ${status}`);
        setNotes((prev) =>
          prev.map((item) => (item.id === noteId ? { ...item, status } : item))
        );
      } else {
        toast.error(json.error?.message || 'Failed to update note');
      }
    } catch {
      toast.error('Network error updating status');
    }
  };

  // Delete Note
  const handleDeleteNote = async (noteId: string, name: string) => {
    if (!confirm(`Remove quick note for "${name}"?`)) return;
    try {
      const res = await fetch('/api/staff/notes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success('Note removed');
        setNotes((prev) => prev.filter((item) => item.id !== noteId));
      } else {
        toast.error(json.error?.message || 'Failed to delete note');
      }
    } catch {
      toast.error('Network error deleting note');
    }
  };

  const activeCount = notes.filter((n) => n.status === 'PENDING').length;

  return (
    <div className="min-h-screen bg-ds-darker p-4 sm:p-6 lg:p-8 text-ds-text">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-ds-border">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-ds-surface border border-ds-accent/40 flex items-center justify-center text-ds-ice shadow-lg shadow-ds-accent/15">
              <ClipboardList className="w-5 h-5 text-ds-accent" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-heading font-black uppercase tracking-wider text-white">
                Quick Desk Notes
              </h1>
              <p className="text-xs text-ds-text-dim font-mono">
                Front desk scratchpad for customer arrivals, waiting list & quick reminders
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fetchNotes(filterTab, false)}
            disabled={loading}
            className="p-2.5 rounded-xl bg-ds-surface border border-ds-border hover:border-ds-border-light text-ds-text-muted hover:text-white transition-all cursor-pointer"
            title="Refresh notes"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin text-ds-accent' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-ds-accent text-ds-darker font-heading font-bold text-xs uppercase tracking-wider hover:bg-ds-accent-hover transition-all shadow-lg shadow-ds-accent/20 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            New Note
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-1.5 p-1 bg-ds-surface rounded-xl border border-ds-border w-fit">
          <button
            type="button"
            onClick={() => setFilterTab('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold uppercase tracking-wider transition-all cursor-pointer ${
              filterTab === 'ACTIVE'
                ? 'bg-ds-accent text-ds-darker shadow-sm'
                : 'text-ds-text-muted hover:text-white'
            }`}
          >
            Waiting / Active {activeCount > 0 && `(${activeCount})`}
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('SEATED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold uppercase tracking-wider transition-all cursor-pointer ${
              filterTab === 'SEATED'
                ? 'bg-ds-accent text-ds-darker shadow-sm'
                : 'text-ds-text-muted hover:text-white'
            }`}
          >
            Seated / Attended
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold uppercase tracking-wider transition-all cursor-pointer ${
              filterTab === 'ALL'
                ? 'bg-ds-accent text-ds-darker shadow-sm'
                : 'text-ds-text-muted hover:text-white'
            }`}
          >
            All Notes
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-ds-text-dim absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer name, phone, or note..."
            className="w-full pl-10 pr-4 py-2 bg-ds-surface border border-ds-border rounded-xl text-xs text-ds-text placeholder:text-ds-text-dim focus:outline-none focus:border-ds-accent transition-colors"
          />
        </div>
      </div>

      {/* Notes Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-44 rounded-2xl bg-ds-surface/50 border border-ds-border animate-pulse p-5"
            />
          ))}
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="bg-ds-surface border border-ds-border rounded-2xl p-12 text-center max-w-lg mx-auto">
          <ClipboardList className="w-12 h-12 text-ds-text-dim mx-auto mb-3 opacity-60" />
          <h3 className="text-base font-heading font-bold uppercase tracking-wider text-white mb-1">
            {searchQuery.trim() ? 'No Matching Notes' : 'No Desk Notes Found'}
          </h3>
          <p className="text-xs text-ds-text-muted mb-5">
            {searchQuery.trim()
              ? `No notes match "${searchQuery}".`
              : filterTab === 'ACTIVE'
              ? 'No customers currently on the waiting list or pending arrival.'
              : 'No notes match your current filter.'}
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-ds-surface-2 border border-ds-accent/40 text-ds-ice text-xs font-heading font-bold uppercase tracking-wider hover:bg-ds-accent hover:text-ds-darker transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Quick Note
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotes.map((item) => {
            const isPending = item.status === 'PENDING';
            const isSeated = item.status === 'SEATED';

            return (
              <div
                key={item.id}
                className={`relative rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                  isPending
                    ? 'bg-ds-surface border-ds-accent/30 shadow-lg shadow-black/40 hover:border-ds-accent/60'
                    : isSeated
                    ? 'bg-ds-surface/60 border-emerald-500/30 opacity-80'
                    : 'bg-ds-surface/40 border-ds-border opacity-60'
                }`}
              >
                <div>
                  {/* Card Header: Customer & Time Badge */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-heading font-black text-base uppercase tracking-wider text-white truncate block">
                          {item.customerName}
                        </span>
                        {isSeated && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 font-bold shrink-0">
                            SEATED
                          </span>
                        )}
                      </div>
                      {item.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-ds-text-dim font-mono">
                          <Phone className="w-3 h-3 text-ds-accent" />
                          <span>{item.phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Time Slot Badge */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-ds-darker border border-ds-accent/40 text-ds-ice font-mono text-xs font-bold shrink-0 shadow-sm">
                      <Clock className="w-3.5 h-3.5 text-ds-accent" />
                      <span>{item.timeSlot}</span>
                    </div>
                  </div>

                  {/* Badges: Station Preference & Players */}
                  <div className="flex flex-wrap items-center gap-2 mb-3 text-xs font-mono">
                    {item.stationPreference && (
                      <span className="px-2 py-0.5 rounded-md bg-ds-surface-2 border border-ds-border text-ds-text-muted flex items-center gap-1">
                        <Gamepad2 className="w-3 h-3 text-ds-accent" />
                        {item.stationPreference}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md bg-ds-surface-2 border border-ds-border text-ds-text-muted flex items-center gap-1">
                      <Users className="w-3 h-3 text-ds-text-dim" />
                      {item.playerCount} {item.playerCount === 1 ? 'Player' : 'Players'}
                    </span>
                  </div>

                  {/* Note Body */}
                  {item.note && (
                    <div className="p-3 rounded-xl bg-ds-darker/60 border border-ds-border/60 text-xs text-ds-text-muted mb-4 font-sans leading-relaxed whitespace-pre-wrap">
                      {item.note}
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="pt-3 border-t border-ds-border flex items-center justify-between gap-2 mt-2">
                  <span className="text-[10px] text-ds-text-dim font-mono truncate">
                    By {item.staffName || 'Staff'} • {new Date(item.createdAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                  </span>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isPending ? (
                      <>
                        <Link
                          href={`/staff?quickname=${encodeURIComponent(item.customerName)}&quickphone=${encodeURIComponent(item.phone || '')}`}
                          className="px-2.5 py-1.5 rounded-lg bg-ds-accent/20 border border-ds-accent/40 text-ds-ice hover:bg-ds-accent hover:text-ds-darker text-[11px] font-heading font-bold uppercase transition-all flex items-center gap-1"
                          title="Open Floor Arena to Seat"
                        >
                          Seat
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(item.id, 'SEATED')}
                          className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-black transition-all cursor-pointer"
                          title="Mark Seated"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(item.id, 'PENDING')}
                        className="px-2 py-1 rounded-lg bg-ds-surface-2 border border-ds-border text-[10px] text-ds-text-dim hover:text-white transition-all cursor-pointer"
                        title="Re-open note"
                      >
                        Re-open
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteNote(item.id, item.customerName)}
                      className="p-1.5 rounded-lg text-ds-text-dim hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                      title="Delete note"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Quick Note Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-ds-surface border border-ds-accent/40 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-ds-border mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-ds-accent/20 border border-ds-accent/40 flex items-center justify-center text-ds-ice">
                  <ClipboardList className="w-4 h-4 text-ds-accent" />
                </div>
                <h2 className="font-heading font-black text-lg uppercase tracking-wider text-white">
                  Add Quick Note
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-ds-text-dim hover:text-white hover:bg-ds-surface-2 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNote} className="space-y-4">
              {/* Customer Name */}
              <div>
                <label className="block text-xs font-heading font-bold uppercase tracking-wider text-ds-text-muted mb-1.5">
                  Customer Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-ds-text-dim absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full pl-10 pr-4 py-2.5 bg-ds-darker border border-ds-border rounded-xl text-sm text-ds-text placeholder:text-ds-text-dim focus:outline-none focus:border-ds-accent transition-colors"
                  />
                </div>
              </div>

              {/* Time Slot with Quick Preset Buttons */}
              <div>
                <label className="block text-xs font-heading font-bold uppercase tracking-wider text-ds-text-muted mb-1.5">
                  Arrival / Target Time *
                </label>
                <div className="relative mb-2">
                  <Clock className="w-4 h-4 text-ds-text-dim absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={timeSlot}
                    onChange={(e) => setTimeSlot(e.target.value)}
                    placeholder="e.g. 08:30 PM, In 15 mins, or 9:00 PM"
                    className="w-full pl-10 pr-4 py-2.5 bg-ds-darker border border-ds-border rounded-xl text-sm text-ds-text placeholder:text-ds-text-dim focus:outline-none focus:border-ds-accent transition-colors"
                  />
                </div>

                {/* Fast Preset Buttons */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-ds-text-dim font-mono">Quick:</span>
                  <button
                    type="button"
                    onClick={() => handleTimePreset(0)}
                    className="px-2 py-1 rounded-md bg-ds-surface-2 hover:bg-ds-accent/20 hover:text-ds-ice border border-ds-border text-[11px] font-mono transition-colors cursor-pointer"
                  >
                    Now
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTimePreset(15)}
                    className="px-2 py-1 rounded-md bg-ds-surface-2 hover:bg-ds-accent/20 hover:text-ds-ice border border-ds-border text-[11px] font-mono transition-colors cursor-pointer"
                  >
                    +15m
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTimePreset(30)}
                    className="px-2 py-1 rounded-md bg-ds-surface-2 hover:bg-ds-accent/20 hover:text-ds-ice border border-ds-border text-[11px] font-mono transition-colors cursor-pointer"
                  >
                    +30m
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTimePreset(60)}
                    className="px-2 py-1 rounded-md bg-ds-surface-2 hover:bg-ds-accent/20 hover:text-ds-ice border border-ds-border text-[11px] font-mono transition-colors cursor-pointer"
                  >
                    +1 hr
                  </button>
                </div>
              </div>

              {/* Phone & Station Preference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-heading font-bold uppercase tracking-wider text-ds-text-muted mb-1.5">
                    Phone (Optional)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-ds-text-dim absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="10-digit number"
                      className="w-full pl-10 pr-4 py-2 bg-ds-darker border border-ds-border rounded-xl text-xs text-ds-text placeholder:text-ds-text-dim focus:outline-none focus:border-ds-accent transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-heading font-bold uppercase tracking-wider text-ds-text-muted mb-1.5">
                    Station / Arena
                  </label>
                  <select
                    value={stationPreference}
                    onChange={(e) => setStationPreference(e.target.value)}
                    className="w-full px-3 py-2 bg-ds-darker border border-ds-border rounded-xl text-xs text-ds-text focus:outline-none focus:border-ds-accent transition-colors"
                  >
                    <option value="PS5">PlayStation 5</option>
                    <option value="POOL_TABLE">Snooker / Pool Table</option>
                    <option value="ANY">Any Available Station</option>
                  </select>
                </div>
              </div>

              {/* Number of Players */}
              <div>
                <label className="block text-xs font-heading font-bold uppercase tracking-wider text-ds-text-muted mb-1.5">
                  Number of Players
                </label>
                <div className="flex items-center gap-3">
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPlayerCount(num)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                        playerCount === num
                          ? 'bg-ds-accent text-ds-darker border-ds-accent'
                          : 'bg-ds-darker text-ds-text-muted border-ds-border hover:border-ds-border-light'
                      }`}
                    >
                      {num} {num === 1 ? 'Player' : 'Players'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note / Instruction */}
              <div>
                <label className="block text-xs font-heading font-bold uppercase tracking-wider text-ds-text-muted mb-1.5">
                  Notes / Special Instructions
                </label>
                <textarea
                  rows={2}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="e.g. Waiting in lounge, wants FC 25, advance ₹100 paid"
                  className="w-full p-3 bg-ds-darker border border-ds-border rounded-xl text-xs text-ds-text placeholder:text-ds-text-dim focus:outline-none focus:border-ds-accent transition-colors resize-none"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-ds-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-ds-surface-2 border border-ds-border text-xs font-heading font-bold uppercase tracking-wider text-ds-text-muted hover:text-white transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-ds-accent text-ds-darker font-heading font-bold text-xs uppercase tracking-wider hover:bg-ds-accent-hover transition-all shadow-lg shadow-ds-accent/20 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Quick Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
