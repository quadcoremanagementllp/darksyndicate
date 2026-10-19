import { prisma } from '@/lib/prisma';

export async function settleBookingPayment(paymentId: string, gatewayPayment: {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
}, signature?: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || !payment.gatewayOrderId || payment.method !== 'RAZORPAY') throw new Error('Payment order not found');
  if (payment.gatewayOrderId !== gatewayPayment.order_id || gatewayPayment.amount !== payment.amountPaise ||
      gatewayPayment.currency !== 'INR' || gatewayPayment.status !== 'captured') {
    throw new Error('Payment details do not match the booking');
  }
  if (payment.status === 'COMPLETED') {
    if (payment.gatewayPaymentId !== gatewayPayment.id) throw new Error('A different payment already settled this order');
    return payment;
  }
  if (payment.status !== 'PENDING') throw new Error('Payment is no longer pending');

  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: payment.bookingId } });
    const expired = booking.createdAt.getTime() < Date.now() - 15 * 60_000;
    const conflict = !expired && booking.status === 'PENDING'
      ? await tx.booking.findFirst({
          where: {
            id: { not: booking.id },
            stationId: booking.stationId,
            status: { in: ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] },
            startTime: { lt: booking.endTime },
            endTime: { gt: booking.startTime },
          },
          select: { id: true },
        })
      : null;
    const canConfirm = booking.status === 'PENDING' && !expired && !conflict;
    const claimed = await tx.payment.updateMany({
      where: { id: paymentId, status: 'PENDING' },
      data: {
        status: 'COMPLETED', gatewayPaymentId: gatewayPayment.id, gatewaySignature: signature, paidAt: new Date(),
        ...(canConfirm ? {} : { notes: 'Captured after booking hold expired or booking unavailable; refund required' }),
      },
    });
    if (!claimed.count) {
      const settled = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      if (settled.gatewayPaymentId !== gatewayPayment.id) throw new Error('A different payment already settled this order');
      return settled;
    }

    if (!canConfirm) {
      await tx.booking.updateMany({ where: { id: booking.id, status: 'PENDING' }, data: { status: 'PAYMENT_FAILED' } });
      await tx.refund.create({
        data: { paymentId, amountPaise: payment.amountPaise, status: 'PENDING', reason: 'Captured payment for an unavailable booking; refund in Razorpay dashboard required' },
      });
      await tx.notification.create({
        data: {
          userId: payment.userId, type: 'ACCOUNT_UPDATE', title: 'Booking could not be confirmed',
          message: 'Your payment was captured after this reservation became unavailable. Please contact the venue for a refund.',
          metadata: { bookingId: booking.id, paymentId },
        },
      });
      await tx.auditLog.create({
        data: { action: 'REFUND', entityType: 'Payment', entityId: paymentId, newValue: { reason: 'Captured payment requires refund', gatewayPaymentId: gatewayPayment.id } },
      });
      return tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    }

    const confirmed = await tx.booking.updateMany({ where: { id: booking.id, status: 'PENDING' }, data: { status: 'CONFIRMED' } });
    if (!confirmed.count) throw new Error('Booking changed during payment settlement');
    await tx.customerProfile.upsert({
      where: { userId: payment.userId },
      create: { userId: payment.userId, totalBookings: 1, totalSpent: payment.amountPaise },
      update: { totalBookings: { increment: 1 }, totalSpent: { increment: payment.amountPaise } },
    });
    await tx.notification.create({
      data: {
        userId: payment.userId,
        type: 'PAYMENT_RECEIVED',
        title: 'Payment received',
        message: 'Your booking payment was captured and your reservation is confirmed.',
        metadata: { bookingId: payment.bookingId },
      },
    });
    return tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
  });
}
