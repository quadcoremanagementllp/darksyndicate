'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Tag,
  Sparkles,
  CheckCircle2,
  Clock,
  Calculator,
  ChevronDown,
  HelpCircle,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export default function PricingPage() {
  const [calcStation, setCalcStation] = useState<'PS5' | 'POOL_TABLE'>('PS5');
  const [calcPlayers, setCalcPlayers] = useState<number>(1);
  const [calcHours, setCalcHours] = useState<number>(2);
  const [isHappyHour, setIsHappyHour] = useState<boolean>(false);

  // Pricing plans
  interface Plan {
    id: string;
    title: string;
    category: string;
    rate: number;
    badge: string;
    popular: boolean;
    isFlat?: boolean;
    flatDuration?: string;
    features: string[];
  }

  const plans: Plan[] = [
    {
      id: 'ps5-single',
      title: 'PS5 Single Player',
      category: 'PlayStation 5',
      rate: 150,
      badge: 'Solo',
      popular: false,
      features: [
        '55" 4K 120Hz LG OLED Display',
        '1x Sony DualSense Wireless Controller',
        '250+ Digital Games Library',
        'SteelSeries 3D Spatial Audio',
        'High-Speed Low Latency LAN',
      ],
    },
    {
      id: 'ps5-duo',
      title: 'PS5 Duo (2 Players)',
      category: 'PlayStation 5',
      rate: 200,
      badge: 'Popular',
      popular: true,
      features: [
        '55" 4K 120Hz LG OLED Display',
        '2x Sony DualSense Wireless Controllers',
        '250+ Digital Games Library',
        'SteelSeries 3D Spatial Audio',
        'High-Speed Low Latency LAN',
      ],
    },
    {
      id: 'ps5-squad',
      title: 'PS5 Squad (3-4 Players)',
      category: 'PlayStation 5 Squad',
      rate: 250,
      badge: 'Squad Pick',
      popular: false,
      features: [
        '55" 4K 120Hz LG OLED Display',
        '4x DualSense Wireless Controllers',
        'Co-Op & Party Games Library',
        'SteelSeries 3D Audio',
        'Refreshment table service',
      ],
    },
    {
      id: 'snooker-table',
      title: 'Snooker Table',
      category: 'Snooker',
      rate: 250,
      badge: 'Per Table',
      popular: false,
      features: [
        'Full-size Championship Snooker Table',
        '3-4 players included in base rate',
        '+₹50 per extra person beyond 4',
        'Shadowless Overhead LED Canopy',
        'Premium cues & accessories provided',
      ],
    },
  ];

  // Dynamic Calculator Calculation based on Station & Player Count
  const getBaseRatePerHour = () => {
    if (calcStation === 'PS5') {
      if (calcPlayers === 1) return 150;
      if (calcPlayers === 2) return 200;
      return 250; // 3-4 players
    }
    // Snooker Table: ₹250/hr for up to 4 players, +₹50 per extra person beyond 4
    if (calcPlayers <= 4) return 250;
    return 250 + (calcPlayers - 4) * 50;
  };

  const baseRatePerHour = getBaseRatePerHour();
  const rawTotal = baseRatePerHour * calcHours;
  // Multi-hour discount: 3+ hours gives 10%
  const multiHourDiscount = calcHours >= 3 ? rawTotal * 0.1 : 0;
  const happyHourDiscount = isHappyHour ? rawTotal * 0.15 : 0;
  const totalDiscount = multiHourDiscount + happyHourDiscount;
  const subtotal = rawTotal - totalDiscount;
  const gst = subtotal * 0.18; // 18% GST standard on amusement
  const finalPrice = Math.round(subtotal + gst);

  const faqs = [
    {
      q: 'Can I pay online or in-venue at the desk?',
      a: 'We support instant UPI, credit/debit cards, and netbanking online for guaranteed slot reservations, as well as Cash & UPI at the front desk for walk-ins.',
    },
    {
      q: 'What is the Happy Hours discount?',
      a: 'Happy Hours run Monday through Thursday from 11:00 AM to 4:00 PM. All hourly bookings during this window receive an automatic 15% discount!',
    },
    {
      q: 'What happens if we run over our booked time?',
      a: 'If no one has reserved the station after you, you can extend seamlessly at standard hourly rates. If another booking exists, our staff will offer you another available station.',
    },
    {
      q: 'What is the cancellation refund policy?',
      a: 'Cancel at least 2 hours before your scheduled session for a 100% full refund directly to your original payment method. Cancellations within 2 hours are eligible for a free reschedule.',
    },
  ];

  return (
    <div className="min-h-screen bg-ds-dark text-ds-text selection:bg-ds-accent selection:text-ds-dark flex flex-col">
      <Navbar />

      <main className="flex-1 pt-32 sm:pt-36 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          {/* Page Header */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ds-surface border border-ds-accent/30 text-xs font-heading font-bold uppercase tracking-[0.2em] text-ds-ice">
              <Tag className="w-3.5 h-3.5 text-ds-accent" />
              Transparent Rates
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-heading font-extrabold tracking-tight uppercase">
              GAMING RATES & <span className="gradient-text">PASSES</span>
            </h1>
            <p className="text-ds-text-muted text-base sm:text-lg">
              No hidden fees, no memberships required. Simple hourly rates with automatic discounts for extended sessions and off-peak hours.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                hover
                glass
                className={`p-6 flex flex-col justify-between relative transition-all ${
                  plan.popular
                    ? 'border-ds-accent/50 shadow-glow-sm bg-ds-surface/70'
                    : 'border-ds-border'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 right-4">
                    <Badge variant={plan.popular ? 'accent' : 'secondary'} size="sm">
                      {plan.badge}
                    </Badge>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <span className="text-[11px] font-heading font-bold uppercase tracking-wider text-ds-accent">
                      {plan.category}
                    </span>
                    <h3 className="text-xl font-heading font-bold text-ds-text mt-0.5">
                      {plan.title}
                    </h3>
                  </div>

                  <div className="py-2">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-heading font-black text-ds-ice">
                        ₹{plan.rate}
                      </span>
                      <span className="text-xs text-ds-text-dim">
                        {plan.isFlat ? ` / ${plan.flatDuration}` : ' / hour'}
                      </span>
                    </div>
                  </div>

                  <ul className="space-y-2.5 text-xs text-ds-text-muted">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-6 mt-6 border-t border-ds-border/60">
                  <Link href="/booking" className="block w-full">
                    <Button
                      variant={plan.popular ? 'accent' : 'outline'}
                      className="w-full justify-center text-sm"
                    >
                      Book This Rate
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>

          {/* ─── Interactive Price Calculator ──────────────────────── */}
          <section className="p-8 sm:p-10 rounded-3xl bg-ds-surface/50 border border-ds-border relative overflow-hidden">
            <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div className="space-y-6">
                <div>
                  <Badge variant="accent">
                    <Calculator className="w-3.5 h-3.5 mr-1" /> Live Estimate
                  </Badge>
                  <h3 className="text-2xl sm:text-3xl font-heading font-extrabold text-ds-text uppercase mt-2">
                    SESSION PRICE <span className="gradient-text">CALCULATOR</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-ds-text-muted mt-1">
                    Calculate your exact total with automatic volume and off-peak savings.
                  </p>
                </div>

                {/* Station Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-heading font-bold uppercase tracking-wider text-ds-text">
                    Select Gaming Zone:
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setCalcStation('PS5');
                        if (calcPlayers > 4) setCalcPlayers(1);
                      }}
                      className={`py-2.5 px-4 rounded-xl font-heading font-bold text-sm uppercase transition-all ${
                        calcStation === 'PS5'
                          ? 'bg-ds-accent text-ds-dark shadow-glow-sm'
                          : 'bg-ds-dark/60 border border-ds-border text-ds-text-muted'
                      }`}
                    >
                      PS5 (from ₹150/h)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCalcStation('POOL_TABLE');
                        if (calcPlayers < 3) setCalcPlayers(4);
                      }}
                      className={`py-2.5 px-4 rounded-xl font-heading font-bold text-sm uppercase transition-all ${
                        calcStation === 'POOL_TABLE'
                          ? 'bg-ds-accent text-ds-dark shadow-glow-sm'
                          : 'bg-ds-dark/60 border border-ds-border text-ds-text-muted'
                      }`}
                    >
                      Snooker (from ₹250/h)
                    </button>
                  </div>
                </div>

                {/* Player Count Selection */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-heading font-bold uppercase">
                    <span className="text-ds-text">Number of Players:</span>
                    <span className="text-ds-ice">
                      {calcStation === 'PS5'
                        ? calcPlayers === 1
                          ? '1 Player (₹150/h)'
                          : calcPlayers === 2
                          ? '2 Players (₹200/h)'
                          : '3-4 Players (₹250/h)'
                        : calcPlayers <= 4
                        ? '3-4 Players (₹250/h)'
                        : `${calcPlayers} Players (₹${250 + (calcPlayers - 4) * 50}/h)`}
                    </span>
                  </div>
                  {calcStation === 'PS5' ? (
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { count: 1, label: 'Single (₹150)' },
                        { count: 2, label: 'Duo (₹200)' },
                        { count: 4, label: 'Squad 3-4 (₹250)' },
                      ].map((p) => (
                        <button
                          key={p.count}
                          type="button"
                          onClick={() => setCalcPlayers(p.count)}
                          className={`py-2 px-3 rounded-lg text-xs font-heading font-bold uppercase transition-all border ${
                            calcPlayers === p.count
                              ? 'bg-ds-accent text-ds-dark border-ds-accent shadow-sm'
                              : 'bg-ds-dark/40 border-ds-border text-ds-text-muted hover:border-ds-accent/40'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { count: 4, label: '3-4 Players (₹250)' },
                        { count: 5, label: '5 Players (₹300)' },
                        { count: 6, label: '6 Players (₹350)' },
                      ].map((p) => (
                        <button
                          key={p.count}
                          type="button"
                          onClick={() => setCalcPlayers(p.count)}
                          className={`py-2 px-3 rounded-lg text-xs font-heading font-bold uppercase transition-all border ${
                            calcPlayers === p.count
                              ? 'bg-ds-accent text-ds-dark border-ds-accent shadow-sm'
                              : 'bg-ds-dark/40 border-ds-border text-ds-text-muted hover:border-ds-accent/40'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Duration Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-heading font-bold uppercase">
                    <span className="text-ds-text">Session Duration:</span>
                    <span className="text-ds-ice">{calcHours} Hour{calcHours > 1 ? 's' : ''}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="6"
                    step="1"
                    value={calcHours}
                    onChange={(e) => setCalcHours(Number(e.target.value))}
                    className="w-full accent-ds-accent bg-ds-border rounded-lg cursor-pointer h-2"
                  />
                  <div className="flex justify-between text-[10px] text-ds-text-dim font-mono">
                    <span>1h</span>
                    <span>2h</span>
                    <span>3h (10% off)</span>
                    <span>4h</span>
                    <span>5h</span>
                    <span>6h</span>
                  </div>
                </div>

                {/* Happy Hour Toggle */}
                <label className="flex items-center gap-3 p-3 rounded-xl bg-ds-dark/40 border border-ds-border cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isHappyHour}
                    onChange={(e) => setIsHappyHour(e.target.checked)}
                    className="rounded accent-ds-accent w-4 h-4 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-heading font-bold text-ds-text">Happy Hours Booking?</span>
                    <p className="text-[11px] text-ds-text-dim">
                      Mon-Thu between 11 AM - 4 PM saves extra 15%
                    </p>
                  </div>
                </label>
              </div>

              {/* Calculated Receipt Box */}
              <div className="p-6 rounded-2xl bg-ds-dark/90 border border-ds-accent/30 space-y-4 shadow-xl">
                <h4 className="font-heading font-bold text-sm uppercase tracking-wider text-ds-ice pb-2 border-b border-ds-border">
                  Estimated Pricing Breakdown
                </h4>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-ds-text-muted">
                    <span>
                      {calcStation === 'PS5' ? 'PS5 Station' : 'Snooker Table'} (
                      {calcStation === 'PS5'
                        ? calcPlayers === 1
                          ? 'Single'
                          : calcPlayers === 2
                          ? 'Duo'
                          : 'Squad'
                        : calcPlayers <= 4
                        ? '3-4 Players'
                        : `${calcPlayers} Players`}
                      ) × {calcHours}h
                    </span>
                    <span className="font-mono text-ds-text">₹{rawTotal}</span>
                  </div>

                  {multiHourDiscount > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Multi-Hour Discount (10%)</span>
                      <span className="font-mono">-₹{multiHourDiscount.toFixed(0)}</span>
                    </div>
                  )}

                  {happyHourDiscount > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Happy Hour Discount (15%)</span>
                      <span className="font-mono">-₹{happyHourDiscount.toFixed(0)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-ds-text-dim">
                    <span>Taxes & GST (18%)</span>
                    <span className="font-mono">+₹{gst.toFixed(0)}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-ds-border flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-ds-text-muted uppercase font-heading">Total Payable:</span>
                    <div className="text-3xl font-heading font-black text-ds-ice">
                      ₹{finalPrice}
                    </div>
                  </div>

                  <Link href={`/booking?type=${calcStation}&hours=${calcHours}`}>
                    <Button variant="accent" size="sm">
                      Book Slot Now
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* ─── FAQs ──────────────────────────────────────────────── */}
          <section className="space-y-6 max-w-4xl mx-auto">
            <div className="text-center space-y-2">
              <h3 className="text-2xl sm:text-3xl font-heading font-extrabold text-ds-text uppercase">
                FREQUENTLY ASKED <span className="gradient-text">QUESTIONS</span>
              </h3>
              <p className="text-xs sm:text-sm text-ds-text-muted">
                Everything you need to know about pricing, extensions, and bookings.
              </p>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-xl bg-ds-surface/60 border border-ds-border space-y-2"
                >
                  <h4 className="font-heading font-bold text-sm sm:text-base text-ds-text flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-ds-accent shrink-0" />
                    {faq.q}
                  </h4>
                  <p className="text-xs sm:text-sm text-ds-text-muted leading-relaxed pl-6">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
