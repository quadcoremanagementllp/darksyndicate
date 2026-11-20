import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError, NotFoundError } from '@/lib/errors';
import { requireRole } from '@/lib/session';

async function requireAdmin() {
  return await requireRole('ADMIN', 'SUPER_ADMIN');
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const membership = await prisma.membership.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        plan: true,
      },
    });

    if (!membership) {
      throw new NotFoundError('Syndicate Pass');
    }

    const usageLogs = await prisma.membershipUsageLog.findMany({
      where: { membershipId: id },
      orderBy: { createdAt: 'desc' },
    });

    const totalMinutes = (membership.totalHours || 0) * 60;
    const remainingMinutes = Math.max(0, totalMinutes - (membership.usedMinutes || 0));
    const remainingHours = Number((remainingMinutes / 60).toFixed(2));
    const usedHours = Number(((membership.usedMinutes || 0) / 60).toFixed(2));

    return apiSuccess({
      membership: {
        id: membership.id,
        planNameSnapshot: membership.planNameSnapshot,
        tierSnapshot: membership.tierSnapshot,
        discountPercent: membership.discountPercent,
        totalHours: membership.totalHours,
        usedMinutes: membership.usedMinutes,
        usedHours,
        remainingMinutes,
        remainingHours,
        status: membership.status,
        startsAt: membership.startsAt,
        expiresAt: membership.expiresAt,
        user: membership.user,
      },
      usageLogs: usageLogs.map((log) => ({
        id: log.id,
        bookingId: log.bookingId,
        sessionId: log.sessionId,
        stationName: log.stationName,
        stationType: log.stationType,
        gameTitle: log.gameTitle,
        durationMinutes: log.durationMinutes,
        hoursDeducted: Number(log.hoursDeducted),
        balanceBeforeHours: Number((log.balanceBeforeMinutes / 60).toFixed(2)),
        balanceAfterHours: Number((log.balanceAfterMinutes / 60).toFixed(2)),
        notes: log.notes,
        staffName: log.staffName || 'Staff Operator',
        createdAt: log.createdAt,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
