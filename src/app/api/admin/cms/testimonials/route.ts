import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError, NotFoundError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { z } from 'zod';
import { logAudit } from '@/lib/audit';

const testimonialSchema = z.object({
  customerName: z.string().min(2, 'Name is required'),
  content: z.string().min(5, 'Review content is required'),
  rating: z.number().int().min(1).max(5).default(5),
  avatarUrl: z.string().optional().nullable(),
  isApproved: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
});

const updateTestimonialSchema = z.object({
  id: z.string().min(1),
  isApproved: z.boolean().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  customerName: z.string().optional(),
  content: z.string().optional(),
});

export async function GET() {
  try {
    await requireRole('ADMIN', 'SUPER_ADMIN');
    const testimonials = await prisma.testimonial.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return apiSuccess(testimonials);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole('ADMIN', 'SUPER_ADMIN');
    const body = await req.json();
    const data = testimonialSchema.parse(body);

    const count = await prisma.testimonial.count();
    const created = await prisma.testimonial.create({
      data: {
        ...data,
        displayOrder: data.displayOrder || count + 1,
      },
    });

    await logAudit({
      action: 'CREATE',
      entityType: 'Testimonial',
      entityId: created.id,
      newValue: created,
    });

    return apiSuccess(created, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireRole('ADMIN', 'SUPER_ADMIN');
    const body = await req.json();
    const { id, ...updates } = updateTestimonialSchema.parse(body);

    const existing = await prisma.testimonial.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Testimonial not found');

    const updated = await prisma.testimonial.update({
      where: { id },
      data: updates,
    });

    await logAudit({
      action: 'UPDATE',
      entityType: 'Testimonial',
      entityId: id,
      oldValue: existing,
      newValue: updated,
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireRole('ADMIN', 'SUPER_ADMIN');
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) throw new NotFoundError('Testimonial ID required');

    const existing = await prisma.testimonial.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Testimonial not found');

    await prisma.testimonial.delete({ where: { id } });
    await logAudit({
      action: 'DELETE',
      entityType: 'Testimonial',
      entityId: id,
      oldValue: existing,
    });

    return apiSuccess({ message: 'Testimonial deleted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
