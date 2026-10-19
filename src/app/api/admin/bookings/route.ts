import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, ConflictError, handleApiError, NotFoundError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { z } from 'zod';

const patchBookingSchema = z.object({
  bookingId: z.string().min(1),
  action: z.enum(['CANCEL', 'MARK_PAID', 'NO_SHOW']),
  paymentMethod: z.enum(['CASH', 'UPI']).optional().default('CASH'),
  reason: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireRole('ADMIN', 'SUPER_ADMIN', 'STAFF');
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const stationId = searchParams.get('stationId') || '';

    const bookingInclude = {
      station: { include: { facility: true } },
      user: { select: { firstName: true, lastName: true, email: true, phone: true } },
      session: {
        include: {
          staff: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
      },
      payments: { orderBy: { createdAt: 'desc' as const }, take: 1 },
    };

    const [recentBookings, activeFloorBookings] = await Promise.all([
      prisma.booking.findMany({
        where: {
          ...(status ? { status: status as any } : {}),
          ...(stationId ? { stationId } : {}),
          ...(search
            ? {
                OR: [
                  { bookingRef: { contains: search } },
                  { customerName: { contains: search } },
                  { customerPhone: { contains: search } },
                  { user: { email: { contains: search } } },
                ],
              }
            : {}),
        },
        include: bookingInclude,
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      !status
        ? prisma.booking.findMany({
            where: {
              ...(stationId ? { stationId } : {}),
              OR: [
                { status: { in: ['IN_PROGRESS', 'CHECKED_IN'] } },
                { session: { status: { in: ['ACTIVE', 'PAUSED', 'EXTENDED', 'OVERDUE'] } } },
              ],
            },
            include: bookingInclude,
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
    ]);

    const seenBookingIds = new Set<string>();
    const bookings = [...activeFloorBookings, ...recentBookings].filter((b) => {
      if (seenBookingIds.has(b.id)) return false;
      seenBookingIds.add(b.id);
      return true;
    });

    // Lookup staff activity logs for walk-ins without explicit session staff
    const walkInIds = bookings.filter((b) => b.isWalkIn && !b.session?.staff).map((b) => b.id);
    const staffLogs =
      walkInIds.length > 0
        ? await prisma.staffActivityLog.findMany({
            where: { entityId: { in: walkInIds } },
            include: { user: { select: { firstName: true, lastName: true } } },
            orderBy: { createdAt: 'desc' },
          })
        : [];

    const staffMap = new Map<string, string>();
    for (const log of staffLogs) {
      if (log.entityId && log.user && !staffMap.has(log.entityId)) {
        staffMap.set(log.entityId, `${log.user.firstName} ${log.user.lastName}`.trim());
      }
    }

    const mappedBookings = bookings.map((booking) => {
      const isWalkIn = Boolean(booking.isWalkIn);
      let staffName: string | null = null;

      if (isWalkIn) {
        if (booking.session?.staff) {
          staffName = `${booking.session.staff.firstName} ${booking.session.staff.lastName}`.trim();
        } else if (staffMap.has(booking.id)) {
          staffName = staffMap.get(booking.id)!;
        } else if (booking.notes && /by\s+([A-Za-z0-9\s]+)/i.test(booking.notes)) {
          const match = booking.notes.match(/by\s+([A-Za-z0-9\s]+)/i);
          if (match && match[1]) {
            staffName = match[1].trim();
          }
        }
        if (!staffName) {
          staffName = 'Front Desk Staff';
        }
      }

      const gameTitle =
        booking.gameTitle ||
        booking.session?.notes ||
        (booking.notes?.match(/Game:\s*([^.\n\r\[]+)/)?.[1]?.trim()) ||
        null;

      const hasActiveFloorSession = Boolean(
        booking.session && ['ACTIVE', 'PAUSED', 'EXTENDED', 'OVERDUE'].includes(booking.session.status)
      );
      const effectiveStatus =
        hasActiveFloorSession && (booking.status === 'CONFIRMED' || booking.status === 'PENDING')
          ? 'IN_PROGRESS'
          : booking.status;

      return {
        id: booking.id,
        bookingRef: booking.bookingRef,
        customerName: booking.customerName || `${booking.user.firstName} ${booking.user.lastName}`.trim(),
        customerEmail: booking.user.email,
        customerPhone: booking.customerPhone || booking.user.phone,
        stationId: booking.stationId,
        stationName: booking.station.name,
        facilityName: booking.station.facility.name,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        durationMinutes: booking.durationMinutes,
        totalPricePaise: booking.totalPricePaise,
        status: effectiveStatus,
        isWalkIn,
        channel: isWalkIn ? 'DESK' : 'ONLINE',
        bookedVia: isWalkIn ? 'Front Desk Walk-in' : 'Online Website',
        staffName: isWalkIn ? staffName : null,
        paymentId: booking.payments[0]?.id || null,
        paymentStatus: booking.payments[0]?.status || 'UNPAID',
        paymentMethod: booking.payments[0]?.method || null,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        gameTitle,
        notes: booking.notes,
        stationSpecs:
          (booking.station?.metadata as any)?.specs || 'Ultra-low latency 4K 120Hz display',
        stationCapacity:
          (booking.station?.metadata as any)?.capacity || (booking.station?.stationType === 'PS5' ? 2 : 4),
        stationType: booking.station?.stationType || 'PS5',
        pricePerHourPaise: booking.station?.pricePerHourPaise || 15000,
        session: booking.session
          ? {
              id: booking.session.id,
              status: booking.session.status,
              startedAt: booking.session.startedAt,
              scheduledEndAt: booking.session.scheduledEndAt,
              endedAt: booking.session.endedAt || null,
              extensionMinutes: booking.session.extensionMinutes,
              gameTitle,
              staff: booking.session.staff || null,
            }
          : effectiveStatus === 'IN_PROGRESS' || effectiveStatus === 'CHECKED_IN'
          ? {
              id: `active-${booking.id}`,
              status: 'ACTIVE',
              startedAt: booking.startTime,
              scheduledEndAt: booking.endTime,
              endedAt: null,
              extensionMinutes: 0,
              gameTitle,
              staff: null,
            }
          : null,
      };
    });

    return apiSuccess(mappedBookings);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireRole('ADMIN', 'SUPER_ADMIN', 'STAFF');
    const body = await req.json();
    const { bookingId, action, paymentMethod, reason } = patchBookingSchema.parse(body);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        station: true,
        user: true,
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        session: true,
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const now = new Date();
    const isGuestUser = booking.user?.email === 'guest@darksyndicate.in';

    if (action === 'CANCEL') {
      if (['CANCELLED', 'COMPLETED', 'IN_PROGRESS'].includes(booking.status)) {
        throw new ConflictError(`Cannot cancel a booking that is already ${booking.status}.`);
      }

      await prisma.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id: bookingId },
          data: {
            status: 'CANCELLED',
            cancelledAt: now,
            cancelReason: reason || 'Cancelled by Administrator',
          },
        });

        await tx.payment.updateMany({
          where: { bookingId, status: 'PENDING' },
          data: { status: 'FAILED' },
        });
      });

      if (!isGuestUser && booking.userId) {
        await prisma.notification.create({
          data: {
            userId: booking.userId,
            title: 'Booking Cancelled',
            message: `Your reservation ${booking.bookingRef} at ${booking.station.name} has been cancelled.${reason ? ` Reason: ${reason}` : ''}`,
            type: 'BOOKING_CANCELLED',
          },
        }).catch(() => {});
      }

      await prisma.auditLog.create({
        data: {
          userId: session.userId,
          action: 'STATUS_CHANGE',
          entityType: 'Booking',
          entityId: bookingId,
          oldValue: { status: booking.status, bookingRef: booking.bookingRef },
          newValue: { status: 'CANCELLED', bookingRef: booking.bookingRef, reason: reason || 'Cancelled by Administrator' },
        },
      }).catch(() => {});

      return apiSuccess({ message: `Booking ${booking.bookingRef} cancelled successfully.` });
    }

    if (action === 'NO_SHOW') {
      if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
        throw new ConflictError(`Only PENDING or CONFIRMED bookings can be marked as No-Show.`);
      }

      await prisma.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id: bookingId },
          data: { status: 'NO_SHOW' },
        });

        await tx.payment.updateMany({
          where: { bookingId, status: 'PENDING' },
          data: { status: 'FAILED' },
        });
      });

      await prisma.auditLog.create({
        data: {
          userId: session.userId,
          action: 'STATUS_CHANGE',
          entityType: 'Booking',
          entityId: bookingId,
          oldValue: { status: booking.status, bookingRef: booking.bookingRef },
          newValue: { status: 'NO_SHOW', bookingRef: booking.bookingRef },
        },
      }).catch(() => {});

      return apiSuccess({ message: `Booking ${booking.bookingRef} marked as No-Show.` });
    }

    if (action === 'MARK_PAID') {
      const latestPayment = booking.payments[0];
      if (latestPayment?.status === 'COMPLETED') {
        throw new ConflictError(`Booking ${booking.bookingRef} is already paid.`);
      }

      await prisma.$transaction(async (tx) => {
        if (latestPayment) {
          await tx.payment.update({
            where: { id: latestPayment.id },
            data: {
              status: 'COMPLETED',
              method: paymentMethod,
              paidAt: now,
              recordedByStaffId: session.userId,
            },
          });
        } else {
          await tx.payment.create({
            data: {
              bookingId,
              userId: booking.userId,
              amountPaise: booking.totalPricePaise,
              method: paymentMethod,
              status: 'COMPLETED',
              paidAt: now,
              recordedByStaffId: session.userId,
            },
          });
        }

        if (booking.status === 'PENDING') {
          await tx.booking.update({
            where: { id: bookingId },
            data: { status: 'CONFIRMED' },
          });
        }

        if (!isGuestUser && booking.userId && booking.totalPricePaise > 0) {
          await tx.customerProfile.upsert({
            where: { userId: booking.userId },
            create: { userId: booking.userId, totalSpent: booking.totalPricePaise },
            update: { totalSpent: { increment: booking.totalPricePaise } },
          });
        }
      });

      await prisma.auditLog.create({
        data: {
          userId: session.userId,
          action: 'PAYMENT',
          entityType: 'Booking',
          entityId: bookingId,
          oldValue: { paymentStatus: latestPayment?.status || 'UNPAID', bookingRef: booking.bookingRef },
          newValue: {
            paymentStatus: 'COMPLETED',
            method: paymentMethod,
            amountPaise: booking.totalPricePaise,
            bookingRef: booking.bookingRef,
          },
        },
      }).catch(() => {});

      return apiSuccess({
        message: `Payment of ₹${(booking.totalPricePaise / 100).toLocaleString('en-IN')} recorded via ${paymentMethod} for ${booking.bookingRef}.`,
      });
    }

    throw new ConflictError('Unsupported action');
  } catch (error) {
    return handleApiError(error);
  }
}
