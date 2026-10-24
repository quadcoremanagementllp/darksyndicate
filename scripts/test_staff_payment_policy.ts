import assert from 'node:assert/strict';
import test from 'node:test';
import { isPayAfterBooking, isStaffReservation } from '../src/lib/staffPaymentPolicy';

test('staff reservations stay pay-after even with an old settled marker', () => {
  assert.equal(isStaffReservation('[Front Desk Pre-Booking] [SETTLED]'), true);
  assert.equal(isPayAfterBooking('[Front Desk Pre-Booking] [SETTLED]'), true);
  assert.equal(isPayAfterBooking('[Front Desk Pre-Booking] [PAY ON EXIT]'), true);
});

test('staff walk-ins stay pay-after, while ordinary bookings keep their own timing', () => {
  assert.equal(isPayAfterBooking('[PAY ON EXIT] [Players: 4]'), true);
  assert.equal(isPayAfterBooking('Online booking [Players: 2]'), false);
  assert.equal(isStaffReservation(null), false);
});
