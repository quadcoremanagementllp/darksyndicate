import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';
import { deleteAccountRecords } from '../src/lib/accountDeletion';

const account = { id: 'staff-1', firstName: 'Alex', lastName: 'Operator', phone: '1234567890' };
const calls: string[] = [];
const mockModel = (name: string) => ({
  updateMany: async () => { calls.push(`${name}.updateMany`); },
  deleteMany: async () => { calls.push(`${name}.deleteMany`); },
  delete: async () => { calls.push(`${name}.delete`); },
});
const tx = {
  booking: { ...mockModel('booking'), findFirst: async () => null },
  user: { ...mockModel('user'), upsert: async () => ({ id: 'guest-1' }) },
  payment: mockModel('payment'),
  couponRedemption: mockModel('couponRedemption'),
  membership: mockModel('membership'),
  gamingSession: mockModel('gamingSession'),
  refund: mockModel('refund'),
  auditLog: mockModel('auditLog'),
  staffActivityLog: mockModel('staffActivityLog'),
} as unknown as Prisma.TransactionClient;

async function main() {
  await deleteAccountRecords(tx, account);
  assert.equal(calls.at(-1), 'user.delete');
  assert.ok(calls.includes('payment.updateMany'));
  assert.ok(calls.includes('auditLog.updateMany'));
  assert.ok(calls.includes('staffActivityLog.deleteMany'));

  const blocked = {
    ...tx,
    booking: { ...tx.booking, findFirst: async () => ({ id: 'active-booking' }) },
  } as Prisma.TransactionClient;
  await assert.rejects(() => deleteAccountRecords(blocked, account), /active or upcoming booking/);
  console.log('Account deletion safeguards passed');
}

void main();
