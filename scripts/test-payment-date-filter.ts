import assert from 'node:assert/strict';
import { paymentDateBounds, paymentDateInISTRange } from '../src/lib/paymentDateFilter';

// 18:30 UTC is midnight in India, so this belongs to the following day.
const midnightIST = '2026-10-23T18:30:00.000Z';
assert.equal(paymentDateInISTRange(midnightIST, '2026-10-24', '2026-10-24'), true);
assert.equal(paymentDateInISTRange(midnightIST, '2026-10-23', '2026-10-23'), false);
assert.equal(paymentDateInISTRange('2026-10-24T18:29:59.999Z', '2026-10-24', '2026-10-24'), true);
assert.equal(paymentDateInISTRange('2026-10-24T18:30:00.000Z', '2026-10-24', '2026-10-24'), false);
assert.equal(paymentDateInISTRange('2026-10-24T05:00:00.000Z', '', '2026-10-24'), true);
assert.deepEqual(
  paymentDateBounds('2026-10-24', '2026-10-24'),
  { gte: new Date('2026-10-23T18:30:00.000Z'), lt: new Date('2026-10-24T18:30:00.000Z') },
);
assert.throws(() => paymentDateBounds('2026-10-25', '2026-10-24'), /Invalid date range/);
console.log('Payment IST date filter passed');
