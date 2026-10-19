import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError, NotFoundError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { z } from 'zod';
import { logAudit } from '@/lib/audit';

const gallerySchema = z.object({
  url: z.string().min(1, 'Image URL or path is required'),
  altText: z.string().optional().nullable(),
  category: z.string().default('gaming'), // gaming, venue, events, rigs
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

const updateGallerySchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1).optional(),
  altText: z.string().optional().nullable(),
  category: z.string().optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  try {
    await requireRole('ADMIN', 'SUPER_ADMIN');
    const images = await prisma.galleryImage.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return apiSuccess(images);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole('ADMIN', 'SUPER_ADMIN');
    const body = await req.json();
    const data = gallerySchema.parse(body);

    const count = await prisma.galleryImage.count();
    const created = await prisma.galleryImage.create({
      data: {
        ...data,
        displayOrder: data.displayOrder || count + 1,
      },
    });

    await logAudit({
      action: 'CREATE',
      entityType: 'GalleryImage',
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
    const { id, ...updates } = updateGallerySchema.parse(body);

    const existing = await prisma.galleryImage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Gallery image not found');

    const updated = await prisma.galleryImage.update({
      where: { id },
      data: updates,
    });

    await logAudit({
      action: 'UPDATE',
      entityType: 'GalleryImage',
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
    if (!id) throw new NotFoundError('Image ID required');

    const existing = await prisma.galleryImage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Gallery image not found');

    await prisma.galleryImage.delete({ where: { id } });
    await logAudit({
      action: 'DELETE',
      entityType: 'GalleryImage',
      entityId: id,
      oldValue: existing,
    });

    return apiSuccess({ message: 'Gallery image removed successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
