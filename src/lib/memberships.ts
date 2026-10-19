import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

export interface DefaultPlanDef {
  slug: string;
  name: string;
  tier: 'SILVER' | 'GOLD' | 'VIP';
  description: string;
  pricePaise: number;
  durationDays: number;
  discountPercent: number;
  freeHours: number;
  perks: string[];
  badgeColor: string;
  displayOrder: number;
}

export const DEFAULT_MEMBERSHIP_PLANS: DefaultPlanDef[] = [
  {
    slug: 'silver',
    name: 'Silver Syndicate Pass',
    tier: 'SILVER',
    description: 'Entry-level pass for casual gamers wanting consistent hourly discounts.',
    pricePaise: 49900, // ₹499
    durationDays: 30,
    discountPercent: 10,
    freeHours: 0,
    perks: [
      '10% OFF all console & PC gaming hours',
      'Exclusive Syndicate Silver badge in user profile',
      'Priority online booking window',
      'Member-only tournament invitations',
    ],
    badgeColor: 'border-slate-400 text-slate-300',
    displayOrder: 1,
  },
  {
    slug: 'gold',
    name: 'Gold Syndicate Pass',
    tier: 'GOLD',
    description: 'The most popular gamer tier with high savings and free monthly hours.',
    pricePaise: 129900, // ₹1,299
    durationDays: 30,
    discountPercent: 20,
    freeHours: 2,
    perks: [
      '20% OFF all gaming sessions & walk-ins',
      '2 FREE bonus gaming hours every month',
      'Weekend priority station allocation',
      'Complimentary energy drink on check-in',
      '25% OFF arcade & pool table rates',
    ],
    badgeColor: 'border-amber-400 text-amber-300',
    displayOrder: 2,
  },
  {
    slug: 'vip-black',
    name: 'VIP Black Card',
    tier: 'VIP',
    description: 'Ultimate pro-gamer status with top-tier discounts and VIP lounge access.',
    pricePaise: 249900, // ₹2,499
    durationDays: 30,
    discountPercent: 30,
    freeHours: 5,
    perks: [
      '30% OFF all arena sessions & extended hours',
      '5 FREE bonus gaming hours every month',
      'Guaranteed VIP Snooker Lounge & PS5 Pro rights',
      '50% OFF all tournament entry fees',
      'Custom Dark Syndicate gamer jersey after 3 months',
      'Personal locker & gear storage privileges',
    ],
    badgeColor: 'border-ds-accent text-ds-ice',
    displayOrder: 3,
  },
];

/**
 * Ensures default membership plans exist in the database.
 */
export async function ensureDefaultMembershipPlans() {
  const count = await prisma.membershipPlan.count();
  if (count > 0) return;

  for (const plan of DEFAULT_MEMBERSHIP_PLANS) {
    await prisma.membershipPlan.upsert({
      where: { slug: plan.slug },
      update: {},
      create: {
        id: randomUUID(),
        slug: plan.slug,
        name: plan.name,
        tier: plan.tier,
        description: plan.description,
        pricePaise: plan.pricePaise,
        durationDays: plan.durationDays,
        discountPercent: plan.discountPercent,
        freeHours: plan.freeHours,
        perks: plan.perks,
        badgeColor: plan.badgeColor,
        displayOrder: plan.displayOrder,
        isActive: true,
      },
    });
  }
}

/**
 * Transitions any ACTIVE memberships whose expiresAt has passed to EXPIRED.
 */
export async function syncExpiredMemberships(userId?: string) {
  const now = new Date();
  await prisma.membership.updateMany({
    where: {
      ...(userId ? { userId } : {}),
      status: 'ACTIVE',
      expiresAt: { lte: now },
    },
    data: {
      status: 'EXPIRED',
    },
  }).catch(() => {});
}

/**
 * Returns the currently active membership for a user (if any).
 */
export async function getActiveUserMembership(userId: string) {
  await syncExpiredMemberships(userId);
  const now = new Date();

  const active = await prisma.membership.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
      startsAt: { lte: now },
      expiresAt: { gt: now },
    },
    include: {
      plan: true,
    },
    orderBy: { expiresAt: 'desc' },
  });

  return active;
}

/**
 * Calculates the membership discount for a booking.
 */
export function calculateMembershipBookingDiscount(
  subtotalPaise: number,
  discountPercent: number
): number {
  if (!discountPercent || discountPercent <= 0) return 0;
  return Math.min(subtotalPaise, Math.round((subtotalPaise * discountPercent) / 100));
}

/**
 * Helper to grant or activate a membership for a user.
 */
export async function grantUserMembership(params: {
  userId: string;
  planId: string;
  pricePaidPaise?: number;
  paymentMethod?: 'UPI' | 'RAZORPAY' | 'CASH' | 'CASHFREE' | 'OTHER';
  paymentId?: string;
  notes?: string;
  adminId?: string;
}) {
  const plan = await prisma.membershipPlan.findUnique({
    where: { id: params.planId },
  });
  if (!plan) throw new Error('Membership plan not found');

  const now = new Date();
  // If user already has an active membership, stack remaining days onto the new pass while starting immediately
  const currentActive = await getActiveUserMembership(params.userId);
  const startsAt = now;
  const expiryBase =
    currentActive && currentActive.expiresAt > now ? currentActive.expiresAt : now;
  const expiresAt = new Date(expiryBase.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

  const isComplimentary = params.paymentMethod === 'OTHER';
  const effectivePricePaidPaise =
    params.pricePaidPaise !== undefined
      ? params.pricePaidPaise
      : isComplimentary
      ? 0
      : plan.pricePaise;

  const membership = await prisma.$transaction(async (tx) => {
    // Supersede any previously active memberships so the user has a single active pass
    await tx.membership.updateMany({
      where: {
        userId: params.userId,
        status: 'ACTIVE',
      },
      data: {
        status: 'EXPIRED',
      },
    });

    const created = await tx.membership.create({
      data: {
        id: randomUUID(),
        userId: params.userId,
        planId: plan.id,
        planNameSnapshot: plan.name,
        tierSnapshot: plan.tier,
        discountPercent: plan.discountPercent,
        pricePaidPaise: effectivePricePaidPaise,
        paymentMethod: params.paymentMethod ?? 'UPI',
        paymentId: params.paymentId ?? null,
        status: 'ACTIVE',
        startsAt,
        expiresAt,
        notes: params.notes ?? null,
      },
      include: {
        plan: true,
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    if (effectivePricePaidPaise > 0) {
      await tx.customerProfile.upsert({
        where: { userId: params.userId },
        create: {
          userId: params.userId,
          totalSpent: effectivePricePaidPaise,
          totalBookings: 0,
        },
        update: {
          totalSpent: { increment: effectivePricePaidPaise },
        },
      });
    }

    // In-app alert to customer
    await tx.notification.create({
      data: {
        id: randomUUID(),
        userId: params.userId,
        type: 'SYSTEM',
        title: `Welcome to ${plan.name}!`,
        message: `Your ${plan.tier} membership is active with ${plan.discountPercent}% discount on all gaming sessions until ${expiresAt.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' })}.`,
        isRead: false,
      },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        id: randomUUID(),
        userId: params.adminId || params.userId,
        action: 'CREATE',
        entityType: 'Membership',
        entityId: created.id,
        newValue: {
          planName: plan.name,
          tier: plan.tier,
          pricePaidPaise: effectivePricePaidPaise,
          paymentMethod: params.paymentMethod ?? 'UPI',
          userId: params.userId,
          customerName: `${created.user.firstName} ${created.user.lastName}`.trim(),
          expiresAt: expiresAt.toISOString(),
        },
      },
    });

    return created;
  });

  return membership;
}
