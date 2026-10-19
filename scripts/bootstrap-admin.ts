import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 16) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD (at least 16 characters) are required');
  const existingAdmins = await prisma.user.count({ where: { role: 'SUPER_ADMIN' } });
  if (existingAdmins) throw new Error('A super admin already exists. Bootstrap is for empty databases only.');
  await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 12),
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log('Initial super admin created');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
