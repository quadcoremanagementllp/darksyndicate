import { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError, AuthError, NotFoundError } from '@/lib/errors';
import { z } from 'zod';

const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().max(50).optional(),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian phone number')
    .optional()
    .or(z.literal('')),
  address: z.string().max(200).optional(),
  dateOfBirth: z.string().optional(),
});

// GET /api/customer/profile
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      throw new AuthError('Please sign in to access your profile');
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        include: {
          customerProfile: true,
        },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      return apiSuccess({
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        profile: {
          address: user.customerProfile?.address || '',
          dateOfBirth: user.customerProfile?.dateOfBirth || '',
          totalSpentPaise: user.customerProfile?.totalSpent || 0,
        },
      });
    } catch (error) {
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT /api/customer/profile
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      throw new AuthError('Please sign in to update your profile');
    }

    const body = await req.json();
    const validatedData = updateProfileSchema.parse(body);

    try {
      const updatedUser = await prisma.user.update({
        where: { id: session.userId },
        data: {
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          phone: validatedData.phone || undefined,
          customerProfile: {
            upsert: {
              create: {
                address: validatedData.address,
                dateOfBirth: validatedData.dateOfBirth ? new Date(validatedData.dateOfBirth) : undefined,
              },
              update: {
                address: validatedData.address,
                dateOfBirth: validatedData.dateOfBirth ? new Date(validatedData.dateOfBirth) : undefined,
              },
            },
          },
        },
        include: {
          customerProfile: true,
        },
      });

      return apiSuccess({
        message: 'Profile updated successfully',
        user: {
          id: updatedUser.id,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          phone: updatedUser.phone,
          profile: updatedUser.customerProfile,
        },
      });
    } catch (error) {
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
