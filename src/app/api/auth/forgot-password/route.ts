import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateSecureToken } from '@/lib/auth';
import { forgotPasswordSchema } from '@/validators/auth.schema';
import { handleApiError, apiSuccess, AppError } from '@/lib/errors';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { RATE_LIMIT } from '@/lib/constants';
import { sendEmail } from '@/lib/email';
import { createHash } from 'node:crypto';

// ─── POST /api/auth/forgot-password ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
      throw new AppError('Password reset email is not configured. Please contact the venue.', 503, 'EMAIL_UNAVAILABLE');
    }
    const ip = getClientIp(request);

    // Rate limiting
    checkRateLimit(
      `forgot-password:${ip}`,
      RATE_LIMIT.PASSWORD_RESET.maxAttempts,
      RATE_LIMIT.PASSWORD_RESET.windowMs
    );

    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);

    // Always return success (prevent email enumeration)
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, firstName: true },
    });

    if (user) {
      // Invalidate existing reset tokens
      await prisma.passwordReset.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { expiresAt: new Date() }, // Expire immediately
      });

      // Create new reset token (expires in 1 hour)
      const token = generateSecureToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          token: createHash('sha256').update(token).digest('hex'),
          expiresAt,
        },
      });

      const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
      if (!appUrl) throw new Error('APP_URL is required to send password reset email');
      const resetUrl = `${appUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
      try {
        await sendEmail(email, 'Reset your Dark Syndicate password', `Use this link to reset your password. It expires in one hour:\n\n${resetUrl}`);
      } catch (error) {
        await prisma.passwordReset.updateMany({ where: { token: createHash('sha256').update(token).digest('hex') }, data: { expiresAt: new Date() } });
        console.error('Password reset email failed:', error);
      }

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'UPDATE',
          entityType: 'password_reset',
          entityId: user.id,
          ipAddress: ip,
        },
      });
    }

    // Always return success to prevent email enumeration
    return apiSuccess({
      message:
        'If an account with that email exists, we have sent a password reset link.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
