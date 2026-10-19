import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, AuthError, ForbiddenError, handleApiError, ValidationError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { z } from 'zod';

const broadcastSchema = z.object({
  title: z.string().min(3, 'Title is required'),
  message: z.string().min(5, 'Message content is required'),
  target: z.enum(['ALL', 'CUSTOMERS', 'STAFF']).default('ALL'),
  type: z.enum([
    'SYSTEM',
    'BOOKING_CONFIRMED',
    'BOOKING_CANCELLED',
    'PAYMENT_RECEIVED',
    'SESSION_REMINDER',
    'SESSION_ENDING',
    'ACCOUNT_UPDATE',
  ]).default('SYSTEM'),
});

async function requireAdmin() {
  return await requireRole('ADMIN', 'SUPER_ADMIN');
}

export async function GET() {
  try {
    await requireAdmin();
    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'BroadcastNotification', action: 'CREATE' },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: { id: true, newValue: true, createdAt: true },
    });

    const history = logs.flatMap((log) => {
      const value = log.newValue;
      if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
      if (typeof value.title !== 'string' || typeof value.message !== 'string') return [];
      return [{
        id: log.id,
        title: value.title,
        message: value.message,
        target: typeof value.target === 'string' ? value.target : 'ALL',
        type: typeof value.type === 'string' ? value.type : 'SYSTEM',
        recipients: typeof value.recipients === 'number' ? value.recipients : 0,
        createdAt: log.createdAt,
      }];
    });

    return apiSuccess({ history });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const data = broadcastSchema.parse(await req.json());
    const users = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        email: { not: 'guest@darksyndicate.in' },
        role: data.target === 'CUSTOMERS'
          ? 'CUSTOMER'
          : data.target === 'STAFF'
            ? { in: ['STAFF', 'ADMIN', 'SUPER_ADMIN'] }
            : undefined,
      },
      select: { id: true },
    });
    if (users.length === 0) throw new ValidationError('No active users match the selected audience.');

    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.notification.createMany({
        data: users.map((user) => ({
          userId: user.id,
          type: data.type,
          title: data.title,
          message: data.message,
          isRead: false,
        })),
      });
      const audit = await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: 'CREATE',
          entityType: 'BroadcastNotification',
          entityId: `broadcast-${randomUUID()}`,
          newValue: { ...data, recipients: created.count },
        },
      });
      return { count: created.count, history: {
        id: audit.id,
        title: data.title,
        message: data.message,
        target: data.target,
        type: data.type,
        recipients: created.count,
        createdAt: audit.createdAt,
      } };
    });

    return apiSuccess({
      message: `Announcement broadcast to ${result.count} recipient${result.count === 1 ? '' : 's'}.`,
      recipientCount: result.count,
      history: result.history,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
