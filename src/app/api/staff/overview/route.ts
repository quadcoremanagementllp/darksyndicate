import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError } from '@/lib/errors';
import { requireRole } from '@/lib/session';

export async function GET(req: NextRequest) {
  try {
    await requireRole('STAFF', 'ADMIN', 'SUPER_ADMIN');
    try {
      const istOffsetMs = 5.5 * 60 * 60 * 1000;
      const now = new Date();
      const nowIst = new Date(now.getTime() + istOffsetMs);
      const y = nowIst.getUTCFullYear();
      const m = nowIst.getUTCMonth();
      const d = nowIst.getUTCDate();
      const startOfDay = new Date(Date.UTC(y, m, d, 0, 0, 0) - istOffsetMs);
      const endOfDay = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - istOffsetMs);
      const targetDate = new Date(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00.000Z`);
      const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

      // Fetch all active stations and games concurrently
      const [stations, allGames] = await Promise.all([
        prisma.gamingStation.findMany({
          where: { status: { not: 'DEACTIVATED' } },
          include: {
            facility: true,
            sessions: {
              where: { status: { in: ['ACTIVE', 'PAUSED', 'EXTENDED', 'OVERDUE'] } },
              orderBy: { startedAt: 'desc' },
              include: {
                booking: {
                  include: {
                    user: { select: { firstName: true, lastName: true, phone: true } },
                  },
                },
              },
              take: 1,
            },
            bookings: {
              where: {
                AND: [
                  {
                    OR: [
                      { status: { in: ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] } },
                      { status: 'PENDING', createdAt: { gte: fifteenMinutesAgo } },
                    ],
                  },
                  {
                    OR: [
                      { startTime: { lt: endOfDay }, endTime: { gt: startOfDay } },
                      { date: targetDate },
                    ],
                  },
                ],
              },
              orderBy: { startTime: 'asc' },
              take: 20,
              include: {
                user: { select: { firstName: true, lastName: true, phone: true } },
              },
            },
          },
          orderBy: [{ facilityId: 'asc' }, { displayOrder: 'asc' }],
        }),
        prisma.game.findMany({
          where: { isActive: true },
          orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }],
        }).catch(() => []),
      ]);

      if (stations.length > 0) {
        // Calculate overview stats
        let occupiedCount = 0;
        let maintenanceCount = 0;
        let availableCount = 0;

        const formattedStations = stations.map((st) => {
          const activeSession = st.sessions[0];
          const currentBooking = st.bookings.find(
            (b) => new Date(b.startTime) <= now && new Date(b.endTime) > now
          );

          let computedStatus: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'DEACTIVATED' = 'AVAILABLE';

          if (st.status === 'MAINTENANCE') {
            computedStatus = 'MAINTENANCE';
            maintenanceCount++;
          } else if (st.status === 'DEACTIVATED') {
            computedStatus = 'DEACTIVATED';
          } else if (activeSession || currentBooking) {
            computedStatus = 'OCCUPIED';
            occupiedCount++;
          } else {
            computedStatus = 'AVAILABLE';
            availableCount++;
          }

          // Filter games installed on this station
          const stationGames = allGames.filter((g) => {
            if (g.platform !== st.stationType) return false;
            if (!g.stationIds) return true;
            let ids: string[] = [];
            if (Array.isArray(g.stationIds)) ids = g.stationIds as string[];
            else if (typeof g.stationIds === 'string') {
              try { ids = JSON.parse(g.stationIds); } catch { ids = [g.stationIds]; }
            }
            if (ids.length === 0) return true;
            return ids.includes(st.id);
          }).map((g) => ({
            id: g.id,
            title: g.title,
            genre: g.genre,
            coverImage: g.coverImage,
            maxPlayers: g.maxPlayers,
            isFeatured: g.isFeatured,
            description: g.description,
          }));

          const resolvedSession = activeSession
            ? {
                id: activeSession.id,
                bookingId: activeSession.bookingId,
                status: activeSession.status,
                customerName:
                  activeSession.booking?.customerName ||
                  `${activeSession.booking?.user?.firstName || 'Gamer'} ${
                    activeSession.booking?.user?.lastName || ''
                  }`.trim(),
                customerPhone: activeSession.booking?.customerPhone || activeSession.booking?.user?.phone,
                bookingRef: activeSession.booking?.bookingRef,
                startedAt: activeSession.startedAt,
                scheduledEndAt: activeSession.scheduledEndAt,
                extensionMinutes: activeSession.extensionMinutes,
                gameTitle:
                  activeSession.notes ||
                  activeSession.booking?.gameTitle ||
                  (activeSession.booking?.notes?.match(/Game:\s*([^.\n\r\[]+)/)?.[1]?.trim()) ||
                  null,
              }
            : currentBooking
            ? {
                id: `bk_${currentBooking.id}`,
                bookingId: currentBooking.id,
                status: 'ACTIVE',
                customerName:
                  currentBooking.customerName ||
                  `${currentBooking.user?.firstName || 'Gamer'} ${
                    currentBooking.user?.lastName || ''
                  }`.trim(),
                customerPhone: currentBooking.customerPhone || currentBooking.user?.phone,
                bookingRef: currentBooking.bookingRef,
                startedAt: currentBooking.startTime,
                scheduledEndAt: currentBooking.endTime,
                extensionMinutes: 0,
                gameTitle:
                  currentBooking.gameTitle ||
                  (currentBooking.notes?.match(/Game:\s*([^.\n\r\[]+)/)?.[1]?.trim()) ||
                  null,
              }
            : null;

          return {
            id: st.id,
            name: st.name,
            stationType: st.stationType,
            facilityName: st.facility?.name || 'General Arena',
            pricePerHourPaise: st.pricePerHourPaise,
            specs: (st.metadata as any)?.specs || 'Ultra-low latency 4K 120Hz display',
            capacity: (st.metadata as any)?.capacity || (st.stationType === 'PS5' ? 2 : 4),
            status: computedStatus,
            games: stationGames,
            activeSession: resolvedSession,
            upcomingBookings: st.bookings
              .filter(
                (b) =>
                  new Date(b.endTime).getTime() > now.getTime() &&
                  b.id !== currentBooking?.id &&
                  b.id !== activeSession?.bookingId
              )
              .map((b) => ({
                id: b.id,
                bookingRef: b.bookingRef,
                customerName: b.customerName || `${b.user?.firstName || 'Gamer'} ${b.user?.lastName || ''}`.trim(),
                startTime: b.startTime,
                endTime: b.endTime,
                status: b.status,
              })),
          };
        });

        // Compute revenue today (checks both paidAt and createdAt for cash collected today)
        const todayPayments = await prisma.payment.findMany({
          where: {
            status: 'COMPLETED',
            OR: [
              { paidAt: { gte: startOfDay, lte: endOfDay } },
              { paidAt: null, createdAt: { gte: startOfDay, lte: endOfDay } },
            ],
          },
          select: { amountPaise: true },
        });

        const todayRevenuePaise = todayPayments.reduce((sum, p) => sum + p.amountPaise, 0);

        return apiSuccess({
          stats: {
            totalStations: stations.length,
            availableCount,
            occupiedCount,
            maintenanceCount,
            todayRevenuePaise,
          },
          stations: formattedStations,
        });
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'production') throw error;
    }

    if (process.env.NODE_ENV === 'production') {
      return apiSuccess({ stats: { totalStations: 0, availableCount: 0, occupiedCount: 0, maintenanceCount: 0, todayRevenuePaise: 0 }, stations: [] });
    }
    return apiSuccess(getDemoStaffOverview());
  } catch (error) {
    return handleApiError(error);
  }
}

function getDemoStaffOverview() {
  const now = new Date();
  const ps5Start = new Date(now.getTime() - 25 * 60 * 1000);
  const ps5End = new Date(now.getTime() + 95 * 60 * 1000);
  const poolStart = new Date(now.getTime() - 40 * 60 * 1000);
  const poolEnd = new Date(now.getTime() + 20 * 60 * 1000);

  return {
    stats: {
      totalStations: 8,
      availableCount: 5,
      occupiedCount: 2,
      maintenanceCount: 1,
      todayRevenuePaise: 485000, // ₹4,850
    },
    stations: [
      {
        id: 'station-ps5-01',
        name: 'PS5 Battle Station Alpha',
        stationType: 'PS5',
        facilityName: 'PlayStation 5 Pro Arena',
        pricePerHourPaise: 20000,
        specs: 'Sony Bravia XR 65" 4K 120Hz OLED, DualSense Edge Wireless',
        capacity: 2,
        status: 'OCCUPIED',
        activeSession: {
          id: 'sess-01',
          bookingId: 'book-01',
          customerName: 'Alex Mercer',
          customerPhone: '+91 98765 43210',
          bookingRef: 'DS-2026-9041',
          startedAt: ps5Start.toISOString(),
          scheduledEndAt: ps5End.toISOString(),
          extensionMinutes: 0,
        },
        upcomingBookings: [
          {
            id: 'book-up-01',
            bookingRef: 'DS-2026-9110',
            customerName: 'Rohit Sharma',
            startTime: new Date(now.getTime() + 120 * 60 * 1000).toISOString(),
            endTime: new Date(now.getTime() + 240 * 60 * 1000).toISOString(),
            status: 'CONFIRMED',
          },
        ],
      },
      {
        id: 'station-ps5-02',
        name: 'PS5 Battle Station Beta',
        stationType: 'PS5',
        facilityName: 'PlayStation 5 Pro Arena',
        pricePerHourPaise: 20000,
        specs: 'Sony Bravia XR 65" 4K 120Hz OLED, Pulse 3D Wireless Headset',
        capacity: 2,
        status: 'AVAILABLE',
        activeSession: null,
        upcomingBookings: [],
      },
      {
        id: 'station-ps5-03',
        name: 'PS5 Battle Station Gamma',
        stationType: 'PS5',
        facilityName: 'PlayStation 5 Pro Arena',
        pricePerHourPaise: 20000,
        specs: 'Sony Bravia XR 65" 4K 120Hz OLED, 2x DualSense Controllers',
        capacity: 2,
        status: 'AVAILABLE',
        activeSession: null,
        upcomingBookings: [],
      },
      {
        id: 'station-ps5-04',
        name: 'PS5 Quad Lounge Titan',
        stationType: 'PS5',
        facilityName: 'PlayStation 5 Pro Arena',
        pricePerHourPaise: 35000,
        specs: '75" 4K 120Hz Mini-LED, 4x DualSense Wireless Controllers, Plush Couch',
        capacity: 4,
        status: 'MAINTENANCE',
        activeSession: null,
        upcomingBookings: [],
      },
      {
        id: 'station-ps5-05',
        name: 'PS5 Battle Station Omega',
        stationType: 'PS5',
        facilityName: 'PlayStation 5 Pro Arena',
        pricePerHourPaise: 20000,
        specs: 'Sony Bravia XR 65" 4K 120Hz OLED, DualSense Edge Wireless',
        capacity: 2,
        status: 'AVAILABLE',
        activeSession: null,
        upcomingBookings: [],
      },
      {
        id: 'station-pool-01',
        name: 'Championship Pool Table 1',
        stationType: 'POOL_TABLE',
        facilityName: 'Billiards & Pool Lounge',
        pricePerHourPaise: 25000,
        specs: '9ft Tournament Slate Table, Simonis 860 Tournament Cloth, Aramith Pro Balls',
        capacity: 4,
        status: 'OCCUPIED',
        activeSession: {
          id: 'sess-02',
          bookingId: 'book-02',
          customerName: 'Karthik Raja',
          customerPhone: '+91 94440 12345',
          bookingRef: 'DS-2026-8812',
          startedAt: poolStart.toISOString(),
          scheduledEndAt: poolEnd.toISOString(),
          extensionMinutes: 0,
        },
        upcomingBookings: [],
      },
      {
        id: 'station-pool-02',
        name: 'Championship Pool Table 2',
        stationType: 'POOL_TABLE',
        facilityName: 'Billiards & Pool Lounge',
        pricePerHourPaise: 25000,
        specs: '9ft Tournament Slate Table, Predator Carbon Fiber Cues',
        capacity: 4,
        status: 'AVAILABLE',
        activeSession: null,
        upcomingBookings: [],
      },
      {
        id: 'station-pool-03',
        name: 'English Snooker Table',
        stationType: 'POOL_TABLE',
        facilityName: 'Billiards & Pool Lounge',
        pricePerHourPaise: 30000,
        specs: '12ft Full Size Tournament Snooker Slate Table with Northern Rubber Cushions',
        capacity: 4,
        status: 'AVAILABLE',
        activeSession: null,
        upcomingBookings: [],
      },
    ],
  };
}
