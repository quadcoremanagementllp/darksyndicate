import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { getActiveUserMembership } from '@/lib/memberships';

function cleanPhoneDigits(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function formatPlayedDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

export async function GET(req: NextRequest) {
  try {
    await requireRole('STAFF', 'ADMIN', 'SUPER_ADMIN');
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get('q') || searchParams.get('search') || '').trim();
    const phoneParam = (searchParams.get('phone') || '').trim();
    const emailParam = (searchParams.get('email') || '').trim().toLowerCase();

    if (!query && !phoneParam && !emailParam) {
      return apiSuccess([]);
    }

    // Determine phone candidates
    const targetPhone = phoneParam || (query.replace(/\D/g, '').length >= 4 ? query : '');
    const phoneDigits = targetPhone.replace(/\D/g, '').slice(-10);
    const phoneCandidates =
      phoneDigits.length === 10
        ? [phoneDigits, `+91${phoneDigits}`, `91${phoneDigits}`, `0${phoneDigits}`, `+91 ${phoneDigits}`]
        : phoneDigits.length >= 4
        ? [phoneDigits, `+91${phoneDigits}`, `91${phoneDigits}`]
        : [];

    // Build conditions for User table search
    const userOrConditions: any[] = [];
    if (phoneCandidates.length > 0) {
      userOrConditions.push({ phone: { in: phoneCandidates } });
    }
    if (emailParam) {
      userOrConditions.push({ email: emailParam });
    } else if (query.includes('@')) {
      userOrConditions.push({ email: query.toLowerCase() });
    }
    if (query && !query.includes('@')) {
      userOrConditions.push({ firstName: { contains: query } });
      userOrConditions.push({ lastName: { contains: query } });
    }

    // Build conditions for Booking table search (to find walk-in players who played previously)
    const bookingOrConditions: any[] = [];
    if (query && !query.includes('@')) {
      bookingOrConditions.push({ customerName: { contains: query } });
    }
    if (phoneCandidates.length > 0) {
      bookingOrConditions.push({ customerPhone: { in: phoneCandidates } });
    }

    // Execute User and Booking queries concurrently
    const [matchedUsers, matchedBookings] = await Promise.all([
      userOrConditions.length > 0
        ? prisma.user.findMany({
            where: {
              role: 'CUSTOMER',
              email: { not: 'guest@darksyndicate.in' },
              OR: userOrConditions,
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              customerProfile: { select: { totalBookings: true } },
              bookings: {
                where: { status: { in: ['COMPLETED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] } },
                select: {
                  id: true,
                  gameTitle: true,
                  createdAt: true,
                  station: { select: { name: true, stationType: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
            take: 8,
          }).catch(() => [])
        : Promise.resolve([]),
      bookingOrConditions.length > 0
        ? prisma.booking.findMany({
            where: {
              status: { in: ['COMPLETED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] },
              AND: [
                {
                  customerName: {
                    not: null,
                    notIn: ['Walk-in Guest', 'Guest', 'Gamer', 'Guest Player', ''],
                  },
                },
                { OR: bookingOrConditions },
              ],
            },
            select: {
              id: true,
              customerName: true,
              customerPhone: true,
              gameTitle: true,
              createdAt: true,
              station: { select: { name: true, stationType: true } },
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
            orderBy: { createdAt: 'desc' },
            take: 15,
          }).catch(() => [])
        : Promise.resolve([]),
    ]);

    interface SearchResultItem {
      id: string;
      name: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
      phone: string | null;
      totalBookings: number;
      lastPlayed: string | null;
      lastPlayedDate: string | null;
      membership: {
        id: string;
        tier: string;
        planName: string;
        discountPercent: number;
        badgeColor: string | null;
        expiresAt: string;
      } | null;
    }

    const resultMap = new Map<string, SearchResultItem>();

    // 1. Process registered matched users
    for (const u of matchedUsers) {
      const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Gamer';
      const cleanPhone = cleanPhoneDigits(u.phone);
      const key = cleanPhone || `name_${fullName.toLowerCase()}`;

      const lastBooking = u.bookings?.[0];
      const activeMem = await getActiveUserMembership(u.id).catch(() => null);

      resultMap.set(key, {
        id: u.id,
        name: fullName,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email && !u.email.includes('@darksyndicate.in') ? u.email : '',
        phone: u.phone,
        totalBookings: Math.max(u.customerProfile?.totalBookings || 0, u.bookings?.length || 0),
        lastPlayed: lastBooking ? (lastBooking.gameTitle || lastBooking.station?.name || null) : null,
        lastPlayedDate: lastBooking ? formatPlayedDate(lastBooking.createdAt) : null,
        membership: activeMem
          ? {
              id: activeMem.id,
              tier: activeMem.plan.tier,
              planName: activeMem.plan.name,
              discountPercent: activeMem.plan.discountPercent,
              badgeColor: activeMem.plan.badgeColor,
              expiresAt: activeMem.expiresAt.toISOString(),
            }
          : null,
      });
    }

    // 2. Process matched bookings from past games (walk-ins / phone bookings)
    for (const b of matchedBookings) {
      const rawName = (b.customerName || `${b.user?.firstName || ''} ${b.user?.lastName || ''}`).trim();
      if (!rawName || rawName.toLowerCase() === 'walk-in guest') continue;

      const rawPhone = b.customerPhone || b.user?.phone || null;
      const cleanPhone = cleanPhoneDigits(rawPhone);
      const key = cleanPhone || `name_${rawName.toLowerCase()}`;

      const existing = resultMap.get(key);
      if (existing) {
        existing.totalBookings = (existing.totalBookings || 1) + 1;
        if (!existing.lastPlayed) {
          existing.lastPlayed = b.gameTitle || b.station?.name || null;
          existing.lastPlayedDate = formatPlayedDate(b.createdAt);
        }
      } else {
        const activeMem = b.user?.id ? await getActiveUserMembership(b.user.id).catch(() => null) : null;
        resultMap.set(key, {
          id: b.user?.id || `bk_${b.id}`,
          name: rawName,
          firstName: rawName.split(' ')[0] || null,
          lastName: rawName.split(' ').slice(1).join(' ') || null,
          email: b.user?.email && !b.user.email.includes('@darksyndicate.in') ? b.user.email : '',
          phone: rawPhone,
          totalBookings: 1,
          lastPlayed: b.gameTitle || b.station?.name || null,
          lastPlayedDate: formatPlayedDate(b.createdAt),
          membership: activeMem
            ? {
                id: activeMem.id,
                tier: activeMem.plan.tier,
                planName: activeMem.plan.name,
                discountPercent: activeMem.plan.discountPercent,
                badgeColor: activeMem.plan.badgeColor,
                expiresAt: activeMem.expiresAt.toISOString(),
              }
            : null,
        });
      }
    }

    const results = Array.from(resultMap.values()).slice(0, 8);
    return apiSuccess(results);
  } catch (error) {
    return handleApiError(error);
  }
}
