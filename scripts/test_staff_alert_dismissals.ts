import assert from 'node:assert/strict';
import test from 'node:test';
import { staffAlertDismissalKey } from '../src/lib/staffAlertDismissals';
import { readAlertDismissalIds, saveAlertDismissal } from '../src/lib/staffAlertDismissalStorage';

test('dismissal keys stay specific to a resource and alert stage', () => {
  const first = staffAlertDismissalKey('session', 'session-1', '15m');
  assert.equal(first, 'session:session-1:15m');
  assert.notEqual(first, staffAlertDismissalKey('session', 'session-1', '10m'));
  assert.notEqual(first, staffAlertDismissalKey('session', 'session-2', '15m'));
  assert.notEqual(first, staffAlertDismissalKey('booking', 'session-1', '15m'));
});

test('dismissals remain available when the new table has not been deployed', async () => {
  const missingTable = { code: 'P2021' };
  const saved = ['session:session-1:15m'];
  const ids = await readAlertDismissalIds(
    async () => { throw missingTable; },
    async () => saved,
  );
  assert.deepEqual(ids, saved);

  let fallbackWrites = 0;
  await saveAlertDismissal(
    async () => { throw missingTable; },
    async () => { fallbackWrites += 1; },
  );
  assert.equal(fallbackWrites, 1);
});

test('dismissal storage uses the primary table when available', async () => {
  const ids = await readAlertDismissalIds(
    async () => ['booking:booking-1:15m'],
    async () => ['booking:booking-1:15m', 'booking:booking-2:5m'],
  );
  assert.deepEqual(ids, ['booking:booking-1:15m', 'booking:booking-2:5m']);

  let fallbackWrites = 0;
  await saveAlertDismissal(async () => {}, async () => { fallbackWrites += 1; });
  assert.equal(fallbackWrites, 0);
});

test('dismissal storage does not hide unrelated database errors', async () => {
  let fallbackWrites = 0;
  await assert.rejects(
    saveAlertDismissal(
      async () => { throw { code: 'P2003' }; },
      async () => { fallbackWrites += 1; },
    ),
    { code: 'P2003' },
  );
  assert.equal(fallbackWrites, 0);
});
