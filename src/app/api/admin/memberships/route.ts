import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, AuthError, ForbiddenError, handleApiError, NotFoundError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { grantUserMembership, syncExpiredMemberships } from '@/lib/memberships';
import { z } from 'zod';

const adminGrantSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  planId: z.string().min(1, 'Plan ID is required'),
  notes: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'UPI', 'RAZORPAY', 'OTHER']).default('CASH'),
});

async function requireAdmin() {
  return await requireRole('ADMIN', 'SUPER_ADMIN');
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    await syncExpiredMemberships();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || '';
    const userId = searchParams.get('userId') || '';

    const memberships = await prisma.membership.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(userId ? { userId } : {}),
      },
      include: {
        plan: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return apiSuccess({ memberships });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json();
    const data = adminGrantSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!user) throw new NotFoundError('Gamer account');

    const membership = await grantUserMembership({
      userId: data.userId,
      planId: data.planId,
      paymentMethod: data.paymentMethod,
      notes: data.notes || 'Granted manually by Admin',
      adminId: session.userId,
    });

    return apiSuccess({
      message: `Membership granted successfully to ${user.firstName} ${user.lastName}`,
      membership,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
