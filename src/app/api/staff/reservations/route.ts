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
    const bookings = await prisma.booking.findMany({
      where: { status: 'CONFIRMED', notes: { contains: reservationMarker } },
      include: {
        station: { include: { facility: true } },
        user: { select: { firstName: true, lastName: true } },
        payments: { select: { status: true, method: true, recordedByStaffId: true } },
      },
      orderBy: { startTime: 'asc' },
    });
    const ids = bookings.map((booking) => booking.id);
    const creatorLogs = ids.length ? await prisma.staffActivityLog.findMany({
      where: { entityType: 'booking', entityId: { in: ids }, action: 'CREATE_RESERVATION' },
      select: { entityId: true, userId: true },
      orderBy: { createdAt: 'asc' },
    }) : [];
    const loggedCreators = new Map<string, string>();
    for (const log of creatorLogs) {
      if (log.entityId && !loggedCreators.has(log.entityId)) loggedCreators.set(log.entityId, log.userId);
    }
    const ownerIds = new Set(bookings.map((booking) => reservationCreatorId({
      payments: booking.payments,
    }, loggedCreators.get(booking.id) || null)).filter((id): id is string => Boolean(id)));
    const owners = ownerIds.size ? await prisma.user.findMany({
      where: { id: { in: [...ownerIds] } },
      select: { id: true, firstName: true, lastName: true },
    }) : [];
    const ownerNames = new Map(owners.map((owner) => [owner.id, `${owner.firstName} ${owner.lastName}`.trim()]));

    return apiSuccess(bookings.map((booking) => {
      const creatorId = reservationCreatorId({
        payments: booking.payments,
      }, loggedCreators.get(booking.id) || null);
      const payment = booking.payments.find((item) => item.status === 'COMPLETED') || booking.payments[0];
      return {
        id: booking.id,
        bookingRef: booking.bookingRef,
        customerName: booking.customerName || `${booking.user.firstName} ${booking.user.lastName}`.trim(),
        customerPhone: booking.customerPhone,
        stationName: booking.station.name,
        facilityName: booking.station.facility.name,
        startTime: booking.startTime,
        endTime: booking.endTime,
        durationMinutes: booking.durationMinutes,
        totalPricePaise: booking.totalPricePaise,
        paymentStatus: payment?.status || 'UNPAID',
        paymentMethod: payment?.method || null,
        creatorName: creatorId ? ownerNames.get(creatorId) || 'Staff member' : 'Unknown',
        canDelete: canDeleteReservation(viewer.role, viewer.userId, creatorId),
      };
    }));
  } catch (error) {
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
