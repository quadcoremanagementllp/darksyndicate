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
  settlePaymentMethod: z.enum(['CASH', 'UPI', 'CARD']).optional(),
  transferTab: z.boolean().optional(),
  settleAdditionalBookingIds: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const staffSession = await requireRole('STAFF', 'ADMIN', 'SUPER_ADMIN');
    const staffName = `${staffSession.firstName} ${staffSession.lastName}`.trim();
    const body = await req.json();
    const { sessionId, stationId, bookingId, extraMinutes, settlePaymentMethod, transferTab, settleAdditionalBookingIds } = endSessionSchema.parse(body);
    const chosenMethod: 'CASH' | 'UPI' | 'OTHER' =
      settlePaymentMethod === 'UPI' ? 'UPI' : settlePaymentMethod === 'CARD' ? 'OTHER' : 'CASH';

    if (!sessionId && !stationId && !bookingId) {
      throw new NotFoundError('Either sessionId, stationId, or bookingId is required');
    }

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

    // 3. Try finding active/extended/overdue session by stationId
    if (!session && stationId) {
      session = await prisma.gamingSession.findFirst({
        where: { stationId, status: { in: ['ACTIVE', 'PAUSED', 'EXTENDED', 'OVERDUE'] } },
        include: { station: true, booking: true },
      });
    }

    if (session) {
      const overtimeMinutes = extraMinutes && extraMinutes > 0 ? Math.floor(extraMinutes) : 0;
      const hourlyRatePaise = session.station?.pricePerHourPaise || 15000;
      const overtimePaise = overtimeMinutes > 0 ? Math.round(hourlyRatePaise * (overtimeMinutes / 60)) : 0;

      await prisma.$transaction(async (tx) => {
        // End session & record overtime
        await tx.gamingSession.update({
          where: { id: session.id },
          data: {
            status: 'COMPLETED',
            endedAt: new Date(),
            ...(overtimeMinutes > 0 ? {
              extensionMinutes: { increment: overtimeMinutes },
              extensionPaise: { increment: overtimePaise },
            } : {}),
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

          if (transferTab) {
            // TRANSFER TAB FLOW:
            // Keep pending payments as PENDING so they can be settled at final game checkout!
            // If overtime occurred, record it as an additional PENDING payment on this booking
            if (overtimePaise > 0 && session.booking) {
              await tx.payment.create({
                data: {
                  bookingId: session.bookingId,
                  userId: session.booking.userId,
                  amountPaise: overtimePaise,
                  method: 'OTHER',
                  status: 'PENDING',
                  recordedByStaffId: staffSession.userId,
                  notes: `Overtime (+${overtimeMinutes} mins) added to open tab transferred to next game by ${staffName}`,
                },
              });
            }
          } else {
            // FINAL SETTLEMENT FLOW:
            // Settle pending payments for current booking (e.g. Pay-on-Exit walk-ins)
            const pendingPayments = await tx.payment.findMany({
              where: {
                bookingId: session.bookingId,
                status: 'PENDING',
              },
              select: { id: true, amountPaise: true, userId: true },
            });

            if (pendingPayments.length > 0) {
              await tx.payment.updateMany({
                where: {
                  bookingId: session.bookingId,
                  status: 'PENDING',
                },
                data: {
                  status: 'COMPLETED',
                  method: chosenMethod,
                  paidAt: new Date(),
                  recordedByStaffId: staffSession.userId,
                  notes: `Desk tab settled (${chosenMethod}) upon session conclusion by ${staffName}`,
                },
              });

              for (const pp of pendingPayments) {
                if (pp.amountPaise > 0) {
                  await tx.customerProfile.updateMany({
                    where: { userId: pp.userId },
                    data: { totalSpent: { increment: pp.amountPaise } },
                  });
                }
              }
            }

            // Create overtime desk payment record if charged
            if (overtimePaise > 0 && session.booking) {
              await tx.payment.create({
                data: {
                  bookingId: session.bookingId,
                  userId: session.booking.userId,
                  amountPaise: overtimePaise,
                  method: chosenMethod,
                  status: 'COMPLETED',
                  paidAt: new Date(),
                  recordedByStaffId: staffSession.userId,
                  notes: `Overtime payment (+${overtimeMinutes} mins) collected on checkout via ${chosenMethod} by ${staffName}`,
                },
              });

              await tx.customerProfile.updateMany({
                where: { userId: session.booking.userId },
                data: { totalSpent: { increment: overtimePaise } },
              });
            }

            // Also settle any linked prior bookings (e.g. PS5 open tab carried over to Snooker)
            if (settleAdditionalBookingIds && settleAdditionalBookingIds.length > 0) {
              const priorPending = await tx.payment.findMany({
                where: {
                  bookingId: { in: settleAdditionalBookingIds },
                  status: 'PENDING',
                },
                select: { id: true, amountPaise: true, userId: true },
              });

              if (priorPending.length > 0) {
                await tx.payment.updateMany({
                  where: {
                    bookingId: { in: settleAdditionalBookingIds },
                    status: 'PENDING',
                  },
                  data: {
                    status: 'COMPLETED',
                    method: chosenMethod,
                    paidAt: new Date(),
                    recordedByStaffId: staffSession.userId,
                    notes: `Desk tab settled (${chosenMethod}) in combined multi-game bill by ${staffName}`,
                  },
                });

                for (const pp of priorPending) {
                  if (pp.amountPaise > 0) {
                    await tx.customerProfile.updateMany({
                      where: { userId: pp.userId },
                      data: { totalSpent: { increment: pp.amountPaise } },
                    });
                  }
                }
              }
            }
          }
        }

        // Free up station immediately so new players can use it
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
            action: transferTab ? 'TRANSFER_TAB' : 'END_SESSION',
            entityType: 'session',
            entityId: session.id,
            details: {
              stationName: session.station?.name,
              overtimeMinutes,
              overtimePaise,
              staffName,
              transferTab: Boolean(transferTab),
              settledAdditional: settleAdditionalBookingIds || [],
            },
          },
        }).catch(() => {});
      });

      return apiSuccess({
        transferred: Boolean(transferTab),
        message: transferTab
          ? `Session on ${session.station?.name || 'station'} ended and station is now Available! Open tab preserved for next game.`
          : overtimeMinutes > 0
          ? `Session on ${session.station?.name || 'station'} ended (+${overtimeMinutes}m extra time recorded: ₹${(overtimePaise / 100).toFixed(0)}). Station is now Available.`
          : `Session on ${session.station?.name || 'station'} ended successfully. Station is now Available.`,
        extraMinutes: overtimeMinutes,
        overtimePaise,
        bookingId: session.bookingId,
        bookingRef: session.booking?.bookingRef,
        customerName: session.booking?.customerName,
        customerPhone: session.booking?.customerPhone,
      });
    } else {
      // Fallback: If no GamingSession row was found, update Booking & GamingStation directly
      await prisma.$transaction(async (tx) => {
        if (bookingId) {
          await tx.booking.update({
            where: { id: bookingId },
            data: { status: 'COMPLETED' },
          });

          if (!transferTab) {
            await tx.payment.updateMany({
              where: {
                bookingId,
                status: 'PENDING',
              },
              data: {
                status: 'COMPLETED',
                method: chosenMethod,
                paidAt: new Date(),
                recordedByStaffId: staffSession.userId,
                notes: `Desk tab settled (${chosenMethod}) upon session conclusion by ${staffName}`,
              },
            });

            if (settleAdditionalBookingIds && settleAdditionalBookingIds.length > 0) {
              await tx.payment.updateMany({
                where: {
                  bookingId: { in: settleAdditionalBookingIds },
                  status: 'PENDING',
                },
                data: {
                  status: 'COMPLETED',
                  method: chosenMethod,
                  paidAt: new Date(),
                  recordedByStaffId: staffSession.userId,
                  notes: `Desk tab settled (${chosenMethod}) in combined multi-game bill by ${staffName}`,
                },
              });
            }
          }
        }
        if (stationId) {
          await tx.gamingStation.update({
            where: { id: stationId },
            data: { status: 'AVAILABLE' },
          });
        }
      });

      return apiSuccess({
        transferred: Boolean(transferTab),
        message: transferTab
          ? 'Station is now Available! Open tab preserved for next game.'
          : extraMinutes && extraMinutes > 0
          ? `Session ended (${Math.floor(extraMinutes)}m extra time recorded). Station is now Available.`
          : 'Session ended successfully! Station marked as Available.',
        extraMinutes: extraMinutes ? Math.floor(extraMinutes) : 0,
      });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
