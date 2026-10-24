import assert from 'node:assert/strict';
import {
  formatShiftDateIST,
  formatShiftTimeIST,
  istDayBounds,
  inactiveShiftEnd,
  correctedLegacyShiftEnd,
  STAFF_INACTIVITY_MINUTES,
} from '../src/lib/staffShiftTime';

const login = new Date('2026-10-23T07:14:07.000Z');
assert.equal(formatShiftDateIST(login), 'Oct 23, 2026');
assert.equal(formatShiftTimeIST(login), '12:44:07 PM');
assert.equal(formatShiftTimeIST(new Date('2026-10-23T18:30:00.000Z')), '12:00:00 AM');
assert.deepEqual(
  istDayBounds('2026-10-23').map((date) => date.toISOString()),
  ['2026-10-22T18:30:00.000Z', '2026-10-23T18:30:00.000Z'],
);
assert.equal(STAFF_INACTIVITY_MINUTES, 60);
assert.equal(
  inactiveShiftEnd(login, new Date('2026-10-24T07:14:07.000Z')).toISOString(),
  '2026-10-23T08:14:07.000Z',
);
assert.equal(
  inactiveShiftEnd(login, new Date('2026-10-23T12:00:00.000Z'), new Date('2026-10-23T10:14:07.000Z')).toISOString(),
  '2026-10-23T11:14:07.000Z',
);
assert.equal(
  correctedLegacyShiftEnd(login, new Date('2026-10-23T15:14:07.000Z'), 480, 'SYSTEM_INACTIVE')?.toISOString(),
  '2026-10-23T08:14:07.000Z',
);
assert.equal(
  correctedLegacyShiftEnd(login, new Date('2026-10-23T09:14:07.000Z'), 120, 'SYSTEM_INACTIVE')?.toISOString(),
  '2026-10-23T08:14:07.000Z',
);
assert.equal(
  correctedLegacyShiftEnd(login, new Date('2026-10-23T15:14:07.000Z'), 480, 'MANUAL'),
  null,
);
assert.equal(
  correctedLegacyShiftEnd(login, new Date('2026-10-23T15:14:08.000Z'), 480, 'SYSTEM_INACTIVE'),
  null,
);
console.log('Staff shift IST time tests passed');
