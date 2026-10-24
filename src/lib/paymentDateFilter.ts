import { istDayBounds } from './staffShiftTime';

/** UTC bounds for an inclusive India-time date range. */
export function paymentDateBounds(from: string, to: string): { gte?: Date; lt?: Date } {
  if (from && to && from > to) throw new Error('Invalid date range');
  return {
    ...(from ? { gte: istDayBounds(from)[0] } : {}),
    ...(to ? { lt: istDayBounds(to)[1] } : {}),
  };
}

/** Match ledger timestamps against calendar dates in India, including both chosen days. */
export function paymentDateInISTRange(paidAt: string, from: string, to: string): boolean {
  if (!from && !to) return true;
  const timestamp = new Date(paidAt);
  if (Number.isNaN(timestamp.getTime())) return false;
  const day = timestamp.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  return (!from || day >= from) && (!to || day <= to);
}
