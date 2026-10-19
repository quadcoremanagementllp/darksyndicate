import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { setSessionCookie } from '@/lib/session';
import { registerSchema } from '@/validators/auth.schema';
import { handleApiError, apiSuccess, ConflictError } from '@/lib/errors';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { RATE_LIMIT } from '@/lib/constants';
import { sanitizePhone } from '@/lib/utils';

// ─── POST /api/auth/register ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    // Rate limiting
    checkRateLimit(
      `register:${ip}`,
      RATE_LIMIT.REGISTER.maxAttempts,
      RATE_LIMIT.REGISTER.windowMs
    );

    const body = await request.json();
    const data = registerSchema.parse(body);

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictError('An account with this email already exists');
    }

    // Check phone uniqueness if provided
    if (data.phone) {
      const sanitizedPhone = sanitizePhone(data.phone);
      const existingPhone = await prisma.user.findUnique({
        where: { phone: sanitizedPhone },
        select: { id: true },
      });

      if (existingPhone) {
        throw new ConflictError('An account with this phone number already exists');
      }
    }

    // Hash password
    const passwordHash = await hashPassword(data.password);

    // Create user + customer profile in transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: data.email,
          phone: data.phone ? sanitizePhone(data.phone) : null,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          role: 'CUSTOMER',
          status: 'ACTIVE',
          lastLoginAt: new Date(),
        },
      });

      // Create customer profile
      await tx.customerProfile.create({
        data: {
          userId: newUser.id,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: newUser.id,
          action: 'CREATE',
          entityType: 'user',
          entityId: newUser.id,
          ipAddress: ip,
          userAgent: request.headers.get('user-agent') || undefined,
        },
      });

      return newUser;
    });

    // Set session cookie
    await setSessionCookie({
      userId: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    return apiSuccess(
      {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          status: user.status,
        },
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
