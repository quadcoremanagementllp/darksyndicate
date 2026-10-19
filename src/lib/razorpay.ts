import { createHmac, timingSafeEqual } from 'node:crypto';

export function razorpayEnabled() {
  return process.env.PAYMENT_MODE === 'live' && Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_WEBHOOK_SECRET);
}

function credentials() {
  if (!razorpayEnabled()) throw new Error('Online payments are not configured');
  return Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
}

async function razorpayRequest<T>(path: string, options?: { method: string; body: unknown }): Promise<T> {
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: options?.method || 'GET',
    headers: {
      Authorization: `Basic ${credentials()}`,
      'Content-Type': 'application/json',
    },
    body: options ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Razorpay request failed (${response.status})`);
  return response.json() as Promise<T>;
}

export async function createRazorpayOrder(amount: number, receipt: string) {
  return razorpayRequest<{ id: string; amount: number; currency: string }>('/orders', {
    method: 'POST',
    body: { amount, currency: 'INR', receipt },
  });
}

export async function fetchRazorpayPayment(id: string) {
  if (!/^pay_[A-Za-z0-9]+$/.test(id)) throw new Error('Invalid gateway payment ID');
  return razorpayRequest<{ id: string; order_id: string; amount: number; currency: string; status: string }>(`/payments/${id}`);
}

export function validRazorpaySignature(orderId: string, paymentId: string, signature: string) {
  if (!/^[a-f0-9]{64}$/i.test(signature) || !process.env.RAZORPAY_KEY_SECRET) return false;
  const actual = Buffer.from(signature, 'hex');
  const expected = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest();
  return timingSafeEqual(actual, expected);
}

export function validRazorpayWebhook(body: string, signature: string) {
  if (!/^[a-f0-9]{64}$/i.test(signature) || !process.env.RAZORPAY_WEBHOOK_SECRET) return false;
  const actual = Buffer.from(signature, 'hex');
  const expected = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest();
  return timingSafeEqual(actual, expected);
}
