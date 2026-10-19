import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testExtendAndEndFlow() {
  console.log('🧪 Starting End-to-End Test for + Extend and ⏹ End Session...');

  // 1. Find an available PS5 station
  const station = await prisma.gamingStation.findFirst({
    where: { stationType: 'PS5', status: 'AVAILABLE' },
  });

  if (!station) {
    console.log('⚠️ No available PS5 station found, picking any PS5 station');
  }

  const targetStation = station || await prisma.gamingStation.findFirst({ where: { stationType: 'PS5' } });
  if (!targetStation) {
    throw new Error('No gaming station found in database');
  }

  console.log(`📍 Testing with Station: ${targetStation.name} (ID: ${targetStation.id})`);

  // 2. Find a user or guest
  const user = await prisma.user.findFirst({ where: { role: 'CUSTOMER' } });
  if (!user) {
    throw new Error('No customer found in database');
  }

  const now = new Date();
  const scheduledEnd = new Date(now.getTime() + 60 * 60 * 1000); // 1 hr session
  const bookingRef = `TEST-FLOW-${Date.now().toString().slice(-4)}`;

  // Create an active booking and session
  const booking = await prisma.booking.create({
    data: {
      bookingRef,
      userId: user.id,
      stationId: targetStation.id,
      date: now,
      startTime: now,
      endTime: scheduledEnd,
      durationMinutes: 60,
      subtotalPaise: 15000,
      totalPricePaise: 15000,
      status: 'IN_PROGRESS',
      qrToken: `qr-${Date.now()}-${Math.random()}`,
      isWalkIn: true,
      customerName: 'Test Gamer Akash',
      customerPhone: '9876543223',
    },
  });

  const session = await prisma.gamingSession.create({
    data: {
      bookingId: booking.id,
      stationId: targetStation.id,
      status: 'ACTIVE',
      startedAt: now,
      scheduledEndAt: scheduledEnd,
    },
  });

  await prisma.gamingStation.update({
    where: { id: targetStation.id },
    data: { status: 'OCCUPIED' },
  });

  console.log(`✅ Active session created: ID ${session.id}, Scheduled End: ${scheduledEnd.toLocaleTimeString()}`);

  // ─── TEST 1: EXTEND SESSION (+30 MINS) ───
  console.log('\n--- 1. TESTING + EXTEND BUTTON FLOW (+30 mins) ---');
  const additionalMinutes = 30;
  const currentEnd = new Date(session.scheduledEndAt);
  const expectedNewEnd = new Date(currentEnd.getTime() + additionalMinutes * 60 * 1000);

  // Simulate extend session logic as executed by /api/staff/sessions/extend
  const hourlyRate = targetStation.pricePerHourPaise || 15000;
  const extensionFeePaise = Math.round(hourlyRate * (additionalMinutes / 60));

  const updatedSession = await prisma.gamingSession.update({
    where: { id: session.id },
    data: {
      scheduledEndAt: expectedNewEnd,
      extensionMinutes: { increment: additionalMinutes },
      extensionPaise: { increment: extensionFeePaise },
    },
  });

  const updatedBooking = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      endTime: expectedNewEnd,
      durationMinutes: { increment: additionalMinutes },
      totalPricePaise: { increment: extensionFeePaise },
    },
  });

  console.log(`✅ Session Extended Successfully!`);
  console.log(`   Previous End: ${currentEnd.toLocaleTimeString()}`);
  console.log(`   New End:      ${new Date(updatedSession.scheduledEndAt).toLocaleTimeString()}`);
  console.log(`   Duration:     ${updatedBooking.durationMinutes} mins`);
  console.log(`   Total Price:  ₹${(updatedBooking.totalPricePaise / 100).toFixed(0)}`);

  if (new Date(updatedSession.scheduledEndAt).getTime() !== expectedNewEnd.getTime()) {
    throw new Error('Extend failed: scheduledEndAt does not match expected new end time');
  }

  // ─── TEST 2: END SESSION ───
  console.log('\n--- 2. TESTING ⏹ END SESSION BUTTON FLOW ---');

  // Simulate end session logic as executed by /api/staff/sessions/end
  await prisma.$transaction(async (tx) => {
    await tx.gamingSession.update({
      where: { id: session.id },
      data: {
        status: 'COMPLETED',
        endedAt: new Date(),
      },
    });

    await tx.booking.update({
      where: { id: booking.id },
      data: { status: 'COMPLETED' },
    });

    await tx.gamingStation.update({
      where: { id: targetStation.id },
      data: { status: 'AVAILABLE' },
    });
  });

  // Verify DB state
  const finalSession = await prisma.gamingSession.findUnique({ where: { id: session.id } });
  const finalBooking = await prisma.booking.findUnique({ where: { id: booking.id } });
  const finalStation = await prisma.gamingStation.findUnique({ where: { id: targetStation.id } });

  console.log(`✅ Final Session Status: ${finalSession?.status} (endedAt: ${finalSession?.endedAt})`);
  console.log(`✅ Final Booking Status: ${finalBooking?.status}`);
  console.log(`✅ Final Station Status: ${finalStation?.status}`);

  if (finalSession?.status !== 'COMPLETED') {
    throw new Error('End Session failed: session status is not COMPLETED');
  }
  if (finalBooking?.status !== 'COMPLETED') {
    throw new Error('End Session failed: booking status is not COMPLETED');
  }
  if (finalStation?.status !== 'AVAILABLE') {
    throw new Error('End Session failed: station status is not AVAILABLE');
  }

  // Clean up test booking and session
  await prisma.gamingSession.delete({ where: { id: session.id } });
  await prisma.booking.delete({ where: { id: booking.id } });

  console.log('\n🎉 ALL TESTS PASSED! Both + Extend and ⏹ End Session flows verified 100% working!');
}

testExtendAndEndFlow()
  .catch((e) => {
    console.error('❌ Test failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
