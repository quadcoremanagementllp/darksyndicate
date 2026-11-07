import type { Metadata } from 'next';
import { PolicyPage, PolicySection } from '@/components/legal/PolicyPage';

export const metadata: Metadata = {
  title: 'Shipping Policy',
  description: 'How Dark Syndicate Gaming World delivers booking confirmations and in-venue gaming services.',
};

export default function ShippingPolicyPage() {
  return (
    <PolicyPage
      title="Shipping Policy"
      description="Our bookings are for in-venue gaming sessions. No physical product is shipped when you reserve a slot online."
      currentPath="/shipping-policy"
    >
      <PolicySection title="Digital confirmation">
        <p>After a successful online booking, your reservation details and digital pass are available on the booking confirmation page and in your account. Keep your booking reference or pass ready for check-in.</p>
      </PolicySection>
      <PolicySection title="Service delivery">
        <p>Your gaming or snooker session is provided at the Dark Syndicate venue on the date and time shown in your confirmed booking. Please arrive a few minutes early so staff can check you in.</p>
      </PolicySection>
      <PolicySection title="Shipping charges and delivery times">
        <p>There are no shipping charges or courier deliveries for online session bookings. Digital confirmation is shown after the booking succeeds; the in-venue service begins at your reserved time.</p>
      </PolicySection>
      <PolicySection title="If a confirmation is missing">
        <p>If a payment was deducted but you do not receive a confirmed booking or digital pass, check your account and contact us with the payment ID and the date of payment. We will verify the transaction and arrange confirmation or an applicable refund.</p>
      </PolicySection>
    </PolicyPage>
  );
}
