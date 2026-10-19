import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError, NotFoundError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { z } from 'zod';

async function requireAdmin() {
  return await requireRole('ADMIN', 'SUPER_ADMIN');
}

const updatePlanSchema = z.object({
  name: z.string().min(1, 'Plan name is required').max(100),
  tier: z.string().min(1, 'Tier is required'),
  description: z.string().optional().nullable(),
  pricePaise: z.number().int().min(0, 'Price must be 0 or greater'),
  durationDays: z.number().int().min(1, 'Duration must be at least 1 day'),
  discountPercent: z.number().int().min(0).max(100, 'Discount must be between 0 and 100'),
  freeHours: z.number().int().min(0, 'Free hours must be 0 or greater'),
  perks: z.array(z.string()).optional(),
  badgeColor: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const plan = await prisma.membershipPlan.findUnique({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundError('Membership plan');
    }

    return apiSuccess({ plan });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const data = updatePlanSchema.parse(body);

    const existing = await prisma.membershipPlan.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('Membership plan');
    }

    const updateData: any = {
      name: data.name,
      tier: data.tier,
      pricePaise: data.pricePaise,
      durationDays: data.durationDays,
      discountPercent: data.discountPercent,
      freeHours: data.freeHours,
    };
    if (data.description !== undefined) updateData.description = data.description;
    if (data.perks !== undefined) updateData.perks = data.perks;
    if (data.badgeColor !== undefined) updateData.badgeColor = data.badgeColor;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;

    const updated = await prisma.membershipPlan.update({
      where: { id },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: 'UPDATE',
        entityType: 'MembershipPlan',
        entityId: id,
        oldValue: {
          name: existing.name,
          pricePaise: existing.pricePaise,
          discountPercent: existing.discountPercent,
          durationDays: existing.durationDays,
          freeHours: existing.freeHours,
          isActive: existing.isActive,
        },
        newValue: {
          name: updated.name,
          pricePaise: updated.pricePaise,
          discountPercent: updated.discountPercent,
          durationDays: updated.durationDays,
          freeHours: updated.freeHours,
          isActive: updated.isActive,
        },
      },
    }).catch(() => {});

    return apiSuccess({
      message: `${updated.name} updated successfully`,
      plan: updated,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();
    const { id } = await params;

    const existing = await prisma.membershipPlan.findUnique({
      where: { id },
      include: {
        _count: {
          select: { memberships: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundError('Membership plan');
    }

    // If memberships exist for this plan, soft-deactivate instead of hard deleting
    if (existing._count.memberships > 0) {
      const updated = await prisma.membershipPlan.update({
        where: { id },
        data: { isActive: false },
      });

      await prisma.auditLog.create({
        data: {
          userId: session.userId,
          action: 'STATUS_CHANGE',
          entityType: 'MembershipPlan',
          entityId: id,
          oldValue: { name: existing.name, isActive: existing.isActive },
          newValue: { name: existing.name, isActive: false, note: 'Deactivated due to existing member history' },
        },
      }).catch(() => {});

      return apiSuccess({
        message: `${existing.name} has active gamer history, so it was set to Inactive`,
        plan: updated,
        deactivatedOnly: true,
      });
    }

    await prisma.membershipPlan.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: 'DELETE',
        entityType: 'MembershipPlan',
        entityId: id,
        oldValue: { name: existing.name },
      },
    }).catch(() => {});

    return apiSuccess({
      message: `${existing.name} deleted successfully`,
      deactivatedOnly: false,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
