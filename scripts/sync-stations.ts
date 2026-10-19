import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Syncing facilities and stations to exact user specification...');

  // 1. Upsert PS5 Facility
  let ps5Facility = await prisma.gamingFacility.findFirst({
    where: { OR: [{ slug: 'ps5-gaming' }, { id: 'fac-ps5' }, { name: { contains: 'PS5' } }] },
  });

  if (ps5Facility) {
    ps5Facility = await prisma.gamingFacility.update({
      where: { id: ps5Facility.id },
      data: {
        name: 'PlayStation 5 Arena',
        slug: 'ps5-gaming',
        description:
          '3 PlayStation 5 setups featuring 55-inch 4K 120Hz OLED displays, low-latency HDMI 2.1, Sony DualSense wireless controllers, and competitive gaming headsets. Single player ₹150/hr, 2 players ₹200/hr, 3-4 players ₹250/hr.',
        shortDesc: '3 PS5 Stations · From ₹150/hr',
        displayOrder: 1,
        isActive: true,
      },
    });
  } else {
    ps5Facility = await prisma.gamingFacility.create({
      data: {
        id: 'fac-ps5',
        name: 'PlayStation 5 Arena',
        slug: 'ps5-gaming',
        description:
          '3 PlayStation 5 setups featuring 55-inch 4K 120Hz OLED displays, low-latency HDMI 2.1, Sony DualSense wireless controllers, and competitive gaming headsets. Single player ₹150/hr, 2 players ₹200/hr, 3-4 players ₹250/hr.',
        shortDesc: '3 PS5 Stations · From ₹150/hr',
        icon: 'Gamepad2',
        displayOrder: 1,
        isActive: true,
      },
    });
  }

  // 2. Upsert Snooker Facility
  let snookerFacility = await prisma.gamingFacility.findFirst({
    where: {
      OR: [
        { slug: 'snooker-tables' },
        { slug: 'pool-tables' },
        { id: 'fac-snooker' },
        { id: 'fac-pool' },
        { name: { contains: 'Pool' } },
        { name: { contains: 'Snooker' } },
      ],
    },
  });

  if (snookerFacility) {
    snookerFacility = await prisma.gamingFacility.update({
      where: { id: snookerFacility.id },
      data: {
        name: 'Snooker Lounge',
        slug: 'snooker-tables',
        description:
          '3 championship snooker tables with premium accessories. ₹250/hr per table for 3-4 players, +₹50 per extra person beyond 4.',
        shortDesc: '3 Snooker Tables · ₹250/hr per table',
        displayOrder: 2,
        isActive: true,
      },
    });
  } else {
    snookerFacility = await prisma.gamingFacility.create({
      data: {
        id: 'fac-snooker',
        name: 'Snooker Lounge',
        slug: 'snooker-tables',
        description:
          '3 championship snooker tables with premium accessories. ₹250/hr per table for 3-4 players, +₹50 per extra person beyond 4.',
        shortDesc: '3 Snooker Tables · ₹250/hr per table',
        icon: 'CircleDot',
        displayOrder: 2,
        isActive: true,
      },
    });
  }

  // Deactivate any excess stations beyond the 3 PS5 and 3 Snooker tables
  const allStations = await prisma.gamingStation.findMany();
  for (const st of allStations) {
    // If not matching our 3 PS5 or 3 Snooker stations, mark DEACTIVATED
    const isTargetPs5 = st.stationType === 'PS5' && ['PS5 Station 1', 'PS5 Station 2', 'PS5 Station 3'].includes(st.name);
    const isTargetSnooker = st.stationType === 'POOL_TABLE' && ['Snooker Table 1', 'Snooker Table 2', 'Snooker Table 3'].includes(st.name);

    if (!isTargetPs5 && !isTargetSnooker) {
      await prisma.gamingStation.update({
        where: { id: st.id },
        data: { status: 'DEACTIVATED' },
      });
    }
  }

  // 3. Ensure exactly 3 PS5 stations
  for (let i = 1; i <= 3; i++) {
    const stationName = `PS5 Station ${i}`;
    const existing = await prisma.gamingStation.findFirst({
      where: { name: stationName, facilityId: ps5Facility.id },
    });

    const stationData = {
      facilityId: ps5Facility.id,
      name: stationName,
      stationType: 'PS5' as const,
      description: `Sony PS5, 55" LG OLED 4K 120Hz, DualSense Controllers, SteelSeries 3D Audio. Single ₹150/hr, Duo ₹200/hr, Squad (3-4) ₹250/hr.`,
      pricePerHourPaise: 15000,
      status: 'AVAILABLE' as const,
      displayOrder: i,
    };

    if (existing) {
      await prisma.gamingStation.update({
        where: { id: existing.id },
        data: stationData,
      });
    } else {
      await prisma.gamingStation.create({
        data: {
          id: `station-ps5-0${i}`,
          ...stationData,
        },
      });
    }
  }

  // 4. Ensure exactly 3 Snooker tables
  for (let i = 1; i <= 3; i++) {
    const tableName = `Snooker Table ${i}`;
    const existing = await prisma.gamingStation.findFirst({
      where: {
        OR: [
          { name: tableName },
          { name: `Pool Table ${String.fromCharCode(64 + i)}` },
          { name: `Championship Pool Table ${i}` },
          { name: `Executive Pool Table ${i}` },
          { name: `VIP Private Pool Table ${i}` },
        ],
      },
    });

    const tableData = {
      facilityId: snookerFacility.id,
      name: tableName,
      stationType: 'POOL_TABLE' as const,
      description: `Full-size Championship Snooker Table, Shadowless LED Canopy, Premium Cues & Accessories. ₹250/hr (3-4 players), +₹50 per extra person.`,
      pricePerHourPaise: 25000,
      status: 'AVAILABLE' as const,
      displayOrder: i,
    };

    if (existing) {
      await prisma.gamingStation.update({
        where: { id: existing.id },
        data: tableData,
      });
    } else {
      await prisma.gamingStation.create({
        data: {
          id: `station-snooker-0${i}`,
          ...tableData,
        },
      });
    }
  }

  console.log('✅ Successfully synchronized: exactly 3 PS5 stations and 3 Snooker tables active!');
}

main()
  .catch((e) => {
    console.error('Error during station sync:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
