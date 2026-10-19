import { NextRequest } from 'next/server';
import { clearSessionCookie, getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { handleApiError, apiSuccess } from '@/lib/errors';
import { getClientIp } from '@/lib/rate-limit';

// ─── POST /api/auth/logout ──────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    // Check optional logout reason: "MANUAL" or "SYSTEM_INACTIVE"
    let reason: 'MANUAL' | 'SYSTEM_INACTIVE' = 'MANUAL';
    try {
      const body = await request.json();
      if (body?.reason === 'SYSTEM_INACTIVE') {
        reason = 'SYSTEM_INACTIVE';
      }
    } catch {
      // Body may be empty on basic beacon or default fetch
    }

    if (session) {
      const isSystemInactive = reason === 'SYSTEM_INACTIVE';
      const description = isSystemInactive
        ? 'Logout by system due to inactivity'
        : 'Manual logout by staff';

      // 1. Immutable Security Audit Log
      await prisma.auditLog.create({
        data: {
          userId: session.userId,
          action: 'LOGOUT',
          entityType: 'user',
          entityId: session.userId,
          newValue: {
            reason,
            description,
          },
          ipAddress: getClientIp(request),
          userAgent: request.headers.get('user-agent') || undefined,
        },
      });

      // 2. Staff Attendance Shift Closure & Working Hours Measurement
      try {
        const activeShift = await prisma.staffShift.findFirst({
          where: {
            userId: session.userId,
            logoutAt: null,
          },
          orderBy: { loginAt: 'desc' },
        });

        if (activeShift) {
          const now = new Date();
          const rawMinutes = Math.round((now.getTime() - new Date(activeShift.loginAt).getTime()) / (60 * 1000));
          const durationMinutes = Math.max(1, rawMinutes);

          await prisma.staffShift.update({
            where: { id: activeShift.id },
            data: {
              logoutAt: now,
              logoutReason: reason,
              durationMinutes,
            },
          });
        }
      } catch (shiftErr) {
        console.error('Error closing staff shift on logout:', shiftErr);
      }
    }

    await clearSessionCookie();

    return apiSuccess({
      message: reason === 'SYSTEM_INACTIVE'
        ? 'Logged out by system due to inactivity'
        : 'Logged out successfully',
      reason,
    });
  } catch (error) {
    // Always clear cookie even if audit fails
    try {
      await clearSessionCookie();
    } catch {
      // Ignore
    }
    return handleApiError(error);
  }
}
