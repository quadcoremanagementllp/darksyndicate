import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError, NotFoundError, ValidationError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { sessionHourlyRatePaise } from '@/lib/staffSessionRules';
import { PAY_ON_EXIT_MARKER } from '@/lib/staffPaymentPolicy';
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

      if (station.status === 'MAINTENANCE' || station.status === 'DEACTIVATED') {
        throw new ValidationError(`Station is currently ${station.status.toLowerCase()} and cannot start sessions`);
      }

      const now = new Date();
      const scheduledEndAt = new Date(now.getTime() + data.durationMinutes * 60 * 1000);

      const result = await prisma.$transaction(async (tx) => {
        // Concurrency: Check if already active session inside transaction
        const existingSession = await tx.gamingSession.findFirst({
          where: { stationId: data.stationId, status: { in: ['ACTIVE', 'PAUSED', 'EXTENDED', 'OVERDUE'] } },
        });

        if (existingSession) {
          throw new ValidationError('Station is already running an active session');
        }

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

          const playerCount = station.stationType === 'POOL_TABLE' ? 4 : 1;
          const basePricePaise = Math.round(
            sessionHourlyRatePaise(station.stationType, station.pricePerHourPaise, playerCount) * (data.durationMinutes / 60)
          );
          const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
          const booking = await tx.booking.create({
            data: {
              bookingRef: `DS-WALK-${new Date().getFullYear()}-${randomHex}`,
              userId: guest.id,
              stationId: station.id,
              date: now,
              startTime: now,
              endTime: scheduledEndAt,
              durationMinutes: data.durationMinutes,
              subtotalPaise: basePricePaise,
              totalPricePaise: basePricePaise,
              status: 'IN_PROGRESS',
              qrToken: `ds-walk-${crypto.randomUUID()}`,
              isWalkIn: true,
              customerName: data.customerName || 'Walk-in Gamer',
              customerPhone: data.customerPhone || null,
              notes: `${PAY_ON_EXIT_MARKER} [Players: ${playerCount}]`,
            },
          });
          bookingId = booking.id;

          // Staff-started sessions remain an open tab until checkout.
          await tx.payment.create({
            data: {
              bookingId: booking.id,
              userId: guest.id,
              amountPaise: basePricePaise,
              method: 'OTHER',
              status: 'PENDING',
              notes: `Open tab started by ${staffName}; pay after session`,
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

        // Log staff activity
        await tx.staffActivityLog.create({
          data: {
            userId: staffSession.userId,
            action: 'START_SESSION',
            entityType: 'session',
            entityId: session.id,
            details: {
              stationName: station.name,
              customerName: data.customerName || 'Walk-in Gamer',
              durationMinutes: data.durationMinutes,
              staffName,
            },
          },
        }).catch(() => {});

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
