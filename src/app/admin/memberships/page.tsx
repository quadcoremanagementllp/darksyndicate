'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import {
  Sparkles,
  Search,
  RotateCw,
  PlusCircle,
  ShieldCheck,
  Crown,
  Shield,
  Calendar,
  CreditCard,
  User,
  Phone,
  Mail,
  Trash2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Edit2,
  Edit3,
  Percent,
  Check,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface Membership {
  id: string;
  userId: string;
  planId: string;
  planNameSnapshot: string;
  tierSnapshot: string;
  pricePaidPaise: number;
  discountPercent: number;
  freeHoursGranted?: number;
  freeHoursUsed?: number;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  startsAt: string;
  expiresAt: string;
  paymentMethod: string;
  createdAt: string;
  notes?: string | null;
  plan?: {
    id: string;
    name: string;
    tier: string;
    discountPercent: number;
    pricePaise: number;
    durationDays: number;
  };
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  };
}

interface MembershipPlan {
  id: string;
  slug: string;
  name: string;
  tier: string;
  description: string;
  pricePaise: number;
  durationDays: number;
  discountPercent: number;
  freeHours: number;
  perks?: string[] | any;
  badgeColor?: string;
  isActive?: boolean;
}

interface CustomerOption {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export default function AdminMembershipsPage() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED'>('ALL');
  const [tierFilter, setTierFilter] = useState<string>('ALL');

  // Modal State for granting pass
  const [isGrantOpen, setIsGrantOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'OTHER'>('CASH');
  const [grantNotes, setGrantNotes] = useState('Admin manual pass grant');
  const [submittingGrant, setSubmittingGrant] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Edit Plan Modal State
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);
  const [isEditPlanOpen, setIsEditPlanOpen] = useState(false);
  const [planForm, setPlanForm] = useState({
    name: '',
    tier: 'SILVER',
    priceRupees: 499,
    discountPercent: 10,
    durationDays: 30,
    freeHours: 0,
    description: '',
    perksText: '',
    isActive: true,
  });
  const [savingPlan, setSavingPlan] = useState(false);

  // Edit Customer Membership Modal State
  const [editingMembership, setEditingMembership] = useState<Membership | null>(null);
  const [isEditMembershipOpen, setIsEditMembershipOpen] = useState(false);
  const [membershipForm, setMembershipForm] = useState({
    status: 'ACTIVE' as 'ACTIVE' | 'EXPIRED' | 'CANCELLED',
    expiresAt: '',
    notes: '',
  });
  const [savingMembership, setSavingMembership] = useState(false);

  const toast = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [memRes, custRes] = await Promise.all([
        fetch('/api/admin/memberships'),
        fetch('/api/admin/customers'),
      ]);

      // Try fetching plans from admin endpoint first, then public endpoint fallback
      let plansData: MembershipPlan[] = [];
      try {
        const adminPlansRes = await fetch('/api/admin/memberships/plans');
        const adminPlansJson = await adminPlansRes.json();
        if (adminPlansJson.success && adminPlansJson.data?.plans) {
          plansData = adminPlansJson.data.plans;
        }
      } catch {
        // Fallback to public
      }

      if (plansData.length === 0) {
        const publicPlansRes = await fetch('/api/membership/plans');
        const publicPlansJson = await publicPlansRes.json();
        if (publicPlansJson.success && publicPlansJson.data?.plans) {
          plansData = publicPlansJson.data.plans;
        }
      }

      const memJson = await memRes.json();
      const custJson = await custRes.json();

      if (memJson.success && memJson.data?.memberships) {
        setMemberships(memJson.data.memberships);
      }
      if (plansData.length > 0) {
        setPlans(plansData);
        if (!selectedPlanId) {
          setSelectedPlanId(plansData[0].id);
        }
      }
      if (custJson.success && custJson.data) {
        setCustomers(
          custJson.data.map((c: any) => ({
            id: c.id,
            name: c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Gamer',
            email: c.email,
            phone: c.phone || '',
          }))
        );
      }
    } catch {
      toast.error('Failed to load memberships data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGrantMembership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !selectedPlanId) {
      toast.error('Please select both a gamer and a pass plan');
      return;
    }

    setSubmittingGrant(true);
    try {
      const res = await fetch('/api/admin/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          planId: selectedPlanId,
          paymentMethod,
          notes: grantNotes,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(json.data.message || 'Pass activated successfully!');
        setIsGrantOpen(false);
        loadData();
      } else {
        toast.error(json.error?.message || 'Failed to grant membership');
      }
    } catch {
      toast.error('Network error during pass allocation');
    } finally {
      setSubmittingGrant(false);
    }
  };

  // Plan Create & Edit Handlers
  const handleOpenCreatePlan = () => {
    setEditingPlan(null);
    setPlanForm({
      name: '',
      tier: 'SILVER',
      priceRupees: 499,
      discountPercent: 10,
      durationDays: 30,
      freeHours: 0,
      description: '',
      perksText: '10% OFF all gaming sessions\nPriority seat booking',
      isActive: true,
    });
    setIsEditPlanOpen(true);
  };

  const handleOpenEditPlan = (plan: MembershipPlan) => {
    setEditingPlan(plan);
    const perks = Array.isArray(plan.perks)
      ? plan.perks.join('\n')
      : typeof plan.perks === 'string'
      ? plan.perks
      : '';

    setPlanForm({
      name: plan.name,
      tier: plan.tier || 'SILVER',
      priceRupees: Math.round(plan.pricePaise / 100),
      discountPercent: plan.discountPercent,
      durationDays: plan.durationDays,
      freeHours: plan.freeHours || 0,
      description: plan.description || '',
      perksText: perks,
      isActive: plan.isActive !== undefined ? plan.isActive : true,
    });
    setIsEditPlanOpen(true);
  };

  const handleDeletePlan = async (plan: MembershipPlan) => {
    if (!confirm(`Delete or deactivate membership plan "${plan.name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/memberships/plans/${plan.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.data?.message || 'Membership plan removed');
        loadData();
      } else {
        toast.error(json.error?.message || 'Failed to delete plan');
      }
    } catch {
      toast.error('Network error deleting plan');
    }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!planForm.name.trim() || planForm.name.trim().length < 2) {
      toast.error('Plan name must be at least 2 characters');
      return;
    }
    if (isNaN(Number(planForm.priceRupees)) || Number(planForm.priceRupees) < 0) {
      toast.error('Please enter a valid price (cannot be negative)');
      return;
    }
    if (isNaN(Number(planForm.discountPercent)) || Number(planForm.discountPercent) < 0 || Number(planForm.discountPercent) > 100) {
      toast.error('Discount percentage must be between 0% and 100%');
      return;
    }
    if (isNaN(Number(planForm.durationDays)) || Number(planForm.durationDays) < 1) {
      toast.error('Duration must be at least 1 day');
      return;
    }
    if (isNaN(Number(planForm.freeHours)) || Number(planForm.freeHours) < 0) {
      toast.error('Free hours cannot be negative');
      return;
    }

    setSavingPlan(true);
    try {
      const perks = planForm.perksText
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean);

      const url = editingPlan
        ? `/api/admin/memberships/plans/${editingPlan.id}`
        : '/api/admin/memberships/plans';
      const method = editingPlan ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: planForm.name.trim(),
          tier: planForm.tier,
          pricePaise: Math.round(Number(planForm.priceRupees) * 100),
          discountPercent: Number(planForm.discountPercent),
          durationDays: Number(planForm.durationDays),
          freeHours: Number(planForm.freeHours),
          description: planForm.description.trim(),
          perks,
          isActive: planForm.isActive,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(json.data.message || (editingPlan ? 'Plan updated!' : 'New plan created!'));
        setIsEditPlanOpen(false);
        setEditingPlan(null);
        loadData();
      } else {
        toast.error(json.error?.message || 'Failed to save plan');
      }
    } catch {
      toast.error('Network error while saving plan');
    } finally {
      setSavingPlan(false);
    }
  };

  // Membership Row Edit Handlers
  const handleOpenEditMembership = (m: Membership) => {
    setEditingMembership(m);
    const expDate = new Date(m.expiresAt);
    const dateStr = !isNaN(expDate.getTime()) ? expDate.toISOString().slice(0, 10) : '';

    setMembershipForm({
      status: m.status,
      expiresAt: dateStr,
      notes: m.notes || '',
    });
    setIsEditMembershipOpen(true);
  };

  const handleQuickExtend = (days: number) => {
    const base = membershipForm.expiresAt ? new Date(membershipForm.expiresAt) : new Date();
    base.setDate(base.getDate() + days);
    setMembershipForm((prev) => ({
      ...prev,
      expiresAt: base.toISOString().slice(0, 10),
    }));
  };

  const handleSaveMembership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMembership) return;

    setSavingMembership(true);
    try {
      const res = await fetch(`/api/admin/memberships/${editingMembership.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: membershipForm.status,
          expiresAt: membershipForm.expiresAt
            ? new Date(`${membershipForm.expiresAt}T23:59:59.999Z`).toISOString()
            : undefined,
          notes: membershipForm.notes,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success('Membership updated successfully!');
        setIsEditMembershipOpen(false);
        setEditingMembership(null);
        loadData();
      } else {
        toast.error(json.error?.message || 'Failed to update membership');
      }
    } catch {
      toast.error('Network error while updating membership');
    } finally {
      setSavingMembership(false);
    }
  };

  const handleCancelMembership = async (id: string, customerName: string) => {
    if (!confirm(`Are you sure you want to cancel the active pass for ${customerName}?`)) return;

    setCancellingId(id);
    try {
      const res = await fetch(`/api/admin/memberships/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success(`Pass for ${customerName} has been cancelled`);
        loadData();
      } else {
        toast.error(json.error?.message || 'Failed to cancel pass');
      }
    } catch {
      toast.error('Network error while cancelling pass');
    } finally {
      setCancellingId(null);
    }
  };

  // Metrics
  const activeCount = memberships.filter((m) => m.status === 'ACTIVE').length;
  const totalRevenuePaise = memberships.reduce((acc, m) => acc + (m.pricePaidPaise || 0), 0);
  const vipCount = memberships.filter((m) => m.tierSnapshot === 'VIP' && m.status === 'ACTIVE').length;
  const goldCount = memberships.filter((m) => m.tierSnapshot === 'GOLD' && m.status === 'ACTIVE').length;

  const filteredMemberships = memberships.filter((m) => {
    const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;
    const matchesTier = tierFilter === 'ALL' || m.tierSnapshot === tierFilter;
    const query = search.toLowerCase();
    const fullName = `${m.user.firstName} ${m.user.lastName}`.toLowerCase();
    const matchesSearch =
      !query ||
      fullName.includes(query) ||
      m.user.email.toLowerCase().includes(query) ||
      (m.user.phone && m.user.phone.includes(query)) ||
      m.planNameSnapshot.toLowerCase().includes(query);

    return matchesStatus && matchesTier && matchesSearch;
  });

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase text-ds-text">
            Dark Syndicate Passes
          </h1>
          <p className="text-xs text-ds-text-muted mt-1">
            Manage player memberships, configure pass plans, and grant privileges.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleOpenCreatePlan}>
            <PlusCircle className="w-4 h-4 mr-1.5 text-ds-accent" />
            <span>New Plan</span>
          </Button>
          <Button variant="accent" size="sm" onClick={() => setIsGrantOpen(true)}>
            <PlusCircle className="w-4 h-4 mr-1.5" />
            <span>Issue Syndicate Pass</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card variant="glass" className="p-4 border-ds-accent/30">
          <div className="flex items-center justify-between text-xs text-ds-text-dim">
            <span>ACTIVE PASSES</span>
            <Sparkles className="w-4 h-4 text-ds-ice" />
          </div>
          <p className="text-2xl sm:text-3xl font-heading font-black text-ds-text mt-2">
            {activeCount}
          </p>
          <p className="text-[10px] text-emerald-400 mt-1">Live active gamers</p>
        </Card>

        <Card variant="glass" className="p-4 border-ds-border">
          <div className="flex items-center justify-between text-xs text-ds-text-dim">
            <span>PASSES REVENUE</span>
            <CreditCard className="w-4 h-4 text-ds-accent" />
          </div>
          <p className="text-2xl sm:text-3xl font-heading font-black text-ds-text mt-2">
            ₹{(totalRevenuePaise / 100).toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-ds-text-muted mt-1">Gross pass sales</p>
        </Card>

        <Card variant="glass" className="p-4 border-amber-500/30">
          <div className="flex items-center justify-between text-xs text-ds-text-dim">
            <span>GOLD PASS HOLDERS</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-heading font-black text-amber-300 mt-2">
            {goldCount}
          </p>
          <p className="text-[10px] text-amber-400/80 mt-1">20% discount tier</p>
        </Card>

        <Card variant="glass" className="p-4 border-ds-ice/30">
          <div className="flex items-center justify-between text-xs text-ds-text-dim">
            <span>VIP BLACK CARDS</span>
            <Crown className="w-4 h-4 text-ds-ice" />
          </div>
          <p className="text-2xl sm:text-3xl font-heading font-black text-ds-ice mt-2">
            {vipCount}
          </p>
          <p className="text-[10px] text-ds-ice/80 mt-1">30% discount tier</p>
        </Card>
      </div>

      {/* Plan Configuration Cards */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono uppercase tracking-widest text-ds-text-dim font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-ds-accent" />
            <span>Syndicate Membership Plans ({plans.length})</span>
          </h2>
          <span className="text-[11px] text-ds-text-dim">
            Click &quot;Edit Plan&quot; to configure pricing, discounts, and benefits
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p) => {
            const isVip = p.tier === 'VIP';
            const isGold = p.tier === 'GOLD';

            return (
              <Card
                key={p.id}
                variant="default"
                className={`p-4 border transition-all flex flex-col justify-between ${
                  isVip
                    ? 'border-ds-accent/30 bg-ds-dark/60 hover:border-ds-accent'
                    : isGold
                    ? 'border-amber-500/30 bg-ds-dark/60 hover:border-amber-400'
                    : 'border-ds-border bg-ds-dark/60 hover:border-slate-500'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-mono uppercase tracking-widest font-bold ${
                          isVip ? 'text-ds-ice' : isGold ? 'text-amber-400' : 'text-slate-300'
                        }`}
                      >
                        {p.tier} TIER
                      </span>
                      {p.isActive === false && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant={isVip ? 'accent' : isGold ? 'warning' : 'default'}
                        size="sm"
                      >
                        {p.discountPercent}% OFF
                      </Badge>
                      <button
                        onClick={() => handleOpenEditPlan(p)}
                        className="p-1 rounded text-ds-text-dim hover:text-ds-accent hover:bg-ds-surface transition-colors"
                        title={`Edit ${p.name}`}
                        aria-label={`Edit ${p.name}`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeletePlan(p)}
                        className="p-1 rounded text-ds-text-dim hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title={`Delete ${p.name}`}
                        aria-label={`Delete ${p.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-heading font-bold text-sm text-ds-text mt-1.5">{p.name}</h3>
                  <p className="text-xs text-ds-text-muted mt-1 line-clamp-2 min-h-[32px]">
                    {p.description || 'No description provided.'}
                  </p>

                  <div className="mt-3 pt-3 border-t border-ds-border/60 flex items-baseline justify-between">
                    <div>
                      <span className="text-xl font-heading font-black text-ds-text">
                        ₹{(p.pricePaise / 100).toLocaleString('en-IN')}
                      </span>
                      {p.freeHours > 0 && (
                        <span className="text-[10px] text-emerald-400 font-mono ml-2">
                          +{p.freeHours} hrs free
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-ds-text-dim">
                      {p.durationDays} Days Validity
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-ds-border/40">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEditPlan(p)}
                    className="w-full text-xs h-8 border-ds-border/70 hover:border-ds-accent hover:text-ds-accent font-heading font-bold flex items-center justify-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-ds-accent" />
                    <span>Edit Plan</span>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Search and Filters */}
      <Card variant="glass" className="p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ds-text-dim" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by gamer name, email, phone, or pass title..."
              className="pl-10 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-ds-surface border border-ds-border rounded-xl px-3 py-2 text-xs font-heading font-bold text-ds-text focus:outline-none focus:border-ds-accent"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="EXPIRED">Expired</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="bg-ds-surface border border-ds-border rounded-xl px-3 py-2 text-xs font-heading font-bold text-ds-text focus:outline-none focus:border-ds-accent"
            >
              <option value="ALL">All Tiers</option>
              <option value="VIP">VIP Black</option>
              <option value="GOLD">Gold Syndicate</option>
              <option value="SILVER">Silver Syndicate</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Memberships Table */}
      <Card variant="glass" className="overflow-hidden border-ds-border">
        {loading ? (
          <div className="p-16 text-center text-xs text-ds-text-dim flex flex-col items-center gap-3">
            <RotateCw className="w-6 h-6 animate-spin text-ds-accent" />
            <span>Loading Syndicate Memberships...</span>
          </div>
        ) : filteredMemberships.length === 0 ? (
          <div className="p-16 text-center text-xs text-ds-text-dim">
            <Sparkles className="w-8 h-8 text-ds-accent/40 mx-auto mb-2" />
            <p>No memberships match your search criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-ds-surface/60 border-b border-ds-border text-[10px] font-mono uppercase tracking-wider text-ds-text-dim">
                <tr>
                  <th className="p-4">Gamer Profile</th>
                  <th className="p-4">Pass & Tier</th>
                  <th className="p-4">Hourly Discount</th>
                  <th className="p-4">Validity Period</th>
                  <th className="p-4">Payment</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ds-border/60">
                {filteredMemberships.map((m) => {
                  const isVip = m.tierSnapshot === 'VIP';
                  const isGold = m.tierSnapshot === 'GOLD';

                  return (
                    <tr key={m.id} className="hover:bg-ds-surface/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center font-heading font-bold text-xs ${
                              isVip
                                ? 'bg-ds-accent/20 border border-ds-accent text-ds-ice'
                                : isGold
                                ? 'bg-amber-500/20 border border-amber-500 text-amber-300'
                                : 'bg-slate-700/50 border border-slate-600 text-slate-300'
                            }`}
                          >
                            {m.user.firstName?.[0] || 'G'}
                          </div>
                          <div>
                            <p className="font-heading font-bold text-ds-text">
                              {m.user.firstName} {m.user.lastName}
                            </p>
                            <p className="text-[11px] text-ds-text-muted">{m.user.email}</p>
                            {m.user.phone && (
                              <p className="text-[10px] font-mono text-ds-text-dim">{m.user.phone}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className="font-heading font-bold text-ds-text block">
                          {m.planNameSnapshot}
                        </span>
                        <span
                          className={`text-[10px] font-mono uppercase tracking-widest font-semibold ${
                            isVip ? 'text-ds-ice' : isGold ? 'text-amber-400' : 'text-slate-400'
                          }`}
                        >
                          {m.tierSnapshot} TIER
                        </span>
                      </td>

                      <td className="p-4">
                        <Badge
                          variant={isVip ? 'accent' : isGold ? 'warning' : 'default'}
                          size="sm"
                        >
                          {m.discountPercent}% OFF
                        </Badge>
                      </td>

                      <td className="p-4">
                        <div className="space-y-0.5 text-[11px]">
                          <div className="flex items-center gap-1.5 text-ds-text">
                            <Clock className="w-3 h-3 text-ds-text-dim" />
                            <span>Expires {new Date(m.expiresAt).toLocaleDateString()}</span>
                          </div>
                          <span className="text-[10px] font-mono text-ds-text-dim block">
                            Issued {new Date(m.startsAt).toLocaleDateString()}
                          </span>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="font-mono text-[11px] text-ds-text">
                          ₹{(m.pricePaidPaise / 100).toLocaleString('en-IN')}
                        </div>
                        <span className="text-[10px] text-ds-text-dim uppercase font-mono">
                          {m.paymentMethod}
                        </span>
                      </td>

                      <td className="p-4">
                        <Badge
                          variant={
                            m.status === 'ACTIVE'
                              ? 'success'
                              : m.status === 'EXPIRED'
                              ? 'warning'
                              : 'danger'
                          }
                          size="sm"
                        >
                          {m.status}
                        </Badge>
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-ds-border hover:border-ds-accent text-ds-text hover:text-ds-accent text-[10px] h-7 px-2"
                            onClick={() => handleOpenEditMembership(m)}
                            title="Edit Gamer Membership"
                          >
                            <Edit2 className="w-3 h-3 mr-1" />
                            <span>Edit</span>
                          </Button>

                          {m.status === 'ACTIVE' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-rose-400 border-rose-500/30 hover:bg-rose-500/10 text-[10px] h-7 px-2"
                              disabled={cancellingId === m.id}
                              onClick={() =>
                                handleCancelMembership(
                                  m.id,
                                  `${m.user.firstName} ${m.user.lastName}`.trim()
                                )
                              }
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              <span>Revoke</span>
                            </Button>
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

      {/* Create / Edit Membership Plan Modal */}
      <Modal
        isOpen={isEditPlanOpen}
        onClose={() => {
          setIsEditPlanOpen(false);
          setEditingPlan(null);
        }}
        title={editingPlan ? `Edit Plan: ${editingPlan.name}` : 'Create New Membership Plan'}
        size="lg"
      >
        <form onSubmit={handleSavePlan} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                Plan Name
              </label>
              <Input
                value={planForm.name}
                onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                placeholder="e.g. Gold Syndicate Pass"
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                Tier Level
              </label>
              <select
                value={planForm.tier}
                onChange={(e) => setPlanForm({ ...planForm, tier: e.target.value })}
                className="w-full bg-ds-dark border border-ds-border rounded-xl px-3 py-2.5 text-xs text-ds-text focus:outline-none focus:border-ds-accent"
              >
                <option value="SILVER">SILVER</option>
                <option value="GOLD">GOLD</option>
                <option value="VIP">VIP</option>
                <option value="STANDARD">STANDARD</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                Price (₹ INR)
              </label>
              <Input
                type="number"
                min="0"
                step="1"
                value={planForm.priceRupees}
                onChange={(e) => setPlanForm({ ...planForm, priceRupees: Number(e.target.value) })}
                required
                className="text-xs font-mono"
              />
              <span className="text-[10px] text-ds-text-dim">
                = {(planForm.priceRupees * 100).toLocaleString('en-IN')} paise
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                Discount (%)
              </label>
              <Input
                type="number"
                min="0"
                max="100"
                value={planForm.discountPercent}
                onChange={(e) => setPlanForm({ ...planForm, discountPercent: Number(e.target.value) })}
                required
                className="text-xs font-mono"
              />
              <span className="text-[10px] text-ds-text-dim">Hourly discount</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                Validity (Days)
              </label>
              <Input
                type="number"
                min="1"
                value={planForm.durationDays}
                onChange={(e) => setPlanForm({ ...planForm, durationDays: Number(e.target.value) })}
                required
                className="text-xs font-mono"
              />
              <span className="text-[10px] text-ds-text-dim">Standard 30 days</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                Bonus Free Hrs
              </label>
              <Input
                type="number"
                min="0"
                value={planForm.freeHours}
                onChange={(e) => setPlanForm({ ...planForm, freeHours: Number(e.target.value) })}
                className="text-xs font-mono"
              />
              <span className="text-[10px] text-ds-text-dim">Monthly free hours</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
              Plan Description
            </label>
            <textarea
              value={planForm.description}
              onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
              rows={2}
              placeholder="Short description shown on membership card..."
              className="w-full bg-ds-dark border border-ds-border rounded-xl px-3 py-2 text-xs text-ds-text focus:outline-none focus:border-ds-accent resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                Perks & Benefits List
              </label>
              <span className="text-[10px] font-mono text-ds-text-dim">One perk per line</span>
            </div>
            <textarea
              value={planForm.perksText}
              onChange={(e) => setPlanForm({ ...planForm, perksText: e.target.value })}
              rows={4}
              placeholder="e.g.&#10;20% OFF all gaming sessions&#10;2 FREE bonus gaming hours every month&#10;Complimentary energy drink"
              className="w-full bg-ds-dark border border-ds-border rounded-xl px-3 py-2 text-xs text-ds-text focus:outline-none focus:border-ds-accent resize-none font-mono"
            />
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-ds-border/60">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={planForm.isActive}
                onChange={(e) => setPlanForm({ ...planForm, isActive: e.target.checked })}
                className="w-4 h-4 rounded border-ds-border bg-ds-dark text-ds-accent focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-xs text-ds-text font-heading font-semibold">
                Plan is Active & Available for Gamer Purchase
              </span>
            </label>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditPlanOpen(false);
                  setEditingPlan(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="accent" size="sm" isLoading={savingPlan}>
                <Check className="w-3.5 h-3.5 mr-1" />
                <span>Save Plan Changes</span>
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Edit Gamer Membership Modal */}
      <Modal
        isOpen={isEditMembershipOpen}
        onClose={() => {
          setIsEditMembershipOpen(false);
          setEditingMembership(null);
        }}
        title={`Edit Membership: ${editingMembership?.user.firstName} ${editingMembership?.user.lastName}`}
      >
        <form onSubmit={handleSaveMembership} className="space-y-4">
          <div className="p-3 rounded-xl bg-ds-dark/60 border border-ds-border space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-ds-text-dim">Pass Plan:</span>
              <span className="font-heading font-bold text-ds-text">
                {editingMembership?.planNameSnapshot} ({editingMembership?.tierSnapshot})
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-ds-text-dim">Gamer Email:</span>
              <span className="font-mono text-ds-text-muted">{editingMembership?.user.email}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-ds-text-dim">Hourly Discount:</span>
              <span className="text-emerald-400 font-bold">{editingMembership?.discountPercent}% OFF</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
              Membership Status
            </label>
            <select
              value={membershipForm.status}
              onChange={(e) =>
                setMembershipForm({
                  ...membershipForm,
                  status: e.target.value as 'ACTIVE' | 'EXPIRED' | 'CANCELLED',
                })
              }
              className="w-full bg-ds-dark border border-ds-border rounded-xl px-3 py-2 text-xs text-ds-text focus:outline-none focus:border-ds-accent"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="EXPIRED">EXPIRED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                Expiration Date
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickExtend(7)}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-ds-surface hover:bg-ds-accent/20 text-ds-text hover:text-ds-accent transition-colors"
                >
                  +7 Days
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickExtend(30)}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-ds-surface hover:bg-ds-accent/20 text-ds-text hover:text-ds-accent transition-colors"
                >
                  +30 Days
                </button>
              </div>
            </div>
            <Input
              type="date"
              value={membershipForm.expiresAt}
              onChange={(e) => setMembershipForm({ ...membershipForm, expiresAt: e.target.value })}
              className="text-xs font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
              Admin Notes
            </label>
            <textarea
              value={membershipForm.notes}
              onChange={(e) => setMembershipForm({ ...membershipForm, notes: e.target.value })}
              rows={2}
              placeholder="e.g. Extended courtesy pass, VIP member promo"
              className="w-full bg-ds-dark border border-ds-border rounded-xl px-3 py-2 text-xs text-ds-text focus:outline-none focus:border-ds-accent resize-none"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-ds-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsEditMembershipOpen(false);
                setEditingMembership(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="accent" size="sm" isLoading={savingMembership}>
              <Check className="w-3.5 h-3.5 mr-1" />
              <span>Update Membership</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* Issue Syndicate Pass Modal */}
      <Modal
        isOpen={isGrantOpen}
        onClose={() => setIsGrantOpen(false)}
        title="Issue Syndicate Pass to Gamer"
      >
        <form onSubmit={handleGrantMembership} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
              Select Gamer
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              required
              className="w-full bg-ds-dark border border-ds-border rounded-xl px-3 py-2.5 text-xs text-ds-text focus:outline-none focus:border-ds-accent"
            >
              <option value="">-- Select Registered Gamer --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.email}) {c.phone ? `— ${c.phone}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
              Select Pass Plan
            </label>
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              required
              className="w-full bg-ds-dark border border-ds-border rounded-xl px-3 py-2.5 text-xs text-ds-text focus:outline-none focus:border-ds-accent"
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.tier} — {p.discountPercent}% OFF — ₹{p.pricePaise / 100})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full bg-ds-dark border border-ds-border rounded-xl px-3 py-2 text-xs text-ds-text focus:outline-none focus:border-ds-accent"
              >
                <option value="CASH">Counter Cash</option>
                <option value="UPI">UPI / QR Transfer</option>
                <option value="OTHER">Complimentary / VIP</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text-dim">
                Internal Notes
              </label>
              <Input
                value={grantNotes}
                onChange={(e) => setGrantNotes(e.target.value)}
                placeholder="e.g. VIP tournament perk"
                className="text-xs"
              />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-ds-border/60">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsGrantOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" size="sm" isLoading={submittingGrant}>
              <span>Activate Syndicate Pass</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
