import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError, NotFoundError, ValidationError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { z } from 'zod';

const checkInSchema = z.object({
  identifier: z.string().min(1, 'Booking reference or QR token required'),
  autoStartSession: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const staffSession = await requireRole('STAFF', 'ADMIN', 'SUPER_ADMIN');
    const staffName = `${staffSession.firstName} ${staffSession.lastName}`.trim();
    const body = await req.json();
    const { identifier, autoStartSession } = checkInSchema.parse(body);

    const cleanId = identifier.trim();

    try {
      const booking = await prisma.booking.findFirst({
        where: {
          OR: [{ bookingRef: cleanId }, { qrToken: cleanId }, { id: cleanId }],
        },
        include: {
          station: { include: { facility: true } },
          user: true,
          payments: true,
          session: true,
        },
      });

      if (!booking) {
        throw new NotFoundError(`No reservation found matching reference '${cleanId}'`);
      }

      if (booking.status === 'CANCELLED') {
        throw new ValidationError('This reservation was cancelled');
      }

      if (booking.status === 'PENDING' || booking.status === 'PAYMENT_FAILED') {
        throw new ValidationError('Payment has not been confirmed for this reservation');
      }

      if (booking.status === 'COMPLETED') {
        throw new ValidationError('This session has already been completed');
      }

      const result = await prisma.$transaction(async (tx) => {
        // Update booking status
        const updatedBooking = await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: autoStartSession ? 'IN_PROGRESS' : 'CHECKED_IN',
          },
          include: {
            station: true,
            user: true,
            payments: true,
          },
        });

        // Mark station as OCCUPIED
        await tx.gamingStation.update({
          where: { id: booking.stationId },
          data: { status: 'OCCUPIED' },
        });

        // If paying at counter was pending, mark payment completed with staffId
        const pendingPayment = booking.payments.find((p) => p.status === 'PENDING');
        if (pendingPayment) {
          await tx.payment.update({
            where: { id: pendingPayment.id },
            data: {
              status: 'COMPLETED',
              paidAt: new Date(),
              recordedByStaffId: staffSession.userId,
              notes: `Desk counter payment confirmed by ${staffName}`,
            },
          });
        }

        let session = booking.session;
        if (autoStartSession && !session) {
          const now = new Date();
          const scheduledEndAt = new Date(now.getTime() + booking.durationMinutes * 60 * 1000);

          session = await tx.gamingSession.create({
            data: {
              bookingId: booking.id,
              stationId: booking.stationId,
              staffId: staffSession.userId,
              status: 'ACTIVE',
              startedAt: now,
              scheduledEndAt,
              notes: `Checked in by ${staffName}`,
            },
          });
        } else if (session && !session.staffId) {
          // If session existed without staffId, attribute it now
          session = await tx.gamingSession.update({
            where: { id: session.id },
            data: { staffId: staffSession.userId },
          });
        }

        // Log staff activity
        await tx.staffActivityLog.create({
          data: {
            userId: staffSession.userId,
            action: 'CHECK_IN_SESSION',
            entityType: 'booking',
            entityId: booking.id,
            details: {
              bookingRef: booking.bookingRef,
              stationId: booking.stationId,
              customerName: booking.customerName || `${booking.user.firstName} ${booking.user.lastName}`,
              staffName,
            },
          },
        }).catch(() => {});

        return { booking: updatedBooking, session };
      });

      return apiSuccess({
        message: 'Customer successfully checked in!',
        booking: result.booking,
        session: result.session,
      });
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof ValidationError) {
        throw err;
      }

      throw err;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
