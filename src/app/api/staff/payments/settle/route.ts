import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, ConflictError, handleApiError, NotFoundError, ValidationError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { calculateSessionCheckout } from '@/lib/sessionCheckout';
import { z } from 'zod';

const settlePaymentSchema = z.object({
  bookingId: z.string().min(1),
  settlePaymentMethod: z.enum(['CASH', 'UPI', 'SPLIT']),
  splitCashPaise: z.number().int().min(0).optional(),
  splitUpiPaise: z.number().int().min(0).optional(),
  discountPaise: z.number().int().min(0).max(100_000_000).optional(),
  finalPricePaise: z.number().int().min(0).max(100_000_000).optional(),
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
    if (duePaise <= 0) {
      throw new ConflictError(`Booking ${booking.bookingRef} has no outstanding balance.`);
    }

    await prisma.$transaction(async (tx) => {
      const pendingPayment = booking.payments.find((p) => p.status === 'PENDING');

      if (settlePaymentMethod === 'SPLIT') {
        const cashPaise = splitCashPaise || 0;
        const upiPaise = splitUpiPaise || 0;
        if (cashPaise + upiPaise !== duePaise) {
          throw new ValidationError(
            `Split amounts (Cash ₹${(cashPaise / 100).toFixed(2)} + UPI ₹${(upiPaise / 100).toFixed(2)}) must equal total bill ₹${(duePaise / 100).toFixed(2)}.`
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
