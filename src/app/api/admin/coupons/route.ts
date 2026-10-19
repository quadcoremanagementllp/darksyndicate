import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError, ConflictError, NotFoundError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import { z } from 'zod';

const createCouponSchema = z.object({
  code: z.string().min(3).max(20).toUpperCase(),
  name: z.string().min(2),
  description: z.string().optional(),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).default('PERCENTAGE'),
  discountValue: z.number().int().positive(), // percentage * 100 or paise
  minOrderPaise: z.number().int().nullable().optional(),
  maxDiscountPaise: z.number().int().nullable().optional(),
  maxUses: z.number().int().nullable().optional(),
  validDays: z.number().int().min(1).max(3650).default(30),
});

const updateCouponSchema = z.object({
  couponId: z.string().min(1),
  isActive: z.boolean().optional(),
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).optional(),
  discountValue: z.number().int().positive().optional(),
  minOrderPaise: z.number().int().nullable().optional(),
  maxDiscountPaise: z.number().int().nullable().optional(),
  maxUses: z.number().int().nullable().optional(),
  validDays: z.number().int().min(1).max(3650).optional(),
});

export async function GET() {
  try {
    await requireRole('ADMIN', 'SUPER_ADMIN');
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return apiSuccess(coupons);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole('ADMIN', 'SUPER_ADMIN');
    const body = await req.json();
    const data = createCouponSchema.parse(body);

    const now = new Date();
    const validUntil = new Date(now.getTime() + data.validDays * 24 * 3600 * 1000);

    const existing = await prisma.coupon.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw new ConflictError(`Coupon with code '${data.code}' already exists`);
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description || `${data.name} Promotion`,
        discountType: data.discountType,
        discountValue: data.discountValue,
        minOrderPaise: data.minOrderPaise || null,
        maxDiscountPaise: data.maxDiscountPaise || null,
        maxUses: data.maxUses || null,
        validFrom: now,
        validUntil,
        isActive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: 'CREATE',
        entityType: 'Coupon',
        entityId: coupon.id,
        newValue: {
          code: coupon.code,
          name: coupon.name,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          validUntil: coupon.validUntil,
        },
      },
    }).catch(() => {});

    return apiSuccess(coupon, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireRole('ADMIN', 'SUPER_ADMIN');
    const body = await req.json();
    const data = updateCouponSchema.parse(body);

    const existing = await prisma.coupon.findUnique({
      where: { id: data.couponId },
    });

    if (!existing) {
      throw new NotFoundError('Coupon not found');
    }

    const now = new Date();
    const validUntil =
      data.validDays !== undefined
        ? new Date(now.getTime() + data.validDays * 24 * 3600 * 1000)
        : undefined;

    const coupon = await prisma.coupon.update({
      where: { id: data.couponId },
      data: {
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.discountType !== undefined ? { discountType: data.discountType } : {}),
        ...(data.discountValue !== undefined ? { discountValue: data.discountValue } : {}),
        ...(data.minOrderPaise !== undefined ? { minOrderPaise: data.minOrderPaise } : {}),
        ...(data.maxDiscountPaise !== undefined ? { maxDiscountPaise: data.maxDiscountPaise } : {}),
        ...(data.maxUses !== undefined ? { maxUses: data.maxUses } : {}),
        ...(validUntil !== undefined ? { validUntil } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: data.isActive !== undefined && data.name === undefined ? 'STATUS_CHANGE' : 'UPDATE',
        entityType: 'Coupon',
        entityId: coupon.id,
        oldValue: {
          code: existing.code,
          name: existing.name,
          discountValue: existing.discountValue,
          isActive: existing.isActive,
        },
        newValue: {
          code: coupon.code,
          name: coupon.name,
          discountValue: coupon.discountValue,
          isActive: coupon.isActive,
        },
      },
    }).catch(() => {});

    return apiSuccess({
      message:
        data.name !== undefined
          ? `Coupon ${coupon.code} updated successfully`
          : `Coupon ${coupon.code} is now ${coupon.isActive ? 'Active' : 'Inactive'}`,
      coupon,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireRole('ADMIN', 'SUPER_ADMIN');
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      throw new NotFoundError('Coupon ID is required');
    }

    const existing = await prisma.coupon.findUnique({
      where: { id },
      include: { _count: { select: { redemptions: true } } },
    });

    if (!existing) {
      throw new NotFoundError('Coupon not found');
    }

    if (existing._count.redemptions > 0 || existing.usedCount > 0) {
      await prisma.coupon.update({
        where: { id },
        data: { isActive: false },
      });

      await prisma.auditLog.create({
        data: {
          userId: session.userId,
          action: 'STATUS_CHANGE',
          entityType: 'Coupon',
          entityId: id,
          oldValue: { code: existing.code, isActive: existing.isActive },
          newValue: { code: existing.code, isActive: false, note: 'Deactivated instead of deleted due to past redemptions' },
        },
      }).catch(() => {});

      return apiSuccess({
        message: `Coupon ${existing.code} has ${existing.usedCount} redemptions and was deactivated to preserve financial history.`,
        deactivatedOnly: true,
      });
    }

    await prisma.coupon.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: 'DELETE',
        entityType: 'Coupon',
        entityId: id,
        oldValue: { code: existing.code, name: existing.name },
      },
    }).catch(() => {});

    return apiSuccess({
      message: `Coupon ${existing.code} deleted permanently.`,
      deactivatedOnly: false,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
