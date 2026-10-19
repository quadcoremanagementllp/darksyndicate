import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError, ValidationError } from '@/lib/errors';
import { z } from 'zod';

const validateCouponSchema = z
  .object({
    code: z.string().min(2).max(20).toUpperCase(),
    orderAmountPaise: z.number().int().positive().optional(),
    subtotalPaise: z.number().int().positive().optional(),
  })
  .refine((data) => data.orderAmountPaise !== undefined || data.subtotalPaise !== undefined, {
    message: 'orderAmountPaise or subtotalPaise is required',
  });

// Built-in standard coupons for testing and live promotions
const PROMO_COUPONS: Record<
  string,
  {
    discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
    discountValue: number;
    minOrderPaise: number;
    maxDiscountPaise: number;
    description: string;
  }
> = {
  WELCOME10: {
    discountType: 'PERCENTAGE',
    discountValue: 10,
    minOrderPaise: 20000, // ₹200
    maxDiscountPaise: 5000, // ₹50 max
    description: '10% Welcome Discount for New Players',
  },
  SYNDICATE20: {
    discountType: 'PERCENTAGE',
    discountValue: 20,
    minOrderPaise: 40000, // ₹400 min
    maxDiscountPaise: 10000, // ₹100 max
    description: '20% Member Squad Discount',
  },
  GLACIER50: {
    discountType: 'FIXED_AMOUNT',
    discountValue: 5000, // ₹50 flat (stored in paise)
    minOrderPaise: 20000,
    maxDiscountPaise: 5000,
    description: 'Flat ₹50 Instant Voucher',
  },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = validateCouponSchema.parse(body);
    const code = parsed.code;
    const amountPaise = parsed.orderAmountPaise ?? parsed.subtotalPaise ?? 0;

    // 1. Check database for active coupon
    let coupon = null;
    try {
      coupon = await prisma.coupon.findUnique({
        where: { code },
      });
    } catch (err) {
      console.warn('Prisma coupon lookup failed, checking static promos:', err);
    }

    if (!coupon && PROMO_COUPONS[code]) {
      const promo = PROMO_COUPONS[code];
      coupon = {
        id: `promo-${code.toLowerCase()}`,
        code,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        minOrderPaise: promo.minOrderPaise,
        maxDiscountPaise: promo.maxDiscountPaise,
        isActive: true,
        validUntil: null,
      };
    }

    if (!coupon || !coupon.isActive) {
      throw new ValidationError(`Coupon code '${code}' is invalid or has expired`);
    }

    if (coupon.validUntil && new Date(coupon.validUntil) < new Date()) {
      throw new ValidationError(`Coupon code '${code}' has expired`);
    }

    if (coupon.minOrderPaise && amountPaise < coupon.minOrderPaise) {
      const minINR = (coupon.minOrderPaise / 100).toFixed(0);
      throw new ValidationError(
        `This coupon requires a minimum booking amount of ₹${minINR}`
      );
    }

    // Calculate discount amount
    let discountPaise = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      const rate = coupon.discountValue > 100 ? coupon.discountValue / 10000 : coupon.discountValue / 100;
      discountPaise = Math.round(amountPaise * rate);
      if (coupon.maxDiscountPaise && discountPaise > coupon.maxDiscountPaise) {
        discountPaise = coupon.maxDiscountPaise;
      }
    } else {
      discountPaise = coupon.discountValue; // Fixed amount in paise
    }

    if (discountPaise > amountPaise) {
      discountPaise = amountPaise;
    }

    const finalAmountPaise = amountPaise - discountPaise;

    return apiSuccess({
      valid: true,
      couponId: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountPaise,
      discountAmountPaise: discountPaise,
      finalAmountPaise,
      message: `Coupon applied! You saved ₹${(discountPaise / 100).toFixed(0)}`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
