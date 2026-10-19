import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import mariadb, { type Pool } from 'mariadb';
import fs from 'node:fs';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

function parseDatabaseUrl(urlStr?: string) {
  if (!urlStr) throw new Error('DATABASE_URL is required');
  const parsed = new URL(urlStr);
  if (!['mysql:', 'mariadb:'].includes(parsed.protocol) || !parsed.hostname || !parsed.username || !parsed.pathname.slice(1)) {
    throw new Error('DATABASE_URL must be a valid MySQL connection URL');
  }
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: decodeURIComponent(parsed.pathname.slice(1)),
    connectionLimit: Number(process.env.DB_POOL_LIMIT || 3),
    connectTimeout: 10000,
    acquireTimeout: 10000,
  };
}

function createPrismaClient(): PrismaClient {
  const dbConfig = parseDatabaseUrl(process.env.DATABASE_URL);
  const sslCaValue = process.env.DB_SSL_CA;
  const sslCa = sslCaValue && fs.existsSync(sslCaValue)
    ? fs.readFileSync(sslCaValue, 'utf8')
    : sslCaValue?.replace(/\\n/g, '\n');
  const ssl = process.env.DB_SSL === 'true'
    ? sslCa
      ? { ca: sslCa, rejectUnauthorized: true }
      : true
    : undefined;
  if (ssl) {
    (dbConfig as Record<string, unknown>).ssl = ssl;
  }
  const pool = globalForPrisma.pool ?? mariadb.createPool(dbConfig);
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.pool = pool;
  }

  const adapter = new PrismaMariaDb(pool as any);
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
