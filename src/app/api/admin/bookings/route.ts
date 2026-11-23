import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, ConflictError, ForbiddenError, handleApiError, NotFoundError, ValidationError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { canDeleteReservation, reservationCreatorId } from '@/lib/staffReservations';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { staffBookingDayRange, staffBookingDateRange } from '@/lib/staffBookingViews';

const patchBookingSchema = z.object({
  bookingId: z.string().min(1),
  action: z.enum(['CANCEL', 'MARK_PAID', 'NO_SHOW']),
  paymentMethod: z.enum(['CASH', 'UPI']).optional().default('CASH'),
  reason: z.string().optional(),
});

const deleteBookingSchema = z.object({
  bookingId: z.string().optional(),
  bookingIds: z.array(z.string()).max(1000).optional(),
  clearAll: z.boolean().optional(),
  scope: z.enum(['ALL', 'COMPLETED_CANCELLED', 'WALK_IN_TEST']).optional().default('ALL'),
});

export async function GET(req: NextRequest) {
  try {
    const viewer = await requireRole('ADMIN', 'SUPER_ADMIN', 'STAFF');
    const searchParams = new URL(req.url).searchParams;
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const paymentStatus = searchParams.get('paymentStatus') || '';
    const stationId = searchParams.get('stationId') || '';
    const day = searchParams.get('day');
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;
    let dayFilter: Prisma.BookingWhereInput | undefined;
    if (day) {
      let range: ReturnType<typeof staffBookingDayRange>;
      try {
        range = staffBookingDayRange(day);
      } catch {
        throw new ValidationError('Invalid booking date');
      }
      const timestamp = { gte: range.start, lt: range.end };
      dayFilter = status === 'COMPLETED'
        ? { OR: [{ session: { is: { endedAt: timestamp } } }, { updatedAt: timestamp }] }
        : { startTime: timestamp };
    } else if (from || to) {
      let range: ReturnType<typeof staffBookingDateRange>;
      try {
        range = staffBookingDateRange(from, to);
      } catch {
        throw new ValidationError('Invalid booking date range');
      }
      const timestamp = { ...(range.start ? { gte: range.start } : {}), ...(range.end ? { lt: range.end } : {}) };
      dayFilter = status === 'COMPLETED'
        ? { OR: [{ session: { is: { endedAt: timestamp } } }, { updatedAt: timestamp }] }
        : { startTime: timestamp };
    }

    const bookingInclude = {
      station: { include: { facility: true } },
      user: { select: { firstName: true, lastName: true, email: true, phone: true } },
      session: {
        include: {
          staff: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
      },
      payments: { orderBy: { createdAt: 'desc' as const }, take: 5 },
    };

    const whereConditions: Prisma.BookingWhereInput[] = [];
    if (status) whereConditions.push({ status: status as any });
    if (stationId) whereConditions.push({ stationId });
    if (dayFilter) whereConditions.push(dayFilter);
    if (paymentStatus === 'PENDING') {
      whereConditions.push({
        OR: [
          { payments: { some: { status: 'PENDING' } } },
          { status: 'PENDING' },
        ],
      });
    } else if (paymentStatus) {
      whereConditions.push({ payments: { some: { status: paymentStatus as any } } });
    }
    if (search) {
      whereConditions.push({
        OR: [
          { bookingRef: { contains: search } },
          { customerName: { contains: search } },
          { customerPhone: { contains: search } },
          { user: { email: { contains: search } } },
        ],
      });
    }

    const [recentBookings, activeFloorBookings] = await Promise.all([
      prisma.booking.findMany({
        where: whereConditions.length > 0 ? { AND: whereConditions } : {},
        include: bookingInclude,
        orderBy: { createdAt: 'desc' },
        take: status === 'COMPLETED' || paymentStatus === 'PENDING' || dayFilter ? undefined : 500,
      }),
      !status && !dayFilter && paymentStatus !== 'PENDING'
        ? prisma.booking.findMany({
            where: {
              ...(stationId ? { stationId } : {}),
              OR: [
                { status: { in: ['IN_PROGRESS', 'CHECKED_IN'] } },
                { session: { status: { in: ['ACTIVE', 'PAUSED', 'EXTENDED', 'OVERDUE'] } } },
              ],
            },
            include: bookingInclude,
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
    ]);

    const seenBookingIds = new Set<string>();
    const bookings = [...activeFloorBookings, ...recentBookings].filter((b) => {
      if (seenBookingIds.has(b.id)) return false;
      seenBookingIds.add(b.id);
      return true;
    });

    // Lookup staff activity logs for walk-ins without explicit session staff
    const walkInIds = bookings.filter((b) => b.isWalkIn && !b.session?.staff).map((b) => b.id);
    const staffLogs =
      walkInIds.length > 0
        ? await prisma.staffActivityLog.findMany({
            where: { entityId: { in: walkInIds } },
            include: { user: { select: { firstName: true, lastName: true } } },
            orderBy: { createdAt: 'desc' },
          })
        : [];

    const staffMap = new Map<string, string>();
    for (const log of staffLogs) {
      if (log.entityId && log.user && !staffMap.has(log.entityId)) {
        staffMap.set(log.entityId, `${log.user.firstName} ${log.user.lastName}`.trim());
      }
    }

    // Query pending payments to resolve multi-game transferred tabs (e.g. Snooker transferred to PS5)
    const pendingPayments = await prisma.payment.findMany({
      where: {
        status: 'PENDING',
        amountPaise: { gt: 0 },
      },
      include: {
        booking: {
          include: {
            station: true,
            user: { select: { firstName: true, lastName: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const pendingByBooking = new Map<string, {
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
    }>();

    for (const p of pendingPayments) {
      if (!p.bookingId || !p.booking) continue;
      const existing = pendingByBooking.get(p.bookingId);
      const custName = p.booking.customerName || `${p.booking.user?.firstName || 'Gamer'} ${p.booking.user?.lastName || ''}`.trim();
      const custPhone = p.booking.customerPhone || p.booking.user?.phone || null;
      if (existing) {
        existing.amountPaise += p.amountPaise;
      } else {
        pendingByBooking.set(p.bookingId, {
          bookingId: p.bookingId,
          bookingRef: p.booking.bookingRef,
          stationId: p.booking.stationId,
          stationName: p.booking.station?.name || 'Previous Station',
          stationType: p.booking.station?.stationType || 'PS5',
          gameTitle: p.booking.gameTitle || null,
          customerName: custName,
          customerPhone: custPhone,
          userId: p.booking.userId,
          amountPaise: p.amountPaise,
        });
      }
    }

    // Resolve active Syndicate Passes for quick detection in staff panels
    const activeMemberships = await prisma.membership.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
      include: {
        user: { select: { id: true, phone: true } },
      },
    }).catch(() => []);

    const passByUserId = new Map<string, typeof activeMemberships[0]>();
    const passByPhoneDigits = new Map<string, typeof activeMemberships[0]>();

    for (const mem of activeMemberships) {
      if (mem.userId) passByUserId.set(mem.userId, mem);
      const digits = (mem.user?.phone || '').replace(/\D/g, '').slice(-10);
      if (digits.length >= 10) passByPhoneDigits.set(digits, mem);
    }

    const mappedBookings = bookings.map((booking) => {
      const isWalkIn = Boolean(booking.isWalkIn);
      let staffName: string | null = null;

      if (booking.session?.staff) {
        staffName = `${booking.session.staff.firstName} ${booking.session.staff.lastName}`.trim();
      } else if (isWalkIn) {
        if (staffMap.has(booking.id)) {
          staffName = staffMap.get(booking.id)!;
        } else if (booking.notes && /by\s+([A-Za-z0-9\s]+)/i.test(booking.notes)) {
          const match = booking.notes.match(/by\s+([A-Za-z0-9\s]+)/i);
          if (match && match[1]) {
            staffName = match[1].trim();
          }
        }
        if (!staffName) {
          staffName = 'Front Desk Staff';
        }
      }

      const isSnooker =
        booking.station?.stationType === 'POOL_TABLE' ||
        booking.station?.name?.toUpperCase().includes('SNOOKER') ||
        booking.station?.name?.toUpperCase().includes('POOL');

      const hasActiveFloorSession = Boolean(
        booking.session && ['ACTIVE', 'PAUSED', 'EXTENDED', 'OVERDUE'].includes(booking.session.status)
      );

      // Resolve multi-game transferred open tabs (e.g. Snooker transferred to PlayStation)
      const priorPendingTabs: Array<{
        bookingId: string;
        bookingRef: string;
        stationName: string;
        stationType: string;
        gameTitle: string | null;
        amountPaise: number;
      }> = [];

      const currentPhoneRaw = booking.customerPhone || booking.user?.phone || '';
      const currentPhoneDigits = currentPhoneRaw.replace(/\D/g, '').slice(-10);
      const currentNameRaw = (
        booking.customerName ||
        `${booking.user?.firstName || ''} ${booking.user?.lastName || ''}`
      ).trim().toLowerCase();

      // Check explicit link in notes: [TRANSFERRED_FROM: bookingId=xxx...]
      const noteTransferredMatch = booking.notes?.match(/\[TRANSFERRED_FROM:\s*bookingId=([a-zA-Z0-9_-]+)/i);
      const linkedFromId = noteTransferredMatch ? noteTransferredMatch[1] : null;

      if (linkedFromId && pendingByBooking.has(linkedFromId)) {
        const pb = pendingByBooking.get(linkedFromId)!;
        priorPendingTabs.push({
          bookingId: pb.bookingId,
          bookingRef: pb.bookingRef,
          stationName: pb.stationName,
          stationType: pb.stationType,
          gameTitle: pb.gameTitle,
          amountPaise: pb.amountPaise,
        });
      } else if (hasActiveFloorSession || booking.status === 'PENDING' || booking.status === 'IN_PROGRESS') {
        // Match by phone / name / userId for active or pending bookings
        for (const [bId, pb] of pendingByBooking.entries()) {
          if (bId === booking.id) continue;
          const pbPhoneDigits = (pb.customerPhone || '').replace(/\D/g, '').slice(-10);
          const pbName = (pb.customerName || '').trim().toLowerCase();
          const isMatch =
            (currentPhoneDigits.length === 10 && pbPhoneDigits === currentPhoneDigits) ||
            (booking.userId && pb.userId === booking.userId && booking.userId !== 'guest') ||
            (currentNameRaw.length >= 2 && pbName === currentNameRaw);

          if (isMatch) {
            priorPendingTabs.push({
              bookingId: pb.bookingId,
              bookingRef: pb.bookingRef,
              stationName: pb.stationName,
              stationType: pb.stationType,
              gameTitle: pb.gameTitle,
              amountPaise: pb.amountPaise,
            });
          }
        }
      }

      const priorUnpaidPaise = priorPendingTabs.reduce((sum, tab) => sum + tab.amountPaise, 0);

      const playerMatch = booking.notes?.match(/\[Players:\s*(\d+)\]/i);
      const playerCount = playerMatch ? parseInt(playerMatch[1], 10) : (isSnooker ? 4 : 1);

      let cleanGameTitle = booking.gameTitle || null;
      if (!cleanGameTitle && booking.session?.notes) {
        const stripped = booking.session.notes.replace(/\[PAY ON EXIT\]/gi, '').trim();
        if (stripped) cleanGameTitle = stripped;
      }
      if (!cleanGameTitle && booking.notes) {
        const match = booking.notes.match(/Game:\s*([^.\n\r\[]+)/i);
        if (match && match[1]?.trim()) {
          cleanGameTitle = match[1].trim();
        }
      }
      if (cleanGameTitle && (cleanGameTitle.includes('[PAY ON EXIT]') || cleanGameTitle === '[PAY ON EXIT]')) {
        cleanGameTitle = cleanGameTitle.replace(/\[PAY ON EXIT\]/gi, '').trim();
      }
      const finalGameTitle = isSnooker ? null : (cleanGameTitle || null);

      const effectiveStatus =
        hasActiveFloorSession && (booking.status === 'CONFIRMED' || booking.status === 'PENDING')
          ? 'IN_PROGRESS'
          : booking.status;

      const completedPayments = (booking.payments || []).filter((p) =>
        ['COMPLETED', 'PARTIALLY_REFUNDED'].includes(p.status)
      );
      const splitPayments = completedPayments.filter((p) => p.notes && p.notes.startsWith('Split payment:'));
      const isSplit = splitPayments.length > 1;

      let displayPaymentMethod: string | null = booking.payments[0]?.method || null;
      let splitPaymentDetails: string | null = null;

      if (isSplit) {
        displayPaymentMethod = 'SPLIT';
        const cashPart = splitPayments.find((p) => p.method === 'CASH' || p.notes?.includes('Cash portion'));
        const upiPart = splitPayments.find((p) => p.method === 'UPI' || p.notes?.includes('UPI/GPay portion'));
        const cashAmt = cashPart ? Math.round(cashPart.amountPaise / 100) : 0;
        const upiAmt = upiPart ? Math.round(upiPart.amountPaise / 100) : 0;
        splitPaymentDetails = `₹${cashAmt} Cash + ₹${upiAmt} UPI`;
      }

      const passPayment = (booking.payments || []).find((p) =>
        p.receiptNumber?.startsWith('PASS-') ||
        (p.notes && (p.notes.toLowerCase().includes('syndicate pass') || p.notes.toLowerCase().includes('pass: deducted')))
      );
      const hasPassDeductionRecord = Boolean(
        passPayment ||
        (booking.notes && booking.notes.includes('[SYNDICATE_PASS:')) ||
        (booking.notes && booking.notes.includes('Deducted') && (booking.notes.includes('hrs on') || booking.notes.includes('hrs (')))
      );
      const isPassCoveredSession = Boolean(
        hasPassDeductionRecord ||
        (booking.notes && booking.notes.toLowerCase().includes('syndicate pass')) ||
        (booking.membershipPlanName && (booking.totalPricePaise === 0 || booking.payments[0]?.method === 'OTHER'))
      );
      const isPassRedeemed = Boolean(
        booking.status === 'COMPLETED' ? hasPassDeductionRecord : isPassCoveredSession
      );

      if (isPassCoveredSession || isPassRedeemed) {
        displayPaymentMethod = 'SYNDICATE_PASS';
      }

      // Check if player has an active Syndicate Pass
      const matchedPass =
        passByUserId.get(booking.userId) ||
        (currentPhoneDigits.length >= 10 ? passByPhoneDigits.get(currentPhoneDigits) : null);

      let syndicatePass: {
        id: string;
        planName: string;
        tier: string;
        discountPercent: number;
        totalHours: number;
        usedHours: number;
        remainingMinutes: number;
        remainingHours: number;
        hasHoursAvailable: boolean;
      } | null = null;

      if (matchedPass) {
        const totalMinutes = (matchedPass.totalHours || 0) * 60;
        const remainingMinutes = Math.max(0, totalMinutes - (matchedPass.usedMinutes || 0));
        const remainingHours = Number((remainingMinutes / 60).toFixed(2));
        const usedHours = Number(((matchedPass.usedMinutes || 0) / 60).toFixed(2));

        syndicatePass = {
          id: matchedPass.id,
          planName: matchedPass.planNameSnapshot,
          tier: matchedPass.tierSnapshot,
          discountPercent: matchedPass.discountPercent,
          totalHours: matchedPass.totalHours,
          usedHours,
          remainingMinutes,
          remainingHours,
          hasHoursAvailable: remainingMinutes > 0,
        };
      }

      return {
        id: booking.id,
        bookingRef: booking.bookingRef,
        userId: booking.userId,
        customerName: booking.customerName || `${booking.user.firstName} ${booking.user.lastName}`.trim(),
        customerEmail: booking.user.email,
        customerPhone: booking.customerPhone || booking.user.phone,
        syndicatePass,
        stationId: booking.stationId,
        stationName: booking.station.name,
        facilityName: booking.station.facility.name,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        durationMinutes: booking.durationMinutes,
        totalPricePaise: isPassRedeemed ? 0 : booking.totalPricePaise,
        isPassRedeemed,
        membershipPlanName: booking.membershipPlanName || (isPassRedeemed ? (matchedPass?.planNameSnapshot || 'VIP Black Card') : null),
        status: effectiveStatus,
        isWalkIn,
        channel: isWalkIn ? 'DESK' : 'ONLINE',
        bookedVia: isWalkIn ? 'Front Desk Walk-in' : 'Online Website',
        staffName,
        staffId: booking.session?.staffId || null,
        paymentId: booking.payments[0]?.id || null,
        paymentStatus: booking.payments[0]?.status || 'UNPAID',
        paymentMethod: displayPaymentMethod,
        hasPassDeductionRecord,
        isPassCoveredSession,
        splitPaymentDetails,
        priorPendingTabs,
        priorUnpaidPaise,
        hasTransferredTab: priorPendingTabs.length > 0,
        isPayOnExit: Boolean(isWalkIn || priorPendingTabs.length > 0 || booking.notes?.includes('[PAY ON EXIT]')),
        unpaidPaise: (booking.payments[0]?.status === 'PENDING' ? booking.totalPricePaise : 0) + priorUnpaidPaise,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        gameTitle: finalGameTitle,
        notes: booking.notes,
        stationSpecs: isSnooker
          ? ''
          : ((booking.station?.metadata as any)?.specs || (booking.station?.stationType === 'PS5' ? '4K 120Hz OLED Display' : '')),
        stationCapacity:
          (booking.station?.metadata as any)?.capacity || (isSnooker ? 4 : 2),
        stationType: booking.station?.stationType || (isSnooker ? 'POOL_TABLE' : 'PS5'),
        isSnooker,
        playerCount,
        pricePerHourPaise: booking.station?.pricePerHourPaise || (isSnooker ? 25000 : 15000),
        session: booking.session
          ? {
              id: booking.session.id,
              status: booking.session.status,
              startedAt: booking.session.startedAt,
              scheduledEndAt: booking.session.scheduledEndAt,
              endedAt: booking.session.endedAt || null,
              extensionMinutes: booking.session.extensionMinutes,
              gameTitle: finalGameTitle,
              playerCount,
              staff: booking.session.staff || null,
            }
          : effectiveStatus === 'IN_PROGRESS' || effectiveStatus === 'CHECKED_IN'
          ? {
              id: `active-${booking.id}`,
              status: 'ACTIVE',
              startedAt: booking.startTime,
              scheduledEndAt: booking.endTime,
              endedAt: null,
              extensionMinutes: 0,
              gameTitle: finalGameTitle,
              playerCount,
              staff: null,
            }
          : null,
      };
    });

    return apiSuccess(mappedBookings);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireRole('ADMIN', 'SUPER_ADMIN', 'STAFF');
    const body = await req.json();
    const { bookingId, action, paymentMethod, reason } = patchBookingSchema.parse(body);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        station: true,
        user: true,
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        session: true,
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (session.role === 'STAFF' && booking.notes?.includes('[Front Desk Pre-Booking]') && (action === 'CANCEL' || action === 'NO_SHOW')) {
      const creatorLog = await prisma.staffActivityLog.findFirst({
        where: { entityType: 'booking', entityId: bookingId, action: 'CREATE_RESERVATION' },
        orderBy: { createdAt: 'asc' },
        select: { userId: true },
      });
      const creatorId = reservationCreatorId({ payments: booking.payments }, creatorLog?.userId || null);
      if (!canDeleteReservation(session.role, session.userId, creatorId)) {
        throw new ForbiddenError('Only the staff member who created this reservation or an administrator can cancel it.');
      }
    }

    const now = new Date();
    const isGuestUser = booking.user?.email === 'guest@darksyndicate.in';

    if (action === 'CANCEL') {
      if (['CANCELLED', 'COMPLETED', 'IN_PROGRESS'].includes(booking.status)) {
        throw new ConflictError(`Cannot cancel a booking that is already ${booking.status}.`);
      }

      await prisma.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id: bookingId },
          data: {
            status: 'CANCELLED',
            cancelledAt: now,
            cancelReason: reason || 'Cancelled by Administrator',
          },
        });

        await tx.payment.updateMany({
          where: { bookingId, status: 'PENDING' },
          data: { status: 'FAILED' },
        });
      });

      if (!isGuestUser && booking.userId) {
        await prisma.notification.create({
          data: {
            userId: booking.userId,
            title: 'Booking Cancelled',
            message: `Your reservation ${booking.bookingRef} at ${booking.station.name} has been cancelled.${reason ? ` Reason: ${reason}` : ''}`,
            type: 'BOOKING_CANCELLED',
          },
        }).catch(() => {});
      }

      await prisma.auditLog.create({
        data: {
          userId: session.userId,
          action: 'STATUS_CHANGE',
          entityType: 'Booking',
          entityId: bookingId,
          oldValue: { status: booking.status, bookingRef: booking.bookingRef },
          newValue: { status: 'CANCELLED', bookingRef: booking.bookingRef, reason: reason || 'Cancelled by Administrator' },
        },
      }).catch(() => {});

      return apiSuccess({ message: `Booking ${booking.bookingRef} cancelled successfully.` });
    }

    if (action === 'NO_SHOW') {
      if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
        throw new ConflictError(`Only PENDING or CONFIRMED bookings can be marked as No-Show.`);
      }

      await prisma.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id: bookingId },
          data: { status: 'NO_SHOW' },
        });

        await tx.payment.updateMany({
          where: { bookingId, status: 'PENDING' },
          data: { status: 'FAILED' },
        });
      });

      await prisma.auditLog.create({
        data: {
          userId: session.userId,
          action: 'STATUS_CHANGE',
          entityType: 'Booking',
          entityId: bookingId,
          oldValue: { status: booking.status, bookingRef: booking.bookingRef },
          newValue: { status: 'NO_SHOW', bookingRef: booking.bookingRef },
        },
      }).catch(() => {});

      return apiSuccess({ message: `Booking ${booking.bookingRef} marked as No-Show.` });
    }

    if (action === 'MARK_PAID') {
      const latestPayment = booking.payments[0];
      if (latestPayment?.status === 'COMPLETED') {
        throw new ConflictError(`Booking ${booking.bookingRef} is already paid.`);
      }

      await prisma.$transaction(async (tx) => {
        if (latestPayment) {
          await tx.payment.update({
            where: { id: latestPayment.id },
            data: {
              status: 'COMPLETED',
              method: paymentMethod,
              paidAt: now,
              recordedByStaffId: session.userId,
            },
          });
        } else {
          await tx.payment.create({
            data: {
              bookingId,
              userId: booking.userId,
              amountPaise: booking.totalPricePaise,
              method: paymentMethod,
              status: 'COMPLETED',
              paidAt: now,
              recordedByStaffId: session.userId,
            },
          });
        }

        if (booking.status === 'PENDING') {
          await tx.booking.update({
            where: { id: bookingId },
            data: { status: 'CONFIRMED' },
          });
        }

        // Also settle any linked prior transferred booking
        const noteTransferredMatch = booking.notes?.match(/\[TRANSFERRED_FROM:\s*bookingId=([a-zA-Z0-9_-]+)/i);
        if (noteTransferredMatch && noteTransferredMatch[1]) {
          const priorBookingId = noteTransferredMatch[1];
          await tx.payment.updateMany({
            where: { bookingId: priorBookingId, status: 'PENDING' },
            data: {
              status: 'COMPLETED',
              method: paymentMethod,
              paidAt: now,
              recordedByStaffId: session.userId,
              notes: `Marked paid via ${paymentMethod} alongside transferred booking ${booking.bookingRef} by admin`,
            },
          });
          await tx.booking.update({
            where: { id: priorBookingId },
            data: { status: 'COMPLETED' },
          });
        }

        if (!isGuestUser && booking.userId && booking.totalPricePaise > 0) {
          await tx.customerProfile.upsert({
            where: { userId: booking.userId },
            create: { userId: booking.userId, totalSpent: booking.totalPricePaise },
            update: { totalSpent: { increment: booking.totalPricePaise } },
          });
        }
      });

      await prisma.auditLog.create({
        data: {
          userId: session.userId,
          action: 'PAYMENT',
          entityType: 'Booking',
          entityId: bookingId,
          oldValue: { paymentStatus: latestPayment?.status || 'UNPAID', bookingRef: booking.bookingRef },
          newValue: {
            paymentStatus: 'COMPLETED',
            method: paymentMethod,
            amountPaise: booking.totalPricePaise,
            bookingRef: booking.bookingRef,
          },
        },
      }).catch(() => {});

      return apiSuccess({
        message: `Payment of ₹${(booking.totalPricePaise / 100).toLocaleString('en-IN')} recorded via ${paymentMethod} for ${booking.bookingRef}.`,
      });
    }

    throw new ConflictError('Unsupported action');
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireRole('ADMIN', 'SUPER_ADMIN');
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body may be empty
    }

    const { bookingId, bookingIds, clearAll, scope } = deleteBookingSchema.parse(body);

    let targetIds: string[] = [];

    if (bookingId) {
      targetIds = [bookingId];
    } else if (bookingIds && bookingIds.length > 0) {
      targetIds = bookingIds;
    } else if (clearAll) {
      let whereClause: any = {};
      if (scope === 'COMPLETED_CANCELLED') {
        whereClause = {
          status: { in: ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'PAYMENT_FAILED'] },
        };
      } else if (scope === 'WALK_IN_TEST') {
        whereClause = {
          OR: [
            { isWalkIn: true },
            { user: { email: 'guest@darksyndicate.in' } },
          ],
        };
      }
      const matching = await prisma.booking.findMany({
        where: whereClause,
        select: { id: true },
      });
      targetIds = matching.map((b) => b.id);
    } else {
      throw new ValidationError('Please provide a bookingId, bookingIds array, or clearAll: true.');
    }

    if (targetIds.length === 0) {
      return apiSuccess({ message: 'No matching reservations found to delete.', deletedCount: 0 });
    }

    const bookingsToDelete = await prisma.booking.findMany({
      where: { id: { in: targetIds } },
      select: { id: true, stationId: true, bookingRef: true },
    });
    const affectedStationIds = Array.from(
      new Set(bookingsToDelete.map((b) => b.stationId).filter(Boolean))
    );

    await prisma.$transaction(async (tx) => {
      // 1. Delete associated coupon redemptions
      await tx.couponRedemption.deleteMany({
        where: { bookingId: { in: targetIds } },
      });

      // 2. Delete associated payments
      await tx.payment.deleteMany({
        where: { bookingId: { in: targetIds } },
      });

      // 3. Delete associated live/completed gaming sessions
      await tx.gamingSession.deleteMany({
        where: { bookingId: { in: targetIds } },
      });

      // 4. Delete the bookings themselves
      await tx.booking.deleteMany({
        where: { id: { in: targetIds } },
      });

      // 5. Safely reset affected station status if no other active floor session exists
      for (const stId of affectedStationIds) {
        const station = await tx.gamingStation.findUnique({
          where: { id: stId },
          select: { status: true },
        });
        if (station && station.status === 'OCCUPIED') {
          const remainingSession = await tx.gamingSession.findFirst({
            where: {
              stationId: stId,
              status: { in: ['ACTIVE', 'PAUSED', 'EXTENDED', 'OVERDUE'] },
            },
          });
          if (!remainingSession) {
            await tx.gamingStation.update({
              where: { id: stId },
              data: { status: 'AVAILABLE' },
            });
          }
        }
      }
    });

    // 6. Record audit log
    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: 'DELETE',
        entityType: 'Booking',
        entityId: targetIds.length === 1 ? targetIds[0] : 'BULK_CLEAR',
        oldValue: {
          count: targetIds.length,
          refs: bookingsToDelete.slice(0, 10).map((b) => b.bookingRef),
          scope: scope || 'CUSTOM',
        },
        newValue: { deleted: true },
      },
    }).catch(() => {});

    return apiSuccess({
      message: `Successfully deleted ${targetIds.length} reservation(s).`,
      deletedCount: targetIds.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
