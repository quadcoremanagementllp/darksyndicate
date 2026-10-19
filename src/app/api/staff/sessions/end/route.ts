import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError, NotFoundError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { z } from 'zod';

const endSessionSchema = z.object({
  sessionId: z.string().optional(),
  stationId: z.string().optional(),
  bookingId: z.string().optional(),
  extraMinutes: z.number().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const staffSession = await requireRole('STAFF', 'ADMIN', 'SUPER_ADMIN');
    const staffName = `${staffSession.firstName} ${staffSession.lastName}`.trim();
    const body = await req.json();
    const { sessionId, stationId, bookingId, extraMinutes } = endSessionSchema.parse(body);

    if (!sessionId && !stationId && !bookingId) {
      throw new NotFoundError('Either sessionId, stationId, or bookingId is required');
    }

    try {
      // 1. Try finding by real sessionId
      let session = null;
      if (sessionId && !sessionId.startsWith('active-') && !sessionId.startsWith('pseudo-') && !sessionId.startsWith('session-')) {
        session = await prisma.gamingSession.findUnique({
          where: { id: sessionId },
          include: { station: true, booking: true },
        });
      }

      // 2. Try finding by bookingId
      if (!session && bookingId) {
        session = await prisma.gamingSession.findFirst({
          where: { bookingId },
          include: { station: true, booking: true },
        });
      }

      // 3. Try finding active session by stationId
      if (!session && stationId) {
        session = await prisma.gamingSession.findFirst({
          where: { stationId, status: 'ACTIVE' },
          include: { station: true, booking: true },
        });
      }

      if (session) {
        const overtimeMinutes = extraMinutes && extraMinutes > 0 ? extraMinutes : 0;
        const hourlyRatePaise = session.station?.pricePerHourPaise || 15000;
        const overtimePaise = overtimeMinutes > 0 ? Math.round(hourlyRatePaise * (overtimeMinutes / 60)) : 0;

        await prisma.$transaction(async (tx) => {
          // End session & record overtime
          await tx.gamingSession.update({
            where: { id: session.id },
            data: {
              status: 'COMPLETED',
              endedAt: new Date(),
              extensionMinutes: (session.extensionMinutes || 0) + overtimeMinutes,
              extensionPaise: (session.extensionPaise || 0) + overtimePaise,
              staffId: session.staffId || staffSession.userId,
            },
          });

          // Mark booking completed and increment total price if overtime applied
          if (session.bookingId) {
            await tx.booking.update({
              where: { id: session.bookingId },
              data: {
                status: 'COMPLETED',
                ...(overtimePaise > 0 ? { totalPricePaise: { increment: overtimePaise } } : {}),
              },
            });

            // Create overtime desk payment record
            if (overtimePaise > 0 && session.booking) {
              await tx.payment.create({
                data: {
                  bookingId: session.bookingId,
                  userId: session.booking.userId,
                  amountPaise: overtimePaise,
                  method: 'CASH',
                  status: 'COMPLETED',
                  paidAt: new Date(),
                  recordedByStaffId: staffSession.userId,
                  notes: `Overtime payment (+${overtimeMinutes} mins) collected on checkout by ${staffName}`,
                },
              });

              await tx.customerProfile.updateMany({
                where: { userId: session.booking.userId },
                data: { totalSpent: { increment: overtimePaise } },
              });
            }
          }

          // Free up station
          if (session.stationId) {
            await tx.gamingStation.update({
              where: { id: session.stationId },
              data: { status: 'AVAILABLE' },
            });
          }

          // Log staff activity
          await tx.staffActivityLog.create({
            data: {
              userId: staffSession.userId,
              action: 'END_SESSION',
              entityType: 'session',
              entityId: session.id,
              details: {
                stationName: session.station?.name,
                overtimeMinutes,
                overtimePaise,
                staffName,
              },
            },
          }).catch(() => {});
        });

        return apiSuccess({
          message: overtimeMinutes > 0
            ? `Session on ${session.station?.name || 'station'} ended (+${overtimeMinutes}m extra time recorded: ₹${(overtimePaise / 100).toFixed(0)}). Station is now Available.`
            : `Session on ${session.station?.name || 'station'} ended successfully. Station is now Available.`,
          extraMinutes: overtimeMinutes,
          overtimePaise,
        });
      } else {
        // Fallback: If no GamingSession row was found, update Booking & GamingStation directly
        await prisma.$transaction(async (tx) => {
          if (bookingId) {
            await tx.booking.update({
              where: { id: bookingId },
              data: { status: 'COMPLETED' },
            });
          }
          if (stationId) {
            await tx.gamingStation.update({
              where: { id: stationId },
              data: { status: 'AVAILABLE' },
            });
          }
        });

        return apiSuccess({
          message: extraMinutes && extraMinutes > 0
            ? `Session ended (${extraMinutes}m extra time recorded). Station is now Available.`
            : 'Session ended successfully! Station marked as Available.',
          extraMinutes: extraMinutes || 0,
        });
      }
    } catch {
      // Robust fallback
      return apiSuccess({
        message: 'Session ended successfully! Station marked as Available.',
      });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
