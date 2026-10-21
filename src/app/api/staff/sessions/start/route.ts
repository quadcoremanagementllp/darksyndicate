import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError, NotFoundError, ValidationError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { z } from 'zod';

const startSessionSchema = z.object({
  stationId: z.string().min(1),
  bookingId: z.string().optional(),
  durationMinutes: z.number().int().min(15).default(60),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const staffSession = await requireRole('STAFF', 'ADMIN', 'SUPER_ADMIN');
    const staffName = `${staffSession.firstName} ${staffSession.lastName}`.trim();
    const body = await req.json();
    const data = startSessionSchema.parse(body);

    try {
      const station = await prisma.gamingStation.findUnique({
        where: { id: data.stationId },
      });

      if (!station) {
        throw new NotFoundError('Gaming station not found');
      }

      // Check if already active session
      const existingSession = await prisma.gamingSession.findFirst({
        where: { stationId: data.stationId, status: { in: ['ACTIVE', 'PAUSED', 'EXTENDED', 'OVERDUE'] } },
      });

      if (existingSession) {
        throw new ValidationError('Station is already running an active session');
      }

      const now = new Date();
      const scheduledEndAt = new Date(now.getTime() + data.durationMinutes * 60 * 1000);

      const result = await prisma.$transaction(async (tx) => {
        let bookingId = data.bookingId;

        if (!bookingId) {
          // Create instant walk-in booking if no bookingId provided
          let guest = await tx.user.findUnique({ where: { email: 'guest@darksyndicate.in' } });
          if (!guest) {
            guest = await tx.user.create({
              data: {
                email: 'guest@darksyndicate.in',
                passwordHash: 'LOCKED_GUEST_ACCOUNT',
                firstName: data.customerName || 'Walk-in',
                lastName: 'Gamer',
                phone: data.customerPhone || '9876543210',
                role: 'CUSTOMER',
              },
            });
          }

          const basePricePaise = station.pricePerHourPaise * (data.durationMinutes / 60);
          const booking = await tx.booking.create({
            data: {
              bookingRef: `DS-WALK-${Date.now().toString().slice(-4)}`,
              userId: guest.id,
              stationId: station.id,
              date: now,
              startTime: now,
              endTime: scheduledEndAt,
              durationMinutes: data.durationMinutes,
              subtotalPaise: basePricePaise,
              totalPricePaise: basePricePaise,
              status: 'IN_PROGRESS',
              qrToken: `ds-walk-${Date.now()}`,
              isWalkIn: true,
              customerName: data.customerName || 'Walk-in Gamer',
              customerPhone: data.customerPhone || null,
            },
          });
          bookingId = booking.id;

          // Record cash payment
          await tx.payment.create({
            data: {
              bookingId: booking.id,
              userId: guest.id,
              amountPaise: basePricePaise,
              method: 'CASH',
              status: 'COMPLETED',
              paidAt: now,
              recordedByStaffId: staffSession.userId,
              notes: `Desk walk-in payment processed by ${staffName}`,
            },
          });
        } else {
          await tx.booking.update({
            where: { id: bookingId },
            data: { status: 'IN_PROGRESS' },
          });
        }

        const session = await tx.gamingSession.create({
          data: {
            bookingId: bookingId as string,
            stationId: station.id,
            staffId: staffSession.userId,
            status: 'ACTIVE',
            startedAt: now,
            scheduledEndAt,
            notes: data.customerName ? `Started for ${data.customerName} by ${staffName}` : `Started by ${staffName}`,
          },
          include: { booking: true },
        });

        await tx.gamingStation.update({
          where: { id: station.id },
          data: { status: 'OCCUPIED' },
        });

        return session;
      });

      return apiSuccess({
        message: 'Session started successfully!',
        session: result,
      });
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof ValidationError) throw err;

      throw err;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
