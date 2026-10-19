'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import {
  Users,
  Search,
  RotateCw,
  UserX,
  UserCheck,
  X,
  Calendar,
  CreditCard,
  Mail,
  Phone,
  ShieldCheck,
  ExternalLink,
  Crown,
  Sparkles,
  Shield,
  Award,
  PlusCircle,
  Trash2,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface CustomerMembership {
  id: string;
  planName: string;
  tier: 'SILVER' | 'GOLD' | 'VIP';
  discountPercent: number;
  expiresAt: string;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED';
  totalBookings: number;
  totalSpentPaise: number;
  joinedAt: string;
  membership?: CustomerMembership | null;
}

interface MembershipPlan {
  id: string;
  slug: string;
  name: string;
  tier: string;
  discountPercent: number;
  pricePaise: number;
  durationDays: number;
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'ALL' | 'VIP' | 'GOLD' | 'SILVER' | 'STANDARD'>('ALL');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Grant Membership form state inside modal
  const [grantingPlanId, setGrantingPlanId] = useState<string>('');
  const [grantPaymentMethod, setGrantPaymentMethod] = useState<'CASH' | 'UPI' | 'OTHER'>('CASH');
  const [grantNotes, setGrantNotes] = useState<string>('Complimentary / VIP upgrade');
  const [submittingGrant, setSubmittingGrant] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const toast = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [custRes, plansRes] = await Promise.all([
        fetch('/api/admin/customers'),
        fetch('/api/membership/plans'),
      ]);
      const custJson = await custRes.json();
      const plansJson = await plansRes.json();

      if (custJson.success && custJson.data) {
        setCustomers(custJson.data || []);
      }
      if (plansJson.success && plansJson.data?.plans) {
        setPlans(plansJson.data.plans || []);
        if (plansJson.data.plans.length > 0 && !grantingPlanId) {
          setGrantingPlanId(plansJson.data.plans[0].id);
        }
      }
    } catch {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleStatus = async (customer: Customer) => {
    const isCurrentlyActive = customer.status === 'ACTIVE';
    const newStatus: 'ACTIVE' | 'SUSPENDED' = isCurrentlyActive ? 'SUSPENDED' : 'ACTIVE';
    const actionWord = isCurrentlyActive ? 'suspend' : 'reactivate';

    if (!window.confirm(`Are you sure you want to ${actionWord} ${customer.name}'s account?`)) {
      return;
    }

    setTogglingId(customer.id);
    try {
      const res = await fetch('/api/admin/customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: customer.id, status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Customer ${customer.name} marked as ${newStatus}`);
        setCustomers((prev) =>
          prev.map((c) => (c.id === customer.id ? { ...c, status: newStatus } : c))
        );
        if (selectedCustomer?.id === customer.id) {
          setSelectedCustomer((prev) => (prev ? { ...prev, status: newStatus } : null));
        }
      } else {
        toast.error(json.error?.message || 'Failed to update status');
      }
    } catch {
      toast.error('Failed to update status');
    } finally {
      setTogglingId(null);
    }
  };

  const handleGrantMembership = async () => {
    if (!selectedCustomer || !grantingPlanId) return;

    setSubmittingGrant(true);
    try {
      const res = await fetch('/api/admin/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedCustomer.id,
          planId: grantingPlanId,
          paymentMethod: grantPaymentMethod,
          notes: grantNotes,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.data.message || 'Membership granted successfully!');
        loadData();
        setSelectedCustomer(null);
      } else {
        toast.error(json.error?.message || 'Failed to grant membership');
      }
    } catch {
      toast.error('Network error granting membership');
    } finally {
      setSubmittingGrant(false);
    }
  };

  const handleRevokeMembership = async (membershipId: string) => {
    if (!window.confirm('Are you sure you want to cancel this customer membership?')) return;

    setRevoking(true);
    try {
      const res = await fetch(`/api/admin/memberships/${membershipId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success('Membership cancelled');
        loadData();
        setSelectedCustomer(null);
      } else {
        toast.error(json.error?.message || 'Failed to revoke membership');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setRevoking(false);
    }
  };

  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.toLowerCase().includes(search.toLowerCase());

    const matchesTier =
      tierFilter === 'ALL' ||
      (tierFilter === 'STANDARD' && !c.membership) ||
      (c.membership && c.membership.tier === tierFilter);

    return matchesSearch && matchesTier;
  });

  const totalRegistered = customers.length;
  const activeCount = customers.filter((c) => c.status === 'ACTIVE').length;
  const memberCount = customers.filter((c) => Boolean(c.membership)).length;
  const totalLifetimePaise = customers.reduce((sum, c) => sum + (c.totalSpentPaise || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-black uppercase text-ds-text">
            Customer Directory
          </h1>
          <p className="text-xs text-ds-text-muted mt-0.5">
            Registered gamers, active syndicate passes, session history, and account controls.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RotateCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-ds-text-dim">Registered Gamers</span>
            <Users className="w-4 h-4 text-ds-ice" />
          </div>
          <div className="mt-2 text-2xl font-heading font-black text-ds-text">{totalRegistered}</div>
          <div className="text-[10px] text-ds-text-dim mt-0.5">All customer accounts</div>
        </Card>

        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-emerald-400">Active Syndicate Passes</span>
            <Crown className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-heading font-black text-amber-400">{memberCount}</div>
          <div className="text-[10px] text-ds-text-dim mt-0.5">Subscribed to passes</div>
        </Card>

        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-emerald-400">Active Accounts</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-heading font-black text-emerald-400">{activeCount}</div>
          <div className="text-[10px] text-ds-text-dim mt-0.5">Good standing status</div>
        </Card>

        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-ds-accent">Community Spend</span>
            <CreditCard className="w-4 h-4 text-ds-accent" />
          </div>
          <div className="mt-2 text-2xl font-heading font-black text-ds-ice">
            ₹{(totalLifetimePaise / 100).toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-ds-text-dim mt-0.5">Lifetime gamer revenue</div>
        </Card>
      </div>

      {/* Search & Tier Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-ds-surface/50 p-4 rounded-2xl border border-ds-border">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search box */}
          <div className="relative w-full sm:w-72">
            <Input
              placeholder="Search gamer by name, email, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs py-1.5 pl-8 pr-7"
            />
            <Search className="w-3.5 h-3.5 text-ds-text-dim absolute left-2.5 top-2.5" />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-2 text-ds-text-dim hover:text-ds-text"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Membership Tier Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(
              [
                { id: 'ALL', label: 'All' },
                { id: 'VIP', label: 'VIP Black' },
                { id: 'GOLD', label: 'Gold' },
                { id: 'SILVER', label: 'Silver' },
                { id: 'STANDARD', label: 'Standard' },
              ] as const
            ).map((tier) => (
              <button
                key={tier.id}
                type="button"
                onClick={() => setTierFilter(tier.id)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-heading font-bold whitespace-nowrap transition-colors ${
                  tierFilter === tier.id
                    ? 'bg-ds-accent text-white shadow-glow-sm'
                    : 'bg-ds-dark border border-ds-border text-ds-text-dim hover:text-white'
                }`}
              >
                {tier.label}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-ds-text-dim font-mono">
          Showing <strong className="text-ds-text">{filteredCustomers.length}</strong> of{' '}
          <strong className="text-ds-text">{customers.length}</strong> gamers
        </div>
      </div>

      {/* Customers Table */}
      <Card variant="glass" className="border-ds-border overflow-hidden p-0">
        {loading ? (
          <div className="p-16 text-center text-xs text-ds-text-dim flex flex-col items-center gap-2">
            <RotateCw className="w-5 h-5 animate-spin text-ds-accent" />
            <span>Loading customer accounts...</span>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-16 text-center text-xs text-ds-text-dim space-y-2">
            <p>No customers found matching your criteria.</p>
            {(search || tierFilter !== 'ALL') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setTierFilter('ALL');
                }}
              >
                Reset Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-ds-dark/60 text-ds-text-dim uppercase text-[10px] font-mono border-b border-ds-border">
                <tr>
                  <th className="py-3 px-4">Gamer Profile</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Syndicate Pass</th>
                  <th className="py-3 px-4">Total Sessions</th>
                  <th className="py-3 px-4">Lifetime Spent</th>
                  <th className="py-3 px-4">Joined Date</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ds-border/40">
                {filteredCustomers.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-ds-surface/60 transition-colors group cursor-pointer"
                    onClick={() => setSelectedCustomer(c)}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-heading font-bold text-ds-text group-hover:text-ds-ice transition-colors">
                        {c.name}
                      </div>
                      <div className="text-[11px] text-ds-text-dim">{c.email}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-ds-text-muted">{c.phone}</td>
                    
                    {/* Membership Column */}
                    <td className="py-3.5 px-4">
                      {c.membership ? (
                        <div className="space-y-0.5">
                          <Badge
                            variant={
                              c.membership.tier === 'VIP'
                                ? 'accent'
                                : c.membership.tier === 'GOLD'
                                ? 'warning'
                                : 'outline'
                            }
                            size="sm"
                            className="font-heading font-bold"
                          >
                            {c.membership.tier === 'VIP' && '👑 '}
                            {c.membership.tier === 'GOLD' && '⭐ '}
                            {c.membership.tier === 'SILVER' && '🛡️ '}
                            {c.membership.planName} ({c.membership.discountPercent}% OFF)
                          </Badge>
                          <span className="text-[10px] text-ds-text-dim block font-mono">
                            Expires {new Date(c.membership.expiresAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-ds-text-dim font-mono">Standard Gamer</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-heading font-bold text-ds-ice">
                      {c.totalBookings} Booking{c.totalBookings === 1 ? '' : 's'}
                    </td>
                    <td className="py-3.5 px-4 font-heading font-extrabold text-ds-text">
                      ₹{(c.totalSpentPaise / 100).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-ds-text-dim">
                      {new Date(c.joinedAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant={c.status === 'ACTIVE' ? 'success' : 'danger'} size="sm">
                        {c.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant={c.status === 'ACTIVE' ? 'outline' : 'accent'}
                        size="sm"
                        disabled={togglingId === c.id}
                        onClick={() => handleToggleStatus(c)}
                        className="text-[11px] py-1 px-2.5 whitespace-nowrap"
                      >
                        {togglingId === c.id ? (
                          <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        ) : c.status === 'ACTIVE' ? (
                          <>
                            <UserX className="w-3.5 h-3.5 mr-1 text-rose-400" />
                            <span>Suspend</span>
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3.5 h-3.5 mr-1" />
                            <span>Activate</span>
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Customer Profile & Membership Management Modal */}
      {selectedCustomer && (
        <Modal
          isOpen={Boolean(selectedCustomer)}
          onClose={() => setSelectedCustomer(null)}
          title="Gamer Profile & Syndicate Pass"
          size="lg"
        >
          <div className="space-y-6 text-xs">
            {/* Header info */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-ds-dark border border-ds-border">
              <div className="w-12 h-12 rounded-xl bg-ds-accent/20 border border-ds-accent flex items-center justify-center font-heading font-black text-lg text-ds-ice">
                {selectedCustomer.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-bold text-base text-ds-text truncate">
                    {selectedCustomer.name}
                  </h3>
                  <Badge
                    variant={selectedCustomer.status === 'ACTIVE' ? 'success' : 'danger'}
                    size="sm"
                  >
                    {selectedCustomer.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-ds-text-dim text-[11px] mt-1">
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {selectedCustomer.email}
                  </span>
                  <span className="flex items-center gap-1 font-mono">
                    <Phone className="w-3 h-3" /> {selectedCustomer.phone}
                  </span>
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-ds-surface/50 border border-ds-border">
                <span className="text-[10px] font-mono uppercase text-ds-text-dim block">
                  Total Bookings
                </span>
                <span className="text-lg font-heading font-black text-ds-ice">
                  {selectedCustomer.totalBookings} Session
                  {selectedCustomer.totalBookings === 1 ? '' : 's'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-ds-surface/50 border border-ds-border">
                <span className="text-[10px] font-mono uppercase text-ds-text-dim block">
                  Lifetime Value
                </span>
                <span className="text-lg font-heading font-black text-emerald-400">
                  ₹{(selectedCustomer.totalSpentPaise / 100).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Current Membership Status Section */}
            <div className="p-4 rounded-xl bg-ds-dark border border-ds-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-heading font-bold text-xs uppercase text-ds-text flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span>Current Syndicate Pass</span>
                </span>
                {selectedCustomer.membership && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-rose-400 hover:text-rose-300 py-0.5 px-2 text-[10px]"
                    disabled={revoking}
                    onClick={() => handleRevokeMembership(selectedCustomer.membership!.id)}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    <span>Revoke Pass</span>
                  </Button>
                )}
              </div>

              {selectedCustomer.membership ? (
                <div className="p-3 rounded-lg bg-ds-surface/60 border border-ds-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-heading font-bold text-sm text-ds-ice">
                      {selectedCustomer.membership.planName}
                    </h4>
                    <span className="text-[11px] text-emerald-400 font-semibold">
                      {selectedCustomer.membership.discountPercent}% Discount applied to all sessions
                    </span>
                  </div>

                  <div className="text-right font-mono text-[11px] text-ds-text-dim">
                    <span>Valid until: </span>
                    <strong className="text-ds-text">
                      {new Date(selectedCustomer.membership.expiresAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-ds-surface/30 border border-ds-border/60 text-ds-text-dim text-xs">
                  This gamer does not currently have an active Syndicate Pass (Standard Rates apply).
                </div>
              )}

              {/* Grant / Upgrade Membership Form */}
              <div className="pt-3 border-t border-ds-border/60 space-y-3">
                <span className="text-[11px] font-heading font-bold uppercase text-ds-text block">
                  {selectedCustomer.membership ? 'Upgrade or Extend Pass' : 'Grant Membership Pass'}
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-mono uppercase text-ds-text-dim block mb-1">
                      Choose Plan
                    </label>
                    <select
                      value={grantingPlanId}
                      onChange={(e) => setGrantingPlanId(e.target.value)}
                      className="w-full bg-ds-surface border border-ds-border rounded-xl px-2.5 py-1.5 text-xs text-ds-text"
                    >
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.discountPercent}% off • {p.durationDays}d)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono uppercase text-ds-text-dim block mb-1">
                      Payment / Source
                    </label>
                    <select
                      value={grantPaymentMethod}
                      onChange={(e) => setGrantPaymentMethod(e.target.value as any)}
                      className="w-full bg-ds-surface border border-ds-border rounded-xl px-2.5 py-1.5 text-xs text-ds-text"
                    >
                      <option value="CASH">Counter Cash</option>
                      <option value="UPI">Counter UPI / QR</option>
                      <option value="OTHER">Complimentary / VIP Grant</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono uppercase text-ds-text-dim block mb-1">
                      Admin Note
                    </label>
                    <Input
                      value={grantNotes}
                      onChange={(e) => setGrantNotes(e.target.value)}
                      placeholder="e.g. Loyalty perk"
                      className="text-xs py-1"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    variant="accent"
                    size="sm"
                    disabled={submittingGrant || !grantingPlanId}
                    onClick={handleGrantMembership}
                  >
                    <PlusCircle className="w-3.5 h-3.5 mr-1" />
                    <span>{submittingGrant ? 'Granting...' : 'Grant / Activate Pass'}</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <Link
                href="/admin/bookings"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-ds-surface hover:bg-ds-surface-2 border border-ds-border text-ds-ice text-xs font-heading font-bold uppercase tracking-wider transition-colors"
                onClick={() => setSelectedCustomer(null)}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>View All Bookings Ledger</span>
                <ExternalLink className="w-3 h-3 ml-0.5" />
              </Link>

              <Button
                variant={selectedCustomer.status === 'ACTIVE' ? 'outline' : 'accent'}
                size="sm"
                disabled={togglingId === selectedCustomer.id}
                onClick={() => handleToggleStatus(selectedCustomer)}
              >
                {selectedCustomer.status === 'ACTIVE' ? (
                  <>
                    <UserX className="w-3.5 h-3.5 mr-1 text-rose-400" />
                    <span>Suspend Gamer</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-3.5 h-3.5 mr-1" />
                    <span>Reactivate Gamer</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
