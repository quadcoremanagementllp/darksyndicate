import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/session';
import { fetchRazorpayPayment, razorpayEnabled, validRazorpaySignature } from '@/lib/razorpay';
import { settleBookingPayment } from '@/lib/settle-payment';
import { apiSuccess, handleApiError, NotFoundError, ValidationError } from '@/lib/errors';

const schema = z.object({
  paymentId: z.string().min(1),
  gatewayOrderId: z.string().startsWith('order_'),
  gatewayPaymentId: z.string().startsWith('pay_'),
  gatewaySignature: z.string().length(64),
});

export async function POST(req: NextRequest) {
  try {
    if (!razorpayEnabled()) throw new ValidationError('Online payments are currently unavailable');
    const session = await requireSession();
    const data = schema.parse(await req.json());
    const payment = await prisma.payment.findUnique({ where: { id: data.paymentId } });
    if (!payment || payment.userId !== session.userId || payment.gatewayOrderId !== data.gatewayOrderId) {
      throw new NotFoundError('Payment order not found');
    }
    if (!validRazorpaySignature(payment.gatewayOrderId, data.gatewayPaymentId, data.gatewaySignature)) {
      throw new ValidationError('Invalid gateway signature');
    }
    const gatewayPayment = await fetchRazorpayPayment(data.gatewayPaymentId);
    const settled = await settleBookingPayment(payment.id, gatewayPayment, data.gatewaySignature);
    return apiSuccess({ bookingId: settled.bookingId, status: settled.status });
  } catch (error) {
    return handleApiError(error);
  }
}
