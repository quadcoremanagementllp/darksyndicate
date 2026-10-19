import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';

async function main() {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Demo seed is disabled. Set ALLOW_DEMO_SEED=true only in a disposable development database.');
  }
  console.log('🎮 Seeding DARK SYNDICATE database...\n');

  // ─── 1. Create Super Admin ────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin@123456', 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@darksyndicate.com' },
    update: {},
    create: {
      email: 'admin@darksyndicate.com',
      phone: '+919999999999',
      passwordHash: adminPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });

  console.log(`✅ Super Admin created: ${superAdmin.email}`);

  // ─── 2. Create Staff Account ──────────────────────────────────────────────
  const staffPassword = await bcrypt.hash('Staff@123456', 12);

  const staff = await prisma.user.upsert({
    where: { email: 'staff@darksyndicate.com' },
    update: {},
    create: {
      email: 'staff@darksyndicate.com',
      phone: '+919888888888',
      passwordHash: staffPassword,
      firstName: 'Staff',
      lastName: 'Member',
      role: 'STAFF',
      status: 'ACTIVE',
    },
  });

  console.log(`✅ Staff account created: ${staff.email}`);

  // ─── 3. Create Demo Customer ──────────────────────────────────────────────
  const customerPassword = await bcrypt.hash('Customer@123', 12);

  const customer = await prisma.user.upsert({
    where: { email: 'player@example.com' },
    update: {},
    create: {
      email: 'player@example.com',
      phone: '+919777777777',
      passwordHash: customerPassword,
      firstName: 'Demo',
      lastName: 'Player',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      customerProfile: {
        create: {},
      },
    },
  });

  console.log(`✅ Demo customer created: ${customer.email}`);

  // ─── 4. Create Gaming Facilities ─────────────────────────────────────────
  const ps5Facility = await prisma.gamingFacility.upsert({
    where: { slug: 'ps5-gaming' },
    update: {},
    create: {
      name: 'PS5 Gaming',
      slug: 'ps5-gaming',
      description:
        'Experience next-gen gaming on PlayStation 5 with stunning 4K visuals, immersive DualSense controllers, and the latest AAA titles. Our PS5 stations feature premium gaming monitors and comfortable racing seats.',
      shortDesc: 'Next-gen console gaming with 4K visuals',
      icon: 'Gamepad2',
      displayOrder: 1,
      isActive: true,
    },
  });

  const poolFacility = await prisma.gamingFacility.upsert({
    where: { slug: 'pool-tables' },
    update: {},
    create: {
      name: 'Pool Tables',
      slug: 'pool-tables',
      description:
        'Premium regulation-size pool tables with tournament-grade cloth and professional cues. Perfect for casual games with friends or competitive matches.',
      shortDesc: 'Professional pool tables for all skill levels',
      icon: 'CircleDot',
      displayOrder: 2,
      isActive: true,
    },
  });

  console.log('✅ Gaming facilities created');

  // ─── 5. Create Gaming Stations ────────────────────────────────────────────
  const ps5Stations = [];
  for (let i = 1; i <= 6; i++) {
    const station = await prisma.gamingStation.create({
      data: {
        facilityId: ps5Facility.id,
        name: `PS5 Station ${i}`,
        stationType: 'PS5',
        description: `PlayStation 5 gaming station with 4K monitor and DualSense controller`,
        pricePerHourPaise: 20000, // ₹200/hour
        status: 'AVAILABLE',
        displayOrder: i,
      },
    });
    ps5Stations.push(station);
  }

  for (let i = 1; i <= 3; i++) {
    await prisma.gamingStation.create({
      data: {
        facilityId: poolFacility.id,
        name: `Pool Table ${String.fromCharCode(64 + i)}`, // A, B, C
        stationType: 'POOL_TABLE',
        description: `Regulation-size pool table with premium cloth and professional cue set`,
        pricePerHourPaise: 30000, // ₹300/hour
        status: 'AVAILABLE',
        displayOrder: i,
      },
    });
  }

  console.log('✅ Gaming stations created (6 PS5 + 3 Pool)');

  // ─── 6. Create Pricing Rules ──────────────────────────────────────────────
  await prisma.pricingRule.createMany({
    data: [
      {
        stationType: 'PS5',
        pricingType: 'STANDARD',
        name: 'PS5 Standard Rate',
        pricePerHourPaise: 20000,
        isActive: true,
        priority: 0,
      },
      {
        stationType: 'PS5',
        pricingType: 'PEAK',
        name: 'PS5 Weekend Peak',
        pricePerHourPaise: 25000,
        dayOfWeek: JSON.stringify([0, 6]), // Sunday, Saturday
        startTime: '18:00',
        endTime: '23:00',
        isActive: true,
        priority: 10,
      },
      {
        stationType: 'POOL_TABLE',
        pricingType: 'STANDARD',
        name: 'Pool Table Standard Rate',
        pricePerHourPaise: 30000,
        isActive: true,
        priority: 0,
      },
    ],
  });

  console.log('✅ Pricing rules created');

  // ─── 7. Create Website Settings ───────────────────────────────────────────
  const settings = [
    // General
    { key: 'venue_name', value: 'DARK SYNDICATE GAMING WORLD', group: 'general', dataType: 'string', label: 'Venue Name' },
    { key: 'venue_address', value: 'Your Gaming Zone Address, City, State, PIN', group: 'general', dataType: 'string', label: 'Venue Address' },
    { key: 'venue_phone', value: '+91 98765 43210', group: 'general', dataType: 'string', label: 'Contact Number' },
    { key: 'venue_email', value: 'hello@darksyndicate.com', group: 'general', dataType: 'string', label: 'Contact Email' },
    { key: 'venue_whatsapp', value: '+919876543210', group: 'general', dataType: 'string', label: 'WhatsApp Number' },
    { key: 'venue_maps_url', value: 'https://maps.google.com/?q=your+address', group: 'general', dataType: 'string', label: 'Google Maps URL' },
    { key: 'currency', value: 'INR', group: 'general', dataType: 'string', label: 'Currency' },
    { key: 'timezone', value: 'Asia/Kolkata', group: 'general', dataType: 'string', label: 'Timezone' },

    // Business Hours
    { key: 'opening_time', value: '10:00', group: 'hours', dataType: 'string', label: 'Opening Time' },
    { key: 'closing_time', value: '23:00', group: 'hours', dataType: 'string', label: 'Closing Time' },
    { key: 'closed_days', value: '[]', group: 'hours', dataType: 'json', label: 'Closed Days' },

    // Booking Rules
    { key: 'min_booking_duration', value: '30', group: 'booking', dataType: 'number', label: 'Min Booking Duration (min)' },
    { key: 'max_booking_duration', value: '480', group: 'booking', dataType: 'number', label: 'Max Booking Duration (min)' },
    { key: 'advance_booking_days', value: '30', group: 'booking', dataType: 'number', label: 'Advance Booking Days' },
    { key: 'session_grace_minutes', value: '5', group: 'booking', dataType: 'number', label: 'Session Grace Period (min)' },
    { key: 'allow_walk_ins', value: 'true', group: 'booking', dataType: 'boolean', label: 'Allow Walk-ins' },

    // Cancellation
    { key: 'cancellation_allowed', value: 'true', group: 'cancellation', dataType: 'boolean', label: 'Cancellation Allowed' },
    { key: 'cancellation_hours_before', value: '2', group: 'cancellation', dataType: 'number', label: 'Cancel Before (hours)' },
    { key: 'cancellation_refund_percent', value: '100', group: 'cancellation', dataType: 'number', label: 'Refund Percentage' },

    // Payment
    { key: 'payment_mode', value: 'mock', group: 'payment', dataType: 'string', label: 'Payment Mode' },
    { key: 'accept_cash', value: 'true', group: 'payment', dataType: 'boolean', label: 'Accept Cash' },
    { key: 'accept_online', value: 'true', group: 'payment', dataType: 'boolean', label: 'Accept Online Payment' },

    // Social Links
    { key: 'social_instagram', value: '', group: 'social', dataType: 'string', label: 'Instagram URL' },
    { key: 'social_facebook', value: '', group: 'social', dataType: 'string', label: 'Facebook URL' },
    { key: 'social_twitter', value: '', group: 'social', dataType: 'string', label: 'Twitter/X URL' },
    { key: 'social_youtube', value: '', group: 'social', dataType: 'string', label: 'YouTube URL' },

    // Website Content
    { key: 'hero_tagline', value: 'ENTER THE GAME. OWN THE NIGHT.', group: 'content', dataType: 'string', label: 'Hero Tagline' },
    { key: 'hero_subtitle', value: 'Premium gaming experience with PS5, pool tables, and more.', group: 'content', dataType: 'string', label: 'Hero Subtitle' },

    // Notification
    { key: 'notification_mode', value: 'mock', group: 'notification', dataType: 'string', label: 'Notification Mode' },
  ];

  for (const setting of settings) {
    await prisma.websiteSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log('✅ Website settings created');

  // ─── 8. Create Sample Testimonials ────────────────────────────────────────
  await prisma.testimonial.createMany({
    data: [
      {
        customerName: 'Rahul K.',
        content: 'Best gaming zone in the city! The PS5 experience is amazing with the 4K monitors. Love the ambiance.',
        rating: 5,
        isApproved: true,
        displayOrder: 1,
      },
      {
        customerName: 'Priya M.',
        content: 'Great pool tables and friendly staff. The booking system makes it so easy to reserve a spot. Highly recommended!',
        rating: 5,
        isApproved: true,
        displayOrder: 2,
      },
      {
        customerName: 'Arjun S.',
        content: 'The Dark Syndicate vibe is unmatched. Premium setup, comfortable seating, and the latest games. My go-to weekend spot.',
        rating: 4,
        isApproved: true,
        displayOrder: 3,
      },
    ],
  });

  console.log('✅ Sample testimonials created');

  // ─── 9. Create Sample Coupon ──────────────────────────────────────────────
  await prisma.coupon.upsert({
    where: { code: 'WELCOME20' },
    update: {},
    create: {
      code: 'WELCOME20',
      name: 'Welcome Discount',
      description: 'Get 20% off on your first booking!',
      discountType: 'PERCENTAGE',
      discountValue: 20, // 20%
      maxDiscountPaise: 10000, // Max ₹100 off
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      maxUses: 100,
      maxUsesPerUser: 1,
      isActive: true,
    },
  });

  console.log('✅ Sample coupon created (WELCOME20)');

  console.log('\n🎮 Database seeded successfully!');
  console.log('\n📋 Default Credentials:');
  console.log('   Super Admin: admin@darksyndicate.com / Admin@123456');
  console.log('   Staff:       staff@darksyndicate.com / Staff@123456');
  console.log('   Customer:    player@example.com / Customer@123\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
