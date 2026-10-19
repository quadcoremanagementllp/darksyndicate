'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Shield,
  Crown,
  Sparkles,
  Zap,
  CheckCircle2,
  Calendar,
  Clock,
  CreditCard,
  QrCode,
  RotateCw,
  ArrowRight,
  TrendingDown,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast';

interface ActiveMembership {
  id: string;
  planNameSnapshot: string;
  tierSnapshot: 'SILVER' | 'GOLD' | 'VIP';
  discountPercent: number;
  startsAt: string;
  expiresAt: string;
  plan?: {
    description?: string;
    perks?: string[];
    freeHours?: number;
  };
}

interface MembershipHistoryItem {
  id: string;
  planNameSnapshot: string;
  tierSnapshot: string;
  discountPercent: number;
  pricePaidPaise: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  expiresAt: string;
}

export default function AccountMembershipPage() {
  const [activeMembership, setActiveMembership] = useState<ActiveMembership | null>(null);
  const [history, setHistory] = useState<MembershipHistoryItem[]>([]);
  const [totalSavedPaise, setTotalSavedPaise] = useState(0);
  const [loading, setLoading] = useState(true);

  const { user } = useAuth();
  const toast = useToast();

  const loadMembership = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/customer/membership');
      const json = await res.json();
      if (json.success && json.data) {
        setActiveMembership(json.data.activeMembership);
        setHistory(json.data.history || []);
        setTotalSavedPaise(json.data.totalSavedPaise || 0);
      }
    } catch {
      toast.error('Failed to load membership status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembership();
  }, []);

  const getDaysRemaining = (expiryDateStr: string) => {
    const diff = new Date(expiryDateStr).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  if (loading) {
    return (
      <div className="p-20 text-center text-xs text-ds-text-dim flex flex-col items-center gap-3">
        <RotateCw className="w-6 h-6 animate-spin text-ds-accent" />
        <span>Loading your Syndicate Membership...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-black uppercase text-ds-text">
            Syndicate Member Pass
          </h1>
          <p className="text-xs text-ds-text-muted mt-0.5">
            Your active tier benefits, digital arena access card, and lifetime booking savings.
          </p>
        </div>

        <Link href="/membership" className="w-full sm:w-auto">
          <Button variant="accent" size="sm" className="w-full sm:w-auto">
            <span>{activeMembership ? 'Upgrade / Extend Pass' : 'Browse Syndicate Passes'}</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </Link>
      </div>

      {/* Active Membership Digital Card */}
      {activeMembership ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cyber Pass (2 Cols) */}
          <Card
            variant="glass"
            className={`p-6 sm:p-8 lg:col-span-2 relative overflow-hidden flex flex-col justify-between border-2 ${
              activeMembership.tierSnapshot === 'VIP'
                ? 'border-ds-accent/80 shadow-2xl shadow-ds-accent/20 bg-gradient-to-br from-ds-darker via-ds-surface to-[#0e1726]'
                : activeMembership.tierSnapshot === 'GOLD'
                ? 'border-amber-500/80 shadow-2xl shadow-amber-500/15 bg-gradient-to-br from-ds-darker via-ds-surface to-[#241c0e]'
                : 'border-slate-400/60 shadow-xl bg-gradient-to-br from-ds-darker via-ds-surface to-[#151b23]'
            }`}
          >
            {/* Cyber Pass Graphic Visual */}
            <div className="absolute top-0 right-0 w-80 h-full opacity-15 overflow-hidden pointer-events-none select-none">
              <Image
                src={
                  activeMembership.tierSnapshot === 'VIP'
                    ? '/passes/vip-black-card.jpg'
                    : activeMembership.tierSnapshot === 'GOLD'
                    ? '/passes/gold-pass.jpg'
                    : '/passes/silver-pass.jpg'
                }
                alt="Active Pass"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent via-ds-dark/40 to-ds-dark" />
            </div>

            {/* Top header */}
            <div className="flex items-start justify-between gap-4 relative z-10">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-ds-accent uppercase block font-bold">
                  DARK SYNDICATE ARENA PASS
                </span>
                <h2 className="text-2xl font-heading font-black text-ds-text tracking-wide mt-1">
                  {activeMembership.planNameSnapshot}
                </h2>
              </div>

              <Badge
                variant={
                  activeMembership.tierSnapshot === 'VIP'
                    ? 'accent'
                    : activeMembership.tierSnapshot === 'GOLD'
                    ? 'warning'
                    : 'outline'
                }
                size="md"
                className="font-heading font-black uppercase text-xs shadow-glow-sm"
              >
                {activeMembership.tierSnapshot} MEMBER
              </Badge>
            </div>

            {/* Middle Card Details */}
            <div className="py-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 rounded-xl bg-ds-dark/60 border border-ds-border">
                <span className="text-[10px] font-mono uppercase text-ds-text-dim block">Discount</span>
                <span className="text-xl font-heading font-black text-emerald-400">
                  {activeMembership.discountPercent}% OFF
                </span>
              </div>

              <div className="p-3 rounded-xl bg-ds-dark/60 border border-ds-border">
                <span className="text-[10px] font-mono uppercase text-ds-text-dim block">Validity</span>
                <span className="text-xl font-heading font-black text-ds-ice">
                  {getDaysRemaining(activeMembership.expiresAt)} Days
                </span>
              </div>

              <div className="p-3 rounded-xl bg-ds-dark/60 border border-ds-border">
                <span className="text-[10px] font-mono uppercase text-ds-text-dim block">Gamer</span>
                <span className="text-sm font-heading font-bold text-ds-text truncate block mt-1">
                  {user ? `${user.firstName} ${user.lastName}` : 'Syndicate Gamer'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-ds-dark/60 border border-ds-border">
                <span className="text-[10px] font-mono uppercase text-ds-text-dim block">Expires On</span>
                <span className="text-xs font-mono text-ds-text-muted block mt-1">
                  {new Date(activeMembership.expiresAt).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            {/* Bottom Footer / Pass Token */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-ds-border/60">
              <div className="flex items-center gap-2 text-xs text-ds-text-dim">
                <Zap className="w-4 h-4 text-ds-accent" />
                <span>Automatic checkout discount active on all bookings</span>
              </div>

              <span className="text-[10px] font-mono text-ds-text-dim">
                MEMBER ID: #{activeMembership.id.slice(0, 8).toUpperCase()}
              </span>
            </div>
          </Card>

          {/* Savings & QR Card (1 Col) */}
          <Card variant="glass" className="p-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-ds-border pb-3">
                <TrendingDown className="w-4 h-4 text-emerald-400" />
                <h3 className="font-heading font-bold text-sm text-ds-text uppercase">
                  Member Benefits Saved
                </h3>
              </div>

              <div className="p-4 rounded-xl bg-ds-dark border border-ds-border text-center">
                <span className="text-[10px] font-mono uppercase text-ds-text-dim block">
                  Total Saved with Pass
                </span>
                <span className="text-3xl font-heading font-black text-emerald-400 block mt-1">
                  ₹{(totalSavedPaise / 100).toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-ds-text-dim mt-1 block">
                  Deducted automatically from hourly bookings
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-ds-surface/50 border border-ds-border flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-ds-dark border border-ds-border flex items-center justify-center text-ds-ice shrink-0">
                <QrCode className="w-7 h-7" />
              </div>
              <div>
                <span className="font-heading font-bold text-xs text-ds-text uppercase block">
                  Floor Check-In QR
                </span>
                <p className="text-[11px] text-ds-text-muted mt-0.5">
                  Show your phone number or account profile to desk staff for walk-in member rates.
                </p>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <Card variant="glass" className="p-12 text-center space-y-4 border-ds-border">
          <div className="w-16 h-16 rounded-2xl bg-ds-surface flex items-center justify-center border border-ds-border mx-auto text-ds-text-dim">
            <Shield className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-heading font-bold text-ds-text">No Active Syndicate Pass</h2>
          <p className="text-xs text-ds-text-muted max-w-md mx-auto leading-relaxed">
            You are currently on standard hourly pricing. Join a Syndicate Pass tier to unlock up to 30% discount on every gaming session and free monthly hours.
          </p>
          <div className="pt-2">
            <Link href="/membership">
              <Button variant="accent" size="sm">
                <span>View Membership Passes</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Membership History */}
      <div className="space-y-4">
        <h3 className="font-heading font-bold text-sm uppercase text-ds-text">
          Membership History
        </h3>

        {history.length === 0 ? (
          <Card variant="glass" className="p-8 text-center text-xs text-ds-text-dim">
            No previous membership purchases recorded.
          </Card>
        ) : (
          <Card variant="glass" className="border-ds-border overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-ds-dark/60 text-ds-text-dim uppercase text-[10px] font-mono border-b border-ds-border">
                  <tr>
                    <th className="py-3 px-4">Pass Plan</th>
                    <th className="py-3 px-4 hidden sm:table-cell">Tier</th>
                    <th className="py-3 px-4">Discount</th>
                    <th className="py-3 px-4">Price Paid</th>
                    <th className="py-3 px-4 hidden sm:table-cell">Method</th>
                    <th className="py-3 px-4 hidden sm:table-cell">Activated</th>
                    <th className="py-3 px-4 hidden sm:table-cell">Expires</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ds-border/40">
                  {history.map((item) => (
                    <tr key={item.id} className="hover:bg-ds-surface/40 transition-colors">
                      <td className="py-3.5 px-4 font-heading font-bold text-ds-text">
                        {item.planNameSnapshot}
                      </td>
                      <td className="py-3.5 px-4 font-mono hidden sm:table-cell">{item.tierSnapshot}</td>
                      <td className="py-3.5 px-4 font-heading font-bold text-emerald-400">
                        {item.discountPercent}% OFF
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        ₹{(item.pricePaidPaise / 100).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-ds-text-dim hidden sm:table-cell">
                        {item.paymentMethod}
                      </td>
                      <td className="py-3.5 px-4 text-ds-text-dim hidden sm:table-cell">
                        {new Date(item.createdAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-ds-text-dim hidden sm:table-cell">
                        {new Date(item.expiresAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Badge
                          variant={item.status === 'ACTIVE' ? 'success' : 'outline'}
                          size="sm"
                        >
                          {item.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
