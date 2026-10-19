'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  Shield,
  Zap,
  Crown,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Clock,
  Award,
  CreditCard,
  QrCode,
  RotateCw,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast';

interface MembershipPlan {
  id: string;
  slug: string;
  name: string;
  tier: 'SILVER' | 'GOLD' | 'VIP';
  description: string;
  pricePaise: number;
  durationDays: number;
  discountPercent: number;
  freeHours: number;
  perks: string[];
  badgeColor?: string;
}

const getPassImage = (tier: string) => {
  if (tier === 'VIP') return '/passes/vip-black-card.jpg';
  if (tier === 'GOLD') return '/passes/gold-pass.jpg';
  return '/passes/silver-pass.jpg';
};

export default function MembershipPlansPage() {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null);

  const { user } = useAuth();
  const toast = useToast();

  useEffect(() => {
    async function fetchPlans() {
      try {
        const res = await fetch('/api/membership/plans');
        const json = await res.json();
        if (json.success && json.data?.plans) {
          setPlans(json.data.plans);
        }
      } catch {
        toast.error('Failed to load membership plans');
      } finally {
        setLoading(false);
      }
    }
    fetchPlans();
  }, []);

  return (
    <div className="min-h-screen bg-ds-darker text-ds-text flex flex-col selection:bg-ds-accent selection:text-white">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 space-y-16">
        {/* Hero Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <Badge variant="accent" size="sm" className="shadow-glow-sm">
            DARK SYNDICATE PASS
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-heading font-black tracking-tight uppercase">
            PLAY MORE. <span className="gradient-text">SAVE EVERY HOUR.</span>
          </h1>
          <p className="text-ds-text-muted text-sm sm:text-base leading-relaxed">
            Unlock automatic hourly discounts across all PS5 consoles, racing rigs, and snooker tables.
            Receive free bonus gaming hours, priority reservations, and exclusive tournament entry privileges.
          </p>

          {!user ? (
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <div className="inline-flex items-center gap-2 p-2.5 px-4 rounded-xl bg-ds-surface/70 border border-ds-accent/40 text-xs text-ds-text-muted shadow-glow-sm">
                <Sparkles className="w-4 h-4 text-ds-accent shrink-0" />
                <span>
                  New to Dark Syndicate?{' '}
                  <Link
                    href="/login?tab=signup&redirect=/membership"
                    className="text-ds-accent font-bold hover:underline"
                  >
                    Create a free gamer account
                  </Link>{' '}
                  or{' '}
                  <Link
                    href="/login?tab=signin&redirect=/membership"
                    className="text-ds-ice font-bold hover:underline"
                  >
                    Sign In
                  </Link>{' '}
                  to activate your pass instantly.
                </span>
              </div>
            </div>
          ) : (
            <div className="pt-2">
              <Link
                href="/account/membership"
                className="inline-flex items-center gap-2 text-xs font-heading font-bold uppercase tracking-wider text-ds-ice hover:text-ds-accent transition-colors"
              >
                <span>View your active digital member pass</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* Membership Tiers Grid */}
        {loading ? (
          <div className="p-20 text-center text-xs text-ds-text-dim flex flex-col items-center gap-3">
            <RotateCw className="w-6 h-6 animate-spin text-ds-accent" />
            <span>Loading Syndicate Passes...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6">
            {plans.map((plan) => {
              const isGold = plan.tier === 'GOLD';
              const isVip = plan.tier === 'VIP';

              return (
                <Card
                  key={plan.id}
                  variant="glass"
                  className={`p-0 flex flex-col justify-between relative transition-all duration-300 hover:scale-[1.02] group rounded-2xl ${
                    isGold
                      ? 'border-amber-500/60 shadow-xl shadow-amber-500/10'
                      : isVip
                      ? 'border-ds-accent/70 shadow-xl shadow-ds-accent/15'
                      : 'border-ds-border'
                  }`}
                >
                  {isGold && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                      <span className="bg-gradient-to-r from-amber-500 to-amber-400 text-black text-[11px] font-heading font-black uppercase px-4 py-1.5 rounded-full shadow-lg shadow-amber-500/20 font-mono tracking-wider whitespace-nowrap">
                        MOST POPULAR
                      </span>
                    </div>
                  )}

                  {isVip && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                      <span className="bg-ds-accent text-white text-[11px] font-heading font-black uppercase px-4 py-1.5 rounded-full shadow-glow font-mono tracking-wider whitespace-nowrap">
                        PRO GAMER ELITE
                      </span>
                    </div>
                  )}

                  <div>
                    {/* 3D Cybernetic Pass Showcase Banner */}
                    <div className="relative w-full h-52 sm:h-56 bg-ds-dark rounded-t-2xl overflow-hidden">
                      <Image
                        src={getPassImage(plan.tier)}
                        alt={plan.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-ds-surface/90 via-transparent to-black/20" />
                    </div>

                    <div className="p-6 sm:p-8 space-y-6">
                      {/* Header */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between pb-1">
                          <span className="text-xs font-mono uppercase tracking-widest text-ds-accent font-bold">
                            {plan.tier} TIER
                          </span>
                          {isVip ? (
                            <div className="flex items-center gap-1 text-ds-ice">
                              <Crown className="w-4 h-4" />
                            </div>
                          ) : isGold ? (
                            <div className="flex items-center gap-1 text-amber-400">
                              <Sparkles className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-slate-400">
                              <Shield className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                        <h3 className="text-xl font-heading font-extrabold text-ds-text group-hover:text-ds-ice transition-colors">
                          {plan.name}
                        </h3>
                        <p className="text-xs text-ds-text-muted leading-relaxed min-h-[36px]">
                          {plan.description}
                        </p>
                      </div>

                      {/* Price Tag */}
                      <div className="p-4 rounded-2xl bg-ds-dark/70 border border-ds-border">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-heading font-black text-ds-text">
                            ₹{(plan.pricePaise / 100).toLocaleString('en-IN')}
                          </span>
                          <span className="text-xs font-mono text-ds-text-dim">
                            /{plan.durationDays} Days
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant="accent" size="sm">
                            {plan.discountPercent}% OFF EVERY HOUR
                          </Badge>
                          {plan.freeHours > 0 && (
                            <Badge variant="success" size="sm">
                              +{plan.freeHours} FREE HRS
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Perks List */}
                      <div className="space-y-3 pt-1">
                        <span className="text-[10px] font-mono uppercase text-ds-text-dim tracking-wider block">
                          Included Privileges:
                        </span>
                        <ul className="space-y-2.5 text-xs text-ds-text-muted">
                          {plan.perks?.map((perk, idx) => (
                            <li key={idx} className="flex items-start gap-2.5">
                              <CheckCircle2
                                className={`w-4 h-4 shrink-0 mt-0.5 ${
                                  isGold
                                    ? 'text-amber-400'
                                    : isVip
                                    ? 'text-ds-ice'
                                    : 'text-emerald-400'
                                }`}
                              />
                              <span>{perk}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Call to action */}
                  <div className="p-6 sm:p-8 pt-0">
                    <Button
                      variant={isGold ? 'primary' : isVip ? 'accent' : 'outline'}
                      className="w-full font-heading font-bold tracking-wider"
                      onClick={() => {
                        if (!user) {
                          window.location.href = '/login?tab=signup&redirect=/membership';
                          return;
                        }
                        setSelectedPlan(plan);
                      }}
                    >
                      <span>{user ? `Join ${plan.name}` : `Get ${plan.name}`}</span>
                      <ArrowRight className="w-4 h-4 ml-1.5" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Venue Advantage Banner */}
        <Card variant="glass" className="p-8 sm:p-10 border-ds-accent/30 bg-gradient-to-r from-ds-dark via-ds-surface/60 to-ds-dark">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center md:text-left">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-ds-accent/20 border border-ds-accent flex items-center justify-center text-ds-ice shrink-0">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-heading font-bold text-sm text-ds-text uppercase">
                  Automatic Checkout
                </h4>
                <p className="text-xs text-ds-text-muted mt-0.5">
                  No coupons needed. Discounts apply instantly whenever you book online or visit the counter.
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-emerald-400 shrink-0">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-heading font-bold text-sm text-ds-text uppercase">
                  Digital Syndicate Pass
                </h4>
                <p className="text-xs text-ds-text-muted mt-0.5">
                  Scan your member QR at the front desk for instant recognition, bonus hours, and free refreshments.
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500 flex items-center justify-center text-amber-300 shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-heading font-bold text-sm text-ds-text uppercase">
                  Break-Even Fast
                </h4>
                <p className="text-xs text-ds-text-muted mt-0.5">
                  Play just 6 to 8 hours a month and your pass pays for itself through hourly savings.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </main>

      <Footer />

      {/* Checkout Modal */}
      {selectedPlan && (
        <Modal
          isOpen={Boolean(selectedPlan)}
          onClose={() => setSelectedPlan(null)}
          title={`Activate ${selectedPlan.name}`}
          size="md"
        >
          <div className="space-y-6 text-xs">
            {/* Plan summary */}
            <div className="p-4 rounded-xl bg-ds-dark border border-ds-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-3">
                <div className="w-16 h-10 rounded-lg overflow-hidden relative shrink-0 border border-ds-border bg-ds-surface">
                  <Image
                    src={getPassImage(selectedPlan.tier)}
                    alt={selectedPlan.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase text-ds-text-dim block">
                    Selected Pass
                  </span>
                  <h4 className="font-heading font-bold text-base text-ds-text">
                    {selectedPlan.name}
                  </h4>
                  <span className="text-xs text-emerald-400">
                    {selectedPlan.discountPercent}% OFF • {selectedPlan.durationDays} Days Validity
                  </span>
                </div>
              </div>
              <div className="sm:text-right shrink-0 border-t border-ds-border/40 sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto flex sm:block items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-ds-text-dim block">
                  Amount Due
                </span>
                <span className="text-xl font-heading font-black text-ds-ice">
                  ₹{(selectedPlan.pricePaise / 100).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* In-person activation notice */}
            <div className="p-3.5 rounded-xl bg-ds-surface/40 border border-ds-border text-ds-text-muted space-y-1">
              <span className="text-ds-text font-bold block">Purchase at reception</span>
              <p>
                Visit the venue to purchase this pass. Staff will activate it after receiving payment.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
              <Button variant="outline" type="button" onClick={() => setSelectedPlan(null)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button variant="accent" type="button" onClick={() => { window.location.href = '/contact'; }} className="w-full sm:w-auto">
                <span>Contact venue</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
