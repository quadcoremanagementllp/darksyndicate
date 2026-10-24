import assert from 'node:assert/strict';
import test from 'node:test';
import { staffAlertDismissalKey } from '../src/lib/staffAlertDismissals';

test('dismissal keys stay specific to a resource and alert stage', () => {
  const first = staffAlertDismissalKey('session', 'session-1', '15m');
  assert.equal(first, 'session:session-1:15m');
  assert.notEqual(first, staffAlertDismissalKey('session', 'session-1', '10m'));
  assert.notEqual(first, staffAlertDismissalKey('session', 'session-2', '15m'));
  assert.notEqual(first, staffAlertDismissalKey('booking', 'session-1', '15m'));
});
