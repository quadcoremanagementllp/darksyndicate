export function canManageStaffSession(role: string | undefined, userId: string | undefined, ownerId: string | null | undefined) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN' || (role === 'STAFF' && Boolean(userId && ownerId && userId === ownerId));
}

export function visibleStaffSessions<T extends { staffId?: string | null }>(sessions: T[], role: string | undefined, userId: string | undefined): T[] {
  return sessions.filter((session) => canManageStaffSession(role, userId, session.staffId));
}

export function sessionHourlyRatePaise(stationType: string | undefined, baseRatePaise: number, playerCount: number) {
  if (stationType === 'PS5') return playerCount >= 3 ? 25000 : playerCount === 2 ? 20000 : 15000;
  if (stationType === 'POOL_TABLE') return 25000 + Math.max(0, playerCount - 4) * 5000;
  return baseRatePaise;
}

export function sessionPlayerCount(notes: string | null | undefined, stationType: string | undefined) {
  const count = notes?.match(/\[Players:\s*(\d+)\]/i);
  return count ? Number(count[1]) : stationType === 'POOL_TABLE' ? 4 : 1;
}
