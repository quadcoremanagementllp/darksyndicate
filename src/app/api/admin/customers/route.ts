import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, ConflictError, handleApiError, NotFoundError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { syncExpiredMemberships } from '@/lib/memberships';
import { deleteAccountRecords } from '@/lib/accountDeletion';
import { z } from 'zod';

const updateCustomerStatusSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(['ACTIVE', 'BLOCKED', 'DEACTIVATED', 'SUSPENDED']),
});

async function requireAdmin() {
  return await requireRole('ADMIN', 'SUPER_ADMIN');
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    await syncExpiredMemberships();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';

    const customers = await prisma.user.findMany({
      where: {
        role: 'CUSTOMER',
        email: { not: 'guest@darksyndicate.in' },
        ...(search
          ? {
              OR: [
                { firstName: { contains: search } },
                { lastName: { contains: search } },
                { email: { contains: search } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
      include: {
        customerProfile: true,
        bookings: {
          where: { status: { notIn: ['CANCELLED', 'PAYMENT_FAILED'] } },
          select: { id: true, totalPricePaise: true, status: true },
        },
        payments: {
          where: { status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] } },
          select: {
            amountPaise: true,
            refunds: { where: { status: 'COMPLETED' }, select: { amountPaise: true } },
          },
        },
        memberships: {
          where: { status: { not: 'CANCELLED' } },
          orderBy: { expiresAt: 'desc' },
          include: { plan: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 250,
    });

    return apiSuccess(
      customers.map((c) => {
        const netBookingSpendPaise = c.payments.reduce((sum, p) => {
          const refunded = p.refunds.reduce((rSum, r) => rSum + r.amountPaise, 0);
          return sum + Math.max(0, p.amountPaise - refunded);
        }, 0);
        const membershipSpendPaise = c.memberships.reduce(
          (sum, m) => sum + (m.pricePaidPaise || 0),
          0
        );
        const calculatedSpendPaise = netBookingSpendPaise + membershipSpendPaise;
        const totalSpentPaise = Math.max(c.customerProfile?.totalSpent || 0, calculatedSpendPaise);

        const activeMembership =
          c.memberships.find(
            (m) => m.status === 'ACTIVE' && new Date(m.expiresAt).getTime() > Date.now()
          ) || null;

        return {
          id: c.id,
          name: `${c.firstName} ${c.lastName}`.trim(),
          email: c.email,
          phone: c.phone || '—',
          status: c.status === 'BLOCKED' ? 'SUSPENDED' : c.status,
          totalBookings: c.bookings.length,
          totalSpentPaise,
          joinedAt: c.createdAt,
          membership: activeMembership
            ? {
                id: activeMembership.id,
                planName: activeMembership.planNameSnapshot,
                tier: activeMembership.tierSnapshot,
                discountPercent: activeMembership.discountPercent,
                expiresAt: activeMembership.expiresAt,
              }
            : null,
        };
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json();
    const { userId, status } = updateCustomerStatusSchema.parse(body);
    const dbStatus: 'ACTIVE' | 'BLOCKED' | 'DEACTIVATED' =
      status === 'SUSPENDED' ? 'BLOCKED' : status;

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, status: true, firstName: true, lastName: true },
    });

    if (!existing) {
      throw new NotFoundError('Customer account');
    }

    if (existing.email === 'guest@darksyndicate.in') {
      throw new ConflictError('Cannot suspend or modify the system walk-in guest account.');
    }

    const now = new Date();
    let cancelledFutureBookingsCount = 0;

    const user = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { status: dbStatus },
      });

      if (dbStatus === 'BLOCKED' || dbStatus === 'DEACTIVATED') {
        const upcomingBookings = await tx.booking.findMany({
          where: {
            userId,
            status: { in: ['PENDING', 'CONFIRMED'] },
            startTime: { gt: now },
          },
          select: { id: true },
        });

        cancelledFutureBookingsCount = upcomingBookings.length;

        if (upcomingBookings.length > 0) {
          const bookingIds = upcomingBookings.map((b) => b.id);
          await tx.booking.updateMany({
            where: { id: { in: bookingIds } },
            data: {
              status: 'CANCELLED',
              cancelledAt: now,
              cancelReason: 'Customer account suspended by Admin',
            },
          });

          await tx.payment.updateMany({
            where: { bookingId: { in: bookingIds }, status: 'PENDING' },
            data: { status: 'FAILED' },
          });
        }
      }

      return updatedUser;
    });

    // Notify customer of status change
    await prisma.notification.create({
      data: {
        userId,
        title: dbStatus === 'ACTIVE' ? 'Account Reactivated' : 'Account Suspended',
        message:
          dbStatus === 'ACTIVE'
            ? 'Your Dark Syndicate account has been reactivated. You can now book gaming sessions online.'
            : `Your Dark Syndicate account has been suspended by an administrator.${
                cancelledFutureBookingsCount > 0
                  ? ` ${cancelledFutureBookingsCount} upcoming reservation(s) were automatically cancelled.`
                  : ''
              }`,
        type: 'ACCOUNT_UPDATE',
      },
    }).catch(() => {});

    // Record system audit log
    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: 'STATUS_CHANGE',
        entityType: 'User',
        entityId: userId,
        oldValue: { status: existing.status },
        newValue: {
          status: dbStatus,
          customerName: `${existing.firstName} ${existing.lastName}`.trim(),
          cancelledFutureBookingsCount,
        },
      },
    }).catch(() => { /* non-blocking audit */ });

    return apiSuccess({
      message: `Customer status updated to ${status}${
        cancelledFutureBookingsCount > 0
          ? ` (${cancelledFutureBookingsCount} upcoming booking(s) cancelled)`
          : ''
      }`,
      user: { id: user.id, status: user.status === 'BLOCKED' ? 'SUSPENDED' : user.status },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const { userId } = z.object({ userId: z.string().min(1) }).parse(await req.json());
    const customer = await prisma.user.findUnique({ where: { id: userId } });
    if (!customer || customer.role !== 'CUSTOMER') throw new NotFoundError('Customer account');
    if (customer.email === 'guest@darksyndicate.in') throw new ConflictError('The system guest account cannot be deleted.');

    await prisma.$transaction(async (tx) => {
      await deleteAccountRecords(tx, customer);
      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: 'DELETE',
          entityType: 'User',
          entityId: customer.id,
          oldValue: { name: `${customer.firstName} ${customer.lastName}`.trim(), email: customer.email, role: customer.role },
        },
      });
    }, { timeout: 20000 });
    return apiSuccess({ message: 'Customer account deleted. Historical financial records were retained.' });
  } catch (error) {
    return handleApiError(error);
  }
}
