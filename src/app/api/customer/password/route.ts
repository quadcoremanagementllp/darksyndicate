import { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { apiSuccess, handleApiError, AuthError, ValidationError } from '@/lib/errors';
import { z } from 'zod';

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New passwords do not match',
    path: ['confirmPassword'],
  });

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      throw new AuthError('Please sign in to update your password');
    }

    const body = await req.json();
    const { currentPassword, newPassword } = changePasswordSchema.parse(body);

    try {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
      });

      if (!user) {
        throw new AuthError('User account not found');
      }

      const isValid = await verifyPassword(currentPassword, user.passwordHash);
      if (!isValid) {
        throw new ValidationError('The current password you entered is incorrect');
      }

      const newPasswordHash = await hashPassword(newPassword);

      await prisma.user.update({
        where: { id: session.userId },
        data: { passwordHash: newPasswordHash },
      });

      return apiSuccess({ message: 'Password updated successfully' });
    } catch (dbErr) {
      if (dbErr instanceof ValidationError || dbErr instanceof AuthError) {
        throw dbErr;
      }
      throw dbErr;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
