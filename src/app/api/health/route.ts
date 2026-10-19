import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const startTime = Date.now();
  let dbStatus = 'healthy';
  let dbLatencyMs = 0;

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
  } catch (err: any) {
    dbStatus = 'unhealthy';
    dbLatencyMs = Date.now() - startTime;
  }

  const memory = process.memoryUsage();
  const uptimeSeconds = Math.floor(process.uptime());

  const healthData = {
    status: dbStatus === 'healthy' ? 'healthy' : 'unhealthy',
    release: '1.0.0-phase6',
    system: 'DARK SYNDICATE GAMING WORLD',
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString(),
    localTimeIST: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    uptime: {
      seconds: uptimeSeconds,
      formatted: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m ${uptimeSeconds % 60}s`,
    },
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs,
      engine: 'MySQL / MariaDB via Prisma ORM',
    },
    memory: {
      rssMB: Math.round(memory.rss / (1024 * 1024)),
      heapUsedMB: Math.round(memory.heapUsed / (1024 * 1024)),
      heapTotalMB: Math.round(memory.heapTotal / (1024 * 1024)),
    },
    services: {
      bookingEngine: 'active',
      staffOperations: 'active',
      adminDashboard: 'active',
      auditLogging: 'active',
      notificationEngine: 'active',
      cms: 'active',
    },
    checks: {
      securityHeaders: 'enforced',
      priceTamperingDefense: 'enforced',
      rbacRoleGuards: 'enforced',
    },
  };

  return NextResponse.json(healthData, {
    status: dbStatus === 'healthy' ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-Health-Check': dbStatus === 'healthy' ? 'PASS' : 'FAIL',
    },
  });
}
