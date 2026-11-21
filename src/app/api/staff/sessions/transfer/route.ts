import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError, NotFoundError, ValidationError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { canManageStaffSession, sessionHourlyRatePaise, sessionPlayerCount } from '@/lib/staffSessionRules';
import { getActiveUserMembership } from '@/lib/memberships';
import { z } from 'zod';
import crypto from 'crypto';

const transferSessionSchema = z.object({
  fromSessionId: z.string().optional(),
  fromStationId: z.string().optional(),
  fromBookingId: z.string().optional(),
  extraMinutes: z.number().int().min(0).default(0),
  chargeOvertime: z.boolean().default(true),
  targetStationId: z.string().min(1, 'Target station is required'),
  durationMinutes: z.number().int().min(15).default(60),
  playerCount: z.number().int().min(1).max(10).default(1),
  gameTitle: z.string().optional().or(z.literal('')),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const staffSession = await requireRole('STAFF', 'ADMIN', 'SUPER_ADMIN');
    const staffName = `${staffSession.firstName} ${staffSession.lastName}`.trim();
    const body = await req.json();
    const data = transferSessionSchema.parse(body);

    if (!data.fromSessionId && !data.fromStationId && !data.fromBookingId) {
      throw new ValidationError('Source sessionId, stationId, or bookingId is required to transfer');
    }

    const now = new Date();
    const scheduledEndAt = new Date(now.getTime() + data.durationMinutes * 60 * 1000);
    const todayDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0));

    // 1. Resolve source session & booking
    let sourceSession = null;
    if (
      data.fromSessionId &&
      !data.fromSessionId.startsWith('active-') &&
      !data.fromSessionId.startsWith('pseudo-') &&
      !data.fromSessionId.startsWith('bk_')
    ) {
      sourceSession = await prisma.gamingSession.findUnique({
        where: { id: data.fromSessionId },
        include: { station: true, booking: { include: { payments: true, user: true } } },
      });
    }

    if (!sourceSession && data.fromBookingId) {
      sourceSession = await prisma.gamingSession.findFirst({
        where: {
          bookingId: data.fromBookingId,
          status: { in: ['ACTIVE', 'PAUSED', 'EXTENDED', 'OVERDUE'] },
        },
        include: { station: true, booking: { include: { payments: true, user: true } } },
      });
      if (!sourceSession) {
        sourceSession = await prisma.gamingSession.findFirst({
          where: { bookingId: data.fromBookingId },
          include: { station: true, booking: { include: { payments: true, user: true } } },
        });
      }
    }

    if (!sourceSession && data.fromStationId) {
      sourceSession = await prisma.gamingSession.findFirst({
        where: {
          stationId: data.fromStationId,
          status: { in: ['ACTIVE', 'PAUSED', 'EXTENDED', 'OVERDUE'] },
        },
        include: { station: true, booking: { include: { payments: true, user: true } } },
      });
    }

    // Fallback: If no GamingSession row was found, locate the active Booking directly
    const fallbackBooking = (!sourceSession && data.fromBookingId)
      ? await prisma.booking.findUnique({
          where: { id: data.fromBookingId },
          include: { station: true, payments: true, user: true },
        })
      : null;

    const sourceBooking = sourceSession?.booking || fallbackBooking;
    if (!sourceBooking) {
      throw new NotFoundError('Source session or booking not found to transfer from');
    }

    const sourceStationId = sourceSession?.stationId || data.fromStationId || sourceBooking.stationId;
    const sourceStation = sourceSession?.station || fallbackBooking?.station || await prisma.gamingStation.findUnique({
      where: { id: sourceStationId },
    });

    if (!sourceStation) {
      throw new NotFoundError('Source gaming station not found');
    }

    if (sourceSession && !canManageStaffSession(staffSession.role, staffSession.userId, sourceSession.staffId)) {
      throw new ValidationError('Only the staff member who started this session or an administrator can transfer it.');
    }

    // 2. Resolve & validate destination station
    if (data.targetStationId === sourceStation.id) {
      throw new ValidationError('Cannot transfer to the same station. Choose a different station.');
    }

    const targetStation = await prisma.gamingStation.findUnique({
      where: { id: data.targetStationId },
      include: { facility: true },
    });

    if (!targetStation) {
      throw new NotFoundError('Target gaming station not found');
    }

    if (targetStation.status === 'MAINTENANCE' || targetStation.status === 'DEACTIVATED') {
      throw new ValidationError(`Target station ${targetStation.name} is currently ${targetStation.status.toLowerCase()}`);
    }

    const targetActiveSession = await prisma.gamingSession.findFirst({
      where: {
        stationId: targetStation.id,
        status: { in: ['ACTIVE', 'PAUSED', 'EXTENDED', 'OVERDUE'] },
      },
    });

    if (targetActiveSession) {
      throw new ValidationError(`Target station ${targetStation.name} already has an active gaming session.`);
    }

    // 3. Rate calculation on source session (handles overtime fee if applicable)
    const sourceIsPool =
      sourceStation.stationType === 'POOL_TABLE' ||
      sourceStation.name.toUpperCase().includes('SNOOKER') ||
      sourceStation.name.toUpperCase().includes('POOL');
    const sourcePlayers = sessionPlayerCount(sourceBooking.notes, sourceStation.stationType);
    const sourceHourlyRate = sessionHourlyRatePaise(
      sourceIsPool ? 'POOL_TABLE' : sourceStation.stationType,
      sourceStation.pricePerHourPaise || (sourceIsPool ? 25000 : 15000),
      sourcePlayers
    );

    const overtimeMinutes = data.chargeOvertime && data.extraMinutes > 0 ? Math.floor(data.extraMinutes) : 0;
    const overtimePaise = overtimeMinutes > 0 ? Math.round(sourceHourlyRate * (overtimeMinutes / 60)) : 0;
    const sourceGrossPaise = (sourceBooking.totalPricePaise || 0) + overtimePaise;

    const sourcePaidPaise = (sourceBooking.payments || [])
      .filter((p) => ['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(p.status))
      .reduce((sum, p) => sum + p.amountPaise, 0);

    const sourceDuePaise = Math.max(0, sourceGrossPaise - sourcePaidPaise);

    // 4. Rate calculation on destination station
    const targetIsPool =
      targetStation.stationType === 'POOL_TABLE' ||
      targetStation.name.toUpperCase().includes('SNOOKER') ||
      targetStation.name.toUpperCase().includes('POOL');
    const targetPlayerCount = targetIsPool ? Math.max(4, data.playerCount) : (data.playerCount || 1);
    const targetHourlyRate = sessionHourlyRatePaise(
      targetIsPool ? 'POOL_TABLE' : targetStation.stationType,
      targetStation.pricePerHourPaise || (targetIsPool ? 25000 : 15000),
      targetPlayerCount
    );

    const newSubtotalPaise = Math.round(targetHourlyRate * (data.durationMinutes / 60));

    let membershipDiscountPaise = 0;
    let membershipPlanName: string | null = null;
    if (sourceBooking.userId && sourceBooking.userId !== 'guest') {
      try {
        const activeMem = await getActiveUserMembership(sourceBooking.userId);
        if (activeMem) {
          membershipPlanName = activeMem.planNameSnapshot;
          const effectiveDiscount = activeMem?.plan?.discountPercent ?? activeMem?.discountPercent ?? 0;
          if (effectiveDiscount > 0) {
            membershipDiscountPaise = Math.round((newSubtotalPaise * effectiveDiscount) / 100);
          }
        }
      } catch {
        // Non-fatal
      }
    }
    const newTotalPricePaise = Math.max(0, newSubtotalPaise - membershipDiscountPaise);

    // 5. Execute atomic database transaction
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    const newBookingRef = `DS-WALK-${now.getFullYear()}-${randomHex}`;
    const newQrToken = `ds-walk-${crypto.randomUUID()}`;

    const txResult = await prisma.$transaction(async (tx) => {
      // A. Conclude source GamingSession & free source station
      if (sourceSession) {
        await tx.gamingSession.update({
          where: { id: sourceSession.id },
          data: {
            status: 'COMPLETED',
            endedAt: now,
            ...(overtimeMinutes > 0 ? {
              extensionMinutes: { increment: overtimeMinutes },
              extensionPaise: { increment: overtimePaise },
            } : {}),
            staffId: sourceSession.staffId || staffSession.userId,
          },
        });
      }

      await tx.gamingStation.update({
        where: { id: sourceStation.id },
        data: { status: 'AVAILABLE' },
      });

      // B. Update source booking: mark COMPLETED, record transfer target & overtime note
      await tx.booking.update({
        where: { id: sourceBooking.id },
        data: {
          status: 'COMPLETED',
          ...(overtimePaise > 0 ? { totalPricePaise: sourceGrossPaise } : {}),
          notes: `${sourceBooking.notes || ''}\n[TRANSFERRED_TO: station=${targetStation.name}, newBookingRef=${newBookingRef}, carriedPaise=${sourceDuePaise}, by=${staffName}]`.trim(),
        },
      });

      // C. If overtime occurred on source booking, add pending payment line for overtime
      if (overtimePaise > 0) {
        await tx.payment.create({
          data: {
            bookingId: sourceBooking.id,
            userId: sourceBooking.userId,
            amountPaise: overtimePaise,
            method: 'OTHER',
            status: 'PENDING',
            recordedByStaffId: staffSession.userId,
            notes: `Overtime fee (+${overtimeMinutes} mins) carried over to ${targetStation.name} by ${staffName}`,
          },
        });
      }

      // Tag existing pending payments on source booking so staff audit logs stay clear
      await tx.payment.updateMany({
        where: {
          bookingId: sourceBooking.id,
          status: 'PENDING',
        },
        data: {
          notes: `Open tab carried over to ${targetStation.name} [Booking ${newBookingRef}] by ${staffName}`,
        },
      });

      // D. Create new booking on target station
      const newBookingNotes = [
        '[PAY ON EXIT]',
        `[Multi-Game Tab: Transferred from ${sourceStation.name} (₹${(sourceDuePaise / 100).toFixed(0)})]`,
        `[TRANSFERRED_FROM: bookingId=${sourceBooking.id}, ref=${sourceBooking.bookingRef}, station=${sourceStation.name}, amountPaise=${sourceDuePaise}]`,
        data.gameTitle ? `Game: ${data.gameTitle.trim()}.` : '',
        `[Players: ${targetPlayerCount}].`,
        `Transferred from ${sourceStation.name} by ${staffName}${membershipPlanName ? ` [${membershipPlanName}]` : ''}`,
        data.notes ? data.notes.trim() : '',
      ]
        .filter(Boolean)
        .join(' ');

      const newBooking = await tx.booking.create({
        data: {
          bookingRef: newBookingRef,
          userId: sourceBooking.userId,
          stationId: targetStation.id,
          date: todayDate,
          startTime: now,
          endTime: scheduledEndAt,
          durationMinutes: data.durationMinutes,
          subtotalPaise: newSubtotalPaise,
          discountPaise: membershipDiscountPaise,
          membershipDiscountPaise,
          membershipPlanName,
          totalPricePaise: newTotalPricePaise,
          status: 'IN_PROGRESS',
          qrToken: newQrToken,
          isWalkIn: true,
          customerName: sourceBooking.customerName,
          customerPhone: sourceBooking.customerPhone,
          gameTitle: data.gameTitle?.trim() || null,
          notes: newBookingNotes,
        },
      });

      // E. Create pending payment record for new session
      await tx.payment.create({
        data: {
          bookingId: newBooking.id,
          userId: sourceBooking.userId,
          amountPaise: newTotalPricePaise,
          method: 'OTHER',
          status: 'PENDING',
          recordedByStaffId: staffSession.userId,
          notes: `Pay-on-Exit desk walk-in (Transferred tab from ${sourceStation.name}) [Registered by ${staffName}]`,
        },
      });

      // F. Create GamingSession for target station & occupy station
      const newSession = await tx.gamingSession.create({
        data: {
          bookingId: newBooking.id,
          stationId: targetStation.id,
          staffId: staffSession.userId,
          status: 'ACTIVE',
          startedAt: now,
          scheduledEndAt,
          notes: `[PAY ON EXIT] ` + (data.gameTitle || ''),
        },
      });

      await tx.gamingStation.update({
        where: { id: targetStation.id },
        data: { status: 'OCCUPIED' },
      });

      // G. Log staff activity
      await tx.staffActivityLog.create({
        data: {
          userId: staffSession.userId,
          action: 'TRANSFER_SESSION',
          entityType: 'session',
          entityId: newSession.id,
          details: {
            fromStationName: sourceStation.name,
            toStationName: targetStation.name,
            fromBookingRef: sourceBooking.bookingRef,
            toBookingRef: newBookingRef,
            carriedPaise: sourceDuePaise,
            newSessionPaise: newTotalPricePaise,
            customerName: sourceBooking.customerName,
            customerPhone: sourceBooking.customerPhone,
            staffName,
          },
        },
      }).catch(() => {});

      return {
        newBooking,
        newSession,
      };
    });

    return apiSuccess({
      message: `Transferred ${sourceBooking.customerName} to ${targetStation.name} successfully! ${sourceStation.name} is now Available.`,
      fromStationName: sourceStation.name,
      toStationName: targetStation.name,
      carriedPaise: sourceDuePaise,
      carriedRupees: (sourceDuePaise / 100).toFixed(2),
      newBookingId: txResult.newBooking.id,
      newBookingRef: txResult.newBooking.bookingRef,
      newSessionId: txResult.newSession.id,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
