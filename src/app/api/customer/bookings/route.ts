import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError, AuthError } from '@/lib/errors';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      throw new AuthError('Please sign in to view your bookings');
    }

    try {
      const bookings = await prisma.booking.findMany({
        where: { userId: session.userId },
        orderBy: { date: 'desc' },
        include: {
          station: {
            include: {
              facility: true,
            },
          },
          payments: true,
        },
      });

      return apiSuccess(bookings);
    } catch (error) {
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}

function getDemoBookings(userId: string) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 2);

  return [
    {
      id: 'book-upcoming-01',
      bookingRef: 'DS-2026-9041',
      userId,
      date: tomorrow.toISOString().split('T')[0],
      startTime: '18:00',
      endTime: '20:00',
      durationMinutes: 120,
      totalPricePaise: 40000, // ₹400
      status: 'CONFIRMED',
      qrToken: 'qr-ds-token-9041-sec782',
      createdAt: new Date().toISOString(),
      station: {
        id: 'station-ps5-01',
        name: 'PS5 Battle Station Alpha',
        stationType: 'PS5',
        facility: {
          name: 'PlayStation 5 Pro Arena',
        },
      },
      payment: {
        status: 'COMPLETED',
        method: 'UPI',
        amountPaise: 40000,
      },
    },
    {
      id: 'book-completed-02',
      bookingRef: 'DS-2026-8812',
      userId,
      date: yesterday.toISOString().split('T')[0],
      startTime: '15:00',
      endTime: '17:00',
      durationMinutes: 120,
      totalPricePaise: 50000, // ₹500
      status: 'COMPLETED',
      qrToken: 'qr-ds-token-8812-fin119',
      createdAt: yesterday.toISOString(),
      station: {
        id: 'station-pool-01',
        name: 'Championship Pool Table 1',
        stationType: 'POOL_TABLE',
        facility: {
          name: 'Billiards & Pool Lounge',
        },
      },
      payment: {
        status: 'COMPLETED',
        method: 'RAZORPAY',
        amountPaise: 50000,
      },
    },
  ];
}
