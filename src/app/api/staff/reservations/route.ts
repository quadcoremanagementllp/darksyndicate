import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiSuccess, ConflictError, ForbiddenError, handleApiError, NotFoundError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { canDeleteReservation, reservationCreatorId } from '@/lib/staffReservations';

const deleteSchema = z.object({ bookingId: z.string().min(1) });
const reservationMarker = '[Front Desk Pre-Booking]';

export async function GET() {
  try {
    const viewer = await requireRole('STAFF', 'ADMIN', 'SUPER_ADMIN');
    // Read booking rows first so missing display relations cannot fail the list.
    const candidates = await prisma.booking.findMany({
      where: { status: 'CONFIRMED', isWalkIn: false },
      select: {
        id: true, bookingRef: true, userId: true, stationId: true,
        customerName: true, customerPhone: true, notes: true,
        startTime: true, endTime: true, durationMinutes: true, totalPricePaise: true,
      },
      orderBy: { startTime: 'asc' },
    });
    const bookings = candidates.filter((booking) => booking.notes?.includes(reservationMarker));
    if (bookings.length === 0) return apiSuccess([]);
    const ids = bookings.map((booking) => booking.id);
    const [stations, payments, creatorLogs] = await Promise.all([
      prisma.gamingStation.findMany({
        where: { id: { in: [...new Set(bookings.map((booking) => booking.stationId))] } },
        select: { id: true, name: true, facility: { select: { name: true } } },
      }),
      prisma.payment.findMany({
        where: { bookingId: { in: ids } },
        select: { bookingId: true, status: true, method: true, recordedByStaffId: true },
        orderBy: { createdAt: 'desc' },
      }).catch((error) => {
        console.error('Staff reservation payment lookup failed:', error);
        return [];
      }),
      prisma.staffActivityLog.findMany({
        where: { entityType: 'booking', entityId: { in: ids }, action: 'CREATE_RESERVATION' },
        select: { entityId: true, userId: true },
        orderBy: { createdAt: 'asc' },
      }).catch((error) => {
        console.error('Staff reservation creator lookup failed:', error);
        return [];
      }),
    ]);
    const stationById = new Map(stations.map((station) => [station.id, station]));
    const paymentsByBooking = new Map<string, typeof payments>();
    for (const payment of payments) {
      const group = paymentsByBooking.get(payment.bookingId) || [];
      group.push(payment);
      paymentsByBooking.set(payment.bookingId, group);
    }
    const loggedCreators = new Map<string, string>();
    for (const log of creatorLogs) {
      if (log.entityId && !loggedCreators.has(log.entityId)) loggedCreators.set(log.entityId, log.userId);
    }
    const ownerIds = new Set(bookings.map((booking) => reservationCreatorId({
      payments: paymentsByBooking.get(booking.id) || [],
    }, loggedCreators.get(booking.id) || null)).filter((id): id is string => Boolean(id)));
    const people = await prisma.user.findMany({
      where: { id: { in: [...new Set([...bookings.map((booking) => booking.userId), ...ownerIds])] } },
      select: { id: true, firstName: true, lastName: true },
    });
    const personNames = new Map(people.map((person) => [person.id, `${person.firstName} ${person.lastName}`.trim()]));

    return apiSuccess(bookings.map((booking) => {
      const bookingPayments = paymentsByBooking.get(booking.id) || [];
      const creatorId = reservationCreatorId({
        payments: bookingPayments,
      }, loggedCreators.get(booking.id) || null);
      const payment = bookingPayments.find((item) => item.status === 'COMPLETED') || bookingPayments[0];
      const station = stationById.get(booking.stationId);
      return {
        id: booking.id,
        bookingRef: booking.bookingRef,
        customerName: booking.customerName || personNames.get(booking.userId) || 'Player',
        customerPhone: booking.customerPhone,
        stationName: station?.name || 'Station',
        facilityName: station?.facility.name || 'Arena',
        startTime: booking.startTime,
        endTime: booking.endTime,
        durationMinutes: booking.durationMinutes,
        totalPricePaise: booking.totalPricePaise,
        paymentStatus: payment?.status || 'UNPAID',
        paymentMethod: payment?.method || null,
        creatorName: creatorId ? personNames.get(creatorId) || 'Staff member' : 'Unknown',
        canDelete: canDeleteReservation(viewer.role, viewer.userId, creatorId),
      };
    }));
  } catch (error) {
    console.error('Staff reservations GET failed:', error);
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const viewer = await requireRole('STAFF', 'ADMIN', 'SUPER_ADMIN');
    const { bookingId } = deleteSchema.parse(await req.json());
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        session: { select: { id: true } },
        payments: { select: { status: true, recordedByStaffId: true } },
      },
    });
    if (!booking || !booking.notes?.includes(reservationMarker)) throw new NotFoundError('Reservation');
    const creatorLog = await prisma.staffActivityLog.findFirst({
      where: { entityType: 'booking', entityId: bookingId, action: 'CREATE_RESERVATION' },
      orderBy: { createdAt: 'asc' },
      select: { userId: true },
    });
    const creatorId = reservationCreatorId({
      payments: booking.payments,
    }, creatorLog?.userId || null);
    if (!canDeleteReservation(viewer.role, viewer.userId, creatorId)) {
      throw new ForbiddenError('Only the staff member who created this reservation or an administrator can delete it.');
    }
    if (booking.status !== 'CONFIRMED' || booking.session) {
      throw new ConflictError('Only reservations that have not started can be deleted.');
    }

    await prisma.$transaction(async (tx) => {
      const changed = await tx.booking.updateMany({
        where: { id: bookingId, status: 'CONFIRMED', session: { is: null } },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: viewer.userId,
          cancelReason: 'Deleted from staff reservations',
        },
      });
      if (changed.count !== 1) throw new ConflictError('This reservation has already changed. Refresh the list.');
      await tx.payment.updateMany({ where: { bookingId, status: 'PENDING' }, data: { status: 'FAILED' } });
      await tx.staffActivityLog.create({
        data: {
          userId: viewer.userId,
          action: 'DELETE_RESERVATION',
          entityType: 'booking',
          entityId: bookingId,
          details: { bookingRef: booking.bookingRef },
        },
      });
    });

    return apiSuccess({
      message: `Reservation ${booking.bookingRef} removed.`,
      paymentRefundRequired: booking.payments.some((payment) => payment.status === 'COMPLETED'),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
