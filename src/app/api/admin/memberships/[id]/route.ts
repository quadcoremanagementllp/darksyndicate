import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError, NotFoundError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { z } from 'zod';

async function requireAdmin() {
  return await requireRole('ADMIN', 'SUPER_ADMIN');
}

const updateMembershipSchema = z.object({
  status: z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED']).optional(),
  expiresAt: z.string().optional(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const data = updateMembershipSchema.parse(body);

    const existing = await prisma.membership.findUnique({
      where: { id },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    if (!existing) throw new NotFoundError('Membership');

    const updateData: any = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.expiresAt) {
      const parsedDate = new Date(data.expiresAt);
      if (!isNaN(parsedDate.getTime())) {
        updateData.expiresAt = parsedDate;
      }
    }

    const updated = await prisma.membership.update({
      where: { id },
      data: updateData,
      include: {
        plan: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: 'UPDATE',
        entityType: 'Membership',
        entityId: id,
        oldValue: { status: existing.status, expiresAt: existing.expiresAt },
        newValue: {
          status: updated.status,
          expiresAt: updated.expiresAt,
          customer: `${existing.user.firstName} ${existing.user.lastName}`.trim(),
        },
      },
    }).catch(() => {});

    return apiSuccess({
      message: 'Membership updated successfully',
      membership: updated,
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

    const existing = await prisma.membership.findUnique({
      where: { id },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    if (!existing) throw new NotFoundError('Membership');

    const updated = await prisma.membership.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: 'UPDATE',
        entityType: 'Membership',
        entityId: id,
        oldValue: { status: existing.status },
        newValue: { status: 'CANCELLED', customer: `${existing.user.firstName} ${existing.user.lastName}`.trim() },
      },
    }).catch(() => {});

    return apiSuccess({
      message: 'Membership status updated to CANCELLED',
      membership: updated,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
