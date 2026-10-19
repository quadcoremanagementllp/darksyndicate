import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { ensureDefaultGames } from '@/lib/games';
import { z } from 'zod';

async function requireAdmin() {
  return await requireRole('ADMIN', 'SUPER_ADMIN');
}

const createGameSchema = z.object({
  title: z.string().min(1, 'Game title is required').max(150),
  slug: z.string().optional(),
  platform: z.enum(['PS5', 'POOL_TABLE', 'PC', 'VR', 'OTHER']).default('PS5'),
  genre: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  coverImage: z.string().optional().nullable(),
  maxPlayers: z.number().int().min(1).max(16).default(2),
  stationIds: z.array(z.string()).optional().default([]),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    await ensureDefaultGames();

    const [games, stations] = await Promise.all([
      prisma.game.findMany({
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.gamingStation.findMany({
        where: { status: { not: 'DEACTIVATED' } },
        select: { id: true, name: true, stationType: true, facilityId: true },
        orderBy: [{ stationType: 'asc' }, { displayOrder: 'asc' }],
      }),
    ]);

    return apiSuccess({ games, stations });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json();
    const data = createGameSchema.parse(body);

    const slug = (data.slug || data.title)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, '-');

    // Ensure slug uniqueness
    const existing = await prisma.game.findUnique({ where: { slug } });
    const finalSlug = existing ? `${slug}-${Date.now().toString().slice(-4)}` : slug;

    const game = await prisma.game.create({
      data: {
        title: data.title.trim(),
        slug: finalSlug,
        platform: data.platform,
        genre: data.genre?.trim() || null,
        description: data.description?.trim() || null,
        coverImage: data.coverImage?.trim() || null,
        maxPlayers: data.maxPlayers,
        stationIds: data.stationIds && data.stationIds.length > 0 ? data.stationIds : [],
        isFeatured: data.isFeatured,
        isActive: data.isActive,
        displayOrder: data.displayOrder,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: 'CREATE',
        entityType: 'Game',
        entityId: game.id,
        newValue: { title: game.title, platform: game.platform, stationIds: game.stationIds },
      },
    }).catch(() => {});

    return apiSuccess({
      message: `${game.title} added to Arena catalog successfully`,
      game,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
