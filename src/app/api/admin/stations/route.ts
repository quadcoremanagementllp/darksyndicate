import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError, NotFoundError, ValidationError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { z } from 'zod';

const createStationSchema = z.object({
  name: z.string().min(2, 'Station name is required'),
  facilityId: z.string().optional(),
  stationType: z.enum(['PS5', 'POOL_TABLE', 'PC', 'VR', 'OTHER']).default('PS5'),
  pricePerHourPaise: z.number().int().positive('Hourly rate must be greater than zero'),
  specs: z.string().optional(),
  capacity: z.number().int().min(1).default(2),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'DEACTIVATED']).default('AVAILABLE'),
});

export async function GET(req: NextRequest) {
  try {
    await requireRole('ADMIN', 'SUPER_ADMIN', 'STAFF');
    const { searchParams } = new URL(req.url);
    const includeDeactivated = searchParams.get('includeDeactivated') === 'true';

    const stations = await prisma.gamingStation.findMany({
      where: includeDeactivated ? {} : { status: { not: 'DEACTIVATED' } },
      include: { facility: true },
      orderBy: [{ facilityId: 'asc' }, { displayOrder: 'asc' }],
    });

    return apiSuccess(
      stations.map((st) => ({
        id: st.id,
        name: st.name,
        facilityId: st.facilityId,
        facilityName: st.facility?.name || 'Main Facility',
        stationType: st.stationType,
        pricePerHourPaise: st.pricePerHourPaise,
        specs: (st.metadata as any)?.specs ?? st.description ?? '',
        capacity: (st.metadata as any)?.capacity || (st.stationType === 'PS5' ? 2 : 4),
        status: st.status,
        displayOrder: st.displayOrder,
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole('ADMIN', 'SUPER_ADMIN');
    const body = await req.json();
    const data = createStationSchema.parse(body);

    // Resolve facility matching stationType if not explicitly provided
    let facilityId = data.facilityId;
    if (!facilityId) {
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
      facilityId = matched?.id || facilities[0]?.id;

      if (!facilityId) {
        const createdFac = await prisma.gamingFacility.create({
          data: {
            name: isPool ? 'Billiards & Pool Lounge' : 'PlayStation 5 Pro Arena',
            slug: isPool ? 'pool-lounge' : 'ps5-pro-arena',
            description: isPool ? 'Tournament Pool & Snooker Tables' : '4K 120Hz PS5 Pro Gaming Stations',
            isActive: true,
          },
        });
        facilityId = createdFac.id;
      }
    }

    const count = await prisma.gamingStation.count();

    const station = await prisma.gamingStation.create({
      data: {
        name: data.name,
        facilityId: facilityId as string,
        stationType: data.stationType,
        pricePerHourPaise: data.pricePerHourPaise,
        status: data.status,
        displayOrder: count + 1,
        metadata: {
          specs: data.specs,
          capacity: data.capacity,
        },
      },
      include: { facility: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: 'CREATE',
        entityType: 'GamingStation',
        entityId: station.id,
        newValue: {
          name: station.name,
          stationType: station.stationType,
          pricePerHourPaise: station.pricePerHourPaise,
          status: station.status,
          facilityName: station.facility?.name,
        },
      },
    }).catch(() => {});

    return apiSuccess(
      {
        id: station.id,
        name: station.name,
        facilityId: station.facilityId,
        facilityName: station.facility?.name,
        stationType: station.stationType,
        pricePerHourPaise: station.pricePerHourPaise,
        specs: data.specs,
        capacity: data.capacity,
        status: station.status,
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
