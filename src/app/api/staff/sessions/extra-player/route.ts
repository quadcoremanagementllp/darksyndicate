import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, ForbiddenError, handleApiError, NotFoundError, ValidationError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { canManageStaffSession } from '@/lib/staffSessionRules';
import { z } from 'zod';

const extraPlayerSchema = z.object({
  bookingId: z.string().optional(),
  sessionId: z.string().optional(),
  action: z.enum(['ADD', 'REMOVE']).default('ADD'),
});

export async function POST(req: NextRequest) {
  try {
    const staffSession = await requireRole('STAFF', 'ADMIN', 'SUPER_ADMIN');
    const staffName = `${staffSession.firstName} ${staffSession.lastName}`.trim();
    const body = await req.json();
    const { bookingId, sessionId, action } = extraPlayerSchema.parse(body);

    if (!bookingId && !sessionId) {
      throw new ValidationError('bookingId or sessionId is required');
    }

    // Find booking
    const booking = await prisma.booking.findFirst({
      where: {
        OR: [
          ...(bookingId ? [{ id: bookingId }] : []),
          ...(sessionId && !sessionId.startsWith('active-') && !sessionId.startsWith('bk_')
            ? [{ session: { id: sessionId } }]
            : []),
        ],
      },
      include: {
        station: true,
        session: true,
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking or active session not found');
    }
    if (!canManageStaffSession(staffSession.role, staffSession.userId, booking.session?.staffId)) {
      throw new ForbiddenError('Only the staff member who started this session or an administrator can change its players.');
    }

    const isSnooker =
      booking.station?.stationType === 'POOL_TABLE' ||
      booking.station?.name?.toUpperCase().includes('SNOOKER') ||
      booking.station?.name?.toUpperCase().includes('POOL');

    // Parse current player count from notes
    const playerMatch = booking.notes?.match(/\[Players:\s*(\d+)\]/i);
    const currentCount = playerMatch ? parseInt(playerMatch[1], 10) : (isSnooker ? 4 : 1);

    let newCount = action === 'ADD' ? currentCount + 1 : currentCount - 1;
    if (newCount < 1) newCount = 1;
    if (action === 'REMOVE' && currentCount <= 4 && isSnooker) {
      throw new ValidationError('Cannot remove below 4 base players included for Snooker table');
    }

    // Rate calculation: +₹50 per extra person (5000 paise)
    const extraFeePaise = 5000;
    const deltaPaise = action === 'ADD' ? extraFeePaise : -extraFeePaise;
    const newTotalPricePaise = Math.max(0, booking.totalPricePaise + deltaPaise);

    // Update notes
    let updatedNotes = booking.notes || '';
    if (/\[Players:\s*\d+\]/i.test(updatedNotes)) {
      updatedNotes = updatedNotes.replace(/\[Players:\s*\d+\]/i, `[Players: ${newCount}]`);
    } else {
      updatedNotes = `[Players: ${newCount}]. ` + updatedNotes;
    }
    updatedNotes += ` [${action === 'ADD' ? '+' : '-'}1 Extra Person by ${staffName} (${newCount} total)]`;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update Booking
      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          totalPricePaise: newTotalPricePaise,
          notes: updatedNotes,
        },
      });

      // 2. Update Pending Payment (if on Tab / Pay on Exit)
      const pendingPayment = booking.payments.find((p) => p.status === 'PENDING') || booking.payments[0];
      if (pendingPayment) {
        await tx.payment.update({
          where: { id: pendingPayment.id },
          data: {
            amountPaise: newTotalPricePaise,
            notes: (pendingPayment.notes || '') + ` [Extra person ${action === 'ADD' ? '+₹50' : '-₹50'} by ${staffName}]`,
          },
        });
      }

      // 3. Log Staff Activity
      await tx.staffActivityLog.create({
        data: {
          userId: staffSession.userId,
          action: 'UPDATE_BOOKING',
          entityType: 'BOOKING',
          entityId: booking.id,
          details: `${action === 'ADD' ? 'Added' : 'Removed'} extra person for ${booking.customerName || 'Gamer'} on ${booking.station.name}. Total players: ${newCount}, new bill: ₹${(newTotalPricePaise / 100).toFixed(0)}`,
        },
      });

      return { updatedBooking, newCount, newTotalPricePaise };
    });

    return apiSuccess({
      bookingId: booking.id,
      playerCount: result.newCount,
      totalPricePaise: result.newTotalPricePaise,
      totalPriceRupees: Math.round(result.newTotalPricePaise / 100),
      message: `${action === 'ADD' ? 'Added extra person (+₹50)' : 'Removed extra person (-₹50)'}. Total: ${result.newCount} players.`,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
