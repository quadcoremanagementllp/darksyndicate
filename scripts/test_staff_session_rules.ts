import assert from 'node:assert/strict';
import test from 'node:test';
import { canManageStaffSession, visibleStaffSessions, sessionHourlyRatePaise, sessionPlayerCount } from '../src/lib/staffSessionRules';

test('staff and administrators can manage live sessions', () => {
  assert.equal(canManageStaffSession('STAFF', 'staff-1', 'staff-1'), true);
  assert.equal(canManageStaffSession('STAFF', 'staff-2', 'staff-1'), true);
  assert.equal(canManageStaffSession('STAFF', 'staff-1', null), true);
  assert.equal(canManageStaffSession('ADMIN', 'admin', 'staff-1'), true);
  assert.equal(canManageStaffSession('SUPER_ADMIN', 'super', 'staff-1'), true);
  assert.equal(canManageStaffSession('CUSTOMER', 'cust-1', 'staff-1'), false);
  assert.equal(canManageStaffSession(undefined, undefined, undefined), false);
});

test('floor alerts include sessions for all on-duty staff and administrators', () => {
  const sessions = [
    { id: 'one', staffId: 'staff-1' },
    { id: 'two', staffId: 'staff-2' },
    { id: 'legacy', staffId: null },
  ];
  assert.deepEqual(visibleStaffSessions(sessions, 'STAFF', 'staff-1').map((session) => session.id), ['one', 'two', 'legacy']);
  assert.deepEqual(visibleStaffSessions(sessions, 'STAFF', 'staff-2').map((session) => session.id), ['one', 'two', 'legacy']);
  assert.deepEqual(visibleStaffSessions(sessions, 'ADMIN', 'admin').map((session) => session.id), ['one', 'two', 'legacy']);
  assert.deepEqual(visibleStaffSessions(sessions, 'SUPER_ADMIN', 'super').map((session) => session.id), ['one', 'two', 'legacy']);
  assert.deepEqual(visibleStaffSessions(sessions, undefined, undefined), []);
});

test('PlayStation extensions use the original player tier', () => {
  assert.equal(sessionPlayerCount('Walk-in [Players: 4].', 'PS5'), 4);
  assert.equal(sessionPlayerCount(null, 'PS5'), 1);
  assert.equal(sessionHourlyRatePaise('PS5', 15000, 1), 15000);
  assert.equal(sessionHourlyRatePaise('PS5', 15000, 2), 20000);
  assert.equal(sessionHourlyRatePaise('PS5', 15000, 4), 25000);
  assert.equal(25000 + sessionHourlyRatePaise('PS5', 15000, 4), 50000);
  assert.equal(sessionHourlyRatePaise('POOL_TABLE', 25000, 5), 30000);
  assert.equal(sessionHourlyRatePaise('POOL_TABLE', 30000, 4), 25000);
  assert.equal(sessionHourlyRatePaise('POOL_TABLE', 30000, 5), 30000);
  assert.equal(sessionHourlyRatePaise('POOL_TABLE', 30000, 6), 35000);
});
