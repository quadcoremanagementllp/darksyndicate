import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError, AuthError } from '@/lib/errors';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      throw new AuthError('Please sign in to view payment history');
    }

    const [payments, paidMemberships] = await Promise.all([
      prisma.payment.findMany({
        where: {
          booking: {
            userId: session.userId,
          },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          booking: {
            select: {
              bookingRef: true,
              date: true,
              startTime: true,
            },
          },
        },
      }),
      prisma.membership.findMany({
        where: {
          userId: session.userId,
          status: { not: 'CANCELLED' },
          pricePaidPaise: { gt: 0 },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const membershipEntries = paidMemberships.map((m) => ({
      id: `mem-${m.id}`,
      bookingId: m.id,
      amountPaise: m.pricePaidPaise,
      currency: 'INR',
      method: m.paymentMethod || 'UPI',
      status: 'COMPLETED',
      gatewayOrderId: null,
      gatewayPaymentId: `PASS-${m.id.slice(0, 8).toUpperCase()}`,
      createdAt: m.createdAt,
      booking: {
        bookingRef: `${m.planNameSnapshot} Pass`,
        date: m.startsAt,
        startTime: m.startsAt,
      },
    }));

    const combined = [...payments, ...membershipEntries].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return apiSuccess(combined);
  } catch (error) {
    return handleApiError(error);
  }
}
