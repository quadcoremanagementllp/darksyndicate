import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError, NotFoundError, ValidationError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { getActiveUserMembership } from '@/lib/memberships';
import { hashPassword } from '@/lib/auth';
import { z } from 'zod';
import crypto from 'crypto';

const walkInSchema = z.object({
  stationId: z.string().min(1, 'Station is required'),
  durationMinutes: z.number().int().min(30).default(60),
  playerCount: z.number().int().min(1).max(10).default(1),
  customerName: z.string().min(2, 'Customer name is required'),
  customerPhone: z.string().optional().or(z.literal('')),
  customerEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'OTHER']).default('CASH'),
  gameTitle: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const staffSession = await requireRole('STAFF', 'ADMIN', 'SUPER_ADMIN');
    const body = await req.json();
    const data = walkInSchema.parse(body);
    const staffName = `${staffSession.firstName} ${staffSession.lastName}`.trim();

    const now = new Date();
    const scheduledEndAt = new Date(now.getTime() + data.durationMinutes * 60 * 1000);
    const todayDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0));
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch Station inside transaction
      const station = await tx.gamingStation.findUnique({
        where: { id: data.stationId },
      });

      if (!station) {
        throw new NotFoundError('Gaming station not found');
      }

      if (station.status === 'MAINTENANCE' || station.status === 'DEACTIVATED') {
        throw new ValidationError(`Selected station is currently ${station.status.toLowerCase()}`);
      }

      // 2. Concurrency: Check if station currently has an active gaming session
      const activeSession = await tx.gamingSession.findFirst({
        where: {
          stationId: station.id,
          status: { in: ['ACTIVE', 'PAUSED', 'EXTENDED', 'OVERDUE'] },
        },
      });

      if (activeSession) {
        throw new ValidationError('Selected station is currently in an active session');
      }

      // 3. Check upcoming booking collision (excluding abandoned/stale pending checkouts > 15m)
      const conflict = await tx.booking.findFirst({
        where: {
          stationId: station.id,
          AND: [
            {
              OR: [
                { status: { in: ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] } },
                { status: 'PENDING', createdAt: { gte: fifteenMinutesAgo } },
              ],
            },
            {
              startTime: { lt: scheduledEndAt },
              endTime: { gt: now },
            },
          ],
        },
        orderBy: { startTime: 'asc' },
      });

      if (conflict) {
        const conflictTimeFormatted = new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }).format(new Date(conflict.startTime));

        throw new ValidationError(
          `Cannot allocate ${station.name}: Reserved for an upcoming reservation at ${conflictTimeFormatted}`
        );
      }

      // 4. Rate Calculation (Accounts for multi-player tiers on PS5 & extra players on Snooker)
      let hourlyRate = station.pricePerHourPaise;
      const playerCount = data.playerCount || 1;
      if (station.stationType === 'PS5') {
        if (playerCount === 2) hourlyRate = 20000; // ₹200/hr for duo
        else if (playerCount >= 3) hourlyRate = 25000; // ₹250/hr for 3-4 squad
        else hourlyRate = 15000; // ₹150/hr single
      } else if (station.stationType === 'POOL_TABLE') {
        hourlyRate = 25000 + Math.max(0, playerCount - 4) * 5000; // ₹250/hr base (up to 4) + ₹50/extra
      }
      const subtotalPaise = Math.round(hourlyRate * (data.durationMinutes / 60));

      // 5. Customer Resolution
      const phoneDigits = data.customerPhone ? data.customerPhone.replace(/\D/g, '').slice(-10) : '';
      const cleanEmail = data.customerEmail?.trim().toLowerCase() || null;
      const phoneCandidates =
        phoneDigits.length === 10
          ? [
              phoneDigits,
              `+91${phoneDigits}`,
              `91${phoneDigits}`,
              `+91 ${phoneDigits}`,
              `0${phoneDigits}`,
            ]
          : [];
      let registeredUser = null;

      if (cleanEmail) {
        registeredUser = await tx.user.findUnique({
          where: { email: cleanEmail },
        });
      }
      if (!registeredUser && phoneCandidates.length > 0) {
        // Exact indexed IN search across formats to prevent MariaDB binary collation error on LIKE
        registeredUser = await tx.user.findFirst({
          where: {
            phone: { in: phoneCandidates },
          },
        });
      }

      let user = registeredUser;
      if (!user) {
        // If customer provided a phone or email, create an individual Customer account in directory
        if (cleanEmail || phoneDigits.length === 10) {
          const names = data.customerName.trim().split(' ');
          const firstName = names[0] || 'Walk-in';
          const lastName = names.slice(1).join(' ') || 'Gamer';
          const userEmail = cleanEmail || `gamer_${phoneDigits || Date.now()}@darksyndicate.in`;
          const dummyPassword = crypto.randomBytes(16).toString('hex');
          const passwordHash = await hashPassword(dummyPassword);

          // Check if either email or phone already belongs to an existing user (avoids unique constraint violation)
          const existingByEmail = await tx.user.findUnique({ where: { email: userEmail } });
          const existingByPhone =
            phoneCandidates.length > 0
              ? await tx.user.findFirst({ where: { phone: { in: phoneCandidates } } })
              : null;

          if (existingByEmail) {
            user = existingByEmail;
            registeredUser = existingByEmail;
          } else if (existingByPhone) {
            user = existingByPhone;
            registeredUser = existingByPhone;
          } else {
            const newCustomer = await tx.user.create({
              data: {
                email: userEmail,
                passwordHash,
                firstName,
                lastName,
                phone: phoneDigits.length === 10 ? phoneDigits : null,
                role: 'CUSTOMER',
                status: 'ACTIVE',
                customerProfile: {
                  create: {
                    totalSpent: 0,
                    totalBookings: 0,
                  },
                },
              },
            });
            user = newCustomer;
            registeredUser = newCustomer;
          }
        } else {
          // Fallback to anonymous guest account only if zero contact info given
          let guest = await tx.user.findUnique({ where: { email: 'guest@darksyndicate.in' } });
          if (!guest) {
            guest = await tx.user.create({
              data: {
                email: 'guest@darksyndicate.in',
                passwordHash: 'LOCKED_GUEST_ACCOUNT',
                firstName: 'Walk-in',
                lastName: 'Gamer',
                phone: null,
                role: 'CUSTOMER',
              },
            });
          }
          user = guest;
        }
      }

      // 6. Check Active Membership Discount for Registered Users
      let membershipDiscountPaise = 0;
      let membershipPlanName: string | null = null;
      if (registeredUser) {
        const activeMem = await getActiveUserMembership(registeredUser.id);
        if (activeMem && activeMem.discountPercent > 0) {
          membershipPlanName = activeMem.planNameSnapshot;
          membershipDiscountPaise = Math.round((subtotalPaise * activeMem.discountPercent) / 100);
        }
      }
      const totalPricePaise = Math.max(0, subtotalPaise - membershipDiscountPaise);

      const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
      const bookingRef = `DS-WALK-${new Date().getFullYear()}-${randomHex}`;
      const qrToken = `ds-walk-${crypto.randomUUID()}`;

      // 7. Create Walk-in Booking
      const booking = await tx.booking.create({
        data: {
          bookingRef,
          userId: user.id,
          stationId: station.id,
          date: todayDate,
          startTime: now,
          endTime: scheduledEndAt,
          durationMinutes: data.durationMinutes,
          subtotalPaise,
          discountPaise: membershipDiscountPaise,
          membershipDiscountPaise,
          membershipPlanName,
          totalPricePaise,
          status: 'IN_PROGRESS',
          qrToken,
          isWalkIn: true,
          customerName: data.customerName,
          customerPhone: data.customerPhone?.trim() || null,
          gameTitle: data.gameTitle || null,
          notes:
            (data.gameTitle ? `Game: ${data.gameTitle}. ` : '') +
            (cleanEmail ? `Email: ${cleanEmail}. ` : '') +
            `[Players: ${playerCount}]. ` +
            (data.notes ||
              (staffName
                ? `Walk-in registered by ${staffName}${membershipPlanName ? ` [${membershipPlanName}]` : ''}`
                : 'Front desk walk-in check-in')),
        },
      });

      // 8. Record Desk Payment with accurate payment method
      const recordedPaymentMethod =
        data.paymentMethod === 'UPI' ? 'UPI' : data.paymentMethod === 'CARD' ? 'OTHER' : 'CASH';

      await tx.payment.create({
        data: {
          bookingId: booking.id,
          userId: user.id,
          amountPaise: totalPricePaise,
          method: recordedPaymentMethod,
          status: 'COMPLETED',
          paidAt: now,
          recordedByStaffId: staffSession?.userId || null,
          notes: `Walk-in desk payment (${data.paymentMethod})${staffName ? ` processed by ${staffName}` : ''}${membershipPlanName ? ` [${membershipPlanName} Discount: ₹${(membershipDiscountPaise / 100).toFixed(0)}]` : ''}`,
        },
      });

      // 9. Launch Session with staffId
      const session = await tx.gamingSession.create({
        data: {
          bookingId: booking.id,
          stationId: station.id,
          staffId: staffSession?.userId || null,
          status: 'ACTIVE',
          startedAt: now,
          scheduledEndAt,
          notes: data.gameTitle || data.notes || null,
        },
      });

      // 10. Update Customer Profile if registered member
      if (registeredUser) {
        await tx.customerProfile.upsert({
          where: { userId: registeredUser.id },
          create: {
            userId: registeredUser.id,
            totalBookings: 1,
            totalSpent: totalPricePaise,
          },
          update: {
            totalBookings: { increment: 1 },
            totalSpent: { increment: totalPricePaise },
          },
        });
      }

      // 11. Log staff activity
      if (staffSession?.userId) {
        await tx.staffActivityLog.create({
          data: {
            userId: staffSession.userId,
            action: 'WALK_IN_CHECKIN',
            entityType: 'booking',
            entityId: booking.id,
            details: {
              bookingRef,
              customerName: data.customerName,
              stationName: station.name,
              staffName,
              paymentMethod: data.paymentMethod,
              totalFeePaise: totalPricePaise,
            },
          },
        });
      }

      // 12. Mark station OCCUPIED
      await tx.gamingStation.update({
        where: { id: station.id },
        data: { status: 'OCCUPIED' },
      });

      return { booking, session };
    });

    return apiSuccess(
      {
        message: 'Walk-in session started successfully!',
        booking: result.booking,
        session: result.session,
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
