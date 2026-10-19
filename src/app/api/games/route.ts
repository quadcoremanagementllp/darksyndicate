import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError } from '@/lib/errors';
import { ensureDefaultGames, isGameInstalledOnStation } from '@/lib/games';

export async function GET(req: NextRequest) {
  try {
    await ensureDefaultGames();

    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform');
    const stationId = searchParams.get('stationId');
    const stationType = searchParams.get('stationType') || platform;
    const featuredOnly = searchParams.get('featured') === 'true';

    const where: any = {
      isActive: true,
    };

    if (platform && platform !== 'ALL') {
      where.platform = platform;
    }
    if (featuredOnly) {
      where.isFeatured = true;
    }

    let games = await prisma.game.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }],
    });

    // If specific station requested, filter by station installation
    if (stationId && stationType) {
      games = games.filter((g) => isGameInstalledOnStation(g, stationId, stationType));
    }

    return apiSuccess({ games });
  } catch (error) {
    return handleApiError(error);
  }
}
