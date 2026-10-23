import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, ConflictError, handleApiError, NotFoundError, ValidationError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { staffBookingDayRange } from '@/lib/staffBookingViews';

const patchBookingSchema = z.object({
  bookingId: z.string().min(1),
  action: z.enum(['CANCEL', 'MARK_PAID', 'NO_SHOW']),
  paymentMethod: z.enum(['CASH', 'UPI']).optional().default('CASH'),
  reason: z.string().optional(),
});

const deleteBookingSchema = z.object({
  bookingId: z.string().optional(),
  bookingIds: z.array(z.string()).optional(),
  clearAll: z.boolean().optional(),
  scope: z.enum(['ALL', 'COMPLETED_CANCELLED', 'WALK_IN_TEST']).optional().default('ALL'),
});

export async function GET(req: NextRequest) {
  try {
    await requireRole('ADMIN', 'SUPER_ADMIN', 'STAFF');
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const stationId = searchParams.get('stationId') || '';
    const day = searchParams.get('day');
    let dayFilter: Prisma.BookingWhereInput | undefined;
    if (day) {
      let range: ReturnType<typeof staffBookingDayRange>;
      try {
        range = staffBookingDayRange(day);
      } catch {
        throw new ValidationError('Invalid booking date');
      }
      const timestamp = { gte: range.start, lt: range.end };
      dayFilter = status === 'COMPLETED'
        ? { OR: [{ session: { is: { endedAt: timestamp } } }, { updatedAt: timestamp }] }
        : { startTime: timestamp };
    }

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
          ...(dayFilter ? { AND: [dayFilter] } : {}),
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
      !status && !dayFilter
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

      const isSnooker =
        booking.station?.stationType === 'POOL_TABLE' ||
        booking.station?.name?.toUpperCase().includes('SNOOKER') ||
        booking.station?.name?.toUpperCase().includes('POOL');

      const playerMatch = booking.notes?.match(/\[Players:\s*(\d+)\]/i);
      const playerCount = playerMatch ? parseInt(playerMatch[1], 10) : (isSnooker ? 4 : 1);

      let cleanGameTitle = booking.gameTitle || null;
      if (!cleanGameTitle && booking.session?.notes) {
        const stripped = booking.session.notes.replace(/\[PAY ON EXIT\]/gi, '').trim();
        if (stripped) cleanGameTitle = stripped;
      }
      if (!cleanGameTitle && booking.notes) {
        const match = booking.notes.match(/Game:\s*([^.\n\r\[]+)/i);
        if (match && match[1]?.trim()) {
          cleanGameTitle = match[1].trim();
        }
      }
      if (cleanGameTitle && (cleanGameTitle.includes('[PAY ON EXIT]') || cleanGameTitle === '[PAY ON EXIT]')) {
        cleanGameTitle = cleanGameTitle.replace(/\[PAY ON EXIT\]/gi, '').trim();
      }
      const finalGameTitle = isSnooker ? null : (cleanGameTitle || null);

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
        gameTitle: finalGameTitle,
        notes: booking.notes,
        stationSpecs: isSnooker
          ? ''
          : ((booking.station?.metadata as any)?.specs || (booking.station?.stationType === 'PS5' ? '4K 120Hz OLED Display' : '')),
        stationCapacity:
          (booking.station?.metadata as any)?.capacity || (isSnooker ? 4 : 2),
        stationType: booking.station?.stationType || (isSnooker ? 'POOL_TABLE' : 'PS5'),
        isSnooker,
        playerCount,
        pricePerHourPaise: booking.station?.pricePerHourPaise || (isSnooker ? 25000 : 15000),
        session: booking.session
          ? {
              id: booking.session.id,
              status: booking.session.status,
              startedAt: booking.session.startedAt,
              scheduledEndAt: booking.session.scheduledEndAt,
              endedAt: booking.session.endedAt || null,
              extensionMinutes: booking.session.extensionMinutes,
              gameTitle: finalGameTitle,
              playerCount,
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
              gameTitle: finalGameTitle,
              playerCount,
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

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireRole('ADMIN', 'SUPER_ADMIN');
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body may be empty
    }

    const { bookingId, bookingIds, clearAll, scope } = deleteBookingSchema.parse(body);

    let targetIds: string[] = [];

    if (bookingId) {
      targetIds = [bookingId];
    } else if (bookingIds && bookingIds.length > 0) {
      targetIds = bookingIds;
    } else if (clearAll) {
      let whereClause: any = {};
      if (scope === 'COMPLETED_CANCELLED') {
        whereClause = {
          status: { in: ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'PAYMENT_FAILED'] },
        };
      } else if (scope === 'WALK_IN_TEST') {
        whereClause = {
          OR: [
            { isWalkIn: true },
            { user: { email: 'guest@darksyndicate.in' } },
          ],
        };
      }
      const matching = await prisma.booking.findMany({
        where: whereClause,
        select: { id: true },
      });
      targetIds = matching.map((b) => b.id);
    } else {
      throw new ValidationError('Please provide a bookingId, bookingIds array, or clearAll: true.');
    }

    if (targetIds.length === 0) {
      return apiSuccess({ message: 'No matching reservations found to delete.', deletedCount: 0 });
    }

    const bookingsToDelete = await prisma.booking.findMany({
      where: { id: { in: targetIds } },
      select: { id: true, stationId: true, bookingRef: true },
    });
    const affectedStationIds = Array.from(
      new Set(bookingsToDelete.map((b) => b.stationId).filter(Boolean))
    );

    await prisma.$transaction(async (tx) => {
      // 1. Delete associated coupon redemptions
      await tx.couponRedemption.deleteMany({
        where: { bookingId: { in: targetIds } },
      });

      // 2. Delete associated payments
      await tx.payment.deleteMany({
        where: { bookingId: { in: targetIds } },
      });

      // 3. Delete associated live/completed gaming sessions
      await tx.gamingSession.deleteMany({
        where: { bookingId: { in: targetIds } },
      });

      // 4. Delete the bookings themselves
      await tx.booking.deleteMany({
        where: { id: { in: targetIds } },
      });

      // 5. Safely reset affected station status if no other active floor session exists
      for (const stId of affectedStationIds) {
        const station = await tx.gamingStation.findUnique({
          where: { id: stId },
          select: { status: true },
        });
        if (station && station.status === 'OCCUPIED') {
          const remainingSession = await tx.gamingSession.findFirst({
            where: {
              stationId: stId,
              status: { in: ['ACTIVE', 'PAUSED', 'EXTENDED', 'OVERDUE'] },
            },
          });
          if (!remainingSession) {
            await tx.gamingStation.update({
              where: { id: stId },
              data: { status: 'AVAILABLE' },
            });
          }
        }
      }
    });

    // 6. Record audit log
    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: 'DELETE',
        entityType: 'Booking',
        entityId: targetIds.length === 1 ? targetIds[0] : 'BULK_CLEAR',
        oldValue: {
          count: targetIds.length,
          refs: bookingsToDelete.slice(0, 10).map((b) => b.bookingRef),
          scope: scope || 'CUSTOM',
        },
        newValue: { deleted: true },
      },
    }).catch(() => {});

    return apiSuccess({
      message: `Successfully deleted ${targetIds.length} reservation(s).`,
      deletedCount: targetIds.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
