import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, AuthError, handleApiError, NotFoundError } from '@/lib/errors';
import { getSession } from '@/lib/session';
import { generateQrDataUrl } from '@/lib/qr';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const booking = await prisma.booking.findFirst({
      where: { OR: [{ id }, { bookingRef: id }, { qrToken: id }] },
      include: {
        station: { include: { facility: true } },
        payments: { orderBy: { createdAt: 'desc' } },
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
    });
    if (!booking) throw new NotFoundError('Booking not found');

    const session = await getSession();
    const isStaff = session && ['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(session.role);
    const hasPass = id === booking.qrToken || req.nextUrl.searchParams.get('token') === booking.qrToken;
    if (!isStaff && session?.userId !== booking.userId && !hasPass) {
      throw new AuthError('Booking pass or account access required');
    }

    const qrDataUrl = await generateQrDataUrl(booking.qrToken);
    return apiSuccess({ ...booking, qrDataUrl });
  } catch (error) {
    return handleApiError(error);
  }
}
