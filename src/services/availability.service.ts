import { prisma } from '@/lib/prisma';
import { StationType } from '@prisma/client';

export interface TimeSlot {
  time: string; // '10:00'
  endTime: string; // '12:00'
  label: string; // '10:00 AM – 12:00 PM'
  period: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';
  available: boolean;
  reason?: string;
  availableStationIds?: string[];
}

export interface AvailabilityResult {
  stationId?: string;
  zone?: string | null;
  date: string;
  durationMinutes: number;
  operatingHours: { open: string; close: string };
  slots: TimeSlot[];
  totalStationsInZone?: number;
}

const OPERATING_START_HOUR = 10; // 10:00 AM
const OPERATING_END_HOUR = 24; // 12:00 AM Midnight

/**
 * Format 24h string 'HH:mm' to 12h display 'h:mm A'
 */
function format12Hour(time24: string): string {
  const [hourStr, minStr] = time24.split(':');
  let hour = parseInt(hourStr, 10);
  const min = minStr || '00';
  const period = hour >= 12 && hour < 24 ? 'PM' : 'AM';
  if (hour === 0 || hour === 24) hour = 12;
  else if (hour > 12) hour -= 12;
  return `${hour}:${min} ${period}`;
}

/**
 * Get period classification for grouping
 */
function getPeriod(hour: number): 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT' {
  if (hour < 13) return 'MORNING'; // 10am - 12:59pm
  if (hour < 17) return 'AFTERNOON'; // 1pm - 4:59pm
  if (hour < 21) return 'EVENING'; // 5pm - 8:59pm
  return 'NIGHT'; // 9pm - 12am
}

/**
 * Compute availability for a specific station or across an entire zone on a given date.
 */
export async function getStationAvailability(
  stationId?: string | null,
  dateStr: string = new Date().toISOString().split('T')[0],
  durationMinutes: number = 60,
  zone?: string | null
): Promise<AvailabilityResult> {
  const durationHours = Math.ceil(durationMinutes / 60);
  const istOffsetMs = 5.5 * 60 * 60 * 1000;

  // Determine stations to check
  let stationsToCheck: { id: string; name: string; stationType: string; status: string }[] = [];
  let existingBookings: { stationId: string; startTime: Date; endTime: Date; status: string }[] = [];
  let activeSessions: { stationId: string; startedAt: Date; scheduledEndAt: Date }[] = [];

  try {
    if (stationId && stationId !== 'all') {
      const station = await prisma.gamingStation.findUnique({
        where: { id: stationId },
        select: { id: true, name: true, stationType: true, status: true },
      });
      if (station) {
        stationsToCheck = [station];
      }
    } else {
      // Query stations by zone or all active stations (exclude maintenance and deactivated)
      const whereClause: any = {
        status: { notIn: ['MAINTENANCE', 'DEACTIVATED'] },
      };

      if (zone) {
        const normalizedZone = zone.toUpperCase();
        if (
          normalizedZone === 'PS5' ||
          normalizedZone === 'POOL_TABLE' ||
          normalizedZone === 'PC' ||
          normalizedZone === 'VR'
        ) {
          whereClause.stationType = normalizedZone as StationType;
        }
      }

      stationsToCheck = await prisma.gamingStation.findMany({
        where: whereClause,
        select: { id: true, name: true, stationType: true, status: true },
        orderBy: { displayOrder: 'asc' },
      });
    }

    if (stationsToCheck.length > 0) {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dayStartUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - istOffsetMs);
      const dayEndUtc = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0) - istOffsetMs);
      const targetDate = new Date(`${dateStr}T00:00:00.000Z`);
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

      const [bookings, sessions] = await Promise.all([
        prisma.booking.findMany({
          where: {
            stationId: { in: stationsToCheck.map((s) => s.id) },
            AND: [
              {
                OR: [
                  { status: { in: ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] } },
                  { status: 'PENDING', createdAt: { gte: fifteenMinutesAgo } },
                ],
              },
              {
                OR: [
                  { startTime: { lt: dayEndUtc }, endTime: { gt: dayStartUtc } },
                  { date: targetDate },
                ],
              },
            ],
          },
          select: {
            stationId: true,
            startTime: true,
            endTime: true,
            status: true,
          },
        }),
        prisma.gamingSession.findMany({
          where: {
            stationId: { in: stationsToCheck.map((s) => s.id) },
            status: { in: ['ACTIVE', 'PAUSED', 'EXTENDED', 'OVERDUE'] },
          },
          select: {
            stationId: true,
            startedAt: true,
            scheduledEndAt: true,
          },
        }),
      ]);

      existingBookings = bookings;
      activeSessions = sessions;
    }
  } catch (err) {
    console.warn('Availability service running with fallback demo data:', err);
  }

  const slots: TimeSlot[] = [];

  // Current time in IST (UTC+5:30)
  const now = new Date();
  const nowIst = new Date(now.getTime() + istOffsetMs);
  const todayIstStr = nowIst.toISOString().split('T')[0];
  const isToday = dateStr === todayIstStr;
  const currentHourIst = nowIst.getUTCHours();
  const currentMinIst = nowIst.getUTCMinutes();

  const [dateYear, dateMonth, dateDay] = dateStr.split('-').map(Number);

  for (let hour = OPERATING_START_HOUR; hour <= OPERATING_END_HOUR - durationHours; hour++) {
    const startHourStr = hour.toString().padStart(2, '0');
    const endHourStr = (hour + durationHours).toString().padStart(2, '0');
    const startTimeStr = `${startHourStr}:00`;
    const endTimeStr = `${endHourStr}:00`;

    const label = `${format12Hour(startTimeStr)} – ${format12Hour(endTimeStr)}`;
    const period = getPeriod(hour);

    // Exact UTC timestamp boundaries for this candidate slot
    const slotStartUtc = new Date(
      Date.UTC(dateYear, dateMonth - 1, dateDay, hour, 0, 0, 0) - istOffsetMs
    );
    const slotEndUtc = new Date(
      Date.UTC(dateYear, dateMonth - 1, dateDay, hour + durationHours, 0, 0, 0) - istOffsetMs
    );

    // Skip time slots that have already started or start within 5 minutes for today
    if (isToday && slotStartUtc.getTime() < Date.now() + 5 * 60 * 1000) {
      continue;
    }

    // Check availability across all target stations
    const availableStationIds: string[] = [];

    if (stationsToCheck.length === 0) {
      slots.push({
        time: startTimeStr,
        endTime: endTimeStr,
        label,
        period,
        available: true,
        availableStationIds: [],
      });
      continue;
    }

    for (const station of stationsToCheck) {
      if (station.status === 'MAINTENANCE' || station.status === 'DEACTIVATED') {
        continue;
      }

      // Check if station has any overlapping active booking
      const isBooked = existingBookings.some(
        (b) =>
          b.stationId === station.id &&
          b.startTime < slotEndUtc &&
          b.endTime > slotStartUtc
      );

      // Check if station currently has an active gaming session overlapping this slot
      const hasActiveSession = isToday && activeSessions.some(
        (s) =>
          s.stationId === station.id &&
          s.startedAt < slotEndUtc &&
          s.scheduledEndAt > slotStartUtc
      );

      if (!isBooked && !hasActiveSession) {
        availableStationIds.push(station.id);
      }
    }

    const available = availableStationIds.length > 0;
    const reason = available ? undefined : 'Booked';

    slots.push({
      time: startTimeStr,
      endTime: endTimeStr,
      label,
      period,
      available,
      reason,
      availableStationIds,
    });
  }

  return {
    stationId: stationId || 'all',
    zone: zone || null,
    date: dateStr,
    durationMinutes,
    operatingHours: { open: '10:00', close: '24:00' },
    slots,
    totalStationsInZone: stationsToCheck.length,
  };
}
