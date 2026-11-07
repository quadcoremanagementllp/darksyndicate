import type { Metadata } from 'next';
import Link from 'next/link';
import { PolicyPage, PolicySection } from '@/components/legal/PolicyPage';

export const metadata: Metadata = {
  title: 'Cancellation and Refund Policy',
  description: 'Cancellation eligibility, refund method, and processing times for Dark Syndicate Gaming World bookings.',
};

export default function CancellationAndRefundPolicyPage() {
  return (
    <PolicyPage
      title="Cancellation and Refund Policy"
      description="This policy applies to online reservations for gaming and snooker sessions at Dark Syndicate Gaming World."
      currentPath="/cancellation-and-refund-policy"
    >
      <PolicySection title="Cancel at least two hours before your session">
        <p>If you cancel a confirmed booking at least two hours before its scheduled start, any completed payment for that booking is eligible for a full refund. Sign in, open your bookings, and choose Cancel. The system records the cancellation and queues an eligible payment for staff review.</p>
      </PolicySection>
      <PolicySection title="Cancel within two hours or after the session">
        <p>A cancellation made less than two hours before the scheduled start does not receive an automatic refund. Completed and no-show sessions cannot be cancelled through the customer account. If an exceptional circumstance applies, contact us with your booking reference; any alternative arrangement depends on review and availability.</p>
      </PolicySection>
      <PolicySection title="If a payment succeeds but no booking is confirmed">
        <p>Contact us with the payment ID and your attempted booking details. We will check whether a reservation was created. If the service cannot be provided and the payment was captured, we will arrange an applicable refund rather than treat the payment attempt as a confirmed booking.</p>
      </PolicySection>
      <PolicySection title="Refund review and timing">
        <p>We aim to review and initiate eligible refunds within five business days after cancellation or after confirming an unfulfilled payment. Approved online refunds are sent to the original payment method. After initiation, banks and payment providers usually take a further five to seven business days to credit the amount; the actual time may vary by payment method and bank. If you have not received the credit after ten business days, contact us with your booking reference and payment ID.</p>
      </PolicySection>
      <PolicySection title="Other purchases">
        <p>There is no physical item to return for a booking. Membership passes are currently purchased at reception and are not covered by the online session cancellation window. Ask the venue about applicable pass terms before purchase.</p>
      </PolicySection>
      <PolicySection title="How to request help">
        <p>Use your <Link href="/account/bookings" className="text-ds-ice underline underline-offset-2">booking history</Link> to cancel an eligible reservation. For refund status or payment problems, use the <Link href="/contact" className="text-ds-ice underline underline-offset-2">contact page</Link> and include the booking reference, payment ID, date, and amount. Do not send card numbers, UPI PINs, or passwords.</p>
      </PolicySection>
    </PolicyPage>
  );
}
