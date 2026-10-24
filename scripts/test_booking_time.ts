import assert from 'node:assert/strict';
import test from 'node:test';
import { bookingEndTime, to24HourTime } from '../src/lib/bookingTime';

test('AM/PM custom time converts to the value used by availability and reservations', () => {
  assert.equal(to24HourTime(4, 15, 'PM'), '16:15');
  assert.equal(to24HourTime(12, 0, 'AM'), '00:00');
  assert.equal(to24HourTime(12, 0, 'PM'), '12:00');
  assert.equal(to24HourTime(11, 59, 'PM'), '23:59');
  assert.equal(to24HourTime(0, 15, 'AM'), null);
  assert.equal(to24HourTime(4, 60, 'PM'), null);
});

test('custom reservation end time follows the selected duration', () => {
  assert.deepEqual(bookingEndTime('16:15', 60), { time: '17:15', nextDay: false });
  assert.deepEqual(bookingEndTime('16:15', 120), { time: '18:15', nextDay: false });
  assert.deepEqual(bookingEndTime('23:45', 60), { time: '00:45', nextDay: true });
});

test('invalid custom times are rejected', () => {
  assert.equal(bookingEndTime('24:00', 60), null);
  assert.equal(bookingEndTime('16:99', 60), null);
  assert.equal(bookingEndTime('16:15', 0), null);
});
