import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { ensureDefaultMembershipPlans } from '@/lib/memberships';
import { z } from 'zod';

async function requireAdmin() {
  return await requireRole('ADMIN', 'SUPER_ADMIN');
}

const createPlanSchema = z.object({
  name: z.string().min(1, 'Plan name is required').max(100),
  slug: z.string().min(1, 'Plan slug is required').max(100),
  tier: z.string().min(1, 'Tier is required'),
  description: z.string().optional().nullable(),
  pricePaise: z.number().int().min(0, 'Price must be 0 or greater'),
  durationDays: z.number().int().min(1, 'Duration must be at least 1 day'),
  discountPercent: z.number().int().min(0).max(100, 'Discount must be between 0 and 100'),
  freeHours: z.number().int().min(0, 'Free hours must be 0 or greater').default(0),
  perks: z.array(z.string()).optional().default([]),
  badgeColor: z.string().optional().nullable(),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    await ensureDefaultMembershipPlans();

    const plans = await prisma.membershipPlan.findMany({
      orderBy: { displayOrder: 'asc' },
    });

    return apiSuccess({ plans });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json();
    const data = createPlanSchema.parse(body);

    const plan = await prisma.membershipPlan.create({
      data: {
        name: data.name,
        slug: data.slug.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-'),
        tier: data.tier,
        description: data.description,
        pricePaise: data.pricePaise,
        durationDays: data.durationDays,
        discountPercent: data.discountPercent,
        freeHours: data.freeHours,
        perks: data.perks,
        badgeColor: data.badgeColor,
        displayOrder: data.displayOrder,
        isActive: data.isActive,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: 'CREATE',
        entityType: 'MembershipPlan',
        entityId: plan.id,
        newValue: { name: plan.name, pricePaise: plan.pricePaise, tier: plan.tier },
      },
    }).catch(() => {});

    return apiSuccess({
      message: `Membership plan ${plan.name} created successfully`,
      plan,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
