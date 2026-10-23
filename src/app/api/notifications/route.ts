import { prisma } from '@/lib/prisma';
import { apiSuccess, AuthError, handleApiError } from '@/lib/errors';
import { getSession } from '@/lib/session';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) throw new AuthError();

    const [dbNotifications, unreadDbCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: session.userId },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
      prisma.notification.count({
        where: { userId: session.userId, isRead: false },
      }),
    ]);

    let staffUpcomingNotifs: any[] = [];
    if (session.role === 'STAFF' || session.role === 'ADMIN' || session.role === 'SUPER_ADMIN') {
      const now = new Date();
      const inThirtyMins = new Date(now.getTime() + 30 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      // Find confirmed upcoming bookings for today starting in <= 30 mins or started recently (< 2 hrs ago, pending checkin)
      const nearBookings = await prisma.booking.findMany({
        where: {
          status: 'CONFIRMED',
          startTime: { gte: twoHoursAgo, lte: inThirtyMins },
        },
        include: {
          station: { select: { name: true } },
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: { startTime: 'asc' },
        take: 10,
      });

      staffUpcomingNotifs = nearBookings.map((b) => {
        const customerName = b.customerName || `${b.user?.firstName || 'Gamer'} ${b.user?.lastName || ''}`.trim();
        const startFormatted = new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }).format(new Date(b.startTime));

        const isDueNow = new Date(b.startTime) <= now;
        const diffMins = Math.max(0, Math.round((new Date(b.startTime).getTime() - now.getTime()) / 60000));

        return {
          id: `upcoming-alert-${b.id}`,
          title: isDueNow ? `🚨 Check-In Due: ${b.station?.name}` : `⏰ Upcoming Slot Near: ${b.station?.name}`,
          message: isDueNow
            ? `${customerName} (${b.bookingRef}) is due for check-in at ${startFormatted}. Station ready.`
            : `${customerName} (${b.bookingRef}) slot starts in ${diffMins}m at ${startFormatted}.`,
          type: 'SESSION_REMINDER',
          isRead: false,
          createdAt: b.startTime.toISOString(),
          metadata: { path: '/staff/bookings/in-session', bookingId: b.id },
        };
      });
    }

    const allNotifications = [...staffUpcomingNotifs, ...dbNotifications];
    const totalUnreadCount = unreadDbCount + staffUpcomingNotifs.length;

    return apiSuccess({
      notifications: allNotifications,
      unreadCount: totalUnreadCount,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT() {
  try {
    const session = await getSession();
    if (!session) throw new AuthError();

    const result = await prisma.notification.updateMany({
      where: { userId: session.userId, isRead: false },
      data: { isRead: true },
    });

    return apiSuccess({ message: 'All notifications marked as read', updatedCount: result.count });
  } catch (error) {
    return handleApiError(error);
  }
}
