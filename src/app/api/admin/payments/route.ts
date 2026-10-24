import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, ConflictError, handleApiError, NotFoundError, ValidationError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { z } from 'zod';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { paymentDateBounds } from '@/lib/paymentDateFilter';

const patchPaymentSchema = z.object({
  paymentId: z.string().min(1),
  action: z.enum(['SETTLE', 'REFUND']),
  method: z.enum(['CASH', 'UPI']).optional().default('CASH'),
  refundAmountPaise: z.number().int().positive().optional(),
  reason: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireRole('ADMIN', 'SUPER_ADMIN');
    const { searchParams } = new URL(req.url);
    const method = searchParams.get('method') || '';
    const status = searchParams.get('status') || '';
    const channel = searchParams.get('channel') || ''; // 'ALL' | 'ONLINE' | 'DESK'
    const dateFrom = searchParams.get('from') || '';
    const dateTo = searchParams.get('to') || '';
    let dateBounds: { gte?: Date; lt?: Date } | undefined;
    try {
      if (dateFrom || dateTo) dateBounds = paymentDateBounds(dateFrom, dateTo);
    } catch {
      throw new ValidationError('Enter a valid From/To date range.');
    }
    const parsedMethod = z.enum(PaymentMethod).safeParse(method);
    const parsedStatus = z.enum(PaymentStatus).safeParse(status);

    const [payments, paidMemberships, allStaffUsers] = await Promise.all([
      prisma.payment.findMany({
        where: {
          ...(parsedMethod.success ? { method: parsedMethod.data } : {}),
          ...(parsedStatus.success ? { status: parsedStatus.data } : {}),
          ...(dateBounds ? { OR: [{ paidAt: dateBounds }, { paidAt: null, createdAt: dateBounds }] } : {}),
        },
        include: {
          booking: {
            select: {
              id: true,
              bookingRef: true,
              customerName: true,
              isWalkIn: true,
              notes: true,
              station: { select: { name: true } },
              session: {
                select: {
                  staffId: true,
                  staff: { select: { id: true, firstName: true, lastName: true, role: true } },
                },
              },
            },
          },
          user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
          refunds: {
            select: { id: true, amountPaise: true, status: true, reason: true, processedAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: dateBounds ? undefined : 300,
      }),
      status && status !== 'ALL' && status !== 'COMPLETED'
        ? Promise.resolve([])
        : prisma.membership.findMany({
            where: {
              status: { not: 'CANCELLED' },
              pricePaidPaise: { gt: 0 },
              ...(parsedMethod.success ? { paymentMethod: parsedMethod.data } : {}),
              ...(dateBounds ? { createdAt: dateBounds } : {}),
            },
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: dateBounds ? undefined : 100,
          }),
      prisma.user.findMany({
        where: { role: { in: ['STAFF', 'ADMIN', 'SUPER_ADMIN'] } },
        select: { id: true, firstName: true, lastName: true, role: true },
        orderBy: { firstName: 'asc' },
      }),
    ]);

    const staffUserMap: Record<string, { id: string; name: string; role: string }> = {};
    allStaffUsers.forEach((s) => {
      staffUserMap[s.id] = {
        id: s.id,
        name: `${s.firstName} ${s.lastName}`.trim(),
        role: s.role,
      };
    });

    const formattedBookings = payments.map((p) => {
      const isDesk = Boolean(
        p.recordedByStaffId ||
        p.booking?.isWalkIn ||
        p.method === 'CASH' ||
        (p.notes && /desk|walk-in|walk in|counter|session extended|front desk/i.test(p.notes))
      );
      const paymentChannel: 'ONLINE' | 'DESK' = isDesk ? 'DESK' : 'ONLINE';

      let collectedBy: {
        id: string;
        name: string;
        role: string;
        isDesk: boolean;
      };

      if (isDesk) {
        if (p.recordedByStaffId && staffUserMap[p.recordedByStaffId]) {
          const staff = staffUserMap[p.recordedByStaffId];
          collectedBy = {
            id: staff.id,
            name: staff.name,
            role: staff.role,
            isDesk: true,
          };
        } else if (p.booking?.session?.staff) {
          const staff = p.booking.session.staff;
          collectedBy = {
            id: staff.id,
            name: `${staff.firstName} ${staff.lastName}`.trim(),
            role: staff.role,
            isDesk: true,
          };
        } else if (p.notes && /processed by\s+([A-Za-z0-9\s]+?)(?:\[|$|\()/i.test(p.notes)) {
          const match = p.notes.match(/processed by\s+([A-Za-z0-9\s]+?)(?:\[|$|\()/i);
          collectedBy = {
            id: '',
            name: match?.[1]?.trim() || 'Front Desk Staff',
            role: 'STAFF',
            isDesk: true,
          };
        } else if (p.notes && /by\s+([A-Za-z0-9\s]+?)(?:\[|$|\()/i.test(p.notes)) {
          const match = p.notes.match(/by\s+([A-Za-z0-9\s]+?)(?:\[|$|\()/i);
          collectedBy = {
            id: '',
            name: match?.[1]?.trim() || 'Front Desk Staff',
            role: 'STAFF',
            isDesk: true,
          };
        } else if (p.booking?.notes && /registered by\s+([A-Za-z0-9\s]+?)(?:\[|$|\()/i.test(p.booking.notes)) {
          const match = p.booking.notes.match(/registered by\s+([A-Za-z0-9\s]+?)(?:\[|$|\()/i);
          collectedBy = {
            id: '',
            name: match?.[1]?.trim() || 'Front Desk Staff',
            role: 'STAFF',
            isDesk: true,
          };
        } else {
          collectedBy = {
            id: '',
            name: 'Front Desk Operator',
            role: 'STAFF',
            isDesk: true,
          };
        }
      } else {
        collectedBy = {
          id: 'online-gateway',
          name: p.method === 'RAZORPAY' ? 'Razorpay Gateway' : p.method === 'UPI' ? 'UPI Gateway' : 'Online System',
          role: 'ONLINE',
          isDesk: false,
        };
      }

      const refundedPaise = p.refunds.filter((r) => r.status === 'COMPLETED').reduce((sum, r) => sum + r.amountPaise, 0);
      const pendingRefundPaise = p.refunds.filter((r) => r.status === 'PENDING' || r.status === 'PROCESSING').reduce((sum, r) => sum + r.amountPaise, 0);

      return {
        id: p.id,
        isMembership: false,
        bookingId: p.booking?.id || null,
        bookingRef: p.booking?.bookingRef || '—',
        customerName:
          p.booking?.customerName || `${p.user?.firstName || 'Gamer'} ${p.user?.lastName || ''}`.trim(),
        customerEmail: p.user?.email,
        stationName: p.booking?.station?.name || 'Arena',
        amountPaise: p.amountPaise,
        refundedPaise,
        pendingRefundPaise,
        netAmountPaise: Math.max(0, p.amountPaise - refundedPaise),
        method: p.method,
        status: p.status,
        channel: paymentChannel,
        collectedBy,
        gatewayOrderId: p.gatewayOrderId || '—',
        gatewayPaymentId: p.gatewayPaymentId || '—',
        paidAt: p.paidAt || p.createdAt,
        notes: p.notes,
      };
    });

    const formattedMemberships = paidMemberships.map((m) => {
      const isDesk = m.paymentMethod === 'CASH' || Boolean(m.notes && /admin|manual|desk/i.test(m.notes));
      const paymentChannel: 'ONLINE' | 'DESK' = isDesk ? 'DESK' : 'ONLINE';
      return {
        id: `mem-${m.id}`,
        isMembership: true,
        bookingId: null,
        bookingRef: `PASS-${m.id.slice(0, 6).toUpperCase()}`,
        customerName: `${m.user?.firstName || 'Member'} ${m.user?.lastName || ''}`.trim(),
        customerEmail: m.user?.email,
        stationName: `${m.planNameSnapshot} Pass`,
        amountPaise: m.pricePaidPaise,
        refundedPaise: 0,
        netAmountPaise: m.pricePaidPaise,
        method: m.paymentMethod || 'UPI',
        status: 'COMPLETED',
        channel: paymentChannel,
        collectedBy: isDesk
          ? { id: '', name: 'Admin Desk', role: 'ADMIN', isDesk: true }
          : { id: 'online-gateway', name: 'Online Pass Checkout', role: 'ONLINE', isDesk: false },
        gatewayOrderId: '—',
        gatewayPaymentId: '—',
        paidAt: m.createdAt,
        notes: m.notes || `${m.planNameSnapshot} Membership Pass`,
      };
    });

    const combined = [...formattedBookings, ...formattedMemberships].sort(
      (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
    );

    const filtered = channel && channel !== 'ALL'
      ? combined.filter((p) => p.channel === channel)
      : combined;

    return apiSuccess({
      payments: filtered,
      staffList: allStaffUsers.map((s) => ({
        id: s.id,
        name: `${s.firstName} ${s.lastName}`.trim(),
        role: s.role,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireRole('ADMIN', 'SUPER_ADMIN');
    const body = await req.json();
    const { paymentId, action, method, refundAmountPaise, reason } = patchPaymentSchema.parse(body);

    if (paymentId.startsWith('mem-')) {
      throw new ValidationError('Membership pass records are managed from the Memberships portal.');
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: true,
        user: true,
        refunds: { where: { status: 'COMPLETED' } },
      },
    });

    if (!payment) {
      throw new NotFoundError('Payment record not found');
    }

    const now = new Date();
    const isGuestUser = payment.user?.email === 'guest@darksyndicate.in';

    if (action === 'SETTLE') {
      if (payment.method === 'RAZORPAY' || payment.gatewayOrderId) {
        throw new ValidationError('Gateway payments are settled only after Razorpay capture verification.');
      }
      if (payment.status === 'COMPLETED') {
        throw new ConflictError('This payment is already settled.');
      }

      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            status: 'COMPLETED',
            method,
            paidAt: now,
            recordedByStaffId: session.userId,
          },
        });

        if (payment.booking?.status === 'PENDING') {
          await tx.booking.update({
            where: { id: payment.bookingId },
            data: { status: 'CONFIRMED' },
          });
        }

        if (!isGuestUser && payment.userId && payment.amountPaise > 0) {
          await tx.customerProfile.upsert({
            where: { userId: payment.userId },
            create: { userId: payment.userId, totalSpent: payment.amountPaise },
            update: { totalSpent: { increment: payment.amountPaise } },
          });
        }
      });

      await prisma.auditLog.create({
        data: {
          userId: session.userId,
          action: 'PAYMENT',
          entityType: 'Payment',
          entityId: paymentId,
          oldValue: { status: payment.status, bookingRef: payment.booking?.bookingRef },
          newValue: {
            status: 'COMPLETED',
            method,
            amountPaise: payment.amountPaise,
            bookingRef: payment.booking?.bookingRef,
          },
        },
      }).catch(() => {});

      return apiSuccess({
        message: `Payment of ₹${(payment.amountPaise / 100).toLocaleString('en-IN')} settled via ${method}.`,
      });
    }

    if (action === 'REFUND') {
      if (payment.method === 'RAZORPAY' || payment.gatewayPaymentId) {
        throw new ValidationError('Issue the refund in Razorpay first; this app does not process gateway refunds from the admin panel.');
      }
      if (!['COMPLETED', 'PARTIALLY_REFUNDED'].includes(payment.status)) {
        throw new ConflictError('Only completed payments can be refunded.');
      }

      const alreadyRefundedPaise = payment.refunds.reduce((sum, r) => sum + r.amountPaise, 0);
      const maxRefundablePaise = payment.amountPaise - alreadyRefundedPaise;

      if (maxRefundablePaise <= 0) {
        throw new ConflictError('This payment has already been fully refunded.');
      }

      const amountToRefund = refundAmountPaise ?? maxRefundablePaise;
      if (amountToRefund > maxRefundablePaise) {
        throw new ValidationError(
          `Refund amount cannot exceed remaining refundable balance of ₹${(maxRefundablePaise / 100).toLocaleString('en-IN')}.`
        );
      }

      const newPaymentStatus =
        alreadyRefundedPaise + amountToRefund >= payment.amountPaise
          ? 'REFUNDED'
          : 'PARTIALLY_REFUNDED';

      await prisma.$transaction(async (tx) => {
        await tx.refund.create({
          data: {
            paymentId,
            amountPaise: amountToRefund,
            reason: reason || 'Refund processed by Administrator',
            status: 'COMPLETED',
            processedById: session.userId,
            processedAt: now,
          },
        });

        await tx.payment.update({
          where: { id: paymentId },
          data: { status: newPaymentStatus },
        });

        if (!isGuestUser && payment.userId) {
          const profile = await tx.customerProfile.findUnique({
            where: { userId: payment.userId },
          });
          if (profile) {
            await tx.customerProfile.update({
              where: { userId: payment.userId },
              data: {
                totalSpent: Math.max(0, profile.totalSpent - amountToRefund),
              },
            });
          }
        }
      });

      if (!isGuestUser && payment.userId) {
        await prisma.notification.create({
          data: {
            userId: payment.userId,
            title: 'Refund Processed',
            message: `A refund of ₹${(amountToRefund / 100).toLocaleString('en-IN')} has been processed for booking ${payment.booking?.bookingRef || ''}.${reason ? ` Note: ${reason}` : ''}`,
            type: 'PAYMENT_RECEIVED',
          },
        }).catch(() => {});
      }

      await prisma.auditLog.create({
        data: {
          userId: session.userId,
          action: 'REFUND',
          entityType: 'Payment',
          entityId: paymentId,
          oldValue: { status: payment.status, refundedPaise: alreadyRefundedPaise },
          newValue: {
            status: newPaymentStatus,
            refundAmountPaise: amountToRefund,
            reason: reason || 'Refund processed by Administrator',
            bookingRef: payment.booking?.bookingRef,
          },
        },
      }).catch(() => {});

      return apiSuccess({
        message: `Refund of ₹${(amountToRefund / 100).toLocaleString('en-IN')} processed successfully.`,
      });
    }

    throw new ConflictError('Unsupported action');
  } catch (error) {
    return handleApiError(error);
  }
}
