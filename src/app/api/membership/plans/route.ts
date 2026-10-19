import { apiSuccess, handleApiError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { ensureDefaultMembershipPlans } from '@/lib/memberships';

export async function GET() {
  try {
    await ensureDefaultMembershipPlans();
    const plans = await prisma.membershipPlan.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
    return apiSuccess({ plans });
  } catch (error) {
    return handleApiError(error);
  }
}
