import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, AuthError, handleApiError, NotFoundError } from '@/lib/errors';
import { getSession } from '@/lib/session';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) throw new AuthError();
    const { id } = await params;
    if (id.startsWith('upcoming-alert-')) {
      return apiSuccess({ message: 'Notification marked as read', id });
    }
    const result = await prisma.notification.updateMany({
      where: { id, userId: session.userId },
      data: { isRead: true },
    });
    if (result.count === 0) throw new NotFoundError('Notification');

    return apiSuccess({ message: 'Notification marked as read', id });
  } catch (error) {
    return handleApiError(error);
  }
}
