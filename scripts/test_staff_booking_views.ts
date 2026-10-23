import assert from 'node:assert/strict';
import test from 'node:test';
import { filterStaffBookings, staffBookingDayRange } from '../src/lib/staffBookingViews';

const bookings = [
  {
    id: 'live-walk-in',
    status: 'IN_PROGRESS',
    isWalkIn: true,
    startTime: '2026-10-22T18:00:00+05:30',
    session: { status: 'ACTIVE', endedAt: null },
  },
  {
    id: 'online-today',
    status: 'CONFIRMED',
    channel: 'ONLINE',
    startTime: '2026-10-23T18:00:00+05:30',
  },
  {
    id: 'online-tomorrow',
    status: 'CONFIRMED',
    isWalkIn: false,
    startTime: '2026-10-24T18:00:00+05:30',
  },
  {
    id: 'desk-reservation',
    status: 'CONFIRMED',
    isWalkIn: true,
    startTime: '2026-10-23T19:00:00+05:30',
  },
  {
    id: 'completed-yesterday',
    status: 'COMPLETED',
    isWalkIn: true,
    startTime: '2026-10-21T23:00:00+05:30',
    session: { status: 'COMPLETED', endedAt: '2026-10-22T00:30:00+05:30' },
  },
  {
    id: 'completed-today',
    status: 'COMPLETED',
    isWalkIn: false,
    startTime: '2026-10-23T10:00:00+05:30',
    session: { status: 'COMPLETED', endedAt: '2026-10-23T11:00:00+05:30' },
  },
];

const today = '2026-10-23';
const ids = (items: typeof bookings) => items.map((item) => item.id);

test('In Session includes live floor sessions regardless of their booking date', () => {
  assert.deepEqual(ids(filterStaffBookings(bookings, 'ACTIVE', { kind: 'TODAY', today })), ['live-walk-in']);
});

test('Online Booking includes confirmed website reservations and excludes desk walk-ins', () => {
  assert.deepEqual(ids(filterStaffBookings(bookings, 'UPCOMING', { kind: 'ALL', today })), [
    'online-today',
    'online-tomorrow',
  ]);
  assert.deepEqual(ids(filterStaffBookings(bookings, 'UPCOMING', { kind: 'TODAY', today })), [
    'online-today',
  ]);
});

test('History date filter uses completion date in India, including midnight crossings', () => {
  assert.deepEqual(ids(filterStaffBookings(bookings, 'COMPLETED', { kind: 'DATE', date: '2026-10-22', today })), [
    'completed-yesterday',
  ]);
  assert.deepEqual(ids(filterStaffBookings(bookings, 'COMPLETED', { kind: 'TODAY', today })), [
    'completed-today',
  ]);
});

test('date requests use Indian midnight boundaries and reject invalid dates', () => {
  const range = staffBookingDayRange('2026-10-23');
  assert.equal(range.start.toISOString(), '2026-10-22T18:30:00.000Z');
  assert.equal(range.end.toISOString(), '2026-10-23T18:30:00.000Z');
  assert.throws(() => staffBookingDayRange('2026-02-30'), /Invalid booking date/);
});
