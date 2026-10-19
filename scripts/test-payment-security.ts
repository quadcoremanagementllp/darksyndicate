import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { razorpayEnabled, validRazorpaySignature, validRazorpayWebhook } from '../src/lib/razorpay';

const original = {
  mode: process.env.PAYMENT_MODE,
  key: process.env.RAZORPAY_KEY_ID,
  secret: process.env.RAZORPAY_KEY_SECRET,
  webhook: process.env.RAZORPAY_WEBHOOK_SECRET,
};

try {
  process.env.PAYMENT_MODE = 'disabled';
  process.env.RAZORPAY_KEY_ID = 'rzp_test_example';
  process.env.RAZORPAY_KEY_SECRET = 'secret-for-test';
  process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook-for-test';
  assert.equal(razorpayEnabled(), false, 'payment mode must disable checkout');
  process.env.PAYMENT_MODE = 'live';
  assert.equal(razorpayEnabled(), true);

  const order = 'order_123';
  const payment = 'pay_456';
  const signature = createHmac('sha256', 'secret-for-test').update(`${order}|${payment}`).digest('hex');
  assert.equal(validRazorpaySignature(order, payment, signature), true);
  assert.equal(validRazorpaySignature(order, 'pay_wrong', signature), false);
  assert.equal(validRazorpaySignature(order, payment, 'not-a-signature'), false);

  const body = JSON.stringify({ event: 'payment.captured', id: 'evt_123' });
  const webhookSignature = createHmac('sha256', 'webhook-for-test').update(body).digest('hex');
  assert.equal(validRazorpayWebhook(body, webhookSignature), true);
  assert.equal(validRazorpayWebhook(body + ' ', webhookSignature), false);
  console.log('Payment signature and configuration checks passed');
} finally {
  for (const [key, value] of Object.entries({
    PAYMENT_MODE: original.mode,
    RAZORPAY_KEY_ID: original.key,
    RAZORPAY_KEY_SECRET: original.secret,
    RAZORPAY_WEBHOOK_SECRET: original.webhook,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
