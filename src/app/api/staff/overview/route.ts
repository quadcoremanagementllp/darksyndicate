import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { canManageStaffSession } from '@/lib/staffSessionRules';

export async function GET(req: NextRequest) {
  try {
    const viewer = await requireRole('STAFF', 'ADMIN', 'SUPER_ADMIN');
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

      // Fetch all active stations, games, and today's pending payments concurrently
      const [stations, allGames, todayPendingPayments] = await Promise.all([
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
                    payments: {
                      select: { id: true, amountPaise: true, status: true, method: true },
                      orderBy: { createdAt: 'desc' },
                      take: 10,
                    },
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
                payments: {
                  select: { id: true, amountPaise: true, status: true, method: true },
                  orderBy: { createdAt: 'desc' },
                  take: 10,
                },
              },
            },
          },
          orderBy: [{ facilityId: 'asc' }, { displayOrder: 'asc' }],
        }),
        prisma.game.findMany({
          where: { isActive: true },
          orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }],
        }).catch(() => []),
        prisma.payment.findMany({
          where: {
            status: 'PENDING',
            booking: {
              OR: [
                { date: targetDate },
                { startTime: { gte: startOfDay, lte: endOfDay } },
                { createdAt: { gte: startOfDay, lte: endOfDay } },
              ],
            },
          },
          include: {
            booking: {
              include: {
                station: { select: { id: true, name: true, stationType: true } },
                user: { select: { id: true, firstName: true, lastName: true, phone: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }).catch(() => []),
      ]);

      if (stations.length > 0) {
        // Calculate overview stats
        let occupiedCount = 0;
        let maintenanceCount = 0;
        let availableCount = 0;

        // Group today's pending payments by bookingId
        interface PendingBookingSummary {
          bookingId: string;
          bookingRef: string;
          stationId: string;
          stationName: string;
          stationType: string;
          gameTitle: string | null;
          customerName: string;
          customerPhone: string | null;
          userId: string;
          amountPaise: number;
          createdAt: Date;
        }

        const pendingByBooking = new Map<string, PendingBookingSummary>();
        for (const p of todayPendingPayments) {
          if (!p.bookingId || !p.booking) continue;
          const existing = pendingByBooking.get(p.bookingId);
          const custName =
            p.booking.customerName ||
            `${p.booking.user?.firstName || 'Gamer'} ${p.booking.user?.lastName || ''}`.trim();
          const custPhone = p.booking.customerPhone || p.booking.user?.phone || null;

          if (existing) {
            existing.amountPaise += p.amountPaise;
          } else {
            pendingByBooking.set(p.bookingId, {
              bookingId: p.bookingId,
              bookingRef: p.booking.bookingRef,
              stationId: p.booking.stationId,
              stationName: p.booking.station?.name || 'Previous Console',
              stationType: p.booking.station?.stationType || 'PS5',
              gameTitle: p.booking.gameTitle || null,
              customerName: custName,
              customerPhone: custPhone,
              userId: p.booking.userId,
              amountPaise: p.amountPaise,
              createdAt: p.booking.createdAt,
            });
          }
        }

        const linkedBookingIds = new Set<string>();

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

          // Calculate payment & tab status for active session
          const activePayments = activeSession?.booking?.payments || [];
          const activeHasPending =
            activePayments.some((p) => p.status === 'PENDING') ||
            Boolean(activeSession?.notes?.includes('[PAY ON EXIT]')) ||
            Boolean(activeSession?.booking?.notes?.includes('[PAY ON EXIT]'));
          const activePaidPaise = activePayments
            .filter((p) => p.status === 'COMPLETED')
            .reduce((sum, p) => sum + p.amountPaise, 0);
          const activeTotalPaise = activeSession?.booking?.totalPricePaise || 0;
          const activeUnpaidPaise = activeHasPending
            ? Math.max(0, activeTotalPaise - activePaidPaise)
            : 0;
          const activeLatestPayment = activePayments[0];

          // Sanitize gameTitle: strip any '[PAY ON EXIT]' tags so it is never displayed as a game title
          let activeGameTitle = activeSession?.booking?.gameTitle || null;
          if (!activeGameTitle && activeSession?.notes) {
            const stripped = activeSession.notes.replace(/\[PAY ON EXIT\]/gi, '').trim();
            if (stripped) activeGameTitle = stripped;
          }
          if (!activeGameTitle && activeSession?.booking?.notes) {
            const match = activeSession.booking.notes.match(/Game:\s*([^.\n\r\[]+)/);
            if (match?.[1]?.trim()) activeGameTitle = match[1].trim();
          }

          // Same for current booking fallback
          const currentPayments = currentBooking?.payments || [];
          const currentHasPending =
            currentPayments.some((p) => p.status === 'PENDING') ||
            Boolean(currentBooking?.notes?.includes('[PAY ON EXIT]'));
          const currentPaidPaise = currentPayments
            .filter((p) => p.status === 'COMPLETED')
            .reduce((sum, p) => sum + p.amountPaise, 0);
          const currentTotalPaise = currentBooking?.totalPricePaise || 0;
          const currentUnpaidPaise = currentHasPending
            ? Math.max(0, currentTotalPaise - currentPaidPaise)
            : 0;
          const currentLatestPayment = currentPayments[0];

          let currentGameTitle = currentBooking?.gameTitle || null;
          if (!currentGameTitle && currentBooking?.notes) {
            const match = currentBooking.notes.match(/Game:\s*([^.\n\r\[]+)/);
            if (match?.[1]?.trim()) currentGameTitle = match[1].trim();
          }

          const isPool =
            st.stationType === 'POOL_TABLE' ||
            st.name.toUpperCase().includes('SNOOKER') ||
            st.name.toUpperCase().includes('POOL');

          const rawNotes = activeSession?.booking?.notes || activeSession?.notes || currentBooking?.notes || '';
          const playerMatch = rawNotes.match(/\[Players:\s*(\d+)\]/i);
          const currentPlayers = playerMatch ? parseInt(playerMatch[1], 10) : (isPool ? 4 : 1);

          const resolvedSession = activeSession
            ? {
                id: activeSession.id,
                staffId: activeSession.staffId,
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
                paymentStatus: activeHasPending ? 'PENDING' : 'COMPLETED',
                paymentMethod: activeLatestPayment?.method || 'CASH',
                isPayOnExit: Boolean(activeHasPending),
                totalPricePaise: activeTotalPaise,
                paidPaise: activePaidPaise,
                unpaidPaise: activeUnpaidPaise,
                gameTitle: isPool ? null : activeGameTitle,
                playerCount: currentPlayers,
                isPool,
                priorPendingTabs: [] as Array<{
                  bookingId: string;
                  bookingRef: string;
                  stationName: string;
                  stationType: string;
                  gameTitle: string | null;
                  amountPaise: number;
                }>,
                priorUnpaidPaise: 0,
              }
            : currentBooking
            ? {
                id: `bk_${currentBooking.id}`,
                staffId: null,
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
                paymentStatus: currentHasPending ? 'PENDING' : 'COMPLETED',
                paymentMethod: currentLatestPayment?.method || 'CASH',
                isPayOnExit: Boolean(currentHasPending),
                totalPricePaise: currentTotalPaise,
                paidPaise: currentPaidPaise,
                unpaidPaise: currentUnpaidPaise,
                gameTitle: isPool ? null : currentGameTitle,
                playerCount: currentPlayers,
                isPool,
                priorPendingTabs: [] as Array<{
                  bookingId: string;
                  bookingRef: string;
                  stationName: string;
                  stationType: string;
                  gameTitle: string | null;
                  amountPaise: number;
                }>,
                priorUnpaidPaise: 0,
              }
            : null;

          // Connect multi-game carried-over tabs (e.g. PS5 unpaid tab carried over to Snooker)
          if (resolvedSession) {
            linkedBookingIds.add(resolvedSession.bookingId);
            const sessionBooking = activeSession?.booking || currentBooking;
            const currentUserId = sessionBooking?.userId;
            const currentPhoneRaw = sessionBooking?.customerPhone || (sessionBooking as any)?.user?.phone || '';
            const currentPhoneDigits = currentPhoneRaw.replace(/\D/g, '').slice(-10);
            const currentNameRaw = (
              sessionBooking?.customerName ||
              `${(sessionBooking as any)?.user?.firstName || ''} ${(sessionBooking as any)?.user?.lastName || ''}`
            ).trim().toLowerCase();

            const priorTabs: Array<{
              bookingId: string;
              bookingRef: string;
              stationName: string;
              stationType: string;
              gameTitle: string | null;
              amountPaise: number;
            }> = [];

            for (const [bId, pb] of pendingByBooking.entries()) {
              if (bId === resolvedSession.bookingId) continue;

              const pbPhoneDigits = (pb.customerPhone || '').replace(/\D/g, '').slice(-10);
              const pbName = (pb.customerName || '').trim().toLowerCase();

              const isMatch =
                (currentPhoneDigits.length === 10 && pbPhoneDigits === currentPhoneDigits) ||
                (currentUserId && pb.userId === currentUserId && currentUserId !== 'guest') ||
                (currentNameRaw.length >= 2 && pbName === currentNameRaw);

              if (isMatch) {
                priorTabs.push({
                  bookingId: pb.bookingId,
                  bookingRef: pb.bookingRef,
                  stationName: pb.stationName,
                  stationType: pb.stationType,
                  gameTitle: pb.gameTitle,
                  amountPaise: pb.amountPaise,
                });
                linkedBookingIds.add(bId);
              }
            }

            const priorUnpaid = priorTabs.reduce((sum, tab) => sum + tab.amountPaise, 0);
            resolvedSession.priorPendingTabs = priorTabs;
            resolvedSession.priorUnpaidPaise = priorUnpaid;
            if (priorUnpaid > 0) {
              resolvedSession.isPayOnExit = true;
              resolvedSession.paymentStatus = 'PENDING';
              resolvedSession.unpaidPaise = (resolvedSession.unpaidPaise || 0) + priorUnpaid;
            }
          }

          return {
            id: st.id,
            name: st.name,
            stationType: st.stationType,
            facilityName: st.facility?.name || 'General Arena',
            imageUrl: st.stationType === 'PS5' ? '/ps5-station.jpg' : '/snooker-table.jpg',
            pricePerHourPaise: st.pricePerHourPaise,
            specs: isPool ? '' : ((st.metadata as any)?.specs || (st.stationType === 'PS5' ? '4K 120Hz OLED Display' : '')),
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

        if (req.nextUrl.searchParams.get('scope') === 'alerts') {
          return apiSuccess({
            stations: formattedStations
              .filter((station) => station.activeSession && canManageStaffSession(viewer.role, viewer.userId, station.activeSession.staffId))
              .map((station) => ({
                id: station.id,
                name: station.name,
                stationType: station.stationType,
                pricePerHourPaise: station.pricePerHourPaise,
                activeSession: station.activeSession,
              })),
          });
        }

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

        // All guest tabs with unpaid balances that are currently between games (not on an active station)
        const openGuestTabs = Array.from(pendingByBooking.values())
          .filter((pb) => !linkedBookingIds.has(pb.bookingId))
          .map((pb) => ({
            bookingId: pb.bookingId,
            bookingRef: pb.bookingRef,
            stationId: pb.stationId,
            stationName: pb.stationName,
            stationType: pb.stationType,
            gameTitle: pb.gameTitle,
            customerName: pb.customerName,
            customerPhone: pb.customerPhone,
            amountPaise: pb.amountPaise,
            createdAt: pb.createdAt.toISOString(),
          }));

        return apiSuccess({
          stats: {
            totalStations: stations.length,
            availableCount,
            occupiedCount,
            maintenanceCount,
            todayRevenuePaise,
          },
          stations: formattedStations,
          openGuestTabs,
        });
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'production') throw error;
    }

    if (process.env.NODE_ENV === 'production') {
      return apiSuccess({ stats: { totalStations: 0, availableCount: 0, occupiedCount: 0, maintenanceCount: 0, todayRevenuePaise: 0 }, stations: [], openGuestTabs: [] });
    }
    if (req.nextUrl.searchParams.get('scope') === 'alerts') return apiSuccess({ stations: [] });
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
    openGuestTabs: [],
  };
}
