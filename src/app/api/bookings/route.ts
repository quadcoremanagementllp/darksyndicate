import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { hashPassword } from '@/lib/auth';
import { getActiveUserMembership } from '@/lib/memberships';
import {
  apiSuccess,
  handleApiError,
  ValidationError,
  NotFoundError,
  ConflictError,
  AuthError,
  ForbiddenError,
} from '@/lib/errors';
import { z } from 'zod';
import { isStaffReservation, PAY_ON_EXIT_MARKER } from '@/lib/staffPaymentPolicy';
import crypto from 'crypto';
import { razorpayEnabled } from '@/lib/razorpay';

const createBookingSchema = z.object({
  stationId: z.string().min(1, 'Station is required'),
  date: z.string().min(1, 'Date is required'), // YYYY-MM-DD
  startTime: z.string().min(1, 'Start time is required'), // e.g. "14:00"
  durationMinutes: z.number().int().min(30).max(720).default(60),
  customerName: z.string().min(2, 'Name must be at least 2 characters').optional(),
  customerEmail: z.string().email('Invalid email address').optional(),
  customerPhone: z.string().min(10, 'Valid phone number is required').optional(),
  gameTitle: z.string().optional(),
  notes: z.string().max(500).optional(),
  playerCount: z.number().int().min(1).max(10).default(1),
  couponCode: z.string().optional(),
  payAtCounter: z.boolean().default(false),
  paymentMethod: z.enum(['RAZORPAY', 'CASHFREE', 'UPI', 'CASH', 'OTHER']).default('UPI'),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      throw new AuthError('Please sign in to view bookings');
    }

    try {
      const isStaffOrAdmin = session.role === 'ADMIN' || session.role === 'STAFF' || session.role === 'SUPER_ADMIN';
      const bookings = await prisma.booking.findMany({
        where: isStaffOrAdmin ? {} : { userId: session.userId },
        include: {
          station: { include: { facility: true } },
          payments: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, phone: true },
          },
        },
        orderBy: { startTime: 'desc' },
        take: 50,
      });

      return apiSuccess(bookings);
    } catch (error) {
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = createBookingSchema.parse(body);

    const session = await getSession();
    if (!data.payAtCounter && (!razorpayEnabled() || !session)) {
      throw new ValidationError('Online checkout requires a signed-in account and an active payment gateway');
    }

    // Parse date and time in IST (UTC+5:30)
    const [year, month, day] = data.date.split('-').map(Number);
    const [hours, minutes] = data.startTime.split(':').map(Number);

    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const startDateTime = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0) - istOffsetMs);
    const endDateTime = new Date(startDateTime.getTime() + data.durationMinutes * 60 * 1000);

    // Ensure slot is not in the past
    if (startDateTime.getTime() < Date.now() - 5 * 60 * 1000) {
      throw new ValidationError('Cannot book a time slot in the past');
    }

    try {
      // 1. Resolve User
      let userId: string;
      const isStaffOrAdmin = session?.role === 'ADMIN' || session?.role === 'SUPER_ADMIN' || session?.role === 'STAFF';
      if (isStaffReservation(data.notes) && !isStaffOrAdmin) {
        throw new ForbiddenError('Staff reservations require a staff account.');
      }
      if (isStaffReservation(data.notes) && !data.payAtCounter) {
        throw new ValidationError('Staff reservations must use a pay-after desk tab.');
      }
      if (data.notes?.includes(PAY_ON_EXIT_MARKER) && !isStaffOrAdmin) {
        throw new ForbiddenError('Pay-after booking requires a staff account.');
      }
      const staffReservation = Boolean(isStaffOrAdmin && data.payAtCounter && isStaffReservation(data.notes));
      const isBookingForOther = isStaffOrAdmin && Boolean(data.customerEmail && data.customerEmail.toLowerCase() !== session?.email?.toLowerCase());

      if (session?.userId && !isBookingForOther) {
        userId = session.userId;
        const userRec = await prisma.user.findUnique({
          where: { id: userId },
          select: { status: true, phone: true },
        });
        if (userRec?.status === 'BLOCKED') {
          throw new ValidationError('Your account is currently suspended. Please contact Dark Syndicate management.');
        }
        // Auto-save phone to user profile if user has no phone saved yet
        if (!userRec?.phone && data.customerPhone) {
          try {
            await prisma.user.update({
              where: { id: userId },
              data: { phone: data.customerPhone },
            });
          } catch {
            // non-blocking if phone is already bound to another account
          }
        }
      } else if (data.customerEmail) {
        let existingUser = await prisma.user.findUnique({
          where: { email: data.customerEmail.toLowerCase() },
        });

        if (existingUser) {
          if (existingUser.status === 'BLOCKED') {
            throw new ValidationError('This account is currently suspended. Please contact Dark Syndicate management.');
          }
          userId = existingUser.id;
        } else {
          // Auto create user
          const names = (data.customerName || 'Syndicate Guest').trim().split(' ');
          const firstName = names[0];
          const lastName = names.slice(1).join(' ') || 'Player';
          const defaultPassword = await hashPassword(crypto.randomBytes(16).toString('hex'));

          // Check if phone number is already taken by another account
          let phoneToAssign: string | null = null;
          if (data.customerPhone) {
            const phoneOwner = await prisma.user.findUnique({
              where: { phone: data.customerPhone },
              select: { id: true },
            });
            if (!phoneOwner) {
              phoneToAssign = data.customerPhone;
            }
          }

          let newUser;
          try {
            newUser = await prisma.user.create({
              data: {
                email: data.customerEmail.toLowerCase(),
                passwordHash: defaultPassword,
                firstName,
                lastName,
                phone: phoneToAssign,
                role: 'CUSTOMER',
                customerProfile: {
                  create: {
                    totalBookings: 1,
                    totalSpent: 0,
                  },
                },
              },
            });
          } catch (createErr: any) {
            // If phone unique collision still triggers, retry safely without binding phone
            if (createErr?.code === 'P2002') {
              newUser = await prisma.user.create({
                data: {
                  email: data.customerEmail.toLowerCase(),
                  passwordHash: defaultPassword,
                  firstName,
                  lastName,
                  phone: null,
                  role: 'CUSTOMER',
                  customerProfile: {
                    create: {
                      totalBookings: 1,
                      totalSpent: 0,
                    },
                  },
                },
              });
            } else {
              throw createErr;
            }
          }
          userId = newUser.id;
        }
      } else {
        // Dedicated guest user
        let guestUser = await prisma.user.findUnique({
          where: { email: 'guest@darksyndicate.in' },
        });
        if (!guestUser) {
          const defaultPassword = await hashPassword(crypto.randomBytes(32).toString('hex'));
          guestUser = await prisma.user.create({
            data: {
              email: 'guest@darksyndicate.in',
              passwordHash: defaultPassword,
              firstName: data.customerName || 'Guest',
              lastName: 'Player',
              phone: null,
              role: 'CUSTOMER',
            },
          });
        }
        userId = guestUser.id;
      }

      // 2. Fetch Gaming Station
      const station = await prisma.gamingStation.findUnique({
        where: { id: data.stationId },
        include: { facility: true },
      });

      if (!station) {
        throw new NotFoundError('Gaming station not found');
      }

      if (station.status === 'MAINTENANCE' || station.status === 'DEACTIVATED') {
        throw new ValidationError(`Selected station is currently ${station.status.toLowerCase()}`);
      }

      // 3. Dynamic Pricing Calculation based on Station Type & Player Count
      let baseHourlyRate = station.pricePerHourPaise;
      const isPs5 = station.stationType === 'PS5' || station.name.toUpperCase().includes('PS5');
      const isSnooker = station.stationType === 'POOL_TABLE' || station.name.toUpperCase().includes('SNOOKER') || station.name.toUpperCase().includes('POOL');

      if (isPs5) {
        // PS5: 1 player = ₹150/hr, 2 players = ₹200/hr, 3-4 players = ₹250/hr
        if (data.playerCount === 1) {
          baseHourlyRate = 15000;
        } else if (data.playerCount === 2) {
          baseHourlyRate = 20000;
        } else {
          baseHourlyRate = 25000;
        }
      } else if (isSnooker) {
        // Snooker: ₹250/hr for 1-4 players per table, +₹50/hr per person beyond 4
        if (data.playerCount <= 4) {
          baseHourlyRate = 25000;
        } else {
          baseHourlyRate = 25000 + (data.playerCount - 4) * 5000;
        }
      }

      const hoursCount = data.durationMinutes / 60;
      const subtotalPaise = Math.round(baseHourlyRate * hoursCount);

      let discountPaise = 0;

      // Multi-hour discount: 3+ hours gives 10% off
      if (data.durationMinutes >= 180) {
        discountPaise += Math.round(subtotalPaise * 0.1);
      }

      // Happy Hour discount: 10 AM to 3 PM gives 15% off if not already discounted
      if (hours >= 10 && hours < 15 && data.durationMinutes < 180) {
        discountPaise += Math.round(subtotalPaise * 0.15);
      }

      // Coupon discount
      let couponRecord = null;
      if (data.couponCode) {
        const cleanCode = data.couponCode.trim().toUpperCase();
        couponRecord = await prisma.coupon.findUnique({
          where: { code: cleanCode },
        });

        if (couponRecord && couponRecord.isActive) {
          let couponDiscount = 0;
          if (couponRecord.discountType === 'PERCENTAGE') {
            couponDiscount = Math.round((subtotalPaise * couponRecord.discountValue) / 10000);
          } else {
            couponDiscount = couponRecord.discountValue;
          }
          if (couponRecord.maxDiscountPaise) {
            couponDiscount = Math.min(couponDiscount, couponRecord.maxDiscountPaise);
          }
          discountPaise += couponDiscount;
        } else {
          // Hardcoded promo codes fallback
          if (cleanCode === 'WELCOME10') {
            discountPaise += Math.round(subtotalPaise * 0.1);
          } else if (cleanCode === 'SYNDICATE20') {
            discountPaise += Math.round(subtotalPaise * 0.2);
          } else if (cleanCode === 'GLACIER50') {
            discountPaise += 5000; // ₹50
          }
        }
      }

      // Automatic Membership Discount (Only for authenticated members to prevent guest discount hijacking)
      let membershipDiscountPaise = 0;
      let membershipPlanName: string | null = null;
      try {
        if (session?.userId && session.userId === userId) {
          const activeMembership = await getActiveUserMembership(userId);
          if (activeMembership && activeMembership.discountPercent > 0) {
            membershipPlanName = activeMembership.planNameSnapshot;
            membershipDiscountPaise = Math.round((subtotalPaise * activeMembership.discountPercent) / 100);
            discountPaise += membershipDiscountPaise;
          }
        }
      } catch {
        // non-blocking fallback
      }

      const totalPricePaise = Math.max(0, subtotalPaise - discountPaise);

      // 4. Concurrency Protection & Booking Creation inside Transaction
      const result = await prisma.$transaction(async (tx) => {
        let assignedStationId = station.id;

        // 15-minute pending checkout timeout threshold
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

        const buildOverlapWhere = (targetStationId: string) => ({
          stationId: targetStationId,
          AND: [
            {
              OR: [
                { status: { in: ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] as any } },
                { status: 'PENDING' as any, createdAt: { gte: fifteenMinutesAgo } },
              ],
            },
            {
              startTime: { lt: endDateTime },
              endTime: { gt: startDateTime },
            },
          ],
        });

        // Query overlapping bookings on initially selected station
        let overlappingBooking = await tx.booking.findFirst({
          where: buildOverlapWhere(assignedStationId),
        });

        // Query overlapping active sessions on initially selected station
        let overlappingSession = await tx.gamingSession.findFirst({
          where: {
            stationId: assignedStationId,
            status: { in: ['ACTIVE', 'PAUSED', 'EXTENDED', 'OVERDUE'] },
            startedAt: { lt: endDateTime },
            scheduledEndAt: { gt: startDateTime },
          },
        });

        let hasConflict = Boolean(overlappingBooking || overlappingSession);

        // Smart Arena Auto-Reallocation:
        // If the initially selected station is reserved for this time, check if another station
        // in the SAME zone/stationType is completely free so the player's booking is never rejected unfairly!
        if (hasConflict) {
          const alternateStations = await tx.gamingStation.findMany({
            where: {
              stationType: station.stationType,
              status: { notIn: ['MAINTENANCE', 'DEACTIVATED'] },
              id: { not: station.id },
            },
            select: { id: true },
          });

          for (const alt of alternateStations) {
            const altBookingConflict = await tx.booking.findFirst({
              where: buildOverlapWhere(alt.id),
            });
            const altSessionConflict = await tx.gamingSession.findFirst({
              where: {
                stationId: alt.id,
                status: { in: ['ACTIVE', 'PAUSED', 'EXTENDED', 'OVERDUE'] },
                startedAt: { lt: endDateTime },
                scheduledEndAt: { gt: startDateTime },
              },
            });

            if (!altBookingConflict && !altSessionConflict) {
              assignedStationId = alt.id;
              hasConflict = false;
              break;
            }
          }
        }

        if (hasConflict) {
          throw new ConflictError(
            'All stations in this arena are reserved for the selected time slot. Please pick another available slot.'
          );
        }

        const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
        const bookingRef = `DS-${new Date().getFullYear()}-${randomHex}`;
        const qrToken = `ds-${crypto.randomUUID()}`;

        const booking = await tx.booking.create({
          data: {
            bookingRef,
            userId,
            stationId: assignedStationId,
            date: new Date(Date.UTC(year, month - 1, day, 0, 0, 0)),
            startTime: startDateTime,
            endTime: endDateTime,
            durationMinutes: data.durationMinutes,
            subtotalPaise,
            discountPaise,
            membershipDiscountPaise,
            membershipPlanName,
            totalPricePaise,
            status: data.payAtCounter ? 'CONFIRMED' : 'PENDING',
            qrToken,
            customerName: data.customerName || (session ? `${session.firstName} ${session.lastName}` : null),
            customerPhone: data.customerPhone || null,
            gameTitle: data.gameTitle || null,
            notes: data.notes
              ? `${data.notes}${staffReservation && !data.notes.includes(PAY_ON_EXIT_MARKER) ? ` ${PAY_ON_EXIT_MARKER}` : ''} • [Players: ${data.playerCount}]`
              : `Players: ${data.playerCount}`,
            isWalkIn: false,
          },
          include: {
            station: { include: { facility: true } },
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          },
        });

        if (isStaffOrAdmin && session && data.payAtCounter && data.notes?.includes('[Front Desk Pre-Booking]')) {
          await tx.staffActivityLog.create({
            data: {
              userId: session.userId,
              action: 'CREATE_RESERVATION',
              entityType: 'booking',
              entityId: booking.id,
              details: { bookingRef },
            },
          });
        }

        // If paying at counter, create a payment record
        if (data.payAtCounter) {
          const recordedMethod = staffReservation ? 'OTHER' : data.paymentMethod === 'UPI' ? 'UPI' : 'CASH';

          await tx.payment.create({
            data: {
              bookingId: booking.id,
              userId,
              amountPaise: totalPricePaise,
              method: recordedMethod,
              status: 'PENDING',
              notes: staffReservation ? 'Pay after session at checkout' : 'Pay at front desk upon check-in',
            },
          });
        }

        // Coupon redemption log
        if (couponRecord) {
          await tx.couponRedemption.create({
            data: {
              couponId: couponRecord.id,
              userId,
              bookingId: booking.id,
              discountAmountPaise: discountPaise,
            },
          });
          await tx.coupon.update({
            where: { id: couponRecord.id },
            data: { usedCount: { increment: 1 } },
          });
        }

        // In-app notification for confirmed counter bookings
        if (data.payAtCounter && userId) {
          try {
            await tx.notification.create({
              data: {
                userId,
                type: 'BOOKING_CONFIRMED',
                title: 'Reservation Confirmed',
                message: `Your reservation ${bookingRef} has been confirmed. Show your QR pass at the front reception counter to check in.`,
                metadata: {
                  bookingId: booking.id,
                  bookingRef,
                  path: `/booking/confirmation/${booking.id}`,
                },
              },
            });
          } catch {
            // non-blocking
          }
        }

        return booking;
      });

      return apiSuccess(result, 201);
    } catch (err: any) {
      if (err instanceof ConflictError || err instanceof ValidationError || err instanceof NotFoundError || err instanceof ForbiddenError) {
        throw err;
      }

      // Map Prisma unique constraint violation (P2002) to HTTP 409 ConflictError
      // so frontend recovers gracefully instead of failing with 500
      if (err?.code === 'P2002') {
        throw new ConflictError(
          'This station has just been booked for this slot by another player. Please select another slot or station.'
        );
      }

      console.error('Database booking transaction failed:', err);
      throw err;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
