import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiSuccess, ForbiddenError, handleApiError, NotFoundError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { canManageStaffSession } from '@/lib/staffSessionRules';
import { staffAlertDismissalKey } from '@/lib/staffAlertDismissals';
import { readAlertDismissalIds, saveAlertDismissal } from '@/lib/staffAlertDismissalStorage';

const dismissalSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('booking'), resourceId: z.uuid(), stage: z.enum(['15m', '5m', 'due']) }),
  z.object({ kind: z.literal('session'), resourceId: z.uuid(), stage: z.enum(['15m', '10m', '5m', 'extra']) }),
]);

export async function GET() {
  try {
    await requireRole('STAFF', 'ADMIN', 'SUPER_ADMIN');
    const ids = await readAlertDismissalIds(
      async () => {
        const records = await prisma.staffAlertDismissal.findMany({ select: { id: true } });
        return records.map((record) => record.id);
      },
      async () => {
        const logs = await prisma.staffActivityLog.findMany({
          where: { action: 'DISMISS_ALERT', entityType: 'StaffAlertDismissal' },
          select: { entityId: true },
        });
        return logs.flatMap((log) => log.entityId ? [log.entityId] : []);
      },
    );
    return apiSuccess(ids, 200, { 'Cache-Control': 'no-store' });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const viewer = await requireRole('STAFF', 'ADMIN', 'SUPER_ADMIN');
    const input = dismissalSchema.parse(await req.json());

    if (input.kind === 'session') {
      const session = await prisma.gamingSession.findUnique({
        where: { id: input.resourceId },
        select: { staffId: true },
      });
      if (!session) throw new NotFoundError('Session');
      if (!canManageStaffSession(viewer.role, viewer.userId, session.staffId)) {
        throw new ForbiddenError('You cannot dismiss alerts for this session.');
      }
    } else {
      const booking = await prisma.booking.findUnique({
        where: { id: input.resourceId },
        select: { id: true },
      });
      if (!booking) throw new NotFoundError('Booking');
    }

    const id = staffAlertDismissalKey(input.kind, input.resourceId, input.stage);
    await saveAlertDismissal(
      async () => {
        await prisma.staffAlertDismissal.upsert({
          where: { id },
          update: {},
          create: {
            id,
            kind: input.kind,
            resourceId: input.resourceId,
            stage: input.stage,
            dismissedByUserId: viewer.userId,
          },
        });
      },
      async () => {
        const existing = await prisma.staffActivityLog.findFirst({
          where: { action: 'DISMISS_ALERT', entityType: 'StaffAlertDismissal', entityId: id },
          select: { id: true },
        });
        if (!existing) {
          await prisma.staffActivityLog.create({
            data: {
              userId: viewer.userId,
              action: 'DISMISS_ALERT',
              entityType: 'StaffAlertDismissal',
              entityId: id,
              details: { kind: input.kind, stage: input.stage },
            },
          });
        }
      },
    );
    return apiSuccess({ id });
  } catch (error) {
    return handleApiError(error);
  }
}
