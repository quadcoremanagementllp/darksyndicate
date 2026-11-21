import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError, NotFoundError, ValidationError } from '@/lib/errors';
import { requireRole } from '@/lib/session';

const createNoteSchema = z.object({
  customerName: z.string().trim().min(1, 'Customer name is required').max(100),
  timeSlot: z.string().trim().min(1, 'Time is required').max(50),
  phone: z.string().trim().max(20).optional().nullable(),
  stationPreference: z.string().trim().max(100).optional().nullable(),
  playerCount: z.number().int().min(1).max(20).default(1),
  note: z.string().trim().max(1000).optional().nullable(),
});

const patchNoteSchema = z.object({
  noteId: z.string().min(1, 'Note ID is required'),
  status: z.enum(['PENDING', 'SEATED', 'COMPLETED', 'CANCELLED']),
  note: z.string().trim().max(1000).optional(),
});

const deleteNoteSchema = z.object({
  noteId: z.string().min(1, 'Note ID is required'),
});

// GET /api/staff/notes — List all quick notes
export async function GET(req: NextRequest) {
  try {
    await requireRole('STAFF', 'ADMIN', 'SUPER_ADMIN');
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'ACTIVE'; // 'ACTIVE' | 'ALL' | 'SEATED' | 'CANCELLED'
    const search = (searchParams.get('search') || '').trim().toLowerCase();

    const whereClause: any = {};

    if (status === 'ACTIVE') {
      whereClause.status = 'PENDING';
    } else if (status !== 'ALL') {
      whereClause.status = status;
    }

    if (search) {
      whereClause.OR = [
        { customerName: { contains: search } },
        { phone: { contains: search } },
        { note: { contains: search } },
        { stationPreference: { contains: search } },
      ];
    }

    const notes = await prisma.staffQuickNote.findMany({
      where: whereClause,
      orderBy: [
        { status: 'asc' }, // PENDING first
        { createdAt: 'desc' },
      ],
      take: 100,
    });

    return apiSuccess(notes, 200, { 'Cache-Control': 'no-store' });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/staff/notes — Create a new quick note
export async function POST(req: NextRequest) {
  try {
    const session = await requireRole('STAFF', 'ADMIN', 'SUPER_ADMIN');
    const body = await req.json();
    const data = createNoteSchema.parse(body);

    const staffName = `${session.firstName} ${session.lastName}`.trim() || session.email;

    const newNote = await prisma.staffQuickNote.create({
      data: {
        customerName: data.customerName,
        timeSlot: data.timeSlot,
        phone: data.phone || null,
        stationPreference: data.stationPreference || null,
        playerCount: data.playerCount || 1,
        note: data.note || null,
        status: 'PENDING',
        staffName,
        createdById: session.userId,
      },
    });

    return apiSuccess(newNote, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/staff/notes — Update note status or content
export async function PATCH(req: NextRequest) {
  try {
    await requireRole('STAFF', 'ADMIN', 'SUPER_ADMIN');
    const body = await req.json();
    const data = patchNoteSchema.parse(body);

    const existing = await prisma.staffQuickNote.findUnique({
      where: { id: data.noteId },
    });

    if (!existing) {
      throw new NotFoundError('Quick note not found');
    }

    const updated = await prisma.staffQuickNote.update({
      where: { id: data.noteId },
      data: {
        status: data.status,
        ...(data.note !== undefined ? { note: data.note } : {}),
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/staff/notes — Delete a note
export async function DELETE(req: NextRequest) {
  try {
    await requireRole('STAFF', 'ADMIN', 'SUPER_ADMIN');
    const body = await req.json();
    const { noteId } = deleteNoteSchema.parse(body);

    const existing = await prisma.staffQuickNote.findUnique({
      where: { id: noteId },
    });

    if (!existing) {
      throw new NotFoundError('Quick note not found');
    }

    await prisma.staffQuickNote.delete({
      where: { id: noteId },
    });

    return apiSuccess({ success: true, message: 'Note deleted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
