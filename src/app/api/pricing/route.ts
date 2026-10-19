import { NextResponse } from 'next/server';
import { apiSuccess } from '@/lib/errors';

export async function GET() {
  const pricingData = {
    plans: [
      {
        id: 'ps5-hourly',
        title: 'PS5 Single / Duo Hourly',
        category: 'PlayStation 5',
        pricePerHour: 200,
        pricePaise: 20000,
        badge: 'Most Popular',
        popular: true,
        features: [
          'PlayStation 5 Pro console',
          '55" 4K 120Hz OLED display',
          '2x Sony DualSense controllers',
          'Access to 200+ AAA games library',
          'High-speed low latency LAN',
          'Comfortable ergonomic seating',
        ],
        idealFor: 'Casual gaming, FIFA / Tekken tournaments with friends',
      },
      {
        id: 'ps5-squad',
        title: 'PS5 4-Player Squad Lounge',
        category: 'PlayStation 5',
        pricePerHour: 250,
        pricePaise: 25000,
        badge: 'Great for Groups',
        popular: false,
        features: [
          'PlayStation 5 Pro setup',
          '65" 4K HDR High Refresh TV',
          '4x DualSense Wireless controllers',
          'Surround sound audio experience',
          'Party games & 4-player co-op unlocked',
          'Snacks & beverage service to seat',
        ],
        idealFor: 'Party groups, 2v2 EA FC matchups, couch co-op',
      },
      {
        id: 'pool-standard',
        title: 'Championship Pool Hourly',
        category: 'Billiards & Pool',
        pricePerHour: 250,
        pricePaise: 25000,
        badge: 'Tournament Standard',
        popular: false,
        features: [
          '8ft Italian Slate tournament table',
          'Simonis 860 cloth (zero friction)',
          'Belgian Aramith Pro ball set',
          'Handcrafted Canadian maple cues',
          'Shadowless perimeter LED canopy',
          'Dedicated scoring board & chalk stations',
        ],
        idealFor: 'Competitive pool players, 8-ball & 9-ball matches',
      },
      {
        id: 'vip-all-night',
        title: 'All-Night Gaming Pass',
        category: 'Special Combo',
        pricePerHour: 150, // Effective hourly rate
        totalPrice: 900,
        pricePaise: 90000,
        badge: 'Best Value',
        popular: true,
        features: [
          '6 full hours of continuous gaming (11 PM – 5 AM / Open to Close)',
          'Choose between PS5 Pro or Pool Table',
          'Complimentary energy drink / beverage',
          'Priority station allocation',
          'Save over 35% compared to hourly rate',
        ],
        idealFor: 'Hardcore gamers, LAN parties, late night sessions',
      },
    ],
    rules: {
      peakHours: {
        days: ['Friday', 'Saturday', 'Sunday'],
        hours: '6:00 PM – 11:00 PM',
        surchargePercent: 10,
        description: 'High demand peak times during weekends',
      },
      offPeakHours: {
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
        hours: '11:00 AM – 4:00 PM',
        discountPercent: 15,
        description: 'Happy Hours: 15% discount automatically applied',
      },
      multiHourDiscount: {
        threeHoursPlus: '10% off automatically on bookings 3 hours or longer',
      },
      cancellationPolicy: {
        fullRefundHours: 2,
        terms: 'Full refund or free reschedule if cancelled at least 2 hours before session start time.',
      },
    },
    faqs: [
      {
        q: 'Do I need to bring my own controllers or games?',
        a: 'No! All stations come pre-loaded with our complete digital library of 200+ top titles, and sanitised official DualSense wireless controllers are provided. You are also welcome to bring your personal controller if you prefer.',
      },
      {
        q: 'Can I extend my session while playing?',
        a: 'Yes! As long as the next time slot for your station is not already reserved by another customer, you can request an instant extension through the staff or your customer portal.',
      },
      {
        q: 'What is your cancellation policy?',
        a: 'Bookings can be cancelled up to 2 hours before the scheduled start time for a 100% refund. Within 2 hours of the start time, reschedules may be available depending on station availability.',
      },
      {
        q: 'Can we book for private parties or gaming tournaments?',
        a: 'Absolutely! We offer custom venue buyouts and tournament packages for birthdays, corporate events, and esports battles. Contact our management directly via WhatsApp or phone.',
      },
    ],
  };

  return apiSuccess(pricingData, 200, {
    'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
  });
}
