const IST_TIME_ZONE = 'Asia/Kolkata';
export const STAFF_INACTIVITY_MINUTES = 60;
const INACTIVITY_MS = STAFF_INACTIVITY_MINUTES * 60 * 1000;

/** Close at the inactivity deadline, bounded by when the server observed the logout. */
export function inactiveShiftEnd(loginAt: Date, observedAt: Date, lastActiveAt?: Date): Date {
  const login = loginAt.getTime();
  const observed = observedAt.getTime();
  const activity = lastActiveAt?.getTime();
  const lastKnownActivity = activity !== undefined && activity >= login && activity <= observed ? activity : login;
  return new Date(Math.min(observed, lastKnownActivity + INACTIVITY_MS));
}

/** Detect old cleanup rows that assigned a fixed two or eight hours after login. */
export function correctedLegacyShiftEnd(
  loginAt: Date,
  logoutAt: Date | null,
  durationMinutes: number | null,
  reason: string | null,
): Date | null {
  const minutes = durationMinutes ?? -1;
  if (!logoutAt || reason !== 'SYSTEM_INACTIVE' || ![120, 480].includes(minutes)) return null;
  const elapsed = logoutAt.getTime() - loginAt.getTime();
  if (elapsed !== minutes * 60 * 1000) return null;
  return new Date(loginAt.getTime() + INACTIVITY_MS);
}

export function formatShiftDateIST(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: IST_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatShiftTimeIST(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: IST_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);
}

/** Inclusive start and exclusive end for one calendar day in India. */
export function istDayBounds(day: string): [Date, Date] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Invalid date');
  const start = new Date(`${day}T00:00:00+05:30`);
  if (Number.isNaN(start.getTime()) || start.toLocaleDateString('en-CA', { timeZone: IST_TIME_ZONE }) !== day) {
    throw new Error('Invalid date');
  }
  return [start, new Date(start.getTime() + 24 * 60 * 60 * 1000)];
}
