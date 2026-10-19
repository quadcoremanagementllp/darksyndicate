'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  DollarSign,
  Calendar,
  Gamepad2,
  Users,
  TrendingUp,
  Percent,
  ArrowRight,
  Sparkles,
  RotateCw,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = async () => {
    setLoading(true);
    setError('');
    setStats(null);
    try {
      const res = await fetch('/api/admin/stats');
      const json = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error?.message || 'Could not load dashboard data.');
      }
      setStats(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const kpis = stats?.kpis;
  const chartSeries = stats?.chartSeries || [];
  const categoryBreakdown = stats?.categoryBreakdown || [];
  const recentActivity = stats?.recentActivity || [];
  const money = (paise?: number) => loading ? '—' : `₹${((paise || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-ds-accent/10 border border-ds-accent/30 text-ds-ice mb-2">
            <Sparkles className="w-3 h-3 text-ds-accent" />
            <span>Executive Business Analytics</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black tracking-tight uppercase text-ds-text">
            Arena Performance Overview
          </h1>
          <p className="text-xs text-ds-text-muted mt-0.5">
            Real-time financial metrics, station occupancy, and gaming activity logs.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={loadStats} disabled={loading}>
            <RotateCw className="w-4 h-4 mr-1.5" />
            <span>Refresh Data</span>
          </Button>

          <Link href="/staff">
            <Button variant="accent" size="sm">
              <span>Open Staff Operations</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={loadStats}>Try again</Button>
        </div>
      )}

      {/* 1. Primary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card glass className="p-5 border-ds-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-mono text-ds-text-dim">Today's Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-heading font-black text-emerald-400">
            {money(kpis?.todayRevenuePaise)}
          </div>
          <span className="text-[11px] text-ds-text-dim block mt-1">Completed payments after refunds</span>
        </Card>

        <Card glass className="p-5 border-ds-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-mono text-ds-text-dim">Month-to-Date Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-ds-accent/10 text-ds-ice flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-heading font-black text-ds-ice">
            {money(kpis?.monthRevenuePaise)}
          </div>
          <span className="text-[11px] text-ds-text-dim block mt-1">Current month after refunds</span>
        </Card>

        <Card glass className="p-5 border-ds-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-mono text-ds-text-dim">Today's Reservations</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-heading font-black text-ds-text">{loading ? '—' : kpis?.todayBookingsCount ?? 0}</div>
          <span className="text-[11px] text-ds-text-dim block mt-1">
            {loading ? 'Loading reservations' : `${kpis?.totalBookingsCount ?? 0} reservations overall`}
          </span>
        </Card>

        <Card glass className="p-5 border-ds-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-mono text-ds-text-dim">Station Usage</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-heading font-black text-amber-400">{loading ? '—' : `${kpis?.occupancyRate ?? 0}%`}</div>
          <span className="text-[11px] text-ds-text-dim block mt-1">
            {loading ? 'Loading station status' : `${kpis?.activeSessionsCount ?? 0} of ${kpis?.totalStationsCount ?? 0} stations in session`}
          </span>
        </Card>
      </div>

      {/* 2. Visual Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* 7-Day Revenue & Booking Volume Bar Chart */}
        <Card glass className="lg:col-span-8 p-6 border-ds-border flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-heading font-bold uppercase text-ds-text">
                7-Day Revenue Trends (₹)
              </h3>
              <p className="text-xs text-ds-text-muted mt-0.5">Completed payments and reservations by business date (IST).</p>
            </div>
            <Badge variant="outline" size="sm">
              Past 7 Days
            </Badge>
          </div>

          <div className="h-64 w-full">
            {!loading && chartSeries.every((item: any) => item.revenue === 0 && item.bookings === 0) ? (
              <div className="h-full flex items-center justify-center text-sm text-ds-text-muted">No payment or reservation activity in the past 7 days.</div>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="day" stroke="#61ADDF" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#A1B2C7" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B0F17',
                    borderColor: '#22316A',
                    borderRadius: '0.75rem',
                    color: '#F6F8FA',
                    fontSize: '12px',
                  }}
                  formatter={(value: any) => [`₹${value}`, 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#61ADDF" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Category Breakdown Donut / Pie */}
        <Card glass className="lg:col-span-4 p-6 border-ds-border flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-base font-heading font-bold uppercase text-ds-text">Facility Split</h3>
            <p className="text-xs text-ds-text-muted mt-0.5">Booking volume share by facility.</p>
          </div>

          <div className="h-48 w-full flex items-center justify-center">
            {!loading && categoryBreakdown.length === 0 ? (
              <p className="text-sm text-ds-text-muted">No reservations in the past 7 days.</p>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryBreakdown.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B0F17',
                    borderColor: '#22316A',
                    borderRadius: '0.75rem',
                    color: '#F6F8FA',
                    fontSize: '12px',
                  }}
                  formatter={(value: any) => [`${value}%`, 'Volume']}
                />
              </PieChart>
            </ResponsiveContainer>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-ds-border/60 text-xs">
            {categoryBreakdown.map((item: any) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-ds-text">{item.name}</span>
                </div>
                <span className="font-heading font-bold text-ds-ice">{item.value}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 3. Live Activity Audit Log */}
      <Card glass className="p-6 border-ds-border">
        <div className="flex items-center justify-between border-b border-ds-border pb-4 mb-4">
          <div>
            <h3 className="text-base font-heading font-bold uppercase text-ds-text">
              Recent Operations Activity
            </h3>
            <p className="text-xs text-ds-text-muted mt-0.5">Latest bookings recorded in the system.</p>
          </div>

          <Link href="/admin/bookings">
            <Button variant="outline" size="sm" className="text-xs">
              <span>View Full Ledger</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </div>

        <div className="divide-y divide-ds-border/40 text-xs">
          {recentActivity.map((act: any) => (
            <div key={act.id} className="py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-ds-dark flex items-center justify-center text-ds-accent border border-ds-border">
                  <Gamepad2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-bold text-ds-text">{act.customerName}</span>
                    <span className="text-[10px] font-mono text-ds-ice uppercase font-bold">{act.bookingRef}</span>
                  </div>
                  <p className="text-ds-text-dim text-[11px]">
                    {act.action} on <strong className="text-ds-text">{act.stationName}</strong>
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="font-bold text-ds-text block">{act.amount}</span>
                <span className="text-[10px] text-ds-text-dim font-mono">{act.time}</span>
              </div>
            </div>
          ))}
          {!loading && recentActivity.length === 0 && (
            <p className="py-6 text-center text-sm text-ds-text-muted">No bookings have been recorded yet.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
