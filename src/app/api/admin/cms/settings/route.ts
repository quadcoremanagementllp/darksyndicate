import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { z } from 'zod';
import { logAudit } from '@/lib/audit';

const settingsBatchSchema = z.object({
  settings: z.array(
    z.object({
      key: z.string().min(1),
      value: z.string(),
      group: z.string().default('general'),
      label: z.string().optional(),
    })
  ),
});

export async function GET() {
  try {
    await requireRole('ADMIN', 'SUPER_ADMIN');
    try {
      const dbSettings = await prisma.websiteSetting.findMany({
        orderBy: [{ group: 'asc' }, { key: 'asc' }],
      });
      if (dbSettings.length > 0) {
        return apiSuccess(dbSettings);
      }
    } catch (error) {
      throw error;
    }

    return apiSuccess(process.env.NODE_ENV === 'production' ? [] : getDefaultSettings());
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireRole('ADMIN', 'SUPER_ADMIN');
    const body = await req.json();
    const { settings } = settingsBatchSchema.parse(body);

    try {
      const results = [];
      for (const item of settings) {
        const updated = await prisma.websiteSetting.upsert({
          where: { key: item.key },
          update: { value: item.value, label: item.label, group: item.group },
          create: {
            key: item.key,
            value: item.value,
            group: item.group,
            label: item.label,
          },
        });
        results.push(updated);
      }

      await logAudit({
        action: 'UPDATE',
        entityType: 'WebsiteSettings',
        entityId: 'batch',
        newValue: { count: settings.length, keys: settings.map((s) => s.key) },
      });

      return apiSuccess({ message: 'Settings saved successfully', settings: results });
    } catch (error) {
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}

function getDefaultSettings() {
  return [
    {
      id: 'set-1',
      key: 'announcement_enabled',
      value: 'true',
      group: 'announcement',
      label: 'Enable Top Announcement Banner',
      dataType: 'boolean',
    },
    {
      id: 'set-2',
      key: 'announcement_text',
      value: '🔥 Weekend FIFA 24 & Tekken 8 Showdown — Book Your Station Now & Win ₹15,000 Cash Pool!',
      group: 'announcement',
      label: 'Banner Announcement Message',
      dataType: 'string',
    },
    {
      id: 'set-3',
      key: 'announcement_link',
      value: '/booking',
      group: 'announcement',
      label: 'Banner Click Link',
      dataType: 'string',
    },
    {
      id: 'set-4',
      key: 'operating_hours_weekdays',
      value: '10:00 AM - 11:30 PM',
      group: 'hours',
      label: 'Weekday Timings (Mon - Thu)',
      dataType: 'string',
    },
    {
      id: 'set-5',
      key: 'operating_hours_weekends',
      value: '09:30 AM - 01:00 AM',
      group: 'hours',
      label: 'Weekend Timings (Fri - Sun)',
      dataType: 'string',
    },
    {
      id: 'set-6',
      key: 'venue_address',
      value: 'Dark Syndicate Arena, 2nd Floor, Cyber Square, MG Road, Bengaluru, Karnataka 560001',
      group: 'contact',
      label: 'Physical Venue Address',
      dataType: 'string',
    },
    {
      id: 'set-7',
      key: 'contact_whatsapp',
      value: '+91 98765 43210',
      group: 'contact',
      label: 'Front-Desk WhatsApp Support',
      dataType: 'string',
    },
    {
      id: 'set-8',
      key: 'contact_email',
      value: 'support@darksyndicate.in',
      group: 'contact',
      label: 'General Inquiries Email',
      dataType: 'string',
    },
    {
      id: 'set-9',
      key: 'social_instagram',
      value: 'https://instagram.com/darksyndicate.gaming',
      group: 'social',
      label: 'Instagram Page URL',
      dataType: 'string',
    },
    {
      id: 'set-10',
      key: 'social_discord',
      value: 'https://discord.gg/darksyndicate',
      group: 'social',
      label: 'Discord Community Invite',
      dataType: 'string',
    },
    {
      id: 'set-11',
      key: 'counter_upi_id',
      value: 'darksyndicate@icici',
      group: 'payment',
      label: 'Counter UPI ID (VPA)',
      dataType: 'string',
    },
    {
      id: 'set-12',
      key: 'counter_upi_name',
      value: 'Dark Syndicate Gaming Arena',
      group: 'payment',
      label: 'Counter Payee Account Name',
      dataType: 'string',
    },
    {
      id: 'set-13',
      key: 'counter_upi_qr_url',
      value: '',
      group: 'payment',
      label: 'Counter Standee UPI QR Image',
      dataType: 'string',
    },
  ];
}
