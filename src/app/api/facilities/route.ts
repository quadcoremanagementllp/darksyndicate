import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError } from '@/lib/errors';
import { DEFAULT_ARENA_GAMES } from '@/lib/games';

const ps5DefaultGames = DEFAULT_ARENA_GAMES.filter((g) => g.platform === 'PS5');
const poolDefaultGames = DEFAULT_ARENA_GAMES.filter((g) => g.platform === 'POOL_TABLE');

// Fallback seed data in case database is in setup mode
const DEFAULT_FACILITIES = [
  {
    id: 'fac-ps5',
    name: 'PlayStation 5 Arena',
    description:
      '3 PlayStation 5 setups featuring 55-inch 4K 120Hz OLED displays, low-latency HDMI 2.1, Sony DualSense wireless controllers, and competitive gaming headsets. Single player ₹150/hr, 2 players ₹200/hr, 3-4 players ₹250/hr.',
    displayOrder: 1,
    isActive: true,
    stations: [
      {
        id: 'station-ps5-01',
        name: 'PS5 Station 1',
        stationType: 'PS5',
        status: 'AVAILABLE',
        pricePerHourPaise: 15000, // ₹150 / hr (single player base)
        capacity: 4,
        specs: 'Sony PS5, 55" LG OLED 4K 120Hz, DualSense Controllers, SteelSeries Arctis Nova 7P. Single ₹150/hr, Duo ₹200/hr, Squad (3-4) ₹250/hr.',
        games: ps5DefaultGames.map((g) => g.title),
        gameDetails: ps5DefaultGames,
      },
      {
        id: 'station-ps5-02',
        name: 'PS5 Station 2',
        stationType: 'PS5',
        status: 'AVAILABLE',
        pricePerHourPaise: 15000,
        capacity: 4,
        specs: 'Sony PS5, 55" LG OLED 4K 120Hz, DualSense Controllers, Sony Pulse 3D Audio. Single ₹150/hr, Duo ₹200/hr, Squad (3-4) ₹250/hr.',
        games: ps5DefaultGames.map((g) => g.title),
        gameDetails: ps5DefaultGames,
      },
      {
        id: 'station-ps5-03',
        name: 'PS5 Station 3',
        stationType: 'PS5',
        status: 'AVAILABLE',
        pricePerHourPaise: 15000,
        capacity: 4,
        specs: 'Sony PS5, 55" LG OLED 4K 120Hz, DualSense Controllers, SteelSeries 3D Audio. Single ₹150/hr, Duo ₹200/hr, Squad (3-4) ₹250/hr.',
        games: ps5DefaultGames.map((g) => g.title),
        gameDetails: ps5DefaultGames,
      },
    ],
  },
  {
    id: 'fac-snooker',
    name: 'Snooker Lounge',
    description:
      '3 championship snooker tables with premium accessories. ₹250/hr per table for 3-4 players, +₹50 per extra person beyond 4.',
    displayOrder: 2,
    isActive: true,
    stations: [
      {
        id: 'station-snooker-01',
        name: 'Snooker Table 1',
        stationType: 'POOL_TABLE',
        status: 'AVAILABLE',
        pricePerHourPaise: 25000, // ₹250 / hr
        capacity: 4,
        specs: 'Full-size Championship Snooker Table, Shadowless LED Canopy, Premium Cues & Accessories. ₹250/hr (3-4 players), +₹50 per extra person.',
        games: poolDefaultGames.map((g) => g.title),
        gameDetails: poolDefaultGames,
      },
      {
        id: 'station-snooker-02',
        name: 'Snooker Table 2',
        stationType: 'POOL_TABLE',
        status: 'AVAILABLE',
        pricePerHourPaise: 25000,
        capacity: 4,
        specs: 'Full-size Championship Snooker Table, Shadowless LED Canopy, Premium Cues & Accessories. ₹250/hr (3-4 players), +₹50 per extra person.',
        games: poolDefaultGames.map((g) => g.title),
        gameDetails: poolDefaultGames,
      },
      {
        id: 'station-snooker-03',
        name: 'Snooker Table 3',
        stationType: 'POOL_TABLE',
        status: 'AVAILABLE',
        pricePerHourPaise: 25000,
        capacity: 4,
        specs: 'Full-size Championship Snooker Table, Shadowless LED Canopy, Premium Cues & Accessories. ₹250/hr (3-4 players), +₹50 per extra person.',
        games: poolDefaultGames.map((g) => g.title),
        gameDetails: poolDefaultGames,
      },
    ],
  },
];

export async function GET() {
  try {
    const [facilities, allGames] = await Promise.all([
      prisma.gamingFacility.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
        include: {
          stations: {
            where: {
              status: { notIn: ['DEACTIVATED'] },
            },
            orderBy: {
              displayOrder: 'asc',
            },
          },
        },
      }),
      prisma.game.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
      }).catch(() => []),
    ]);

    if (facilities && facilities.length > 0) {
      // Helper to get games for a station
      const getStationGames = (stId: string, stType: string) => {
        return allGames.filter((g) => {
          if (g.platform !== stType) return false;
          if (!g.stationIds) return true;
          let ids: string[] = [];
          if (Array.isArray(g.stationIds)) ids = g.stationIds as string[];
          else if (typeof g.stationIds === 'string') {
            try { ids = JSON.parse(g.stationIds); } catch { ids = [g.stationIds]; }
          }
          if (ids.length === 0) return true;
          return ids.includes(stId);
        });
      };

      // Map facilities and active stations preserving true database names and orders
      const standardized = facilities.map((fac) => {
        const isPs5 =
          fac.name.toUpperCase().includes('PS5') ||
          (fac.slug && fac.slug.includes('ps5'));

        if (isPs5) {
          const ps5Stations = fac.stations.map((st) => {
            const stGames = getStationGames(st.id, 'PS5');
            const resolvedGames = stGames.length > 0 ? stGames : ps5DefaultGames;
            const gameTitles = resolvedGames.map((g) => g.title);

            return {
              ...st,
              name: st.name,
              stationType: 'PS5',
              pricePerHourPaise: 15000,
              capacity: 4,
              specs:
                (st as any).specs ||
                'Sony PS5, 55" LG OLED 4K 120Hz, DualSense Controllers, SteelSeries 3D Audio. Single ₹150/hr, Duo ₹200/hr, Squad (3-4) ₹250/hr.',
              games: gameTitles,
              gameDetails: resolvedGames,
            };
          });

          return {
            ...fac,
            name: 'PlayStation 5 Arena',
            description:
              '3 PlayStation 5 setups featuring 55-inch 4K 120Hz OLED displays, low-latency HDMI 2.1, Sony DualSense wireless controllers, and competitive gaming headsets. Single player ₹150/hr, 2 players ₹200/hr, 3-4 players ₹250/hr.',
            stations: ps5Stations,
          };
        } else {
          const snookerStations = fac.stations.map((st) => {
            const stGames = getStationGames(st.id, 'POOL_TABLE');
            const resolvedGames = stGames.length > 0 ? stGames : poolDefaultGames;
            const gameTitles = resolvedGames.map((g) => g.title);

            return {
              ...st,
              name: st.name,
              stationType: 'POOL_TABLE',
              pricePerHourPaise: 25000,
              capacity: 4,
              specs:
                (st as any).specs ||
                'Full-size Championship Snooker Table, Shadowless LED Canopy, Premium Cues & Accessories. ₹250/hr (3-4 players), +₹50 per extra person.',
              games: gameTitles,
              gameDetails: resolvedGames,
            };
          });

          return {
            ...fac,
            name: 'Snooker Lounge',
            description:
              '3 championship snooker tables with premium accessories. ₹250/hr per table for 3-4 players, +₹50 per extra person beyond 4.',
            stations: snookerStations,
          };
        }
      });

      return apiSuccess(standardized, 200, {
        'Cache-Control': 'no-store, max-age=0',
      });
    }

    return apiSuccess(process.env.NODE_ENV === 'production' ? [] : DEFAULT_FACILITIES, 200, {
      'Cache-Control': 'no-store, max-age=0',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
