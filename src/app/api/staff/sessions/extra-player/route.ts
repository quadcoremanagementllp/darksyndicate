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

    if (action === 'REMOVE' && currentCount <= 1) {
      throw new ValidationError('Cannot reduce below 1 player');
    }

    const newCount = action === 'ADD' ? currentCount + 1 : Math.max(1, currentCount - 1);

    // Rate calculation:
    // For Snooker tables, the base table rate includes up to 4 players.
    // An extra fee of ₹50 (5000 paise) is only charged for members ABOVE 4 (5th, 6th, etc.).
    let deltaPaise = 0;
    if (isSnooker) {
      if (action === 'ADD') {
        deltaPaise = currentCount >= 4 ? 5000 : 0;
      } else {
        deltaPaise = currentCount > 4 ? -5000 : 0;
      }
    } else {
      deltaPaise = action === 'ADD' ? 5000 : -5000;
    }

    const newTotalPricePaise = Math.max(0, booking.totalPricePaise + deltaPaise);

    // Update notes
    let updatedNotes = booking.notes || '';
    if (/\[Players:\s*\d+\]/i.test(updatedNotes)) {
      updatedNotes = updatedNotes.replace(/\[Players:\s*\d+\]/i, `[Players: ${newCount}]`);
    } else {
      updatedNotes = `[Players: ${newCount}]. ` + updatedNotes;
    }
    const deltaNote =
      deltaPaise !== 0
        ? ` (${deltaPaise > 0 ? '+₹' : '-₹'}${Math.abs(deltaPaise / 100)})`
        : ' (Base included)';
    updatedNotes += ` [${action === 'ADD' ? '+' : '-'}1 Person by ${staffName} (${newCount} total${deltaNote})]`;

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
        const paymentDeltaText =
          deltaPaise !== 0
            ? ` [Extra person ${deltaPaise > 0 ? '+₹50' : '-₹50'} by ${staffName}]`
            : ` [Player count adjusted to ${newCount} by ${staffName}]`;
        await tx.payment.update({
          where: { id: pendingPayment.id },
          data: {
            amountPaise: newTotalPricePaise,
            notes: (pendingPayment.notes || '') + paymentDeltaText,
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
          details: {
            action,
            note: `${action === 'ADD' ? 'Added' : 'Removed'} person for ${booking.customerName || 'Gamer'} on ${booking.station.name}. Total players: ${newCount}, bill: ₹${(newTotalPricePaise / 100).toFixed(0)}${deltaNote}`,
            playerCount: newCount,
            deltaPaise,
            totalPricePaise: newTotalPricePaise,
          },
        },
      }).catch(() => {});

      return { updatedBooking, newCount, newTotalPricePaise };
    });

    const feeMessage =
      deltaPaise > 0
        ? `Added extra person (+₹${deltaPaise / 100})`
        : deltaPaise < 0
        ? `Removed extra person (-₹${Math.abs(deltaPaise / 100)})`
        : action === 'ADD'
        ? 'Player added (included in base rate)'
        : 'Player removed (base rate)';

    return apiSuccess({
      bookingId: booking.id,
      playerCount: result.newCount,
      totalPricePaise: result.newTotalPricePaise,
      totalPriceRupees: Math.round(result.newTotalPricePaise / 100),
      deltaPaise,
      message: `${feeMessage}. Total: ${result.newCount} players.`,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
