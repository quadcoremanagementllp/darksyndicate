import { NextRequest } from 'next/server';
import { apiSuccess, handleApiError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { getGamerActivePass } from '@/lib/memberships';

export async function GET(req: NextRequest) {
  try {
    await requireRole('STAFF', 'ADMIN', 'SUPER_ADMIN');
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || undefined;
    const phone = searchParams.get('phone') || undefined;

    if (!userId && !phone) {
      return apiSuccess({ hasPass: false, pass: null });
    }

    const activePass = await getGamerActivePass({ userId, phone });

    if (!activePass) {
      return apiSuccess({ hasPass: false, pass: null });
    }

    return apiSuccess({
      hasPass: true,
      pass: {
        id: activePass.id,
        planName: activePass.planNameSnapshot,
        tier: activePass.tierSnapshot,
        discountPercent: activePass.discountPercent,
        totalHours: activePass.totalHours,
        usedMinutes: activePass.usedMinutes,
        usedHours: activePass.usedHours,
        remainingMinutes: activePass.remainingMinutes,
        remainingHours: activePass.remainingHours,
        hasHoursAvailable: activePass.hasHoursAvailable,
        expiresAt: activePass.expiresAt,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
