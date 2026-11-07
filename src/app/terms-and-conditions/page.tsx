import type { Metadata } from 'next';
import Link from 'next/link';
import { PolicyPage, PolicySection } from '@/components/legal/PolicyPage';

export const metadata: Metadata = {
  title: 'Terms and Conditions',
  description: 'Terms for booking and using Dark Syndicate Gaming World services.',
};

export default function TermsAndConditionsPage() {
  return (
    <PolicyPage
      title="Terms and Conditions"
      description="These terms apply when you use the Dark Syndicate Gaming World website, reserve a gaming session, or use our venue services."
      currentPath="/terms-and-conditions"
    >
      <PolicySection title="Bookings and accounts">
        <p>Provide accurate player and contact details when creating an account or booking a station. A reservation is confirmed only when the site displays a booking reference and confirmation. Keep your account credentials and booking pass secure.</p>
      </PolicySection>
      <PolicySection title="Prices and payments">
        <p>Prices are shown in Indian rupees before you confirm a booking. The checkout total is the amount payable for the selected station, players, and duration. Online payments are processed through Razorpay; walk-in payments may be collected at the venue. A payment attempt alone does not guarantee a reservation if the slot cannot be confirmed.</p>
      </PolicySection>
      <PolicySection title="Using your reserved slot">
        <p>Arrive in time for your scheduled session and present your booking reference or digital pass when requested. Extensions depend on station availability and may incur additional charges shown or explained before they are accepted. Please follow staff instructions and treat equipment, other guests, and the venue with care.</p>
      </PolicySection>
      <PolicySection title="Changes, cancellations, and refunds">
        <p>Booking cancellations and refunds follow our <Link href="/cancellation-and-refund-policy" className="text-ds-ice underline underline-offset-2">Cancellation and Refund Policy</Link>. The online booking policy does not automatically apply to membership passes purchased at reception; ask staff about the applicable pass terms before purchase.</p>
      </PolicySection>
      <PolicySection title="Service availability">
        <p>We may need to change a station or timing if equipment is unavailable or the venue cannot provide the booked service. If we cannot fulfil a confirmed booking, contact us so we can arrange an alternative or an applicable refund. Website content and prices may be updated, but a confirmed booking retains the details shown in its confirmation unless you agree to a change.</p>
      </PolicySection>
      <PolicySection title="Website use and support">
        <p>Do not misuse the website, interfere with other bookings, or attempt unauthorised access to accounts or systems. Contact us if you find an error in a booking, payment, or account record. These terms are read alongside our <Link href="/privacy-policy" className="text-ds-ice underline underline-offset-2">Privacy Policy</Link>.</p>
      </PolicySection>
    </PolicyPage>
  );
}
