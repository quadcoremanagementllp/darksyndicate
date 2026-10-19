import { getSession, setSessionCookie } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { handleApiError, apiSuccess, AuthError } from '@/lib/errors';

// ─── GET /api/auth/me ───────────────────────────────────────────────────────
// Returns the current authenticated user's profile

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      throw new AuthError();
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        phone: true,
        avatarUrl: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AuthError('User not found');
    }

    if (user.status !== 'ACTIVE') {
      throw new AuthError('Account is not active');
    }

    // Refresh the session cookie so active users remain logged in seamlessly (sliding expiration)
    await setSessionCookie({
      userId: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    // Ensure active shift exists only for on-duty floor STAFF (not Admins or Super Admins)
    if (user.role === 'STAFF') {
      try {
        const activeShift = await prisma.staffShift.findFirst({
          where: { userId: user.id, logoutAt: null },
          orderBy: { loginAt: 'desc' },
        });

        if (!activeShift) {
          // Open shift from user's last login time (or right now if fresh)
          const loginTime = user.lastLoginAt ? new Date(user.lastLoginAt) : new Date();
          const ageMin = Math.round((Date.now() - loginTime.getTime()) / (60 * 1000));
          const isRecent = ageMin < 120; // Within 2h

          await prisma.staffShift.create({
            data: {
              userId: user.id,
              loginAt: isRecent ? loginTime : new Date(),
            },
          });
        }
      } catch (shiftErr) {
        console.error('Failed to sync active staff shift in /api/auth/me:', shiftErr);
      }
    }

    return apiSuccess({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
