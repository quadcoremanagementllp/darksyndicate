import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, ConflictError, ForbiddenError, handleApiError, NotFoundError, ValidationError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { canManageStaffSession, sessionHourlyRatePaise, sessionPlayerCount } from '@/lib/staffSessionRules';
import { calculateSessionCheckout } from '@/lib/sessionCheckout';
import { z } from 'zod';

const endSessionSchema = z.object({
  sessionId: z.string().optional(),
  stationId: z.string().optional(),
  bookingId: z.string().optional(),
  extraMinutes: z.number().optional(),
  settlePaymentMethod: z.enum(['CASH', 'UPI', 'CARD']).optional(),
  transferTab: z.boolean().optional(),
  settleAdditionalBookingIds: z.array(z.string()).max(20).optional(),
  discountPaise: z.number().int().min(0).max(100_000_000).optional(),
  finalPricePaise: z.number().int().min(0).max(100_000_000).optional(),
  refundConfirmed: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const staffSession = await requireRole('STAFF', 'ADMIN', 'SUPER_ADMIN');
    const staffName = `${staffSession.firstName} ${staffSession.lastName}`.trim();
    const body = await req.json();
    const { sessionId, stationId, bookingId, extraMinutes, settlePaymentMethod, transferTab, settleAdditionalBookingIds, discountPaise, finalPricePaise, refundConfirmed } = endSessionSchema.parse(body);
    if (discountPaise !== undefined && finalPricePaise !== undefined) {
      throw new ValidationError('Choose a discount or a final price, not both.');
    }
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
      if (session.status === 'COMPLETED') throw new ConflictError('This session has already ended.');
      if (!canManageStaffSession(staffSession.role, staffSession.userId, session.staffId)) {
        throw new ForbiddenError('Only the staff member who started this session or an administrator can end it.');
      }
      const overtimeMinutes = extraMinutes && extraMinutes > 0 ? Math.floor(extraMinutes) : 0;
      const hourlyRatePaise = sessionHourlyRatePaise(
        session.station?.stationType,
        session.station?.pricePerHourPaise || 15000,
        sessionPlayerCount(session.booking?.notes, session.station?.stationType)
      );
      const overtimePaise = overtimeMinutes > 0 ? Math.round(hourlyRatePaise * (overtimeMinutes / 60)) : 0;
      if (transferTab && (discountPaise !== undefined || finalPricePaise !== undefined)) {
        throw new ValidationError('Settle the session to apply a checkout discount or offered price.');
      }

      const checkoutResult = await prisma.$transaction(async (tx) => {
        const payments = session.bookingId ? await tx.payment.findMany({
          where: { bookingId: session.bookingId },
          include: { refunds: { where: { status: 'COMPLETED' } } },
          orderBy: { createdAt: 'desc' },
        }) : [];
        const paidPaise = payments
          .filter((payment) => ['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(payment.status))
          .reduce((sum, payment) => sum + payment.amountPaise - payment.refunds.reduce((refundSum, refund) => refundSum + refund.amountPaise, 0), 0);
        const grossPaise = (session.booking?.totalPricePaise || 0) + overtimePaise;
        let checkout;
        try {
          checkout = calculateSessionCheckout(grossPaise, paidPaise, { discountPaise, finalPricePaise });
        } catch (error) {
          throw new ValidationError(error instanceof Error ? error.message : 'Invalid checkout price');
        }
        if (checkout.refundPaise > 0 && !transferTab) {
          if (!refundConfirmed) throw new ValidationError('Confirm the amount returned to the customer before ending this session.');
          const refundable = payments
            .filter((payment) => ['COMPLETED', 'PARTIALLY_REFUNDED'].includes(payment.status))
            .map((payment) => ({ payment, balance: payment.amountPaise - payment.refunds.reduce((sum, refund) => sum + refund.amountPaise, 0) }))
            .filter(({ balance }) => balance > 0);
          if (refundable.some(({ payment }) => payment.method === 'RAZORPAY' || payment.method === 'CASHFREE' || payment.gatewayPaymentId)) {
            throw new ValidationError('Online payments need a gateway refund. Ask an administrator to process it before reducing the final price.');
          }
          if (refundable.reduce((sum, item) => sum + item.balance, 0) < checkout.refundPaise) {
            throw new ValidationError('The prepaid amount cannot be refunded from available payment records.');
          }
          let remainingRefund = checkout.refundPaise;
          for (const { payment, balance } of refundable) {
            if (remainingRefund <= 0) break;
            const refundAmount = Math.min(remainingRefund, balance);
            await tx.refund.create({ data: {
              paymentId: payment.id,
              amountPaise: refundAmount,
              reason: `Checkout price adjustment for ${session.booking?.bookingRef || session.id} by ${staffName}`,
              status: 'COMPLETED',
              processedById: staffSession.userId,
              processedAt: new Date(),
            } });
            await tx.payment.update({ where: { id: payment.id }, data: {
              status: refundAmount === balance ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
            } });
            remainingRefund -= refundAmount;
          }
          const profile = await tx.customerProfile.findUnique({ where: { userId: session.booking!.userId } });
          if (profile) {
            await tx.customerProfile.update({ where: { userId: session.booking!.userId }, data: {
              totalSpent: Math.max(0, profile.totalSpent - checkout.refundPaise),
            } });
          }
        }
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

        // Store the final offered price and its discount with the completed booking.
        if (session.bookingId) {
          await tx.booking.update({
            where: { id: session.bookingId },
            data: {
              status: 'COMPLETED',
              totalPricePaise: checkout.finalPricePaise,
              ...(checkout.discountPaise > 0 ? { discountPaise: { increment: checkout.discountPaise } } : {}),
              ...((discountPaise !== undefined || finalPricePaise !== undefined) ? {
                notes: `${session.booking?.notes || ''}\n[Checkout: original ₹${(grossPaise / 100).toFixed(2)}, final ₹${(checkout.finalPricePaise / 100).toFixed(2)}, discount ₹${(checkout.discountPaise / 100).toFixed(2)}, by ${staffName}]`.trim(),
              } : {}),
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
            // Replace draft tab lines with one payment for the actual final balance.
            if (payments.some((payment) => payment.status === 'PENDING')) {
              await tx.payment.updateMany({
                where: {
                  bookingId: session.bookingId,
                  status: 'PENDING',
                },
                data: {
                  status: 'FAILED',
                  recordedByStaffId: staffSession.userId,
                  notes: `Draft tab replaced by final checkout price by ${staffName}`,
                },
              });
            }
            if (checkout.duePaise > 0 && session.booking) {
              await tx.payment.create({
                data: {
                  bookingId: session.bookingId,
                  userId: session.booking.userId,
                  amountPaise: checkout.duePaise,
                  method: chosenMethod,
                  status: 'COMPLETED',
                  paidAt: new Date(),
                  recordedByStaffId: staffSession.userId,
                  notes: `Final session checkout collected via ${chosenMethod} by ${staffName}; final price ₹${(checkout.finalPricePaise / 100).toFixed(2)}`,
                },
              });

              await tx.customerProfile.updateMany({
                where: { userId: session.booking.userId },
                data: { totalSpent: { increment: checkout.duePaise } },
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
              originalPricePaise: grossPaise,
              finalPricePaise: checkout.finalPricePaise,
              discountPaise: checkout.discountPaise,
              refundedPaise: checkout.refundPaise,
              staffName,
              transferTab: Boolean(transferTab),
              settledAdditional: settleAdditionalBookingIds || [],
            },
          },
        }).catch(() => {});
        return checkout;
      });

      return apiSuccess({
        transferred: Boolean(transferTab),
        message: transferTab
          ? `Session on ${session.station?.name || 'station'} ended and station is now Available! Open tab preserved for next game.`
          : `Session on ${session.station?.name || 'station'} ended at ₹${(checkoutResult.finalPricePaise / 100).toFixed(2)}. Station is now Available.`,
        extraMinutes: overtimeMinutes,
        overtimePaise,
        finalPricePaise: checkoutResult.finalPricePaise,
        discountPaise: checkoutResult.discountPaise,
        refundedPaise: checkoutResult.refundPaise,
        bookingId: session.bookingId,
        bookingRef: session.booking?.bookingRef,
        customerName: session.booking?.customerName,
        customerPhone: session.booking?.customerPhone,
      });
    } else {
      // Fallback: If no GamingSession row was found, update Booking & GamingStation directly
      if (discountPaise !== undefined || finalPricePaise !== undefined) {
        throw new ValidationError('A live session record is required to adjust its final price.');
      }
      if (staffSession.role === 'STAFF') {
        throw new ForbiddenError('Session ownership cannot be verified. Ask an administrator to end this booking.');
      }
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
