import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { getActiveUserMembership } from '@/lib/memberships';

export async function GET(req: NextRequest) {
  try {
    await requireRole('STAFF', 'ADMIN', 'SUPER_ADMIN');
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get('q') || searchParams.get('search') || '').trim();
    const phoneParam = (searchParams.get('phone') || '').trim();
    const emailParam = (searchParams.get('email') || '').trim().toLowerCase();

    if (!query && !phoneParam && !emailParam) {
      return apiSuccess([]);
    }

    // Determine search conditions
    const orConditions: any[] = [];

    // 1. Phone matching
    const targetPhone = phoneParam || (query.replace(/\D/g, '').length >= 4 ? query : '');
    const phoneDigits = targetPhone.replace(/\D/g, '').slice(-10);
    const phoneCandidates =
      phoneDigits.length === 10
        ? [phoneDigits, `+91${phoneDigits}`, `91${phoneDigits}`, `0${phoneDigits}`, `+91 ${phoneDigits}`]
        : phoneDigits.length >= 4
        ? [phoneDigits, `+91${phoneDigits}`, `91${phoneDigits}`]
        : [];

    if (phoneCandidates.length > 0) {
      orConditions.push({ phone: { in: phoneCandidates } });
    }

    // 2. Email matching (exact match to prevent MariaDB binary collation error on LIKE)
    if (emailParam) {
      orConditions.push({ email: emailParam });
    } else if (query.includes('@')) {
      orConditions.push({ email: query.toLowerCase() });
    }

    // 3. Name matching
    if (query && !query.includes('@') && query.replace(/\D/g, '').length < 6) {
      orConditions.push({ firstName: { contains: query } });
      orConditions.push({ lastName: { contains: query } });
    }

    if (orConditions.length === 0) {
      return apiSuccess([]);
    }

    const matchedUsers = await prisma.user.findMany({
      where: {
        role: 'CUSTOMER',
        email: { not: 'guest@darksyndicate.in' },
        OR: orConditions,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
      take: 6,
    });

    // Check active membership for each matched customer in parallel
    const results = await Promise.all(
      matchedUsers.map(async (u) => {
        const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Gamer';
        const activeMem = await getActiveUserMembership(u.id);

        return {
          id: u.id,
          name: fullName,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          phone: u.phone,
          membership: activeMem
            ? {
                id: activeMem.id,
                tier: activeMem.plan.tier,
                planName: activeMem.plan.name,
                discountPercent: activeMem.plan.discountPercent,
                badgeColor: activeMem.plan.badgeColor,
                expiresAt: activeMem.expiresAt.toISOString(),
              }
            : null,
        };
      })
    );

    return apiSuccess(results);
  } catch (error) {
    return handleApiError(error);
  }
}
