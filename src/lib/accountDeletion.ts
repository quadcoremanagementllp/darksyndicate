import type { Prisma } from '@prisma/client';
import { ConflictError } from '@/lib/errors';

/** Remove an account while keeping financial and booking records on the system guest account. */
export async function deleteAccountRecords(
  tx: Prisma.TransactionClient,
  account: { id: string; firstName: string; lastName: string; phone: string | null },
) {
  const activeBooking = await tx.booking.findFirst({
    where: { userId: account.id, status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] } },
    select: { id: true },
  });
  if (activeBooking) throw new ConflictError('This account has an active or upcoming booking. Complete or cancel it before deleting the account.');

  const guest = await tx.user.upsert({
    where: { email: 'guest@darksyndicate.in' },
    update: {},
    create: {
      email: 'guest@darksyndicate.in',
      passwordHash: 'LOCKED_GUEST_ACCOUNT',
      firstName: 'Walk-in',
      lastName: 'Gamer',
      role: 'CUSTOMER',
    },
    select: { id: true },
  });

  const accountName = `${account.firstName} ${account.lastName}`.trim();
  await tx.booking.updateMany({
    where: { userId: account.id, customerName: null },
    data: { customerName: accountName, customerPhone: account.phone },
  });
  await tx.booking.updateMany({ where: { userId: account.id }, data: { userId: guest.id } });
  await tx.payment.updateMany({ where: { userId: account.id }, data: { userId: guest.id } });
  await tx.couponRedemption.updateMany({ where: { userId: account.id }, data: { userId: guest.id } });
  await tx.membership.updateMany({ where: { userId: account.id }, data: { userId: guest.id, status: 'CANCELLED' } });
  await tx.gamingSession.updateMany({ where: { staffId: account.id }, data: { staffId: null } });
  await tx.refund.updateMany({ where: { processedById: account.id }, data: { processedById: null } });
  await tx.auditLog.updateMany({ where: { userId: account.id }, data: { userId: null } });
  await tx.staffActivityLog.deleteMany({ where: { userId: account.id } });
  // These are historical actor IDs without foreign keys; clear stale references.
  await tx.booking.updateMany({ where: { cancelledBy: account.id }, data: { cancelledBy: null } });
  await tx.payment.updateMany({ where: { recordedByStaffId: account.id }, data: { recordedByStaffId: null } });
  await tx.user.delete({ where: { id: account.id } });
}
