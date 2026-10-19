import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError } from '@/lib/errors';

export async function GET() {
  try {
    let testimonials: any[] = [];
    let gallery: any[] = [];
    let settingsMap: Record<string, string> = {};

    try {
      const [testimonialRows, galleryRows, settings] = await Promise.all([
        prisma.testimonial.findMany({
          where: { isApproved: true },
          orderBy: { displayOrder: 'asc' },
          take: 6,
        }),
        prisma.galleryImage.findMany({
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
          take: 12,
        }),
        prisma.websiteSetting.findMany(),
      ]);

      testimonials = testimonialRows;
      gallery = galleryRows;
      settings.forEach((s) => {
        settingsMap[s.key] = s.value;
      });
    } catch (error) {
      if (process.env.NODE_ENV === 'production') throw error;
    }

    if (process.env.NODE_ENV !== 'production' && testimonials.length === 0) {
      testimonials = [
        {
          id: 'testi-1',
          customerName: 'Aditya Verma',
          content: 'The PS5 Pro setup with 4K 120Hz OLEDs is mindblowing. Zero input lag, insane graphics, and the best venue for FIFA tournaments in town!',
          rating: 5,
        },
        {
          id: 'testi-2',
          customerName: 'Siddharth Rao',
          content: 'The pool tables are genuine tournament grade. Italian slate, Simonis cloth, and the LED canopy lighting makes cueing flawless.',
          rating: 5,
        },
        {
          id: 'testi-3',
          customerName: 'Kavya & Group',
          content: 'We booked the 4-player lounge for 3 hours. Seamless online booking, instant QR check-in, and great snacks service right at our station.',
          rating: 5,
        },
      ];
    }

    if (process.env.NODE_ENV !== 'production' && gallery.length === 0) {
      gallery = [
        {
          id: 'gal-1',
          url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80',
          altText: 'PlayStation 5 Pro OLED Stations Lineup',
          category: 'gaming',
        },
        {
          id: 'gal-2',
          url: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80',
          altText: 'Tournament Billiards & Pool Arena',
          category: 'venue',
        },
        {
          id: 'gal-3',
          url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80',
          altText: 'Cyberpunk Neon Ambient Lounge',
          category: 'venue',
        },
      ];
    }

    if (process.env.NODE_ENV !== 'production' && Object.keys(settingsMap).length === 0) {
      settingsMap = {
        announcement_enabled: 'true',
        announcement_text: '🔥 Weekend FIFA 24 & Tekken 8 Showdown — Book Your Station Now & Win ₹15,000 Cash Pool!',
        announcement_link: '/booking',
        operating_hours_weekdays: '10:00 AM - 11:30 PM',
        operating_hours_weekends: '09:30 AM - 01:00 AM',
        contact_whatsapp: '+91 98765 43210',
        counter_upi_id: 'darksyndicate@icici',
        counter_upi_name: 'Dark Syndicate Gaming World',
        counter_upi_qr_url: '',
      };
    } else if (Object.keys(settingsMap).length > 0) {
      if (!settingsMap.counter_upi_id) settingsMap.counter_upi_id = 'darksyndicate@icici';
      if (!settingsMap.counter_upi_name) settingsMap.counter_upi_name = 'Dark Syndicate Gaming World';
      if (!settingsMap.counter_upi_qr_url) settingsMap.counter_upi_qr_url = '';
    }

    return apiSuccess(
      {
        testimonials,
        gallery,
        settings: settingsMap,
      },
      200,
      { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
