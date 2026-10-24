import assert from 'node:assert/strict';
import test from 'node:test';
import { bookingEndTime } from '../src/lib/bookingTime';

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
