import assert from 'node:assert/strict';
import test from 'node:test';
import { canManageStaffSession, sessionHourlyRatePaise, sessionPlayerCount } from '../src/lib/staffSessionRules';

test('only the session owner or an administrator can manage a live session', () => {
  assert.equal(canManageStaffSession('STAFF', 'staff-1', 'staff-1'), true);
  assert.equal(canManageStaffSession('STAFF', 'staff-2', 'staff-1'), false);
  assert.equal(canManageStaffSession('STAFF', 'staff-1', null), false);
  assert.equal(canManageStaffSession('ADMIN', 'admin', 'staff-1'), true);
  assert.equal(canManageStaffSession('SUPER_ADMIN', 'super', 'staff-1'), true);
});

test('PlayStation extensions use the original player tier', () => {
  assert.equal(sessionPlayerCount('Walk-in [Players: 4].', 'PS5'), 4);
  assert.equal(sessionPlayerCount(null, 'PS5'), 1);
  assert.equal(sessionHourlyRatePaise('PS5', 15000, 1), 15000);
  assert.equal(sessionHourlyRatePaise('PS5', 15000, 2), 20000);
  assert.equal(sessionHourlyRatePaise('PS5', 15000, 4), 25000);
  assert.equal(25000 + sessionHourlyRatePaise('PS5', 15000, 4), 50000);
  assert.equal(sessionHourlyRatePaise('POOL_TABLE', 25000, 5), 30000);
});
