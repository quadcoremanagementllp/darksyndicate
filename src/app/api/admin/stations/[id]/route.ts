import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, ConflictError, handleApiError, NotFoundError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { z } from 'zod';

const updateStationSchema = z.object({
  name: z.string().min(2).optional(),
  stationType: z.enum(['PS5', 'POOL_TABLE', 'PC', 'VR', 'OTHER']).optional(),
  pricePerHourPaise: z.number().int().positive().optional(),
  specs: z.string().optional(),
  capacity: z.number().int().min(1).optional(),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'DEACTIVATED']).optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole('STAFF', 'ADMIN', 'SUPER_ADMIN');
    const { id } = await params;
    const body = await req.json();
    const data = updateStationSchema.parse(body);

    const station = await prisma.gamingStation.findUnique({
      where: { id },
    });

    if (!station) {
      throw new NotFoundError('Station not found');
    }

    if (data.status === 'MAINTENANCE' || data.status === 'DEACTIVATED') {
      const activeSession = await prisma.gamingSession.findFirst({
        where: {
          stationId: id,
          status: { in: ['ACTIVE', 'PAUSED', 'EXTENDED', 'OVERDUE'] },
        },
        select: { id: true },
      });

      if (activeSession) {
        throw new ConflictError(
          `Cannot set ${station.name} to ${data.status} while a live gaming session is active on it.`
        );
      }
    }

    let newFacilityId: string | undefined;
    if (data.stationType && data.stationType !== station.stationType) {
      const facilities = await prisma.gamingFacility.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
      });
      const isPool = data.stationType === 'POOL_TABLE';
      const matched = facilities.find((f) =>
        isPool
          ? /pool|billiard|snooker/i.test(`${f.name} ${f.slug}`)
          : /ps5|playstation|console/i.test(`${f.name} ${f.slug}`)
      );
      if (matched) {
        newFacilityId = matched.id;
      }
    }

    const updated = await prisma.gamingStation.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.stationType ? { stationType: data.stationType } : {}),
        ...(newFacilityId ? { facilityId: newFacilityId } : {}),
        ...(data.pricePerHourPaise ? { pricePerHourPaise: data.pricePerHourPaise } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.specs !== undefined || data.capacity !== undefined
          ? {
              metadata: {
                ...((station.metadata as any) || {}),
                ...(data.specs !== undefined ? { specs: data.specs } : {}),
                ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
              },
            }
          : {}),
      },
      include: { facility: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: data.status && data.status !== station.status ? 'STATUS_CHANGE' : 'UPDATE',
        entityType: 'GamingStation',
        entityId: id,
        oldValue: {
          name: station.name,
          stationType: station.stationType,
          pricePerHourPaise: station.pricePerHourPaise,
          status: station.status,
        },
        newValue: {
          name: updated.name,
          stationType: updated.stationType,
          pricePerHourPaise: updated.pricePerHourPaise,
          status: updated.status,
        },
      },
    }).catch(() => {});

    return apiSuccess({
      message: 'Station updated successfully',
      station: updated,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole('ADMIN', 'SUPER_ADMIN');
    const { id } = await params;

    const station = await prisma.gamingStation.findUnique({
      where: { id },
    });

    if (!station) {
      throw new NotFoundError('Station not found');
    }

    const activeSession = await prisma.gamingSession.findFirst({
      where: {
        stationId: id,
        status: { in: ['ACTIVE', 'PAUSED', 'EXTENDED', 'OVERDUE'] },
      },
      select: { id: true },
    });

    if (activeSession) {
      throw new ConflictError(
        `Cannot deactivate ${station.name} while a live gaming session is active on it.`
      );
    }

    // Soft-deactivate to preserve booking history
    await prisma.gamingStation.update({
      where: { id },
      data: { status: 'DEACTIVATED' },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: 'DELETE',
        entityType: 'GamingStation',
        entityId: id,
        oldValue: { name: station.name, status: station.status },
        newValue: { name: station.name, status: 'DEACTIVATED' },
      },
    }).catch(() => {});

    return apiSuccess({
      message: 'Station successfully deactivated',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
