import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError, NotFoundError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { z } from 'zod';

async function requireAdmin() {
  return await requireRole('ADMIN', 'SUPER_ADMIN');
}

const updateGameSchema = z.object({
  title: z.string().min(1, 'Game title is required').max(150),
  platform: z.enum(['PS5', 'POOL_TABLE', 'PC', 'VR', 'OTHER']),
  genre: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  coverImage: z.string().optional().nullable(),
  maxPlayers: z.number().int().min(1).max(16),
  stationIds: z.array(z.string()).optional().default([]),
  isFeatured: z.boolean().optional(),
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

    const game = await prisma.game.findUnique({
      where: { id },
    });

    if (!game) {
      throw new NotFoundError('Game');
    }

    return apiSuccess({ game });
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
    const data = updateGameSchema.parse(body);

    const existing = await prisma.game.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Game');
    }

    const updated = await prisma.game.update({
      where: { id },
      data: {
        title: data.title.trim(),
        platform: data.platform,
        genre: data.genre !== undefined ? data.genre?.trim() || null : existing.genre,
        description: data.description !== undefined ? data.description?.trim() || null : existing.description,
        coverImage: data.coverImage !== undefined ? data.coverImage?.trim() || null : existing.coverImage,
        maxPlayers: data.maxPlayers,
        stationIds: data.stationIds && data.stationIds.length > 0 ? data.stationIds : [],
        isFeatured: data.isFeatured !== undefined ? data.isFeatured : existing.isFeatured,
        isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
        displayOrder: data.displayOrder !== undefined ? data.displayOrder : existing.displayOrder,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: 'UPDATE',
        entityType: 'Game',
        entityId: id,
        oldValue: { title: existing.title, stationIds: existing.stationIds },
        newValue: { title: updated.title, stationIds: updated.stationIds },
      },
    }).catch(() => {});

    return apiSuccess({
      message: `${updated.title} updated successfully`,
      game: updated,
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

    const existing = await prisma.game.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Game');
    }

    await prisma.game.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: 'DELETE',
        entityType: 'Game',
        entityId: id,
        oldValue: { title: existing.title },
      },
    }).catch(() => {});

    return apiSuccess({
      message: `${existing.title} removed from library`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
