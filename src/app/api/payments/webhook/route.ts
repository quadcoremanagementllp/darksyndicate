import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchRazorpayPayment, validRazorpayWebhook } from '@/lib/razorpay';
import { settleBookingPayment } from '@/lib/settle-payment';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-razorpay-signature') || '';
  if (!validRazorpayWebhook(body, signature)) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  let event: { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string } } } };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid event' }, { status: 400 });
  }
  if (event.event !== 'payment.captured') return NextResponse.json({ received: true });
  const gatewayId = event.payload?.payment?.entity?.id;
  const orderId = event.payload?.payment?.entity?.order_id;
  if (!gatewayId || !orderId) return NextResponse.json({ error: 'Missing payment' }, { status: 400 });

  const payment = await prisma.payment.findFirst({ where: { gatewayOrderId: orderId, method: 'RAZORPAY' } });
  if (!payment) return NextResponse.json({ error: 'Order not found' }, { status: 503 });
  try {
    await settleBookingPayment(payment.id, await fetchRazorpayPayment(gatewayId));
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Razorpay webhook settlement failed:', error);
    return NextResponse.json({ error: 'Settlement failed' }, { status: 503 });
  }
}
