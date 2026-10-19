'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Tag, Plus, RotateCw, CheckCircle2, XCircle, Sparkles, Edit2, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface Coupon {
  id: string;
  code: string;
  name: string;
  description?: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  minOrderPaise?: number;
  maxDiscountPaise?: number;
  maxUses?: number;
  usedCount: number;
  isActive: boolean;
  validUntil: string;
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  // Form State
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE');
  const [formValue, setFormValue] = useState('15');
  const [formMinOrder, setFormMinOrder] = useState('200');
  const [formMaxDiscount, setFormMaxDiscount] = useState('100');
  const [formMaxUses, setFormMaxUses] = useState('250');
  const [formValidDays, setFormValidDays] = useState('30');
  const [submitting, setSubmitting] = useState(false);

  const toast = useToast();

  const loadCoupons = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/coupons');
      const json = await res.json();
      if (json.success && json.data) {
        setCoupons(json.data || []);
      }
    } catch {
      toast.error('Failed to load coupons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, []);

  const openCreateModal = () => {
    setEditingCoupon(null);
    setFormCode('');
    setFormName('');
    setFormType('PERCENTAGE');
    setFormValue('15');
    setFormMinOrder('200');
    setFormMaxDiscount('100');
    setFormMaxUses('250');
    setFormValidDays('30');
    setModalOpen(true);
  };

  const openEditModal = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormCode(coupon.code);
    setFormName(coupon.name);
    setFormType(coupon.discountType);
    setFormValue(String(Math.round(coupon.discountValue / 100)));
    setFormMinOrder(coupon.minOrderPaise ? String(Math.round(coupon.minOrderPaise / 100)) : '');
    setFormMaxDiscount(coupon.maxDiscountPaise ? String(Math.round(coupon.maxDiscountPaise / 100)) : '');
    setFormMaxUses(coupon.maxUses ? String(coupon.maxUses) : '');
    const daysLeft = Math.max(
      1,
      Math.ceil((new Date(coupon.validUntil).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    );
    setFormValidDays(String(daysLeft));
    setModalOpen(true);
  };

  const handleToggle = async (coupon: Coupon) => {
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponId: coupon.id, isActive: !coupon.isActive }),
      });
      const json = await res.json();
      if (json.success) {
        toast.info(`Coupon ${coupon.code} ${!coupon.isActive ? 'enabled' : 'disabled'}`);
        loadCoupons();
      } else {
        toast.error(json.error?.message || 'Failed to toggle coupon');
      }
    } catch {
      toast.error('Failed to toggle coupon');
    }
  };

  const handleDelete = async (coupon: Coupon) => {
    if (!confirm(`Delete promo code "${coupon.code}"?`)) return;
    try {
      const res = await fetch(`/api/admin/coupons?id=${coupon.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success(json.data?.message || `Coupon ${coupon.code} removed`);
        loadCoupons();
      } else {
        toast.error(json.error?.message || 'Failed to delete coupon');
      }
    } catch {
      toast.error('Error deleting coupon');
    }
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanCode = formCode.trim().toUpperCase();
    if (!cleanCode) {
      toast.error('Promo code is required');
      return;
    }
    if (cleanCode.length < 3) {
      toast.error('Promo code must be at least 3 characters');
      return;
    }
    if (!/^[A-Z0-9_-]+$/.test(cleanCode)) {
      toast.error('Promo code must only contain letters, numbers, and dashes');
      return;
    }
    if (!formName.trim()) {
      toast.error('Campaign name is required');
      return;
    }
    const parsedVal = parseInt(formValue, 10);
    if (isNaN(parsedVal) || parsedVal <= 0) {
      toast.error('Discount value must be greater than 0');
      return;
    }
    if (formType === 'PERCENTAGE' && parsedVal > 100) {
      toast.error('Percentage discount cannot exceed 100%');
      return;
    }
    const parsedValidDays = parseInt(formValidDays, 10);
    if (isNaN(parsedValidDays) || parsedValidDays < 1 || parsedValidDays > 365) {
      toast.error('Validity must be between 1 and 365 days');
      return;
    }

    setSubmitting(true);

    const discountVal =
      formType === 'PERCENTAGE'
        ? parsedVal * 100 // store percentage * 100
        : parsedVal * 100; // paise

    const minOrderPaise = formMinOrder ? parseInt(formMinOrder, 10) * 100 : null;
    const maxDiscountPaise = formMaxDiscount ? parseInt(formMaxDiscount, 10) * 100 : null;
    const maxUses = formMaxUses ? parseInt(formMaxUses, 10) : null;

    try {
      if (editingCoupon) {
        const res = await fetch('/api/admin/coupons', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            couponId: editingCoupon.id,
            name: formName.trim(),
            discountType: formType,
            discountValue: discountVal,
            minOrderPaise,
            maxDiscountPaise,
            maxUses,
            validDays: parsedValidDays,
          }),
        });
        const json = await res.json();
        if (json.success) {
          toast.success(`Promo code ${editingCoupon.code} updated!`);
          loadCoupons();
          setModalOpen(false);
          setEditingCoupon(null);
        } else {
          toast.error(json.error?.message || 'Failed to update coupon');
        }
      } else {
        const res = await fetch('/api/admin/coupons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: cleanCode,
            name: formName.trim(),
            discountType: formType,
            discountValue: discountVal,
            minOrderPaise: minOrderPaise ?? undefined,
            maxDiscountPaise: maxDiscountPaise ?? undefined,
            maxUses: maxUses ?? undefined,
            validDays: parsedValidDays,
          }),
        });

        const json = await res.json();
        if (json.success) {
          toast.success(`Promo code ${cleanCode} created!`);
          loadCoupons();
          setModalOpen(false);
          setFormCode('');
          setFormName('');
        } else {
          toast.error(json.error?.message || 'Failed to create coupon');
        }
      }
    } catch {
      toast.error('Error saving coupon');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-black uppercase text-ds-text">Promo & Discount Codes</h1>
          <p className="text-xs text-ds-text-muted mt-0.5">
            Manage promotional campaigns, percentage discounts, and redemption usage limits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadCoupons}>
            <RotateCw className="w-4 h-4 mr-1.5" />
            <span>Refresh</span>
          </Button>

          <Button variant="accent" size="sm" onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-1.5" />
            <span>New Coupon</span>
          </Button>
        </div>
      </div>

      {/* Coupons Table Card */}
      <Card glass className="border-ds-border overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-xs text-ds-text-dim">Loading coupon records...</div>
        ) : coupons.length === 0 ? (
          <div className="p-16 text-center text-xs text-ds-text-dim">No coupons created yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-ds-dark/60 text-ds-text-dim uppercase text-[10px] font-mono border-b border-ds-border">
                <tr>
                  <th className="py-3 px-4">Coupon Code</th>
                  <th className="py-3 px-4">Campaign Name</th>
                  <th className="py-3 px-4">Discount Value</th>
                  <th className="py-3 px-4">Min Spend</th>
                  <th className="py-3 px-4">Redemptions</th>
                  <th className="py-3 px-4">Valid Until</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ds-border/40">
                {coupons.map((c) => {
                  const discountDisplay =
                    c.discountType === 'PERCENTAGE'
                      ? `${c.discountValue / 100}% OFF`
                      : `₹${(c.discountValue / 100).toFixed(0)} Flat`;

                  return (
                    <tr key={c.id} className="hover:bg-ds-surface/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-extrabold text-ds-ice text-sm">
                        {c.code}
                      </td>
                      <td className="py-3.5 px-4 font-heading font-bold text-ds-text">{c.name}</td>
                      <td className="py-3.5 px-4 font-bold text-emerald-400">{discountDisplay}</td>
                      <td className="py-3.5 px-4 text-ds-text-dim">
                        {c.minOrderPaise ? `₹${(c.minOrderPaise / 100).toFixed(0)}` : 'None'}
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        {c.usedCount} {c.maxUses ? `/ ${c.maxUses}` : 'uses'}
                      </td>
                      <td className="py-3.5 px-4 text-ds-text-dim">
                        {new Date(c.validUntil).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant={c.isActive ? 'success' : 'default'} size="sm">
                          {c.isActive ? 'Active' : 'Disabled'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(c)}
                            className="text-[11px] py-1 px-2"
                            title="Edit Coupon"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant={c.isActive ? 'outline' : 'accent'}
                            size="sm"
                            onClick={() => handleToggle(c)}
                            className="text-[11px] py-1 px-2.5"
                          >
                            {c.isActive ? 'Disable' : 'Enable'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(c)}
                            className="text-[11px] py-1 px-2 text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                            title="Delete Coupon"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
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

      {/* CREATE / EDIT COUPON MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingCoupon(null);
        }}
        title={editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : 'Create Promotional Coupon'}
      >
        <form onSubmit={handleCreateOrUpdate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ds-text-muted uppercase">Code</label>
              <Input
                placeholder="e.g. CHAMPION20"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                className="font-mono uppercase font-bold"
                disabled={Boolean(editingCoupon)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ds-text-muted uppercase">Promo Name</label>
              <Input
                placeholder="Tournament Winner Deal"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ds-text-muted uppercase">Discount Type</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-ds-surface border border-ds-border text-ds-text text-sm focus:outline-none focus:border-ds-accent"
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED_AMOUNT">Fixed Amount (₹)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ds-text-muted uppercase">
                {formType === 'PERCENTAGE' ? 'Discount Value (%)' : 'Discount Amount (₹)'}
              </label>
              <Input
                type="number"
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ds-text-muted uppercase">Min Order (₹)</label>
              <Input
                type="number"
                value={formMinOrder}
                onChange={(e) => setFormMinOrder(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ds-text-muted uppercase">Max Cap (₹)</label>
              <Input
                type="number"
                value={formMaxDiscount}
                onChange={(e) => setFormMaxDiscount(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ds-text-muted uppercase">Max Uses</label>
              <Input
                type="number"
                value={formMaxUses}
                onChange={(e) => setFormMaxUses(e.target.value)}
                placeholder="Unlimited"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ds-text-muted uppercase">Valid Days</label>
              <Input
                type="number"
                min={1}
                max={365}
                value={formValidDays}
                onChange={(e) => setFormValidDays(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setModalOpen(false);
                setEditingCoupon(null);
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button variant="accent" type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : editingCoupon ? 'Save Changes' : 'Issue Promo Code'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
