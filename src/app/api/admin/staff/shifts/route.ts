import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, handleApiError } from '@/lib/errors';
import { requireRole } from '@/lib/session';
import type { Prisma } from '@prisma/client';
import {
  correctedLegacyShiftEnd,
  formatShiftDateIST,
  formatShiftTimeIST,
  inactiveShiftEnd,
  istDayBounds,
  STAFF_INACTIVITY_MINUTES,
} from '@/lib/staffShiftTime';

export async function GET(req: NextRequest) {
  try {
    await requireRole('ADMIN', 'SUPER_ADMIN');
    const { searchParams } = new URL(req.url);
    const staffId = searchParams.get('staffId') || '';
    const dateRange = searchParams.get('dateRange') || 'ALL'; // ALL, TODAY, YESTERDAY, 7DAYS, 30DAYS
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const reasonFilter = searchParams.get('reason') || 'ALL';

    // Close abandoned shifts and repair fixed two/eight-hour estimates from earlier versions.
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
            logoutAt: inactiveShiftEnd(stale.loginAt, new Date()),
            logoutReason: 'SYSTEM_INACTIVE',
            durationMinutes: STAFF_INACTIVITY_MINUTES,
          },
        });
      }

      const legacyShifts = await prisma.staffShift.findMany({
        where: { logoutReason: 'SYSTEM_INACTIVE', durationMinutes: { in: [120, 480] } },
        select: { id: true, loginAt: true, logoutAt: true, durationMinutes: true, logoutReason: true },
      });
      for (const legacy of legacyShifts) {
        const corrected = correctedLegacyShiftEnd(
          legacy.loginAt, legacy.logoutAt, legacy.durationMinutes, legacy.logoutReason,
        );
        if (corrected) {
          await prisma.staffShift.update({
            where: { id: legacy.id },
            data: { logoutAt: corrected, durationMinutes: STAFF_INACTIVITY_MINUTES },
          });
        }
      }
    } catch (e) {
      console.error('Error auto-closing stale shifts:', e);
    }

    // 2. Include staff and administrators, but not super administrators.
    const where: Prisma.StaffShiftWhereInput = {
      user: {
        role: { in: ['STAFF', 'ADMIN'] },
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
      const [startOfDay, endOfDay] = istDayBounds(istDateStr);
      where.loginAt = { gte: startOfDay, lt: endOfDay };
    } else if (dateRange === 'YESTERDAY') {
      const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const istDateStr = yesterdayDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const [startOfYesterday, endOfYesterday] = istDayBounds(istDateStr);
      where.loginAt = { gte: startOfYesterday, lt: endOfYesterday };
    } else if (dateRange === '7DAYS') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      where.loginAt = { gte: sevenDaysAgo };
    } else if (dateRange === '30DAYS') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      where.loginAt = { gte: thirtyDaysAgo };
    } else if (dateFrom || dateTo) {
      const loginAt: Prisma.DateTimeFilter = {};
      if (dateFrom) loginAt.gte = istDayBounds(dateFrom)[0];
      if (dateTo) loginAt.lt = istDayBounds(dateTo)[1];
      where.loginAt = loginAt;
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

    // 4. Fetch staff and administrators for the selector.
    const staffUsers = await prisma.user.findMany({
      where: {
        role: { in: ['STAFF', 'ADMIN'] },
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

      const dateFormatted = formatShiftDateIST(loginDate);
      const loginTimeFormatted = formatShiftTimeIST(loginDate);
      const logoutTimeFormatted = logoutDate ? formatShiftTimeIST(logoutDate) : 'Active Now';

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
        logoutDateFormatted: logoutDate ? formatShiftDateIST(logoutDate) : null,
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
