export const STAFF_RESERVATION_MARKER = '[Front Desk Pre-Booking]';
export const PAY_ON_EXIT_MARKER = '[PAY ON EXIT]';

export function isStaffReservation(notes: string | null | undefined): boolean {
  return Boolean(notes?.includes(STAFF_RESERVATION_MARKER));
}

export function isPayAfterBooking(notes: string | null | undefined): boolean {
  return Boolean(notes?.includes(PAY_ON_EXIT_MARKER) || isStaffReservation(notes));
}
