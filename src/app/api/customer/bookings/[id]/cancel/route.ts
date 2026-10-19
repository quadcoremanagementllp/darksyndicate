import { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError, AuthError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      throw new AuthError('Please sign in to cancel a booking');
    }

    const { id } = await params;

    try {
      const booking = await prisma.booking.findUnique({
        where: { id },
      });

      if (!booking) {
        throw new NotFoundError('Booking record not found');
      }

      if (booking.userId !== session.userId && !['SUPER_ADMIN', 'ADMIN'].includes(session.role)) {
        throw new ForbiddenError('You do not have permission to cancel this booking');
      }

      if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(booking.status)) {
        throw new ValidationError(`Cannot cancel a booking with status ${booking.status}`);
      }

      // Check cancellation window (must be >= 2 hours before booking start)
      const bookingStart = booking.startTime;
      const now = new Date();
      const diffHours = (bookingStart.getTime() - now.getTime()) / (1000 * 60 * 60);

      const isRefundEligible = diffHours >= 2;

      const updated = await prisma.$transaction(async (tx) => {
        const cancelledBooking = await tx.booking.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            cancelledBy: session.userId,
            cancelledAt: now,
          },
        });

        // If station was OCCUPIED by this booking, restore to AVAILABLE
        await tx.gamingStation.updateMany({
          where: {
            id: booking.stationId,
            status: 'OCCUPIED',
          },
          data: { status: 'AVAILABLE' },
        });

        if (isRefundEligible) {
          const paid = await tx.payment.findMany({
            where: { bookingId: id, status: 'COMPLETED' },
            include: { refunds: { where: { status: { in: ['PENDING', 'PROCESSING', 'COMPLETED'] } } } },
          });
          for (const payment of paid) {
            const outstanding = payment.amountPaise - payment.refunds.reduce((sum, refund) => sum + refund.amountPaise, 0);
            if (outstanding > 0) {
              await tx.refund.create({
                data: { paymentId: payment.id, amountPaise: outstanding, status: 'PENDING', reason: 'Eligible booking cancellation; review and process refund' },
              });
            }
          }
        }

        return cancelledBooking;
      });

      return apiSuccess({
        message: isRefundEligible
          ? 'Booking cancelled. Any eligible refund has been queued for staff review; contact the venue for its status.'
          : 'Booking cancelled. Note: Cancellation occurred within 2 hours of session start time, partial/no refund policy applies.',
        booking: updated,
        refundEligible: isRefundEligible,
      });
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof ValidationError || err instanceof AuthError || err instanceof ForbiddenError) {
        throw err;
      }
      throw err;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
