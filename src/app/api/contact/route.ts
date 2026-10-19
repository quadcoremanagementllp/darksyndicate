import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiSuccess, handleApiError } from '@/lib/errors';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'node:crypto';
import { sendEmail } from '@/lib/email';

const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60),
  email: z.string().email('Please enter a valid email address'),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian phone number')
    .optional()
    .or(z.literal('')),
  subject: z.string().min(3, 'Subject must be at least 3 characters').max(100),
  message: z.string().min(10, 'Message must be at least 10 characters').max(1000),
  inquiryType: z.enum(['GENERAL', 'BOOKING', 'TOURNAMENT', 'PARTY', 'FEEDBACK']).default('GENERAL'),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateLimitKey = `contact:${ip}`;
    checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000);

    const body = await req.json();
    const validatedData = contactSchema.parse(body);

    const ticketId = `DS-INQ-${randomUUID().slice(0, 8).toUpperCase()}`;
    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entityType: 'contact_inquiry',
        entityId: ticketId,
        ipAddress: ip,
        newValue: validatedData,
      },
    });
    if (process.env.CONTACT_EMAIL && process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
      await sendEmail(process.env.CONTACT_EMAIL, `New inquiry ${ticketId}: ${validatedData.subject}`,
        `From: ${validatedData.name} <${validatedData.email}>\nPhone: ${validatedData.phone || 'not supplied'}\n\n${validatedData.message}`)
        .catch((error) => console.error('Contact notification failed:', error));
    }

    return apiSuccess(
      {
        message: 'Your inquiry has been received. Our team will contact you shortly!',
        ticketId,
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
