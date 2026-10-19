import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError } from '@/lib/errors';
import { requireRole } from '@/lib/session';

const OFFSET_MINUTES = 330;
const ACTIVE_BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'] as const;

function businessDateStart(now: Date, daysAgo = 0) {
  const localNow = new Date(now.getTime() + OFFSET_MINUTES * 60_000);
  const localDate = new Date(Date.UTC(
    localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate() - daysAgo,
  ));
  return new Date(localDate.getTime() - OFFSET_MINUTES * 60_000);
}

function businessCalendarDateStart(now: Date, daysAgo = 0) {
  const localNow = new Date(now.getTime() + OFFSET_MINUTES * 60_000);
  return new Date(Date.UTC(
    localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate() - daysAgo,
  ));
}

function dateKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function hourOf(date: Date) {
  return Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23',
  }).format(date));
}

export async function GET(req: NextRequest) {
  try {
    await requireRole('ADMIN', 'SUPER_ADMIN');
    const { searchParams } = new URL(req.url);
    const requestedTimeframe = searchParams.get('timeframe') || '30d';
    const timeframe = ['7d', '30d', 'month', 'year'].includes(requestedTimeframe)
      ? requestedTimeframe
      : '30d';
    const now = new Date();
    const localNow = new Date(now.getTime() + OFFSET_MINUTES * 60_000);
    let startDate: Date;

    if (timeframe === '7d') startDate = businessDateStart(now, 6);
    else if (timeframe === '30d') startDate = businessDateStart(now, 29);
    else if (timeframe === 'month') {
      const monthStart = new Date(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), 1));
      startDate = new Date(monthStart.getTime() - OFFSET_MINUTES * 60_000);
    } else {
      const yearStart = new Date(Date.UTC(localNow.getUTCFullYear(), 0, 1));
      startDate = new Date(yearStart.getTime() - OFFSET_MINUTES * 60_000);
    }
    const endDate = businessDateStart(now, -1);
    const calendarStartDate = businessCalendarDateStart(
      now,
      timeframe === '7d' ? 6 : timeframe === '30d' ? 29 : 0,
    );
    const calendarEndDate = businessCalendarDateStart(now, -1);
    if (timeframe === 'month') {
      calendarStartDate.setUTCDate(1);
    } else if (timeframe === 'year') {
      calendarStartDate.setUTCMonth(0, 1);
    }

    const [bookings, payments, paidMemberships, refunds, facilities, stations, staffUsers] = await Promise.all([
      prisma.booking.findMany({
        where: {
          date: { gte: calendarStartDate, lt: calendarEndDate },
          status: { in: [...ACTIVE_BOOKING_STATUSES] },
        },
        select: {
          id: true,
          date: true,
          startTime: true,
          durationMinutes: true,
          isWalkIn: true,
          discountPaise: true,
          station: { select: { id: true, name: true, stationType: true, facility: { select: { id: true, name: true } } } },
        },
        orderBy: { date: 'asc' },
      }),
      prisma.payment.findMany({
        where: { status: { in: ['COMPLETED', 'REFUNDED', 'PARTIALLY_REFUNDED'] }, paidAt: { gte: startDate, lt: endDate } },
        select: {
          amountPaise: true,
          method: true,
          paidAt: true,
          bookingId: true,
          recordedByStaffId: true,
          booking: { select: { station: { select: { id: true, facility: { select: { id: true, name: true } } } } } },
        },
      }),
      prisma.membership.findMany({
        where: { status: { not: 'CANCELLED' }, pricePaidPaise: { gt: 0 }, createdAt: { gte: startDate, lt: endDate } },
        select: {
          pricePaidPaise: true,
          paymentMethod: true,
          createdAt: true,
        },
      }),
      prisma.refund.findMany({
        where: { status: 'COMPLETED', processedAt: { gte: startDate, lt: endDate } },
        select: {
          amountPaise: true,
          processedAt: true,
          payment: {
            select: {
              bookingId: true,
              booking: {
                select: {
                  station: {
                    select: { id: true, facility: { select: { id: true } } },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.gamingFacility.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { displayOrder: 'asc' },
      }),
      prisma.gamingStation.findMany({
        where: { status: { not: 'DEACTIVATED' } },
        select: { id: true, name: true, stationType: true },
        orderBy: [{ facilityId: 'asc' }, { displayOrder: 'asc' }],
      }),
      prisma.user.findMany({
        where: { role: { in: ['STAFF', 'ADMIN', 'SUPER_ADMIN'] } },
        select: { id: true, firstName: true, lastName: true, role: true },
        orderBy: { firstName: 'asc' },
      }),
    ]);

    const bookingPaymentsPaise = payments.reduce((sum, payment) => sum + payment.amountPaise, 0);
    const membershipPaymentsPaise = paidMemberships.reduce((sum, m) => sum + m.pricePaidPaise, 0);
    const totalCollectedPaise = bookingPaymentsPaise + membershipPaymentsPaise;
    const refundsPaise = refunds.reduce((sum, refund) => sum + refund.amountPaise, 0);
    const revenueByBooking = new Map<string, number>();
    const methodTotals = new Map<string, { amountPaise: number; count: number }>();
    const facilityRevenue = new Map<string, number>();
    const dailyRevenue = new Map<string, number>();
    const stationRefunds = new Map<string, number>();

    for (const payment of payments) {
      revenueByBooking.set(payment.bookingId, (revenueByBooking.get(payment.bookingId) || 0) + payment.amountPaise);
      const method = methodTotals.get(payment.method) || { amountPaise: 0, count: 0 };
      method.amountPaise += payment.amountPaise;
      method.count += 1;
      methodTotals.set(payment.method, method);
      const facilityId = payment.booking.station.facility.id;
      facilityRevenue.set(facilityId, (facilityRevenue.get(facilityId) || 0) + payment.amountPaise);
      if (payment.paidAt) {
        const key = dateKey(payment.paidAt);
        dailyRevenue.set(key, (dailyRevenue.get(key) || 0) + payment.amountPaise);
      }
    }
    for (const membership of paidMemberships) {
      const methodKey = membership.paymentMethod || 'UPI';
      const method = methodTotals.get(methodKey) || { amountPaise: 0, count: 0 };
      method.amountPaise += membership.pricePaidPaise;
      method.count += 1;
      methodTotals.set(methodKey, method);
      const key = dateKey(membership.createdAt);
      dailyRevenue.set(key, (dailyRevenue.get(key) || 0) + membership.pricePaidPaise);
    }
    for (const refund of refunds) {
      const stationId = refund.payment.booking.station.id;
      const facilityId = refund.payment.booking.station.facility.id;
      stationRefunds.set(stationId, (stationRefunds.get(stationId) || 0) + refund.amountPaise);
      facilityRevenue.set(facilityId, (facilityRevenue.get(facilityId) || 0) - refund.amountPaise);
      if (refund.processedAt) {
        const key = dateKey(refund.processedAt);
        dailyRevenue.set(key, (dailyRevenue.get(key) || 0) - refund.amountPaise);
      }
    }

    const dailyBookings = new Map<string, { bookings: number; walkIns: number }>();
    const stationTotals = new Map<string, { hours: number; revenuePaise: number }>();
    const hourCounts = Array.from({ length: 24 }, (_, hour) => ({
      hour: `${String(hour).padStart(2, '0')}:00`,
      bookings: 0,
    }));
    for (const booking of bookings) {
      const key = dateKey(booking.date);
      const daily = dailyBookings.get(key) || { bookings: 0, walkIns: 0 };
      daily.bookings += 1;
      if (booking.isWalkIn) daily.walkIns += 1;
      dailyBookings.set(key, daily);
      hourCounts[hourOf(booking.startTime)].bookings += 1;
      const station = stationTotals.get(booking.station.id) || { hours: 0, revenuePaise: 0 };
      station.hours += booking.durationMinutes / 60;
      station.revenuePaise += revenueByBooking.get(booking.id) || 0;
      stationTotals.set(booking.station.id, station);
    }

    const calendarDays: Date[] = [];
    for (let day = startDate; day < endDate; day = new Date(day.getTime() + 24 * 60 * 60_000)) {
      calendarDays.push(day);
    }
    const trend = calendarDays.map((day) => {
      const key = dateKey(day);
      return {
        date: new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric' }).format(day),
        revenue: Math.round((dailyRevenue.get(key) || 0) / 100),
        bookings: dailyBookings.get(key)?.bookings || 0,
        walkIns: dailyBookings.get(key)?.walkIns || 0,
      };
    });

    const paidBookingCount = revenueByBooking.size;
    const discountPaise = bookings.reduce((sum, booking) =>
      sum + (revenueByBooking.has(booking.id) ? booking.discountPaise : 0), 0);
    const totalDurationMinutes = bookings.reduce((sum, booking) => sum + booking.durationMinutes, 0);
    const walkInCount = bookings.filter((booking) => booking.isWalkIn).length;
    const facilitySplit = facilities.map((facility) => {
      const revenuePaise = facilityRevenue.get(facility.id) || 0;
      return {
        name: facility.name,
        revenueINR: Math.round(revenuePaise / 100),
        percent: totalCollectedPaise > refundsPaise ? Math.round((revenuePaise / (totalCollectedPaise - refundsPaise)) * 100) : 0,
      };
    });

    return apiSuccess({
      timeframe,
      summary: {
        grossRevenuePaise: totalCollectedPaise,
        netRevenuePaise: totalCollectedPaise - refundsPaise,
        discountPaise,
        totalBookings: bookings.length,
        averageBookingValuePaise: paidBookingCount ? Math.round((totalCollectedPaise - refundsPaise) / paidBookingCount) : 0,
        totalHoursPlayed: Math.round(totalDurationMinutes / 60),
        walkInCount,
        onlineCount: bookings.length - walkInCount,
        walkInSharePercent: bookings.length ? Math.round((walkInCount / bookings.length) * 100) : 0,
        refundsPaise,
      },
      paymentMethods: [...methodTotals].map(([method, value]) => ({
        method,
        amountINR: Math.round(value.amountPaise / 100),
        count: value.count,
      })),
      facilitySplit,
      trend,
      stationPerformance: stations.map((station) => ({
        id: station.id,
        name: station.name,
        type: station.stationType,
        hoursBooked: Math.round((stationTotals.get(station.id)?.hours || 0) * 10) / 10,
        revenuePaise: (stationTotals.get(station.id)?.revenuePaise || 0) - (stationRefunds.get(station.id) || 0),
      })),
      peakHours: hourCounts,
      staffCollections: staffUsers.map((s) => {
        const staffPayments = payments.filter((p) => p.recordedByStaffId === s.id);
        const cashPaise = staffPayments.filter((p) => p.method === 'CASH').reduce((sum, p) => sum + p.amountPaise, 0);
        const upiPaise = staffPayments.filter((p) => p.method === 'UPI').reduce((sum, p) => sum + p.amountPaise, 0);
        const totalPaise = staffPayments.reduce((sum, p) => sum + p.amountPaise, 0);
        return {
          id: s.id,
          name: `${s.firstName} ${s.lastName}`.trim(),
          role: s.role,
          count: staffPayments.length,
          cashPaise,
          upiPaise,
          totalPaise,
        };
      }).filter((s) => s.count > 0),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
