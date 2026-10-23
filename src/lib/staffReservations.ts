import { canManageStaffSession } from './staffSessionRules';

type ReservationSource = {
  payments: Array<{ recordedByStaffId: string | null }>;
};

export function reservationCreatorId(booking: ReservationSource, loggedCreatorId: string | null): string | null {
  if (loggedCreatorId) return loggedCreatorId;
  const cashierId = booking.payments.find((payment) => payment.recordedByStaffId)?.recordedByStaffId;
  return cashierId || null;
}

export const canDeleteReservation = canManageStaffSession;
