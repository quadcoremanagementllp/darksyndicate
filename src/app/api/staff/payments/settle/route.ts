import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, ConflictError, handleApiError, NotFoundError, ValidationError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { calculateSessionCheckout } from '@/lib/sessionCheckout';
import { getGamerActivePass, redeemMembershipHours } from '@/lib/memberships';
import { z } from 'zod';

const settlePaymentSchema = z.object({
  bookingId: z.string().min(1),
  settlePaymentMethod: z.enum(['CASH', 'UPI', 'SPLIT', 'SYNDICATE_PASS']),
  splitCashPaise: z.number().int().min(0).optional(),
  splitUpiPaise: z.number().int().min(0).optional(),
  discountPaise: z.number().int().min(0).max(100_000_000).optional(),
  finalPricePaise: z.number().int().min(0).max(100_000_000).optional(),
  settleAdditionalBookingIds: z.array(z.string()).max(20).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const staffSession = await requireRole('STAFF', 'ADMIN', 'SUPER_ADMIN');
    const staffName = `${staffSession.firstName} ${staffSession.lastName}`.trim();
    const body = await req.json();
    const {
      bookingId,
      settlePaymentMethod,
      splitCashPaise,
      splitUpiPaise,
      discountPaise,
      finalPricePaise,
      settleAdditionalBookingIds,
    } = settlePaymentSchema.parse(body);

    if (discountPaise !== undefined && finalPricePaise !== undefined) {
      throw new ValidationError('Choose a discount or a final price, not both.');
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        station: true,
        user: true,
        payments: {
          include: { refunds: { where: { status: 'COMPLETED' } } },
          orderBy: { createdAt: 'desc' },
        },
        session: true,
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const paidPaise = booking.payments
      .filter((p) => ['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(p.status))
      .reduce((sum, p) => sum + p.amountPaise - p.refunds.reduce((rSum, r) => rSum + r.amountPaise, 0), 0);

    const grossPaise = booking.totalPricePaise;
    let checkout: ReturnType<typeof calculateSessionCheckout>;
    try {
      checkout = calculateSessionCheckout(grossPaise, paidPaise, { discountPaise, finalPricePaise });
    } catch (error) {
      throw new ValidationError(error instanceof Error ? error.message : 'Invalid checkout price');
    }

    const duePaise = checkout.duePaise;
    const noteTransferredMatch = booking.notes?.match(/\[TRANSFERRED_FROM:\s*bookingId=([a-zA-Z0-9_-]+)/i);
    const candidateAdditionalIds = [
      ...(settleAdditionalBookingIds || []),
      ...(noteTransferredMatch ? [noteTransferredMatch[1]] : []),
    ];
    const uniqueAdditionalIds = [...new Set(candidateAdditionalIds)].filter((id) => id && id !== booking.id);

    await prisma.$transaction(async (tx) => {
      let priorPaidSum = 0;
      if (uniqueAdditionalIds.length > 0) {
        const priorPending = await tx.payment.findMany({
          where: {
            bookingId: { in: uniqueAdditionalIds },
            status: 'PENDING',
          },
          select: { id: true, amountPaise: true, userId: true },
        });

        if (priorPending.length > 0) {
          priorPaidSum = priorPending.reduce((sum, p) => sum + p.amountPaise, 0);
          await tx.payment.updateMany({
            where: {
              bookingId: { in: uniqueAdditionalIds },
              status: 'PENDING',
            },
            data: {
              status: 'COMPLETED',
              method: (settlePaymentMethod === 'SPLIT' || settlePaymentMethod === 'SYNDICATE_PASS') ? 'OTHER' : settlePaymentMethod,
              paidAt: new Date(),
              recordedByStaffId: staffSession.userId,
              notes: `Desk tab settled (${settlePaymentMethod === 'SPLIT' ? 'Split payment' : settlePaymentMethod}) in combined multi-game bill by ${staffName}`,
            },
          });

          await tx.booking.updateMany({
            where: { id: { in: uniqueAdditionalIds } },
            data: { status: 'COMPLETED' },
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

      const totalDueAtDesk = duePaise + priorPaidSum;
      if (totalDueAtDesk <= 0) {
        throw new ConflictError(`Booking ${booking.bookingRef} has no outstanding balance.`);
      }

      const pendingPayment = booking.payments.find((p) => p.status === 'PENDING');

      if (settlePaymentMethod === 'SPLIT') {
        const cashPaise = splitCashPaise || 0;
        const upiPaise = splitUpiPaise || 0;
        if (cashPaise + upiPaise !== totalDueAtDesk) {
          throw new ValidationError(
            `Split amounts (Cash ₹${(cashPaise / 100).toFixed(2)} + UPI ₹${(upiPaise / 100).toFixed(2)}) must equal total bill ₹${(totalDueAtDesk / 100).toFixed(2)}.`
          );
        }

        // Clean up draft pending payment line
        if (pendingPayment) {
          try {
            await tx.payment.delete({ where: { id: pendingPayment.id } });
          } catch {
            await tx.payment.update({ where: { id: pendingPayment.id }, data: { status: 'FAILED' } });
          }
        }

        if (cashPaise > 0) {
          await tx.payment.create({
            data: {
              bookingId: booking.id,
              userId: booking.userId,
              amountPaise: cashPaise,
              method: 'CASH',
              status: 'COMPLETED',
              paidAt: new Date(),
              recordedByStaffId: staffSession.userId,
              notes: `Split payment: Cash portion (₹${(cashPaise / 100).toFixed(2)}) collected by ${staffName}`,
            },
          });
        }

        if (upiPaise > 0) {
          await tx.payment.create({
            data: {
              bookingId: booking.id,
              userId: booking.userId,
              amountPaise: upiPaise,
              method: 'UPI',
              status: 'COMPLETED',
              paidAt: new Date(),
              recordedByStaffId: staffSession.userId,
              notes: `Split payment: UPI/GPay portion (₹${(upiPaise / 100).toFixed(2)}) collected by ${staffName}`,
            },
          });
        }
      } else if (settlePaymentMethod === 'SYNDICATE_PASS') {
        const activePass = await getGamerActivePass({
          userId: booking.userId,
          phone: booking.customerPhone,
        });
        if (!activePass || !activePass.hasHoursAvailable) {
          throw new ValidationError('Player does not have an active Syndicate Pass with available hours.');
        }

        const scheduledMins = booking.durationMinutes || 60;
        const deductionNotes = `Deducted ${(scheduledMins / 60).toFixed(1)} hrs on ${booking.station?.name || 'station'} (${activePass.planNameSnapshot})`;
        const deduction = await redeemMembershipHours({
          membershipId: activePass.id,
          durationMinutes: scheduledMins,
          bookingId: booking.id,
          stationName: booking.station?.name || 'Gaming Station',
          stationType: booking.station?.stationType,
          gameTitle: booking.gameTitle,
          staffId: staffSession.userId,
          staffName,
          notes: deductionNotes,
          tx,
        });

        if (pendingPayment) {
          await tx.payment.update({
            where: { id: pendingPayment.id },
            data: {
              amountPaise: 0,
              method: 'OTHER',
              status: 'COMPLETED',
              paidAt: new Date(),
              recordedByStaffId: staffSession.userId,
              receiptNumber: `PASS-${activePass.id.slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`,
              notes: `Syndicate Pass: Deducted ${deduction.hoursDeducted} hrs (${activePass.planNameSnapshot}). Remaining: ${deduction.balanceAfterHours} hrs. Authorized by ${staffName}`,
            },
          });
        } else {
          await tx.payment.create({
            data: {
              bookingId: booking.id,
              userId: booking.userId,
              amountPaise: 0,
              method: 'OTHER',
              status: 'COMPLETED',
              paidAt: new Date(),
              recordedByStaffId: staffSession.userId,
              receiptNumber: `PASS-${activePass.id.slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`,
              notes: `Syndicate Pass: Deducted ${deduction.hoursDeducted} hrs (${activePass.planNameSnapshot}). Remaining: ${deduction.balanceAfterHours} hrs. Authorized by ${staffName}`,
            },
          });
        }

        await tx.booking.update({
          where: { id: booking.id },
          data: {
            totalPricePaise: 0,
            membershipPlanName: activePass.planNameSnapshot,
            notes: `${booking.notes || ''}\n[SYNDICATE_PASS: ${deduction.hoursDeducted} hrs deducted from ${activePass.planNameSnapshot}. ${deduction.balanceAfterHours} hrs remaining. Authorized by ${staffName}]`.trim(),
          },
        });
      } else {
        // Single method (CASH or UPI)
        if (pendingPayment) {
          await tx.payment.update({
            where: { id: pendingPayment.id },
            data: {
              amountPaise: duePaise,
              method: settlePaymentMethod,
              status: 'COMPLETED',
              paidAt: new Date(),
              recordedByStaffId: staffSession.userId,
              notes: `Pending payment collected via ${settlePaymentMethod} by ${staffName}`,
            },
          });
        } else {
          await tx.payment.create({
            data: {
              bookingId: booking.id,
              userId: booking.userId,
              amountPaise: duePaise,
              method: settlePaymentMethod,
              status: 'COMPLETED',
              paidAt: new Date(),
              recordedByStaffId: staffSession.userId,
              notes: `Pending payment collected via ${settlePaymentMethod} by ${staffName}`,
            },
          });
        }
      }

      // Update booking status and final price
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: 'COMPLETED',
          totalPricePaise: checkout.finalPricePaise,
          discountPaise: (booking.discountPaise || 0) + checkout.discountPaise,
          notes: `${booking.notes || ''}\n[Payment settled: ₹${(duePaise / 100).toFixed(2)} via ${settlePaymentMethod} by ${staffName} on ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}]`.trim(),
        },
      });

      // Update customer total spent
      if (booking.userId && duePaise > 0) {
        await tx.customerProfile.upsert({
          where: { userId: booking.userId },
          create: { userId: booking.userId, totalSpent: duePaise },
          update: { totalSpent: { increment: duePaise } },
        });
      }

      // Audit and Staff Activity Log
      await tx.staffActivityLog.create({
        data: {
          userId: staffSession.userId,
          action: 'SETTLE_PENDING_PAYMENT',
          entityType: 'booking',
          entityId: booking.id,
          details: {
            method: settlePaymentMethod,
            amountPaise: duePaise,
            finalPricePaise: checkout.finalPricePaise,
            discountPaise: checkout.discountPaise,
            staffName,
          },
        },
      }).catch(() => {});

      await tx.auditLog.create({
        data: {
          userId: staffSession.userId,
          action: 'PAYMENT',
          entityType: 'Booking',
          entityId: booking.id,
          oldValue: { paymentStatus: 'PENDING', bookingRef: booking.bookingRef },
          newValue: {
            paymentStatus: 'COMPLETED',
            method: settlePaymentMethod,
            amountPaise: duePaise,
            bookingRef: booking.bookingRef,
          },
        },
      }).catch(() => {});
    });

    return apiSuccess({
      message: `Payment of ₹${(duePaise / 100).toFixed(2)} settled via ${settlePaymentMethod} for ${booking.customerName || booking.bookingRef}.`,
      bookingId: booking.id,
      bookingRef: booking.bookingRef,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
