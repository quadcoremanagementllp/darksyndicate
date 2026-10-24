import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateSessionCheckout } from '../src/lib/sessionCheckout';

test('discount reduces the balance of an unpaid session', () => {
  assert.deepEqual(calculateSessionCheckout(25000, 0, { discountPaise: 5000 }), {
    finalPricePaise: 20000, discountPaise: 5000, duePaise: 20000, refundPaise: 0,
  });
});

test('an offered price is the final booking price including overtime', () => {
  assert.deepEqual(calculateSessionCheckout(25000, 25000, { finalPricePaise: 50000 }), {
    finalPricePaise: 50000, discountPaise: 0, duePaise: 25000, refundPaise: 0,
  });
});

test('a prepaid discount identifies the amount to return', () => {
  assert.deepEqual(calculateSessionCheckout(25000, 25000, { discountPaise: 5000 }), {
    finalPricePaise: 20000, discountPaise: 5000, duePaise: 0, refundPaise: 5000,
  });
});

test('a paid session without an adjustment has no new balance', () => {
  assert.deepEqual(calculateSessionCheckout(25000, 25000, {}), {
    finalPricePaise: 25000, discountPaise: 0, duePaise: 0, refundPaise: 0,
  });
});

test('invalid or conflicting checkout adjustments are rejected', () => {
  assert.throws(() => calculateSessionCheckout(25000, 0, { discountPaise: 30000 }));
  assert.throws(() => calculateSessionCheckout(25000, 0, { discountPaise: 1000, finalPricePaise: 20000 }));
  assert.throws(() => calculateSessionCheckout(25000, 0, { finalPricePaise: -1 }));
});
