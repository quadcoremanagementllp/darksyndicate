import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError } from '@/lib/errors';
import { requireRole } from '@/lib/session';

const BUSINESS_TIMEZONE_OFFSET_MINUTES = 5 * 60 + 30;
const FACILITY_COLORS = ['#61ADDF', '#16479B', '#34D399', '#F59E0B', '#A78BFA'];

function businessDateStart(now: Date, daysAgo = 0) {
  const businessNow = new Date(now.getTime() + BUSINESS_TIMEZONE_OFFSET_MINUTES * 60_000);
  const date = new Date(Date.UTC(
    businessNow.getUTCFullYear(),
    businessNow.getUTCMonth(),
    businessNow.getUTCDate() - daysAgo,
  ));
  return new Date(date.getTime() - BUSINESS_TIMEZONE_OFFSET_MINUTES * 60_000);
}

function businessCalendarDateStart(now: Date, daysAgo = 0) {
  const businessNow = new Date(now.getTime() + BUSINESS_TIMEZONE_OFFSET_MINUTES * 60_000);
  return new Date(Date.UTC(
    businessNow.getUTCFullYear(),
    businessNow.getUTCMonth(),
    businessNow.getUTCDate() - daysAgo,
  ));
}

function formatBusinessDate(date: Date) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function formatBusinessTime(date: Date) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export async function GET(_req: NextRequest) {
  try {
    await requireRole('ADMIN', 'SUPER_ADMIN');
    const now = new Date();
    const todayStart = businessDateStart(now);
    const tomorrowStart = businessDateStart(now, -1);
    const todayCalendarDate = businessCalendarDateStart(now);
    const tomorrowCalendarDate = businessCalendarDateStart(now, -1);
    const monthStart = (() => {
      const businessNow = new Date(now.getTime() + BUSINESS_TIMEZONE_OFFSET_MINUTES * 60_000);
      const localMonthStart = new Date(Date.UTC(businessNow.getUTCFullYear(), businessNow.getUTCMonth(), 1));
      return new Date(localMonthStart.getTime() - BUSINESS_TIMEZONE_OFFSET_MINUTES * 60_000);
    })();
    const weekStart = businessDateStart(now, 6);
    const weekCalendarStart = businessCalendarDateStart(now, 6);

    const [
      todayPayments,
      todayMemberships,
      todayRefunds,
      monthPayments,
      monthMemberships,
      monthRefunds,
      weekPayments,
      weekMemberships,
      weekRefunds,
      todayBookingsCount,
      totalBookingsCount,
      totalCustomersCount,
      totalStationsCount,
      activeSessionsCount,
      weekBookings,
      recentBookings,
    ] = await Promise.all([
      prisma.payment.findMany({
        where: { status: { in: ['COMPLETED', 'REFUNDED', 'PARTIALLY_REFUNDED'] }, paidAt: { gte: todayStart, lt: tomorrowStart } },
        select: { amountPaise: true },
      }),
      prisma.membership.findMany({
        where: { status: { not: 'CANCELLED' }, pricePaidPaise: { gt: 0 }, createdAt: { gte: todayStart, lt: tomorrowStart } },
        select: { pricePaidPaise: true },
      }),
      prisma.refund.aggregate({
        where: { status: 'COMPLETED', processedAt: { gte: todayStart, lt: tomorrowStart } },
        _sum: { amountPaise: true },
      }),
      prisma.payment.findMany({
        where: { status: { in: ['COMPLETED', 'REFUNDED', 'PARTIALLY_REFUNDED'] }, paidAt: { gte: monthStart, lte: now } },
        select: { amountPaise: true },
      }),
      prisma.membership.findMany({
        where: { status: { not: 'CANCELLED' }, pricePaidPaise: { gt: 0 }, createdAt: { gte: monthStart, lte: now } },
        select: { pricePaidPaise: true },
      }),
      prisma.refund.aggregate({
        where: { status: 'COMPLETED', processedAt: { gte: monthStart, lte: now } },
        _sum: { amountPaise: true },
      }),
      prisma.payment.findMany({
        where: { status: { in: ['COMPLETED', 'REFUNDED', 'PARTIALLY_REFUNDED'] }, paidAt: { gte: weekStart, lt: tomorrowStart } },
        select: { amountPaise: true, paidAt: true },
      }),
      prisma.membership.findMany({
        where: { status: { not: 'CANCELLED' }, pricePaidPaise: { gt: 0 }, createdAt: { gte: weekStart, lt: tomorrowStart } },
        select: { pricePaidPaise: true, createdAt: true },
      }),
      prisma.refund.findMany({
        where: { status: 'COMPLETED', processedAt: { gte: weekStart, lt: tomorrowStart } },
        select: { amountPaise: true, processedAt: true },
      }),
      prisma.booking.count({
        where: {
          date: { gte: todayCalendarDate, lt: tomorrowCalendarDate },
          status: { notIn: ['CANCELLED', 'PAYMENT_FAILED', 'NO_SHOW'] },
        },
      }),
      prisma.booking.count({ where: { status: { notIn: ['CANCELLED', 'PAYMENT_FAILED', 'NO_SHOW'] } } }),
      prisma.user.count({
        where: {
          role: 'CUSTOMER',
          status: 'ACTIVE',
          email: { not: 'guest@darksyndicate.in' },
        },
      }),
      prisma.gamingStation.count({ where: { status: { in: ['AVAILABLE', 'OCCUPIED'] } } }),
      prisma.gamingSession.count({ where: { status: { in: ['ACTIVE', 'PAUSED', 'EXTENDED', 'OVERDUE'] } } }),
      prisma.booking.findMany({
        where: {
          date: { gte: weekCalendarStart, lt: tomorrowCalendarDate },
          status: { notIn: ['CANCELLED', 'PAYMENT_FAILED', 'NO_SHOW'] },
        },
        select: {
          date: true,
          station: { select: { facility: { select: { id: true, name: true } } } },
        },
      }),
      prisma.booking.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        include: {
          station: { select: { name: true } },
          user: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    const daily = Array.from({ length: 7 }, (_, index) => {
      const start = businessDateStart(now, 6 - index);
      const end = businessDateStart(now, 5 - index);
      const calendarDate = businessCalendarDateStart(now, 6 - index);
      const key = calendarDate.toISOString().slice(0, 10);
      const bookingRevenuePaise = weekPayments
        .filter((payment) => payment.paidAt && payment.paidAt >= start && payment.paidAt < end)
        .reduce((total, payment) => total + payment.amountPaise, 0);
      const membershipRevenuePaise = weekMemberships
        .filter((m) => m.createdAt >= start && m.createdAt < end)
        .reduce((total, m) => total + m.pricePaidPaise, 0);
      const refundsPaise = weekRefunds
        .filter((refund) => refund.processedAt && refund.processedAt >= start && refund.processedAt < end)
        .reduce((total, refund) => total + refund.amountPaise, 0);
      const bookings = weekBookings.filter((booking) => booking.date.toISOString().slice(0, 10) === key).length;
      return {
        day: formatBusinessDate(start),
        revenue: Math.round((bookingRevenuePaise + membershipRevenuePaise - refundsPaise) / 100),
        bookings,
      };
    });

    const facilityCounts = new Map<string, { name: string; count: number }>();
    for (const booking of weekBookings) {
      const facility = booking.station.facility;
      const item = facilityCounts.get(facility.id) || { name: facility.name, count: 0 };
      item.count += 1;
      facilityCounts.set(facility.id, item);
    }
    const facilityTotal = [...facilityCounts.values()].reduce((total, item) => total + item.count, 0);
    const categoryBreakdown = [...facilityCounts.values()].map((item, index) => ({
      name: item.name,
      value: facilityTotal ? Math.round((item.count / facilityTotal) * 100) : 0,
      color: FACILITY_COLORS[index % FACILITY_COLORS.length],
    }));

    const recentActivity = recentBookings.map((booking) => ({
      id: booking.id,
      bookingRef: booking.bookingRef,
      action: booking.isWalkIn ? 'Desk walk-in' : 'Online reservation',
      customerName: booking.customerName || `${booking.user.firstName} ${booking.user.lastName}`.trim(),
      stationName: booking.station.name,
      amount: `₹${(booking.totalPricePaise / 100).toLocaleString('en-IN')}`,
      status: booking.status,
      time: formatBusinessTime(booking.createdAt),
    }));

    const activeSessions = activeSessionsCount;
    const netCollectedPaise = (
      payments: typeof todayPayments,
      memberships: typeof todayMemberships,
      refundsPaise: number
    ) =>
      payments.reduce((total, payment) => total + payment.amountPaise, 0) +
      memberships.reduce((total, m) => total + m.pricePaidPaise, 0) -
      refundsPaise;

    return apiSuccess({
      kpis: {
        todayRevenuePaise: netCollectedPaise(todayPayments, todayMemberships, todayRefunds._sum.amountPaise ?? 0),
        monthRevenuePaise: netCollectedPaise(monthPayments, monthMemberships, monthRefunds._sum.amountPaise ?? 0),
        todayBookingsCount,
        totalBookingsCount,
        totalCustomersCount,
        totalStationsCount,
        activeSessionsCount: activeSessions,
        occupancyRate: totalStationsCount ? Math.round((activeSessions / totalStationsCount) * 100) : 0,
      },
      chartSeries: daily,
      categoryBreakdown,
      recentActivity,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
