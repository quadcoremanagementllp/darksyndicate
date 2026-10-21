import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError, NotFoundError, ValidationError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { z } from 'zod';

const extendSessionSchema = z.object({
  sessionId: z.string().optional(),
  stationId: z.string().optional(),
  bookingId: z.string().optional(),
  additionalMinutes: z.number().int().min(15).max(300).default(30),
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'OTHER']).default('CASH'),
});

export async function POST(req: NextRequest) {
  try {
    const staffSession = await requireRole('STAFF', 'ADMIN', 'SUPER_ADMIN');
    const staffName = `${staffSession.firstName} ${staffSession.lastName}`.trim();
    const body = await req.json();
    const data = extendSessionSchema.parse(body);

    if (!data.sessionId && !data.stationId && !data.bookingId) {
      throw new NotFoundError('Either sessionId, stationId, or bookingId is required');
    }

    try {
      // 1. Try finding by real sessionId
      let session = null;
      if (
        data.sessionId &&
        !data.sessionId.startsWith('active-') &&
        !data.sessionId.startsWith('pseudo-') &&
        !data.sessionId.startsWith('session-')
      ) {
        session = await prisma.gamingSession.findUnique({
          where: { id: data.sessionId },
          include: { station: true, booking: true },
        });
      }

      // 2. Try finding by bookingId
      if (!session && data.bookingId) {
        session = await prisma.gamingSession.findFirst({
          where: { bookingId: data.bookingId },
          include: { station: true, booking: true },
        });
      }

      // 3. Try finding active/extended/overdue session by stationId
      if (!session && data.stationId) {
        session = await prisma.gamingSession.findFirst({
          where: { stationId: data.stationId, status: { in: ['ACTIVE', 'EXTENDED', 'OVERDUE', 'PAUSED'] } },
          include: { station: true, booking: true },
        });
      }

      if (session) {
        const currentEnd = new Date(session.scheduledEndAt);
        const newEnd = new Date(currentEnd.getTime() + data.additionalMinutes * 60 * 1000);
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

        // Check collision with upcoming bookings (excluding stale pending checkouts)
        const conflict = await prisma.booking.findFirst({
          where: {
            stationId: session.stationId,
            id: { not: session.bookingId },
            AND: [
              {
                OR: [
                  { status: { in: ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] } },
                  { status: 'PENDING', createdAt: { gte: fifteenMinutesAgo } },
                ],
              },
              {
                startTime: { lt: newEnd },
                endTime: { gt: currentEnd },
              },
            ],
          },
        });

        if (conflict) {
          throw new ValidationError(
            `Cannot extend session: Another reservation is scheduled at ${new Date(
              conflict.startTime
            ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          );
        }

        const hourlyRate = session.station?.pricePerHourPaise || 15000;
        const extensionFeePaise = Math.round(hourlyRate * (data.additionalMinutes / 60));
        const recordedMethod = data.paymentMethod === 'UPI' ? 'UPI' : data.paymentMethod === 'CARD' ? 'OTHER' : 'CASH';

        const updated = await prisma.$transaction(async (tx) => {
          const sess = await tx.gamingSession.update({
            where: { id: session.id },
            data: {
              status: 'EXTENDED',
              scheduledEndAt: newEnd,
              extensionMinutes: { increment: data.additionalMinutes },
              extensionPaise: { increment: extensionFeePaise },
            },
          });

          if (session.bookingId) {
            await tx.booking.update({
              where: { id: session.bookingId },
              data: {
                endTime: newEnd,
                durationMinutes: { increment: data.additionalMinutes },
                totalPricePaise: { increment: extensionFeePaise },
              },
            });

            // Record payment for extension
            await tx.payment.create({
              data: {
                bookingId: session.bookingId,
                userId: session.booking.userId,
                amountPaise: extensionFeePaise,
                method: recordedMethod,
                status: 'COMPLETED',
                paidAt: new Date(),
                recordedByStaffId: staffSession.userId,
                notes: `Session extended +${data.additionalMinutes} mins (${data.paymentMethod}) by ${staffName}`,
              },
            });

            if (session.booking?.userId) {
              await tx.customerProfile.updateMany({
                where: { userId: session.booking.userId },
                data: { totalSpent: { increment: extensionFeePaise } },
              });
            }
          }

          return sess;
        });

        return apiSuccess({
          message: `Session extended by +${data.additionalMinutes} minutes!`,
          newScheduledEndAt: updated.scheduledEndAt,
          extensionFeePaise,
        });
      }

      // If no session row, fallback to bookingId directly
      if (data.bookingId) {
        const booking = await prisma.booking.findUnique({
          where: { id: data.bookingId },
          include: { station: true },
        });

        if (booking) {
          const currentEnd = new Date(booking.endTime);
          const newEnd = new Date(currentEnd.getTime() + data.additionalMinutes * 60 * 1000);
          const hourlyRate = booking.station?.pricePerHourPaise || 15000;
          const extensionFeePaise = Math.round(hourlyRate * (data.additionalMinutes / 60));

          await prisma.$transaction(async (tx) => {
            await tx.booking.update({
              where: { id: booking.id },
              data: {
                endTime: newEnd,
                durationMinutes: { increment: data.additionalMinutes },
                totalPricePaise: { increment: extensionFeePaise },
              },
            });

            await tx.payment.create({
              data: {
                bookingId: booking.id,
                userId: booking.userId,
                amountPaise: extensionFeePaise,
                method: data.paymentMethod === 'UPI' ? 'UPI' : 'CASH',
                status: 'COMPLETED',
                paidAt: new Date(),
                recordedByStaffId: staffSession.userId,
                notes: `Session extended +${data.additionalMinutes} mins by ${staffName}`,
              },
            });
          });

          return apiSuccess({
            message: `Session extended by +${data.additionalMinutes} minutes!`,
            newScheduledEndAt: newEnd.toISOString(),
            extensionFeePaise,
          });
        }
      }

      throw new NotFoundError('Active gaming session or booking not found to extend');
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof ValidationError) throw err;

      throw err;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
