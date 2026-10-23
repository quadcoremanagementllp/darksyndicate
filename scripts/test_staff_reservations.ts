import assert from 'node:assert/strict';
import test from 'node:test';
import { reservationCreatorId, canDeleteReservation } from '../src/lib/staffReservations';

test('reservation creator is the staff member recorded when the reservation was made', () => {
  const booking = { payments: [{ recordedByStaffId: 'cashier' }] };
  assert.equal(reservationCreatorId(booking, 'creator'), 'creator');
  assert.equal(reservationCreatorId(booking, null), 'cashier');
  assert.equal(reservationCreatorId({ ...booking, payments: [] }, null), null);
});

test('only the creator or an administrator can delete a reservation', () => {
  assert.equal(canDeleteReservation('STAFF', 'creator', 'creator'), true);
  assert.equal(canDeleteReservation('STAFF', 'other', 'creator'), false);
  assert.equal(canDeleteReservation('STAFF', 'creator', null), false);
  assert.equal(canDeleteReservation('ADMIN', 'admin', null), true);
  assert.equal(canDeleteReservation('SUPER_ADMIN', 'super', 'creator'), true);
});
