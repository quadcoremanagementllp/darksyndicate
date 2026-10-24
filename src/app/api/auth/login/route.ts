import { NextRequest } from 'next/server';
import { inactiveShiftEnd } from '@/lib/staffShiftTime';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth';
import { setSessionCookie } from '@/lib/session';
import { loginSchema } from '@/validators/auth.schema';
import { handleApiError, apiSuccess, AuthError, AppError } from '@/lib/errors';
import { checkRateLimit, clearRateLimit, getClientIp } from '@/lib/rate-limit';
import { RATE_LIMIT } from '@/lib/constants';

// ─── POST /api/auth/login ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    // Rate limiting
    checkRateLimit(
      `login:${ip}`,
      RATE_LIMIT.LOGIN.maxAttempts,
      RATE_LIMIT.LOGIN.windowMs
    );

    const body = await request.json();
    const { email, password } = loginSchema.parse(body);
    if (email.toLowerCase() === 'guest@darksyndicate.in') throw new AuthError('Invalid email or password');
    const portal = body.portal === 'admin' || body.portal === 'staff' ? body.portal : 'player';

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        phone: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      throw new AuthError('Invalid email or password');
    }

    // Check account status
    if (user.status === 'BLOCKED') {
      throw new AppError(
        'Your account has been blocked. Please contact support.',
        403,
        'ACCOUNT_BLOCKED'
      );
    }

    if (user.status === 'DEACTIVATED') {
      throw new AppError(
        'Your account has been deactivated.',
        403,
        'ACCOUNT_DEACTIVATED'
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new AuthError('Invalid email or password');
    }

    const hasPortalAccess =
      portal === 'player' ||
      (portal === 'admin' && ['SUPER_ADMIN', 'ADMIN'].includes(user.role)) ||
      (portal === 'staff' && ['SUPER_ADMIN', 'ADMIN', 'STAFF'].includes(user.role));

    if (!hasPortalAccess) {
      throw new AuthError(
        'This account does not have access to this portal.'
      );
    }

    // Clear rate limit on successful credentials
    clearRateLimit(`login:${ip}`);

    // Set session cookie
    await setSessionCookie({
      userId: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    // Track Staff & Admin working hours / shifts and record login bookkeeping
    try {
      const userAgent = request.headers.get('user-agent') || undefined;

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN',
          entityType: 'user',
          entityId: user.id,
          newValue: { portal: portal || 'staff', method: 'password' },
          ipAddress: ip,
          userAgent,
        },
      });

      // Record shift only for floor STAFF (Administrators are not tracked as floor shift workers)
      if (user.role === 'STAFF') {
        // Close abandoned shifts at the one-hour inactivity deadline.
        const openShifts = await prisma.staffShift.findMany({
          where: { userId: user.id, logoutAt: null },
        });

        for (const open of openShifts) {
          const logoutAt = inactiveShiftEnd(open.loginAt, new Date());
          const duration = Math.max(1, Math.round((logoutAt.getTime() - open.loginAt.getTime()) / (60 * 1000)));
          await prisma.staffShift.update({
            where: { id: open.id },
            data: {
              logoutAt,
              logoutReason: 'SYSTEM_INACTIVE',
              durationMinutes: duration,
            },
          });
        }

        await prisma.staffShift.create({
          data: {
            userId: user.id,
            loginAt: new Date(),
            ipAddress: ip,
            userAgent,
          },
        });
      }
    } catch (error) {
      console.error('Post-login bookkeeping failed:', error);
    }

    return apiSuccess({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
