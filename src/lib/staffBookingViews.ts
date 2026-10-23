export type StaffBookingView = 'ACTIVE' | 'UPCOMING' | 'COMPLETED';

export type StaffDateFilter = {
  kind: 'ALL' | 'TODAY' | 'DATE';
  today: string;
  date?: string;
};

type StaffBooking = {
  status: string;
  isWalkIn?: boolean;
  channel?: string;
  bookingRef?: string | null;
  startTime?: string | null;
  date?: string | null;
  updatedAt?: string | null;
  session?: { status?: string; endedAt?: string | null } | null;
};

export function isActiveStaffBooking(booking: StaffBooking): boolean {
  return (
    booking.status === 'IN_PROGRESS' ||
    booking.status === 'CHECKED_IN' ||
    Boolean(booking.session && ['ACTIVE', 'PAUSED', 'EXTENDED', 'OVERDUE'].includes(booking.session.status || ''))
  );
}

export function isOnlineStaffBooking(booking: StaffBooking): boolean {
  return !booking.isWalkIn && booking.channel !== 'DESK' && !booking.bookingRef?.startsWith('DS-WALK');
}

export function staffBookingDateInIST(booking: StaffBooking, view: StaffBookingView): string {
  const value = view === 'COMPLETED'
    ? booking.session?.endedAt || booking.updatedAt
    : booking.startTime || booking.date;
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function staffBookingDayRange(day: string): { start: Date; end: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Invalid booking date');
  const start = new Date(`${day}T00:00:00+05:30`);
  if (Number.isNaN(start.getTime()) || start.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) !== day) {
    throw new Error('Invalid booking date');
  }
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export function filterStaffBookings<T extends StaffBooking>(
  bookings: T[],
  view: StaffBookingView,
  dateFilter: StaffDateFilter,
): T[] {
  return bookings.filter((booking) => {
    const active = isActiveStaffBooking(booking);
    if (view === 'ACTIVE') return active;
    if (view === 'UPCOMING' && (active || booking.status !== 'CONFIRMED' || !isOnlineStaffBooking(booking))) return false;
    if (view === 'COMPLETED' && (active || booking.status !== 'COMPLETED')) return false;
    if (dateFilter.kind === 'ALL') return true;
    return staffBookingDateInIST(booking, view) === (dateFilter.kind === 'TODAY' ? dateFilter.today : dateFilter.date);
  });
}
