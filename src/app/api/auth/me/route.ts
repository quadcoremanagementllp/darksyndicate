import { getSession, setSessionCookie } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { handleApiError, apiSuccess } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// ─── GET /api/auth/me ───────────────────────────────────────────────────────
// Returns the current authenticated user's profile, or { user: null } if guest
export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return apiSuccess({ user: null });
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

    if (!user || user.status !== 'ACTIVE') {
      return apiSuccess({ user: null });
    }

    // Refresh the session cookie so active users remain logged in seamlessly (sliding expiration)
    try {
      await setSessionCookie({
        userId: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      });
    } catch (cookieErr) {
      console.warn('Sliding session cookie refresh skipped in /api/auth/me:', cookieErr);
    }

    return apiSuccess({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
