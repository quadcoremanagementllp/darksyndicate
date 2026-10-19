import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/session';
import { createRazorpayOrder, razorpayEnabled } from '@/lib/razorpay';
import { apiSuccess, handleApiError, ValidationError, NotFoundError } from '@/lib/errors';

const schema = z.object({ bookingId: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    if (!razorpayEnabled()) throw new ValidationError('Online payments are currently unavailable');
    const session = await requireSession();
    const { bookingId } = schema.parse(await req.json());
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.userId !== session.userId) throw new NotFoundError('Booking not found');
    if (booking.status !== 'PENDING' || booking.totalPricePaise < 100 ||
        booking.createdAt.getTime() < Date.now() - 15 * 60_000) {
      throw new ValidationError('Booking is no longer available for online payment');
    }

    const order = await createRazorpayOrder(booking.totalPricePaise, booking.bookingRef);
    if (!order.id?.startsWith('order_') || order.amount !== booking.totalPricePaise || order.currency !== 'INR') {
      throw new Error('Gateway returned an invalid order');
    }
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        userId: booking.userId,
        amountPaise: booking.totalPricePaise,
        method: 'RAZORPAY',
        status: 'PENDING',
        gatewayOrderId: order.id,
      },
    });
    return apiSuccess({
      orderId: order.id,
      paymentId: payment.id,
      amountPaise: order.amount,
      currency: 'INR',
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
