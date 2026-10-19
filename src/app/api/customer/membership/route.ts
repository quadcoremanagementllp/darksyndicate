import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, AuthError, handleApiError, ValidationError } from '@/lib/errors';
import { getSession } from '@/lib/session';
import { getActiveUserMembership } from '@/lib/memberships';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) throw new AuthError('Please sign in to view your membership');

    const [activeMembership, history, bookings] = await Promise.all([
      getActiveUserMembership(session.userId),
      prisma.membership.findMany({
        where: { userId: session.userId },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.booking.findMany({
        where: {
          userId: session.userId,
          membershipDiscountPaise: { gt: 0 },
        },
        select: { membershipDiscountPaise: true },
      }),
    ]);

    const totalSavedPaise = bookings.reduce((sum, b) => sum + b.membershipDiscountPaise, 0);

    return apiSuccess({
      activeMembership,
      history,
      totalSavedPaise,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(_req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new AuthError('Please sign in to purchase a membership');
    throw new ValidationError('Online membership checkout is not available. Please purchase your pass at reception.');
  } catch (error) {
    return handleApiError(error);
  }
}
