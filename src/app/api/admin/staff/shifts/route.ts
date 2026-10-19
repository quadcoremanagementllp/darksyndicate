import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError } from '@/lib/errors';
import { requireRole } from '@/lib/session';

export async function GET(req: NextRequest) {
  try {
    await requireRole('ADMIN', 'SUPER_ADMIN');
    const { searchParams } = new URL(req.url);
    const staffId = searchParams.get('staffId') || '';
    const dateRange = searchParams.get('dateRange') || 'ALL'; // ALL, TODAY, YESTERDAY, 7DAYS, 30DAYS
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const reasonFilter = searchParams.get('reason') || 'ALL';

    // 1. Auto-cleanup any hanging abandoned shifts older than 16 hours that missed logout
    try {
      const staleShifts = await prisma.staffShift.findMany({
        where: {
          logoutAt: null,
          loginAt: {
            lt: new Date(Date.now() - 16 * 60 * 60 * 1000), // > 16 hours ago (abandoned shift from previous day)
          },
        },
      });

      for (const stale of staleShifts) {
        await prisma.staffShift.update({
          where: { id: stale.id },
          data: {
            logoutAt: new Date(new Date(stale.loginAt).getTime() + 8 * 60 * 60 * 1000),
            logoutReason: 'SYSTEM_INACTIVE',
            durationMinutes: 480,
          },
        });
      }
    } catch (e) {
      console.error('Error auto-closing stale shifts:', e);
    }

    // 2. Build query filters (Restricted strictly to floor STAFF)
    const where: any = {
      user: {
        role: 'STAFF',
      },
    };
    if (staffId && staffId !== 'ALL') {
      where.userId = staffId;
    }

    if (reasonFilter !== 'ALL') {
      if (reasonFilter === 'ACTIVE') {
        where.logoutAt = null;
      } else {
        where.logoutReason = reasonFilter;
      }
    }

    // Date range filter
    if (dateRange === 'TODAY') {
      const istDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
      const startOfDay = new Date(`${istDateStr}T00:00:00+05:30`);
      where.loginAt = { gte: startOfDay };
    } else if (dateRange === 'YESTERDAY') {
      const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const istDateStr = yesterdayDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const startOfYesterday = new Date(`${istDateStr}T00:00:00+05:30`);
      const endOfYesterday = new Date(`${istDateStr}T23:59:59.999+05:30`);
      where.loginAt = { gte: startOfYesterday, lte: endOfYesterday };
    } else if (dateRange === '7DAYS') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      where.loginAt = { gte: sevenDaysAgo };
    } else if (dateRange === '30DAYS') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      where.loginAt = { gte: thirtyDaysAgo };
    } else if (dateFrom || dateTo) {
      where.loginAt = {};
      if (dateFrom) where.loginAt.gte = new Date(dateFrom);
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        where.loginAt.lte = toDate;
      }
    }

    // 3. Fetch shifts with user details
    const rawShifts = await prisma.staffShift.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            phone: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { loginAt: 'desc' },
    });

    // 4. Fetch all staff members for selector dropdown (Floor staff only)
    const staffUsers = await prisma.user.findMany({
      where: {
        role: 'STAFF',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
      orderBy: { firstName: 'asc' },
    });

    // 5. Format shifts and calculate working hours
    let totalMinutes = 0;
    let manualLogouts = 0;
    let systemInactivityLogouts = 0;
    let activeShifts = 0;

    const shifts = rawShifts.map((s) => {
      const isActive = !s.logoutAt;
      let durationMins = s.durationMinutes || 0;
      if (isActive) {
        activeShifts++;
        durationMins = Math.max(1, Math.round((Date.now() - new Date(s.loginAt).getTime()) / (60 * 1000)));
      } else if (s.logoutReason === 'SYSTEM_INACTIVE') {
        systemInactivityLogouts++;
      } else {
        manualLogouts++;
      }

      totalMinutes += durationMins;

      const durHours = Math.floor(durationMins / 60);
      const durMins = durationMins % 60;
      const durationFormatted = durHours > 0 ? `${durHours}h ${durMins}m` : `${durMins}m`;

      const loginDate = new Date(s.loginAt);
      const logoutDate = s.logoutAt ? new Date(s.logoutAt) : null;

      const dateFormatted = loginDate.toLocaleDateString('en-US', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      const loginTimeFormatted = loginDate.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const logoutTimeFormatted = logoutDate
        ? logoutDate.toLocaleTimeString('en-US', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        : '🟢 Active Now';

      const logoutReasonLabel = isActive
        ? 'Active Shift'
        : s.logoutReason === 'SYSTEM_INACTIVE'
        ? 'Logout by system due to inactivity'
        : 'Manual logout';

      return {
        id: s.id,
        userId: s.userId,
        staffName: s.user ? `${s.user.firstName} ${s.user.lastName}`.trim() : 'Staff Operator',
        staffEmail: s.user?.email || '—',
        staffRole: s.user?.role || 'STAFF',
        staffPhone: s.user?.phone || '—',
        staffAvatar: s.user?.avatarUrl || null,
        dateFormatted,
        loginAt: s.loginAt.toISOString(),
        loginTimeFormatted,
        logoutAt: s.logoutAt ? s.logoutAt.toISOString() : null,
        logoutTimeFormatted,
        isActive,
        logoutReason: s.logoutReason || (isActive ? 'ACTIVE' : 'MANUAL'),
        logoutReasonLabel,
        durationMinutes: durationMins,
        durationFormatted,
        ipAddress: s.ipAddress || '—',
      };
    });

    const totalHours = Math.floor(totalMinutes / 60);
    const remMinutes = totalMinutes % 60;
    const totalWorkingHoursFormatted = totalHours > 0 ? `${totalHours}h ${remMinutes}m` : `${remMinutes}m`;
    const totalWorkingHoursDecimal = +(totalMinutes / 60).toFixed(1);

    return apiSuccess({
      shifts,
      summary: {
        totalWorkingMinutes: totalMinutes,
        totalWorkingHoursFormatted,
        totalWorkingHoursDecimal,
        totalShifts: shifts.length,
        activeShifts,
        manualLogouts,
        systemInactivityLogouts,
      },
      staffMembers: staffUsers.map((m) => ({
        id: m.id,
        name: `${m.firstName} ${m.lastName}`.trim(),
        email: m.email,
        role: m.role,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
