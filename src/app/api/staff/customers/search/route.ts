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

    // Determine search targets
    const cleanQ = query.trim();
    const targetPhone = phoneParam || (cleanQ.replace(/\D/g, '').length >= 4 ? cleanQ : '');
    const phoneDigits = targetPhone.replace(/\D/g, '').slice(-10);
    const searchTerm = cleanQ ? `%${cleanQ}%` : '%';
    const phoneTerm = phoneDigits.length >= 4 ? `%${phoneDigits}%` : searchTerm;
    const emailSearch = emailParam || (cleanQ.includes('@') ? cleanQ.toLowerCase() : '');

    // 1. Matched Users via Raw Query (Bypasses MariaDB collation 1267 error)
    const matchedUsers = await prisma.$queryRaw<Array<{
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      phone: string | null;
      total_bookings: number | null;
    }>>`
      SELECT 
        u.id, 
        u.first_name, 
        u.last_name, 
        u.email, 
        u.phone,
        cp.total_bookings
      FROM users u
      LEFT JOIN customer_profiles cp ON u.id = cp.user_id
      WHERE u.role = 'CUSTOMER'
        AND u.email != 'guest@darksyndicate.in'
        AND (
          (${cleanQ !== ''} AND (u.first_name LIKE ${searchTerm} OR u.last_name LIKE ${searchTerm}))
          OR (${phoneDigits.length >= 4} AND u.phone LIKE ${phoneTerm})
          OR (${emailSearch !== ''} AND u.email = ${emailSearch})
        )
      LIMIT 8
    `.catch(() => []);

    // 2. Matched Bookings via Raw Query (Past walk-in and phone bookings)
    const matchedBookings = await prisma.$queryRaw<Array<{
      id: string;
      user_id: string;
      customer_name: string | null;
      customer_phone: string | null;
      game_title: string | null;
      station_name: string | null;
      created_at: Date;
      u_first_name: string | null;
      u_last_name: string | null;
      u_email: string | null;
      u_phone: string | null;
    }>>`
      SELECT 
        b.id,
        b.user_id,
        b.customer_name,
        b.customer_phone,
        b.game_title,
        s.name AS station_name,
        b.created_at,
        u.first_name AS u_first_name,
        u.last_name AS u_last_name,
        u.email AS u_email,
        u.phone AS u_phone
      FROM bookings b
      LEFT JOIN gaming_stations s ON b.station_id = s.id
      LEFT JOIN users u ON b.user_id = u.id
      WHERE b.status IN ('COMPLETED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
        AND (
          (${cleanQ !== ''} AND b.customer_name IS NOT NULL AND b.customer_name NOT IN ('Walk-in Guest', 'Guest', 'Gamer', 'Guest Player', '') AND b.customer_name LIKE ${searchTerm})
          OR (${phoneDigits.length >= 4} AND b.customer_phone IS NOT NULL AND b.customer_phone LIKE ${phoneTerm})
          OR (${cleanQ !== ''} AND u.first_name IS NOT NULL AND u.first_name LIKE ${searchTerm})
        )
      ORDER BY b.created_at DESC
      LIMIT 15
    `.catch(() => []);

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
      const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Gamer';
      const cleanPhone = cleanPhoneDigits(u.phone);
      const key = cleanPhone || `name_${fullName.toLowerCase()}`;

      // Get recent booking for this user
      const recentBookings = await prisma.$queryRaw<Array<{
        game_title: string | null;
        station_name: string | null;
        created_at: Date;
      }>>`
        SELECT b.game_title, s.name AS station_name, b.created_at
        FROM bookings b
        LEFT JOIN gaming_stations s ON b.station_id = s.id
        WHERE b.user_id = ${u.id}
          AND b.status IN ('COMPLETED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
        ORDER BY b.created_at DESC
        LIMIT 1
      `.catch(() => []);
      const lastBooking = recentBookings[0];

      const activeMem = await getActiveUserMembership(u.id).catch(() => null);

      resultMap.set(key, {
        id: u.id,
        name: fullName,
        firstName: u.first_name,
        lastName: u.last_name,
        email: u.email && !u.email.includes('@darksyndicate.in') ? u.email : '',
        phone: u.phone,
        totalBookings: Math.max(u.total_bookings || 0, recentBookings.length ? 1 : 0),
        lastPlayed: lastBooking ? (lastBooking.game_title || lastBooking.station_name || null) : null,
        lastPlayedDate: lastBooking ? formatPlayedDate(new Date(lastBooking.created_at)) : null,
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
      const rawName = (b.customer_name || `${b.u_first_name || ''} ${b.u_last_name || ''}`).trim();
      if (!rawName || rawName.toLowerCase() === 'walk-in guest') continue;

      const rawPhone = b.customer_phone || b.u_phone || null;
      const cleanPhone = cleanPhoneDigits(rawPhone);
      const key = cleanPhone || `name_${rawName.toLowerCase()}`;

      const existing = resultMap.get(key);
      if (existing) {
        existing.totalBookings = (existing.totalBookings || 1) + 1;
        if (!existing.lastPlayed) {
          existing.lastPlayed = b.game_title || b.station_name || null;
          existing.lastPlayedDate = formatPlayedDate(new Date(b.created_at));
        }
      } else {
        const activeMem = b.user_id ? await getActiveUserMembership(b.user_id).catch(() => null) : null;
        resultMap.set(key, {
          id: b.user_id || `bk_${b.id}`,
          name: rawName,
          firstName: rawName.split(' ')[0] || null,
          lastName: rawName.split(' ').slice(1).join(' ') || null,
          email: b.u_email && !b.u_email.includes('@darksyndicate.in') ? b.u_email : '',
          phone: rawPhone,
          totalBookings: 1,
          lastPlayed: b.game_title || b.station_name || null,
          lastPlayedDate: formatPlayedDate(new Date(b.created_at)),
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
